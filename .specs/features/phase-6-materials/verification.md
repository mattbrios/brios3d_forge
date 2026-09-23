# Fase 6 — Materiais verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 3828108..HEAD (`84fed73`)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Rodada 2 escopada pelo diff do fix (`c9690be..84fed73`, que toca só
`api/test/materials.e2e-spec.ts`) e por tudo que a rodada 1 não marcou PASS. As provas foram
**reexecutadas inteiras** no `HEAD` novo (verde é propriedade de um commit), e cada seção diz se
foi reverificada em `84fed73` ou herdada de `3828108..c9690be`.

As quatro lacunas da rodada 1 estão fechadas: o mutante sobrevivente na revalidação de secagem do
`PATCH` agora morre, os 11 membros do AC 16 e as 4 regras de `class-validator` têm prova
localizada, e as duas linhas de `Test policy` que estavam sem cumprir passaram a ser cumpridas.
Resta um precision gap registrado abaixo (achado sobre os checks, não sobre o código).

## Binding sources

*Carried from `3828108..c9690be` (rodada 1).* O perfil é `standard`, então o passo 1 não é exigido;
a rodada 1 o executou mesmo assim e o fix não tocou em nenhuma interface (só em
`api/test/materials.e2e-spec.ts`), então a regra de re-verificação não pede reexecução.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `ROADMAP.md` "### Fase 6 — Materiais" | yes - `ROADMAP.md:281-295` (carried from round 1) | none | - |
| `ROADMAP.md` "#### Matriz de permissões" | yes - `ROADMAP.md:227-247` (carried from round 1) | none | - |
| `.specs/STATE.md` AD-014, AD-015, AD-018 | yes - `.specs/STATE.md:20,21,24` (carried from round 1) | none | - |

## Checks

**Verified at `84fed73`.** Provas reexecutadas em duas invocações, cada teste nomeado aparecendo
individualmente no output; nenhum filtro casou vazio.

- **A** — `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts --reporter=verbose` →
  **25 passed, 0 failed** (21 na rodada 1; +4 do fix)
- **B** — `npm --prefix web run test -- materials/page.test.tsx crud/data-table.test.tsx
  crud/entity-form.test.tsx crud/confirm-dialog.test.tsx app-shell.test.tsx --reporter=verbose` →
  **16 passed, 0 failed**

