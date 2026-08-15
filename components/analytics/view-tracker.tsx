"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";

interface ViewTrackerProps {
  event: string;
  /**
   * What makes this view distinct — a course slug, say. Moving between two pages of the same dynamic
   * route can reuse the component instance, and without this the second view would go unreported.
   */
  viewKey?: string;
  properties?: Record<string, unknown>;
}

/**
 * Captures a named view event once per mount, so a server-rendered page can report the engagement
 * moments AGENTS.md §7 names without becoming a client component itself.
 *
 * A view is one of the few captures that genuinely belongs in an effect: there is no handler to hang
 * it on, and the mount *is* the event.
 */
export function ViewTracker({ event, viewKey, properties }: ViewTrackerProps) {
  // Properties are an inline object literal at every call site, so a new reference arrives on each
  // render. The ref keeps the latest values without re-firing the event. It is synced in its own
  // effect, declared first so it has landed before the capture below runs.
  const latestProperties = useRef(properties);

  useEffect(() => {
    latestProperties.current = properties;
  });

  useEffect(() => {
    posthog.capture(event, latestProperties.current);
  }, [event, viewKey]);

  return null;
}
