import { NextResponse } from 'next/server'

import { withWorkspaceAuth } from '@/lib/api-utils'

export async function POST() {
  const result = await withWorkspaceAuth('owner')
  if ('error' in result) return result.error

  return NextResponse.json({
    message: 'Document embedding is no longer supported. Use knowledge sources for RAG.',
    processed: 0,
    total: 0,
  })
}
