/** The site's URL shapes, in one place so links stay consistent as routes land. */

export const coursesHref = "/courses";

export function courseHref(slug: string) {
  return `/courses/${slug}`;
}

/**
 * A lesson resolves by its own slug — `LESSON_BY_SLUG_QUERY` derives the parent course with a
 * reverse reference, so the URL does not carry the course.
 *
 * `startSeconds` is the moment a search result matched: the lesson page hands it to the video
 * provider's own start parameter so playback opens at that second (AGENTS.md §7).
 */
export function lessonHref(slug: string, startSeconds?: number | null) {
  if (!startSeconds || startSeconds <= 0) return `/lessons/${slug}`;
  return `/lessons/${slug}?t=${Math.floor(startSeconds)}`;
}

/** The query parameter carrying the start second on a lesson URL. */
export const START_SECONDS_PARAM = "t";

/** The search page's query parameters. The URL is the single source of truth for a search. */
export const SEARCH_QUERY_PARAM = "q";
export const SEARCH_SORT_PARAM = "sort";

/**
 * `/search?q=data+fetching`. The sort is omitted when it is the default, so a plain search from the
 * header produces the shortest shareable URL.
 */
export function searchHref(query: string, sort?: string | null) {
  const params = new URLSearchParams({ [SEARCH_QUERY_PARAM]: query });
  if (sort && sort !== "relevance") params.set(SEARCH_SORT_PARAM, sort);
  return `/search?${params.toString()}`;
}
