DO $$
DECLARE
  table_exists boolean;
  has_nav_order boolean;
  has_workspace_id boolean;
  pk_columns text[];
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'user_feature_preferences'
  )
  INTO table_exists;

  IF NOT table_exists THEN
    CREATE TABLE "public"."user_feature_preferences" (
      "user_id" text NOT NULL,
      "openapi_enabled" boolean DEFAULT true NOT NULL,
      "templates_enabled" boolean DEFAULT true NOT NULL,
      "ai_workspace_enabled" boolean DEFAULT true NOT NULL,
      "analytics_enabled" boolean DEFAULT true NOT NULL,
      "approvals_enabled" boolean DEFAULT true NOT NULL,
      "webhooks_enabled" boolean DEFAULT true NOT NULL,
      "link_health_enabled" boolean DEFAULT true NOT NULL,
      "quick_insert_enabled" boolean DEFAULT true NOT NULL,
      "nav_order" jsonb,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "user_feature_preferences_user_id_pk" PRIMARY KEY("user_id"),
      CONSTRAINT "user_feature_preferences_user_id_users_id_fk"
        FOREIGN KEY ("user_id")
        REFERENCES "public"."users"("id")
        ON DELETE cascade
        ON UPDATE no action
    );
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_feature_preferences'
      AND column_name = 'nav_order'
  )
  INTO has_nav_order;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_feature_preferences'
      AND column_name = 'workspace_id'
  )
  INTO has_workspace_id;

  SELECT array_agg(attribute_name ORDER BY key_ordinal)
  INTO pk_columns
  FROM (
    SELECT
      a.attname AS attribute_name,
      keys.ordinality AS key_ordinal
    FROM pg_index i
    JOIN pg_class c
      ON c.oid = i.indrelid
    JOIN pg_namespace n
      ON n.oid = c.relnamespace
    JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS keys(attnum, ordinality)
      ON TRUE
    JOIN pg_attribute a
      ON a.attrelid = c.oid
     AND a.attnum = keys.attnum
    WHERE n.nspname = 'public'
      AND c.relname = 'user_feature_preferences'
      AND i.indisprimary
  ) AS pk_attributes;

  IF has_workspace_id OR COALESCE(pk_columns, ARRAY[]::text[]) <> ARRAY['user_id']::text[] THEN
    CREATE TABLE "public"."user_feature_preferences__new" (
      "user_id" text NOT NULL,
      "openapi_enabled" boolean DEFAULT true NOT NULL,
      "templates_enabled" boolean DEFAULT true NOT NULL,
      "ai_workspace_enabled" boolean DEFAULT true NOT NULL,
      "analytics_enabled" boolean DEFAULT true NOT NULL,
      "approvals_enabled" boolean DEFAULT true NOT NULL,
      "webhooks_enabled" boolean DEFAULT true NOT NULL,
      "link_health_enabled" boolean DEFAULT true NOT NULL,
      "quick_insert_enabled" boolean DEFAULT true NOT NULL,
      "nav_order" jsonb,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      CONSTRAINT "user_feature_preferences__new_user_id_pk" PRIMARY KEY("user_id"),
      CONSTRAINT "user_feature_preferences__new_user_id_users_id_fk"
        FOREIGN KEY ("user_id")
        REFERENCES "public"."users"("id")
        ON DELETE cascade
        ON UPDATE no action
    );

    EXECUTE '
      INSERT INTO "public"."user_feature_preferences__new" (
        "user_id",
        "openapi_enabled",
        "templates_enabled",
        "ai_workspace_enabled",
        "analytics_enabled",
        "approvals_enabled",
        "webhooks_enabled",
        "link_health_enabled",
        "quick_insert_enabled",
        "nav_order",
        "updated_at"
      )
      SELECT
        "user_id",
        "openapi_enabled",
        "templates_enabled",
        "ai_workspace_enabled",
        "analytics_enabled",
        "approvals_enabled",
        "webhooks_enabled",
        "link_health_enabled",
        "quick_insert_enabled",
        ' || CASE WHEN has_nav_order THEN '"nav_order"' ELSE 'NULL::jsonb' END || ',
        "updated_at"
      FROM (
        SELECT DISTINCT ON ("user_id")
          "user_id",
          "openapi_enabled",
          "templates_enabled",
          "ai_workspace_enabled",
          "analytics_enabled",
          "approvals_enabled",
          "webhooks_enabled",
          "link_health_enabled",
          "quick_insert_enabled",
          ' || CASE WHEN has_nav_order THEN '"nav_order",' ELSE '' END || '
          "updated_at"
        FROM "public"."user_feature_preferences"
        ORDER BY "user_id", "updated_at" DESC
      ) AS deduped
    ';

    DROP TABLE "public"."user_feature_preferences";

    ALTER TABLE "public"."user_feature_preferences__new"
      RENAME TO "user_feature_preferences";

    ALTER TABLE "public"."user_feature_preferences"
      RENAME CONSTRAINT "user_feature_preferences__new_user_id_pk"
      TO "user_feature_preferences_user_id_pk";

    ALTER TABLE "public"."user_feature_preferences"
      RENAME CONSTRAINT "user_feature_preferences__new_user_id_users_id_fk"
      TO "user_feature_preferences_user_id_users_id_fk";

    RETURN;
  END IF;

  IF NOT has_nav_order THEN
    ALTER TABLE "public"."user_feature_preferences"
      ADD COLUMN "nav_order" jsonb;
  END IF;
END
$$;
