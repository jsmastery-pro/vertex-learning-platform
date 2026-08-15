/**
 * Offline video ingestion (AGENTS.md §9).
 *
 * Reads every lesson's video URL from the dataset, and for each unique video fetches the chapter
 * markers and the transcript, splits the transcript into short timestamped chunks, and caches the
 * result. Nothing here runs in the request path, and no write token is involved: reads go through
 * the authenticated Sanity CLI, and the import step (build-ndjson.mjs) uses `sanity dataset import`.
 *
 *   node scripts/ingest/ingest-videos.mjs             # fetch whatever is not cached yet
 *   node scripts/ingest/ingest-videos.mjs --limit=3   # smoke run
 *   node scripts/ingest/ingest-videos.mjs --force     # re-fetch everything
 *
 * A video is cached only when it has real cues. A fetch that yields nothing is recorded as a
 * failure and re-tried on the next run, never written as a document with an empty transcript.
 */

import {execFile} from 'node:child_process'
import {mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {promisify} from 'node:util'
import {fileURLToPath} from 'node:url'

import {chunkCues} from './chunk.mjs'
import {parseVideoUrl, videoDocumentId} from './parse-video-url.mjs'
import * as youtube from './providers/youtube.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(HERE, '.cache')
const STUDIO_ROOT = join(HERE, '..', '..')

/** Be a polite scraper. */
const THROTTLE_MS = 1200

/**
 * Ingestion adapters. A provider counts as supported only when it can both be ingested and played
 * back (§9) — playback exists for all three, so this map is the gate. Vimeo and Bunny need an API
 * credential this project does not have; their URLs are reported as skipped, not half-ingested.
 */
const PROVIDERS = {
  youtube,
  vimeo: null,
  bunny: null,
}

const execFileAsync = promisify(execFile)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const args = process.argv.slice(2)
const force = args.includes('--force')
const limitArg = args.find((arg) => arg.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : null

// A malformed `--limit=` is a typo, not a request to fetch everything. Bail rather than quietly
// running the full catalogue against someone who asked for a smoke run.
if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
  console.error(`Invalid ${limitArg} — expected a positive integer, e.g. --limit=3.`)
  process.exit(1)
}

/* ------------------------------------------------------------------ cache */

mkdirSync(CACHE_DIR, {recursive: true})

const cachePath = (documentId) => join(CACHE_DIR, `${documentId}.json`)

function readCache(documentId) {
  const path = cachePath(documentId)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/* ------------------------------------------------------------ the sources */

/** Every distinct video URL a lesson points at, straight from the dataset. */
async function lessonVideoUrls() {
  const query = '*[_type == "lesson" && defined(videoUrl) && !(_id in path("drafts.**"))].videoUrl'
  const {stdout} = await execFileAsync(
    join(STUDIO_ROOT, 'node_modules', '.bin', 'sanity'),
    ['documents', 'query', query],
    {cwd: STUDIO_ROOT, maxBuffer: 32 * 1024 * 1024},
  )
  const urls = JSON.parse(stdout)
  return [...new Set(Array.isArray(urls) ? urls : [])]
}

async function ingest({provider, id}) {
  const adapter = PROVIDERS[provider]
  if (!adapter) throw new Error(`no ingestion adapter for ${provider}`)

  const {cues, durationSeconds} = await adapter.fetchTranscript(id)
  const chunks = chunkCues(cues)
  if (!chunks.length) throw new Error('transcript produced no chunks')

  const chapters = await adapter.fetchChapters(id, durationSeconds)

  return {chapters, chunks}
}

/* -------------------------------------------------------------- the run */

const urls = await lessonVideoUrls()

const videos = []
const unsupported = []
const seen = new Set()

for (const url of urls) {
  const parsed = parseVideoUrl(url)
  if (!parsed) {
    unsupported.push(`${url} — not a supported provider URL`)
    continue
  }
  if (!PROVIDERS[parsed.provider]) {
    unsupported.push(`${url} — no ${parsed.provider} ingestion adapter`)
    continue
  }

  const documentId = videoDocumentId(parsed)
  if (seen.has(documentId)) continue
  seen.add(documentId)
  videos.push({...parsed, url, documentId})
}

const pending = videos.filter((video) => force || !readCache(video.documentId))
const queue = limit === null ? pending : pending.slice(0, limit)

console.log(
  `${urls.length} lesson video URL(s), ${videos.length} unique ingestible video(s), ` +
    `${pending.length} to fetch${limit === null ? '' : ` (limited to ${queue.length})`}.`,
)

const failures = []
let done = 0

for (const [index, video] of queue.entries()) {
  const label = `[${index + 1}/${queue.length}] ${video.documentId}`

  try {
    const {chapters, chunks} = await ingest(video)

    // Persist as we go, so an interrupted run loses nothing.
    writeFileSync(
      cachePath(video.documentId),
      `${JSON.stringify(
        {
          _id: video.documentId,
          videoId: video.id,
          provider: video.provider,
          url: video.url,
          chapters,
          chunks,
          // Stamped per video, at the moment it was actually fetched. build-ndjson.mjs copies this
          // straight through, so a video that did not change keeps its timestamp and produces no
          // diff on the next import.
          ingestedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    )

    done += 1
    console.log(`${label} — ${chapters.length} chapters, ${chunks.length} chunks`)
  } catch (error) {
    failures.push(`${video.documentId} (${video.url}) — ${error.message}`)
    console.warn(`${label} — failed: ${error.message}`)
  }

  await sleep(THROTTLE_MS)
}

const cached = readdirSync(CACHE_DIR).filter((name) => name.endsWith('.json')).length

console.log(`\nIngested ${done} video(s). Cache holds ${cached}.`)

if (unsupported.length) {
  console.warn(`\nSkipped ${unsupported.length} URL(s):`)
  unsupported.forEach((line) => console.warn(`  - ${line}`))
}

if (failures.length) {
  console.error(`\nFailed ${failures.length} video(s):`)
  failures.forEach((line) => console.error(`  - ${line}`))
  console.error('Re-run to retry them. Nothing partial was cached.')
  process.exitCode = 1
}
