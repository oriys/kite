-- Add embedding_model_id columns for vector space versioning
-- Tracks which model generated each embedding to detect stale vectors

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS embedding_model_id TEXT;

ALTER TABLE kg_entities
  ADD COLUMN IF NOT EXISTS embedding_model_id TEXT;

ALTER TABLE kg_relations
  ADD COLUMN IF NOT EXISTS embedding_model_id TEXT;