Citações refeitas no `HEAD` novo para C16 e para os quatro checks acrescentados (as linhas
mudaram). C1-C15 e C17-C33 mantêm o veredito e a evidência da rodada 1; as citações de
`materials.e2e-spec.ts` acima da linha 241 não se moveram (o diff só insere a partir de `:244`),
e nenhum arquivo do web foi tocado pelo fix.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `201` + `active: true` + `id` não vazio | A ✓ | `api/test/materials.e2e-spec.ts:86-89` (carried from round 1) | PASS |
| C2 | 6 bordas de densidade/temperatura → `400`, nada gravado | A ✓ | `api/test/materials.e2e-spec.ts:94-105` (carried from round 1) | PASS |
| C3 | `type`/`brand`/`color` vazios → `400` | A ✓ | `api/test/materials.e2e-spec.ts:110-118` (carried from round 1) | PASS |
| C4 | 5 casos de secagem inválida no `POST` → `400` | A ✓ | `api/test/materials.e2e-spec.ts:124-134` (carried from round 1) | PASS |
| C5 | `needsDrying:false` grava secagem `null` | A ✓ | `api/test/materials.e2e-spec.ts:142-144` (carried from round 1) | PASS |
| C6 | `production`/`sales` → `403` no `POST` | A ✓ | `api/test/materials.e2e-spec.ts:148-153` (carried from round 1) | PASS |
| C7 | `POST` sem sessão → `401` | A ✓ | `api/test/materials.e2e-spec.ts:158-160` (carried from round 1) | PASS |
| C8 | `200` para os 3 papéis, `{total:3, page:1, pageSize:20}`, ordenado | A ✓ | `api/test/materials.e2e-spec.ts:170-180` (carried from round 1) | PASS |
| C9 | `?type=pla` casa `PLA` e `pla` | A ✓ | `api/test/materials.e2e-spec.ts:191-192` (carried from round 1) | PASS |
| C10 | `?search=vermelho` casa nos 3 campos | A ✓ | `api/test/materials.e2e-spec.ts:203-208` (carried from round 1) | PASS |
| C11 | `?page=2&pageSize=10` com 15 → 5 itens, `total:15` | A ✓ | `api/test/materials.e2e-spec.ts:219-227` (carried from round 1) | PASS |
| C12 | `page=0`, `pageSize=0`, `pageSize=101` → `400` | A ✓ | `api/test/materials.e2e-spec.ts:231-234` (carried from round 1) | PASS |
| C13 | `GET` sem sessão → `401` | A ✓ | `api/test/materials.e2e-spec.ts:240-241` (carried from round 1) | PASS |
| C14 | `PATCH` só de `color` não mexe no resto | A - `PATCH persists only the sent fields` ✓ | `api/test/materials.e2e-spec.ts:265-273` - `expect(response.status).toBe(200)` · `toMatchObject({type:'m14-original', brand:'Marca Original', color:'Cor Nova', densityGCm3:1.24, nozzleTempC:200, bedTempC:60})` (recitado no `HEAD` novo) | PASS |
| C15 | uuid bem-formado inexistente → `404` | A - `PATCH with an unknown id is 404` ✓ | `api/test/materials.e2e-spec.ts:277-279` - `patchReq('00000000-0000-0000-0000-000000000000', ...)` · `toBe(404)` · `toEqual(NOT_FOUND)` (recitado no `HEAD` novo) | PASS |
| C16 | as 10 bordas do AC 2 + AC 4 alcançáveis por corpo de `PATCH` → `400`, registro intacto | A - `rejects invalid fields on PATCH without changing the record` ✓ | `api/test/materials.e2e-spec.ts:293-303` - tabela `[{densityGCm3:15},{densityGCm3:0},{nozzleTempC:-1},{nozzleTempC:501},{bedTempC:-1},{bedTempC:151},{needsDrying:true,dryingHours:4},{needsDrying:true,dryingTemperatureC:-1,dryingHours:4},{needsDrying:true,dryingTemperatureC:121,dryingHours:4},{needsDrying:true,dryingTemperatureC:60}]`; `:307` - `expect(response.status).toBe(400)` por caso; `:319` - `expect(row).toEqual({ density_g_cm3: 1.24, nozzle_temp_c: 200, bed_temp_c: 60, needs_drying: false })` lido direto do banco | PASS |
| C17 | `production`/`sales` → `403` no `PATCH` | A ✓ | `api/test/materials.e2e-spec.ts:365-366` - loop `[productionCookie, salesCookie]` · `toBe(403)` · `toEqual(PERMISSION_DENIED)` (citação refeita: o fix deslocou as linhas) | PASS |
| C18 | `PATCH` sem sessão → `401` | A ✓ | `api/test/materials.e2e-spec.ts:373-374` - `toBe(401)` · `toEqual(SESSION_REQUIRED)` (citação refeita) | PASS |
| C19 | `{active:false}` → `200`, registro permanece | A ✓ | `api/test/materials.e2e-spec.ts:383-387` - `toBe(200)` · `body.active).toBe(false)` · `SELECT id FROM materials WHERE id = $1` → `toHaveLength(1)` (citação refeita) | PASS |
| C20 | `{active:true}` num inativo → `200` | A ✓ | `api/test/materials.e2e-spec.ts:394-395` - `toBe(200)` · `body.active).toBe(true)` (semeado `active: false`, `:391`) (citação refeita) | PASS |
| C21 | `DELETE /materials/:id` → `404` | A ✓ | `api/test/materials.e2e-spec.ts:401` - `expect(response.status).toBe(404)`; nenhum `@Delete` em `materials.controller.ts` (citação refeita) | PASS |
| C22 | "Carregando…" antes do `GET` resolver | B ✓ | `web/src/app/(app)/materials/page.test.tsx:69` (carried from round 1) | PASS |
| C23 | erro + "Tentar novamente" refaz a chamada | B ✓ | `web/src/app/(app)/materials/page.test.tsx:81,87` (carried from round 1) | PASS |
| C24 | estado vazio distinto do de erro | B ✓ | `web/src/app/(app)/materials/page.test.tsx:96-97` (carried from round 1) | PASS |
| C25 | não-admin não vê controles | B ✓ | `web/src/app/(app)/materials/page.test.tsx:107-109` (carried from round 1) | PASS |
| C26 | cancelar não chama a API; confirmar envia `{active:false}` | B ✓ | `web/src/app/(app)/materials/page.test.tsx:125,131-132` (carried from round 1) | PASS |
| C27 | erro do `POST` mostrado sem recarregar a lista | B ✓ | `web/src/app/(app)/materials/page.test.tsx:153-157` (carried from round 1) | PASS |
| C28 | "Materiais" no menu para os 3 papéis | B ✓ | `web/src/components/app-shell.test.tsx:82-90` (carried from round 1) | PASS |
| C29 | criação adiciona a linha sem recarregar | B ✓ | `web/src/app/(app)/materials/page.test.tsx:193-204` (carried from round 1) | PASS |
| C30 | edição atualiza a linha sem recarregar | B ✓ | `web/src/app/(app)/materials/page.test.tsx:221-222` (carried from round 1) | PASS |
| C31 | `DataTable` genérico | B ✓ | `web/src/components/crud/data-table.test.tsx:29-38` (carried from round 1) | PASS |
| C32 | `EntityForm` genérico | B ✓ | `web/src/components/crud/entity-form.test.tsx:31,34,48,49` (carried from round 1) | PASS |
| C33 | `ConfirmDialog` genérico | B ✓ | `web/src/components/crud/confirm-dialog.test.tsx:24,26,39-40` (carried from round 1) | PASS |
| C34 | registro com `needsDrying:true` e `dryingHours:0` gravado direto: `PATCH` só de `color` → `400` e `color` não muda | A - `rejects a PATCH that leaves needsDrying true with an existing dryingHours of zero` ✓ | `api/test/materials.e2e-spec.ts:325-330` - `createMaterial(dataSource, { type:'m16b-edge', needsDrying:true, dryingTemperatureC:60, dryingHours:0 })` (precondição nomeada pela claim); `:332-333` - `patchReq(id, { color: 'Nova Cor' }, adminCookie)` · `expect(response.status).toBe(400)`; `:339` - `expect(row.color).not.toBe('Nova Cor')` lido do banco | PASS |
| C35 | `type` 41 chars, `brand`/`color` 101 chars, `needsDrying` string → `400`, nada persistido | A - `rejects out-of-bounds string lengths and a non-boolean needsDrying` ✓ | `api/test/materials.e2e-spec.ts:343-348` - `[{...VALID_PLA, type:'x'.repeat(41)}, {...VALID_PLA, brand:'x'.repeat(101)}, {...VALID_PLA, color:'x'.repeat(101)}, {...VALID_PLA, needsDrying:'sim' as unknown as boolean}]`; `:351` - `expect(response.status).toBe(400)` por caso; `:353` - `expect(await countAll()).toBe(0)` | PASS |
| C36 | `?page=1.5`, `?page=abc`, `?pageSize=abc` → `400` | A - `rejects a non-integer page or pageSize` ✓ | `api/test/materials.e2e-spec.ts:245` - `const cases = ['?page=1.5', '?page=abc', '?pageSize=abc']`; `:248` - `expect(response.status).toBe(400)` por caso | PASS |
| C37 | `PATCH /materials/nao-e-uuid` → `400` | A - `PATCH with a non-uuid id is 400` ✓ | `api/test/materials.e2e-spec.ts:357-358` - `patchReq('nao-e-uuid', { color: 'X' }, adminCookie)` · `expect(response.status).toBe(400)` | PASS |

