import "server-only";

import { lessonLabel } from "@/lib/format";
import { lessonHref } from "@/lib/routes";
import { CACHE_TAGS, sanityFetch } from "@/sanity/lib/fetch";
import { LESSONS_BY_IDS_QUERY } from "@/sanity/lib/queries";
import { MAX_RESULTS, type ModelHit, type SearchResult, type SearchSort } from "./types";

/**
 * Turns the model's hits into result cards built entirely from the dataset.
 *
 * The model contributes a lesson `_id`, a reason, a rank, and — on a video hit — a start second it
 * read out of a real chapter or transcript chunk. Everything a card displays is read back from
 * Sanity here, so a hallucinated title or duration cannot reach the response (AGENTS.md §7). A hit
 * naming a lesson that does not resolve is dropped.
 */
export async function groundHits(hits: ModelHit[], sort: SearchSort): Promise<SearchResult[]> {
  const ranked = [...hits].sort((a, b) => a.rank - b.rank).slice(0, MAX_RESULTS);

  // One hit per lesson: the model is told to merge, this enforces it.
  const byLesson = new Map<string, ModelHit>();
  for (const hit of ranked) {
    if (!byLesson.has(hit.lessonId)) byLesson.set(hit.lessonId, hit);
  }

  const ids = [...byLesson.keys()];
  if (!ids.length) return [];

  const lessons = await sanityFetch({
    query: LESSONS_BY_IDS_QUERY,
    params: { ids },
    tags: [CACHE_TAGS.lesson, CACHE_TAGS.course],
  });

  const lessonsById = new Map(lessons.map((lesson) => [lesson._id, lesson]));

  const results: SearchResult[] = [];

  for (const hit of byLesson.values()) {
    const lesson = lessonsById.get(hit.lessonId);

    // The model named something that is not a lesson in this dataset, or the lesson is orphaned and
    // has no course to label it with. Either way there is no card to show.
    if (!lesson?.slug || !lesson.title || !lesson.course?.title || !lesson.course.slug) continue;

    const modules = lesson.course.modules ?? [];
    const moduleIndex = modules.findIndex((module) => module.lessonIds?.includes(lesson._id));
    if (moduleIndex < 0) continue;

    const lessonIndex = modules[moduleIndex].lessonIds?.indexOf(lesson._id) ?? -1;
    if (lessonIndex < 0) continue;

    const base = {
      lessonId: lesson._id,
      lessonSlug: lesson.slug,
      lessonTitle: lesson.title,
      label: lessonLabel(moduleIndex, lessonIndex),
      moduleTitle: modules[moduleIndex].title ?? null,
      courseTitle: lesson.course.title,
      courseSlug: lesson.course.slug,
      courseIconRef: lesson.course.iconRef ?? null,
      durationSeconds: lesson.duration ?? null,
      freePreview: lesson.freePreview ?? false,
      keyPoints: lesson.keyPoints ?? [],
      thumbnailRef: lesson.thumbnailRef ?? null,
      reason: hit.reason,
      rank: hit.rank,
    };

    // A video hit without a real start second is just a lesson hit — the model was told never to
    // estimate one, and a moment with no timestamp has nothing to link to.
    const startSeconds =
      hit.kind === "video" && hit.startSeconds !== null && hit.startSeconds >= 0
        ? hit.startSeconds
        : null;

    results.push(
      startSeconds === null
        ? { ...base, kind: "lesson", href: lessonHref(lesson.slug) }
        : {
            ...base,
            kind: "video",
            startSeconds,
            momentLabel: hit.momentLabel ?? null,
            href: lessonHref(lesson.slug, startSeconds),
          },
    );
  }

  return sortResults(results, lessonsById, sort);
}

type LessonsById = Map<string, { _createdAt: string }>;

/**
 * Sorting happens here rather than in the model: it is deterministic, and re-sorting never costs
 * another LLM call. `relevance` is the model's own ranking (§11's default).
 */
function sortResults(results: SearchResult[], lessons: LessonsById, sort: SearchSort) {
  if (sort === "relevance") return results.sort((a, b) => a.rank - b.rank);

  if (sort === "duration") {
    return results.sort(
      (a, b) => (a.durationSeconds ?? Infinity) - (b.durationSeconds ?? Infinity) || a.rank - b.rank,
    );
  }

  return results.sort((a, b) => {
    const createdA = lessons.get(a.lessonId)?._createdAt ?? "";
    const createdB = lessons.get(b.lessonId)?._createdAt ?? "";
    return createdB.localeCompare(createdA) || a.rank - b.rank;
  });
}
