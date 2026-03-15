import { defineConfig } from 'drizzle-kit'

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://placeholder:placeholder@localhost:5432/placeholder'

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
