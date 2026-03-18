import { describe, expect, it } from 'vitest'

import { sanitizePlainText } from '@/lib/sanitize'
import {
  extractZipContent,
  extractZipDocuments,
} from '../knowledge-extractors'

const ZIP_WITH_NULL_BYTE_TEXT =
  'UEsDBBQAAAAIAMptclytM4IEFgAAABcAAAAPAAAAZG9jcy9yZWFkbWUudHh0S8ssKi5hyMnMS+XlKk5Nzs9LUQBxAFBLAQIUABQAAAAIAMptclytM4IEFgAAABcAAAAPAAAAAAAAAAAAAAAAAAAAAABkb2NzL3JlYWRtZS50eHRQSwUGAAAAAAEAAQA9AAAAQwAAAAAA'

const RECURSIVE_ZIP_WITH_METADATA =
  'UEsDBBQAAAAIAE5/clxYe2mBEgAAABAAAAAUAAAAZG9jcy9ndWlkZXMvaW50cm8ubWRTVvDMKynK5+IKT81Jzs9NBQBQSwMEFAAAAAgATn9yXAHWMo4eAAAAHAAAABUAAABkb2NzL2d1aWRlcy9zZXR1cC5zcWxLLkpNLElVKElMyklVKM7ILyjWyExRKEmtKNG0BgBQSwMEFAAAAAgATn9yXOLWiA0IAAAABgAAAA4AAABkb2NzLy5EU19TdG9yZctMz8svSgUAUEsDBBQAAAAIAE5/clzi1ogNCAAAAAYAAAAYAAAAX19NQUNPU1gvZG9jcy8uX2ludHJvLm1ky0zPyy9KBQBQSwMEFAAAAAgATn9yXKW+61sGAAAABAAAABQAAABkb2NzL2Fzc2V0cy9sb2dvLnBuZ+sM8HMHAFBLAQIUABQAAAAIAE5/clxYe2mBEgAAABAAAAAUAAAAAAAAAAAAAAAAAAAAAABkb2NzL2d1aWRlcy9pbnRyby5tZFBLAQIUABQAAAAIAE5/clwB1jKOHgAAABwAAAAVAAAAAAAAAAAAAAAAAEQAAABkb2NzL2d1aWRlcy9zZXR1cC5zcWxQSwECFAAUAAAACABOf3Jc4taIDQgAAAAGAAAADgAAAAAAAAAAAAAAAACVAAAAZG9jcy8uRFNfU3RvcmVQSwECFAAUAAAACABOf3Jc4taIDQgAAAAGAAAAGAAAAAAAAAAAAAAAAADJAAAAX19NQUNPU1gvZG9jcy8uX2ludHJvLm1kUEsBAhQAFAAAAAgATn9yXKW+61sGAAAABAAAABQAAAAAAAAAAAAAAAAABwEAAGRvY3MvYXNzZXRzL2xvZ28ucG5nUEsFBgAAAAAFAAUASQEAAD8BAAAAAA=='

describe('sanitizePlainText', () => {
  it('removes NUL bytes and normalizes line endings', () => {
    expect(sanitizePlainText('alpha\u0000beta\r\ngamma\rdelta')).toBe(
      'alphabeta\ngamma\ndelta',
    )
  })
})

describe('extractZipContent', () => {
  it('strips NUL bytes from supported text entries before returning markdown', () => {
    const extracted = extractZipContent(ZIP_WITH_NULL_BYTE_TEXT)

    expect(extracted.title).toBe('Zip Archive')
    expect(extracted.content).toContain('## docs/readme.txt')
    expect(extracted.content).toContain('firstline\nsecond line')
    expect(extracted.content).not.toContain('\u0000')
  })

  it('recursively includes nested supported files and ignores ZIP metadata entries', () => {
    const documents = extractZipDocuments(RECURSIVE_ZIP_WITH_METADATA)
    expect(documents.map((document) => document.path)).toEqual([
      'docs/guides/intro.md',
      'docs/guides/setup.sql',
    ])

    const extracted = extractZipContent(RECURSIVE_ZIP_WITH_METADATA)
    expect(extracted.content).toContain('## docs/guides/intro.md')
    expect(extracted.content).toContain('## docs/guides/setup.sql')
    expect(extracted.content).not.toContain('__MACOSX')
    expect(extracted.content).not.toContain('.DS_Store')
  })
})
