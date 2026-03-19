# TODOS

## Completed

### API cron endpoint for background jobs

**What:** Add `/api/ops/cron` route calling all three background processors.
**Why:** Scheduled publications, webhook retries, and channel retries were dead code.
**Completed:** 2026-03-20

### Add approval check to scheduled publisher

**What:** Add `getApprovedApprovalForDocument()` check before `transitionDocument()`.
**Why:** Scheduled publisher bypassed approval gate.
**Completed:** 2026-03-20

### Full test suite for publication/approval system

**What:** 59 new tests: risk classifier, backoff delay, preflight logic, approval threshold, link extraction, rate limiter, pagination, scheduled publisher integration.
**Why:** Business-critical publication/approval code had zero tests.
**Completed:** 2026-03-20

### Rate limit critical API endpoints

**What:** In-memory token bucket rate limiter on `/api/ai/chat`, `/api/ai/generate-docs`, `/api/search`, `/api/error-reports`.
**Why:** No rate limiting on 45+ routes. AI endpoints cost real money per request.
**Completed:** 2026-03-20

### Add missing database indexes

**What:** Composite indexes on `webhookDeliveries(status, attemptCount)`, `channelDeliveries(status, attemptCount)`, `approvalRequests(policyId)`.
**Why:** Retry queries did full table scans.
**Completed:** 2026-03-20

### Extract unified event emission helper

**What:** Created `lib/resource-events.ts` with `emitResourceEvent()`. Refactored 4 routes.
**Why:** DRY violation — 3-call pattern copy-pasted across routes with silent error swallowing.
**Completed:** 2026-03-20

### Add LIMIT to unbounded queries

**What:** Added safety limits to `listDocuments` (500), `listDocumentComments` (1000), `getEndpointsBySource` (500), `listAiProviderConfigs` (100), `listMcpServerConfigs` (100), `listEnabledMcpServerConfigs` (100).
**Why:** Unbounded `findMany()` queries risked OOM as workspaces grow.
**Completed:** 2026-03-20

### Fix N+1 queries in retry and scheduler

**What:** Batch-load webhooks/channels/documents before processing loops using `inArray()` + Map lookup.
**Why:** Up to 50 individual DB queries per retry cycle.
**Completed:** 2026-03-20

### Standardize pagination across API routes

**What:** Created `lib/pagination.ts` with `parsePagination()`. Refactored `documents`, `audit-logs` routes.
**Why:** Inconsistent page/pageSize vs limit/offset across routes.
**Completed:** 2026-03-20

### Decompose ai-chat.ts god file (partial)

**What:** Extracted `lib/ai/chat-sessions.ts` (107 lines) and `lib/ai/visibility-filter.ts` (39 lines) from `ai-chat.ts`. Reduced main file from 2,415 to 2,303 lines.
**Why:** 2,415-line monolith. Module structure now in place for incremental extraction.
**Completed:** 2026-03-20 (partial — session CRUD and visibility filter extracted, deeper extraction deferred)

## Deferred Design Findings

### FINDING-007: Editor toolbar overflow on mobile
**Impact:** Medium | **Category:** Responsive
**What:** On mobile (375px), the editor toolbar hides most formatting buttons with no scroll indicator or overflow menu.
**Fix:** Add horizontal scroll with fade indicator, or collapse formatting tools into a "Format" button.

### FINDING-010: Agent page empty loading spinner
**Impact:** Medium | **Category:** Content Quality
**What:** Left panel shows a permanent loading spinner in a grey box with no skeleton or context.
**Fix:** Replace with skeleton placeholder matching expected content shape.

### FINDING-012: Dark mode badge contrast
**Impact:** Medium | **Category:** Color & Contrast
**What:** Draft/Published badges use same colors in dark mode — yellow on dark may have insufficient contrast.
**Fix:** Use desaturated/darker badge backgrounds in dark mode with lighter text.
