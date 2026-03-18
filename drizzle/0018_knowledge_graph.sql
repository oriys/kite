-- Knowledge Graph tables for entity and relation storage

CREATE TYPE "public"."kg_entity_type" AS ENUM('endpoint', 'parameter', 'schema', 'permission', 'error_code', 'webhook', 'resource', 'data_type', 'concept', 'other');

CREATE TABLE IF NOT EXISTS "kg_entities" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "name" text NOT NULL,
  "name_normalized" text NOT NULL,
  "entity_type" "kg_entity_type" NOT NULL DEFAULT 'other',
  "description" text NOT NULL DEFAULT '',
  "embedding" vector(1536),
  "source_chunk_ids" text NOT NULL DEFAULT '',
  "source_document_ids" text NOT NULL DEFAULT '',
  "mention_count" integer NOT NULL DEFAULT 1,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "kg_relations" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "source_entity_id" text NOT NULL,
  "target_entity_id" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "keywords" text NOT NULL DEFAULT '',
  "embedding" vector(1536),
  "weight" real NOT NULL DEFAULT 1.0,
  "source_chunk_ids" text NOT NULL DEFAULT '',
  "mention_count" integer NOT NULL DEFAULT 1,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "kg_entities" ADD CONSTRAINT "kg_entities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "kg_relations" ADD CONSTRAINT "kg_relations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "kg_relations" ADD CONSTRAINT "kg_relations_source_entity_id_kg_entities_id_fk" FOREIGN KEY ("source_entity_id") REFERENCES "public"."kg_entities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "kg_relations" ADD CONSTRAINT "kg_relations_target_entity_id_kg_entities_id_fk" FOREIGN KEY ("target_entity_id") REFERENCES "public"."kg_entities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "kg_entities_workspace_id_idx" ON "kg_entities" USING btree ("workspace_id");
CREATE UNIQUE INDEX IF NOT EXISTS "kg_entities_workspace_name_idx" ON "kg_entities" USING btree ("workspace_id", "name_normalized");
CREATE INDEX IF NOT EXISTS "kg_entities_entity_type_idx" ON "kg_entities" USING btree ("workspace_id", "entity_type");

CREATE INDEX IF NOT EXISTS "kg_relations_workspace_id_idx" ON "kg_relations" USING btree ("workspace_id");
CREATE INDEX IF NOT EXISTS "kg_relations_source_entity_idx" ON "kg_relations" USING btree ("source_entity_id");
CREATE INDEX IF NOT EXISTS "kg_relations_target_entity_idx" ON "kg_relations" USING btree ("target_entity_id");
CREATE UNIQUE INDEX IF NOT EXISTS "kg_relations_workspace_pair_idx" ON "kg_relations" USING btree ("workspace_id", "source_entity_id", "target_entity_id");