## Coverage

**Linhas recomputadas em `84fed73`:** as duas que o fix tocou — "faixas revalidadas no `PATCH`
(11)" e "regras de `class-validator`" — mais a linha nova de id malformado vs. inexistente. As
demais 14 linhas, e os 4 conjuntos que a rodada 1 acrescentou por não terem linha nenhuma, são
herdadas de `3828108..c9690be`: o fix não toca autoridade nenhuma delas (só acrescenta testes).

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| **faixas revalidadas no `PATCH` (11)** *(recomputado em `84fed73`)* | plano AC 16 + `api/src/modules/materials/dto/update-material.dto.ts:41-72` + `api/src/modules/materials/materials.service.ts:84-94` | `densityGCm3` alto (15) C16 `:294` · `densityGCm3` baixo (0) C16 `:295` · `nozzleTempC` baixo (-1) C16 `:296` · `nozzleTempC` alto (501) C16 `:297` · `bedTempC` baixo (-1) C16 `:298` · `bedTempC` alto (151) C16 `:299` · temperatura de secagem ausente C16 `:300` · temperatura `< 0` C16 `:301` · temperatura `> 120` C16 `:302` · horas ausentes C16 `:303` · horas `<= 0` (valor já gravado, único caminho até a comparação do serviço) C34 `:325-333` | - |
| **regras de `class-validator` apontadas na rodada 1 (4)** *(recomputado em `84fed73`)* | `api/src/modules/materials/dto/create-material.dto.ts:20,26,32,53` + `api/src/modules/materials/dto/list-materials.dto.ts:17,23` | `@Length(1,40)` em `type` C35 `:344` · `@Length(1,100)` em `brand`/`color` C35 `:345-346` · `@IsBoolean()` em `needsDrying` C35 `:347` · `@IsInt()` em `page`/`pageSize` C36 `:245` | - |
| **id malformado vs. inexistente em `PATCH /materials/:id` (2)** *(recomputado em `84fed73`)* | `api/src/modules/materials/materials.controller.ts:30` (`ParseUUIDPipe({ errorHttpStatusCode: 400 })`) | malformado → `400` C37 `:358` · uuid bem-formado inexistente → `404` C15 `:278` | - |
| `GET /materials` statuses (3) | plano `## Surface` (carried from round 1) | `200` C8 · `400` C12, C36 · `401` C13 | - |
| `POST /materials` statuses (4) | plano `## Surface` (carried from round 1) | `201` C1 · `400` C2, C3, C4, C35 · `401` C7 · `403` C6 | - |
| `PATCH /materials/:id` statuses (5) | plano `## Surface` (carried from round 1) | `200` C14, C19, C20 · `400` C16, C34, C37 · `401` C18 · `403` C17 · `404` C15 | - |
| doors do plano (2) | plano `## Landing` (carried from round 1) | paginação/busca/filtro C8-C12, C36 · componentes web C31, C32, C33 | - |
| papéis que leem `GET` (3) | `materials.controller.ts:14` + AD-018 (carried from round 1) | `admin`, `production`, `sales` C8 | - |
| papéis barrados na escrita (4) | `materials.controller.ts:21,28` + AD-018 (carried from round 1) | `POST`×`production` C6 · `POST`×`sales` C6 · `PATCH`×`production` C17 · `PATCH`×`sales` C17 | - |
| bordas de densidade/temperatura no `POST` (6) | `create-material.dto.ts:37-51` (carried from round 1) | as 6 bordas C2 | - |
| campos vazios no `POST` (3) | `create-material.dto.ts:17-33` (carried from round 1) | `type`, `brand`, `color` C3 | - |
| secagem condicional no `POST` (5) | `create-material.dto.ts:58-68` (carried from round 1) | temp ausente, `<0`, `>120`, horas ausentes, `<=0` C4 | - |
| bordas de paginação (3) | `list-materials.dto.ts:18,24-25` (carried from round 1) | `page<1`, `pageSize<1`, `pageSize>100` C12 | - |
| transições de `active` (3) | plano `## Criteria` S4 (carried from round 1) | ativo→inativo C19 · inativo→ativo C20 · sem exclusão física C21 | - |
| estados de tela (4) | plano `## Observable` (carried from round 1) | carregando C22 · erro C23 · vazio C24 · formulário com erro C27 | - |
| UI por papel (2) | plano `## Observable` (carried from round 1) | `admin` usa os controles C26, C29, C30 · não-admin não os vê C25 | - |
| item de menu (1) | plano `## Observable` (carried from round 1) | "Materiais" nos 3 papéis C28 | - |
| campos de `MaterialResponse` (11) | plano `## Surface` (carried from round 1) | `id`, `type`, `brand`, `color`, `densityGCm3`, `nozzleTempC`, `bedTempC`, `needsDrying`, `active` C1 · `dryingTemperatureC`, `dryingHours` C5 | - |
| campos de `ListMaterialsResponse` (4) | plano `## Surface` (carried from round 1) | `items`, `total`, `page`, `pageSize` C8 | - |
| parâmetros de `GET /materials` (4 + default) | plano `## Surface` / `## Landing` (carried from round 1) | `type` C9 · `search` C10 · `page` C11 · `pageSize` C11 · defaults C8 | - |
| props dos componentes reutilizáveis (15) | plano `## Landing` (carried from round 1) | `DataTable` C31 · `EntityForm` C32 + `onSubmit` C27/C29/C30 · `ConfirmDialog` C33 | - |

