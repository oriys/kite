# TypeScript Review Checklist

Use this checklist when reviewing Node.js or TypeScript backend code that talks to PostgreSQL.

## Boundary Discipline

- Check whether request parsing and input validation happen at the boundary, before persistence logic runs.
- Check whether transport DTOs, domain objects, and database row shapes are separated instead of being reused interchangeably.
- Check whether handlers, services, repositories, and low-level database helpers each have a clear responsibility.

## Type Safety

- Flag `any`, unchecked type assertions, or broad casts that hide invalid data crossing into business logic.
- Flag nullable database fields that are treated as always present without an explicit guard.
- Flag helper functions that erase domain meaning by returning overly generic records or maps.

## Async and Error Handling

- Check whether all promises that must complete are awaited.
- Check whether concurrent writes can race or duplicate work.
- Check whether retry logic is safe for idempotency, especially around inserts, payments, provisioning, or external side effects.
- Check whether errors preserve enough context to debug the failing query or business operation without leaking secrets.

## Repository and Query Construction

- Check whether repositories return domain-relevant shapes instead of leaking driver-specific row objects everywhere.
- Check whether query helpers centralize tenant scoping, soft-delete filters, and common constraints instead of relying on each caller to remember them.
- Flag "generic repository" abstractions that obscure SQL behavior, transaction ownership, or lock semantics.

## Maintainability Signals

- Flag oversized handlers or services that mix validation, orchestration, SQL construction, and mapping.
- Flag hidden side effects in utility functions.
- Flag duplicated query fragments or ad hoc condition building that is likely to drift.

## Testing Expectations

- Expect integration coverage for repository behavior that depends on SQL semantics, transactions, or constraints.
- Expect tests for failure paths when the code coordinates multiple writes or retries.
- Treat missing tests as supporting evidence, not the primary finding, unless the gap masks a concrete regression.
