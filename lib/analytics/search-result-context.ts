/**
 * What a result card needs in order to report a click as part of the search that produced it.
 *
 * The response knows the query, the sort, and how many results came back; the card knows which one
 * it is. Neither knows both, so the context is threaded down from `SearchResults`.
 */
export interface SearchResultContext {
  query: string;
  sort: string;
  resultCount: number;
  /** 1-based position in the rendered list, which is what the learner actually saw. */
  position: number;
}
