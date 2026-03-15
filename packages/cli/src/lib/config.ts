import Conf from 'conf'

const config = new Conf({ projectName: 'kite-cli' })

export function getApiToken(): string | undefined {
  return config.get('apiToken') as string | undefined
}

export function setApiToken(token: string) {
  config.set('apiToken', token)
}

export function getBaseUrl(): string {
  return (config.get('baseUrl') as string) || 'http://localhost:3000'
}

export function setBaseUrl(url: string) {
  config.set('baseUrl', url)
}

export function clearConfig() {
  config.clear()
}
