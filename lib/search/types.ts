import { z } from "zod";

/**
 * The search contract, in three layers.
 *
 * 1. `SearchRequestSchema` — what the browser may send.
 * 2. `ModelHitSchema` — the only thing the LLM is allowed to author. It names a lesson and says why
 *    it matched; it never authors a title, a label, a duration, or a count.
 * 3. `SearchResultSchema` — the grounded card the route returns, built server-side from a real
 *    Sanity read of the lesson the model named (AGENTS.md §7: never invent a course, lesson, price,
 *    duration, or timestamp).
 */

export const SORTS = ["relevance", "newest", "duration"] as const;
export type SearchSort = (typeof SORTS)[number];

/** Long queries are a cost and prompt-injection surface, not a feature. */
export const MAX_QUERY_LENGTH = 200;

/** Bounds the grounding query. The model is told not to truncate; this is a defensive ceiling. */
export const MAX_RESULTS = 100;

/**
 * PostHog ids are opaque strings (a UUID, or whatever `identify` was called with). This is a
 * defensive ceiling on a spoofable, purely-attributional field, not a format check.
 */
const MAX_ANALYTICS_ID_LENGTH = 200;

export const SearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(MAX_QUERY_LENGTH),
  sort: z.enum(SORTS).default("relevance"),
  /**
   * The browser's own PostHog distinct id and session id. Search runs on the server, so without
   * these every signed-out search would land on one shared "anonymous" person, and the server event
   * could never be joined to the client session it came from.
   *
   * Both are attribution only. They are never trusted for authorisation, and the Clerk user id
   * always wins as the distinct id when the request is authenticated.
   */
  distinctId: z.string().trim().min(1).max(MAX_ANALYTICS_ID_LENGTH).optional(),
  sessionId: z.string().trim().min(1).max(MAX_ANALYTICS_ID_LENGTH).optional(),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

/**
 * A `video` hit is a lesson's video matched at a specific moment; a `lesson` hit is a lesson matched
 * on its own topic (§11). Both resolve to the same lesson document.
 */
export const RESULT_KINDS = ["video", "lesson"] as const;
export type SearchResultKind = (typeof RESULT_KINDS)[number];

/**
 * The model-facing schema is deliberately plain: OpenAI's structured outputs require every property
 * to be required, and reject range and length keywords. Optionality is expressed as `null`, and the
 * real bounds are enforced downstream — the grounding pass verifies each id against the dataset and
 * drops anything that does not resolve, which is a stronger check than a `min()` ever was.
 */
export const ModelHitSchema = z.object({
  /** A real `_id` the model saw in a tool result. Verified against Sanity before it ships. */
  lessonId: z.string(),
  kind: z.enum(RESULT_KINDS),
  /** One sentence, grounded in what actually matched. */
  reason: z.string(),
  /** 1 = best. Ties are broken by the order the model returned them in. */
  rank: z.number().int(),
  /** Only ever set from a real chapter `startSeconds` or transcript chunk. Null on lesson hits. */
  startSeconds: z.number().int().nullable(),
  /** The chapter label the moment came from, when the match was a chapter rather than a chunk. */
  momentLabel: z.string().nullable(),
});

export type ModelHit = z.infer<typeof ModelHitSchema>;

export const ModelAnswerSchema = z.object({
  /** One or two sentences of markdown. Rendered with react-markdown when the UI lands. */
  reply: z.string(),
  hits: z.array(ModelHitSchema),
});

export type ModelAnswer = z.infer<typeof ModelAnswerSchema>;

const SearchResultBaseSchema = z.object({
  kind: z.enum(RESULT_KINDS),
  lessonId: z.string(),
  lessonSlug: z.string(),
  lessonTitle: z.string(),
  /** The derived "5.1" label — positional, never stored (AGENTS.md §8). */
  label: z.string(),
  moduleTitle: z.string().nullable(),
  courseTitle: z.string(),
  courseSlug: z.string(),
  /** Sanity image asset ref for the course cover, used as the small course tile on a card. */
  courseIconRef: z.string().nullable(),
  /** Lesson runtime in seconds. */
  durationSeconds: z.number().nullable(),
  freePreview: z.boolean(),
  keyPoints: z.array(z.string()),
  /** Sanity image asset ref for the lesson thumbnail; the UI resolves it with `urlForImage`. */
  thumbnailRef: z.string().nullable(),
  /** The model's one-line explanation of why this matched. */
  reason: z.string(),
  /** Where the lesson page opens, including the start second on a video hit. */
  href: z.string(),
  rank: z.number().int(),
});

export const VideoSearchResultSchema = SearchResultBaseSchema.extend({
  kind: z.literal("video"),
  startSeconds: z.number().int().min(0),
  /** The chapter label the moment came from, when there was one. */
  momentLabel: z.string().nullable(),
});

export const LessonSearchResultSchema = SearchResultBaseSchema.extend({
  kind: z.literal("lesson"),
});

export const SearchResultSchema = z.discriminatedUnion("kind", [
  VideoSearchResultSchema,
  LessonSearchResultSchema,
]);

export type SearchResult = z.infer<typeof SearchResultSchema>;
export type VideoSearchResult = z.infer<typeof VideoSearchResultSchema>;
export type LessonSearchResult = z.infer<typeof LessonSearchResultSchema>;

export const SearchResponseSchema = z.object({
  query: z.string(),
  sort: z.enum(SORTS),
  /** Always equal to `results.length` — the count the results page shows (§11). */
  count: z.number().int().min(0),
  /** How many distinct courses the results span, for the "across 8 courses" line. */
  courseCount: z.number().int().min(0),
  reply: z.string(),
  results: z.array(SearchResultSchema),
});

export type SearchResponse = z.infer<typeof SearchResponseSchema>;
