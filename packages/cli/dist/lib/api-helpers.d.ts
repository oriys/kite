interface DocumentItem {
    id: string;
    title: string;
    slug: string;
    status: string;
    content: string | null;
    updatedAt: string;
    summary?: string;
}
interface OpenapiSourceItem {
    id: string;
    name: string;
    openapiVersion?: string;
    sourceType: string;
    lastSyncedAt?: string;
}
interface EndpointItem {
    method: string;
    path: string;
    summary?: string;
    operationId?: string;
    deprecated?: boolean;
    tags?: string[];
}
interface SearchResult {
    documentId: string;
    title: string;
    slug?: string;
    preview?: string;
    score?: number;
}
export declare function fetchDocuments(opts?: {
    status?: string;
    limit?: number;
    query?: string;
}): Promise<{
    items: DocumentItem[];
    total?: number;
}>;
export declare function fetchDocument(slugOrId: string): Promise<DocumentItem | null>;
export declare function fetchOpenapiSources(): Promise<{
    items: OpenapiSourceItem[];
}>;
export declare function fetchOpenapiEndpoints(sourceId: string): Promise<{
    endpoints: EndpointItem[];
}>;
export declare function searchDocuments(query: string, limit?: number): Promise<{
    results: SearchResult[];
}>;
export {};
