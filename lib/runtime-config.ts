function readEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim()
  return value ? value : undefined
}

export function getAppPort(env: NodeJS.ProcessEnv = process.env): string {
  return readEnv(env, 'APP_PORT') ?? readEnv(env, 'PORT') ?? '8000'
}

export function getAppHost(env: NodeJS.ProcessEnv = process.env): string {
  return (
    readEnv(env, 'APP_HOST') ??
    readEnv(env, 'HOST') ??
    readEnv(env, 'HOSTNAME') ??
    '0.0.0.0'
  )
}

export function getAppBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return (
    readEnv(env, 'APP_BASE_URL') ??
    readEnv(env, 'AUTH_URL') ??
    readEnv(env, 'KITE_BASE_URL')
  )
}

export function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const directUrl = readEnv(env, 'DATABASE_URL')
  if (directUrl) {
    return directUrl
  }

  const username = readEnv(env, 'POSTGRES_USER')
  const password = readEnv(env, 'POSTGRES_PASSWORD')
  const database = readEnv(env, 'POSTGRES_DB')

  if (!username || !password || !database) {
    throw new Error(
      'DATABASE_URL is not set. Provide DATABASE_URL or POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB.',
    )
  }

  const host = readEnv(env, 'DB_HOST') ?? '127.0.0.1'
  const port = readEnv(env, 'DB_PORT') ?? '5432'
  const sslmode = readEnv(env, 'DB_SSLMODE')
  const channelBinding = readEnv(env, 'DB_CHANNEL_BINDING')

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
