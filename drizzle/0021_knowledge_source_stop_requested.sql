ALTER TABLE knowledge_sources
ADD COLUMN IF NOT EXISTS stop_requested_at TIMESTAMP;
