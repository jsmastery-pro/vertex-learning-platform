import {DocumentVideoIcon} from '@sanity/icons/DocumentVideo'
import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * Video intelligence: one document per unique video URL, built by the offline ingestion pipeline in
 * `scripts/ingest` (AGENTS.md §9). It is an internal lookup for search — a lesson links to it by
 * video URL, and a matched moment is always reported as the lesson that uses the video, never as a
 * result of its own (§7, §11).
 *
 * Read-only on purpose: hand-editing a chunk would desync it from the transcript it came from.
 * Re-run the pipeline instead.
 */
export const video = defineType({
  name: 'video',
  title: 'Video',
  type: 'document',
  icon: DocumentVideoIcon,
  readOnly: true,
  description: 'Built by scripts/ingest. Not authored here — re-run the pipeline to change it.',
  fields: [
    defineField({
      name: 'videoId',
      title: 'Video ID',
      description: 'Provider-side id. For Bunny Stream this is `<libraryId>/<videoId>`.',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'url',
      title: 'Video URL',
      description: "Matches the `videoUrl` of every lesson that uses this video.",
      type: 'url',
      validation: (rule) => rule.required().uri({scheme: ['https']}),
    }),
    defineField({
      name: 'provider',
      type: 'string',
      options: {
        list: [
          {title: 'YouTube', value: 'youtube'},
          {title: 'Vimeo', value: 'vimeo'},
          {title: 'Bunny Stream', value: 'bunny'},
        ],
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'chapters',
      description: 'Table of contents. Empty when the source published no markers.',
      type: 'array',
      of: [defineArrayMember({type: 'videoChapter'})],
    }),
    defineField({
      name: 'chunks',
      title: 'Transcript chunks',
      description: 'The transcript in short timestamped pieces.',
      type: 'array',
      of: [defineArrayMember({type: 'videoChunk'})],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'ingestedAt',
      title: 'Ingested at',
      description: 'When the pipeline last wrote this document.',
      type: 'datetime',
    }),
  ],
  preview: {
    select: {videoId: 'videoId', provider: 'provider', chapters: 'chapters', chunks: 'chunks'},
    prepare({videoId, provider, chapters, chunks}) {
      const counts = `${chapters?.length ?? 0} chapters · ${chunks?.length ?? 0} chunks`
      return {title: videoId, subtitle: [provider, counts].filter(Boolean).join(' · ')}
    },
  },
})
