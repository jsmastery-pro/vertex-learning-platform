import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageFrame } from "@/components/layout/page-frame";
import { SiteHeader } from "@/components/layout/site-header";
import { buildCurriculum } from "@/components/lesson/lesson-curriculum";
import { LessonFooterNav } from "@/components/lesson/lesson-footer-nav";
import { LessonHeader } from "@/components/lesson/lesson-header";
import { LessonKeyPoints, LessonProTip } from "@/components/lesson/lesson-key-points";
import { LessonNotes } from "@/components/lesson/lesson-notes";
import { LessonResources } from "@/components/lesson/lesson-resources";
import { LessonSidebar } from "@/components/lesson/lesson-sidebar";
import { LessonTabs } from "@/components/lesson/lesson-tabs";
import { LessonVideo } from "@/components/lesson/lesson-video";
import { LessonViewTracker } from "@/components/lesson/lesson-view-tracker";
import { Breadcrumbs } from "@/components/nav/breadcrumbs";
import { firstParagraph, splitLeadParagraph, truncate } from "@/lib/portable-text";
import { START_SECONDS_PARAM, courseHref, coursesHref } from "@/lib/routes";
import { parseVideoUrl } from "@/lib/video";
import { CACHE_TAGS, sanityFetch } from "@/sanity/lib/fetch";
import { urlFor } from "@/sanity/lib/image";
import { LESSON_BY_SLUG_QUERY, LESSON_SLUGS_QUERY } from "@/sanity/lib/queries";

async function getLesson(slug: string) {
  return sanityFetch({
    query: LESSON_BY_SLUG_QUERY,
    params: { slug },
    tags: [CACHE_TAGS.lesson, CACHE_TAGS.course],
  });
}

export async function generateStaticParams() {
  const lessons = await sanityFetch({ query: LESSON_SLUGS_QUERY, tags: [CACHE_TAGS.lesson] });

  return lessons
    .filter((lesson) => lesson.slug !== null)
    .map((lesson) => ({ slug: lesson.slug as string }));
}

export async function generateMetadata({
  params,
}: PageProps<"/lessons/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const lesson = await getLesson(slug);

  if (!lesson) return {};

  const summary = firstParagraph(lesson.notes);

  return {
    title: lesson.title ?? "Lesson",
    description: summary ? truncate(summary, 155) : undefined,
  };
}

/** `?t=765` — the matched second a search result deep-links to (AGENTS.md §7). */
function readStartSeconds(value: string | string[] | undefined, durationSeconds: number | null) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return durationSeconds ? Math.min(parsed, durationSeconds) : parsed;
}

export default async function LessonPage({ params, searchParams }: PageProps<"/lessons/[slug]">) {
  const { slug } = await params;
  const lesson = await getLesson(slug);

  if (!lesson) notFound();

  const course = lesson.course;
  const curriculum = buildCurriculum(course?.modules, lesson._id);
  // The lesson schema has no summary field, so the notes' lead paragraph fills that role — and is
  // dropped from the body below so the page does not print it twice.
  const { lead: summary, rest: body } = splitLeadParagraph(lesson.notes);
  const startSeconds = readStartSeconds(
    (await searchParams)[START_SECONDS_PARAM],
    lesson.duration,
  );

  const keyPoints = lesson.keyPoints ?? [];
  const resources = lesson.resources ?? [];

  return (
    <PageFrame>
      <SiteHeader activeHref={coursesHref} />

      <div className="flex flex-1 flex-col lg:flex-row">
        {course && (
          <LessonSidebar
            courseTitle={course.title}
            courseSlug={course.slug}
            courseImageUrl={
              course.coverImage?.asset
                ? urlFor(course.coverImage).width(96).height(96).fit("crop").url()
                : null
            }
            courseImageAlt={course.coverImage?.alt ?? course.title ?? ""}
            modules={curriculum.modules}
            percentComplete={0}
            className="border-b border-canvas-line lg:w-69.5 lg:shrink-0 lg:border-r lg:border-b-0"
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-col gap-8 px-6 pt-8 pb-10 sm:px-8">
            <Breadcrumbs
              items={[
                { label: "All Courses", href: coursesHref },
                ...(course?.title
                  ? [
                      {
                        label: course.title,
                        href: course.slug ? courseHref(course.slug) : undefined,
                      },
                    ]
                  : []),
                ...(curriculum.currentModule?.title
                  ? [{ label: curriculum.currentModule.title }]
                  : []),
                { label: lesson.title ?? "Lesson" },
              ]}
            />

            <LessonViewTracker
              lessonSlug={slug}
              lessonLabel={curriculum.current?.label ?? null}
              courseSlug={course?.slug ?? null}
              startSeconds={startSeconds}
            />

            <LessonHeader
              label={curriculum.current?.label ?? null}
              title={lesson.title}
              summary={summary}
              durationSeconds={lesson.duration}
              level={course?.level ?? null}
              studentCount={lesson.studentCount}
              lessonSlug={slug}
            />

            <LessonVideo
              lessonTitle={lesson.title ?? "Lesson"}
              lessonSlug={slug}
              courseSlug={course?.slug ?? null}
              lessonLabel={curriculum.current?.label ?? null}
              video={parseVideoUrl(lesson.videoUrl)}
              posterUrl={
                lesson.thumbnail?.asset
                  ? urlFor(lesson.thumbnail).width(1280).height(720).fit("crop").url()
                  : null
              }
              posterAlt={lesson.thumbnail?.alt ?? lesson.title ?? ""}
              startSeconds={startSeconds}
              durationSeconds={lesson.duration}
            />

            <LessonTabs lessonSlug={slug}>
              <div className="flex flex-col gap-8">
                {body && (
                  <section aria-labelledby="lesson-overview">
                    <h2
                      id="lesson-overview"
                      className="font-display text-[20px] leading-7 font-bold text-neutral-900"
                    >
                      Overview
                    </h2>
                    <div className="mt-4">
                      <LessonNotes notes={body} />
                    </div>
                  </section>
                )}

                {keyPoints.length > 0 && (
                  <>
                    <hr className="border-canvas-line" />
                    <LessonKeyPoints points={keyPoints} />
                  </>
                )}

                {lesson.proTip && <LessonProTip tip={lesson.proTip} />}

                {resources.length > 0 && (
                  <>
                    <hr className="border-canvas-line" />
                    <LessonResources resources={resources} lessonSlug={slug} />
                  </>
                )}
              </div>
            </LessonTabs>
          </div>
        </main>
      </div>

      {/* Spans both columns, as in the reference. */}
      <LessonFooterNav
        previous={curriculum.previous}
        next={curriculum.next}
        currentLessonSlug={slug}
      />
    </PageFrame>
  );
}
