# Migration Safety

Read this file when reviewing DDL, schema diffs, backfills, constraint changes, or rollout plans.

## Safe Rollout Model

Prefer an expand, migrate, contract sequence when old and new application versions may run at the same time.

## Review Questions

- Does the migration rewrite the whole table or take an access-exclusive lock on a hot table?
- Is a default value, constraint validation, or index build likely to block writes?
- Can the application run safely before, during, and after the migration?
- Is a backfill chunked and resumable instead of one large transaction?
- Is rollback defined, or is the migration intentionally forward-only with a recovery plan?

## High-Risk Patterns

- Adding a non-null column with an immediate default to a large active table
- Building indexes without considering concurrent options where applicable
- Combining schema change and large data rewrite in the same deploy step
- Dropping columns or constraints before all callers are migrated
- Renaming columns without a compatibility layer

## What to Ask For

- traffic expectations for the affected table
- estimated table size and write rate
- rollout order across services and jobs
- backfill strategy and pause/resume behavior
