# Implementation prompt: Search results page (UI)

## Goal

Ship the `/search` results page from `design/vertex-search.png`, wired to the existing
`POST /api/search`. The backend, grounding, and Context document already exist (see
`prompts/intelligent-search.md`); this task is the page, the two result cards, the sort control, the
header search field, and the empty/loading/error states. No new server intelligence, no schema
changes beyond one projection field the cards need.

## Skills and docs read

- `AGENTS.md` — §3 (reproduce the reference exactly; responsive down to mobile; reuse existing
  components and Tailwind patterns before adding new ones), §5 (the search UI is a client component
  rendering the server route's response; the browser holds no token and never calls the MCP or the
  LLM), §7 (results page, not a chatbox; grounded; a result links to the lesson page with a start
  second; playback stays on site; My Learning / free preview are presentational), §11 (all ranked
  results with a count and a sort control defaulting to most relevant; two result kinds with the
  exact fields each carries; empty state points to the full catalog), §13 (checks).
- `node_modules/next/dist/docs/01-app/01-getting-started/*` and
  `03-api-reference/04-functions/use-search-params.md` — `useSearchParams` requires a `<Suspense>`
  boundary in a statically-rendered segment; `useRouter().replace` for updating the query string
  without a history entry.
- No new skill needed: no schema modelling, no MCP change, no migration.

## Code inspected

- `lib/search/types.ts` — the response contract is already exactly what the design needs:
  `query`, `sort`, `count`, `courseCount`, `reply`, and `results[]` as a discriminated union on
  `kind`. Each result carries `lessonTitle`, `label` ("5.1"), `moduleTitle`, `courseTitle`,
  `courseSlug`, `durationSeconds`, `keyPoints`, `thumbnailRef`, `reason`, `href`, `rank`; a video
  result adds `startSeconds` and `momentLabel`. `SORTS = ["relevance", "newest", "duration"]`.
- `app/api/search/route.ts` — `POST` only, accepts `{ query, sort }`, returns `SearchResponse`, or
  `{ error }` with 400/500/502. Captures `search_performed` server-side already, so the client must
  **not** capture a duplicate.
- `lib/search/ground.ts` — sorting happens server-side inside `groundHits(hits, sort)`, so the sort
  control re-requests rather than re-ordering in the browser.
- `sanity/lib/queries.ts` `LESSONS_BY_IDS_QUERY` — returns the lesson thumbnail ref but **no course
  icon**, which the design shows beside every course name. This is the one query change.
