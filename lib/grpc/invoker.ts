import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  '169.254.169.254',
  'metadata.google.internal',
]

function isBlockedAddress(address: string): boolean {
  const hostname = address.split(':')[0].toLowerCase()
  if (BLOCKED_HOSTS.includes(hostname)) return true
  if (/^10\./.test(hostname)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true
  if (/^192\.168\./.test(hostname)) return true
  return false
}

export interface GrpcInvokeRequest {
  protoContent: string
  serviceName: string
  methodName: string
  targetAddress: string
  requestBody: Record<string, unknown>
  timeoutMs?: number
}

export interface GrpcInvokeResponse {
  body: Record<string, unknown>
  duration: number
  metadata?: Record<string, string>
}

type GrpcClientMethod = (
  request: Record<string, unknown>,
  metadata: grpc.Metadata,
  options: { deadline: Date },
  callback: (
    err: grpc.ServiceError | null,
    response: Record<string, unknown>,
  ) => void,
) => void

export async function invokeGrpcMethod(
  req: GrpcInvokeRequest,
): Promise<GrpcInvokeResponse> {
  if (isBlockedAddress(req.targetAddress)) {
    throw new Error('Requests to localhost and private networks are not allowed')
  }

  const timeout = req.timeoutMs ?? 30_000

  // Write proto content to a temp file for proto-loader
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grpc-'))
  const protoPath = path.join(tmpDir, 'service.proto')
  fs.writeFileSync(protoPath, req.protoContent, 'utf-8')

  try {
    const packageDefinition = await protoLoader.load(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    })

    const grpcObject = grpc.loadPackageDefinition(packageDefinition)

    // Navigate to the service client constructor
    const parts = req.serviceName.split('.')
    let current: Record<string, unknown> = grpcObject as Record<string, unknown>
    for (const part of parts) {
      current = current[part] as Record<string, unknown>
      if (!current) {
        throw new Error(`Service "${req.serviceName}" not found in proto definition`)
      }
    }

    const ServiceClient = current as unknown as new (
      address: string,
      credentials: grpc.ChannelCredentials,
    ) => grpc.Client

    const client = new ServiceClient(
      req.targetAddress,
      grpc.credentials.createInsecure(),
    )

    const start = performance.now()

    return await new Promise<GrpcInvokeResponse>((resolve, reject) => {
      const deadline = new Date(Date.now() + timeout)

      // Access the method on the client prototype
      const methodFn = (
        client as unknown as Record<string, GrpcClientMethod | undefined>
      )[req.methodName]
      if (typeof methodFn !== 'function') {
        client.close()
        reject(new Error(`Method "${req.methodName}" not found on service`))
        return
      }

      methodFn.call(
        client,
        req.requestBody,
        new grpc.Metadata(),
        { deadline },
        (err: grpc.ServiceError | null, response: Record<string, unknown>) => {
          const duration = Math.round(performance.now() - start)
          client.close()

          if (err) {
            reject(
              new Error(
                `gRPC error (${err.code}): ${err.details || err.message}`,
              ),
            )
            return
          }

          resolve({
            body: response,
            duration,
          })
        },
      )
    })
  } finally {
    // Cleanup temp files
    try {
      fs.unlinkSync(protoPath)
      fs.rmdirSync(tmpDir)
    } catch {
      // ignore cleanup errors
    }
  }
}
