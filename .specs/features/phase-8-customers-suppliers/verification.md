# Fase 8 — Clientes e fornecedores verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: `8f9c9a8..e0dfb4c`
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Scope for this round per `verify.md` "Re-verifying after a fix": the fix commit `e0dfb4c` touches
exactly 4 files (`git diff 67785ec..e0dfb4c --stat`): `api/test/customers.e2e-spec.ts`,
`api/test/suppliers.e2e-spec.ts`, `web/src/app/(app)/customers/page.test.tsx`,
`web/src/app/(app)/suppliers/page.test.tsx`. No production source, no `plan.md`, no `checks.md`
changed. Proofs re-run in full at the new HEAD; everything else below not touched by the fix is
carried forward from Round 1 (`67785ec`) with that marker.

## Binding sources

Carried from `67785ec` — the fix touched no binding source, no plan, no roadmap, no screen
composition, only test files. Confirmed via `git diff 67785ec..e0dfb4c` (test files only).

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `ROADMAP.md` Fase 8 (tarefas + critérios de aceite) | carried from 67785ec | none | - |
| `ROADMAP.md` Fase 4, "Matriz de permissões" | carried from 67785ec | none | - |
| `ROADMAP.md` "Questões em aberto" #21 | carried from 67785ec | none | - |
| `.specs/STATE.md` AD-020 (paginação/busca) | carried from 67785ec | none | - |
| `.specs/STATE.md` AD-021 (componentes CRUD) | carried from 67785ec | none | - |
| `.specs/STATE.md` AD-001 (formato de erro) / AD-004 / AD-014 / AD-018 | carried from 67785ec | none | - |
| `api/src/modules/users/is-unique-violation.ts` + `users.service.ts` | carried from 67785ec | none | - |
| `.specs/features/phase-7-printers/plan.md` (padrão de CRUD copiado) | carried from 67785ec | none | - |

