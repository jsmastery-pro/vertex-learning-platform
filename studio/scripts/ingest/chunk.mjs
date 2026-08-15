/**
 * Caption cues -> transcript chunks.
 *
 * A cue is a second or two of speech, which is too small to match against and too many rows to
 * store. Cues are merged until a chunk reaches MAX_CHUNK_SECONDS or MAX_CHUNK_CHARS, whichever
 * comes first, and never split mid-cue — so every chunk's `startSeconds` is a real moment in the
 * video, which is what a search result seeks to.
 */

const MAX_CHUNK_SECONDS = 45
const MAX_CHUNK_CHARS = 350

const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", nbsp: ' '}

/** YouTube double-encodes some of these, so decode until it stops changing. */
export function decodeEntities(value) {
  let text = String(value ?? '')
  for (let pass = 0; pass < 3; pass += 1) {
    const next = text.replace(/&(#?\w+);/g, (match, name) => {
      if (ENTITIES[name] !== undefined) return ENTITIES[name]
      if (/^#\d+$/.test(name)) return String.fromCodePoint(Number(name.slice(1)))
      return match
    })
    if (next === text) break
    text = next
  }
  return text
}

export function cleanCueText(value) {
  return decodeEntities(value)
    // Caption files carry position and sound tags that are noise to a text match.
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {Array<{start: number, text: string}>} cues sorted by start, seconds
 * @returns {Array<{startSeconds: number, text: string}>}
 */
export function chunkCues(cues) {
  const chunks = []

  let current = null

  for (const cue of cues) {
    const text = cleanCueText(cue.text)
    if (!text) continue

    const start = Math.max(0, Math.floor(cue.start))

    if (!current) {
      current = {startSeconds: start, text}
      continue
    }

    const wouldBeTooLong = current.text.length + 1 + text.length > MAX_CHUNK_CHARS
    const wouldBeTooOld = start - current.startSeconds >= MAX_CHUNK_SECONDS

    if (wouldBeTooLong || wouldBeTooOld) {
      chunks.push(current)
      current = {startSeconds: start, text}
      continue
    }

    current.text = `${current.text} ${text}`
  }

  if (current) chunks.push(current)

  // Two cues can share a second; a chunk that starts where the previous one did is not a distinct
  // moment, so fold it back in.
  return chunks.reduce((kept, chunk) => {
    const previous = kept[kept.length - 1]
    if (previous && previous.startSeconds === chunk.startSeconds) {
      previous.text = `${previous.text} ${chunk.text}`
      return kept
    }
    kept.push(chunk)
    return kept
  }, [])
}
