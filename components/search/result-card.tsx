"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { CourseIcon } from "@/components/search/course-icon";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { SearchResultContext } from "@/lib/analytics/search-result-context";
import type { SearchResult } from "@/lib/search/types";

interface ResultCardProps {
  href: string;
  /** The grounded result this card renders, and the search it came from. */
  result: SearchResult;
  context: SearchResultContext;
  /** The left panel: a video thumbnail or a key-points summary. */
  media: ReactNode;
  courseTitle: string;
  courseIconRef: string | null;
  badge: { variant: BadgeVariant; label: string };
  title: string;
  description: string;
  /** The meta line under the description, e.g. "Lesson 5.1 · Data Fetching & Caching". */
  meta: ReactNode;
  /** The primary affordance, bottom right. Rendered inside the card link, so never an anchor. */
  action: ReactNode;
}

/**
 * The shared shape of a search result: media on the left, content on the right, one action.
 *
 * The whole card is the link — the "Watch from…" / "View lesson" affordances are spans inside it, so
 * there is exactly one tab stop per result and no nested anchors.
 */
export function ResultCard({
  href,
  result,
  context,
  media,
  courseTitle,
  courseIconRef,
  badge,
  title,
  description,
  meta,
  action,
}: ResultCardProps) {
  return (
    <Link
      href={href}
      onClick={() =>
        posthog.capture(ANALYTICS_EVENTS.searchResultOpened, {
          query: context.query,
          sort: context.sort,
          result_count: context.resultCount,
          result_kind: result.kind,
          rank: result.rank,
          position: context.position,
          course_slug: result.courseSlug,
          lesson_slug: result.lessonSlug,
          start_seconds: result.kind === "video" ? result.startSeconds : null,
        })
      }
      className="group flex flex-col gap-4 rounded-lg border border-neutral-200 bg-surface p-4 shadow-sm transition-colors hover:border-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:flex-row sm:gap-6"
    >
      <div className="w-full shrink-0 sm:w-69">{media}</div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:py-1">
        <div className="flex items-start justify-between gap-4">
          <span className="flex min-w-0 items-center gap-2">
            <CourseIcon iconRef={courseIconRef} courseTitle={courseTitle} />
            <span className="truncate text-body text-neutral-700">{courseTitle}</span>
          </span>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>

        <h2 className="text-[19px] leading-7 font-semibold text-neutral-900">{title}</h2>

        <p className="text-body leading-6 text-neutral-500">{description}</p>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-2">
          <span className="flex min-w-0 flex-wrap items-center gap-2 text-body text-neutral-500">
            {meta}
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 text-body font-medium text-primary-500 transition-colors group-hover:text-primary-600">
            {action}
          </span>
        </div>
      </div>
    </Link>
  );
}
