import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { eq, desc } from 'drizzle-orm'
import { withWorkspaceAuth, badRequest } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { apiTokens } from '@/lib/schema'

export async function GET() {
  const authResult = await withWorkspaceAuth('member')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const tokens = await db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      tokenPrefix: apiTokens.tokenPrefix,
      lastUsedAt: apiTokens.lastUsedAt,
      expiresAt: apiTokens.expiresAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.workspaceId, ctx.workspaceId))
    .orderBy(desc(apiTokens.createdAt))

  return NextResponse.json(tokens)
}

export async function POST(req: NextRequest) {
  const authResult = await withWorkspaceAuth('admin')
  if ('error' in authResult) return authResult.error
  const { ctx } = authResult

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const { name, expiresAt } = body as { name?: string; expiresAt?: string }
  if (!name?.trim()) return badRequest('Token name is required')

  const rawToken = 'kite_' + randomBytes(20).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const tokenPrefix = rawToken.slice(0, 12)

  const [token] = await db
    .insert(apiTokens)
    .values({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      name: name.trim(),
      tokenHash,
      tokenPrefix,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .returning()

  return NextResponse.json({
    id: token.id,
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    token: rawToken,
    expiresAt: token.expiresAt,
    createdAt: token.createdAt,
  }, { status: 201 })
}
