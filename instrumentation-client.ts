import posthog from "posthog-js";
import type { CaptureResult } from "posthog-js";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

// ClerkJS runs a periodic session `touch` heartbeat. When the request fails it
// rejects with "Failed to fetch", every frame inside clerk.browser.js, and
// ClerkJS retries on its own — so the rejection is noise, not a bug we can act
// on. The failing URL also holds the session id and the __clerk_db_jwt token,
// so each session sends a different message, which opens a new issue per session
// and writes a credential into the payload. Drop the heartbeat rejections, and
// strip the query string from any Clerk exception we keep so it carries no token.
interface ExceptionFrame {
  filename?: string;
}

interface ExceptionItem {
  value?: string;
  stacktrace?: { frames?: ExceptionFrame[] };
}

function isFailedFetchFromClerk(exception: ExceptionItem): boolean {
  const isFailedFetch =
    typeof exception.value === "string" &&
    exception.value.includes("Failed to fetch");
  const isFromClerk = (exception.stacktrace?.frames ?? []).some(
    (frame) =>
      typeof frame.filename === "string" &&
      frame.filename.includes("clerk.browser.js"),
  );
  return isFailedFetch && isFromClerk;
}

function scrubClerkExceptionNoise(
  result: CaptureResult | null,
): CaptureResult | null {
  if (!result || result.event !== "$exception") {
    return result;
  }

  const exceptions = result.properties.$exception_list as
    | ExceptionItem[]
    | undefined;
  if (!Array.isArray(exceptions)) {
    return result;
  }

  if (exceptions.some(isFailedFetchFromClerk)) {
    return null;
  }

  for (const exception of exceptions) {
    if (typeof exception.value === "string") {
      exception.value = exception.value.replace(
        /(https?:\/\/[^\s"']*?)\?[^\s"']*/g,
        "$1",
      );
    }
  }

  return result;
}

if (!token || !host) {
  if (process.env.NODE_ENV !== "production") {
    console.error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN or NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, " +
        "this causes events to be silently missed. This error stops appearing once both variables are configured.",
    );
  }
} else {
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: host,
    defaults: "2026-01-30",
    // Report exceptions from production builds only. Local dev sessions add no
    // signal — they just fill error tracking with noise from a dev session.
    capture_exceptions: process.env.NODE_ENV === "production",
    before_send: scrubClerkExceptionNoise,
    // Vertex uses PostHog for product analytics only. Surveys are out of scope,
    // and loading the extension only invites blockers to fail the request and
    // log "Could not load surveys script".
    disable_surveys: true,
    debug: process.env.NODE_ENV === "development",
  });
}
