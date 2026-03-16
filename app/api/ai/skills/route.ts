import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { badRequest, withWorkspaceAuth } from '@/lib/api-utils'
import {
  getCliSkillCatalogItem,
  isValidCliSkillSlug,
} from '@/lib/skill-catalog'
import {
  listWorkspaceCliSkills,
  serializeWorkspaceCliSkill,
  upsertWorkspaceCliSkill,
} from '@/lib/queries/skills'

export async function GET() {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const skills = await listWorkspaceCliSkills(result.ctx.workspaceId)
  return NextResponse.json(skills.map(serializeWorkspaceCliSkill))
}

export async function POST(request: NextRequest) {
  const result = await withWorkspaceAuth('admin')
  if ('error' in result) return result.error

  const body = await request.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  if (!slug) return badRequest('Skill slug is required')
  if (!isValidCliSkillSlug(slug)) {
    return badRequest('Invalid skill slug')
  }

  const catalogItem = getCliSkillCatalogItem(slug)
  if (!catalogItem) {
    return badRequest('Unknown skill slug')
  }

  const enabled = typeof body.enabled === 'boolean' ? body.enabled : true

  const skill = await upsertWorkspaceCliSkill(result.ctx.workspaceId, {
    slug: catalogItem.slug,
    name: catalogItem.name,
    description: catalogItem.description,
    sourceType: catalogItem.sourceType,
    source: catalogItem.source,
    ref: catalogItem.ref,
    computedHash: catalogItem.computedHash,
    enabled,
    installedBy: result.ctx.userId,
  })

  return NextResponse.json(serializeWorkspaceCliSkill(skill), { status: 201 })
}
