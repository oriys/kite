import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withWorkspaceAuth, badRequest, notFound } from '@/lib/api-utils'
import { getAgentTaskInteraction } from '@/lib/queries/agent'
import { resolveInteraction } from '@/lib/agent/interactions'
import type { AgentInteractionResponse, AgentInteraction } from '@/lib/schema-agent'

function validateResponse(
  interaction: AgentInteraction,
  body: Record<string, unknown>,
): AgentInteractionResponse | null {
  switch (interaction.type) {
    case 'confirm': {
      if (typeof body.accepted !== 'boolean') return null
      const feedback = typeof body.feedback === 'string' ? body.feedback.trim() : undefined
      return { type: 'confirm', accepted: body.accepted, feedback }
    }
    case 'select': {
      if (typeof body.selected !== 'string') return null
      if (!interaction.options.includes(body.selected)) return null
      return { type: 'select', selected: body.selected }
    }
    case 'input': {
      if (typeof body.text !== 'string') return null
      return { type: 'input', text: body.text.trim() }
    }
    default:
      return null
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await withWorkspaceAuth('member')
  if ('error' in result) return result.error

  const { id } = await params
  const task = await getAgentTaskInteraction(result.ctx.workspaceId, id)
  if (!task) return notFound()

  if (task.status !== 'waiting_for_input') {
    return badRequest('Task is not waiting for input')
  }

  if (!task.interaction) {
    return badRequest('No pending interaction')
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON')

  const response = validateResponse(task.interaction, body as Record<string, unknown>)
  if (!response) {
    return badRequest('Invalid response for this interaction type')
  }

  const resolved = resolveInteraction(id, response)
  if (!resolved) {
    return badRequest('No pending interaction to resolve (may have timed out)')
  }

  return NextResponse.json({ ok: true })
}
