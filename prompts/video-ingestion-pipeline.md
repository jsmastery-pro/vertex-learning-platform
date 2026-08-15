# Video ingestion pipeline

Build the offline tooling that produces the `video` documents search depends on: one document per
unique video URL, holding the chapter markers (table of contents) and the transcript split into
short timestamped chunks. AGENTS.md §8 (data), §9 (ingestion), §7 (two-stage timestamp resolution).

## Goal

After this lands, a `video` document exists for every lesson video in the dataset, and the search
agent's second stage — match `chapters[].label`, fall back to `chunks[].text` — has real data to
resolve a `startSeconds` from. Nothing about the request path changes.

## Skills and docs read

- `AGENTS.md` §§7–9, §12, §13.
- `~/.claude/skills/sanity-best-practices/SKILL.md` — schema authoring (`defineType`/`defineField`),
  TypeGen, array `_key` rules.
- Existing project code, listed below. No new framework docs were needed: this is a Node script
  workspace plus one schema type.

## Code inspected

- `studio/scripts/seed/resolve-videos.mjs` — the house style for offline tooling: committed cache,
  resume-on-rerun, `--force`, throttle, persist-as-you-go, non-zero exit on failures.
- `studio/scripts/seed/build-ndjson.mjs` — deterministic ids, stable `_key`s, self-checks before
  writing, `sanity dataset import ... --replace` for idempotence and no write token.
- `studio/schemaTypes/documents/lesson.ts` — `videoUrl` is required and host-restricted to YouTube,
  Vimeo, Bunny.
- `studio/schemaTypes/index.ts`, `studio/structure.ts`, `studio/sanity.cli.ts` (typegen writes
  `../sanity.types.ts`).
- `lib/video.ts` — provider/id parsing and embed building already exist on the web side.
- `lib/search/system-prompt.ts`, `lib/search/types.ts`, `studio/scripts/context/vertex-search.ndjson`
  — all three **already** describe the `video` type (`url`, `chapters[].startSeconds/label`,
  `chunks[].startSeconds/text`) and tolerate it holding zero documents. This work fills that gap; it
  does not change the contract.

## Findings that shaped the design (verified, not assumed)

Probed live against three seeded video ids before writing this:

1. The watch page's `captionTracks[].baseUrl` returns **HTTP 200 with an empty body** — YouTube's
   current block on unauthenticated caption fetches. A naive scraper silently produces zero chunks.
2. The InnerTube player endpoint with the **iOS client context** returns a working caption track;
   `&fmt=json3` on that URL returns real JSON cues. The ANDROID client returns XML for the same
   request; WEB returns `UNPLAYABLE`. **So: iOS client + `fmt=json3`, with the XML `<transcript>`
   form as fallback.**
3. Chapters are available from the watch page's `ytInitialData` (`chapterRenderer` and
   `macroMarkersListItemRenderer`, `timeRangeStartMillis`) — 30, 21 and 18 markers on the three
   probed videos. They arrive duplicated across renderers, so they must be deduped by start time.

## Decisions and assumptions

- **YouTube is the only provider with an ingestion adapter.** Per §9 a provider counts as supported
  only when both ingestion and playback exist. Playback exists for all three; ingestion for Vimeo
  needs an API token (`/texttracks`) and Bunny needs an API key, neither of which this project has,
  and neither is testable here. The runner keeps a provider registry, and Vimeo/Bunny URLs are
  **reported as skipped with a clear reason**, not half-implemented. Adding one later is one file.
  Every video in the seeded dataset is YouTube.
- **The URL list comes from the dataset**, via `sanity documents query` through the CLI (already
  authenticated — no token anywhere), so hand-authored lessons are covered, not just seeded ones.
  Deduped by resolved provider id, since two lessons may share a video.
- **Ids are deterministic**: `video.youtube-<videoId>`, Bunny would be
  `video.bunny-<library>-<id>`. Only `[A-Za-z0-9._-]` survives; anything else is stripped (§9).
- **Chunking**: caption cues are merged until a chunk reaches ~45 s or ~350 characters, whichever
  comes first, breaking only on cue boundaries. `startSeconds` is the floor of the first cue's
  start. HTML entities decoded, whitespace collapsed, empty chunks dropped. A 90-minute video lands
  around 120 chunks — never one big field (§8).
- **Cache and generated NDJSON are not committed.** `videos.json` in the seed pipeline is small;
  120 transcripts are megabytes. Cache goes to `studio/scripts/ingest/.cache/<id>.json`, output to
  `studio/scripts/ingest/videos.ndjson`, both gitignored. Re-runs read the cache and do zero
  network traffic.
- A small `parse-video-url.mjs` duplicates the provider/id rules from `lib/video.ts` — the two
  workspaces are separate npm packages and a `.mjs` script cannot import the web app's TypeScript.
  It stays minimal (provider + id only, no embed building), with a comment pointing at `lib/video.ts`
  as the counterpart.
- `chapters` may legitimately be empty (author published no markers). That is fine: stage two of the
  timestamp resolution falls back to chunks.
