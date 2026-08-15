"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";

import {
  ANALYTICS_EVENTS,
  COMPLETION_MILESTONE,
  WATCH_DEPTH_MEASUREMENT,
  WATCH_DEPTH_MILESTONES,
} from "@/lib/analytics/events";

/**
 * How far into the lesson a learner got, estimated from wall-clock time.
 *
 * Playback is a provider iframe (AGENTS.md §7 — no custom player), which emits nothing we can read.
 * So depth is time-since-play over the lesson's stored duration — elapsed playback only, so a deep
 * link never credits time nobody watched. That means a pause, a seek, or a speed change is
 * invisible to us, and a learner who
 * presses play and walks away still counts as watching. The one thing worth correcting for is
 * cheap — time spent on another tab does not count — and every event says
 * `measurement: "elapsed_time"` so the estimate is never mistaken for player truth.
 */

/** Depth is only ever checked on a tick, so this also bounds how late a milestone can be. */
const TICK_MS = 5_000;

interface WatchDepthOptions {
  /** Depth is only measured while this is true. */
  isPlaying: boolean;
  lessonSlug: string;
  courseSlug: string | null;
  lessonLabel: string | null;
  provider: string | null;
  /** The lesson's stored runtime. Depth is unmeasurable without it, so the hook stays idle. */
  durationSeconds: number | null;
  /** The second playback opened at, from `?t=`. */
  startSeconds: number;
}

export function useWatchDepth({
  isPlaying,
  lessonSlug,
  courseSlug,
  lessonLabel,
  provider,
  durationSeconds,
  startSeconds,
}: WatchDepthOptions) {
  // Milestones latch for the life of the mount. The lesson page remounts per lesson, so moving on
  // starts a fresh set.
  const reportedMilestones = useRef(new Set<number>());
  const completionReported = useRef(false);

  // Read inside the interval rather than listed as dependencies, so re-renders never restart the
  // timer and lose accumulated time. Synced in its own effect, declared first so the values have
  // landed before the timer below can read them.
  const context = useRef({ lessonSlug, courseSlug, lessonLabel, provider, startSeconds });

  useEffect(() => {
    context.current = { lessonSlug, courseSlug, lessonLabel, provider, startSeconds };
  });

  useEffect(() => {
    if (!isPlaying || !durationSeconds || durationSeconds <= 0) return;

    const totalSeconds = durationSeconds;
    let watchedMs = 0;
    // Null while the tab is hidden: nothing accrues until the learner comes back.
    let segmentStartedAt: number | null = document.visibilityState === "visible" ? Date.now() : null;

    function settleSegment() {
      if (segmentStartedAt === null) return;
      watchedMs += Date.now() - segmentStartedAt;
      segmentStartedAt = null;
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        segmentStartedAt ??= Date.now();
      } else {
        settleSegment();
      }
    }

    function tick() {
      const elapsedMs = watchedMs + (segmentStartedAt === null ? 0 : Date.now() - segmentStartedAt);
      const { lessonSlug, courseSlug, lessonLabel, provider, startSeconds } = context.current;

      const watchedSeconds = Math.round(elapsedMs / 1000);
      // Where playback is, for reporting: the deep-link offset counts here.
      const positionSeconds = Math.min(totalSeconds, startSeconds + watchedSeconds);
      // How much was actually watched: it does not. Opening at `?t=` half way through means the
      // learner has watched nothing yet, and crediting them 50% would fire milestones — and
      // `lesson_completed` — for a video nobody sat through.
      const percentWatched = Math.min(100, Math.round((watchedSeconds / totalSeconds) * 100));

      for (const milestone of WATCH_DEPTH_MILESTONES) {
        if (percentWatched < milestone || reportedMilestones.current.has(milestone)) continue;
        reportedMilestones.current.add(milestone);

        posthog.capture(ANALYTICS_EVENTS.videoProgress, {
          lesson_slug: lessonSlug,
          course_slug: courseSlug,
          provider,
          percent_watched: milestone,
          position_seconds: positionSeconds,
          duration_seconds: totalSeconds,
          measurement: WATCH_DEPTH_MEASUREMENT,
        });
      }

      // The stand-in for completion until a progress record exists (AGENTS.md §7): there is no
      // stored completion to report, so watching essentially all of it is what we have.
      if (percentWatched >= COMPLETION_MILESTONE && !completionReported.current) {
        completionReported.current = true;

        posthog.capture(ANALYTICS_EVENTS.lessonCompleted, {
          lesson_slug: lessonSlug,
          course_slug: courseSlug,
          lesson_label: lessonLabel,
          duration_seconds: totalSeconds,
          source: "video_watch_depth",
          measurement: WATCH_DEPTH_MEASUREMENT,
        });
      }
    }

    const interval = window.setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isPlaying, durationSeconds]);
}
