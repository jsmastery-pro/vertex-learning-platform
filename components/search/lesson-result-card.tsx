import { CheckCircle2, ChevronRight, ExternalLink, FileText } from "lucide-react";
import { ResultCard } from "@/components/search/result-card";
import type { SearchResultContext } from "@/lib/analytics/search-result-context";
import type { LessonSearchResult } from "@/lib/search/types";

/** The label is positional ("5.1"), so the module number is its first segment. */
function moduleNumber(label: string) {
  return label.split(".")[0];
}

/**
 * A lesson matched on its own topic (AGENTS.md §11): key points on the left, the lesson page as the
 * action. No timestamp — nothing here is a moment.
 */
export function LessonResultCard({
  result,
  context,
}: {
  result: LessonSearchResult;
  context: SearchResultContext;
}) {
  const keyPoints = result.keyPoints.slice(0, 3);

  return (
    <ResultCard
      href={result.href}
      result={result}
      context={context}
      courseTitle={result.courseTitle}
      courseIconRef={result.courseIconRef}
      badge={{ variant: "lesson", label: "Lesson" }}
      title={result.lessonTitle}
      description={result.reason}
      media={
        // 16:9 of the 276px column is the floor, not the ceiling: the panel matches a video
        // thumbnail's height when the key points are short and grows rather than clipping them
        // when they are not.
        <div className="relative flex w-full flex-col gap-3 rounded-md border border-neutral-100 bg-neutral-50 p-4 sm:min-h-39">
          <FileText className="size-6 shrink-0 text-neutral-500" strokeWidth={1.75} aria-hidden />

          {keyPoints.length > 0 && (
            <ul className="flex min-w-0 flex-col gap-1.5 pr-10">
              {keyPoints.map((point) => (
                <li
                  key={point}
                  className="flex min-w-0 items-start gap-2 text-small leading-4.5 text-neutral-700"
                >
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-neutral-500" aria-hidden />
                  <span className="line-clamp-2">{point}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Presentational, like the lesson sidebar's completed state: progress is not tracked
              yet (AGENTS.md §7). It becomes real when the progress record lands. */}
          <CheckCircle2
            className="absolute right-3 bottom-3 size-7 fill-neutral-700 text-neutral-50"
            strokeWidth={2}
            aria-hidden
          />
        </div>
      }
      meta={<span>Module {moduleNumber(result.label)}</span>}
      action={
        <>
          View lesson
          <ExternalLink className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          <ChevronRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
        </>
      }
    />
  );
}
