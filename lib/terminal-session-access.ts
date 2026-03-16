export interface TerminalSessionAccess {
  userId: string
  workspaceId: string
}

export function hasTerminalSessionAccess(
  session: Pick<TerminalSessionAccess, 'userId' | 'workspaceId'>,
  access: TerminalSessionAccess,
) {
  return (
    session.userId === access.userId &&
    session.workspaceId === access.workspaceId
  )
}
