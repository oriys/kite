import {
  AI_TRANSFORM_ACTIONS,
  MAX_AI_MODEL_ID_LENGTH,
  type AiTransformAction,
} from '@/lib/ai'
import {
  AI_DIAGRAM_ANALYSIS_CLOSE_MARKER,
  AI_DIAGRAM_ANALYSIS_OPEN_MARKER,
  AI_DIAGRAM_CHART_CLOSE_MARKER,
  AI_DIAGRAM_CHART_OPEN_MARKER,
} from '@/lib/ai-diagram'

export const AI_PROMPTS_STORAGE_KEY = 'editorial-ai-prompt-settings'
export const AI_PROMPTS_EVENT = 'editorial-ai-prompt-settings:change'
export const AI_PROMPT_LANGUAGE_TOKEN = '{{targetLanguage}}'
export const MAX_AI_SYSTEM_PROMPT_LENGTH = 4_000
export const MAX_AI_ACTION_PROMPT_LENGTH = 2_000

export interface AiPromptSettings {
  systemPrompt: string
  actionPrompts: Record<AiTransformAction, string>
  actionModelIds: Record<AiTransformAction, string>
}

export const DEFAULT_AI_SYSTEM_PROMPT =
  'You are an expert editor inside a document workspace. Return only the requested output with no preamble, no surrounding quotes, and no commentary. Preserve markdown, lists, inline code, code fences, URLs, numbers, and proper nouns whenever possible.'

export const DEFAULT_AI_ACTION_PROMPTS: Record<AiTransformAction, string> = {
  polish:
    'Improve clarity, fluency, and tone while preserving the original meaning, structure, and terminology.',
  autofix:
    'Fix spelling, grammar, punctuation, markdown formatting, and obvious formatting inconsistencies only. Do not change meaning, tone, terminology, factual content, or document structure beyond what is required to correct errors.',
  format:
    'Correct invalid or inconsistent Markdown syntax and reshape the existing content into the most appropriate Markdown structure for what is already there. Fix heading markers, heading hierarchy implied by the source, list markers and indentation, blockquotes, fenced code blocks, tables, horizontal rules, escaping, spacing around Markdown tokens, and required blank lines. When the content is plain text or poorly structured, convert it into suitable Markdown sections, lists, tables, code fences, or blockquotes only when justified by the existing content. Preserve every word, sentence, fact, ordering, and meaning unless a formatting correction requires different line breaks or Markdown wrappers. Do not rewrite, summarize, expand, shorten, translate, or change tone. Return the full corrected Markdown document only.',
  shorten:
    'Make the text materially shorter by removing redundancy while preserving the key meaning, structure, and important details.',
  expand:
    'Expand the text with useful clarification and supporting detail, but do not invent facts or claims that are not grounded in the original.',
  translate: `Translate the text into ${AI_PROMPT_LANGUAGE_TOKEN} while preserving markdown, code, URLs, numbers, and product names.`,
  explain:
    'Explain the text in plain language. If the text is technical, clarify what it means, what it does, and why it matters.',
  diagram: [
    'Return exactly two sections in this exact order using the exact markers below.',
    `${AI_DIAGRAM_ANALYSIS_OPEN_MARKER}`,
    'Write concise markdown analysis, background, explanation, and derivation outside the chart. Keep it brief and useful.',
    `${AI_DIAGRAM_ANALYSIS_CLOSE_MARKER}`,
    `${AI_DIAGRAM_CHART_OPEN_MARKER}`,
    'Return standalone HTML for an embedded iframe preview.',
    'The chart itself may contain only labels, nodes, connectors, and necessary numbers.',
    'Do not place long explanations, derivations, legends, titles, subtitles, or poster-like copy inside the chart.',
    'Make the HTML self-contained with inline CSS and inline SVG only. No scripts, external assets, or remote fonts.',
    'The HTML must stream safely in natural top-to-bottom order: emit the shell and CSS first, then stable body markup, then SVG/body details.',
    'Use a seamless editorial style with flat surfaces and quiet neutrals. Explicitly forbid gradients, shadows, blur, glow, glass effects, decorative chrome, colorful backgrounds, animations, and strong brand styling.',
    'Support both light and dark color schemes with simple flat colors only.',
    `${AI_DIAGRAM_CHART_CLOSE_MARKER}`,
  ].join('\n'),
  review:
    'Review the document like a senior technical editor. Return a concise markdown report with these sections: Strengths, Gaps or Risks, and Recommended Fixes. Ground every point in the source text.',
  score:
    'Score the document in markdown across clarity, completeness, structure, consistency, and confidence in technical accuracy. Use a compact table, then end with a short verdict and the top next improvement.',
  summarize:
    'Write an executive summary in markdown. Focus on the purpose, the key takeaways, and the most important details a reviewer should know quickly.',
  outline:
    'Extract a clean hierarchical outline of the document in markdown list form. Preserve the actual structure and do not invent new sections.',
  checklist:
    'Turn the document into an actionable markdown checklist. Use task list items and keep every item concrete, specific, and grounded in the source text.',
  custom:
    "Follow the user's custom instruction exactly. Preserve markdown, code fences, URLs, and proper nouns unless the instruction explicitly asks you to change them.",
}

