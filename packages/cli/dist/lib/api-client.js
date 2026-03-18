import { getApiToken, getBaseUrl } from './config.js';
export async function apiRequest(path, options = {}) {
    const token = getApiToken();
    if (!token)
        throw new Error('Not authenticated. Run `kite login` first.');
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
        throw new Error('Base URL is not configured. Run `kite login --url <url>` or set KITE_BASE_URL.');
    }
    const url = `${baseUrl}${path}`;
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(url, {
        ...options,
        headers,
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`API error ${response.status}: ${body}`);
    }
    return response;
}
