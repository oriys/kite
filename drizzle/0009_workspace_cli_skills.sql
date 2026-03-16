DO $$ BEGIN
  CREATE TYPE "public"."cli_skill_source_type" AS ENUM('github', 'registry', 'custom');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace_cli_skills" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "source_type" "cli_skill_source_type" NOT NULL,
  "source" text NOT NULL,
  "ref" text,
  "computed_hash" text,
  "prompt" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "installed_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "workspace_cli_skills"
    ADD CONSTRAINT "workspace_cli_skills_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "workspace_cli_skills"
    ADD CONSTRAINT "workspace_cli_skills_installed_by_users_id_fk"
    FOREIGN KEY ("installed_by") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_cli_skills_workspace_slug_idx"
  ON "workspace_cli_skills" USING btree ("workspace_id", "slug");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_cli_skills_workspace_idx"
  ON "workspace_cli_skills" USING btree ("workspace_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_cli_skills_enabled_idx"
  ON "workspace_cli_skills" USING btree ("workspace_id", "enabled");
