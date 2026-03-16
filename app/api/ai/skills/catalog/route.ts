import { NextResponse } from 'next/server'

import { withWorkspaceAuth } from '@/lib/api-utils'
import { listCliSkillCatalog } from '@/lib/skill-catalog'
import { listWorkspaceCliSkills, serializeWorkspaceCliSkill } from '@/lib/queries/skills'

export async function GET() {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const [catalog, installedSkills] = await Promise.all([
    listCliSkillCatalog(),
    listWorkspaceCliSkills(result.ctx.workspaceId),
  ])

  const installedBySlug = new Map(
    installedSkills.map((skill) => [skill.slug, serializeWorkspaceCliSkill(skill)]),
  )

  return NextResponse.json(
    catalog.map((item) => ({
      ...item,
      installed: installedBySlug.has(item.slug),
      installedSkill: installedBySlug.get(item.slug) ?? null,
    })),
  )
}
