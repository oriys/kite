import { generateText, stepCountIs } from 'ai'
import {
  resolveAiModelSelection,
  resolveWorkspaceAiProviders,
  createLanguageModel,
} from '@/lib/ai-server'
import { retrieveWorkspaceRagContext } from '@/lib/ai-chat'
import { getDocumentByIdentifier } from '@/lib/queries/documents'
import { getAiWorkspaceSettings } from '@/lib/queries/ai'
import {
  DOC_AGENT_DEFAULT_MAX_STEPS,
  DOC_AGENT_DEFAULT_TEMPERATURE,
} from './config'
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
  temperature?: number
  onStep?: (step: AgentStepRecord) => void
  signal?: AbortSignal
}

export interface AgentRunResult {
  steps: AgentStepRecord[]
  result: string
  modelId: string
  modelRef: string
}

// ─── Engine ──────────────────────────────────────────────────

export async function runAgent(options: AgentRunOptions): Promise<AgentRunResult> {
  const {
    workspaceId,
    userId,
    prompt,
    documentId,
    maxSteps = DOC_AGENT_DEFAULT_MAX_STEPS,
    temperature = DOC_AGENT_DEFAULT_TEMPERATURE,
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
  const toolCtx: AgentToolContext = { workspaceId, userId, documentId }
  const tools = createAgentTools(toolCtx)

  // 3. Build system prompt — fetch current document + KB context up front
  const [document, knowledgeResult] = await Promise.all([
    documentId ? getDocumentByIdentifier(documentId, workspaceId) : Promise.resolve(null),
    retrieveWorkspaceRagContext({
      workspaceId,
      query: prompt,
      documentId,
      debug: false,
    }),
  ])

  const documentContext = document
    ? `Working on: **${document.title}** (${document.slug ?? document.id})\n\nCurrent content:\n${(typeof document.content === 'string' ? document.content : '(empty)').slice(0, 4000)}`
    : undefined
  const knowledgeContext = knowledgeResult.contextText.trim()
    ? knowledgeResult.contextText
    : undefined

  const systemPrompt = buildAgentSystemPrompt({
    documentContext,
    knowledgeContext,
  })

  // 4. Run the agent loop
  const model = createLanguageModel(selection.provider, selection.modelId)
  const steps: AgentStepRecord[] = []

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: prompt },
  ]

  let stepIndex = 0

  console.log(
    `[agent] Starting generateText with ${Object.keys(tools).length} tools, maxSteps=${maxSteps}, temperature=${temperature}`,
  )

  const result = await generateText({
    model,
    system: systemPrompt,
    messages,
    tools,
    stopWhen: stepCountIs(maxSteps),
    temperature,
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
    modelRef: selection.modelRef,
  }
}