Buscas que sustentam a recomputação das duas linhas do fix (verify.md: mostrar a busca):

- `rg -n "patchReq\(" api/test/materials.e2e-spec.ts` → agora **10** chamadas; três delas mandam
  campos de secagem (`:306` sobre a tabela de 10 casos) e uma exercita o registro pré-existente
  (`:332`). Na rodada 1 eram 7, nenhuma com `needsDrying`.
- `rg -n "repeat\(41\)|repeat\(101\)" api/test/materials.e2e-spec.ts` → `:344`, `:345`, `:346`.
- `rg -n "page=1\.5|page=abc|pageSize=abc" api/test/materials.e2e-spec.ts` → `:245`.
- `rg -n "nao-e-uuid" api/test/materials.e2e-spec.ts` → `:357`.

Claims que citam código de status / rota / formato (C1-C21, C34-C37): todas provadas no e2e real
contra o `AppModule` e o Postgres — nenhum **level gap**.

**Precision gap** (achado sobre os checks, não sobre o código; o da rodada 1 sobre id malformado
está resolvido por C37, que fixa `400` explicitamente). O que resta: a linha de `Test policy` dos
DTOs abre com "cada regra do `class-validator`", que é mais largo do que a enumeração da própria
célula de expectativa (C2, C3, C4, C12, C35, C36, C37). Sob a leitura literal, sobram sem prova de
rejeição: `@IsNotEmpty`/`@Length` de `type`/`brand`/`color` no `UpdateMaterialDto`
(`api/src/modules/materials/dto/update-material.dto.ts:23-38`), `@IsBoolean` em `needsDrying`
(`:60`) e em `active` (`:75`), e `@IsPositive` em `dryingHours` (`:71`) quando o `0` vem **no corpo
do `PATCH`** (C34 prova só o valor já gravado). Todas são a mesma regra, letra por letra, que o
`CreateMaterialDto` declara e que C3/C4/C35 exercitam; nenhuma é a superfície que estava cega. O
conserto é ou acrescentar esses casos à tabela de C16, ou estreitar a frase da linha para a
enumeração que ela já traz.

