# Indexing Patterns

Read this file when the change adds or modifies filters, joins, ordering, grouping, or pagination.

## What to Check

- Match the index to the real predicate order and sort order used by the query.
- Check whether the leading columns of a composite index align with the most selective, consistently used filters.
- Check whether a partial index would be more effective for sparse predicates like `deleted_at IS NULL` or status-based hot paths.
- Check whether the query can use an index-only plan or whether it will still thrash on heap fetches.

## Common Review Findings

- Index exists, but not on the join or sort columns that dominate the plan.
- Composite index columns are in the wrong order for the query's access path.
- Query sorts on a different column than the available index supports.
- Offset pagination on large tables creates avoidable work; keyset pagination may be safer for hot paths.
- New multi-column filters are added without revisiting older single-column indexes.

## Evidence to Request

- `EXPLAIN ANALYZE`
- representative row counts
- estimated cardinality of the filtered subset
- expected request frequency for the path
