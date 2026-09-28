# Fase 14 — Metadados do modelo por URL verification

**Verdict**: PASS
**Profile**: light
**Diff range**: bb98bbb..HEAD (feat/phase-14-model-metadata, HEAD=b534f53)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier), fresh context, no inheritance from round 1

## Scope of this round

Round 1 (HEAD=5876130, commit `bb98bbb~1` base) FAILed on exactly two findings: C11 and C12, whose proof commands in `checks.md` (`-t "permissive"`, `-t "unknown or empty"`) matched 0 tests in `api/src/modules/products/license-normalization.spec.ts` (`passWithNoTests`, exit 0 with nothing run). All other 24 checks (C1-C10, C13-C26) were verified PASS in round 1 and are untouched by the fix.

The fix, commit `b534f53` (parent `b534f53~1`), renames two `it.each` test-name templates in `license-normalization.spec.ts`:
- `'license C11: %s (%s) -> commercialUseAllowed true'` → `'license C11: known permissive %s (%s) -> commercialUseAllowed true'`
- `'license C12: %s (%s) -> commercialUseAllowed null'` → `'license C12: unknown or empty %s (%s) -> commercialUseAllowed null'`

Confirmed via `git log --oneline b534f53~1..b534f53` (single commit) and `git diff b534f53~1..b534f53`: the diff touches only these two string literals in `api/src/modules/products/license-normalization.spec.ts`. No assertion, no fixture, no other file changed. `checks.md` itself was not touched by this commit (it was already frozen/approved with the `-t "permissive"` / `-t "unknown or empty"` proof commands from round 1).

## Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | Printables URL preview 200 with title/imageUrl/designer/normalized license | carried from b534f53~1 | `api/test/products-model-metadata.e2e-spec.ts:105-119` | PASS |
| C2 | MakerWorld URL preview 200 reusing Fase 2 mapped fields | carried from b534f53~1 | `api/test/products-model-metadata.e2e-spec.ts:120-134` | PASS |
| C3 | Unsupported domain → 400 `INVALID_MODEL_URL` | carried from b534f53~1 | `api/test/products-model-metadata.e2e-spec.ts:136-142` | PASS |
| C4 | Thingiverse URL → 400 with manual-fill message | carried from b534f53~1 | `api/test/products-model-metadata.e2e-spec.ts:144-150` | PASS |
| C5 | Model not found on origin → 404 | carried from b534f53~1 | `api/test/products-model-metadata.e2e-spec.ts:151-157` | PASS |
| C6 | Origin down/unreadable → 502 without leaking upstream detail | carried from b534f53~1 | `api/test/products-model-metadata.e2e-spec.ts:166`, `:163-170` | PASS |
| C7 | `POST /products/model-metadata` never writes to `products` | carried from b534f53~1 | `api/test/products-model-metadata.e2e-spec.ts:183` | PASS |
| C8 | `HttpPrintablesClient` - no redirect, `AbortSignal.timeout`, byte limit, honest User-Agent | carried from b534f53~1 | `api/src/modules/products/printables.client.spec.ts:108-113`, `:116-129`, `:131-144`, `:146-160` | PASS |
| C9 | License containing `noncommercial`/`non-commercial` (any case) → `commercialUseAllowed = false` | carried from b534f53~1 | `api/src/modules/products/license-normalization.spec.ts:10` | PASS |
| C10 | License exactly `Standard Digital File License` → `false` | carried from b534f53~1 | `api/src/modules/products/license-normalization.spec.ts:14-19` | PASS |
| C11 | Known permissive license → `commercialUseAllowed = true` | verified at b534f53 - `npm --prefix api run test -- license-normalization.spec.ts -t "permissive"` exit 0, **6 passed, 12 skipped** | Test now named `license C11: known permissive %s (%s) -> commercialUseAllowed true` at `api/src/modules/products/license-normalization.spec.ts:34`; assertion at `:36` - `expect(normalizeLicense(license)).toEqual({ license, commercialUseAllowed: true })` (same assertion as round 1, only the name changed) | PASS |
| C12 | Empty/absent/unrecognized license → `commercialUseAllowed = null`, original text preserved | verified at b534f53 - `npm --prefix api run test -- license-normalization.spec.ts -t "unknown or empty"` exit 0, **4 passed, 14 skipped** | Test now named `license C12: unknown or empty %s (%s) -> commercialUseAllowed null` at `api/src/modules/products/license-normalization.spec.ts:43`; assertion at `:45` - `expect(result.commercialUseAllowed).toBeNull()` (same assertion as round 1, only the name changed) | PASS |
| C13 | Refresh on Printables/MakerWorld product overwrites metadata fields + `modelMetadataFetchedAt`, 200 | carried from b534f53~1 | `api/test/products-model-metadata.e2e-spec.ts:201-208`, `:209` | PASS |
| C14 | Unknown product → 404 `PRODUCT_NOT_FOUND` | carried from b534f53~1 | `api/test/products-model-metadata.e2e-spec.ts:213-214` | PASS |
| C15 | Thingiverse product → 400, no field changed | carried from b534f53~1 | `api/test/products-model-metadata.e2e-spec.ts:225-228` | PASS |
| C16 | Upstream 404/502 propagates same code, no field changed | carried from b534f53~1 | `api/test/products-model-metadata.e2e-spec.ts:241-242`, `:248-249` | PASS |
| C17 | Non-admin → 403 on both routes | carried from b534f53~1 | `api/test/products-model-metadata.e2e-spec.ts:262`, `:267` | PASS |
| C18 | Repeated refresh overwrites same fields, advances `modelMetadataFetchedAt` | carried from b534f53~1 | `api/test/products-model-metadata.e2e-spec.ts:286`, `:287-289` | PASS |
| C19 | "Buscar metadados" fills title/designer/license/commercial-use, shows image, no POST/PATCH `/products` | carried from b534f53~1 | `web/src/components/product-form.test.tsx:41-47`, `:52` | PASS |
| C20 | Loading state shown during fetch | carried from b534f53~1 | `web/src/components/product-form.test.tsx:63` | PASS |
| C21 | Failed search shows API error message, fields stay editable | carried from b534f53~1 | `web/src/components/product-form.test.tsx:73`, `:78` | PASS |
| C22 | Refresh dialog shows saved-vs-fetched diff for 5 fields, writes nothing yet | carried from b534f53~1 | `web/src/components/product-metadata-refresh.test.tsx:62-69`, `:72-74` | PASS |
| C23 | Confirm calls `.../refresh`, reflects updated product incl. fetch date | carried from b534f53~1 | `web/src/components/product-metadata-refresh.test.tsx:91`, `:79` | PASS |
| C24 | Cancel before confirming persists nothing | carried from b534f53~1 | `web/src/components/product-metadata-refresh.test.tsx:110-111` | PASS |
| C25 | Thingiverse product hides "Atualizar metadados" | carried from b534f53~1 | `web/src/app/(app)/products/[id]/page.test.tsx:235` | PASS |
| C26 | Preview failure (400/404/502) shows error, keeps product unchanged | carried from b534f53~1 | `web/src/components/product-metadata-refresh.test.tsx:121`, `:122` | PASS |

