import { defineConfig } from 'drizzle-kit'
import { getDatabaseUrl } from './lib/runtime-config'

const databaseUrl = getDatabaseUrl({
  ...process.env,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgresql://placeholder:placeholder@db.invalid:5432/placeholder',
})

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
