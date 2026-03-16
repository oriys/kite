import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { badRequest, notFound, withWorkspaceAuth } from '@/lib/api-utils'
import {
  deleteWorkspaceCliSkill,
  getWorkspaceCliSkill,
  serializeWorkspaceCliSkill,
  updateWorkspaceCliSkill,
} from '@/lib/queries/skills'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const existing = await getWorkspaceCliSkill(id, result.ctx.workspaceId)
  if (!existing) return notFound()

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const patch: Parameters<typeof updateWorkspaceCliSkill>[2] = {}
  if (typeof body.enabled === 'boolean') {
    patch.enabled = body.enabled
  }
  if (typeof body.prompt === 'string') {
    patch.prompt = body.prompt.trim()
  }

  if (Object.keys(patch).length === 0) {
    return badRequest('No updatable fields provided')
  }

  const skill = await updateWorkspaceCliSkill(id, result.ctx.workspaceId, patch)
  if (!skill) return notFound()

  return NextResponse.json(serializeWorkspaceCliSkill(skill))
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const { id } = await params
  const deleted = await deleteWorkspaceCliSkill(id, result.ctx.workspaceId)
  if (!deleted) return notFound()

  return NextResponse.json({ success: true })
}
