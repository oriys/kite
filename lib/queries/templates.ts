import { desc, eq, and, sql, isNull } from 'drizzle-orm'
import { db } from '../db'
import { documentTemplates } from '../schema'
import { createDocument } from './documents'

type TemplateCategory = (typeof documentTemplates.$inferInsert)['category']

export async function createTemplate(
  workspaceId: string,
  data: {
    name: string
    description?: string
    category?: TemplateCategory
    content: string
    thumbnail?: string
    createdBy?: string
  },
) {
  const [tpl] = await db
    .insert(documentTemplates)
    .values({
      workspaceId,
      name: data.name,
      description: data.description ?? '',
      category: data.category ?? 'custom',
      content: data.content,
      thumbnail: data.thumbnail ?? null,
      createdBy: data.createdBy ?? null,
    })
    .returning()
  return tpl
}

export async function listTemplates(
  workspaceId: string,
  category?: TemplateCategory,
) {
  const conditions = [
    eq(documentTemplates.workspaceId, workspaceId),
    isNull(documentTemplates.deletedAt),
  ]
  if (category) conditions.push(eq(documentTemplates.category, category))

  return db
    .select({
      id: documentTemplates.id,
      workspaceId: documentTemplates.workspaceId,
      name: documentTemplates.name,
      description: documentTemplates.description,
      category: documentTemplates.category,
      isBuiltIn: documentTemplates.isBuiltIn,
      usageCount: documentTemplates.usageCount,
      createdBy: documentTemplates.createdBy,
      createdAt: documentTemplates.createdAt,
      updatedAt: documentTemplates.updatedAt,
    })
    .from(documentTemplates)
    .where(and(...conditions))
    .orderBy(
      desc(documentTemplates.usageCount),
      desc(documentTemplates.createdAt),
    )
}

export async function getTemplate(id: string, workspaceId: string) {
  return (await db.query.documentTemplates.findFirst({
    where: and(
      eq(documentTemplates.id, id),
      eq(documentTemplates.workspaceId, workspaceId),
      isNull(documentTemplates.deletedAt),
    ),
  })) ?? null
}

export async function updateTemplate(
  id: string,
  workspaceId: string,
  data: Partial<{
    name: string
    description: string
    category: TemplateCategory
    content: string
    thumbnail: string | null
  }>,
) {
  const [tpl] = await db
    .update(documentTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(documentTemplates.id, id),
        eq(documentTemplates.workspaceId, workspaceId),
        isNull(documentTemplates.deletedAt),
      ),
    )
    .returning()
  return tpl ?? null
}

export async function deleteTemplate(id: string, workspaceId: string) {
  const deleted = await db
    .update(documentTemplates)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(documentTemplates.id, id),
        eq(documentTemplates.workspaceId, workspaceId),
        isNull(documentTemplates.deletedAt),
      ),
    )
    .returning()

  return deleted.length > 0
}

export async function duplicateTemplate(
  id: string,
  workspaceId: string,
  userId: string,
) {
  const source = await getTemplate(id, workspaceId)
  if (!source) return null

  return createTemplate(workspaceId, {
    name: `${source.name} (copy)`,
    description: source.description,
    category: source.category,
    content: source.content,
    thumbnail: source.thumbnail ?? undefined,
    createdBy: userId,
  })
}

export async function createDocumentFromTemplate(
  templateId: string,
  workspaceId: string,
  createdBy: string,
  title?: string,
) {
  const tpl = await getTemplate(templateId, workspaceId)
  if (!tpl) return null

  // Increment usage count
  await db
    .update(documentTemplates)
    .set({ usageCount: sql`${documentTemplates.usageCount} + 1` })
    .where(and(eq(documentTemplates.id, templateId), isNull(documentTemplates.deletedAt)))

  return createDocument(
    workspaceId,
    title ?? tpl.name,
    tpl.content,
    createdBy,
  )
}

