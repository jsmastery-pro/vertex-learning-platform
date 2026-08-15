/**
 * YouTube ingestion: chapters from the watch page, transcript from the caption track.
 *
 * Two things here are non-obvious and were verified against real videos before being written:
 *
 * 1. The caption `baseUrl` found on the watch page answers 200 with an **empty body**. Fetching it
 *    looks like it worked and yields zero cues. The player endpoint below, called with the iOS
 *    client context, returns a caption track that actually serves — with `fmt=json3` giving JSON
 *    and the bare URL giving the older XML, both of which are parsed here.
 * 2. Chapter markers arrive duplicated across two renderers in the same blob, so they are deduped
 *    by start time.
 *
 * Neither is a documented API. If YouTube changes either, this file is the only thing to fix, and
 * the runner will report the affected videos as failures rather than writing empty documents.
 */

const WATCH_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** The long-public InnerTube web key. Not a secret and not tied to this project. */
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'

const IOS_CLIENT = {
  userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X)',
  context: {
    client: {
      clientName: 'IOS',
      clientVersion: '20.10.4',
      deviceModel: 'iPhone16,2',
      hl: 'en',
      gl: 'US',
    },
  },
}

async function fetchText(url, userAgent, init) {
  const response = await fetch(url, {
    ...init,
    headers: {'user-agent': userAgent, 'accept-language': 'en-US,en', ...init?.headers},
  })
  if (!response.ok) throw new Error(`${response.status} from ${new URL(url).host}`)
  return response.text()
}

/* -------------------------------------------------------------- transcript */

async function playerResponse(videoId) {
  const body = await fetchText(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}`,
    IOS_CLIENT.userAgent,
    {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({videoId, context: IOS_CLIENT.context}),
    },
  )

  const data = JSON.parse(body)
  const status = data?.playabilityStatus?.status
  if (status && status !== 'OK') {
    throw new Error(`not playable (${status}${data.playabilityStatus.reason ? `: ${data.playabilityStatus.reason}` : ''})`)
  }
  return data
}

/** English captions win; a human-authored track beats the auto-generated one. */
function pickTrack(tracks) {
  const score = (track) =>
    (track.languageCode?.startsWith('en') ? 2 : 0) + (track.kind === 'asr' ? 0 : 1)
  return [...tracks].sort((a, b) => score(b) - score(a))[0]
}

function parseJson3(body) {
  const data = JSON.parse(body)
  return (data.events ?? [])
    .filter((event) => Array.isArray(event.segs))
    .map((event) => ({
      start: (event.tStartMs ?? 0) / 1000,
      text: event.segs.map((seg) => seg.utf8 ?? '').join(''),
    }))
}

function parseTimedTextXml(body) {
  const cues = []
  const pattern = /<text[^>]*\bstart="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g
  let match
  while ((match = pattern.exec(body))) {
    cues.push({start: Number(match[1]), text: match[2]})
  }
  return cues
}

/** @returns {Promise<{cues: Array<{start: number, text: string}>, durationSeconds: number|null}>} */
export async function fetchTranscript(videoId) {
  const player = await playerResponse(videoId)

  const tracks = player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  if (!tracks.length) throw new Error('no caption track')

  const track = pickTrack(tracks)
  const durationSeconds = Number(player?.videoDetails?.lengthSeconds)

  // json3 first; some videos still answer with the older XML on the same URL.
  const body = await fetchText(`${track.baseUrl}&fmt=json3`, IOS_CLIENT.userAgent)
  const cues = body.trimStart().startsWith('<') ? parseTimedTextXml(body) : parseJson3(body)

  if (!cues.length) throw new Error('caption track returned no cues')

  return {
    cues: cues.sort((a, b) => a.start - b.start),
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
  }
}

/* ---------------------------------------------------------------- chapters */

function initialData(html) {
  const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

/** Walks the blob for both chapter renderers and returns every `{startSeconds, label}` it finds. */
function collectChapters(node, found = []) {
  if (Array.isArray(node)) {
    node.forEach((item) => collectChapters(item, found))
    return found
  }
  if (!node || typeof node !== 'object') return found

  const renderer = node.chapterRenderer ?? node.macroMarkersListItemRenderer
  if (renderer) {
    const label = renderer.title?.simpleText ?? renderer.title?.runs?.[0]?.text
    const millis = renderer.timeRangeStartMillis
    if (typeof label === 'string' && Number.isFinite(millis)) {
      found.push({startSeconds: Math.max(0, Math.floor(millis / 1000)), label: label.trim()})
    }
  }

  Object.values(node).forEach((value) => collectChapters(value, found))
  return found
}

/** Chapters are optional — a video without published markers returns an empty array, not an error. */
export async function fetchChapters(videoId, durationSeconds) {
  const html = await fetchText(
    `https://www.youtube.com/watch?v=${videoId}&hl=en`,
    WATCH_USER_AGENT,
  )

  const data = initialData(html)
  if (!data) return []

  const bySecond = new Map()
  for (const chapter of collectChapters(data)) {
    if (!chapter.label) continue
    if (durationSeconds && chapter.startSeconds > durationSeconds) continue
    if (!bySecond.has(chapter.startSeconds)) bySecond.set(chapter.startSeconds, chapter)
  }

  return [...bySecond.values()].sort((a, b) => a.startSeconds - b.startSeconds)
}
