"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

interface LessonViewTrackerProps {
  lessonSlug: string;
  lessonLabel: string | null;
  courseSlug: string | null;
  /** From `?t=`. Anything above zero means the learner arrived mid-lesson. */
  startSeconds: number;
}

/** Captures the lesson view once per mount (AGENTS.md §7 engagement events). */
export function LessonViewTracker({
  lessonSlug,
  lessonLabel,
  courseSlug,
  startSeconds,
}: LessonViewTrackerProps) {
  useEffect(() => {
    posthog.capture(ANALYTICS_EVENTS.lessonViewed, {
      lesson_slug: lessonSlug,
      lesson_label: lessonLabel,
      course_slug: courseSlug,
    });

    // Opening at a second rather than at the start is a resume, whether it came from a search result
    // or a shared link. It is a separate event from the view so the view count stays a view count.
    if (startSeconds > 0) {
      posthog.capture(ANALYTICS_EVENTS.lessonResumed, {
        lesson_slug: lessonSlug,
        course_slug: courseSlug,
        start_seconds: startSeconds,
        source: "deep_link",
      });
    }
  }, [lessonSlug, lessonLabel, courseSlug, startSeconds]);

  return null;
}
