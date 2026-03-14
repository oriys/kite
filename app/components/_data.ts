import type { ComponentType } from 'react'
import {
  Command,
  FileJson,
  Globe,
  LayoutGrid,
  Link2,
  ListFilter,
} from 'lucide-react'

export const sections = [
  { id: 'overview', label: 'Overview', note: 'tone and scope' },
  { id: 'foundations', label: 'Foundations', note: 'color and type' },
  { id: 'controls', label: 'Controls', note: 'inputs and actions' },
  { id: 'navigation', label: 'Navigation', note: 'command and hierarchy' },
  { id: 'playground', label: 'Playground', note: 'interactive console' },
  { id: 'requests', label: 'Requests', note: 'http and payloads' },
  { id: 'api-docs', label: 'API docs', note: 'rest, webhook, graphql' },
  { id: 'data', label: 'Data', note: 'lists and tables' },
  { id: 'writing', label: 'Writing', note: 'docs and callouts' },
  { id: 'states', label: 'States', note: 'feedback and empty cases' },
  { id: 'enhanced-docs', label: 'Enhanced Docs', note: 'rich components' },
] as const

export const metrics = [
  { value: '1 accent', label: 'cool highlight', note: 'soft blue only where hierarchy needs it' },
  { value: '8 px', label: 'base radius', note: 'sharper corners for denser product surfaces' },
  { value: '1400 px', label: 'content frame', note: 'wide enough for system pages and dense tools' },
] as const

export const tonePrinciples = [
  'Paper-first surfaces with just enough contrast to separate layers.',
  'Warm neutrals for reading, one cool accent for focus and selection.',
  'Documentation rhythm before dashboard chrome.',
  'Dense information grouped by whitespace, not endless card stacks.',
] as const

export const colorTokenGroups = [
  {
    title: 'Surfaces',
    description: 'Base canvas, raised paper, borders, and shell layers.',
    tokens: [
      { label: 'Background', token: 'background', note: 'page canvas' },
      { label: 'Card', token: 'card', note: 'raised paper' },
      { label: 'Popover', token: 'popover', note: 'overlay surface' },
      { label: 'Sidebar', token: 'sidebar', note: 'navigation shell' },
      { label: 'Border', token: 'border', note: 'quiet dividers' },
      { label: 'Input', token: 'input', note: 'field outline' },
    ],
  },
  {
    title: 'Interaction',
    description: 'Action, selection, and emphasis colors that drive hierarchy.',
    tokens: [
      { label: 'Primary', token: 'primary', note: 'core action' },
      { label: 'Secondary', token: 'secondary', note: 'soft action fill' },
      { label: 'Muted', token: 'muted', note: 'subtle grouping' },
      { label: 'Accent', token: 'accent', note: 'focus and hover' },
      { label: 'Ring', token: 'ring', note: 'focus outline' },
      { label: 'Sidebar Accent', token: 'sidebar-accent', note: 'active nav state' },
    ],
  },
  {
    title: 'Semantic',
    description: 'Status and operational signals for guidance and warnings.',
    tokens: [
      { label: 'Success', token: 'success', note: 'positive state' },
      { label: 'Warning', token: 'warning', note: 'caution state' },
      { label: 'Info', token: 'info', note: 'neutral guidance' },
      { label: 'Destructive', token: 'destructive', note: 'critical action' },
      { label: 'Method GET', token: 'method-get', note: 'read request' },
      { label: 'Method POST', token: 'method-post', note: 'write request' },
    ],
  },
  {
    title: 'Data',
    description: 'Palette used for charts, analytics, and dense reporting views.',
    tokens: [
      { label: 'Chart 1', token: 'chart-1', note: 'primary series' },
      { label: 'Chart 2', token: 'chart-2', note: 'comparison series' },
      { label: 'Chart 3', token: 'chart-3', note: 'support series' },
      { label: 'Chart 4', token: 'chart-4', note: 'highlight series' },
      { label: 'Method PUT', token: 'method-put', note: 'update request' },
      { label: 'Method DELETE', token: 'method-delete', note: 'delete request' },
    ],
  },
] as const

export const typeScale = [
  { label: 'Display', sample: 'Build calm interfaces with editorial rhythm.', className: 'text-3xl md:text-5xl tracking-tight leading-none font-semibold' },
  { label: 'Section', sample: 'Structure actions, content, and navigation with subtle contrast.', className: 'text-xl tracking-tight font-semibold' },
  { label: 'Body', sample: 'Default copy stays readable in product surfaces, docs, and database sidebars.', className: 'text-sm leading-7 text-muted-foreground' },
] as const