## Test policy rows

**As duas linhas que a rodada 1 marcou como não cumpridas foram rejulgadas em `84fed73`;** as
outras quatro são herdadas de `3828108..c9690be` (o fix não toca nenhum arquivo que elas
classificam além do e2e).

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `MaterialsService`/DTO - secagem condicional *(rejulgada em `84fed73`)* | `create-material.dto.ts`, `update-material.dto.ts`, `materials.service.ts` | 5 casos no `POST` + caminho `false` + os 4 alcançáveis por corpo revalidados no `PATCH` + o 5º via registro pré-existente | yes - `POST` C4 `materials.e2e-spec.ts:124-134` · caminho `false` C5 `:142-144` · os 4 por corpo C16 `:300-303` · o 5º (`dryingHours` gravado como `0`) C34 `:325-333`, que mata o mutante F1 |
| DTOs de `materials` (validação) *(rejulgada em `84fed73`)* | `create-material.dto.ts`, `update-material.dto.ts`, `list-materials.dto.ts` | e2e tabela-driven por DTO, faixas numéricas + tamanho de string + tipo de `needsDrying` + inteiro de `page`/`pageSize` + uuid malformado | yes - faixas C2 `:94-105`, C3 `:110-118`, C4 `:124-134`, C12 `:231-234` mais as 8 regras de faixa do `UpdateMaterialDto` via C16 `:293-307` · tamanho/booleano C35 `:343-353` · inteiro C36 `:245-248` · uuid malformado C37 `:357-358`. A frase de abertura da linha é mais larga que essa enumeração: ver a nota de precisão na seção Coverage |
| `MaterialsController` - `RolesGuard` aplicado | `materials.controller.ts` | um e2e por rota × papel | yes - carried from round 1 (C1, C6, C7, C8, C13, C14, C17, C18, C19, C20, C21) |
| `MaterialsService` - faixas de densidade/temperatura | `materials.service.ts`, `create-material.dto.ts` | e2e tabela-driven, 6 bordas no `POST` e as mesmas no `PATCH` | yes - C2 `materials.e2e-spec.ts:94-105`; as 6 do `PATCH` agora em C16 `:294-299` (era a lacuna 2 da rodada 1) |
| `MaterialsService` - paginação/busca/filtro | `materials.service.ts` | e2e por comportamento | yes - carried from round 1 (C8, C9, C10, C11, C12) e acrescido de C36 `:245-248` |
| `DataTable`/`EntityForm`/`ConfirmDialog` | `web/src/components/crud/*.tsx` | teste isolado + integração via `/materials` | yes - carried from round 1 (C31, C32, C33 isolados; C22-C30 integração) |

