CREATE TYPE "public"."invite_type" AS ENUM('email', 'link');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'disabled');--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'invite';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'member_add';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'member_remove';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'role_change';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'team_create';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'team_update';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'team_delete';--> statement-breakpoint
CREATE TABLE "team_members" (
	"team_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"parent_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workspace_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"token" text NOT NULL,
	"type" "invite_type" NOT NULL,
	"invited_by" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "workspace_invites" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "workspace_invites" ALTER COLUMN "role" SET DEFAULT 'member'::text;--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "role" SET DEFAULT 'member'::text;--> statement-breakpoint
UPDATE "workspace_members" SET "role" = 'member' WHERE "role" = 'editor';--> statement-breakpoint
UPDATE "workspace_members" SET "role" = 'guest' WHERE "role" = 'viewer';--> statement-breakpoint
DROP TYPE "public"."member_role";--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'member', 'guest');--> statement-breakpoint
ALTER TABLE "workspace_invites" ALTER COLUMN "role" SET DEFAULT 'member'::"public"."member_role";--> statement-breakpoint
ALTER TABLE "workspace_invites" ALTER COLUMN "role" SET DATA TYPE "public"."member_role" USING "role"::"public"."member_role";--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "role" SET DEFAULT 'member'::"public"."member_role";--> statement-breakpoint
ALTER TABLE "workspace_members" ALTER COLUMN "role" SET DATA TYPE "public"."member_role" USING "role"::"public"."member_role";--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "status" "member_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "invited_by" text;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_members_team_id_idx" ON "team_members" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "team_members_user_id_idx" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "teams_workspace_id_idx" ON "teams" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "teams_parent_id_idx" ON "teams" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "workspace_invites_workspace_id_idx" ON "workspace_invites" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_invites_email_idx" ON "workspace_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "workspace_invites_token_idx" ON "workspace_invites" USING btree ("token");--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;