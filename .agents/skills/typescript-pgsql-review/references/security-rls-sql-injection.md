# Security, RLS, and SQL Injection

Read this file when the change affects tenant scoping, authorization, admin operations, audit trails, or raw SQL composition.

## SQL Construction

- Require parameterized values for user input and derived runtime values.
- Treat identifier interpolation as dangerous unless names come from a small allowlist.
- Flag helper functions that concatenate `WHERE`, `ORDER BY`, or `LIMIT` fragments from request parameters without strict control.

## Tenant and Auth Boundaries

- Check whether every repository path applies the tenant or ownership predicate that the business rule requires.
- Check whether admin bypasses are explicit, narrow, and separately reviewed.
- Check whether background jobs and batch maintenance code preserve the same access assumptions as request handlers.

## Row-Level Security

- If RLS is part of the architecture, check whether new tables and query paths are covered.
- Check whether service-role usage is limited to places that truly require it.
- Check whether tests or review notes prove that unauthorized rows remain inaccessible.

## Error and Audit Handling

- Flag errors that expose raw SQL, schema names, credentials, or internal topology.
- Check whether audit logs omit secrets and sensitive payloads while still preserving operator accountability.
- Check whether privileged actions are distinguishable from normal user actions in logs and review trails.
