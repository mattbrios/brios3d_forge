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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