/** Built-in templates seeded per workspace */
export const BUILT_IN_TEMPLATES = [
  {
    name: 'Getting Started Guide',
    description: 'A quickstart guide for new API consumers',
    category: 'getting-started' as TemplateCategory,
    content: `# Getting Started\n\n## Prerequisites\n\n- Requirement 1\n- Requirement 2\n\n## Installation\n\n\`\`\`bash\nnpm install your-sdk\n\`\`\`\n\n## Quick Start\n\n\`\`\`javascript\nimport { Client } from 'your-sdk'\n\nconst client = new Client({ apiKey: 'YOUR_API_KEY' })\n\nconst result = await client.resource.list()\nconsole.log(result)\n\`\`\`\n\n## Next Steps\n\n- [Authentication Guide](/docs/auth)\n- [API Reference](/docs/api)\n- [Examples](/docs/examples)\n`,
  },
  {
    name: 'API Reference',
    description: 'Standard REST API endpoint documentation',
    category: 'api-reference' as TemplateCategory,
    content: `# API Reference: Resource Name\n\n## Overview\n\nBrief description of this API resource.\n\n## Endpoints\n\n### List Resources\n\n\`GET /api/v1/resources\`\n\n**Parameters:**\n\n| Name | Type | Required | Description |\n|------|------|----------|-------------|\n| page | integer | No | Page number |\n| limit | integer | No | Items per page (max 100) |\n\n**Response:**\n\n\`\`\`json\n{\n  "data": [],\n  "pagination": {\n    "page": 1,\n    "limit": 20,\n    "total": 100\n  }\n}\n\`\`\`\n\n### Create Resource\n\n\`POST /api/v1/resources\`\n\n**Request Body:**\n\n\`\`\`json\n{\n  "name": "string",\n  "description": "string"\n}\n\`\`\`\n\n### Get Resource\n\n\`GET /api/v1/resources/:id\`\n\n### Update Resource\n\n\`PUT /api/v1/resources/:id\`\n\n### Delete Resource\n\n\`DELETE /api/v1/resources/:id\`\n`,
  },
  {
    name: 'Changelog',
    description: 'Release notes and version history',
    category: 'changelog' as TemplateCategory,
    content: `# Changelog\n\n## [Unreleased]\n\n### Added\n- New feature description\n\n### Changed\n- Changed feature description\n\n### Fixed\n- Bug fix description\n\n---\n\n## [1.0.0] - YYYY-MM-DD\n\n### Added\n- Initial release\n- Feature 1\n- Feature 2\n\n### Security\n- Security improvement description\n`,
  },
  {
    name: 'Migration Guide',
    description: 'Guide for migrating between API versions',
    category: 'migration-guide' as TemplateCategory,
    content: `# Migration Guide: v1 → v2\n\n## Overview\n\nThis guide covers the breaking changes and migration steps from API v1 to v2.\n\n## Breaking Changes\n\n### 1. Authentication\n\n**Before (v1):**\n\`\`\`bash\ncurl -H "X-API-Key: ..." https://api.example.com/v1/resource\n\`\`\`\n\n**After (v2):**\n\`\`\`bash\ncurl -H "Authorization: Bearer ..." https://api.example.com/v2/resource\n\`\`\`\n\n### 2. Response Format\n\nAll responses now wrap data in a \`data\` envelope.\n\n### 3. Renamed Fields\n\n| v1 Field | v2 Field | Notes |\n|----------|----------|-------|\n| \`created\` | \`created_at\` | ISO 8601 format |\n\n## Step-by-Step Migration\n\n1. Update authentication headers\n2. Update response parsing\n3. Update field names\n4. Test thoroughly\n\n## Need Help?\n\nContact support or open an issue.\n`,
  },
  {
    name: 'Tutorial',
    description: 'Step-by-step walkthrough for a specific use case',
    category: 'tutorial' as TemplateCategory,
    content: `# Tutorial: Build Your First Integration\n\n## What You'll Build\n\nA brief description of the end result.\n\n## Prerequisites\n\n- An API key ([get one here](/settings/api-keys))\n- Node.js 18+\n\n## Step 1: Set Up Your Project\n\n\`\`\`bash\nmkdir my-integration && cd my-integration\nnpm init -y\nnpm install your-sdk\n\`\`\`\n\n## Step 2: Authenticate\n\n\`\`\`javascript\n// index.js\nimport { Client } from 'your-sdk'\n\nconst client = new Client({\n  apiKey: process.env.API_KEY\n})\n\`\`\`\n\n## Step 3: Make Your First Request\n\n\`\`\`javascript\nconst resources = await client.resources.list()\nconsole.log(\`Found \${resources.length} resources\`)\n\`\`\`\n\n## Step 4: Handle Errors\n\n\`\`\`javascript\ntry {\n  const resource = await client.resources.get('invalid-id')\n} catch (error) {\n  console.error(\`Error: \${error.message}\`)\n}\n\`\`\`\n\n## Summary\n\nYou've learned how to:\n- ✅ Set up the SDK\n- ✅ Authenticate\n- ✅ Make requests\n- ✅ Handle errors\n`,
  },
  {
    name: 'Troubleshooting',
    description: 'Common issues and their solutions',
    category: 'troubleshooting' as TemplateCategory,
    content: `# Troubleshooting\n\n## Common Issues\n\n### Authentication Errors (401)\n\n**Symptom:** All requests return \`401 Unauthorized\`.\n\n**Possible causes:**\n1. Expired API key\n2. Incorrect key format\n3. Missing \`Authorization\` header\n\n**Solution:**\n\`\`\`bash\n# Verify your key works\ncurl -H "Authorization: Bearer YOUR_KEY" https://api.example.com/v1/me\n\`\`\`\n\n### Rate Limiting (429)\n\n**Symptom:** Requests return \`429 Too Many Requests\`.\n\n**Solution:** Implement exponential backoff:\n\`\`\`javascript\nasync function retryWithBackoff(fn, maxRetries = 3) {\n  for (let i = 0; i < maxRetries; i++) {\n    try {\n      return await fn()\n    } catch (err) {\n      if (err.status !== 429 || i === maxRetries - 1) throw err\n      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000))\n    }\n  }\n}\n\`\`\`\n\n### Timeout Errors\n\n**Symptom:** Requests hang or timeout.\n\n**Solution:** Set explicit timeouts and check your network.\n\n## Still Need Help?\n\n- Check our [Status Page](https://status.example.com)\n- Open a [Support Ticket](/support)\n`,
  },
] as const
