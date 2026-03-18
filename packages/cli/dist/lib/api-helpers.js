import { apiRequest } from './api-client.js';
export async function fetchDocuments(opts = {}) {
    const params = new URLSearchParams();
    if (opts.status)
        params.set('status', opts.status);
    if (opts.limit)
        params.set('page_size', String(opts.limit));
    if (opts.query)
        params.set('q', opts.query);
    const res = await apiRequest(`/api/documents?${params}`);
    return res.json();
}
export async function fetchDocument(slugOrId) {
    const data = await fetchDocuments({ query: slugOrId, limit: 50 });
    return data.items.find((d) => d.slug === slugOrId || d.id === slugOrId) || null;
}
export async function fetchOpenapiSources() {
    const res = await apiRequest('/api/openapi');
    return res.json();
}
export async function fetchOpenapiEndpoints(sourceId) {
    const res = await apiRequest(`/api/openapi/${sourceId}/endpoints`);
    return res.json();
}
export async function searchDocuments(query, limit = 10) {
    const params = new URLSearchParams({
        q: query,
        mode: 'keyword',
        limit: String(limit),
    });
    const res = await apiRequest(`/api/search?${params}`);
    return res.json();
}
