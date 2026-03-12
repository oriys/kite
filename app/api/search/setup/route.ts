import { NextResponse } from 'next/server'
import { withWorkspaceAuth } from '@/lib/api-utils'
import { ensureSearchIndex } from '@/lib/search/searcher'

export async function POST() {
  const authResult = await withWorkspaceAuth('owner')
  if ('error' in authResult) return authResult.error

  await ensureSearchIndex()

  return NextResponse.json({ message: 'Search index initialized' })
}