function normalizePrompt(
  value: unknown,
  fallback: string,
  maxLength: number,
) {
  const normalized = typeof value === 'string' ? value.trim() : ''

  if (!normalized) {
    return fallback
  }

  return normalized.slice(0, maxLength)
}

function normalizeModelId(value: unknown) {
  return typeof value === 'string'
    ? value.trim().slice(0, MAX_AI_MODEL_ID_LENGTH)
    : ''
}

export function createDefaultAiPromptSettings(): AiPromptSettings {
  return {
    systemPrompt: DEFAULT_AI_SYSTEM_PROMPT,
    actionPrompts: { ...DEFAULT_AI_ACTION_PROMPTS },
    actionModelIds: AI_TRANSFORM_ACTIONS.reduce(
      (acc, action) => {
        acc[action] = ''
        return acc
      },
      {} as Record<AiTransformAction, string>,
    ),
  }
}

export function sanitizeAiPromptSettings(
  raw: Partial<AiPromptSettings> | null | undefined,
): AiPromptSettings {
  const defaults = createDefaultAiPromptSettings()

  return {
    systemPrompt: normalizePrompt(
      raw?.systemPrompt,
      defaults.systemPrompt,
      MAX_AI_SYSTEM_PROMPT_LENGTH,
    ),
    actionPrompts: AI_TRANSFORM_ACTIONS.reduce(
      (acc, action) => {
        acc[action] = normalizePrompt(
          raw?.actionPrompts?.[action],
          defaults.actionPrompts[action],
          MAX_AI_ACTION_PROMPT_LENGTH,
        )
        return acc
      },
      {} as Record<AiTransformAction, string>,
    ),
    actionModelIds: AI_TRANSFORM_ACTIONS.reduce(
      (acc, action) => {
        acc[action] = normalizeModelId(raw?.actionModelIds?.[action])
        return acc
      },
      {} as Record<AiTransformAction, string>,
    ),
  }
}

export function resolveAiPromptTemplate(
  template: string,
  targetLanguage?: string,
) {
  return template.replaceAll(
    AI_PROMPT_LANGUAGE_TOKEN,
    targetLanguage?.trim() || 'the requested language',
  )
}

export function resolveAiActionPrompt(
  action: AiTransformAction,
  prompts: AiPromptSettings,
  targetLanguage?: string,
) {
  return resolveAiPromptTemplate(prompts.actionPrompts[action], targetLanguage)
}

export function resolveAiActionModel(
  action: AiTransformAction,
  prompts: AiPromptSettings,
  fallbackModelId: string | null,
  availableModelIds?: string[],
) {
  const configuredModelId = normalizeModelId(prompts.actionModelIds[action])

  if (!configuredModelId) {
    return fallbackModelId
  }

  if (availableModelIds && !availableModelIds.includes(configuredModelId)) {
    return fallbackModelId
  }

  return configuredModelId
}

export function countCustomizedAiPrompts(prompts: AiPromptSettings) {
  const defaults = createDefaultAiPromptSettings()
  let count = prompts.systemPrompt !== defaults.systemPrompt ? 1 : 0

  for (const action of AI_TRANSFORM_ACTIONS) {
    if (prompts.actionPrompts[action] !== defaults.actionPrompts[action]) {
      count += 1
    }

    if (prompts.actionModelIds[action] !== defaults.actionModelIds[action]) {
      count += 1
    }
  }

  return count
}
