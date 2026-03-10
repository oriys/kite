export type DocSnippetCategory = 'Structure' | 'Writing' | 'Data' | 'API'

export interface DocSnippet {
  id: string
  label: string
  description: string
  category: DocSnippetCategory
  keywords: string[]
  template: string
}

export const DOC_SNIPPET_CATEGORIES: readonly DocSnippetCategory[] = [
  'Structure',
  'Writing',
  'Data',
  'API',
]

export const DOC_SNIPPETS: readonly DocSnippet[] = [
  {
    id: 'section-intro',
    label: 'Section Intro',
    description: 'Add a clean section opener with summary copy and supporting bullets.',
    category: 'Structure',
    keywords: ['section', 'intro', 'summary', 'overview', 'layout'],
    template: `## Section Title

One sentence that frames why this section matters and what the reader should expect.

- Key point or dependency
- Supporting detail or rollout note
- Link to a system, team, or implementation owner`,
  },
  {
    id: 'release-notes',
    label: 'Release Notes',
    description: 'Capture added, changed, and next steps in a compact changelog block.',
    category: 'Structure',
    keywords: ['release', 'notes', 'changelog', 'updates', 'ship'],
    template: `## Release Notes

- **Added:** Describe the new capability or surface area.
- **Changed:** Call out migrations, behavior changes, or UI shifts.
- **Next:** Note the follow-up work, rollout guardrails, or open questions.`,
  },
  {
    id: 'executive-summary',
    label: 'Executive Summary',
    description: 'Open with outcomes, risks, and owner context for fast stakeholder review.',
    category: 'Structure',
    keywords: ['summary', 'executive', 'stakeholder', 'outcomes', 'brief'],
    template: `## Executive Summary

- **Outcome:** Summarize the change or decision in one line.
- **Impact:** Explain who is affected and what improves.
- **Risk:** Call out the main dependency or unknown.
- **Owner:** Name the team or decision-maker accountable for follow-through.`,
  },
  {
    id: 'decision-record',
    label: 'Decision Record',
    description: 'Document context, chosen direction, and consequences in ADR style.',
    category: 'Structure',
    keywords: ['decision', 'adr', 'record', 'architecture', 'tradeoff'],
    template: `## Decision Record

### Context
Describe the problem, constraints, and the options considered.

### Decision
State the chosen direction clearly and why it won.

### Consequences
- Positive outcome or simplification
- Cost, migration, or operational impact
- Follow-up work required before full rollout`,
  },
  {
    id: 'rollout-plan',
    label: 'Rollout Plan',
    description: 'Stage a release with milestones, owners, and success criteria.',
    category: 'Structure',
    keywords: ['rollout', 'plan', 'launch', 'timeline', 'milestone'],
    template: `## Rollout Plan

| Phase | Owner | Success criteria |
| --- | --- | --- |
| Internal preview | Platform team | Core flows validated in staging |
| Limited beta | Product ops | No blocking issues from early adopters |
| General availability | Engineering + Support | Monitoring stable and docs published |`,
  },
  {
    id: 'callout-note',
    label: 'Callout Note',
    description: 'Insert an editorial note for caveats, policy, or rollout guidance.',
    category: 'Writing',
    keywords: ['callout', 'note', 'warning', 'tip', 'blockquote'],
    template: `> **Note**
> Add context, caveats, or reviewer guidance here so readers do not miss it.`,
  },
  {
    id: 'implementation-steps',
    label: 'Implementation Steps',
    description: 'Lay out a multi-step flow for setup, migration, or review.',
    category: 'Writing',
    keywords: ['steps', 'how-to', 'setup', 'guide', 'numbered'],
    template: `## Implementation Steps

1. Set up the base configuration and required access.
2. Connect the relevant systems or dependencies.
3. Validate the happy path with a representative example.
4. Roll out gradually and capture follow-up actions.`,
  },
  {
    id: 'faq',
    label: 'FAQ',
    description: 'Create a reader-friendly question and answer section.',
    category: 'Writing',
    keywords: ['faq', 'questions', 'answers', 'help', 'support'],
    template: `## FAQ

### Can teams draft before the schema is final?
Yes. Use placeholder values for pending fields and clearly mark them for review.

### How should changes be reviewed?
Move the document to review, compare the latest revision, and verify examples before publishing.`,
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
    description: 'List common failures, likely causes, and corrective actions.',
    category: 'Writing',
    keywords: ['troubleshooting', 'debug', 'issues', 'failures', 'support'],
    template: `## Troubleshooting

### The request returns 401
- Confirm the token is active and scoped for this workspace.
- Verify the request includes the expected authorization header.

### The payload is rejected
- Check required fields and enum values.
- Validate the JSON body against the latest schema example.`,
  },
  {
    id: 'best-practices',
    label: 'Best Practices',
    description: 'Capture guardrails, conventions, and implementation advice.',
    category: 'Writing',
    keywords: ['best practices', 'guidelines', 'recommendations', 'guardrails'],
    template: `## Best Practices

- Prefer stable identifiers over display names in API payloads.
- Keep examples copy-ready and aligned with the current production schema.
- Document failure modes, not just the happy path.
- Link every advanced flow to the primary ownership team.`,
  },
  {
    id: 'glossary',
    label: 'Glossary',
    description: 'Define domain terms and reduce ambiguity for readers.',
    category: 'Writing',
    keywords: ['glossary', 'terms', 'definitions', 'language', 'reference'],
    template: `## Glossary

| Term | Meaning |
| --- | --- |
| Workspace | A logical boundary for teams, settings, and document ownership |
| Revision | A saved snapshot of document content before a change |
| Publish gate | The checks required before a document can go live |`,
  },
  {
    id: 'comparison-table',
    label: 'Comparison Table',
    description: 'Insert a structured table for plan tiers, options, or tradeoffs.',
    category: 'Data',
    keywords: ['table', 'comparison', 'matrix', 'plans', 'tradeoff'],
    template: `## Comparison Table

| Option | Best for | Tradeoff |
| --- | --- | --- |
| Starter | Small internal teams | Fewer automation hooks |
| Growth | Operational documentation | Requires baseline workflow setup |
| Enterprise | Multi-workspace governance | Higher coordination overhead |`,
  },
  {
    id: 'code-example',
    label: 'Code Example',
    description: 'Drop in a fenced code sample for SDK or implementation docs.',
    category: 'Data',
    keywords: ['code', 'example', 'snippet', 'sdk', 'typescript'],
    template: `## Example

\`\`\`ts
export async function createDocument() {
  return fetch('/api/documents', {
    method: 'POST',
  })
}
\`\`\``,
  },
  {
    id: 'terminal-command',
    label: 'Terminal Command',
    description: 'Insert a CLI example block for setup, debugging, or deployment.',
    category: 'Data',
    keywords: ['terminal', 'cli', 'command', 'shell', 'bash'],
    template: `## Terminal Command

\`\`\`bash
curl -X POST https://api.example.com/v1/documents \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Quarterly planning brief"}'
\`\`\``,
  },
  {
    id: 'sql-query',
    label: 'SQL Query',
    description: 'Drop in a database query block for audits, analytics, or migrations.',
    category: 'Data',
    keywords: ['sql', 'query', 'database', 'analytics', 'migration'],
    template: `## SQL Query

\`\`\`sql
select id, title, status, updated_at
from documents
where status = 'review'
order by updated_at desc
limit 20;
\`\`\``,
  },
  {
    id: 'json-payload',
    label: 'JSON Payload',
    description: 'Add a payload or response block with ready-to-edit sample data.',
    category: 'Data',
    keywords: ['json', 'payload', 'response', 'sample', 'schema'],
    template: `## JSON Payload

\`\`\`json
{
  "id": "doc_123",
  "status": "draft",
  "title": "Quarterly planning brief"
}
\`\`\``,
  },
  {
    id: 'image-figure',
    label: 'Image Figure',
    description: 'Insert an image block with a caption placeholder for diagrams.',
    category: 'Data',
    keywords: ['image', 'figure', 'diagram', 'screenshot', 'media'],
    template: `## Figure

![Architecture overview](https://placehold.co/1200x700?text=Diagram)

_Optional caption explaining what readers should notice in this visual._`,
  },
  {
    id: 'metrics-table',
    label: 'Metrics Table',
    description: 'Track KPIs, thresholds, and current status in one block.',
    category: 'Data',
    keywords: ['metrics', 'kpi', 'sla', 'tracking', 'status'],
    template: `## Metrics Table

| Metric | Target | Current |
| --- | --- | --- |
| Publish success rate | 99.9% | 99.96% |
| Median review time | < 4h | 2.8h |
| Docs freshness SLA | < 7d | 5d |`,
  },
  {
    id: 'file-tree',
    label: 'File Tree',
    description: 'Sketch project structure or generated output paths.',
    category: 'Data',
    keywords: ['file tree', 'folders', 'project structure', 'paths'],
    template: `## File Tree

\`\`\`text
app/
  docs/
    editor/
      page.tsx
components/
  docs/
    doc-editor.tsx
lib/
  doc-snippets.ts
\`\`\``,
  },
  {
    id: 'api-endpoint',
    label: 'API Endpoint',
    description: 'Scaffold an endpoint section with method, request body, and response.',
    category: 'API',
    keywords: ['api', 'endpoint', 'rest', 'request', 'response'],
    template: `## API Endpoint

### \`POST /v1/documents\`

Create a new document and return the persisted node.

### Request body

\`\`\`json
{
  "title": "Quarterly planning brief",
  "status": "draft"
}
\`\`\`

### Response

\`\`\`json
{
  "id": "doc_123",
  "status": "draft"
}
\`\`\``,
  },
  {
    id: 'http-request',
    label: 'HTTP Request',
    description: 'Describe method, URL, headers, and query parameters together.',
    category: 'API',
    keywords: ['http', 'request', 'headers', 'query', 'curl'],
    template: `## HTTP Request

### \`GET /v1/documents/{id}\`

| Part | Value |
| --- | --- |
| Authorization | \`Bearer sk_live_...\` |
| Query | \`include=owner,versions\` |
| Timeout | \`10s\` |

Returns a single document with owner and revision metadata.`,
  },
  {
    id: 'authentication',
    label: 'Authentication',
    description: 'Document auth scheme, token scope, and verification rules.',
    category: 'API',
    keywords: ['auth', 'authentication', 'token', 'bearer', 'security'],
    template: `## Authentication

All API requests must include a bearer token scoped to the target workspace.

### Required header

\`\`\`http
Authorization: Bearer sk_live_xxxxx
\`\`\`

### Verification rules
- Tokens must be active and not expired.
- Workspace-scoped endpoints reject cross-workspace credentials.
- Rotate leaked tokens immediately and audit recent requests.`,
  },
  {
    id: 'error-response',
    label: 'Error Response',
    description: 'Capture failure codes, user-facing meaning, and remediation.',
    category: 'API',
    keywords: ['error', 'response', 'status code', 'failure', 'handling'],
    template: `## Error Response

| Status | Meaning | What to do |
| --- | --- | --- |
| 400 | Invalid request body | Validate required fields and enum values |
| 401 | Authentication failed | Refresh or replace the API token |
| 429 | Rate limit exceeded | Back off and retry with jitter |`,
  },
  {
    id: 'rate-limits',
    label: 'Rate Limits',
    description: 'Describe request ceilings, burst windows, and retry behavior.',
    category: 'API',
    keywords: ['rate limits', 'throttle', 'quota', 'retry', 'backoff'],
    template: `## Rate Limits

| Limit | Window | Notes |
| --- | --- | --- |
| 120 requests | 1 minute | Default per workspace |
| 10 publish actions | 1 minute | Protects downstream indexing |

When the limit is exceeded, the API returns \`429 Too Many Requests\` with retry guidance in response headers.`,
  },
  {
    id: 'webhook-event',
    label: 'Webhook Event',
    description: 'Document an event name, delivery headers, and payload shape.',
    category: 'API',
    keywords: ['webhook', 'event', 'headers', 'payload', 'delivery'],
    template: `## Webhook Event

### \`document.published\`

Triggered when a document moves from review to published.

**Delivery headers**

| Header | Value |
| --- | --- |
| \`X-Signature\` | \`v1=...\` |
| \`X-Workspace-ID\` | \`ws_2048\` |

**Payload**

\`\`\`json
{
  "type": "document.published",
  "data": {
    "id": "doc_123"
  }
}
\`\`\``,
  },
  {
    id: 'graphql-operation',
    label: 'GraphQL Operation',
    description: 'Add a mutation or query example with variables and response shape.',
    category: 'API',
    keywords: ['graphql', 'query', 'mutation', 'variables', 'schema'],
    template: `## GraphQL Operation

\`\`\`graphql
mutation PublishDocument($id: ID!) {
  publishDocument(id: $id) {
    id
    status
    updatedAt
  }
}
\`\`\`

\`\`\`json
{
  "id": "doc_123"
}
\`\`\``,
  },
]

export function getDocSnippetSearchValue(snippet: DocSnippet): string {
  return [snippet.label, snippet.description, snippet.category, ...snippet.keywords].join(' ')
}
