import { escapeHtml } from '@/lib/utils'

export interface CodeLanguageOption {
  value: string
  label: string
  hint: string
  sample: string
}

export interface HighlightSegment {
  text: string
  className?: string
}

interface TokenRule {
  pattern: RegExp
  className: string
}

const tokenPatterns: Record<string, TokenRule[]> = {
  json: [
    { pattern: /"(?:\\.|[^"\\])*"(?=\s*:)/g, className: 'doc-code-attribute' },
    { pattern: /"(?:\\.|[^"\\])*"/g, className: 'doc-code-string' },
    { pattern: /\b(true|false|null)\b/g, className: 'doc-code-constant' },
    { pattern: /\b-?\d+\.?\d*(?:[eE][+-]?\d+)?\b/g, className: 'doc-code-number' },
  ],
  bash: [
    { pattern: /#.*/g, className: 'doc-code-comment' },
    { pattern: /"(?:\\.|[^"\\])*"/g, className: 'doc-code-string' },
    { pattern: /'(?:\\.|[^'\\])*'/g, className: 'doc-code-string' },
    { pattern: /\$[A-Z_][A-Z0-9_]*/g, className: 'doc-code-variable' },
    {
      pattern: /\b(curl|wget|echo|export|if|then|else|fi|for|do|done|while|cat|grep|jq)\b/g,
      className: 'doc-code-keyword',
    },
    { pattern: /\s(-[A-Za-z]|\-\-[A-Za-z-]+)/g, className: 'doc-code-type' },
    { pattern: /https?:\/\/[^\s"'\\]+/g, className: 'doc-code-url' },
  ],
  javascript: [
    { pattern: /\/\/.*|\/\*[\s\S]*?\*\//g, className: 'doc-code-comment' },
    {
      pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g,
      className: 'doc-code-string',
    },
    {
      pattern:
        /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default|async|await|new|this|typeof|instanceof|throw|try|catch|finally|extends|implements|interface|type)\b/g,
      className: 'doc-code-keyword',
    },
    { pattern: /\b(true|false|null|undefined)\b/g, className: 'doc-code-constant' },
    { pattern: /\b-?\d+\.?\d*(?:[eE][+-]?\d+)?\b/g, className: 'doc-code-number' },
    { pattern: /@\w+/g, className: 'doc-code-variable' },
  ],
  graphql: [
    { pattern: /#.*/g, className: 'doc-code-comment' },
    { pattern: /"(?:\\.|[^"\\])*"/g, className: 'doc-code-string' },
    {
      pattern:
        /\b(query|mutation|subscription|fragment|type|input|enum|interface|union|scalar|schema|extend|on|implements)\b/g,
      className: 'doc-code-keyword',
    },
    { pattern: /\b(String|Int|Float|Boolean|ID|DateTime)\b!?/g, className: 'doc-code-type' },
    { pattern: /\$\w+/g, className: 'doc-code-variable' },
    { pattern: /@\w+/g, className: 'doc-code-attribute' },
  ],
  sql: [
    { pattern: /--.*|\/\*[\s\S]*?\*\//g, className: 'doc-code-comment' },
    { pattern: /'(?:''|[^'])*'/g, className: 'doc-code-string' },
    {
      pattern:
        /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|AND|OR|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|GROUP|ORDER|BY|LIMIT|VALUES|INTO|CREATE|ALTER|DROP|TABLE|VIEW|INDEX|PRIMARY|KEY|FOREIGN|NOT|NULL|TRUE|FALSE)\b/gi,
      className: 'doc-code-keyword',
    },
    { pattern: /\b(COUNT|SUM|AVG|MIN|MAX)\b/gi, className: 'doc-code-type' },
    { pattern: /\b-?\d+\.?\d*(?:[eE][+-]?\d+)?\b/g, className: 'doc-code-number' },
  ],
  http: [
    { pattern: /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/gm, className: 'doc-code-keyword' },
    { pattern: /^[A-Za-z-]+(?=:\s)/gm, className: 'doc-code-attribute' },
    { pattern: /\b(200|201|204|400|401|403|404|422|500|502|503)\b/g, className: 'doc-code-number' },
    { pattern: /https?:\/\/[^\s"'\\]+/g, className: 'doc-code-url' },
    { pattern: /"(?:\\.|[^"\\])*"/g, className: 'doc-code-string' },
  ],
  yaml: [
    { pattern: /#.*/g, className: 'doc-code-comment' },
    { pattern: /^\s*[\w-]+(?=:\s)/gm, className: 'doc-code-attribute' },
    { pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, className: 'doc-code-string' },
    { pattern: /\b(true|false|null)\b/g, className: 'doc-code-constant' },
    { pattern: /\b-?\d+\.?\d*(?:[eE][+-]?\d+)?\b/g, className: 'doc-code-number' },
  ],
}

tokenPatterns.typescript = tokenPatterns.javascript
tokenPatterns.jsx = tokenPatterns.javascript
tokenPatterns.tsx = tokenPatterns.javascript

tokenPatterns.python = [
  { pattern: /#.*/g, className: 'doc-code-comment' },
  { pattern: /"""[\s\S]*?"""|'''[\s\S]*?'''/g, className: 'doc-code-string' },
  { pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, className: 'doc-code-string' },
  {
    pattern:
      /\b(import|from|def|class|return|if|elif|else|for|while|with|as|try|except|finally|raise|pass|break|continue|and|or|not|in|is|lambda|yield|async|await)\b/g,
    className: 'doc-code-keyword',
  },
  { pattern: /\b(True|False|None)\b/g, className: 'doc-code-constant' },
  { pattern: /\b-?\d+\.?\d*(?:[eE][+-]?\d+)?\b/g, className: 'doc-code-number' },
  { pattern: /\b(print|len|range|str|int|float|list|dict|set|tuple|type|isinstance)\b/g, className: 'doc-code-type' },
]

tokenPatterns.go = [
  { pattern: /\/\/.*|\/\*[\s\S]*?\*\//g, className: 'doc-code-comment' },
  { pattern: /"(?:\\.|[^"\\])*"|`[^`]*`/g, className: 'doc-code-string' },
  {
    pattern:
      /\b(package|import|func|return|if|else|for|range|switch|case|default|break|continue|go|defer|select|chan|map|struct|interface|type|var|const)\b/g,
    className: 'doc-code-keyword',
  },
  { pattern: /\b(true|false|nil|iota)\b/g, className: 'doc-code-constant' },
  { pattern: /\b-?\d+\.?\d*(?:[eE][+-]?\d+)?\b/g, className: 'doc-code-number' },
  { pattern: /\b(string|int|int64|float64|bool|byte|error|any)\b/g, className: 'doc-code-type' },
]

export const CODE_LANGUAGE_OPTIONS: CodeLanguageOption[] = [
  { value: 'text', label: 'Plain Text', hint: 'txt', sample: 'code' },
  { value: 'bash', label: 'Bash', hint: 'sh', sample: 'echo "hello"' },
  { value: 'json', label: 'JSON', hint: 'json', sample: '{\n  "key": "value"\n}' },
  {
    value: 'typescript',
    label: 'TypeScript',
    hint: 'ts',
    sample: 'type Result = {\n  ok: boolean\n}',
  },
  {
    value: 'javascript',
    label: 'JavaScript',
    hint: 'js',
    sample: 'const answer = 42',
  },
  { value: 'tsx', label: 'TSX', hint: 'tsx', sample: '<Button variant="outline">Run</Button>' },
  { value: 'jsx', label: 'JSX', hint: 'jsx', sample: '<button className="button">Run</button>' },
  {
    value: 'graphql',
    label: 'GraphQL',
    hint: 'gql',
    sample: 'query Viewer {\n  viewer {\n    id\n  }\n}',
  },
  {
    value: 'sql',
    label: 'SQL',
    hint: 'sql',
    sample: 'SELECT *\nFROM documents\nWHERE id = 1;',
  },
  {
    value: 'http',
    label: 'HTTP',
    hint: 'http',
    sample: 'POST /v1/documents HTTP/1.1\nContent-Type: application/json',
  },
  {
    value: 'yaml',
    label: 'YAML',
    hint: 'yml',
    sample: 'title: Example\nstatus: draft',
  },
]

const languageAliases = new Map<string, string>(
  CODE_LANGUAGE_OPTIONS.flatMap((option) => [
    [option.value, option.value],
    [option.hint, option.value],
  ]),
)

languageAliases.set('plaintext', 'text')
languageAliases.set('txt', 'text')
languageAliases.set('shell', 'bash')
languageAliases.set('sh', 'bash')
languageAliases.set('zsh', 'bash')
languageAliases.set('js', 'javascript')
languageAliases.set('mjs', 'javascript')
languageAliases.set('cjs', 'javascript')
languageAliases.set('ts', 'typescript')
languageAliases.set('gql', 'graphql')
languageAliases.set('yml', 'yaml')

export function normalizeCodeLanguage(language?: string | null): string {
  if (!language) return 'text'

  const normalized = language.trim().toLowerCase()
  if (!normalized) return 'text'
  if (normalized === 'application/json' || normalized.endsWith('+json')) {
    return 'json'
  }

  return languageAliases.get(normalized) ?? normalized
}

export function getCodeLanguageOption(language?: string | null): CodeLanguageOption | undefined {
  const normalized = normalizeCodeLanguage(language)
  return CODE_LANGUAGE_OPTIONS.find((option) => option.value === normalized)
}

export function getCodeLanguageLabel(language?: string | null): string {
  const normalized = normalizeCodeLanguage(language)
  const option = CODE_LANGUAGE_OPTIONS.find((o) => o.value === normalized)
  if (option) return option.label
  return normalized === 'text' ? 'Plain Text' : normalized.toUpperCase()
}

export function getCodeLanguageSample(language?: string | null): string {
  return getCodeLanguageOption(language)?.sample ?? 'code'
}

export function highlightCodeSegments(code: string, language?: string | null): HighlightSegment[] {
  const normalized = normalizeCodeLanguage(language)
  const patterns = tokenPatterns[normalized]

  if (!patterns) {
    return [{ text: code }]
  }

  type Span = {
    start: number
    end: number
    className: string
    text: string
  }

  const spans: Span[] = []

  for (const { pattern, className } of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match: RegExpExecArray | null

    while ((match = regex.exec(code)) !== null) {
      if (!match[0]) {
        regex.lastIndex += 1
        continue
      }

      const start = match.index
      const end = start + match[0].length
      const overlaps = spans.some((span) => start < span.end && end > span.start)

      if (!overlaps) {
        spans.push({
          start,
          end,
          className,
          text: match[0],
        })
      }
    }
  }

  spans.sort((a, b) => a.start - b.start)

  const segments: HighlightSegment[] = []
  let cursor = 0

  for (const span of spans) {
    if (cursor < span.start) {
      segments.push({ text: code.slice(cursor, span.start) })
    }

    segments.push({
      text: span.text,
      className: span.className,
    })
    cursor = span.end
  }

  if (cursor < code.length) {
    segments.push({ text: code.slice(cursor) })
  }

  return segments.length > 0 ? segments : [{ text: code }]
}

export function renderHighlightedCodeHtml(code: string, language?: string | null): string {
  return highlightCodeSegments(code, language)
    .map((segment) =>
      segment.className
        ? `<span class="${segment.className}">${escapeHtml(segment.text)}</span>`
        : escapeHtml(segment.text),
    )
    .join('')
}