Round 1's two `Uncovered` findings against these sources are resolved as of `e0dfb4c`: the `409
{ error }` body (`ROADMAP.md:333`, AD-001) is now asserted — see the "forma `{ error }`" Coverage
row below — and the "Editar" flow (Fase 7 pattern) now has proof — see the "operações que
atualizam a linha" Coverage row and the F6 fault below. Both verified at `e0dfb4c`.

Enumeração das telas (step 1): carried from 67785ec unchanged — the fix added assertions to
existing render paths, it did not add or remove any screen element, control or region. No new
interface surface to re-enumerate.

## Checks

Re-ran both proof invocations in full at `e0dfb4c` (current HEAD, confirmed via `git log --oneline
-3`):

- `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts test/suppliers.e2e-spec.ts --reporter=verbose` → exit 0, **47 passed, 0 failed** (44 at Round 1 + 3 new: 1 coexistence test for suppliers, 1 phone-trim test for customers, 1 address-trim test for suppliers).
- `npm --prefix api run test --reporter=verbose` (full unit suite, includes `is-valid-document.spec.ts`) → exit 0, **104 passed, 0 failed**.
- `npm --prefix web run test -- "src/app/(app)/customers/page.test.tsx" "src/app/(app)/suppliers/page.test.tsx" "src/components/app-shell.test.tsx" --reporter=verbose` → exit 0, **19 passed, 0 failed** (same count as Round 1; the fix added assertions inside the existing "updates the row without reloading" tests rather than new `it` blocks).

Only the checks whose evidence the fix touched are re-cited below; all others (C2, C7-C13, C15,
C18-C24, C29-C35, C37, C40-C52) carried from 67785ec unchanged — confirmed via `git diff
67785ec..e0dfb4c` that none of their asserted lines moved or changed.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `POST /customers` só com `name` → `201`, e os dois clientes sem `document` convivem | e2e run above | `api/test/customers.e2e-spec.ts:75-89` — loop cria 2 clientes (`admin`,`sales`) sem apagar entre iterações, `:89` `expect(await countAll()).toBe(2)` | PASS (fixed: previously deleted the table between iterations) |
| C3 | 6 bordas de `document` → `400 { error }` literal | idem | `api/test/customers.e2e-spec.ts:123-125` `expect(response.status).toBe(400)` · `expect(response.body).toEqual(INVALID_DOCUMENT)` where `INVALID_DOCUMENT = { error: 'document inválido: informe um CPF ou CNPJ com dígito verificador correto' }` (`:14`) | PASS (fixed) |
| C4 | duplicado → `409 { error }` literal | idem | `api/test/customers.e2e-spec.ts:136-138` `toBe(409)` · `toEqual(DUPLICATE_DOCUMENT)` (`:15` `{ error: 'Já existe um cliente com este document' }`) | PASS (fixed) |
| C5 | email/phone/address fora das bordas → `400 { error: string }`; trim measured for phone | idem | `api/test/customers.e2e-spec.ts:148-152` `toBe(400)` · `toEqual({ error: expect.any(String) })` · new test `:94-98` `createReq({ phone: \`  ${'9'.repeat(30)}  \` })` → `toBe(201)` · `response.body.phone).toBe('9'.repeat(30))` | PASS (body assertion fixed; trim now exercised for `phone` via a new positive-boundary test) |
| C6 | name vazio/branco/151 → `400 { error: string }` | idem | `api/test/customers.e2e-spec.ts:159-162` `toBe(400)` · `toEqual({ error: expect.any(String) })` | PASS (fixed) |
| C12 | page/pageSize inválidos → `400 { error: string }` | idem | `api/test/customers.e2e-spec.ts:238-240` `toBe(400)` · `toEqual({ error: expect.any(String) })` | PASS (fixed) |
| C14 | `PATCH` só `phone` → `200`, todos os outros campos e `active`/`id` iguais | idem | `api/test/customers.e2e-spec.ts:261-269` `expect(response.body).toEqual({ id, name: 'c14-original', document: null, phone: '11888880000', email: 'c14@test.local', address: 'Rua Um, 100', active: true })` | PASS (precision fixed: `toMatchObject` → `toEqual`, `id`/`active` now in the literal) |
| C16 | 3 corpos inválidos `PATCH` → `400 { error: string }` | idem | `api/test/customers.e2e-spec.ts:288-290` `toBe(400)` · `toEqual({ error: expect.any(String) })` | PASS (fixed) |
| C17 | `PATCH document` duplicado → `409 { error }` literal | idem | `api/test/customers.e2e-spec.ts:304-306` `toBe(409)` · `toEqual(DUPLICATE_DOCUMENT)` | PASS (fixed) |
| C23 | `POST /suppliers` só com `name` → `201` | idem | `api/test/suppliers.e2e-spec.ts:75-88` unchanged | PASS (carried — see Test policy row for the coexistence proof, which moved to a new adjacent test, not C23 itself) |
| C25 | 6 bordas de `document` → `400 { error }` literal | idem | `api/test/suppliers.e2e-spec.ts:131-133` `toBe(400)` · `toEqual(INVALID_DOCUMENT)` | PASS (fixed) |
| C26 | duplicado → `409 { error }` literal | idem | `api/test/suppliers.e2e-spec.ts:144-146` `toBe(409)` · `toEqual(DUPLICATE_DOCUMENT)` | PASS (fixed) |
| C27 | email/phone/address fora das bordas → `400 { error: string }`; trim measured for address | idem | `api/test/suppliers.e2e-spec.ts:156-160` `toBe(400)` · `toEqual({ error: expect.any(String) })` · new test `:99-106` `createReq({ address: \`  ${'r'.repeat(300)}  \` })` → `toBe(201)` · `response.body.address).toBe('r'.repeat(300))` | PASS (body assertion fixed; trim now exercised for `address` via a new positive-boundary test) |
| C28 | name vazio/branco/151 → `400 { error: string }` | idem | `api/test/suppliers.e2e-spec.ts:166-170` `toBe(400)` · `toEqual({ error: expect.any(String) })` | PASS (fixed) |
| C34 | page/pageSize inválidos → `400 { error: string }` | idem | `api/test/suppliers.e2e-spec.ts:248-250` `toBe(400)` · `toEqual({ error: expect.any(String) })` | PASS (fixed) |
| C36 | `PATCH` só `phone` → `200`, todos os outros campos e `active`/`id` iguais | idem | `api/test/suppliers.e2e-spec.ts:271-280` `expect(response.body).toEqual({ id, name: 'f36-original', document: null, phone: '1144440000', email: 'f36@test.local', address: 'Rua Dois, 200', active: true })` | PASS (precision fixed) |
| C38 | 3 corpos inválidos `PATCH` → `400 { error: string }` | idem | `api/test/suppliers.e2e-spec.ts:295-297` `toBe(400)` · `toEqual({ error: expect.any(String) })` | PASS (fixed) |
| C39 | `PATCH document` duplicado → `409 { error }` literal | idem | `api/test/suppliers.e2e-spec.ts:311-313` `toBe(409)` · `toEqual(DUPLICATE_DOCUMENT)` | PASS (fixed) |
| C53 | cadastrar, **editar** ou ativar/desativar atualiza a linha sem recarregar, nas duas telas | `npm --prefix web run test -- "src/app/(app)/customers/page.test.tsx" "src/app/(app)/suppliers/page.test.tsx" --reporter=verbose` exit 0 | `web/src/app/(app)/customers/page.test.tsx:165-172`: clicks `Editar` in the row (`fireEvent.click(within(row).getByRole("button", { name: "Editar" }))`), changes `Telefone` (`:167`), clicks `Salvar` (`:168`), then `await within(row).findByText("11999990000")` (`:170`) and asserts the `PATCH` body `toEqual({ name: "Ana Silva", phone: "11999990000" })` (`:172`). `web/src/app/(app)/suppliers/page.test.tsx:166-175` — identical shape for suppliers (`Telefone` → `1133330000`, row text `:170`, body `:172-175`). | PASS (fixed — was FAIL in Round 1 with a surviving mutant) |

Nota de precisão carried from 67785ec (checks that only ever said "responde `400`"/`409` without a
literal, C3-C6/C12/C16 etc.): the fix supplied the missing body assertions, so this note is now
resolved rather than outstanding — see Coverage row below.

## Coverage

Recomputed only the rows whose authority the fix touched: the `{ error }` body row and the
coexistence row. All other rows carried from 67785ec — confirmed via `git diff 67785ec..e0dfb4c`
that no production code, route, or entity changed, so their authority (Nest routing, entity
constraints, `plan.md` Surface) is unaffected.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| **forma `{ error }` das rejeições nas rotas novas (4 códigos × 2 módulos = 8)** | AD-001 (`.specs/STATE.md:7`), `plan.md` `## Observable`, `ROADMAP.md:333` (`409 { error }`) | 401 carried (C8/C13/C19/C30/C35/C41) · 403 carried (C7/C18/C29/C40) · **400 `customers`** now C3 (`:125`), C5 (`:152`), C6 (`:162`), C12 (`:240`), C16 (`:290`) · **400 `suppliers`** now C25 (`:133`), C27 (`:160`), C28 (`:170`), C34 (`:250`), C38 (`:297`) · **409 `customers`** now C4 (`:138`), C17 (`:306`) · **409 `suppliers`** now C26 (`:146`), C39 (`:313`) | - |
| `document` opcional + único (door 1) (3 fatos) | `plan.md` `## Landing` + `customer.entity.ts:13` + migration (`UNIQUE ("document")`) | **convivência de dois `null`** now `api/test/customers.e2e-spec.ts:75-89` (C1's own test, no delete between iterations, `countAll()===2` at `:89`) and `api/test/suppliers.e2e-spec.ts:90-97` (new adjacent test `lets a second supplier without a document coexist with the first`, `countAll()===2` at `:97`) · duplicata exata C4/C26 (carried) · duplicata reformatada C4/C26 (carried) | - |
| bordas de `email`/`phone`/`address`, "após `trim()`" (2 fields × 2 modules) | `plan.md` AC 6/AC 29 | `phone` trim-then-measure now `customers.e2e-spec.ts:94-98` (201 at the 30-char bound after trimming a 34-char raw value) · `address` trim-then-measure now `suppliers.e2e-spec.ts:99-106` (201 at the 300-char bound after trimming) | - |

All other Coverage rows (`GET`/`POST`/`PATCH` statuses, `CustomerResponse`/`SupplierResponse`
fields, bordas de `document`, bordas de `name`, papéis, transições de `active`, estados de tela, UI
por papel, item de menu) carried from 67785ec unchanged — the fix added assertions inside existing
tests, it did not add or remove a route, a field, a role check, or a screen element.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| **operações que atualizam a linha sem recarregar (3 × 2 telas = 6)** | `plan.md` AC 54 + `customers/page.tsx:108 submitCreate`, `:141 submitEdit`, `:163 confirmToggle` | criar `/customers` C53 · criar `/suppliers` C53 · ativar/desativar `/customers` C50 · ativar/desativar `/suppliers` C51 · **editar `/customers`** now `customers/page.test.tsx:165-172` · **editar `/suppliers`** now `suppliers/page.test.tsx:166-175` | - |

## Test policy rows

Re-judged only the row that was unmet in Round 1 (row 2); rows 1, 3, 4 carried from 67785ec — the
fix touched no controller, no service, no role matrix.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `CustomersController`/`SuppliersController` - `RolesGuard` nas 6 rotas | `customers.controller.ts`, `suppliers.controller.ts` | um e2e por combinação rota × papel | carried from 67785ec — yes |
| `CustomersService`/`SuppliersService` - `document` opcional com índice único só quando informado | `customers.service.ts`, `suppliers.service.ts` | e2e com dois registros sem `document` convivendo, duplicata exata, duplicata reformatada | **yes (fixed)** — customers: the coexistence proof now lives inside **C1's own test**, `api/test/customers.e2e-spec.ts:75-89` (`DELETE FROM customers` removed from the loop body; `expect(await countAll()).toBe(2)` added after it at `:89`). Suppliers: the row still names C23, but the fix did **not** modify C23's test (`suppliers.e2e-spec.ts:75-88`, still a single supplier); instead it added a **new, unlabeled test** immediately after it — `it('lets a second supplier without a document coexist with the first', ...)` at `suppliers.e2e-spec.ts:90-97` — which is the test that actually carries this proof for suppliers, not C23. Duplicata exata/reformatada unchanged, carried (C4/C26). Recorded here so the row is judged on what the tree actually proves, not on the check ID the row happens to name. |
| validador de dígito verificador `is-valid-document.ts` | `is-valid-document.ts` | teste unitário isolado + e2e tabela-driven | carried from 67785ec — yes |
| `CustomersService` com dois papéis de escrita vs `SuppliersService` só `admin` | os dois controllers/services | e2e por papel em cada rota de escrita | carried from 67785ec — yes |

## Faults injected

Isolation: `git worktree add <scratch> HEAD` (never `git stash`) at
`/private/tmp/claude-501/.../scratchpad/verify-f6` (HEAD = `e0dfb4c`). Baseline `git status
--porcelain` of the real tree: `?? .specs/features/phase-8-customers-suppliers/verification.md`
(the report file about to be written, untracked). After removing the worktree, `git status
--porcelain` on the real tree matched the baseline exactly — no divergence.

Capped to the surfaces the fix touched: F6 re-injected on both pages (the only mutant Round 1
found surviving, and the only production surface the new/changed assertions exercise). F1-F5
carried forward from 67785ec unchanged — the fix touched no validator, no service unique-violation
mapping, no role guard, no pagination, no `ConfirmDialog` wiring, so those mutants were not
re-injected this round.

| Mutation | Location | Killed |
| --- | --- | --- |
| F1 - remover o guard de dígitos repetidos antes do cálculo do DV | `api/src/modules/customers/is-valid-document.ts:42-44` | carried from 67785ec - yes |
| F2 - remover o mapeamento `isUniqueViolation` → `ConflictException` em `create` | `api/src/modules/customers/customers.service.ts:75-77` | carried from 67785ec - yes |
| F3 - abrir `POST /suppliers` para `sales` | `api/src/modules/suppliers/suppliers.controller.ts:21` | carried from 67785ec - yes |
| F4 - deslocar a paginação em um | `api/src/modules/customers/customers.service.ts:48` | carried from 67785ec - yes |
| F5 - disparar o `PATCH` direto no clique, sem esperar o `ConfirmDialog` | `web/src/app/(app)/customers/page.tsx:231` | carried from 67785ec - yes |
| **F6a - remover o `setStatus`/`replaceCustomer` de `submitEdit`, customers** | `web/src/app/(app)/customers/page.tsx:152-154` (mutated in scratch worktree at `e0dfb4c`) | **yes** - `customers/page.test.tsx > Customers page > updates the row without reloading` FAILS (`await within(row).findByText("11999990000")` times out) |
| **F6b - remover o `setStatus`/`replaceSupplier` de `submitEdit`, suppliers** | `web/src/app/(app)/suppliers/page.tsx:152-154` (mutated in scratch worktree at `e0dfb4c`) | **yes** - `suppliers/page.test.tsx > Suppliers page > updates the row without reloading` FAILS (same timeout, `findByText("1133330000")`) |

F6 (the Round-1 surviving mutant) is killed on both pages after the fix.

## Gate

- `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts test/suppliers.e2e-spec.ts --reporter=verbose` - 47 passed, 0 failed
- `npm --prefix api run test --reporter=verbose` (full unit suite) - 104 passed, 0 failed
- `npm --prefix web run test -- "src/app/(app)/customers/page.test.tsx" "src/app/(app)/suppliers/page.test.tsx" "src/components/app-shell.test.tsx" --reporter=verbose` - 19 passed, 0 failed
- `npm --prefix api run lint` / `npm --prefix web run lint` - 0 problems

**Total: 170 passed, 0 failed.**

## Ranked gaps

None blocking. One residual observation, non-blocking:

1. **Test policy row 2 names C23 for the supplier coexistence proof, but the actual proof lives in
   a new, unnamed test** - `api/test/suppliers.e2e-spec.ts:90-97` (`it('lets a second supplier
   without a document coexist with the first', ...)`), not in C23 itself
   (`suppliers.e2e-spec.ts:75-88`, unchanged, still a single supplier). This is not a coverage gap
   — the fact is proven — but `checks.md`'s Test policy row and the `plan.md` numbering are now out
   of sync with which test ID actually carries this obligation for suppliers (customers' equivalent
   fact was folded into C1 itself, suppliers' was not folded into C23). Cosmetic bookkeeping, does
   not affect the verdict.
2. **Trim asymmetry** - `api/test/customers.e2e-spec.ts:94-98` only exercises trim-then-measure on
   `phone`; `api/test/suppliers.e2e-spec.ts:99-106` only exercises it on `address`. Neither module
   has both fields' positive-boundary trim case. Not a functional gap (both DTOs share the
   identical `@Transform(trim)` decorator on both fields, confirmed by reading
   `api/src/modules/customers/dto/create-customer.dto.ts` and
   `api/src/modules/suppliers/dto/create-supplier.dto.ts`), but noted for completeness.
