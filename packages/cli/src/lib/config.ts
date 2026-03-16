import Conf from 'conf'

const config = new Conf({ projectName: 'kite-cli' })

function readEnv(key: string): string | undefined {
  const value = process.env[key]?.trim()
  return value ? value : undefined
}

export function getApiToken(): string | undefined {
  return config.get('apiToken') as string | undefined
}

export function setApiToken(token: string) {
  config.set('apiToken', token)
}

export function getBaseUrl(): string | undefined {
  return (
    (config.get('baseUrl') as string | undefined) ||
    readEnv('KITE_BASE_URL') ||
    readEnv('APP_BASE_URL') ||
    readEnv('AUTH_URL')
  )
}

export function setBaseUrl(url: string) {
  config.set('baseUrl', url)
}

export function clearConfig() {
  config.clear()
}
