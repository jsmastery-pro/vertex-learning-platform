import { openai } from "@ai-sdk/openai";
import type { MCPClient } from "@ai-sdk/mcp";
import { auth } from "@clerk/nextjs/server";
import { generateText, Output, stepCountIs } from "ai";
import type { NextRequest } from "next/server";

import { groundHits } from "@/lib/search/ground";
import { createSearchMcpClient, fetchInitialContext } from "@/lib/search/mcp";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/search/system-prompt";
import {
  ModelAnswerSchema,
  SearchRequestSchema,
  type SearchResponse,
  type SearchSort,
} from "@/lib/search/types";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { getPostHogClient } from "@/lib/posthog-server";

/**
 * The search API (AGENTS.md §5): connects to the Sanity Context MCP, injects the schema and the
 * system prompt, calls the LLM, then grounds whatever comes back against the dataset before it is
 * returned. Everything token-bearing stays here — the browser only ever sees the JSON below.
 *
 * The route is read-only: no write token, no mutation tool, and the Context document's filter scopes
 * what the model can even see.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The tool loop needs room to query, re-query on a miss, and answer — but no more. A learner is
 * waiting, and every extra step is another round trip.
 */
const MAX_STEPS = 6;

const DEFAULT_MODEL = "gpt-5";

function errorResponse(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "Expected a JSON body.");
  }

  const parsedRequest = SearchRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return errorResponse(400, "Expected { query: string, sort?: 'relevance' | 'newest' | 'duration' }.");
  }

  const { query, sort, distinctId, sessionId } = parsedRequest.data;
  const analytics = { distinctId, sessionId };
  const startedAt = Date.now();

  let mcpClient: MCPClient | null = null;

  try {
    const [client, initialContext] = await Promise.all([
      createSearchMcpClient(),
      fetchInitialContext(),
    ]);
    mcpClient = client;

    // `initial_context` is dropped: its payload is already in the system prompt, so keeping the tool
    // only invites a redundant round trip (§12 — never hand the model more context than it needs).
    const mcpTools = await mcpClient.tools();
    const tools = Object.fromEntries(
      Object.entries(mcpTools).filter(([name]) => name !== "initial_context"),
    );

    const { output } = await generateText({
      model: openai(process.env.OPENAI_SEARCH_MODEL || DEFAULT_MODEL),
      system: buildSystemPrompt(initialContext),
      prompt: buildUserPrompt(query),
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      output: Output.object({ schema: ModelAnswerSchema }),
      abortSignal: request.signal,
      // Search is latency-sensitive and the reasoning here is shallow: write one GROQ query, rank
      // what comes back. Heavy reasoning pushed a single search past a minute.
      providerOptions: { openai: { reasoningEffort: "low", textVerbosity: "low" } },
    });

    const results = await groundHits(output.hits, sort);

    const response: SearchResponse = {
      query,
      sort,
      count: results.length,
      courseCount: new Set(results.map((result) => result.courseSlug)).size,
      reply: output.reply,
      results,
    };

    try {
      await captureSearch(response, analytics, Date.now() - startedAt);
    } catch (error) {
      // Telemetry is never worth failing a search the learner already got results for.
      console.error("[api/search] failed to capture search_performed", error);
    }

    return Response.json(response);
  } catch (error) {
    // A learner who navigated away is not a failure. The abort is expected, so it is neither logged
    // as an error nor counted as an upstream outage in PostHog.
    if (request.signal.aborted) {
      return errorResponse(499, "Search was cancelled.");
    }

    // The message can carry the MCP URL or a provider payload, so it is logged, never returned.
    console.error("[api/search]", error);

    const message = error instanceof Error ? error.message : "";
    const unconfigured = message.startsWith("Missing environment variable");

    // Only the coarse reason reaches PostHog — the message itself is as unsafe to send as it is to
    // return.
    await captureSearchFailure(
      { query, sort },
      unconfigured ? "unconfigured" : "upstream",
      analytics,
      Date.now() - startedAt,
    );

    if (unconfigured) {
      return errorResponse(500, "Search is not configured.");
    }

    return errorResponse(502, "Search is unavailable right now. Please try again.");
  } finally {
    await mcpClient?.close();
  }
}

/** The browser's own PostHog ids, so a server event joins the session it came from. */
interface AnalyticsIdentity {
  distinctId?: string;
  sessionId?: string;
}

/**
 * Resolves who the event belongs to. A signed-in learner is always their Clerk user id — that is
 * what `PostHogUserIdentifier` calls `identify` with, so the server and browser agree on one person.
 * The client-supplied id is the signed-out fallback and is never trusted beyond attribution.
 */
async function resolveIdentity({ distinctId, sessionId }: AnalyticsIdentity) {
  const { userId } = await auth();

  return {
    distinctId: userId ?? distinctId ?? "anonymous",
    signedIn: Boolean(userId),
    // `$session_id` is what stitches this event into the learner's client session, which is what
    // makes "searched, then never opened a lesson" answerable.
    sessionProperties: sessionId ? { $session_id: sessionId } : {},
  };
}

/** "A search performed" is one of the engagement moments §7 asks for. */
async function captureSearch(
  response: SearchResponse,
  identity: AnalyticsIdentity,
  durationMs: number,
) {
  const posthog = getPostHogClient();
  if (!posthog) return;

  const { distinctId, signedIn, sessionProperties } = await resolveIdentity(identity);
  const videoResultCount = response.results.filter((result) => result.kind === "video").length;

  posthog.capture({
    distinctId,
    event: ANALYTICS_EVENTS.searchPerformed,
    properties: {
      ...sessionProperties,
      query: response.query,
      sort: response.sort,
      result_count: response.count,
      course_count: response.courseCount,
      video_result_count: videoResultCount,
      lesson_result_count: response.count - videoResultCount,
      zero_results: response.count === 0,
      duration_ms: durationMs,
      signed_in: signedIn,
    },
  });

  // A route handler is torn down per invocation, and `capture` only enqueues. Without this the send
  // never happens and the event is silently lost.
  await posthog.flush();
}

/** A search that never produced results is as much a signal as one that did. */
async function captureSearchFailure(
  { query, sort }: { query: string; sort: SearchSort },
  reason: "unconfigured" | "upstream",
  identity: AnalyticsIdentity,
  durationMs: number,
) {
  const posthog = getPostHogClient();
  if (!posthog) return;

  try {
    const { distinctId, signedIn, sessionProperties } = await resolveIdentity(identity);

    posthog.capture({
      distinctId,
      event: ANALYTICS_EVENTS.searchFailed,
      properties: {
        ...sessionProperties,
        query,
        sort,
        reason,
        duration_ms: durationMs,
        signed_in: signedIn,
      },
    });

    await posthog.flush();
  } catch (error) {
    // Already on the failure path — analytics must not replace the learner's error with its own.
    console.error("[api/search] failed to capture search_failed", error);
  }
}
