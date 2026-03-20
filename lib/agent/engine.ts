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
import {
  createInitialAgentConversation,
  parseAgentConversation,
  type AgentConversationMessage,
} from './conversation'
import {
  buildAgentInteractionFromToolCall,
  isAgentInteractiveToolName,
} from './interactive-tools'
import { createAgentTools, type AgentToolContext } from './tools'
import { buildAgentSystemPrompt } from './prompts'
import type { AgentStepRecord } from '@/lib/schema-agent'
import type { AgentInteraction, AgentInteractiveToolName } from './shared'

// ─── Public types ────────────────────────────────────────────

export interface AgentRunOptions {
  workspaceId: string
  userId: string
  prompt: string
  taskId?: string
  documentId?: string
  modelId?: string
  maxSteps?: number
  temperature?: number
  conversation?: AgentConversationMessage[]
  initialStepIndex?: number
  onStep?: (step: AgentStepRecord) => void
  signal?: AbortSignal
}

type AgentRunBaseResult = {
  modelId: string
  modelRef: string
  conversation: AgentConversationMessage[]
  nextStepIndex: number
}

export type AgentRunResult =
  | (AgentRunBaseResult & {
      status: 'completed'
      result: string
    })
  | (AgentRunBaseResult & {
      status: 'waiting_for_input'
      interaction: AgentInteraction
    })

function getPendingInteractiveCallFromResult(
  result: unknown,
) {
  const steps = Array.isArray((result as { steps?: unknown }).steps)
    ? (result as { steps: unknown[] }).steps
    : []
  const lastStep = steps.at(-1)
  if (!lastStep || typeof lastStep !== 'object') return null

  const toolCalls = Array.isArray((lastStep as { toolCalls?: unknown }).toolCalls)
    ? (lastStep as {
        toolCalls: Array<{
          toolName?: unknown
          toolCallId?: unknown
          input?: unknown
        }>
      }).toolCalls
    : []
  const toolResults = Array.isArray((lastStep as { toolResults?: unknown }).toolResults)
    ? (lastStep as {
        toolResults: Array<{
          toolCallId?: unknown
        }>
      }).toolResults
    : []

  const pendingCalls = toolCalls.filter((toolCall) =>
    typeof toolCall.toolName === 'string'
    && typeof toolCall.toolCallId === 'string'
    && isAgentInteractiveToolName(toolCall.toolName)
    && !toolResults.some((toolResult) => toolResult.toolCallId === toolCall.toolCallId),
  )

  if (pendingCalls.length === 0) {
    return null
  }

  if (pendingCalls.length > 1) {
    throw new Error('Doc Agent can only request one user interaction at a time.')
  }

  const pendingCall = pendingCalls[0]!
  if (
    typeof pendingCall.toolName !== 'string'
    || typeof pendingCall.toolCallId !== 'string'
  ) {
    return null
  }

  return {
    toolName: pendingCall.toolName as AgentInteractiveToolName,
    toolCallId: pendingCall.toolCallId,
    input: pendingCall.input,
  }
}

// ─── Engine ──────────────────────────────────────────────────

export async function runAgent(options: AgentRunOptions): Promise<AgentRunResult> {
  const {
    workspaceId,
    userId,
    prompt,
    taskId,
    documentId,
    maxSteps = DOC_AGENT_DEFAULT_MAX_STEPS,
    temperature = DOC_AGENT_DEFAULT_TEMPERATURE,
    conversation = createInitialAgentConversation(prompt),
    initialStepIndex = 0,
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
  const toolCtx: AgentToolContext = { workspaceId, userId, taskId, documentId }
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
  let stepIndex = initialStepIndex

  console.log(
    `[agent] Starting generateText with ${Object.keys(tools).length} tools, maxSteps=${maxSteps}, temperature=${temperature}`,
  )

  const result = await generateText({
    model,
    system: systemPrompt,
    messages: conversation,
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
            ? tcList.filter(Boolean).map((tc) => {
                const call = tc!
                return {
                  name: call.toolName,
                  args: ('args' in call ? call.args : (call as Record<string, unknown>).input) as Record<string, unknown>,
                }
              })
            : undefined,
          text: event.text || undefined,
        }

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

  const conversationResult = parseAgentConversation([
    ...conversation,
    ...result.response.messages,
  ])
  if (!conversationResult.success) {
    throw new Error(`Invalid agent conversation state: ${conversationResult.error}`)
  }

  const nextConversation = conversationResult.data
  const pendingInteractiveCall = getPendingInteractiveCallFromResult(result)

  if (pendingInteractiveCall) {
    const interaction = buildAgentInteractionFromToolCall(
      pendingInteractiveCall.toolName,
      pendingInteractiveCall.input,
      pendingInteractiveCall.toolCallId,
    )
    if (!interaction.success) {
      throw new Error(`Invalid interactive tool request: ${interaction.error}`)
    }

    return {
      status: 'waiting_for_input',
      interaction: interaction.data,
      modelId: selection.modelId,
      modelRef: selection.modelRef,
      conversation: nextConversation,
      nextStepIndex: stepIndex,
    }
  }

  const finalText = result.text || '(Agent completed without a final response)'

  if (
    steps.length === 0
    || steps[steps.length - 1].type !== 'response'
    || !steps[steps.length - 1].text
  ) {
    const responseStep: AgentStepRecord = {
      index: stepIndex++,
      type: 'response',
      text: finalText,
    }
    steps.push(responseStep)
    onStep?.(responseStep)
  }

  return {
    status: 'completed',
    result: finalText,
    modelId: selection.modelId,
    modelRef: selection.modelRef,
    conversation: nextConversation,
    nextStepIndex: stepIndex,
  }
}
