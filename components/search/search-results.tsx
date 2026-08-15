"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LessonCard } from "@/components/cards/lesson-card";
import { LessonVideoCard } from "@/components/cards/lesson-video-card";
import { Select } from "@/components/ui/select";
import { formatTimestamp, pluralize } from "@/lib/format";
import { coursesHref } from "@/lib/routes";
import type { SearchResponse, SearchSort } from "@/lib/search/types";

const SORT_OPTIONS: { value: SearchSort; label: string }[] = [
  { value: "relevance", label: "Most Relevant" },
  { value: "newest", label: "Most Recent" },
  { value: "duration", label: "Shortest First" },
];

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "success"; data: SearchResponse };

/**
 * Renders the search results page from the server route's response (AGENTS.md §5 — the browser holds
 * no token and only calls `/api/search`). Sorting re-runs the search: the route owns ordering, so the
 * client stays a thin renderer rather than a second source of truth.
 */
export function SearchResults({ query }: { query: string }) {
  // §11: the sort control defaults to most relevant.
  const [sort, setSort] = useState<SearchSort>("relevance");
  // The response is stamped with the query and sort it answers. While a newer query or sort is still
  // in flight, the stamp no longer matches and the view falls back to loading — so loading is derived
  // rather than set synchronously in the effect.
  const [answered, setAnswered] = useState<{ query: string; sort: SearchSort; state: State } | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, sort }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as SearchResponse;
      })
      .then((data) => setAnswered({ query, sort, state: { status: "success", data } }))
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("[search]", error);
        setAnswered({ query, sort, state: { status: "error" } });
      });

    return () => controller.abort();
  }, [query, sort]);

  const state: State =
    answered && answered.query === query && answered.sort === sort
      ? answered.state
      : { status: "loading" };

  if (state.status === "loading") {
    return <p className="mt-10 text-[15px] text-neutral-500">Searching…</p>;
  }

  if (state.status === "error") {
    return (
      <p className="mt-10 text-[15px] text-neutral-500">
        Search is unavailable right now. Please try again.
      </p>
    );
  }

  const { count, courseCount, reply, results } = state.data;

  if (results.length === 0) {
    return (
      <div className="mt-10">
        <p className="text-[17px] leading-7 text-neutral-900">
          No lessons match “{query}”.
        </p>
        <p className="mt-2 text-[15px] text-neutral-500">
          Try different words, or{" "}
          <Link
            href={coursesHref}
            className="rounded-xs text-primary-500 transition-colors hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            browse the full catalog
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[15px] text-neutral-500">
          Found {pluralize(count, "result")} across {pluralize(courseCount, "course")}
        </p>
        <Select
          id="search-sort"
          label="Sort results"
          value={sort}
          onChange={(event) => setSort(event.target.value as SearchSort)}
          options={SORT_OPTIONS}
          className="w-full sm:w-56"
        />
      </div>

      {reply && <p className="mt-6 max-w-[70ch] text-[15px] leading-7 text-neutral-500">{reply}</p>}

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {results.map((result) =>
          result.kind === "video" ? (
            <LessonVideoCard
              key={result.lessonId}
              title={result.lessonTitle}
              description={result.reason}
              lessonLabel={`Lesson ${result.label}`}
              timestamp={formatTimestamp(result.startSeconds)}
              href={result.href}
            />
          ) : (
            <LessonCard
              key={result.lessonId}
              title={result.lessonTitle}
              description={result.reason}
              moduleLabel={`Module ${result.label.split(".")[0]}`}
              href={result.href}
            />
          ),
        )}
      </div>
    </div>
  );
}
