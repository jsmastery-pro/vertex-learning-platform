import { CourseResumeLink } from "@/components/course/course-resume-link";
import { cn } from "@/lib/utils";

interface CourseProgressBarProps {
  /** 0–100. Presentational for now: learner progress is not tracked yet (AGENTS.md §7). */
  percentComplete: number;
  /** Where "Continue Learning" goes — the resume position once progress exists. */
  continueHref: string | null;
  /** Carried onto the resume event. */
  courseSlug: string;
  className?: string;
}

/**
 * The bar pinned to the bottom of the course page. It takes its numbers as props so wiring it to
 * real progress later is a data change, not a markup change.
 */
export function CourseProgressBar({
  percentComplete,
  continueHref,
  courseSlug,
  className,
}: CourseProgressBarProps) {
  const value = Math.min(100, Math.max(0, Math.round(percentComplete)));

  return (
    <div
      className={cn(
        "sticky bottom-5 z-10 flex flex-col gap-5 rounded-lg border border-canvas-line bg-canvas p-5 shadow-lg sm:flex-row sm:items-center sm:gap-8 sm:px-6",
        className,
      )}
    >
      <div className="shrink-0">
        <p className="text-[13px] leading-5 text-neutral-500">Your Progress</p>
        <p className="mt-1 text-[15px] leading-6 text-neutral-500">
          <span className="font-semibold text-neutral-900">{value}%</span>{" "}
          {value === 0 ? "— not started" : "complete"}
        </p>
      </div>

      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Course progress"
        className="h-2 w-full max-w-80 overflow-hidden rounded-full bg-neutral-200 sm:mr-auto"
      >
        <div className="h-full rounded-full bg-primary-500" style={{ width: `${value}%` }} />
      </div>

      {continueHref && (
        <CourseResumeLink
          href={continueHref}
          courseSlug={courseSlug}
          location="progress_bar"
          percentComplete={value}
          className="h-14 shrink-0 px-6 text-[16px]"
        />
      )}
    </div>
  );
}
