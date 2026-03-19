# Transaction Patterns

Read this file when the change coordinates multiple writes, retries, locks, or consistency-sensitive reads.

## Review Questions

- Is the transaction boundary owned in one place, or can nested helpers open conflicting transactions?
- Does the transaction include every write that must succeed or fail together?
- Are external side effects kept outside the transaction, or guarded by an outbox/idempotency pattern?
- Can retries re-run safely without duplicate inserts or repeated external work?
- Does the read-before-write logic need `FOR UPDATE`, optimistic locking, or a uniqueness constraint to stay correct under concurrency?

## Common Failure Modes

- Starting a transaction too early and holding locks while doing non-database work
- Mixing transactional and non-transactional repository calls in one code path
- Catching an error inside the transaction and continuing as if the unit of work is still valid
- Retrying on every error instead of only on transient, known-safe failure classes

## Review Guidance

- Prefer short transactions with explicit ownership.
- Prefer database-enforced invariants over "check then insert" logic alone.
- Prefer idempotency keys, unique constraints, or upsert patterns when duplicate execution is plausible.
- Prefer naming the isolation or lock assumption when correctness depends on it.
