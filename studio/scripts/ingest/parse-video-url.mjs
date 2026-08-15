/**
 * Provider + id from a lesson's `videoUrl`.
 *
 * This mirrors the parsing half of the web app's `lib/video.ts` (which also builds embed URLs).
 * The two workspaces are separate npm packages and this is a plain `.mjs` script, so it cannot
 * import that TypeScript module — keep the host rules here in step with it and with the lesson
 * schema's allowlist.
 */

const ID_PATTERN = /^[\w-]+$/

/** Returns `{provider, id}` or null when the URL is not a supported provider URL. */
export function parseVideoUrl(url) {
  if (!url) return null

  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.protocol !== 'https:') return null

  const host = parsed.hostname.replace(/^www\./, '')
  const segments = parsed.pathname.split('/').filter(Boolean)

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = parsed.searchParams.get('v') ?? (segments[0] === 'embed' ? segments[1] : null)
    return id && ID_PATTERN.test(id) ? {provider: 'youtube', id} : null
  }

  if (host === 'youtu.be') {
    const [id] = segments
    return id && ID_PATTERN.test(id) ? {provider: 'youtube', id} : null
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = segments[0] === 'video' ? segments[1] : segments[0]
    return id && /^\d+$/.test(id) ? {provider: 'vimeo', id} : null
  }

  if (host === 'iframe.mediadelivery.net' || host === 'video.bunnycdn.com') {
    const [library, id] =
      segments[0] === 'embed' || segments[0] === 'play' ? segments.slice(1) : segments
    return library && id && ID_PATTERN.test(library) && ID_PATTERN.test(id)
      ? {provider: 'bunny', id: `${library}/${id}`}
      : null
  }

  return null
}

/**
 * The document id for a parsed video. Sanity ids accept only `[A-Za-z0-9._-]`, so anything else —
 * the slash inside a Bunny id, for one — is stripped (AGENTS.md §9).
 */
export function videoDocumentId({provider, id}) {
  return `video.${provider}-${id.replace(/[^A-Za-z0-9_-]+/g, '-')}`
}
