import { NextRequest, NextResponse } from 'next/server'
import { handleMockRequest } from '@/lib/mock/handler'

async function handleMock(req: NextRequest, params: Promise<{ configId: string; path: string[] }>) {
  const { configId, path } = await params
  const fullPath = '/' + path.join('/')
  const method = req.method

  const result = await handleMockRequest(configId, method, fullPath)

  return NextResponse.json(result.body, {
    status: result.status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
      ...result.headers,
    },
  })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ configId: string; path: string[] }> }) {
  return handleMock(req, ctx.params)
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ configId: string; path: string[] }> }) {
  return handleMock(req, ctx.params)
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ configId: string; path: string[] }> }) {
  return handleMock(req, ctx.params)
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ configId: string; path: string[] }> }) {
  return handleMock(req, ctx.params)
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ configId: string; path: string[] }> }) {
  return handleMock(req, ctx.params)
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
    },
  })
}
