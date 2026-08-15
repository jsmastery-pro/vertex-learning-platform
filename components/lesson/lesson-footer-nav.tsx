import { ArrowLeft, ArrowRight } from "lucide-react";
import type { CurriculumLesson } from "@/components/lesson/lesson-curriculum";
import { LessonFooterNavLink } from "@/components/lesson/lesson-footer-nav-link";
import { buttonClasses } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { lessonHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

interface LessonFooterNavProps {
  previous: CurriculumLesson | null;
  next: CurriculumLesson | null;
  /** The lesson being navigated away from, so the move has a direction in analytics. */
  currentLessonSlug: string;
  className?: string;
}

/** Moves through the curriculum in order: the lesson before and after this one. */
export function LessonFooterNav({
  previous,
  next,
  currentLessonSlug,
  className,
}: LessonFooterNavProps) {
  if (!previous && !next) return null;

  return (
    <nav
      aria-label="Lesson navigation"
      className={cn(
        "flex flex-col gap-4 border-t border-canvas-line px-6 py-5 sm:flex-row sm:items-center sm:gap-6 sm:px-8",
        className,
      )}
    >
      {previous?.slug ? (
        <div className="flex items-center gap-5">
          <LessonFooterNavLink
            href={lessonHref(previous.slug)}
            fromLessonSlug={currentLessonSlug}
            toLessonSlug={previous.slug}
            direction="previous"
            className={buttonClasses({
              variant: "tertiary",
              className: "h-12 shrink-0 border-canvas-line bg-canvas px-5 text-[15px]",
            })}
          >
            <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
            Previous Lesson
          </LessonFooterNavLink>
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-[14px] leading-5 text-neutral-900">
              {previous.title}
            </span>
            <span className="block text-[13px] leading-5 text-neutral-500">
              {formatDuration(previous.duration)}
            </span>
          </span>
        </div>
      ) : (
        <span className="hidden sm:block" />
      )}

      {next?.slug && (
        <div className="flex items-center gap-5 sm:ml-auto">
          <span className="hidden min-w-0 text-right lg:block">
            <span className="block truncate text-[14px] leading-5 text-neutral-900">
              {next.title}
            </span>
            <span className="block text-[13px] leading-5 text-neutral-500">
              {formatDuration(next.duration)}
            </span>
          </span>
          <LessonFooterNavLink
            href={lessonHref(next.slug)}
            fromLessonSlug={currentLessonSlug}
            toLessonSlug={next.slug}
            direction="next"
            className={buttonClasses({ className: "h-12 shrink-0 px-5 text-[15px]" })}
          >
            Next Lesson
            <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
          </LessonFooterNavLink>
        </div>
      )}
    </nav>
  );
}
