import { describe, expect, it } from 'vitest'
import { hasTerminalSessionAccess } from '@/lib/terminal-session-access'

describe('hasTerminalSessionAccess', () => {
  it('allows access when user and workspace match', () => {
    expect(
      hasTerminalSessionAccess(
        { userId: 'user-1', workspaceId: 'workspace-1' },
        { userId: 'user-1', workspaceId: 'workspace-1' },
      ),
    ).toBe(true)
  })

  it('rejects access when the user differs', () => {
    expect(
      hasTerminalSessionAccess(
        { userId: 'user-1', workspaceId: 'workspace-1' },
        { userId: 'user-2', workspaceId: 'workspace-1' },
      ),
    ).toBe(false)
  })

  it('rejects access when the workspace differs', () => {
    expect(
      hasTerminalSessionAccess(
        { userId: 'user-1', workspaceId: 'workspace-1' },
        { userId: 'user-1', workspaceId: 'workspace-2' },
      ),
    ).toBe(false)
  })
})
