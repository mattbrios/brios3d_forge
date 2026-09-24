# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - When a criterion says every null field is shown blank, test every field the screen renders, not a sample
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `web` · harmful: 0
- features: phase-2-makerworld-profiles
- evidence: N7-N9, checks C37/C56 (web)
- last seen: 2026-09-21T22:27:32Z

### L-002 - When a criterion says empty about a two-state control such as a checkbox, write which state that is before the test
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `web` · harmful: 0
- features: phase-2-makerworld-profiles
- evidence: checks.md:231, C56 (web)
- last seen: 2026-09-21T22:27:33Z

### L-003 - Test that a selected item is shown with a fixture where the selected item is not the first one
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `web` · harmful: 0
- features: phase-2-makerworld-profiles
- evidence: I6, C36/C55 (web)
- last seen: 2026-09-21T22:27:33Z

### L-004 - When tests reach an external client over a different scheme than production, add a proof that the production transport is used
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `api` · harmful: 0
- features: phase-2-makerworld-profiles
- evidence: F9, C42 (api)
- last seen: 2026-09-21T22:27:33Z

### L-005 - Assert per-item values and ordering of aggregated lists with out-of-order input, not only the totals
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `api` · harmful: 0
- features: phase-2-makerworld-profiles
- evidence: H2/H16, C52/C53 (api)
- last seen: 2026-09-21T22:27:33Z

### L-006 - When a limit is checked and then counted across an await, count the attempt before the first await and prove it with simultaneous requests
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `api` · harmful: 0
- features: phase-3-auth
- evidence: verification.md gap 1, auth.service.ts:38/:84, C53 (api)
- last seen: 2026-09-22T02:23:49Z

### L-007 - Make every proof test build its own state so it passes when run alone with its selector
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `api` · harmful: 0
- features: phase-3-auth
- evidence: verification.md gap 2, C12 auth.e2e-spec.ts:203, C31 admin-seed.e2e-spec.ts:80 (api)
- last seen: 2026-09-22T02:23:49Z

### L-008 - Give every defensive branch a proof, including catch blocks and size-triggered cleanup
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `api` · harmful: 0
- features: phase-3-auth
- evidence: verification.md gaps 3-4, password.ts:45, login-attempts.ts:48-56 (api)
- last seen: 2026-09-22T02:23:49Z

### L-009 - Pin a time window at its exact edge on both sides, not one step past it
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · harmful: 0
- features: phase-3-auth
- evidence: verification.md gap 6, C26 login-attempts.ts:33
- last seen: 2026-09-22T02:23:49Z

### L-010 - When a fix counts an attempt up front, prove at the route that the success path undoes the count
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `api` · harmful: 0
- features: phase-3-auth
- evidence: verification.md round 2 F5, auth.service.ts:58, C57 (api)
- last seen: 2026-09-22T02:34:19Z

### L-011 - Prove a reset with a sequence where the success is not the attempt that triggers the limit
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `api` · harmful: 0
- features: phase-3-auth
- evidence: verification.md round 3 G2, auth.service.ts:58, C57 (api)
- last seen: 2026-09-22T02:45:02Z

### L-012 - Give tests that hash passwords repeatedly an explicit timeout well above their measured duration
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `api` · harmful: 0
- features: phase-3-auth
- evidence: verification.md round 3 gap 4, auth.e2e-spec.ts:305 C57 timeout at 5000 ms (api)
- last seen: 2026-09-22T02:45:02Z

### L-013 - When a business rule is implemented independently in two code paths (e.g. DTO validation on create, service-level revalidation on update), each path needs its own proof; a green suite covering only the first leaves the second unprotected
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `validation` · harmful: 0
- features: phase-6-materials
- evidence: materials.service.ts:90 (round 1 mutant: finalDryingHours > 0 -> >= 0) (validation)
- last seen: 2026-09-23T02:03:59Z

### L-014 - When a CRUD screen has create, edit and toggle flows copied from an existing pattern, write a test for every flow (including edit) before declaring the screen covered — a suite that only exercises create/toggle leaves the edit submit handler with zero coverage.
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `web-crud-screens` · harmful: 0
- features: phase-8-customers-suppliers
- evidence: web/src/app/(app)/customers/page.tsx:152-154 (F6, verification.md 67785ec round 1) (web-crud-screens)
- last seen: 2026-09-23T13:29:00Z

### L-015 - When an AC or ADR fixes an error response shape like { error }, assert the response body on every status code path that returns it, not only on the ones convenient to check (e.g. 401/403) — 400 and 409 need the same body assertion.
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `api-error-contract` · harmful: 0
- features: phase-8-customers-suppliers
- evidence: api/test/customers.e2e-spec.ts:115,127 (round 1, before e0dfb4c) (api-error-contract)
- last seen: 2026-09-23T13:29:00Z

### L-016 - When a check claims two records coexist under a relaxed uniqueness constraint (e.g. a unique-when-present column), assert the coexistence within the same test before any cleanup runs — a loop that deletes rows between iterations, or that only ever creates one record, never actually proves coexistence even though it looks like it does.
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `api-uniqueness-constraints` · harmful: 0
- features: phase-8-customers-suppliers
- evidence: checks.md Test policy row 2 / api/test/customers.e2e-spec.ts:87 (round 1, before e0dfb4c) (api-uniqueness-constraints)
- last seen: 2026-09-23T13:29:01Z

### L-017 - Prove a database constraint used as a concurrency backstop by forcing the constraint violation itself, not by an application-level guard that answers first
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `persistence` · harmful: 0
- features: phase-9-filament-inventory
- evidence: api/src/modules/inventory/is-check-violation.ts:3 (fault 3, C16) (persistence)
- last seen: 2026-09-23T16:24:41Z

