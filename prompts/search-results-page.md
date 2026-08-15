# Implementation prompt: Wire the hero search to a results page

## Goal

Make the home hero search box work. Today the box in `components/home/hero.tsx` is a plain input
with no form, no submit handler, and nowhere to go — and there is no `/search` route. The search
backend at `app/api/search/route.ts` and `lib/search/*` is complete but unreachable from the UI, so
the platform's headline feature ("Search your learning in plain English") is a dead text field.

This task connects the two ends the earlier work left apart (see `prompts/intelligent-search.md`,
which deferred the results page): turn the hero input into a real form that navigates to a new
`/search` page, and build that page to call the existing search API and render the ranked video and
lesson cards with a result count and a sort control.

Scope is the UI wiring only. No backend change: the API contract, the grounding, and the sort logic
stay exactly as they are.

## Not in scope: the PostHog localhost guard

The report pairs this with a fix for `instrumentation-client.ts`, which captures every local dev
exception into the shared project. Draft PR #6 ("Filter ClerkJS network-noise exceptions before
PostHog capture") already changes that same file to
`capture_exceptions: process.env.NODE_ENV === "production"`, which is exactly the development-host
guard the report asks for. Duplicating it here would conflict with #6, so this PR leaves
`instrumentation-client.ts` untouched and lets #6 land the guard.

## Skills and docs read

- `AGENTS.md` — §3 (reproduce the design; there is no results-page reference, so stay on-brand and
  responsive), §5 (pages are read-only; the search UI is a client component that renders the API
  response; the browser holds no token and calls the server route), §7 (surface search as result
  cards, not a chatbox; ground every result), §11 (a full results page: all ranked matches, a
  count "found N results across M courses", a sort control defaulting to most relevant, two result
  kinds, an empty state pointing to the catalog), §14 (keep it small; reuse existing components).
- `prompts/intelligent-search.md` — confirms the results page, cards, and client components were
  deferred, and documents the response shape the UI consumes.

## Code inspected

- `components/home/hero.tsx` — the broken input (`SearchInput`, no form).
- `components/ui/search-input.tsx` — spreads `...props` onto the `<input>`, so `name` and
  `defaultValue` pass through; `shortcut` defaults to "⌘ K" (shown in the home design).
- `components/ui/select.tsx` — native `<select>`, spreads props, so `value`/`onChange` work.
- `components/cards/lesson-video-card.tsx` and `components/cards/lesson-card.tsx` — the exact result
  cards from the design system (§11's two kinds). Reused as-is.
- `app/api/search/route.ts` and `lib/search/types.ts` — `POST /api/search` takes
  `{ query, sort }` and returns `SearchResponse { query, sort, count, courseCount, reply, results[] }`.
  `types.ts` has no `server-only`, so the client may import its types.
- `app/courses/page.tsx`, `app/lessons/[slug]/page.tsx` — the page frame, header, breadcrumbs, and
  the `searchParams` Promise pattern (Next 16.3.1).
- `proxy.ts` — `clerkMiddleware()` with no protected routes, so `/search` and `/api/search` are
  public.
- `package.json` — `react-markdown` is not installed.

## Decisions and assumptions

1. **A shared `SearchForm` (server component).** A native `<form action="/search" method="get">`
   wrapping `SearchInput` with `name="q"`. Submitting navigates to `/search?q=...` with no client
   JS — progressive enhancement. This is the `SearchForm` the aborted work was reaching for. The
   hero keeps the "⌘ K" hint (design fidelity); the results-page form hides it.
2. **The `/search` page is a server component** that reads `q` and `sort` from `searchParams`,
   renders the frame/header/breadcrumbs/heading and the `SearchForm`, then hands off to a
   `SearchResults` client component. With no `q`, it shows a prompt and a link to the catalog
   instead of calling the API.
3. **`SearchResults` (client component)** POSTs `{ query, sort }` to `/api/search`, with an
   `AbortController` to drop a superseded request. States: loading, error, empty, results.
4. **Sort re-fetches.** The API owns ordering (including `newest`, which needs a lesson date the
   response does not carry), so changing the sort re-runs the search rather than re-ordering on the
   client. This keeps the client thin and the backend the single source of truth, at the cost of a
   second search call per sort change.
5. **`reply` is rendered as a muted plain-text line.** `react-markdown` is not installed; the reply
   is one or two sentences, so plain text is enough and avoids a new dependency and a chatbox feel.
6. **Cards reused unchanged.** Video → `LessonVideoCard` (title, `reason`, `Lesson {label}`,
   `formatTimestamp(startSeconds)`, href). Lesson → `LessonCard` (title, `reason`,
   `Module {label before the dot}`, href).

## Files

- `components/search/search-form.tsx` *(new)* — the GET form wrapping `SearchInput`.
- `components/home/hero.tsx` *(edit)* — swap the bare `SearchInput` for `SearchForm`.
- `app/search/page.tsx` *(new)* — the results page shell + empty/prompt states.
- `components/search/search-results.tsx` *(new, client)* — fetch, states, count, sort, card grid.

## Requirements

- Hero submit navigates to `/search?q=<query>` and the results render there.
- Count line reads "Found N results across M courses" from `count`/`courseCount`.
- Sort control defaults to "Most Relevant"; options map to the API sorts
  (`relevance`/`newest`/`duration`).
- Two card kinds render per §11; each action deep-links via the API-built `href` (video carries the
  start second).
- Empty results show a message and a link to `/courses`.
- Responsive down to mobile; desktop stays on-brand with the catalog page.
- No token in the browser; the client only calls `/api/search`.

## Security considerations

- No new secret reaches the browser. The client calls the server route only.
- No new mutation; search is read-only. Middleware already leaves both routes public.

## Acceptance criteria

- Typing a query in the hero and pressing Enter lands on `/search` with ranked cards, a count, and a
  working sort control.
- An empty or no-match query shows the empty state, not a crash.
- `npm run lint`, `npm run typecheck`, and `npm run build` pass.

## Checks to run

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Manual test

1. `npm run dev`, open `http://localhost:3000/`.
2. Type "how do I fetch data and cache it" in the hero box and press Enter.
3. Confirm `/search?q=...` renders ranked video and lesson cards with a count line.
4. Change the sort control; confirm the list re-orders.
5. Click a video card; confirm the lesson page opens at the matched second.
6. Search a nonsense string; confirm the empty state with a catalog link.
