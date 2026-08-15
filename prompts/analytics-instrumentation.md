# Analytics instrumentation for search, video, and progress

## Goal

Extend PostHog coverage to the features shipped since the base setup: intelligent search, the search
results page, and the lesson page. Add the engagement moments AGENTS.md §7 names — catalog and lesson
views, a search performed, a video play and how far it is watched, and a lesson completed — plus the
result-open and resume events the request calls out. Capture server-side where the action is
server-side. No PII beyond the Clerk user id PostHog already holds.

This is an analytics-only change. It builds no product features, no progress backend, and changes no
visual design.

## Skills and docs read

- `AGENTS.md` §5 (server/client boundaries), §7 (the engagement moments PostHog must capture), §13 (checks).
- `.claude/skills/integration-nextjs-app-router/references/COMMANDMENTS.md` — the binding framework rules.
  The ones that shape this work:
  - Capture in event handlers, not in `useEffect` reacting to state. `useEffect` is only for
    synchronising with external systems.
  - Never send PII or user-generated content in `capture()` properties; PII belongs in `identify()`.
  - `posthog-js` is browser-only; the server uses `posthog-node`.
  - A missing PostHog config must never break the app, and must fail loudly in development only.
  - **Rule 34:** `capture()` enqueues synchronously; the HTTP send happens after. Next.js route handlers
    are torn down per invocation, so a shared/singleton client MUST `await posthog.flush()` before the
    handler returns or the event is silently dropped.
- `.claude/skills/integration-nextjs-app-router/references/identify-users.md` — identity handling.
- `posthog-self-driving-report.md` — two custom scouts are already armed against events this change
  emits: `signals-scout-course-funnel` reads `lesson_completed ÷ lesson_viewed`, and
  `signals-scout-search-quality` reads search zero-result and abandonment rates. The property design
  below is chosen so both scouts actually have data to read.

## Code inspected

| File | What it already does |
|---|---|
| `instrumentation-client.ts` | `posthog.init` with the `/ingest` reverse proxy, `capture_exceptions`, autocapture on. Unchanged by this work. |
| `lib/posthog-server.ts` | Lazy `posthog-node` singleton, `flushAt: 1`, `flushInterval: 0`. Returns `null` when unconfigured. |
| `components/posthog/posthog-user-identifier.tsx` | Identifies on the Clerk user id, resets on the logout transition. Confirms the server must use the Clerk user id as `distinctId` to match. |
| `app/api/search/route.ts` | Captures `search_performed` server-side. **Never flushes** — see rule 34. |
| `components/lesson/lesson-video.tsx` | Captures `video_played`; owns the play state. No depth tracking. |
| `components/lesson/lesson-view-tracker.tsx` | Captures `lesson_viewed` on mount. |
| `components/search/search-results.tsx` | Owns the fetch and the response; the only place that knows the query, sort, and result set together. |
| `components/search/result-card.tsx` | The shared card. The whole card is one `<Link>` — the click hook belongs here, once. |
| `components/course/course-hero-actions.tsx` | Client. Captures `course_started` on "Continue Learning" and `course_bookmarked`. |
| `components/course/course-progress-bar.tsx` | Server component. Its "Continue Learning" link captures nothing. |
| `components/lesson/lesson-footer-nav.tsx` | Server component. Next/Previous capture nothing. |
| `app/courses/page.tsx`, `app/courses/[slug]/page.tsx` | Server components. No named view events. |
| `lib/video.ts` | Parses provider + id, builds the embed URL. No player API is wired. |

## Decisions and assumptions

Three were put to the user and answered:

1. **Watch depth is measured by an elapsed-time heuristic** (user's choice over provider SDKs and raw
   postMessage). No third-party player script is loaded and no dependency is added. Depth is derived
   from wall-clock time since play, offset by the deep-link start second, against the lesson's stored
   duration.
   - **Accepted inaccuracy, stated plainly:** the iframe emits nothing, so a pause, a seek, or a speed
     change is invisible. A learner who presses play and walks away will be counted as having watched.
   - Two cheap mitigations are in scope because they cost nothing: accumulate time only while
     `document.visibilityState === "visible"`, and stamp every depth event with
     `measurement: "elapsed_time"` so the imprecision is legible in PostHog rather than implied to be
     player-truth.
   - Ceiling: depth never exceeds 100, and no milestone fires more than once per mount.
2. **`lesson_completed` is derived from watch depth ≥ 95%.** There is no progress record and no server
   write route, so there is no stored completion to report. This is the analytics proxy the
   `signals-scout-course-funnel` scout already expects. It inherits the heuristic's inaccuracy — noted
   in the report, not hidden.
3. **The raw search query is captured** on `search_performed` and `search_result_opened`. It is
   learner-typed free text, which the PostHog commandments would normally keep out of properties; the
   user confirmed it, and `signals-scout-search-quality` cannot find zero-result queries without it.
   Nothing else user-authored is captured anywhere.

Further decisions taken without asking, because they follow from the code:

