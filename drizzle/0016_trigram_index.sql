CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS documents_title_trgm_idx
  ON documents USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS documents_content_trgm_idx
  ON documents USING GIN (content gin_trgm_ops);