- Existing `videos.json`/seed pipeline is left untouched.

## Files to touch

**New**

- `studio/schemaTypes/documents/video.ts` — the `video` document.
- `studio/schemaTypes/objects/videoChapter.ts` — `{startSeconds, label}`.
- `studio/schemaTypes/objects/videoChunk.ts` — `{startSeconds, text}`.
- `studio/scripts/ingest/parse-video-url.mjs` — provider + id from a lesson `videoUrl`.
- `studio/scripts/ingest/providers/youtube.mjs` — chapters from `ytInitialData`, cues from the
  InnerTube iOS player + `timedtext`.
- `studio/scripts/ingest/chunk.mjs` — cues → timestamped chunks.
- `studio/scripts/ingest/ingest-videos.mjs` — the runner: query lessons, dedupe, fetch, cache.
- `studio/scripts/ingest/build-ndjson.mjs` — cache → `videos.ndjson`, with self-checks.
- `studio/scripts/ingest/README.md` — how to run it, what each file is, what breaks and why.

**Changed**

- `studio/schemaTypes/index.ts` — register the three types.
- `studio/structure.ts` — a read-only "Videos" list, visually separated: this is internal lookup
  data, not authored content.
- `studio/package.json` — `ingest:videos`, `ingest:build`, `ingest:import` scripts.
- `.gitignore` — the ingest cache and generated NDJSON.
- `sanity.types.ts` + `studio/schema.json` — regenerated by typegen (schema.json is gitignored).

## Requirements

1. `video` document: `videoId` (string, required), `url` (url, required, https), `provider`
   (string, list of youtube/vimeo/bunny), `chapters` (array of `videoChapter`), `chunks` (array of
   `videoChunk`), `ingestedAt` (datetime — tells an author whether a video predates a re-run).
   The whole type is `readOnly` in the Studio, with a description saying the pipeline owns it.
   Preview shows the id plus `N chapters · M chunks`.
2. Both array member objects are non-negative integer `startSeconds` plus required text/label, with
   a preview that renders `mm:ss — label`.
3. Every array member gets a deterministic `_key` (`chapter-<startSeconds>`, `chunk-<index>`), so a
   re-import produces no diff noise — same rule the seed builder follows.
4. The runner: resumes from cache, `--force` re-fetches, `--limit=N` for a smoke run, throttles
   between videos, persists each video as it lands, prints a per-video line, and exits non-zero with
   a list when anything failed. It never partially writes a video: no cues means a recorded failure,
   not a document with an empty `chunks` array.
5. The builder refuses to write `videos.ndjson` if any document would fail the schema's validation
   rules (ids well-formed, `startSeconds` monotonic and integer, no empty text, chapters sorted).
6. Chapters deduped by `startSeconds`, sorted ascending, labels trimmed, anything past the video's
   end dropped.
7. Nothing here runs in the request path, and no web-side module imports any of it.

## Security considerations

- No token is introduced. Reads go through the authenticated Sanity CLI, and the import is
  `sanity dataset import`, which also uses CLI auth — consistent with the seed pipeline and with the
  §12 rule that write tokens stay server-side and out of the browser.
- The scripts only ever `fetch` YouTube hosts, and only for ids parsed out of a URL that already
  passed the lesson schema's host allowlist. No stored URL is interpolated into a request unparsed.
- No transcript data reaches the browser; the video documents stay an internal lookup and are never
  rendered as a result (§7, §11).

## Acceptance criteria

- `video` appears in the Studio as a read-only list, and TypeGen emits a `Video` type.
- Running the three commands against the seeded dataset produces one `video` document per unique
  lesson video, each with a non-empty `chunks` array and `chapters` where the author published them.
- Re-running with no `--force` performs no network requests and produces a byte-identical NDJSON.
- A GROQ query in Vision returns a filtered chapter/chunk match for a real keyword, e.g.
  `*[_type == "video"][0]{videoId, "hits": chapters[label match "server*"][0...3]{startSeconds, label}}`.
- A search on the site for a topic taught mid-video returns a `video` hit with a real `startSeconds`,
  and the lesson page starts the embed at that second.

## Checks to run

- `cd studio && npx tsc --noEmit` (schema types) and `npm run typegen`.
- `npm run typecheck` and `npm run lint` in web (typegen rewrites `sanity.types.ts`).
- No web build needed unless typegen output changes a route's types — run it if it does.
- Live verification against the MCP endpoint after the import, per §13.

## Manual test steps

1. `cd studio && npm run ingest:videos -- --limit=3` — three videos resolve, cache files appear.
2. `npm run ingest:videos` — the rest resolve; re-run it and confirm it reports everything cached
   and makes no requests.
3. `npm run ingest:build` then `npm run ingest:import`.
4. In the Studio, open Videos: documents are read-only and show `N chapters · M chunks`.
5. In Vision, run the filtered chapter query above and confirm real labels and start times.
6. `npm run dev` in web, search for a specific mid-video concept (e.g. "server component benefits"),
   and confirm a video result whose Watch action opens the lesson page at that second.