4. **`course_started` is renamed to `course_resumed`.** Both "Continue Learning" affordances (course
   hero, sticky progress bar) are the same action with the same label, and "resume used" is what the
   request asks to measure. One event name, with `location: "hero" | "progress_bar"` telling them
   apart. Splitting one button's action across two event names would make the funnel unreadable.
5. **The browser sends its PostHog distinct id and session id to `/api/search`.** Without them, every
   signed-out search lands on the literal `distinctId: "anonymous"`, collapsing all anonymous learners
   into one person and leaving the server event unjoined to the client session. The
   `signals-scout-search-quality` abandonment metric ("a search with results and no subsequent lesson
   view *in the same session*") is unmeasurable without `$session_id`. Both are validated by Zod, both
   are optional, and the Clerk user id still wins as `distinctId` whenever the learner is signed in —
   a client-supplied id is never trusted over server-known identity.
6. **Naming follows the existing convention and PostHog's guidance:** lowercase `snake_case`,
   `object_verb` in the past tense (`lesson_viewed`, `video_played`), snake_case properties, seconds as
   `*_seconds`. New events match what is already there rather than introducing a second style.

## Event catalogue

Existing events kept as-is: `module_expanded`, `module_collapsed`, `lesson_clicked`,
`course_content_show_all_toggled`, `course_bookmarked`, `lesson_bookmarked`, `lesson_tab_changed`,
`lesson_resource_clicked`.

### New — client

| Event | Fires on | Properties |
|---|---|---|
| `catalog_viewed` | `/courses` mount | `course_count` |
| `course_viewed` | `/courses/[slug]` mount | `course_slug`, `module_count`, `lesson_count`, `level` |
| `search_result_opened` | Click on any search result card | `query`, `sort`, `result_kind` (`video`\|`lesson`), `rank`, `position`, `result_count`, `course_slug`, `lesson_slug`, `start_seconds` (video only, else `null`) |
| `video_progress` | Crossing 25 / 50 / 75 / 95% of the lesson duration | `lesson_slug`, `course_slug`, `provider`, `percent_watched`, `position_seconds`, `duration_seconds`, `measurement: "elapsed_time"` |
| `lesson_completed` | Crossing 95%, once per mount | `lesson_slug`, `course_slug`, `lesson_label`, `duration_seconds`, `source: "video_watch_depth"`, `measurement: "elapsed_time"` |
| `lesson_resumed` | Lesson page opens with `?t=` > 0 | `lesson_slug`, `course_slug`, `start_seconds`, `source: "deep_link"` |
| `lesson_navigated` | Footer Next / Previous | `from_lesson_slug`, `to_lesson_slug`, `direction` (`next`\|`previous`) |

### Changed — client

| Event | Change |
|---|---|
| `video_played` | Gains `course_slug`, `provider`, `duration_seconds`, and `source` (`deep_link` \| `poster_click`). The existing `autostarted` boolean is dropped — `source` says the same thing and reads better in a breakdown. |
| `course_resumed` | Renamed from `course_started`. Gains `location` (`hero` \| `progress_bar`) and `percent_complete`. |

### New / changed — server (`posthog-node`)

| Event | Change |
|---|---|
| `search_performed` | Gains `lesson_result_count`, `zero_results`, `duration_ms`, `signed_in`. Uses the client's distinct id / session id when signed out. |
| `search_failed` | New. Captured on the route's error path with `query`, `sort`, `reason` (`unconfigured` \| `upstream`), `duration_ms`. The raw error message is still only logged, never sent — it can carry the MCP URL or a provider payload. |

Both server captures are followed by `await posthog.flush()` (rule 34).

## Files to touch

**Web — new**

- `lib/analytics/events.ts` — the event-name constants and shared property types, so a name is spelled
  once. Server-safe (no `posthog-js` import).
- `components/analytics/view-tracker.tsx` — one small `"use client"` component that captures a named
  view event with given properties on mount. Replaces writing a bespoke tracker per page.
- `components/lesson/use-watch-depth.ts` — the elapsed-time depth hook (visibility-aware, milestone
  latching).
- `components/lesson/lesson-footer-nav-link.tsx` — client wrapper so the footer nav can capture.
- `components/course/course-progress-bar-actions.tsx` — client "Continue Learning" for the sticky bar.

**Web — changed**

- `app/api/search/route.ts` — enrich `search_performed`, add `search_failed`, add the awaited flush,
  accept and use the client distinct/session id.
- `lib/search/types.ts` — `SearchRequestSchema` gains optional, bounded `distinctId` / `sessionId`.
- `components/search/search-results.tsx` — send the ids; pass query/sort/count/position down to cards.
- `components/search/result-card.tsx` — the one click handler (becomes `"use client"`).
- `components/search/video-result-card.tsx`, `components/search/lesson-result-card.tsx` — thread the
  analytics context through.
- `components/lesson/lesson-video.tsx` — enrich `video_played`, drive the depth hook.
- `components/lesson/lesson-view-tracker.tsx` — add `lesson_resumed`.
- `components/lesson/lesson-footer-nav.tsx` — use the client link.
- `components/course/course-hero-actions.tsx` — `course_started` → `course_resumed`.
- `components/course/course-progress-bar.tsx` — use the client action.
- `app/courses/page.tsx`, `app/courses/[slug]/page.tsx` — mount the view tracker.
- `app/lessons/[slug]/page.tsx` — pass `durationSeconds`, `courseSlug`, `provider`, and the lesson
  label to the video and view tracker.

## Requirements

1. Every capture sits in an event handler, except the three that are genuinely mount-scoped views
   (`catalog_viewed`, `course_viewed`, `lesson_viewed`/`lesson_resumed`) and the depth timer, which is
   a browser-API subscription — both are the sanctioned `useEffect` uses.
2. No new dependency, no third-party script, no change to `instrumentation-client.ts`.
3. Client components stay client; server pages stay server. No `posthog-js` import reaches a server
   component, and no token or server module reaches the browser.
4. Depth milestones latch: each of 25/50/75/95 fires at most once per mount, and `lesson_completed`
   at most once per mount. Remounting on a new lesson resets them (the slug is the key).
5. The depth timer clears on unmount and does not run when the lesson has no duration or no video.
6. Nothing beyond the Clerk user id identifies a person. No email, no name, no notes text, no lesson
   body content in any `capture()` property. The search query is the single, user-confirmed exception.
7. Missing PostHog config still cannot break a page or the search route.

## Security considerations

- The client-supplied `distinctId` / `sessionId` are spoofable by design. They are only used for
  attribution, never for authorisation, and are always overridden by the Clerk user id when the
  request is authenticated. Both are length-bounded and type-checked by Zod so they cannot be used to
  smuggle a payload into the analytics pipeline.
- `search_failed` sends a coarse `reason`, never the caught error message — that message can carry the
  MCP endpoint or a provider response, and the route already takes care never to return it.
- No write token, no read token, and no server module is introduced into any client component.
- The search query is already accepted and length-capped at `MAX_QUERY_LENGTH` before it reaches
  PostHog.

## Acceptance criteria

- Searching captures one `search_performed` server-side with the query, counts, `zero_results`, and
  `duration_ms`, and the event actually arrives (it is flushed before the handler returns).
- A failing search captures `search_failed` with a coarse reason and no provider detail.
- Clicking a result captures `search_result_opened` carrying `result_kind`, `rank`, and the query.
- Opening a lesson captures `lesson_viewed`; opening it with `?t=` also captures `lesson_resumed`.
- Pressing play captures `video_played` with `source: "poster_click"`; a deep link captures it with
  `source: "deep_link"`.
- Watching captures `video_progress` at 25/50/75/95 exactly once each, and `lesson_completed` once.
- `/courses` captures `catalog_viewed`; a course page captures `course_viewed`.
- Both "Continue Learning" buttons capture `course_resumed` with distinct `location` values.
- Footer Next/Previous capture `lesson_navigated`.
- With `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` unset, every page and the search route still work.

## Checks to run

From the web workspace: `npm run typecheck`, `npm run lint`, and `npm run build` (server route and
config-adjacent modules change). Then `npm run dev` for the manual pass below.

## Manual test steps

1. `npm run dev`, open the browser console — `debug: true` in development makes every capture print.
2. Visit `/courses` → console shows `catalog_viewed` with a `course_count`.
3. Open a course → `course_viewed`. Click "Continue Learning" in the hero → `course_resumed` with
   `location: "hero"`. Go back, scroll to the sticky bar, click its "Continue Learning" →
   `course_resumed` with `location: "progress_bar"`.
4. On a lesson, confirm `lesson_viewed`. Press play → `video_played` with `source: "poster_click"`.
5. Leave it playing past a quarter of the lesson duration → `video_progress` with
   `percent_watched: 25`. Switch to another browser tab for a while and come back — the next milestone
   must not have jumped forward by the time spent away.
6. Reach 95% → a final `video_progress` and one `lesson_completed`. Reload and confirm they fire again
   from a clean mount, and only once each.
7. Click Next Lesson in the footer → `lesson_navigated` with `direction: "next"`.
8. Search from the header. In the PostHog activity view (server events do not print to the browser
   console), confirm one `search_performed` with the query, `result_count`, `course_count`,
   `zero_results`, and `duration_ms`, attributed to your Clerk user when signed in.
9. Click a video result → `search_result_opened` with `result_kind: "video"`, a `rank`, and a
   `start_seconds`; the lesson opens deep-linked and also captures `lesson_resumed` plus `video_played`
   with `source: "deep_link"`.
10. Click a lesson result → `search_result_opened` with `result_kind: "lesson"` and
    `start_seconds: null`.
11. Search for nonsense ("qwertyuiop asdfgh") → `search_performed` with `zero_results: true`.
12. Temporarily unset `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, restart, and confirm the catalog, a lesson,
    and a search all still work, with the loud development-only console error and no captures.
