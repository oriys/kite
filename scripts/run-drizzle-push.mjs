import { spawn } from 'node:child_process'

function readEnv(key) {
  const value = process.env[key]?.trim()
  return value ? value : undefined
}

function getDatabaseUrl() {
  const directUrl = readEnv('DATABASE_URL')
  if (directUrl) {
    return directUrl
  }

  const username = readEnv('POSTGRES_USER')
  const password = readEnv('POSTGRES_PASSWORD')
  const database = readEnv('POSTGRES_DB')

  if (!username || !password || !database) {
    throw new Error(
      'DATABASE_URL is not set. Provide DATABASE_URL or POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB.',
    )
  }

  const host = readEnv('DB_HOST') ?? '127.0.0.1'
  const port = readEnv('DB_PORT') ?? '5432'
  const sslmode = readEnv('DB_SSLMODE')
  const channelBinding = readEnv('DB_CHANNEL_BINDING')

  const url = new URL(`postgresql://${host}:${port}/${database}`)
  url.username = username
  url.password = password

  if (sslmode) {
    url.searchParams.set('sslmode', sslmode)
  }

  if (channelBinding) {
    url.searchParams.set('channel_binding', channelBinding)
  }

  return url.toString()
}

const args = [
  './node_modules/drizzle-kit/bin.cjs',
  'push',
  '--dialect',
  'postgresql',
  '--schema',
  './lib/schema.ts',
  '--url',
  getDatabaseUrl(),
  ...process.argv.slice(2),
]

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: process.env,
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
