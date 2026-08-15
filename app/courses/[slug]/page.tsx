import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ViewTracker } from "@/components/analytics/view-tracker";
import { CourseContent } from "@/components/course/course-content";
import { CourseHero } from "@/components/course/course-hero";
import { CourseProgressBar } from "@/components/course/course-progress-bar";
import { LearningOutcomes } from "@/components/course/learning-outcomes";
import { ChartDecoration } from "@/components/home/chart-decoration";
import { PageFrame } from "@/components/layout/page-frame";
import { SiteHeader } from "@/components/layout/site-header";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { coursesHref, lessonHref } from "@/lib/routes";
import { CACHE_TAGS, sanityFetch } from "@/sanity/lib/fetch";
import { COURSE_BY_SLUG_QUERY, COURSE_SLUGS_QUERY } from "@/sanity/lib/queries";

async function getCourse(slug: string) {
  return sanityFetch({
    query: COURSE_BY_SLUG_QUERY,
    params: { slug },
    tags: [CACHE_TAGS.course, CACHE_TAGS.lesson],
  });
}

export async function generateStaticParams() {
  const courses = await sanityFetch({ query: COURSE_SLUGS_QUERY, tags: [CACHE_TAGS.course] });

  return courses
    .filter((course) => course.slug !== null)
    .map((course) => ({ slug: course.slug as string }));
}

export async function generateMetadata({
  params,
}: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourse(slug);

  if (!course) return {};

  return {
    title: course.title ?? "Course",
    description: course.summary ?? undefined,
  };
}

export default async function CoursePage({ params }: PageProps<"/courses/[slug]">) {
  const { slug } = await params;
  const course = await getCourse(slug);

  if (!course) notFound();

  const modules = course.modules ?? [];
  const outcomes = course.learningOutcomes ?? [];

  // Progress is not tracked yet (AGENTS.md §7), so "continue" means the first lesson.
  const firstLessonSlug = modules.flatMap((module) => module.lessons ?? [])[0]?.slug ?? null;
  const continueHref = firstLessonSlug ? lessonHref(firstLessonSlug) : null;

  return (
    <PageFrame>
      <SiteHeader activeHref={coursesHref} />

      <ViewTracker
        event={ANALYTICS_EVENTS.courseViewed}
        viewKey={slug}
        properties={{
          course_slug: slug,
          module_count: modules.length,
          lesson_count: modules.reduce((total, module) => total + (module.lessons?.length ?? 0), 0),
          level: course.level ?? null,
        }}
      />

      <main className="relative flex flex-1 flex-col px-6 pt-11 pb-8 sm:px-12 xl:px-18">
        <Breadcrumbs
          items={[
            { label: "All Courses", href: coursesHref },
            { label: course.title ?? "Course" },
          ]}
        />

        <div className="mt-10 flex flex-col gap-14">
          <CourseHero course={course} continueHref={continueHref} />

          {outcomes.length > 0 && <LearningOutcomes outcomes={outcomes} />}

          {modules.length > 0 && (
            <CourseContent modules={modules} durationSeconds={course.durationSeconds} />
          )}
        </div>

        <CourseProgressBar
          percentComplete={0}
          continueHref={continueHref}
          courseSlug={slug}
          className="mt-14"
        />
      </main>

      <ChartDecoration />
    </PageFrame>
  );
}