## Faults injected

**Verified at `84fed73`.** Isolado num segundo worktree
(`git worktree add <scratchpad>/verify-scratch-p6r2 HEAD --detach`), sem `git stash`. Porcelain do
worktree de trabalho antes: `?? .specs/features/phase-6-materials/`; depois de descartar o scratch:
idêntico. `HEAD` confirmado em `84fed73` antes e depois.

A primeira linha é a re-injeção exigida pela rodada 2 (a superfície que o fix mirou). As outras
quatro cobrem as **superfícies de asserção que o fix criou** — um fix que acrescenta asserções
traz provas que nunca foram feitas falhar uma vez. Cinco no total, o teto do verify.md, cada uma
forçando uma prova diferente a falhar.

| Mutation | Location | Killed |
| --- | --- | --- |
| revalidação de secagem no `PATCH`: `finalDryingHours > 0` → `finalDryingHours >= 0` (a que sobreviveu na rodada 1) | `api/src/modules/materials/materials.service.ts:90` | yes - C34 falhou em `api/test/materials.e2e-spec.ts:333` (`expected 200 to be 400`) |
| faixa do `UpdateMaterialDto`: `@Max(500)` em `nozzleTempC` → `@Max(501)` | `api/src/modules/materials/dto/update-material.dto.ts:50` | yes - C16 falhou em `api/test/materials.e2e-spec.ts:307` (`expected 200 to be 400`, caso `nozzleTempC: 501`) |
| tamanho de string: `@Length(1, 40)` em `type` → `@Length(1, 41)` | `api/src/modules/materials/dto/create-material.dto.ts:20` | yes - C35 falhou em `api/test/materials.e2e-spec.ts:351` (`expected 201 to be 400`) |
| tipo de paginação: `@IsInt()` removido de `page` | `api/src/modules/materials/dto/list-materials.dto.ts:17` | yes - C36 falhou em `api/test/materials.e2e-spec.ts:248` (`expected 200 to be 400`, caso `?page=1.5`) |
| status do id malformado: `ParseUUIDPipe({ errorHttpStatusCode: 400 })` → `404` | `api/src/modules/materials/materials.controller.ts:30` | yes - C37 falhou em `api/test/materials.e2e-spec.ts:358` (`expected 404 to be 400`) |

## Swept

*Carried from `3828108..c9690be`.* O fix estendeu as linhas `validation` e `failure modes` do
`checks.md` para citar C34-C37; os quatro checks estão provados acima. As linhas `n/a`
(idempotency/retry/duplicates, data lifecycle, external-dependency failure, observability) foram
reconferidas contra o código na rodada 1 e o fix não muda nenhum arquivo de produção. Nenhuma linha
`Swept` resolve para `existing` citando uma constraint.

## Gate

`npm --prefix api run test:e2e -- test/materials.e2e-spec.ts` - 25 passed, 0 failed
`npm --prefix web run test -- materials/page.test.tsx crud/*.test.tsx app-shell.test.tsx` - 16 passed, 0 failed
`npm --prefix api run test` - 94 passed, 0 failed
`npm --prefix api run test:e2e` - 148 passed, 0 failed
`npm --prefix web run test` - 78 passed, 0 failed
`python3 .claude/skills/tlc-spec-lean/scripts/validate_checks.py phase-6-materials` - exit 0, 0 error(s), 0 warning(s)
Total: 320 passed, 0 failed

## Notas

- As quatro lacunas rankeadas da rodada 1 estão fechadas: (1) mutante sobrevivente → morto por
  C34; (2) 10 dos 11 membros do AC 16 sem prova → os 11 com prova localizada; (3) `Test policy`
  dos DTOs → cumprida; (4) precision gap sobre id malformado → C37 fixa `400`.
- A quinta nota da rodada 1 permanece: a "Matriz de permissões" e as caixas `[x]` da Fase 6 estão
  no working tree do checkout principal, fora de `3828108..HEAD`, junto de `plan.md`/`checks.md`.
  Entram no commit de docs da fase, como na Fase 5. Não é um achado sobre o código.
- Validação por Playwright MCP (`AGENTS.md` e `## Handoff` do `checks.md`) continua sendo passo
  manual do orquestrador e **não foi executada** nesta verificação. Os três estados de tela estão
  provados em Vitest (C22, C23, C24).
