import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { withWorkspaceAuth, notFound } from '@/lib/api-utils'
import { duplicateTemplate } from '@/lib/queries/templates'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const template = await duplicateTemplate(
    id,
    result.ctx.workspaceId,
    result.ctx.userId,
  )

  if (!template) return notFound()

  return NextResponse.json(template, { status: 201 })
}
