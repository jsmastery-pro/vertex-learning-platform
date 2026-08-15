import {type SchemaTypeDefinition} from 'sanity'

import {category} from './documents/category'
import {course} from './documents/course'
import {instructor} from './documents/instructor'
import {lesson} from './documents/lesson'
import {video} from './documents/video'
import {blockContent} from './objects/blockContent'
import {learningOutcome} from './objects/learningOutcome'
import {courseModule} from './objects/module'
import {resource} from './objects/resource'
import {videoChapter} from './objects/videoChapter'
import {videoChunk} from './objects/videoChunk'

export const schema: {types: SchemaTypeDefinition[]} = {
  types: [
    // Documents
    course,
    lesson,
    instructor,
    category,
    video,
    // Objects
    courseModule,
    learningOutcome,
    resource,
    blockContent,
    videoChapter,
    videoChunk,
  ],
}
