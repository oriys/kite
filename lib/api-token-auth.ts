import { db } from './db'
import { apiTokens } from './schema'
import { eq } from 'drizzle-orm'
import { createHash } from 'crypto'

export async function authenticateApiToken(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer kite_')) return null

  const token = authHeader.slice(7)
  const hash = createHash('sha256').update(token).digest('hex')

  const record = await db.query.apiTokens.findFirst({
    where: eq(apiTokens.tokenHash, hash),
  })

  if (!record) return null
  if (record.expiresAt && record.expiresAt < new Date()) return null

  await db.update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, record.id))

  return { userId: record.userId, workspaceId: record.workspaceId, tokenId: record.id }
}
