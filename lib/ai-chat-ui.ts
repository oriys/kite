import { format, isSameDay, subDays, subMonths, subWeeks } from 'date-fns'

interface TimestampedSession {
  updatedAt: string
}

interface TranscriptMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

function parseTimestamp(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getChatSessionTitle(title: string | null | undefined) {
  const normalized = title?.trim() ?? ''
  return normalized || 'Untitled chat'
}

export function formatChatSessionTimestamp(value: string, now = new Date()) {
  const date = parseTimestamp(value)
  if (!date) {
    return 'Unknown date'
  }

  if (isSameDay(date, now)) {
    return format(date, 'p')
  }

  if (isSameDay(date, subDays(now, 1))) {
    return 'Yesterday'
  }

  return date.getFullYear() === now.getFullYear()
    ? format(date, 'MMM d')
    : format(date, 'MMM d, yyyy')
}

export function groupChatSessionsByDate<T extends TimestampedSession>(
  sessions: readonly T[],
  now = new Date(),
) {
  const oneWeekAgo = subWeeks(now, 1)
  const oneMonthAgo = subMonths(now, 1)

  const groups = [
    { label: 'Today', sessions: [] as T[] },
    { label: 'Yesterday', sessions: [] as T[] },
    { label: 'Last 7 days', sessions: [] as T[] },
    { label: 'Last 30 days', sessions: [] as T[] },
    { label: 'Older', sessions: [] as T[] },
  ]

  for (const session of sessions) {
    const updatedAt = parseTimestamp(session.updatedAt)

    if (!updatedAt) {
      groups[4].sessions.push(session)
      continue
    }

    if (isSameDay(updatedAt, now)) {
      groups[0].sessions.push(session)
      continue
    }

    if (isSameDay(updatedAt, subDays(now, 1))) {
      groups[1].sessions.push(session)
      continue
    }

    if (updatedAt > oneWeekAgo) {
      groups[2].sessions.push(session)
      continue
    }

    if (updatedAt > oneMonthAgo) {
      groups[3].sessions.push(session)
      continue
    }

    groups[4].sessions.push(session)
  }

  return groups.filter((group) => group.sessions.length > 0)
}

export function serializeChatTranscript(messages: readonly TranscriptMessage[]) {
  return messages
    .filter(
      (message) =>
        (message.role === 'user' || message.role === 'assistant')
        && message.content.trim().length > 0,
    )
    .map((message) => {
      const label = message.role === 'user' ? 'User' : 'Assistant'
      return `${label}:\n${message.content.trim()}`
    })
    .join('\n\n')
}
