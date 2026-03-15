import { getApiToken, getBaseUrl } from './config.js'

export async function apiRequest(path: string, options: RequestInit = {}) {
  const token = getApiToken()
  if (!token) throw new Error('Not authenticated. Run `kite login` first.')

  const url = `${getBaseUrl()}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`API error ${response.status}: ${body}`)
  }

  return response
}
