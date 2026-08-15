import { defineQuery } from "next-sanity";

/**
 * Every query the site reads content through. Names are unique across the codebase because
 * TypeGen keys generated result types off the variable name.
 *
 * Conventions:
 * - project `"slug": slug.current` so callers never unwrap a slug object
 * - project `_key` on every array item, for React keys and Visual Editing
 * - list queries never return Portable Text bodies
 * - module and lesson numbering is derived from array order by the caller, never stored
 */

const COURSE_CARD_FIELDS = /* groq */ `
  _id,
  title,
  "slug": slug.current,
  summary,
  level,
  price,
  popular,
  studentCount,
  coverImage,
  "instructor": instructor->{name, "slug": slug.current, photo},
  "category": category->{title, "slug": slug.current},
  "moduleCount": count(modules),
  "lessonCount": count(modules[].lessons[]),
  "durationSeconds": math::sum(modules[].lessons[]->duration)
`;

/** Catalog listing. Popular courses first, then alphabetical. */
export const COURSES_LIST_QUERY = defineQuery(`
  *[_type == "course" && defined(slug.current)]
  | order(popular desc, title asc) {
    ${COURSE_CARD_FIELDS}
  }
`);

/** Slugs for generateStaticParams. */
export const COURSE_SLUGS_QUERY = defineQuery(`
  *[_type == "course" && defined(slug.current)]{"slug": slug.current}
`);

/** Full course detail, including the curriculum. */
export const COURSE_BY_SLUG_QUERY = defineQuery(`
  *[_type == "course" && slug.current == $slug][0]{
    ${COURSE_CARD_FIELDS},
    learningOutcomes[]{_key, icon, title, description},
    "instructorDetail": instructor->{
      _id,
      name,
      "slug": slug.current,
      photo,
      expertise,
      bio
    },
    modules[]{
      _key,
      title,
      summary,
      "durationSeconds": math::sum(lessons[]->duration),
      lessons[]->{
        _id,
        title,
        "slug": slug.current,
        duration,
        freePreview
      }
    }
  }
`);

/** Slugs for generateStaticParams. */
export const LESSON_SLUGS_QUERY = defineQuery(`
  *[_type == "lesson" && defined(slug.current)]{"slug": slug.current}
`);

/**
 * Lesson detail. A lesson does not store its parent course, so the course is derived with a
 * reverse reference, and the full curriculum comes back so the page can compute the
 * "Lesson 5.1" label and render the sidebar.
 */
export const LESSON_BY_SLUG_QUERY = defineQuery(`
  *[_type == "lesson" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    videoUrl,
    thumbnail,
    duration,
    freePreview,
    studentCount,
    notes,
    keyPoints,
    proTip,
    resources[]{_key, type, title, description, url},
    "course": *[_type == "course" && references(^._id)][0]{
      _id,
      title,
      "slug": slug.current,
      level,
      coverImage,
      "instructor": instructor->{name, "slug": slug.current, photo},
      modules[]{
        _key,
        title,
        "durationSeconds": math::sum(lessons[]->duration),
        lessons[]->{
          _id,
          title,
          "slug": slug.current,
          duration,
          freePreview
        }
      }
    }
  }
`);

/**
 * Grounding read for search. The LLM only names lesson `_id`s (AGENTS.md §7, §11) — every field a
 * result card shows is read back from the dataset here, so nothing the model wrote reaches the UI.
 *
 * The parent course comes from a reverse reference, and its modules come back whole so the caller
 * can derive the module title and the positional "5.1" label from array order.
 */
export const LESSONS_BY_IDS_QUERY = defineQuery(`
  *[_type == "lesson" && _id in $ids]{
    _id,
    _createdAt,
    title,
    "slug": slug.current,
    duration,
    freePreview,
    keyPoints,
    "thumbnailRef": thumbnail.asset._ref,
    "course": *[_type == "course" && references(^._id)][0]{
      title,
      "slug": slug.current,
      "iconRef": coverImage.asset._ref,
      modules[]{
        _key,
        title,
        "lessonIds": lessons[]._ref
      }
    }
  }
`);

/** Instructor index. */
export const INSTRUCTORS_LIST_QUERY = defineQuery(`
  *[_type == "instructor" && defined(slug.current)] | order(name asc) {
    _id,
    name,
    "slug": slug.current,
    photo,
    expertise,
    "courseCount": count(*[_type == "course" && instructor._ref == ^._id])
  }
`);

/** Instructor detail with the courses they teach. */
export const INSTRUCTOR_BY_SLUG_QUERY = defineQuery(`
  *[_type == "instructor" && slug.current == $slug][0]{
    _id,
    name,
    "slug": slug.current,
    photo,
    expertise,
    bio,
    "courses": *[_type == "course" && instructor._ref == ^._id] | order(title asc) {
      ${COURSE_CARD_FIELDS}
    }
  }
`);

/** Catalog filters. */
export const CATEGORIES_LIST_QUERY = defineQuery(`
  *[_type == "category" && defined(slug.current)] | order(title asc) {
    _id,
    title,
    "slug": slug.current,
    description,
    "courseCount": count(*[_type == "course" && category._ref == ^._id])
  }
`);
