import { db } from '@/lib/db'
import {
  grpcSources,
  grpcServices,
  grpcMethods,
} from '@/lib/schema'
import { eq, desc, and, isNull } from 'drizzle-orm'
import type { ParsedGrpcSpec } from '@/lib/grpc/proto-parser'

type NewGrpcSource = typeof grpcSources.$inferInsert
type GrpcSource = typeof grpcSources.$inferSelect

function buildServiceAndMethodValues(
  sourceId: string,
  spec: ParsedGrpcSpec,
) {
  const services: (typeof grpcServices.$inferInsert)[] = []
  const methods: (typeof grpcMethods.$inferInsert & { _serviceIndex: number })[] = []

  for (let i = 0; i < spec.services.length; i++) {
    const svc = spec.services[i]
    services.push({
      sourceId,
      packageName: svc.packageName,
      serviceName: svc.serviceName,
      description: null,
    })

    for (const method of svc.methods) {
      methods.push({
        serviceId: '', // filled after insert
        sourceId,
        name: method.name,
        description: null,
        inputType: method.inputType as unknown as Record<string, unknown>,
        outputType: method.outputType as unknown as Record<string, unknown>,
        clientStreaming: method.clientStreaming,
        serverStreaming: method.serverStreaming,
        _serviceIndex: i,
      })
    }
  }

  return { services, methods }
}

export async function createGrpcSource(
  data: Omit<NewGrpcSource, 'id' | 'createdAt' | 'lastSyncedAt'>,
  spec?: ParsedGrpcSpec,
): Promise<GrpcSource> {
  return db.transaction(async (tx) => {
    const [source] = await tx
      .insert(grpcSources)
      .values(data)
      .returning()

    if (spec && spec.services.length > 0) {
      const { services, methods } = buildServiceAndMethodValues(source.id, spec)

      const insertedServices = await tx
        .insert(grpcServices)
        .values(services)
        .returning()

      if (methods.length > 0) {
        const methodValues = methods.map((m) => ({
          serviceId: insertedServices[m._serviceIndex].id,
          sourceId: m.sourceId,
          name: m.name,
          description: m.description,
          inputType: m.inputType,
          outputType: m.outputType,
          clientStreaming: m.clientStreaming,
          serverStreaming: m.serverStreaming,
        }))

        await tx.insert(grpcMethods).values(methodValues)
      }
    }

    return source
  })
}

export async function getGrpcSource(id: string) {
  return db.query.grpcSources.findFirst({
    where: and(eq(grpcSources.id, id), isNull(grpcSources.deletedAt)),
  })
}

export async function listGrpcSources(workspaceId: string) {
  return db
    .select({
      id: grpcSources.id,
      name: grpcSources.name,
      sourceType: grpcSources.sourceType,
      sourceConfig: grpcSources.sourceConfig,
      createdAt: grpcSources.createdAt,
      lastSyncedAt: grpcSources.lastSyncedAt,
    })
    .from(grpcSources)
    .where(
      and(
        eq(grpcSources.workspaceId, workspaceId),
        isNull(grpcSources.deletedAt),
      ),
    )
    .orderBy(desc(grpcSources.createdAt))
}

export async function deleteGrpcSource(id: string) {
  const result = await db
    .update(grpcSources)
    .set({ deletedAt: new Date() })
    .where(and(eq(grpcSources.id, id), isNull(grpcSources.deletedAt)))
    .returning()
  return result.length > 0
}

export async function listGrpcServices(sourceId: string) {
  const services = await db.query.grpcServices.findMany({
    where: eq(grpcServices.sourceId, sourceId),
    with: {
      methods: true,
    },
  })
  return services
}

export async function syncGrpcSource(
  id: string,
  newContent: string,
  checksum: string,
  spec: ParsedGrpcSpec,
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(grpcSources)
      .where(and(eq(grpcSources.id, id), isNull(grpcSources.deletedAt)))

    if (!current) throw new Error('Source not found')

    // Update source content
    await tx
      .update(grpcSources)
      .set({
        rawContent: newContent,
        checksum,
        lastSyncedAt: new Date(),
      })
      .where(eq(grpcSources.id, id))

    // Replace services and methods: delete old, insert new
    await tx.delete(grpcMethods).where(eq(grpcMethods.sourceId, id))
    await tx.delete(grpcServices).where(eq(grpcServices.sourceId, id))

    if (spec.services.length > 0) {
      const { services, methods } = buildServiceAndMethodValues(id, spec)

      const insertedServices = await tx
        .insert(grpcServices)
        .values(services)
        .returning()

      if (methods.length > 0) {
        const methodValues = methods.map((m) => ({
          serviceId: insertedServices[m._serviceIndex].id,
          sourceId: m.sourceId,
          name: m.name,
          description: m.description,
          inputType: m.inputType,
          outputType: m.outputType,
          clientStreaming: m.clientStreaming,
          serverStreaming: m.serverStreaming,
        }))

        await tx.insert(grpcMethods).values(methodValues)
      }
    }

    const [updated] = await tx
      .select()
      .from(grpcSources)
      .where(eq(grpcSources.id, id))

    return updated
  })
}
