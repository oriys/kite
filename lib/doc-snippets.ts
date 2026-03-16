import { createHeatmapSnippetTemplate } from './heatmap'

export type DocSnippetCategory = 'Structure' | 'Writing' | 'Data' | 'API'

export interface DocSnippet {
  id: string
  label: string
  description: string
  category: DocSnippetCategory
  keywords: string[]
  template: string
}

export type DocSnippetMutation = Omit<DocSnippet, 'id'>

export interface StoredDocSnippet extends DocSnippet {
  workspaceId: string
  sortOrder: number
  createdAt: string
  updatedAt: string
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
    id: 'status-snapshot',
    label: 'Status Snapshot',
    description: 'Summarize owner, phase, risk level, and next checkpoint in one glance.',
    category: 'Structure',
    keywords: ['status', 'snapshot', 'owner', 'risk', 'summary'],
    template: `## Status Snapshot

| Area | Current state |
| --- | --- |
| Owner | Platform docs team |
| Phase | Internal review |
| Risk | Medium: migration validation still open |
| Next checkpoint | Thursday rollout review |`,
  },
  {
    id: 'launch-checklist',
    label: 'Launch Checklist',
    description: 'Track final readiness tasks before a publish, release, or cutover.',
    category: 'Structure',
    keywords: ['launch', 'checklist', 'release', 'readiness', 'go-live'],
    template: `## Launch Checklist

- [ ] Final copy reviewed by document owner
- [ ] Examples validated against production behavior
- [ ] Monitoring and alerts confirmed
- [ ] Support team briefed on rollout notes
- [ ] Publish gate approved`,
  },
  {
    id: 'incident-timeline',
    label: 'Incident Timeline',
    description: 'Capture the sequence of events, response actions, and decisions chronologically.',
    category: 'Structure',
    keywords: ['incident', 'timeline', 'events', 'response', 'chronology'],
    template: `## Incident Timeline

| Time | Event | Owner |
| --- | --- | --- |
| 09:12 | Elevated error rate detected in publish API | On-call engineer |
| 09:19 | Incident declared and triage room opened | Incident commander |
| 09:34 | Faulty release rolled back | Platform team |
| 10:02 | Service stabilized and monitoring confirmed recovery | SRE |`,
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
    id: 'meeting-notes',
    label: 'Meeting Notes',
    description: 'Capture agenda, decisions, and follow-up owners from a review or sync.',
    category: 'Writing',
    keywords: ['meeting', 'notes', 'agenda', 'decisions', 'follow-up'],
    template: `## Meeting Notes

### Agenda
- Review current scope and open dependencies
- Confirm launch criteria and approvals

### Decisions
- Keep the first release behind a limited beta gate
- Publish migration guidance alongside the feature

### Follow-up
- Product: confirm announcement copy
- Engineering: validate rollback steps
- Support: prepare escalation notes`,
  },
  {
    id: 'review-checklist',
    label: 'Review Checklist',
    description: 'List the checks reviewers should complete before approving content.',
    category: 'Writing',
    keywords: ['review', 'checklist', 'approval', 'qa', 'validation'],
    template: `## Review Checklist

- [ ] Scope matches the shipped behavior
- [ ] Screenshots or examples use current UI
- [ ] Edge cases and failures are documented
- [ ] Ownership and follow-up actions are clear
- [ ] Links, commands, and payloads were tested`,
  },
  {
    id: 'migration-guide',
    label: 'Migration Guide',
    description: 'Lay out what changes, who is impacted, and the steps to move safely.',
    category: 'Writing',
    keywords: ['migration', 'upgrade', 'steps', 'breaking change', 'transition'],
    template: `## Migration Guide

### Who needs to migrate
Teams using the legacy document schema or outdated API tokens.

### What changes
- Deprecated fields are removed from the request body
- New status values are enforced during validation

### Migration steps
1. Update any saved examples and automation templates.
2. Regenerate SDK clients or request helpers.
3. Re-run staging validation before publishing the change.`,
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
    id: 'heatmap',
    label: 'Heatmap',
    description: 'Insert a heatmap block for intensity, workload, or trend distribution.',
    category: 'Data',
    keywords: ['heatmap', 'matrix', 'intensity', 'distribution', 'grid'],
    template: createHeatmapSnippetTemplate(),
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
    id: 'yaml-config',
    label: 'YAML Config',
    description: 'Add a config example for deployment, CI, or app setup guides.',
    category: 'Data',
    keywords: ['yaml', 'config', 'settings', 'deployment', 'ci'],
    template: `## YAML Config

\`\`\`yaml
environment: production
workspace: editorial
features:
  docs_editor: true
  quick_insert: true
\`\`\``,
  },
  {
    id: 'environment-variables',
    label: 'Environment Variables',
    description: 'Document runtime variables, defaults, and whether each value is required.',
    category: 'Data',
    keywords: ['environment', 'variables', 'env', 'config', 'secrets'],
    template: `## Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| \`DATABASE_URL\` | Yes | Primary Postgres connection string |
| \`AUTH_SECRET\` | Yes | Signs session and auth tokens |
| \`APP_PORT\` | No | Overrides the local HTTP port |
| \`APP_HOST\` | No | Overrides the local bind address |
| \`APP_BASE_URL\` | No | Sets the public base URL when host inference is not enough |
| \`DB_HOST\` | No | Sets the Postgres host when \`DATABASE_URL\` is omitted |`,
  },
  {
    id: 'test-matrix',
    label: 'Test Matrix',
    description: 'Organize scenarios, expected outcomes, and coverage owners in one table.',
    category: 'Data',
    keywords: ['test', 'matrix', 'coverage', 'qa', 'scenarios'],
    template: `## Test Matrix

| Scenario | Expected result | Owner |
| --- | --- | --- |
| Create a new document | Draft opens in the editor immediately | QA |
| Insert a saved component | Markdown appears at cursor position | Engineering |
| Publish a reviewed document | Status changes to published without data loss | Release manager |`,
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
    id: 'pagination',
    label: 'Pagination',
    description: 'Describe cursor or page-based navigation, limits, and response metadata.',
    category: 'API',
    keywords: ['pagination', 'cursor', 'page', 'limit', 'list'],
    template: `## Pagination

| Parameter | Meaning |
| --- | --- |
| \`cursor\` | Continue from the previous response position |
| \`limit\` | Maximum records to return in one page |

### Response metadata

\`\`\`json
{
  "nextCursor": "cur_456",
  "hasMore": true
}
\`\`\``,
  },
  {
    id: 'schema-field-table',
    label: 'Schema Field Table',
    description: 'Document field names, types, constraints, and descriptions in one reference block.',
    category: 'API',
    keywords: ['schema', 'fields', 'table', 'properties', 'reference'],
    template: `## Schema Field Table

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| \`title\` | string | Yes | Human-readable document name |
| \`status\` | enum | Yes | Current lifecycle state |
| \`updatedAt\` | string | No | RFC 3339 timestamp for the latest change |`,
  },
  {
    id: 'webhook-retry-policy',
    label: 'Webhook Retry Policy',
    description: 'Explain retry cadence, headers, and when deliveries are considered failed.',
    category: 'API',
    keywords: ['webhook', 'retry', 'delivery', 'backoff', 'policy'],
    template: `## Webhook Retry Policy

| Attempt | Delay | Notes |
| --- | --- | --- |
| 1 | Immediate | Initial delivery |
| 2 | 30 seconds | First retry after transient failure |
| 3 | 5 minutes | Escalates to slower backoff |
| 4 | 30 minutes | Final delivery before marking failed |

Failed deliveries remain visible in the event log with response status and last error message.`,
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

export function getDocSnippetSearchValue(
  snippet: Pick<DocSnippet, 'label' | 'description' | 'category' | 'keywords'>,
) {
  return [snippet.label, snippet.description, snippet.category, ...snippet.keywords].join(' ')
}

export function normalizeDocSnippetKeywords(value: string[] | string | null | undefined) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]/g)
      : []

  const seen = new Set<string>()

  return rawValues.reduce<string[]>((acc, item) => {
    const normalized = item.trim().toLowerCase()

    if (!normalized || seen.has(normalized)) {
      return acc
    }

    seen.add(normalized)
    acc.push(normalized)
    return acc
  }, [])
}

export function slugifyDocSnippetId(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'snippet'
}

export function createFallbackDocSnippets(): StoredDocSnippet[] {
  const fallbackDate = new Date(0).toISOString()

  return DOC_SNIPPETS.map((snippet, index) => ({
    ...snippet,
    workspaceId: 'fallback',
    sortOrder: index + 1,
    createdAt: fallbackDate,
    updatedAt: fallbackDate,
  }))
}

export function sortStoredDocSnippets(snippets: StoredDocSnippet[]) {
  const categoryOrder = new Map(
    DOC_SNIPPET_CATEGORIES.map((category, index) => [category, index]),
  )

  return [...snippets].sort((left, right) => {
    const categoryDelta =
      (categoryOrder.get(left.category) ?? Number.MAX_SAFE_INTEGER) -
      (categoryOrder.get(right.category) ?? Number.MAX_SAFE_INTEGER)

    if (categoryDelta !== 0) {
      return categoryDelta
    }

    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder
    }

    return left.label.localeCompare(right.label)
  })
}
