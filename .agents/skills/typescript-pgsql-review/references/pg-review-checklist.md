# PostgreSQL Review Checklist

Use this checklist when reviewing SQL, schema changes, indexes, migrations, or incident fixes related to PostgreSQL.

## Query Safety

- Require parameterized SQL for every dynamic value.
- Flag string-built SQL unless the only interpolation is a vetted identifier path with strict allowlisting.
- Check whether tenant filters, soft-delete filters, and auth predicates are present on every path that needs them.

## Query Performance

- Check whether filter, join, and sort columns are backed by indexes that match the actual access pattern.
- Check whether pagination is stable and selective enough for the expected table size.
- Flag N+1 query shapes, repeated lookups in loops, and unnecessary round trips.
- Ask for `EXPLAIN ANALYZE` when a hot path query changes or when selectivity is unclear.

## Data Integrity

- Check whether uniqueness, foreign keys, and constraints encode the invariants instead of relying only on application logic.
- Check whether updates that must be atomic occur inside one transaction.
- Check whether concurrent writers can produce lost updates, duplicate rows, or stale reads.

## Operational Risk

- Check whether new indexes, constraints, or table rewrites are safe for the expected traffic level.
- Check whether connection usage, transaction duration, and lock scope are bounded.
- Flag long-running transactions, idle transactions, or migrations that combine DDL with large backfills.

## Evidence Threshold

- State clearly when a concern is proven versus suspected.
- If performance claims depend on row counts, distribution, or cache behavior, ask for production-like evidence.
