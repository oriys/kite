import { defineConfig } from 'drizzle-kit'
import { getDatabaseUrl } from './lib/runtime-config'

function hasValue(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

const hasComposedDatabaseConfig =
  hasValue(process.env.POSTGRES_USER) &&
  hasValue(process.env.POSTGRES_PASSWORD) &&
  hasValue(process.env.POSTGRES_DB)

const databaseUrl =
  hasValue(process.env.DATABASE_URL) || hasComposedDatabaseConfig
    ? getDatabaseUrl(process.env)
    : 'postgresql://placeholder:placeholder@db.invalid:5432/placeholder'

export default defineConfig({
  schema: './lib/schema*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  migrations: {
    schema: 'drizzle',
    table: '__drizzle_migrations',
  },
})
