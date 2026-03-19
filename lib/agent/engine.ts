import { generateText, stepCountIs } from 'ai'
import {
  resolveAiModelSelection,
  resolveWorkspaceAiProviders,
  createLanguageModel,
} from '@/lib/ai-server'
import { getAiWorkspaceSettings } from '@/lib/queries/ai'
import { createAgentTools, type AgentToolContext } from './tools'
import { buildAgentSystemPrompt } from './prompts'
import type { AgentStepRecord } from '@/lib/schema-agent'

// ─── Public types ────────────────────────────────────────────

export interface AgentRunOptions {
  workspaceId: string
  userId: string
  prompt: string
  documentId?: string
  modelId?: string
  maxSteps?: number
  onStep?: (step: AgentStepRecord) => void
  signal?: AbortSignal
}

export interface AgentRunResult {
  steps: AgentStepRecord[]
  result: string
  modelId: string
}

// ─── Constants ───────────────────────────────────────────────

const DEFAULT_MAX_STEPS = 15
const AGENT_TEMPERATURE = 0.2

// ─── Engine ──────────────────────────────────────────────────

export async function runAgent(options: AgentRunOptions): Promise<AgentRunResult> {
  const {
    workspaceId,
    userId,
    prompt,
    documentId,
    maxSteps = DEFAULT_MAX_STEPS,
    onStep,
    signal,
  } = options

  // 1. Resolve AI model
  const [providers, settings] = await Promise.all([
    resolveWorkspaceAiProviders(workspaceId),
    getAiWorkspaceSettings(workspaceId),
  ])

  const selection = resolveAiModelSelection({
    requestedModelId: options.modelId,
    defaultModelId: settings?.defaultModelId ?? null,
    enabledModelIds: Array.isArray(settings?.enabledModelIds)
      ? settings.enabledModelIds.filter((v): v is string => typeof v === 'string')
      : [],
    providers,
  })

  if (!selection) {
    throw new Error('No AI model configured for this workspace.')
  }

  console.log(`[agent] Model resolved: ${selection.modelId} via ${selection.provider.providerType} (${selection.provider.baseUrl})`)

  // 2. Build tools
  const toolCtx: AgentToolContext = { workspaceId, userId }
  const tools = createAgentTools(toolCtx)

  // 3. Build system prompt — fetch document context directly if needed
  let documentContext: string | undefined
  if (documentId) {
    const { documents: docsTable } = await import('@/lib/schema')
    const { db: database } = await import('@/lib/db')
    const { eq: eqOp, and: andOp } = await import('drizzle-orm')
    const [doc] = await database
      .select({ title: docsTable.title, slug: docsTable.slug, content: docsTable.content })
      .from(docsTable)
      .where(andOp(eqOp(docsTable.workspaceId, workspaceId), eqOp(docsTable.slug, documentId)))
      .limit(1)
    if (doc) {
      const content = typeof doc.content === 'string' ? doc.content.slice(0, 4000) : '(empty)'
      documentContext = `Working on: **${doc.title}** (${doc.slug})\n\nCurrent content:\n${content}`
    }
  }

  const systemPrompt = buildAgentSystemPrompt({ documentContext })

  // 4. Run the agent loop
  const model = createLanguageModel(selection.provider, selection.modelId)
  const steps: AgentStepRecord[] = []

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: prompt },
  ]

  let stepIndex = 0

  console.log(`[agent] Starting generateText with ${Object.keys(tools).length} tools, maxSteps=${maxSteps}`)

  const result = await generateText({
    model,
    system: systemPrompt,
    messages,
    tools,
    stopWhen: stepCountIs(maxSteps),
    temperature: AGENT_TEMPERATURE,
    abortSignal: signal,
    onStepFinish(event) {
      try {
        console.log(`[agent] Step ${stepIndex} finished, text length: ${(event.text || '').length}`)
        const tcList = event.toolCalls ?? []
        const trList = event.toolResults ?? []
        const step: AgentStepRecord = {
          index: stepIndex++,
          type: tcList.length > 0 ? 'tool_call' : 'response',
          toolCalls: tcList.length > 0
            ? tcList.map((tc) => ({
                name: tc.toolName,
                args: ('args' in tc ? tc.args : (tc as Record<string, unknown>).input) as Record<string, unknown>,
              }))
            : undefined,
          text: event.text || undefined,
        }

        // Attach tool results if available
        if (step.toolCalls && trList.length > 0) {
          for (let i = 0; i < step.toolCalls.length; i++) {
            const toolResult = trList[i]
            if (toolResult) {
              const value = 'result' in toolResult ? toolResult.result : (toolResult as Record<string, unknown>).output
              step.toolCalls[i].result = JSON.stringify(value).slice(0, 2000)
            }
          }
        }

        steps.push(step)
        onStep?.(step)
      } catch (e) {
        console.error('[agent] Error in onStepFinish:', e)
      }
    },
  })

  // The final text is the agent's summary
  const finalText = result.text || '(Agent completed without a final response)'

  // If the last step isn't a response step, add one
  if (steps.length === 0 || steps[steps.length - 1].type !== 'response' || !steps[steps.length - 1].text) {
    const responseStep: AgentStepRecord = {
      index: stepIndex,
      type: 'response',
      text: finalText,
    }
    steps.push(responseStep)
    onStep?.(responseStep)
  }

  return {
    steps,
    result: finalText,
    modelId: selection.modelId,
  }
}