### L-018 - Assert every value of a runtime-derived response field explicitly, never by reusing a test that only asserts the columns it is derived from
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `api-contract` · harmful: 0
- features: phase-9-filament-inventory
- evidence: api/src/modules/inventory/inventory.types.ts:10,13 (fault 4, C16/C17) (api-contract)
- last seen: 2026-09-23T16:24:41Z

### L-019 - Never mock the transaction wrapper in a test whose claim is the rollback; assert the absence of the persisted row instead
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `persistence` · harmful: 0
- features: phase-9-filament-inventory
- evidence: api/src/modules/inventory/inventory.service.spec.ts:36 (C5) (persistence)
- last seen: 2026-09-23T16:24:41Z

### L-020 - Cover both sides of a role matrix: assert that each allowed role gets 200, not only that the denied role gets 403
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `authorization` · harmful: 0
- features: phase-9-filament-inventory
- evidence: api/src/modules/inventory/inventory.controller.ts:30,36,42 (Coverage: matriz de papéis) (authorization)
- last seen: 2026-09-23T16:24:41Z

### L-021 - Give every query filter declared in the plan's Surface its own proof, especially one whose SQL duplicates a rule already implemented in application code
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `routes` · harmful: 0
- features: phase-9-filament-inventory
- evidence: api/src/modules/inventory/inventory.service.ts:112-114 (Coverage: filtros de query) (routes)
- last seen: 2026-09-23T16:24:41Z

### L-022 - Check that each Coverage member's cited proof actually asserts that member before freezing the checks, since a wrong mapping passes every later step
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `process` · harmful: 0
- features: phase-9-filament-inventory
- evidence: .specs/features/phase-9-filament-inventory/verification.md (validate_verification exit 1) (process)
- last seen: 2026-09-23T16:24:42Z

### L-023 - For every optional foreign key a route accepts, assert the accepted side too: one test that sends an existing id and reads the id back from the response, not only the 400 for an unknown id
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `api-routes` · harmful: 0
- features: phase-10-stock-items
- evidence: verification.md fault #5 - api/src/modules/inventory/inventory.service.ts:572-580 (api-routes)
- last seen: 2026-09-23T22:00:28Z

### L-024 - A concurrency proof built on Promise.all over two HTTP requests is non-deterministic: make the interleaving forced, or the test passes under an in-memory pre-check most of the time
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `concurrency` · harmful: 0
- features: phase-10-stock-items
- evidence: verification.md fault #4 - api/test/stock-items.e2e-spec.ts:415-426 (concurrency)
- last seen: 2026-09-23T22:00:41Z

### L-025 - Give every optional field named in the plan Surface or Relations its own Coverage row, so the accepted side cannot be left out of the join
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `checks` · harmful: 0
- features: phase-10-stock-items
- evidence: verification.md Coverage - StockItem.preferredSupplierId FK opcional (3) (checks)
- last seen: 2026-09-23T22:00:41Z

### L-026 - A claim that names the mechanism deciding an outcome needs a proof that distinguishes that mechanism, not only one that observes the same status code
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `checks` · harmful: 0
- features: phase-10-stock-items
- evidence: verification.md precision gap 1 - C23 (checks)
- last seen: 2026-09-23T22:00:42Z

### L-027 - Enumerate each length and format validator of a DTO as its own refused case, instead of closing the coverage column on the enum and empty-string cases
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `api-routes` · harmful: 0
- features: phase-10-stock-items
- evidence: verification.md precision gap 2 - api/src/modules/inventory/dto/create-stock-item.dto.ts (api-routes)
- last seen: 2026-09-23T22:00:42Z

### L-028 - When a PATCH DTO re-declares the same validators as the POST DTO instead of extending it, prove the refused side on both routes: covering only the POST leaves every bound and format rule on the PATCH unproven
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `dto` · harmful: 0
- features: phase-10-stock-items
- evidence: verification.md fault #5 - api/src/modules/inventory/dto/update-stock-item.dto.ts:30 (dto)
- last seen: 2026-09-23T23:20:45Z

### L-029 - Repeat a directed e2e run before recording it green: a check that passes alone and fails once inside the batched run is a state leak in the shared test database, not noise
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: phase-10-stock-items
- evidence: verification.md Gate - api/test/stock-items.e2e-spec.ts:717 (C37, red 1 of 6 runs) (e2e)
- last seen: 2026-09-23T23:20:53Z

### L-030 - Before blaming an intermittent e2e red on a second process sharing the test database, check whether the received status is one the app can even return: a status that appears nowhere in src means the request never reached the app under test, so the leak is in the transport, not in the data
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: phase-10-stock-items
- evidence: api/test/sales-channels.e2e-spec.ts:180 (expected 426 to be 400, full suite run 1 of 4, nothing concurrent) (e2e)
- last seen: 2026-09-24T01:16:28Z

### L-031 - Call the tool before recording it as unavailable: an unchecked 'the browser tools are not exposed in this session' line skipped the walk-the-flow step for three verification rounds and propagated into every later briefing
- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `verification` · harmful: 0
- features: phase-10-stock-items
- evidence: .specs/features/phase-10-stock-items/verification.md:41 (verification)
- last seen: 2026-09-24T03:13:08Z

### L-032 - When prescribing a browser pass over an empty state, name a method that the running app can reach: with no delete route and every category populated, the empty branch is only reachable by stubbing the list response, and the handoff must say so
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `web` · harmful: 0
- features: phase-10-stock-items
- evidence: .specs/features/phase-10-stock-items/checks.md:520 (web)
- last seen: 2026-09-24T03:13:08Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
