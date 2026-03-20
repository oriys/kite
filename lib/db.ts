import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { instrumentPostgresClient } from '@/lib/observability/db'
import * as schema from './schema'
import { getDatabaseUrl } from './runtime-config'

const databaseUrl = getDatabaseUrl()

const client = instrumentPostgresClient(postgres(databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
}))

export const db = drizzle(client, { schema })