- `components/ui/*` — `Card`/`CardFooter`, `Badge` (`video` and `lesson` variants already exist and
  already match the design's pill colours), `Select` (h-11, chevron, sr-only label), `SearchInput`
  (`md`/`lg` sizes, `⌘ K` kbd hint), `Button`/`buttonClasses`.
- `components/cards/lesson-video-card.tsx` — an earlier design-system-era card with a different
  layout (no thumbnail, no course row). The real results page needs the thumbnail-left layout, so
  the search cards are new components; this file stays as-is for the design system page.
- `components/layout/page-frame.tsx`, `components/layout/site-header.tsx`,
  `components/home/hero.tsx` (the eyebrow pill + display heading pattern, and the currently inert
  hero `SearchInput`), `app/courses/page.tsx` (page shell, main padding, `ChartDecoration`).
- `lib/format.ts` — `formatTimestamp` (12:45), `formatDuration`, `pluralize`. `lib/routes.ts` —
  `lessonHref(slug, startSeconds)` already builds every result's `href` server-side.
- `sanity/lib/image.ts` — `urlForImage` for `thumbnailRef` / the new course icon ref.

## Decisions and assumptions

1. **Client-side fetch, URL is the source of truth.** `/search?q=data+fetching&sort=relevance` is a
   server component that renders the shell and a client `<SearchResults>` inside `<Suspense>`. The
   client reads `q`/`sort` from the URL and `POST`s to `/api/search`. Rationale: the route runs an
   LLM tool loop with `maxDuration = 60`, so a server-rendered page would block the whole document
   on it. Client-side gives a skeleton immediately and keeps the URL shareable.
2. **Sort re-requests.** Changing the select calls `router.replace` with the new `sort`, which
   re-runs the fetch. Sorting is a server concern (`groundHits`) and re-sorting in the browser would
   diverge from it. Options: Most Relevant (default), Newest, Shortest first — labels for the three
   existing `SORTS` values.
3. **Course icon comes from the course cover image.** Add `"courseIconRef": course.coverImage.asset._ref`
   to `LESSONS_BY_IDS_QUERY` and `courseIconRef: z.string().nullable()` to `SearchResultBaseSchema`,
   set in `ground.ts`. Fallback when null: the initial-letter tile `CourseCard` already uses. No new
   Sanity field, no author work.
4. **Video thumbnail** is `thumbnailRef` via `urlForImage`; when null, a neutral-900 tile with the
   play glyph, matching the darkest card in the reference. The duration chip bottom-right is
   `formatTimestamp(durationSeconds)`; hidden when duration is null.
5. **The check circle on lesson cards is presentational**, like `CourseProgressBar` and the lesson
   sidebar: progress is not tracked yet (§7). It renders as a static completed mark on the key-points
   panel exactly as drawn, with a comment saying it becomes real when progress lands.
6. **`reply` is not rendered.** The design has no prose block — §7 says cards, not a chatbox. The
   field stays in the contract for later; `react-markdown` is not installed for this task.
7. **Header search field submits to `/search`.** The page's own field and the home hero field both
   become a small `SearchForm` client component (form + `SearchInput`, navigates to
   `/search?q=…`). `⌘ K` focuses it. This makes the hero field live, which it currently is not.
8. **Aborting.** Each fetch runs with an `AbortController` keyed to `q`+`sort` so a fast second
   search cancels the first.
9. Requests are public — `proxy.ts` gates nothing and browsing is public (§7).

## Files to touch

New:

- `app/search/page.tsx` — server shell: `PageFrame`, `SiteHeader`, eyebrow pill, `Results for "q"`
  heading, the count line, the search field, then `<Suspense><SearchResults /></Suspense>`.
- `components/search/search-results.tsx` — client: reads the URL, fetches, renders the count row +
  sort select + result list + states.
- `components/search/search-form.tsx` — client: the field that navigates to `/search`.
- `components/search/video-result-card.tsx`, `components/search/lesson-result-card.tsx`.
- `components/search/search-empty-state.tsx` — the "Can't find what you're looking for?" strip with
  the "Browse all courses" button (shown under results **and** as the zero-result state, per the
  reference).
- `components/search/course-icon.tsx` — icon-or-letter tile shared by both cards.

Changed:

- `sanity/lib/queries.ts` — add `courseIconRef` to `LESSONS_BY_IDS_QUERY`.
- `lib/search/types.ts` — add `courseIconRef` to `SearchResultBaseSchema`.
- `lib/search/ground.ts` — populate it.
- `lib/routes.ts` — add `searchHref(query, sort?)`.
- `components/home/hero.tsx` — swap the inert `SearchInput` for `SearchForm`.
- `sanity.types.ts` — regenerated by TypeGen, never hand-edited.

## Requirements (from the reference image)

- **Header block**: `SEARCH RESULTS` eyebrow pill (same treatment as the hero's "Intelligent
  learning"), display heading `Results for “data fetching”` with the quoted query in primary-500,
  sub-line `Found 28 results across 8 courses` from `count` / `courseCount`, then the `md` search
  field pre-filled with the query, centred, max ~725px.
- **Toolbar**: left `28 results` (`pluralize`), right the sort `Select`, ~164px wide.
- **Video card**: 16:9 thumbnail on the left (~276px) with a centred play button and a duration chip
  bottom-right; right column has the course icon + course title row, the `VIDEO` badge top-right,
  the lesson title, the reason as body copy, and a meta row of `Lesson 5.1 · Data Fetching &
  Caching` with a primary-500 `Watch from 12:45` action and chevron. The whole card links to `href`.
- **Lesson card**: left panel is a tinted key-points list (up to 3 `keyPoints`, bulleted) with the
  presentational check circle bottom-right; right column mirrors the video card but with the
  `LESSON` badge, `Module 5` derived from `label`, and a `View lesson` action with the external-link
  glyph.
- **Empty state strip**: rounded primary-tinted panel, search glyph, two lines of copy, and the
  `Browse all courses` button linking to `/courses`.
- **Loading**: three skeleton cards matching the card silhouette, so the layout does not jump.
- **Error**: one line of copy plus a Retry button; never surfaces the raw route error string.
- **No query** (`/search` with no `q`): the header collapses to a prompt and only the field shows.
- **Responsive**: below `md`, cards stack (thumbnail full-width above the text), the toolbar wraps,
  and the heading steps down. Desktop stays pixel-exact.

## Security considerations

- No token, no MCP call, and no LLM call in the browser: the client only `POST`s to `/api/search`.
- The query is length-capped client-side to `MAX_QUERY_LENGTH` so the route's 400 is a backstop, not
  the UX.
- Route errors are logged server-side and shown to the user as a generic line; the client never
  renders the route's `error` body verbatim for 5xx.
- No PostHog capture added client-side — `search_performed` is already captured server-side, and
  double-counting would corrupt the engagement metric.
- `href` is built server-side by `lessonHref`, so no user-controlled URL is interpolated into a link.

## Acceptance criteria

1. `/search?q=data%20fetching` renders the header, the count line, the toolbar, and one card per
   result, ranked as the API returned them.
2. Video results show a thumbnail, a duration chip, and a `Watch from mm:ss` action whose link
   carries `?t=<startSeconds>`; opening it starts the lesson video at that second.
3. Lesson results show key points and a `View lesson` action to `/lessons/<slug>`.
4. Changing the sort updates the URL and re-fetches; the selection survives a reload.
5. A query with no matches shows the empty state with a working `Browse all courses` link.
6. Every displayed value comes from the response — nothing is fabricated client-side.
7. The page matches the reference on desktop and stays usable at 375px.

## Checks to run

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build` (new route + modified server modules)
- `npm run dev` and exercise the manual steps below against the live MCP.

## Manual test steps

1. `npm run dev`, open `http://localhost:3000`, type `data fetching` in the hero field, press Enter.
2. Land on `/search?q=data+fetching`: skeletons appear, then results with a count line.
3. Compare against `design/vertex-search.png` at 1440px.
4. Click `Watch from …` on a video result — the lesson page opens and the embed starts at that
   second.
5. Click `View lesson` on a lesson result — the lesson page opens at 0.
6. Switch sort to `Newest`; the URL gains `&sort=newest` and the order changes. Reload; it sticks.
7. Search `zzzqqq` — the empty state shows; `Browse all courses` goes to `/courses`.
8. Resize to 375px and confirm the cards stack and nothing overflows.
9. Stop the dev server's OpenAI key (unset `OPENAI_API_KEY`) and search — the error state shows a
   generic message with Retry, and no key or MCP URL appears in the browser.
