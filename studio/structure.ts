import {BookIcon} from '@sanity/icons/Book'
import {DocumentVideoIcon} from '@sanity/icons/DocumentVideo'
import {PlayIcon} from '@sanity/icons/Play'
import {TagIcon} from '@sanity/icons/Tag'
import {UserIcon} from '@sanity/icons/User'
import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.documentTypeListItem('course').title('Courses').icon(BookIcon),
      S.documentTypeListItem('lesson').title('Lessons').icon(PlayIcon),
      S.divider(),
      S.documentTypeListItem('instructor').title('Instructors').icon(UserIcon),
      S.documentTypeListItem('category').title('Categories').icon(TagIcon),
      S.divider(),
      // Internal lookup data, built by scripts/ingest and read-only here.
      S.documentTypeListItem('video').title('Video intelligence').icon(DocumentVideoIcon),
    ])
