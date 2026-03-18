import { NextRequest, NextResponse } from 'next/server'
import { invokeGrpcMethod } from '@/lib/grpc/invoker'

interface TryItRequest {
  protoContent: string
  serviceName: string
  methodName: string
  targetAddress: string
  requestBody: Record<string, unknown>
  timeoutMs?: number
}

export async function POST(request: NextRequest) {
  let payload: TryItRequest
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { protoContent, serviceName, methodName, targetAddress, requestBody, timeoutMs } = payload

  if (!protoContent || !serviceName || !methodName || !targetAddress) {
    return NextResponse.json(
      { error: 'protoContent, serviceName, methodName, and targetAddress are required' },
      { status: 400 },
    )
  }

  try {
    const result = await invokeGrpcMethod({
      protoContent,
      serviceName,
      methodName,
      targetAddress,
      requestBody: requestBody ?? {},
      timeoutMs,
    })

    return NextResponse.json({
      body: result.body,
      duration: result.duration,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'gRPC call failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