## Coverage

Carried from b534f53~1 (`light` profile, not recomputed in round 1 or round 2). The two members that had no located proof in round 1 (`known permissive C11`, `unknown/empty C12` in the "license normalization branches" and "license priority rule" rows) now resolve: both proof commands in `checks.md` locate and run real, passing tests as shown in the Checks table above.

| Set (size) | Member -> proof |
| --- | --- |
| `POST /products/model-metadata` statuses (4) | 200 C1,C2 · 400 C3,C4 · 404 C5 · 502 C6 |
| `POST /products/:id/model-metadata/refresh` statuses (5) | 200 C13,C18 · 400 C15 · 403 C17 · 404 C14 · 502 C16 |
| license normalization branches (4) | noncommercial C9 · exact SDFL C10 · known permissive C11 · unknown/empty C12 |
| Landing: Printables adapter AD-011 (4 properties) | no redirect C8 · timeout C8 · byte limit C8 · honest User-Agent C8 |
| Landing: license priority rule (4 branches) | noncommercial C9 · exact SDFL C10 · known permissive C11 · unknown/empty C12 |

## Swept

Carried from b534f53~1 - none of the swept areas (validation, failure modes, idempotency, authorization, concurrency, data lifecycle, dependency failure, state transitions, observability) touch `license-normalization.spec.ts` test names, and the fix's diff is scoped to that one file's two string literals. No re-sweep needed; nothing in the fix could change any of these verdicts.

- **validation (C3, C4)**: carried from b534f53~1 - confirmed.
- **failure modes (C6, C16)**: carried from b534f53~1 - confirmed.
- **idempotency (C18)**: carried from b534f53~1 - confirmed.
- **authorization (C17)**: carried from b534f53~1 - confirmed.
- **concurrency: n/a** - carried from b534f53~1.
- **data lifecycle: n/a** - carried from b534f53~1.
- **dependency failure (C6, C16)**: carried from b534f53~1 - confirmed.
- **state transitions: n/a** - carried from b534f53~1.
- **observability: n/a** - carried from b534f53~1.

## Gate

- `npm --prefix api run test -- license-normalization.spec.ts -t "permissive"` (verified at b534f53) - 6 passed, 0 failed, 12 skipped, exit 0
- `npm --prefix api run test -- license-normalization.spec.ts -t "unknown or empty"` (verified at b534f53) - 4 passed, 0 failed, 14 skipped, exit 0
- `npm --prefix api run test -- license-normalization.spec.ts` (verified at b534f53, full-file regression check) - 18 passed, 0 failed, exit 0

All other gate figures (e2e suite, web suites, other unit suites) carried from b534f53~1 since the fix's diff does not touch any file they cover:

- `npm --prefix api run test -- printables.client.spec.ts license-normalization.spec.ts printables.mapper.spec.ts` - carried from b534f53~1: 34 passed, 0 failed (now 18/18 of the license file's tests are individually named-and-located, vs. round 1's ambiguity on 2 named-proof commands)
- `npm --prefix api run test:e2e -- test/products-model-metadata.e2e-spec.ts` - carried from b534f53~1: 13 passed, 0 failed
- `npm --prefix web run test -- product-form.test.tsx product-metadata-refresh.test.tsx "[id]/page.test.tsx"` - carried from b534f53~1: 34 passed, 0 failed

## Why this passes

The two findings from round 1 were proof-command defects, not implementation gaps: the underlying `normalizeLicense` behaviour for C11 and C12 was already correctly asserted in round 1, just not reachable by the exact `-t` filter strings frozen in `checks.md`. The fix renamed the two `it.each` templates to literally contain the substrings `"permissive"` and `"unknown or empty"`, without touching any assertion. Re-running the exact commands named in `checks.md` at `b534f53` now shows each filter matching and running real tests (6 and 4 respectively, all passing), and the assertions behind those tests (`:36` and `:45`) are unchanged from round 1's citation. The full `license-normalization.spec.ts` file still runs all 18 tests, all passing - no regression. No other file in the repo changed, so all 24 previously-PASS checks carry forward unmodified.

## Ranked gaps

None.
