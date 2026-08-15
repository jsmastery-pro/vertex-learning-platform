/** `mm:ss`, or `h:mm:ss` past the hour. Preview-only formatting for the video documents. */
export function timecode(seconds: unknown) {
  const total = typeof seconds === 'number' && Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const rest = total % 60

  const pad = (value: number) => String(value).padStart(2, '0')

  return hours ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`
}