export const navigationPatterns: ReadonlyArray<{
  icon: ComponentType<{ className?: string }>
  title: string
  note: string
}> = [
  { icon: Command, title: 'Command entry', note: 'Fast capture, page jump, and system-wide search.' },
  { icon: LayoutGrid, title: 'Split shell', note: 'Sticky page map on the left, content density on the right.' },
  { icon: ListFilter, title: 'Inline filtering', note: 'Filters live next to content, not in detached panels.' },
]

export const requestQueryRows = [
  { name: 'include', value: 'owner,properties', meta: 'optional' },
  { name: 'expand', value: 'blocks', meta: 'optional' },
  { name: 'locale', value: 'en-US', meta: 'default' },
] as const

export const requestHeaderRows = [
  { name: 'Authorization', value: 'Bearer sk_live_x7...', meta: 'secret', required: true },
  { name: 'Content-Type', value: 'application/json', meta: 'required', required: true },
  { name: 'X-Workspace-ID', value: 'ws_2048', meta: 'routing', required: false },
] as const

export const requestBodyExample = `{
  "title": "Q2 planning brief",
  "visibility": "team",
  "ownerId": "usr_1024",
  "properties": {
    "status": "draft",
    "reviewers": ["usr_2048", "usr_4096"]
  }
}`

export const requestComponentTiles: ReadonlyArray<{
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
}> = [
  {
    icon: Globe,
    title: 'URL',
    description: 'Monospace endpoint field for base URLs, resource paths, and route params.',
  },
  {
    icon: Link2,
    title: 'Headers and query',
    description: 'Key-value rows for auth, content type, filters, and pagination.',
  },
  {
    icon: FileJson,
    title: 'Request body',
    description: 'Structured JSON block for payload previews, samples, and docs.',
  },
]

export const restEndpointMeta = [
  {
    label: 'Authentication',
    value: 'Bearer token',
    note: 'Server-side integrations and admin consoles use the same auth header.',
  },
  {
    label: 'Stability',
    value: 'General availability',
    note: 'Safe for production references, internal tools, and onboarding docs.',
  },
  {
    label: 'Idempotency',
    value: 'Idempotency-Key',
    note: 'Recommended for create flows that may retry in the background.',
  },
  {
    label: 'Versioning',
    value: 'Workspace-Version',
    note: 'Pin upgrades through a version header instead of changing the route.',
  },
] as const

export const restResponseStates = [
  { code: '201', label: 'Created', tone: 'success' as const },
  { code: '400', label: 'Invalid body', tone: 'caution' as const },
  { code: '401', label: 'Unauthorized', tone: 'error' as const },
  { code: '429', label: 'Rate limited', tone: 'caution' as const },
] as const

export const restCodeSamples = [
  {
    value: 'curl',
    label: 'cURL',
    language: 'bash',
    caption: 'Signed server request',
    code: `curl -X POST https://api.workspace.dev/v1/pages \\
  -H "Authorization: Bearer $WORKSPACE_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "X-Workspace-ID: ws_2048" \\
  -H "Idempotency-Key: pg-create-2048" \\
  -d '{
    "title": "Q2 planning brief",
    "visibility": "team",
    "templateId": "tpl_editorial_doc"
  }'`,
  },
  {
    value: 'typescript',
    label: 'TypeScript',
    language: 'ts',
    caption: 'SDK wrapper example',
    code: `const page = await workspace.pages.create({
  title: 'Q2 planning brief',
  visibility: 'team',
  templateId: 'tpl_editorial_doc',
  properties: {
    ownerId: 'usr_1024',
    status: 'draft',
  },
})`,
  },
  {
    value: 'response',
    label: 'Response',
    language: 'json',
    caption: 'Created resource payload',
    code: `{
  "id": "pg_8S1bn4",
  "title": "Q2 planning brief",
  "status": "draft",
  "url": "https://workspace.dev/pages/pg_8S1bn4",
  "createdAt": "2026-03-09T09:41:18Z"
}`,
  },
] as const

