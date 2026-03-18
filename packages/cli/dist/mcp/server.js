import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { apiRequest } from '../lib/api-client.js';
import { fetchDocuments, fetchDocument, fetchOpenapiSources, fetchOpenapiEndpoints, searchDocuments, } from '../lib/api-helpers.js';
// ─── Tool definitions ────────────────────────────────────────
const TOOLS = [
    {
        name: 'search_documents',
        description: 'Search across all documents in the Kite workspace. Returns titles, slugs, previews, and relevance scores.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', description: 'Max results (default 10)' },
            },
            required: ['query'],
        },
    },
    {
        name: 'list_documents',
        description: 'List documents in the workspace with optional status filter.',
        inputSchema: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    description: 'Filter: draft, review, published, archived',
                },
                limit: { type: 'number', description: 'Max results (default 20)' },
            },
        },
    },
    {
        name: 'get_document',
        description: 'Get the full content of a document by slug or ID. Returns Markdown content.',
        inputSchema: {
            type: 'object',
            properties: {
                slug: {
                    type: 'string',
                    description: 'Document slug or ID',
                },
            },
            required: ['slug'],
        },
    },
    {
        name: 'create_document',
        description: 'Create a new document in the workspace.',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Document title' },
                content: { type: 'string', description: 'Markdown content' },
            },
            required: ['title'],
        },
    },
    {
        name: 'update_document',
        description: 'Update an existing document by slug or ID.',
        inputSchema: {
            type: 'object',
            properties: {
                slug: { type: 'string', description: 'Document slug or ID' },
                title: { type: 'string', description: 'New title' },
                content: { type: 'string', description: 'New Markdown content' },
            },
            required: ['slug'],
        },
    },
    {
        name: 'publish_document',
        description: 'Publish a document (transition from draft/review to published).',
        inputSchema: {
            type: 'object',
            properties: {
                slug: { type: 'string', description: 'Document slug or ID' },
            },
            required: ['slug'],
        },
    },
    {
        name: 'list_openapi_sources',
        description: 'List all OpenAPI specification sources in the workspace.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'list_api_endpoints',
        description: 'List API endpoints from an OpenAPI source. Shows method, path, summary.',
        inputSchema: {
            type: 'object',
            properties: {
                source: {
                    type: 'string',
                    description: 'OpenAPI source name or ID',
                },
            },
            required: ['source'],
        },
    },
];
// ─── Tool handlers ───────────────────────────────────────────
async function handleToolCall(name, args) {
    const text = (s) => ({ content: [{ type: 'text', text: s }] });
    switch (name) {
        case 'search_documents': {
            const data = await searchDocuments(args.query, args.limit || 10);
            if (!data.results?.length)
                return text('No results found.');
            const lines = data.results.map((r) => `- **${r.title}** (${r.slug || r.documentId})${r.preview ? `\n  ${r.preview.slice(0, 200)}` : ''}`);
            return text(lines.join('\n'));
        }
        case 'list_documents': {
            const data = await fetchDocuments({
                status: args.status,
                limit: args.limit || 20,
            });
            if (!data.items.length)
                return text('No documents found.');
            const lines = data.items.map((d) => `- [${d.status}] **${d.title}** — \`${d.slug}\``);
            return text(lines.join('\n'));
        }
        case 'get_document': {
            const doc = await fetchDocument(args.slug);
            if (!doc)
                return text(`Document "${args.slug}" not found.`);
            return text(`# ${doc.title}\n\n` +
                `> slug: ${doc.slug} | status: ${doc.status} | updated: ${doc.updatedAt}\n\n` +
                (doc.content || '*(empty)*'));
        }
        case 'create_document': {
            const res = await apiRequest('/api/documents', {
                method: 'POST',
                body: JSON.stringify({
                    title: args.title,
                    content: args.content || '',
                }),
            });
            const doc = (await res.json());
            return text(`Created document: **${doc.title}** (slug: ${doc.slug}, id: ${doc.id})`);
        }
        case 'update_document': {
            const doc = await fetchDocument(args.slug);
            if (!doc)
                return text(`Document "${args.slug}" not found.`);
            const body = {};
            if (args.title)
                body.title = args.title;
            if (args.content)
                body.content = args.content;
            await apiRequest(`/api/documents/${doc.id}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            });
            return text(`Updated document: **${doc.title}** (${doc.slug})`);
        }
        case 'publish_document': {
            const doc = await fetchDocument(args.slug);
            if (!doc)
                return text(`Document "${args.slug}" not found.`);
            await apiRequest(`/api/documents/${doc.id}/transition`, {
                method: 'POST',
                body: JSON.stringify({ action: 'publish' }),
            });
            return text(`Published: **${doc.title}** (${doc.slug})`);
        }
        case 'list_openapi_sources': {
            const data = await fetchOpenapiSources();
            if (!data.items.length)
                return text('No OpenAPI sources found.');
            const lines = data.items.map((s) => `- **${s.name}** (${s.openapiVersion || 'unknown'}) — ${s.sourceType}${s.lastSyncedAt ? ` — synced: ${s.lastSyncedAt}` : ''}`);
            return text(lines.join('\n'));
        }
        case 'list_api_endpoints': {
            const sources = await fetchOpenapiSources();
            const source = sources.items.find((s) => s.id === args.source || s.name === args.source);
            if (!source)
                return text(`OpenAPI source "${args.source}" not found.`);
            const data = await fetchOpenapiEndpoints(source.id);
            if (!data.endpoints?.length)
                return text('No endpoints found.');
            const lines = data.endpoints.map((ep) => `- \`${ep.method.toUpperCase()} ${ep.path}\`${ep.summary ? ` — ${ep.summary}` : ''}${ep.deprecated ? ' *(deprecated)*' : ''}`);
            return text(lines.join('\n'));
        }
        default:
            return text(`Unknown tool: ${name}`);
    }
}
// ─── Resource handlers ───────────────────────────────────────
const RESOURCES = [
    {
        uri: 'kite://documents',
        name: 'All Documents',
        description: 'List of all documents in the workspace',
        mimeType: 'application/json',
    },
    {
        uri: 'kite://openapi',
        name: 'OpenAPI Sources',
        description: 'List of all OpenAPI specification sources',
        mimeType: 'application/json',
    },
];
async function handleResourceRead(uri) {
    if (uri === 'kite://documents') {
        const data = await fetchDocuments({ limit: 100 });
        const summary = data.items.map((d) => ({
            slug: d.slug,
            title: d.title,
            status: d.status,
            updatedAt: d.updatedAt,
        }));
        return {
            contents: [
                {
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(summary, null, 2),
                },
            ],
        };
    }
    if (uri === 'kite://openapi') {
        const data = await fetchOpenapiSources();
        return {
            contents: [
                {
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(data.items, null, 2),
                },
            ],
        };
    }
    // Dynamic: kite://documents/{slug}
    const docMatch = uri.match(/^kite:\/\/documents\/(.+)$/);
    if (docMatch) {
        const doc = await fetchDocument(docMatch[1]);
        if (!doc) {
            return {
                contents: [
                    { uri, mimeType: 'text/plain', text: `Document "${docMatch[1]}" not found` },
                ],
            };
        }
        return {
            contents: [
                {
                    uri,
                    mimeType: 'text/markdown',
                    text: `# ${doc.title}\n\n${doc.content || ''}`,
                },
            ],
        };
    }
    return {
        contents: [
            { uri, mimeType: 'text/plain', text: `Unknown resource: ${uri}` },
        ],
    };
}
// ─── Server setup ────────────────────────────────────────────
export async function startMcpServer() {
    const server = new Server({ name: 'kite', version: '0.1.0' }, { capabilities: { tools: {}, resources: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [...TOOLS],
    }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        return handleToolCall(request.params.name, (request.params.arguments ?? {}));
    });
    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
        resources: RESOURCES,
    }));
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        return handleResourceRead(request.params.uri);
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
