---
name: typescript-pgsql-review
description: Review Node.js and TypeScript backend code that uses PostgreSQL for correctness, maintainability, transaction safety, migration safety, indexing, SQL performance, and security boundaries. Use when reviewing backend PRs, repository or service layers, SQL queries, schema diffs, migrations, query plans, multi-tenant data access, or incident follow-up involving Postgres behavior.
---

# TypeScript PostgreSQL Review

Review the change as an engineering review, not as style commentary. Prioritize behavioral risk, data integrity, migration safety, performance regressions, and security boundaries over superficial code cleanup.

## Review Sequence

1. Identify the review surface before reading deeply.
   Check whether the artifact is mainly:
   - TypeScript service or repository code
   - Raw SQL, query builder, or ORM usage
   - Schema diff or migration
   - Transaction or concurrency logic
   - Auth, tenancy, or access-control logic

2. Read only the references that match the change.
   - Read [references/ts-review-checklist.md](references/ts-review-checklist.md) when reviewing Node.js, service, handler, repository, or domain-layer TypeScript.
   - Read [references/pg-review-checklist.md](references/pg-review-checklist.md) when reviewing SQL, schema, indexes, query plans, or operational database changes.
   - Read [references/transaction-patterns.md](references/transaction-patterns.md) when multiple writes, retries, locking, idempotency, or consistency guarantees are involved.
   - Read [references/indexing-patterns.md](references/indexing-patterns.md) when a query introduces new filters, joins, sorts, pagination, or performance concerns.
   - Read [references/migration-safety.md](references/migration-safety.md) when a migration, backfill, constraint, index build, or rollout plan is present.
   - Read [references/security-rls-sql-injection.md](references/security-rls-sql-injection.md) when the change touches auth, tenant scoping, raw SQL composition, privileged operations, or audit data.

3. Confirm the execution path.
   Trace request input, validation, transaction boundaries, query construction, persistence, and error handling. Prefer concrete path tracing over abstract architecture judgments.

4. Produce findings in severity order.
   Start with blocker or major risks. For each issue, name the location, explain why it is risky, describe the likely production impact, and propose the narrowest viable fix.

5. State uncertainty explicitly.
   Ask for `EXPLAIN ANALYZE`, row counts, schema details, traffic shape, lock expectations, or rollout sequencing when the correctness or performance claim depends on missing evidence.

## Core Review Rules

- Prefer concrete, line-level findings over broad guidance.
- Treat unparameterized SQL, unsafe migrations, and broken tenancy boundaries as high severity by default.
- Treat missing tests as a secondary issue unless the missing test hides a likely regression.
- Distinguish facts from inference. Say when a performance or locking concern is suspected rather than proven.
- Avoid recommending architectural rewrites unless a smaller change cannot mitigate the risk.

## Output Format

Use [assets/review-report-template.md](assets/review-report-template.md) as the default shape for the review. Keep the report concise and evidence-driven:

- `summary`: one short paragraph on what was reviewed and the main risk profile
- `findings`: ordered by severity, each with location, risk, reason, and fix direction
- `needs_more_data`: only when evidence is missing for a claim
- `suggested_fixes`: concrete follow-up actions, not generic best practices

## Escalation Heuristics

- Escalate when a migration can lock a hot table, rewrite large data volumes, or break rolling deploy compatibility.
- Escalate when a query change can bypass tenant filters, degrade a hot path, or introduce N+1 behavior.
- Escalate when transaction scope spans multiple writes without a clear atomicity or retry model.
- Escalate when error handling can mask partial failure, duplicate writes, or stale reads.

## Do Not Overload Context

Do not read every reference file by default. Load only the documents required for the current review surface, then write the report.
