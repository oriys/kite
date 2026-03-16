import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import skillsLock from '@/skills-lock.json'
import { terminalManager } from '@/lib/terminal-manager'
import type { TerminalSession } from '@/lib/terminal-manager'
import type { TerminalSessionAccess } from '@/lib/terminal-session-access'
import { listEnabledWorkspaceCliSkills } from '@/lib/queries/skills'

const LOCAL_SKILL_BASE_DIRS = [
  join(process.cwd(), '.agents', 'skills'),
  join(process.cwd(), '.github', 'skills'),
]

function resolveLocalSkillDirectory(slug: string) {
  for (const baseDir of LOCAL_SKILL_BASE_DIRS) {
    const candidate = join(baseDir, slug)
    if (existsSync(join(candidate, 'SKILL.md'))) {
      return candidate
    }
  }

  return null
}

function buildCustomSkillMarkdown(skill: {
  slug: string
  description: string
  prompt: string
}) {
  const description =
    skill.description.trim() || `Workspace CLI skill ${skill.slug}`

  return `---
name: ${JSON.stringify(skill.slug)}
description: ${JSON.stringify(description)}
---

${skill.prompt.trim()}
`
}

function installCatalogSkill(skill: {
  slug: string
  sourceType: string
  source: string
  prompt: string | null
  description: string
}, destinationDir: string) {
  if (skill.sourceType === 'custom') {
    if (!skill.prompt?.trim()) {
      throw new Error(`Custom skill "${skill.slug}" is missing prompt content`)
    }

    mkdirSync(destinationDir, { recursive: true })
    writeFileSync(
      join(destinationDir, 'SKILL.md'),
      buildCustomSkillMarkdown({
        slug: skill.slug,
        description: skill.description,
        prompt: skill.prompt,
      }),
      'utf8',
    )
    return
  }

  const sourceDir = resolveLocalSkillDirectory(skill.slug)
  if (!sourceDir) {
    throw new Error(
      `Skill "${skill.slug}" is enabled but no local source directory was found for ${skill.source}`,
    )
  }

  cpSync(sourceDir, destinationDir, { recursive: true })
}

function buildSessionSkillsLock(
  skills: Awaited<ReturnType<typeof listEnabledWorkspaceCliSkills>>,
) {
  return {
    version: skillsLock.version,
    skills: Object.fromEntries(
      skills.map((skill) => [
        skill.slug,
        {
          source: skill.source,
          sourceType: skill.sourceType,
          computedHash: skill.computedHash ?? undefined,
          ref: skill.ref ?? undefined,
        },
      ]),
    ),
  }
}

async function performTerminalBootstrap(
  session: TerminalSession,
  access: TerminalSessionAccess,
) {
  terminalManager.updateSessionStatus(session.id, 'bootstrapping', access)
  terminalManager.appendOutput(
    session.id,
    '\r\n[Kite] Initializing Copilot CLI skills...\r\n',
    access,
  )

  rmSync(session.skillsDir, { recursive: true, force: true })
  mkdirSync(session.skillsDir, { recursive: true })

  const enabledSkills = await listEnabledWorkspaceCliSkills(session.workspaceId)

  if (enabledSkills.length === 0) {
    terminalManager.appendOutput(
      session.id,
      '[Kite] No workspace CLI skills enabled. Using an empty Copilot home.\r\n',
      access,
    )
  }

  for (const skill of enabledSkills) {
    terminalManager.appendOutput(
      session.id,
      `[Kite] Installing skill: ${skill.slug}\r\n`,
      access,
    )

    const destinationDir = join(session.skillsDir, skill.slug)
    rmSync(destinationDir, { recursive: true, force: true })
    installCatalogSkill(skill, destinationDir)
  }

  writeFileSync(
    session.skillsLockPath,
    `${JSON.stringify(buildSessionSkillsLock(enabledSkills), null, 2)}\n`,
    'utf8',
  )

  terminalManager.updateSessionStatus(session.id, 'ready', access)
  terminalManager.appendOutput(
    session.id,
    `[Kite] Copilot CLI skills ready at ${session.skillsDir}\r\n`,
    access,
  )
}

export function startTerminalSessionBootstrap(
  sessionId: string,
  access: TerminalSessionAccess,
) {
  return terminalManager
    .ensureSessionBootstrap(sessionId, access, (session) =>
      performTerminalBootstrap(session, access),
    )
    .catch((error) => {
      const message =
        error instanceof Error ? error.message : 'Unknown bootstrap failure'

      terminalManager.updateSessionStatus(sessionId, 'error', access, message)
      terminalManager.appendOutput(
        sessionId,
        `\r\n[Kite] Copilot CLI skill bootstrap failed: ${message}\r\n`,
        access,
      )
      throw error
    })
}
