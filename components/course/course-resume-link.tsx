"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";

import { buttonClasses } from "@/components/ui/button";
import { ANALYTICS_EVENTS, type ResumeLocation } from "@/lib/analytics/events";

interface CourseResumeLinkProps {
  href: string;
  courseSlug: string;
  /** Which of the two identical "Continue Learning" affordances this is. */
  location: ResumeLocation;
  /** 0–100. Zero everywhere until a progress record exists (AGENTS.md §7). */
  percentComplete: number;
  className?: string;
}

/**
 * "Continue Learning" — the resume affordance, in both the places the design puts it. One event
 * name for one action, with `location` telling the two apart, so the resume rate stays readable.
 */
export function CourseResumeLink({
  href,
  courseSlug,
  location,
  percentComplete,
  className,
}: CourseResumeLinkProps) {
  return (
    <Link
      href={href}
      className={buttonClasses({ className })}
      onClick={() =>
        posthog.capture(ANALYTICS_EVENTS.courseResumed, {
          course_slug: courseSlug,
          location,
          percent_complete: percentComplete,
        })
      }
    >
      Continue Learning
      <ArrowRight className="size-5" strokeWidth={2} aria-hidden />
    </Link>
  );
}
