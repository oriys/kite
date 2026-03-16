import 'server-only'

import { forbidden, redirect } from 'next/navigation'

import { withWorkspaceAuth } from '@/lib/api-utils'

type WorkspacePageRole = NonNullable<Parameters<typeof withWorkspaceAuth>[0]>

export async function requireWorkspacePageAuth(requiredRole: WorkspacePageRole = 'guest') {
  const result = await withWorkspaceAuth(requiredRole)

  if ('error' in result) {
    if (result.error.status === 401) {
      redirect('/auth/signin')
    }

    if (result.error.status === 403) {
      forbidden()
    }

    redirect('/docs')
  }

  return result.ctx
}
