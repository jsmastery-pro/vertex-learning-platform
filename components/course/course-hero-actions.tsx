"use client";

import { Bookmark } from "lucide-react";
import posthog from "posthog-js";
import { CourseResumeLink } from "@/components/course/course-resume-link";
import { Button } from "@/components/ui/button";

interface CourseHeroActionsProps {
  /** Href for the first lesson; null when the curriculum is empty. */
  continueHref: string | null;
  /** Slug of the course, used as a property on captured events. */
  courseSlug: string;
}

/**
 * The "Continue Learning" and "Bookmark" action buttons on the course hero.
 * Extracted as a client component so PostHog captures can fire in the browser.
 */
export function CourseHeroActions({ continueHref, courseSlug }: CourseHeroActionsProps) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-4">
      {continueHref && (
        <CourseResumeLink
          href={continueHref}
          courseSlug={courseSlug}
          location="hero"
          percentComplete={0}
          className="h-14 px-6 text-[16px]"
        />
      )}
      <Button
        type="button"
        variant="tertiary"
        className="h-14 px-6 text-[16px]"
        onClick={() =>
          posthog.capture("course_bookmarked", {
            course_slug: courseSlug,
          })
        }
      >
        <Bookmark className="size-5" strokeWidth={2} aria-hidden />
        Bookmark
      </Button>
    </div>
  );
}
