/**
 * The event names PostHog receives, spelled once (AGENTS.md §7 — the engagement moments).
 *
 * Naming follows PostHog's convention and what the app already emits: lowercase `snake_case`,
 * `object_verb` in the past tense, snake_case properties, and seconds carried as `*_seconds`.
 *
 * This module is imported from both server and client code, so it must stay free of `posthog-js`.
 */

export const ANALYTICS_EVENTS = {
  // Browsing
  catalogViewed: "catalog_viewed",
  courseViewed: "course_viewed",
  courseResumed: "course_resumed",

  // Lesson
  lessonViewed: "lesson_viewed",
  lessonResumed: "lesson_resumed",
  lessonNavigated: "lesson_navigated",
  lessonCompleted: "lesson_completed",

  // Video
  videoPlayed: "video_played",
  videoProgress: "video_progress",

  // Search (server-side, from the route that does the work)
  searchPerformed: "search_performed",
  searchFailed: "search_failed",
  searchResultOpened: "search_result_opened",
} as const;

/**
 * Watch depth is measured from wall-clock time since play, not from the provider's player — the
 * embeds are plain iframes and emit nothing. Every depth-derived event carries this so the
 * imprecision is visible in PostHog rather than mistaken for player truth.
 */
export const WATCH_DEPTH_MEASUREMENT = "elapsed_time";

/** The milestones `video_progress` reports, in percent of the lesson's stored duration. */
export const WATCH_DEPTH_MILESTONES = [25, 50, 75, 95] as const;

/** Crossing this milestone is what stands in for completion until a progress record exists. */
export const COMPLETION_MILESTONE = 95;

/** How a video started playing. */
export type VideoPlaySource = "deep_link" | "poster_click";

/** Which "Continue Learning" affordance a learner used. */
export type ResumeLocation = "hero" | "progress_bar";
