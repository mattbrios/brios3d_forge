# Fase 5 — Configurações globais e canais de venda verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 4de1ff0..HEAD (HEAD = a988d0e)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Scope note: round 2 is bounded by the fix diff `1c9c32c..a988d0e` (one commit, `a988d0e`,
touching only `api/test/sales-channels.e2e-spec.ts` - confirmed via `git diff --stat 1c9c32c..a988d0e`)
plus round 1's two non-PASS rows (the `PATCH` combined-rate `==1` boundary and the sales-channels
DTO field-level validation). Everything else carries forward from `1c9c32c` per round 1's report,
whose own re-derivation is not repeated here.

## Binding sources

carried from 1c9c32c - the fix touched no interface, screen or contract; step 1 does not re-run.
Note carried from round 1: the `## Relations` row's `Uncovered` cell is `-` because the ERD's
logical `Settings 1—N FixedCostItem` / no-FK-for-`SalesChannel` relation is implemented as a plain
`settingsId` column plus a raw-SQL FK (deliberate, documented in `fixed-cost-item.entity.ts:1-7`
to avoid a TypeORM circular-import `ReferenceError`) - round 1 judged this not a contradiction
since the plan never mandates a TypeORM `@ManyToOne`.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `plan.md` `## Surface` (5 routes, statuses) | carried from 1c9c32c | none | - |
| `plan.md` `## Landing` (3 one-way doors) | carried from 1c9c32c | none | - |
| `plan.md` `## Relations` | carried from 1c9c32c | none | - |
| `plan.md` `## Observable` | carried from 1c9c32c | none | - |
| `plan.md` `## Criteria` AC1-AC35 | carried from 1c9c32c | none | - |

## Checks

C1-C14, C16-C21, C23-C35: carried from 1c9c32c (untouched by the fix; re-run as part of the full
`test:e2e` gate at `a988d0e` below with no change in outcome).

C15 and C22 re-verified at `a988d0e` because the fix's diff touches the same test file and the
`==1` boundary bears directly on C22's own claim.

Setup: reused the running `brios3d_forge-db-1` (Postgres 17, healthy) via a scratch git worktree
(`git worktree add <scratch> a988d0e`, see Faults) with `.env` populated from `.env.example` and
`node_modules` symlinked from the tracked checkout (no install needed, `package.json`/lockfile
unchanged by the fix).

