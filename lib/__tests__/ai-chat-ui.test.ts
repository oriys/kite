import { describe, expect, it } from 'vitest'

import {
  formatChatSessionTimestamp,
  getChatSessionTitle,
  groupChatSessionsByDate,
  serializeChatTranscript,
} from '../ai-chat-ui'

function createLocalIso(
  year: number,
  monthIndex: number,
  day: number,
  hours: number,
  minutes = 0,
) {
  return new Date(year, monthIndex, day, hours, minutes).toISOString()
}

describe('getChatSessionTitle', () => {
  it('trims titles and falls back for empty values', () => {
    expect(getChatSessionTitle('  API auth review  ')).toBe('API auth review')
    expect(getChatSessionTitle('   ')).toBe('Untitled chat')
    expect(getChatSessionTitle(null)).toBe('Untitled chat')
  })
})

describe('groupChatSessionsByDate', () => {
  it('groups sessions into relative date buckets while preserving order', () => {
    const now = new Date(2026, 2, 17, 12, 0)
    const todayOne = createLocalIso(2026, 2, 17, 10, 15)
    const todayTwo = createLocalIso(2026, 2, 17, 8, 30)
    const yesterday = createLocalIso(2026, 2, 16, 18, 0)
    const lastWeek = createLocalIso(2026, 2, 13, 9, 0)
    const lastMonth = createLocalIso(2026, 2, 1, 9, 0)
    const older = createLocalIso(2026, 0, 5, 9, 0)

    const groups = groupChatSessionsByDate(
      [
        { id: 'today-1', updatedAt: todayOne },
        { id: 'today-2', updatedAt: todayTwo },
        { id: 'yesterday', updatedAt: yesterday },
        { id: 'last-week', updatedAt: lastWeek },
        { id: 'last-month', updatedAt: lastMonth },
        { id: 'older', updatedAt: older },
      ],
      now,
    )

    expect(groups).toEqual([
      {
        label: 'Today',
        sessions: [
          { id: 'today-1', updatedAt: todayOne },
          { id: 'today-2', updatedAt: todayTwo },
        ],
      },
      { label: 'Yesterday', sessions: [{ id: 'yesterday', updatedAt: yesterday }] },
      { label: 'Last 7 days', sessions: [{ id: 'last-week', updatedAt: lastWeek }] },
      { label: 'Last 30 days', sessions: [{ id: 'last-month', updatedAt: lastMonth }] },
      { label: 'Older', sessions: [{ id: 'older', updatedAt: older }] },
    ])
  })
})

describe('formatChatSessionTimestamp', () => {
  it('returns stable labels for yesterday and invalid timestamps', () => {
    const now = new Date(2026, 2, 17, 12, 0)

    expect(formatChatSessionTimestamp(createLocalIso(2026, 2, 16, 12, 0), now)).toBe(
      'Yesterday',
    )
    expect(formatChatSessionTimestamp('not-a-date', now)).toBe('Unknown date')
  })
})

describe('serializeChatTranscript', () => {
  it('serializes visible user and assistant turns into a copyable transcript', () => {
    expect(
      serializeChatTranscript([
        { role: 'system', content: 'ignored' },
        { role: 'user', content: '  Show me the auth flow.  ' },
        { role: 'assistant', content: 'Here is the flow.' },
      ]),
    ).toBe('User:\nShow me the auth flow.\n\nAssistant:\nHere is the flow.')
  })
})
