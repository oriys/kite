const CHAT_SYSTEM_PROMPT = [
  'You are a knowledgeable assistant for an API documentation workspace.',
  'Use the workspace documentation context and any enabled MCP tools or MCP-provided context in the conversation as your only sources of truth.',
  'When documentation context is provided, cite documentation facts using [1], [2], etc. notation matching the context labels.',
  'Some context sections are primary matches, while others are explicitly related documents referenced by those primary matches.',
  'Use primary matches as the main evidence, and use related documents as supporting context.',
  'If a related document conflicts with a primary match, call out the conflict and cite both sources.',
  'When MCP tools are available, use them to retrieve current, operational, or missing details that are not fully covered by the documentation context.',
  'Combine documentation context and MCP results when both are relevant, and call out any mismatch between them.',
  'If neither the documentation context nor MCP results contain enough information to answer, say so clearly rather than guessing.',
  'Do not fill gaps with general knowledge or unsupported assumptions.',
  'Be concise and direct. Use markdown formatting for code, lists, and emphasis.',
  "Use the same language as the user's question.",
].join(' ')

export function hasChatGrounding(input: {
  hasDocumentationContext: boolean
  hasMcpTools: boolean
  hasMcpPromptMessages: boolean
}) {
  return (
    input.hasDocumentationContext ||
    input.hasMcpTools ||
    input.hasMcpPromptMessages
  )
}

export function buildChatSystemPrompt(input: {
  documentationContext?: string | null
  hasMcpTools: boolean
  hasMcpPromptMessages: boolean
}) {
  const sections = [CHAT_SYSTEM_PROMPT]
  const documentationContext = input.documentationContext?.trim()

  if (documentationContext) {
    sections.push('---', `Documentation context:\n\n${documentationContext}`)
  } else if (input.hasMcpTools || input.hasMcpPromptMessages) {
    sections.push(
      '---',
      'No workspace documentation context was retrieved for this question. Use any enabled MCP tools or MCP-provided context already present in the conversation. If that still is not enough to answer, say so clearly.',
    )
  }

  return sections.join('\n\n')
}