export const webhookEvents = [
  {
    title: 'Document lifecycle',
    event: 'page.created',
    description:
      'Emitted when a new page becomes visible to the workspace and is ready for downstream indexing.',
    destination: 'POST https://ops.workspace.dev/hooks/content',
    deliveryMode: 'HMAC signed',
  },
  {
    title: 'Review routing',
    event: 'page.review_requested',
    description:
      'Sent after reviewers are attached so approver systems can fan out notifications.',
    destination: 'POST https://workflow.workspace.dev/hooks/review',
    deliveryMode: '3 retries',
  },
  {
    title: 'Archival sync',
    event: 'page.archived',
    description:
      'Triggers retention jobs and analytics cleanup when a document leaves active collections.',
    destination: 'POST https://archive.workspace.dev/hooks/lifecycle',
    deliveryMode: 'at-least-once',
  },
] as const

export const webhookDeliveryRows = [
  {
    event: 'page.created',
    status: 'Delivered',
    tone: 'delivered' as const,
    note: '200 OK from /hooks/content after 182ms.',
    timestamp: '09:42 UTC',
  },
  {
    event: 'page.review_requested',
    status: 'Retrying',
    tone: 'retrying' as const,
    note: 'Attempt 2 of 5 after a 502 response from the review router.',
    timestamp: '09:37 UTC',
  },
  {
    event: 'page.archived',
    status: 'Failed',
    tone: 'failed' as const,
    note: 'No acknowledgement returned within the 10s delivery window.',
    timestamp: '09:12 UTC',
  },
] as const

export const webhookPayloadExample = `{
  "id": "evt_7J2k91",
  "type": "page.created",
  "createdAt": "2026-03-09T09:41:18Z",
  "workspaceId": "ws_2048",
  "data": {
    "pageId": "pg_8S1bn4",
    "title": "Q2 planning brief",
    "status": "draft"
  },
  "signature": "t=1773106878,v1=6b5d..."
}`

export const graphqlOperationSamples = [
  {
    value: 'query',
    label: 'Query',
    language: 'graphql',
    caption: 'Read a page summary',
    code: `query PageSummary($id: ID!) {
  page(id: $id) {
    id
    title
    status
    owner {
      name
    }
    updatedAt
  }
}`,
  },
  {
    value: 'variables',
    label: 'Variables',
    language: 'json',
    caption: 'Operation variables',
    code: `{
  "id": "pg_8S1bn4"
}`,
  },
  {
    value: 'result',
    label: 'Result',
    language: 'json',
    caption: 'Resolved data payload',
    code: `{
  "data": {
    "page": {
      "id": "pg_8S1bn4",
      "title": "Q2 planning brief",
      "status": "draft",
      "owner": {
        "name": "Aline Lowe"
      },
      "updatedAt": "2026-03-09T09:41:18Z"
    }
  }
}`,
  },
] as const

export const graphqlSchemaTypes = [
  {
    label: 'Page',
    value: '14 fields',
    note: 'Canonical document node returned by read and mutation payloads.',
  },
  {
    label: 'PageFilter',
    value: '5 inputs',
    note: 'Status, owner, tag, cursor, and updated-at constraints.',
  },
  {
    label: 'PublishPageInput',
    value: '4 inputs',
    note: 'Mutation contract for publishing and audit annotation.',
  },
  {
    label: 'WebhookDelivery',
    value: '6 fields',
    note: 'Delivery attempts, retries, and acknowledgement metadata.',
  },
] as const

export const databaseRows = [
  { name: 'Workspace guide', status: 'ready', owner: 'AL', area: 'Docs', updated: '2h ago' },
  { name: 'Meeting notes template', status: 'live', owner: 'CR', area: 'Ops', updated: '5h ago' },
  { name: 'Roadmap digest', status: 'draft', owner: 'MN', area: 'Product', updated: 'Yesterday' },
  { name: 'Interview packet', status: 'live', owner: 'ST', area: 'People', updated: '2d ago' },
] as const

export const documentRows = [
  {
    title: 'Foundations',
    description: 'Color, spacing, surfaces, and typography tokens.',
    status: 'Ready',
    tone: 'ready' as const,
  },
  {
    title: 'Navigation',
    description: 'Breadcrumbs, command surfaces, and dense sidebars.',
    status: 'Live',
    tone: 'live' as const,
  },
  {
    title: 'Writer blocks',
    description: 'Callouts, code, and editorial annotations.',
    status: 'Draft',
    tone: 'draft' as const,
  },
] as const
