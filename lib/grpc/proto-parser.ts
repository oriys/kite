import protobuf from 'protobufjs'
import { unzipSync } from 'fflate'
import crypto from 'node:crypto'

export interface FieldSchema {
  name: string
  type: string
  repeated: boolean
  map: boolean
  message?: MessageSchema
  enumValues?: string[]
}

export interface MessageSchema {
  name: string
  fields: FieldSchema[]
}

export interface ParsedGrpcMethod {
  name: string
  inputType: MessageSchema
  outputType: MessageSchema
  clientStreaming: boolean
  serverStreaming: boolean
}

export interface ParsedGrpcService {
  packageName: string
  serviceName: string
  fullName: string
  methods: ParsedGrpcMethod[]
}

export interface ParsedGrpcSpec {
  packages: string[]
  services: ParsedGrpcService[]
}

function resolveMessageSchema(
  type: protobuf.Type,
  visited = new Set<string>(),
): MessageSchema {
  const fields: FieldSchema[] = []

  for (const field of type.fieldsArray) {
    const fieldSchema: FieldSchema = {
      name: field.name,
      type: field.type,
      repeated: field.repeated,
      map: field instanceof protobuf.MapField,
    }

    // Resolve nested message types
    if (field.resolvedType) {
      if (field.resolvedType instanceof protobuf.Enum) {
        fieldSchema.type = 'enum'
        fieldSchema.enumValues = Object.keys(field.resolvedType.values)
      } else if (field.resolvedType instanceof protobuf.Type) {
        fieldSchema.type = 'message'
        // Guard against circular references
        if (!visited.has(field.resolvedType.fullName)) {
          visited.add(field.resolvedType.fullName)
          fieldSchema.message = resolveMessageSchema(field.resolvedType, visited)
        }
      }
    }

    fields.push(fieldSchema)
  }

  return { name: type.name, fields }
}

function extractServices(root: protobuf.Root): ParsedGrpcService[] {
  const services: ParsedGrpcService[] = []

  function walk(ns: protobuf.NamespaceBase) {
    for (const nested of ns.nestedArray) {
      if (nested instanceof protobuf.Service) {
        const packageName = nested.parent?.fullName.replace(/^\./, '') ?? ''
        const parsedService: ParsedGrpcService = {
          packageName,
          serviceName: nested.name,
          fullName: `${packageName}.${nested.name}`,
          methods: [],
        }

        for (const method of nested.methodsArray) {
          const reqType = root.lookupType(method.requestType)
          const resType = root.lookupType(method.responseType)

          parsedService.methods.push({
            name: method.name,
            inputType: resolveMessageSchema(reqType),
            outputType: resolveMessageSchema(resType),
            clientStreaming: method.requestStream ?? false,
            serverStreaming: method.responseStream ?? false,
          })
        }

        services.push(parsedService)
      }

      if (nested instanceof protobuf.Namespace) {
        walk(nested)
      }
    }
  }

  walk(root)
  return services
}

export async function parseProtoContent(content: string): Promise<ParsedGrpcSpec> {
  const root = protobuf.parse(content, { keepCase: true }).root
  root.resolveAll()

  const services = extractServices(root)
  const packages = [...new Set(services.map((s) => s.packageName).filter(Boolean))]

  return { packages, services }
}

export async function parseProtoZip(zipBuffer: Uint8Array): Promise<ParsedGrpcSpec> {
  const files = unzipSync(zipBuffer)
  const root = new protobuf.Root()

  // Collect all .proto file contents
  const protoFiles: { name: string; content: string }[] = []
  for (const [path, data] of Object.entries(files)) {
    if (path.endsWith('.proto')) {
      protoFiles.push({
        name: path,
        content: new TextDecoder().decode(data),
      })
    }
  }

  if (protoFiles.length === 0) {
    throw new Error('No .proto files found in the zip archive')
  }

  // Parse all proto files into the same root for cross-file imports
  for (const file of protoFiles) {
    protobuf.parse(file.content, root, { keepCase: true })
  }

  root.resolveAll()

  const services = extractServices(root)
  const packages = [...new Set(services.map((s) => s.packageName).filter(Boolean))]

  return { packages, services }
}

export function computeChecksum(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}
