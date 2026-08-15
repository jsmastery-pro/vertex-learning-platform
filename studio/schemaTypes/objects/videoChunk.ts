import {defineField, defineType} from 'sanity'

import {timecode} from './timecode'

/**
 * A short, timestamped piece of the transcript. The transcript is never stored as one field — a
 * query that returned it wholesale would overflow the agent's context window (AGENTS.md §8, §12).
 */
export const videoChunk = defineType({
  name: 'videoChunk',
  title: 'Transcript chunk',
  type: 'object',
  fields: [
    defineField({
      name: 'startSeconds',
      title: 'Start (seconds)',
      type: 'number',
      validation: (rule) => rule.required().integer().min(0),
    }),
    defineField({
      name: 'text',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {text: 'text', startSeconds: 'startSeconds'},
    prepare({text, startSeconds}) {
      return {title: `${timecode(startSeconds)} — ${text}`}
    },
  },
})