Targeted proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts --reporter=verbose`
→ `Test Files 1 passed (1)`, `Tests 17 passed (17)` (16 from round 1 + 1 new).
Full-suite proof: `npm --prefix api run test:e2e` → `Test Files 14 passed (14)`, `Tests 123 passed
(123)` (122 in round 1 + 1 new test; no regression).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C15 | combined rate ==1 and >1 both 400 on POST | `-t "rejects a channel whose combined rate reaches 100%"` | assertions unchanged by the fix | PASS - verified at a988d0e |
| C22 | PATCH combined rate final-values, now both ==1 and >1 → 400 | `-t "PATCH validates the combined rate using the final values"` | `api/test/sales-channels.e2e-spec.ts:254-256` - `for (const feeRate of [0.3, 0.31]) { ...; expect(response.status).toBe(400); }` - `0.3` is the exact `1.0` boundary (`0.5 + 0.2 + 0.3`), `0.31` is `1.01` | PASS - verified at a988d0e |
| (new test, strengthens Test policy row 5 / Coverage DTO row) | DTO validation rejects invalid taxRate, feeRate, name on create and patch | `-t "DTO validation rejects invalid taxRate, feeRate and name on create and patch"` | `api/test/sales-channels.e2e-spec.ts:159-187` - loops 6 invalid POST bodies (empty name, 101-char name, taxRate -0.01, taxRate 1, feeRate -0.01, feeRate 1) each asserting `expect(response.status).toBe(400)` (line 170), confirms 0 rows created (line 173), then 5 invalid PATCH bodies (empty name, taxRate -0.01, taxRate 1, feeRate -0.01, feeRate 1) each asserting `expect(response.status).toBe(400)` (line 180), then confirms the target row's `name`/`tax_rate`/`fee_rate` are unchanged (line 186) | PASS - verified at a988d0e |
| C1-C14, C16-C21, C23-C35 | (as in round 1) | full `test:e2e` gate | unchanged from round 1's citations; re-run green at `a988d0e` | PASS - carried from 1c9c32c |

## Coverage

carried from 1c9c32c except the two rows the fix targeted, recomputed at `a988d0e`. Both were
`Unproven` in round 1 (`PATCH×==1` on the combined-rate boundary, and the sales-channels DTOs'
field-level boundaries); the fix's new/extended tests close both, so their `Unproven` cells are
now `-`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| combined-rate boundary (verb x value) (4) | `sales-channels.service.ts:31,59` | POST×==1 C15 · POST×>1 C15 · PATCH×==1 (new, `sales-channels.e2e-spec.ts:254-256` `feeRate:0.3`) · PATCH×>1 C22 (same lines, `feeRate:0.31`) | - |
| `CreateSalesChannelDto`/`UpdateSalesChannelDto` field boundaries - name empty/too-long, taxRate/feeRate Min(0)/IsBelowOne, on both POST and PATCH (10) | `dto/create-sales-channel.dto.ts:6-20`, `dto/update-sales-channel.dto.ts` | name empty (POST `sales-channels.e2e-spec.ts:161`, PATCH `:177`) · name 101 chars (POST `:162`) · taxRate<0 (POST `:163`, PATCH `:177`) · taxRate==1 (POST `:164`, PATCH `:177`) · feeRate<0 (POST `:165`, PATCH `:177`) · feeRate==1 (POST `:166`, PATCH `:177`), all in the single new test at `:159-187` | - |
| all other rows (routes' statuses, doors, roles, settings percentage/money boundaries, fixedCostItems items, seed, screen states, UI by role, menu items) | carried from 1c9c32c | carried from 1c9c32c | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `SalesChannelsService` combined-rate boundary | `sales-channels.service.ts:31,59` | e2e on POST and PATCH, exact `1` and `>1`, both verbs | yes - verified at a988d0e. PATCH now exercises `feeRate: 0.3` (exact `1.0`) and `0.31` (`1.01`), `sales-channels.e2e-spec.ts:254-256`. Confirmed by re-injecting the same `>=`→`>` mutant at `sales-channels.service.ts:59`: now killed, see Faults |
| DTOs of `settings`/`sales-channels`, "cada regra do class-validator, incluindo as bordas" | `update-settings.dto.ts`, `create-sales-channel.dto.ts`, `update-sales-channel.dto.ts` | e2e table-driven per DTO | yes - verified at a988d0e. `UpdateSettingsDto` unchanged, carried from 1c9c32c. `CreateSalesChannelDto`/`UpdateSalesChannelDto`'s `Min(0)`, `IsBelowOne`, `IsNotEmpty`, `Length(1,100)` are each now independently exercised by the new test, `sales-channels.e2e-spec.ts:159-187`. Confirmed by re-injecting the same `@Min(0)`-removal mutant on `taxRate`: now killed, see Faults |
| all other rows - guard applied, settings percentage/money boundary, fixedCostItems substitution, screen components | carried from 1c9c32c | carried from 1c9c32c | yes - carried from 1c9c32c |

## Faults injected

Isolation: `git worktree add <scratch> a988d0e` at `/private/tmp/.../scratchpad/verify-wt`
(outside the tracked worktree area). Baseline `git status --porcelain` on the agent's tracked
worktree was empty before and after each injection; confirmed clean after `git worktree remove
--force`. Both mutants are the exact two that survived round 1, re-injected at the new HEAD
against the strengthened tests.

| Mutation | Location | Killed |
| --- | --- | --- |
| `>= 1` → `> 1` in `update()` combined-rate check | `sales-channels.service.ts:59` | yes - was no in round 1. `sales-channels.e2e-spec.ts -t "PATCH validates the combined rate using the final values"` fails: `AssertionError: expected 200 to be 400` at line 256, on the `feeRate: 0.3` (exact-boundary) iteration |
| removed `@Min(0)` from `CreateSalesChannelDto.taxRate` | `dto/create-sales-channel.dto.ts:12-13` | yes - was no in round 1. `sales-channels.e2e-spec.ts -t "DTO validation rejects invalid taxRate, feeRate and name on create and patch"` fails: `AssertionError: expected 201 to be 400` at line 170, on the `taxRate: -0.01` (`sc-dto-tax-neg`) case |

Both of round 1's surviving mutants are now killed. No other mutants were re-injected: the fix's
diff and round 1's non-PASS rows are limited to exactly these two surfaces.

## Gate

- `npm --prefix api run test:e2e` (at `a988d0e`, in isolated scratch worktree) - 123 passed, 0
  failed (14 files) - verified at a988d0e
- `npm --prefix api run lint` - carried from 1c9c32c (fix touched only a test file; round 1 ran
  it clean on the unmodified source, which the fix did not change)
- `npm --prefix api run build` - carried from 1c9c32c (no source file changed)
- web lint/build/tests - carried from 1c9c32c (fix touched no web file)

## Findings ranked

None. Both round-1 gaps are closed and confirmed by re-injected mutants.
