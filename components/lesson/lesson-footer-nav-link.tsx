"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import posthog from "posthog-js";

import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

interface LessonFooterNavLinkProps {
  href: string;
  fromLessonSlug: string;
  toLessonSlug: string;
  direction: "next" | "previous";
  className?: string;
  children: ReactNode;
}

/**
 * The footer's Next / Previous link. It exists only so the move through the curriculum is captured —
 * the nav itself stays a server component.
 */
export function LessonFooterNavLink({
  href,
  fromLessonSlug,
  toLessonSlug,
  direction,
  className,
  children,
}: LessonFooterNavLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() =>
        posthog.capture(ANALYTICS_EVENTS.lessonNavigated, {
          from_lesson_slug: fromLessonSlug,
          to_lesson_slug: toLessonSlug,
          direction,
        })
      }
    >
      {children}
    </Link>
  );
}
