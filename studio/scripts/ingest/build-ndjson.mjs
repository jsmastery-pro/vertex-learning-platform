/**
 * Expands the ingestion cache into an NDJSON file the Sanity CLI can import.
 *
 *   node scripts/ingest/build-ndjson.mjs
 *   npx sanity dataset import scripts/ingest/videos.ndjson production --replace
 *
 * Same two rules as the seed builder:
 *
 * 1. Document ids and array `_key`s are deterministic, so importing with --replace is idempotent
 *    and a re-import produces no diff noise.
 * 2. Nothing is written until every self-check passes. Studio validation does not run on import,
 *    so the schema's rules are re-implemented here.
 */

import {readFileSync, readdirSync, writeFileSync, existsSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(HERE, '.cache')
const OUT_PATH = join(HERE, 'videos.ndjson')

if (!existsSync(CACHE_DIR)) {
  console.error('No ingestion cache. Run: node scripts/ingest/ingest-videos.mjs')
  process.exit(1)
}

const files = readdirSync(CACHE_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()

if (!files.length) {
  console.error('The ingestion cache is empty. Run: node scripts/ingest/ingest-videos.mjs')
  process.exit(1)
}

const problems = []
const check = (condition, message) => {
  if (!condition) problems.push(message)
}

const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0

const documents = []

for (const file of files) {
  const cached = JSON.parse(readFileSync(join(CACHE_DIR, file), 'utf8'))
  const where = cached._id ?? file

  check(
    typeof cached._id === 'string' && /^video\.[A-Za-z0-9._-]+$/.test(cached._id),
    `${where}: invalid document id`,
  )
  check(typeof cached.videoId === 'string' && cached.videoId.length > 0, `${where}: missing videoId`)
  check(
    typeof cached.url === 'string' && cached.url.startsWith('https://'),
    `${where}: url must be https`,
  )
  check(
    ['youtube', 'vimeo', 'bunny'].includes(cached.provider),
    `${where}: unknown provider ${cached.provider}`,
  )

  const chapters = Array.isArray(cached.chapters) ? cached.chapters : []
  const chunks = Array.isArray(cached.chunks) ? cached.chunks : []

  check(chunks.length > 0, `${where}: no transcript chunks`)

  // `ingestedAt` comes from the cache entry, stamped when that video was actually fetched. Minting
  // one per build instead would restamp every document on every run and churn the import diff for
  // videos that did not change.
  check(
    typeof cached.ingestedAt === 'string' && !Number.isNaN(Date.parse(cached.ingestedAt)),
    `${where}: missing or invalid ingestedAt — re-run scripts/ingest/ingest-videos.mjs for it`,
  )

  let previousChapter = -1
  chapters.forEach((chapter, index) => {
    check(isNonNegativeInteger(chapter.startSeconds), `${where}: chapter ${index} bad startSeconds`)
    check(
      typeof chapter.label === 'string' && chapter.label.trim().length > 0,
      `${where}: chapter ${index} empty label`,
    )
    check(chapter.startSeconds > previousChapter, `${where}: chapters not strictly ascending`)
    previousChapter = chapter.startSeconds
  })

  let previousChunk = -1
  chunks.forEach((chunk, index) => {
    check(isNonNegativeInteger(chunk.startSeconds), `${where}: chunk ${index} bad startSeconds`)
    check(
      typeof chunk.text === 'string' && chunk.text.trim().length > 0,
      `${where}: chunk ${index} empty text`,
    )
    check(chunk.startSeconds > previousChunk, `${where}: chunks not strictly ascending`)
    previousChunk = chunk.startSeconds
  })

  documents.push({
    _id: cached._id,
    _type: 'video',
    videoId: cached.videoId,
    url: cached.url,
    provider: cached.provider,
    chapters: chapters.map((chapter) => ({
      _type: 'videoChapter',
      _key: `chapter-${chapter.startSeconds}`,
      startSeconds: chapter.startSeconds,
      label: chapter.label.trim(),
    })),
    chunks: chunks.map((chunk, index) => ({
      _type: 'videoChunk',
      _key: `chunk-${index}`,
      startSeconds: chunk.startSeconds,
      text: chunk.text.trim(),
    })),
    ingestedAt: cached.ingestedAt,
  })
}

const ids = documents.map((document) => document._id)
check(new Set(ids).size === ids.length, 'duplicate document _id across the cache')

if (problems.length) {
  console.error(`Refusing to write ${OUT_PATH}. ${problems.length} problem(s):\n`)
  problems.forEach((problem) => console.error(`  - ${problem}`))
  process.exit(1)
}

writeFileSync(OUT_PATH, `${documents.map((document) => JSON.stringify(document)).join('\n')}\n`)

const chapterCount = documents.reduce((total, document) => total + document.chapters.length, 0)
const chunkCount = documents.reduce((total, document) => total + document.chunks.length, 0)

console.log(`Wrote ${documents.length} video document(s) to ${OUT_PATH}`)
console.log(`  chapters: ${chapterCount}\n  chunks: ${chunkCount}`)
