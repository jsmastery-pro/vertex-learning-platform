import Image from "next/image";
import { ChevronRight, CirclePlay, FileText, FolderClosed, Play } from "lucide-react";
import { ResultCard } from "@/components/search/result-card";
import { formatTimestamp } from "@/lib/format";
import type { SearchResultContext } from "@/lib/analytics/search-result-context";
import type { VideoSearchResult } from "@/lib/search/types";
import { urlFor } from "@/sanity/lib/image";

/**
 * A lesson's video matched at a specific moment (AGENTS.md §11). The action watches from that
 * second on the lesson page — the link already carries it, built server-side by `lessonHref`.
 */
export function VideoResultCard({
  result,
  context,
}: {
  result: VideoSearchResult;
  context: SearchResultContext;
}) {
  const startLabel = formatTimestamp(result.startSeconds);
  const duration = result.durationSeconds ? formatTimestamp(result.durationSeconds) : null;

  return (
    <ResultCard
      href={result.href}
      result={result}
      context={context}
      courseTitle={result.courseTitle}
      courseIconRef={result.courseIconRef}
      badge={{ variant: "video", label: "Video" }}
      title={result.lessonTitle}
      description={result.reason}
      media={
        <div className="relative aspect-video w-full overflow-hidden rounded-md bg-neutral-900">
          {result.thumbnailRef && (
            <Image
              src={urlFor(result.thumbnailRef).width(720).height(405).fit("crop").url()}
              alt=""
              fill
              sizes="(min-width: 640px) 276px, 100vw"
              className="object-cover"
            />
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-white/95 shadow-md">
              <Play className="size-5 translate-x-px fill-neutral-900 text-neutral-900" aria-hidden />
            </span>
          </span>
          {duration && (
            <span className="absolute right-2.5 bottom-2.5 rounded-xs bg-neutral-900/85 px-2 py-1 text-small font-medium text-white">
              {duration}
            </span>
          )}
        </div>
      }
      meta={
        <>
          <span className="inline-flex items-center gap-1.5">
            <FileText className="size-4 shrink-0 text-neutral-500" strokeWidth={2} aria-hidden />
            Lesson {result.label}
          </span>
          {result.moduleTitle && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <FolderClosed
                  className="size-4 shrink-0 text-neutral-500"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="truncate">{result.moduleTitle}</span>
              </span>
            </>
          )}
        </>
      }
      action={
        <>
          <CirclePlay className="size-4.5 shrink-0" strokeWidth={2} aria-hidden />
          Watch from {startLabel}
          <ChevronRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
        </>
      }
    />
  );
}
