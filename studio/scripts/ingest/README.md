# Video ingestion

Offline tooling that builds the `video` documents search depends on: one per unique video URL,
holding the chapter markers (the table of contents) and the transcript split into short timestamped
chunks (AGENTS.md §9). Nothing here runs in the request path.

## Running it

```bash
cd studio
npm run ingest:videos    # fetch chapters + transcripts for anything not cached
npm run ingest:build     # expand the cache into videos.ndjson
npm run ingest:import    # sanity dataset import ... --replace
```

Flags on the first command:

| Flag | What it does |
| --- | --- |
| `--limit=N` | Fetch at most N videos. Use for a smoke run. |
| `--force` | Ignore the cache and re-fetch everything. |

Both reads and the import authenticate through the Sanity CLI, so no token is needed anywhere.

## The files

| File | What it is |
| --- | --- |
| `ingest-videos.mjs` | The runner: queries lesson video URLs, dedupes, fetches, caches. |
| `providers/youtube.mjs` | The YouTube adapter: chapters and captions. |
| `chunk.mjs` | Caption cues → timestamped chunks. |
| `parse-video-url.mjs` | Provider + id from a lesson's `videoUrl`; the document id rule. |
| `build-ndjson.mjs` | Expands the cache into NDJSON, self-checking as it goes. |
| `.cache/` | One JSON per video. Not committed — regenerate it. |
| `videos.ndjson` | Generated output. Not committed. Do not hand-edit; rebuild instead. |

## Things worth knowing

- **The URL list comes from the dataset**, not from the seed files, so hand-authored lessons are
  covered too. Two lessons sharing a video produce one document.
- **Ids are deterministic** (`video.youtube-<videoId>`) and the import uses `--replace`, so
  re-running is idempotent. Array `_key`s are deterministic for the same reason.
- **Nothing partial is ever cached.** A video whose captions do not come back is reported as a
  failure and retried on the next run, rather than written as a document with an empty transcript.
- **Chunks are ~45 s or ~350 characters**, whichever comes first, and never split mid-cue — so every
  `startSeconds` is a real moment a search result can seek to.
- **Chapters may legitimately be empty** when the author published no markers. That is fine: the
  search agent matches chapters first and falls back to chunks (§7).
- **YouTube's caption fetch is undocumented and brittle.** The `baseUrl` on the watch page answers
  200 with an empty body; the working path is the InnerTube player endpoint with the iOS client
  context, which is what `providers/youtube.mjs` uses. If YouTube changes it, that file is the only
  thing to fix, and the runner will report failures instead of writing empty documents.
- **Only YouTube can be ingested today.** Playback exists for Vimeo and Bunny, but ingestion needs
  an API credential for each, and §9 says a provider is not supported until both halves exist. Those
  URLs are listed as skipped at the end of a run. Adding one means one file in `providers/` plus an
  entry in the `PROVIDERS` map.
