import type { Metadata } from "next";
import Link from "next/link";
import { ViewTracker } from "@/components/analytics/view-tracker";
import { CourseGrid } from "@/components/cards/course-grid";
import { ChartDecoration } from "@/components/home/chart-decoration";
import { PageFrame } from "@/components/layout/page-frame";
import { SiteHeader } from "@/components/layout/site-header";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { pluralize } from "@/lib/format";
import { coursesHref } from "@/lib/routes";
import { CACHE_TAGS, sanityFetch } from "@/sanity/lib/fetch";
import { COURSES_LIST_QUERY } from "@/sanity/lib/queries";

export const metadata: Metadata = {
  title: "All Courses",
  description: "Every course on Vertex, from first principles to production.",
};

export default async function CoursesPage() {
  const courses = await sanityFetch({
    query: COURSES_LIST_QUERY,
    tags: [CACHE_TAGS.course, CACHE_TAGS.lesson],
  });

  return (
    <PageFrame>
      <SiteHeader activeHref={coursesHref} />

      <ViewTracker
        event={ANALYTICS_EVENTS.catalogViewed}
        properties={{ course_count: courses.length }}
      />

      <main className="flex flex-1 flex-col px-6 pt-11 pb-16 sm:px-12 xl:px-18 xl:pb-20">
        <Breadcrumbs items={[{ label: "All Courses" }]} />

        <div className="mt-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1 className="font-display text-[38px] leading-11 font-bold text-neutral-900">
            All Courses
          </h1>
          {courses.length > 0 && (
            <p className="text-[13px] leading-5 text-neutral-500">
              {pluralize(courses.length, "course")}
            </p>
          )}
        </div>

        {courses.length > 0 ? (
          <div className="mt-8">
            <CourseGrid courses={courses} />
          </div>
        ) : (
          <p className="mt-8 text-[17px] leading-7 text-neutral-500">
            No courses are published yet.{" "}
            <Link
              href="/"
              className="rounded-xs text-primary-500 transition-colors hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              Back to the home page
            </Link>
            .
          </p>
        )}
      </main>

      <ChartDecoration />
    </PageFrame>
  );
}
