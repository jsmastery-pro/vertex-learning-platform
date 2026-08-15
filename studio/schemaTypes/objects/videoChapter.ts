import {defineField, defineType} from 'sanity'

import {timecode} from './timecode'

/**
 * One entry in a video's table of contents. Chapter labels are the clean, authored surface the
 * search agent matches first; the transcript chunks are the noisier fallback (AGENTS.md §7).
 */
export const videoChapter = defineType({
  name: 'videoChapter',
  title: 'Chapter',
  type: 'object',
  fields: [
    defineField({
      name: 'startSeconds',
      title: 'Start (seconds)',
      type: 'number',
      validation: (rule) => rule.required().integer().min(0),
    }),
    defineField({
      name: 'label',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: {label: 'label', startSeconds: 'startSeconds'},
    prepare({label, startSeconds}) {
      return {title: `${timecode(startSeconds)} — ${label}`}
    },
  },
})
