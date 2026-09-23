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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
