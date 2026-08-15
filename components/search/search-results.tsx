"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { LessonResultCard } from "@/components/search/lesson-result-card";
import { SearchEmptyState } from "@/components/search/search-empty-state";
import { VideoResultCard } from "@/components/search/video-result-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { pluralize } from "@/lib/format";
import { searchHref } from "@/lib/routes";
import type { SearchResponse, SearchSort } from "@/lib/search/types";
import { SORTS } from "@/lib/search/types";

/**
 * The browser's PostHog ids, or nothing at all. An unconfigured PostHog must never be the reason a
 * search fails (the framework rules are explicit about that), so this can only ever return less.
 */
function analyticsIdentity() {
  try {
    return {
      distinctId: posthog.get_distinct_id() || undefined,
      sessionId: posthog.get_session_id() || undefined,
    };
  } catch {
    return {};
  }
}

/** §11's sort control. `relevance` is the model's own ranking and stays the default. */
const SORT_OPTIONS: { value: SearchSort; label: string }[] = [
  { value: "relevance", label: "Most Relevant" },
  { value: "newest", label: "Newest" },
  { value: "duration", label: "Shortest First" },
];

interface SearchResultsProps {
  query: string;
  sort: SearchSort;
  /**
   * The search field, rendered between the count line and the toolbar. It lives here rather than in
   * the page because the design puts the count line above it, and the count is only known once the
   * response lands.
   */
  searchField: ReactNode;
}

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; response: SearchResponse };

/**
 * The results half of the page. The browser only ever talks to `/api/search` — the MCP, the model,
 * and every token stay on the server (AGENTS.md §5), and every value rendered here comes from the
 * grounded response, never from anything computed locally.
 */
export function SearchResults({ query, sort, searchField }: SearchResultsProps) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  // Bumping this re-runs the effect, which is what Retry needs.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // A second search must not be overtaken by the first one finishing late.
    const controller = new AbortController();

    async function run() {
      try {
        const response = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // `search_performed` is captured server-side, where the search actually happens. These ids
          // are what let that event belong to this learner and this session rather than to a shared
          // "anonymous" — the route still prefers the Clerk user id whenever there is one.
          body: JSON.stringify({ query, sort, ...analyticsIdentity() }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`Search failed with ${response.status}`);

        setState({ status: "ready", response: (await response.json()) as SearchResponse });
      } catch (error) {
        if (controller.signal.aborted) return;
        // The route's message can carry provider detail, so it is never shown; this is the generic
        // fallback the learner sees.
        console.error("[search]", error);
        setState({ status: "error" });
      }
    }

    run();
    return () => controller.abort();
  }, [query, sort, attempt]);

  const onSortChange = useCallback(
    (value: string) => {
      const next = SORTS.find((option) => option === value) ?? "relevance";
      router.replace(searchHref(query, next), { scroll: false });
    },
    [query, router],
  );

  if (state.status === "error") {
    return (
      <>
        <p className="mt-4 text-center text-body-lg text-neutral-500">
          Search is unavailable right now. Please try again.
        </p>
        {searchField}
        <div className="mt-10 flex justify-center">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((value) => value + 1);
            }}
          >
            Retry
          </Button>
        </div>
      </>
    );
  }

  if (state.status === "loading") {
    return (
      <>
        <p className="mt-4 text-center text-body-lg text-neutral-500">Searching&hellip;</p>
        {searchField}
        <div className="mt-10 flex flex-col gap-4" aria-busy>
          {[0, 1, 2].map((index) => (
            <ResultSkeleton key={index} />
          ))}
        </div>
      </>
    );
  }

  const { response } = state;

  return (
    <>
      <p className="mt-4 text-center text-body-lg text-neutral-500">
        Found {pluralize(response.count, "result")} across{" "}
        {pluralize(response.courseCount, "course")}
      </p>

      {searchField}

      <div className="mt-9 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[15px] leading-6 font-medium text-neutral-900">
          {pluralize(response.count, "result")}
        </p>
        <Select
          id="search-sort"
          label="Sort results"
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
          options={SORT_OPTIONS}
          className="w-full sm:w-41"
        />
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {response.results.map((result, index) => {
          // The position the learner saw, which is not the model's rank once a sort is applied.
          const context = {
            query: response.query,
            sort: response.sort,
            resultCount: response.count,
            position: index + 1,
          };

          return result.kind === "video" ? (
            <VideoResultCard key={result.lessonId} result={result} context={context} />
          ) : (
            <LessonResultCard key={result.lessonId} result={result} context={context} />
          );
        })}

        <SearchEmptyState />
      </div>
    </>
  );
}

/** Matches the card silhouette so the list does not jump when results arrive. */
function ResultSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4 rounded-lg border border-neutral-200 bg-surface p-4 shadow-sm sm:flex-row sm:gap-6">
      <div className="aspect-video w-full shrink-0 rounded-md bg-neutral-100 sm:w-69" />
      <div className="flex flex-1 flex-col gap-3 py-1">
        <div className="h-5 w-40 rounded-xs bg-neutral-100" />
        <div className="h-6 w-3/5 rounded-xs bg-neutral-100" />
        <div className="h-4 w-full rounded-xs bg-neutral-100" />
        <div className="mt-auto h-4 w-2/5 rounded-xs bg-neutral-100" />
      </div>
    </div>
  );
}
