-- Add missing 'cancelled' value to knowledge_source_status enum
ALTER TYPE "knowledge_source_status" ADD VALUE IF NOT EXISTS 'cancelled';

-- Add HNSW vector indexes for RAG pipeline performance
-- These must be run outside a transaction for CONCURRENTLY
-- If your migration runner doesn't support non-transactional, run manually:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS kg_entities_embedding_idx ON kg_entities USING hnsw (embedding vector_cosine_ops);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS kg_relations_embedding_idx ON kg_relations USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS kg_entities_embedding_idx ON kg_entities USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS kg_relations_embedding_idx ON kg_relations USING hnsw (embedding vector_cosine_ops);
