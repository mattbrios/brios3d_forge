# Fase 9 — Estoque de filamento por rolo · verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: e9d7157..f45f543 (fix re-verificado: 02bae18..f45f543)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

Rodada 2 escopada por (a) o diff do fix `f45f543` e (b) todo veredito que não foi PASS na rodada 1
(`02bae18`). O que o fix não podia ter tocado vem marcado `carried from 02bae18`; o que foi
reexaminado vem marcado `verified at f45f543`. **As 35 provas rodaram inteiras no `HEAD` novo**,
independente de escopo.

Os dois mutantes que reprovaram a rodada 1 **morrem agora**, cada um com a prova nomeada falhando:
o backstop do `CHECK` (SQLSTATE `23514`) mata C15 **e** C16, e a derivação de `status` mata C35 e
C17. As quatro demais lacunas também fecham, e uma delas (o *precision gap* de C5) foi confirmada
por um experimento direto: o mutante "duas transações separadas" **sobrevive** ao spec da rodada 1 e
**morre** no spec da rodada 2, pela asserção nova.

## Binding sources

`carried from 02bae18` — o fix não tocou em nenhuma fonte vinculante nem na interface. O perfil é
`standard`, então o passo 1 (enumeração por tela) não é obrigatório.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `ROADMAP.md` Fase 9 - objetivo, tarefas, critérios de aceite | yes - rodada 1 | none | - |
| `.specs/STATE.md` AD-001, AD-006, AD-007, AD-014, AD-015, AD-018, AD-020, AD-021 | yes - rodada 1 | none | - |
| `AGENTS.md` (raiz) e `web/AGENTS.md` | yes - rodada 1 | none | - |

## Checks

`verified at f45f543` — três invocações, uma por alvo: o arquivo e2e inteiro (27 testes,
`--reporter=verbose`), os dois specs Vitest da API juntos, e os dois testes de página do web juntos.
Cada teste nomeado aparece individualmente como executado e verde. Como o fix mexeu em
`api/test/inventory.e2e-spec.ts`, **todas as citações desse arquivo foram refeitas** (as linhas
andaram); as citações do web e de `average-cost.spec.ts` são `carried from 02bae18` (arquivos
intocados pelo fix).

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | rolo nasce com saldo cheio, movimento `entrada` e `status` `fechado` | e2e file run, exit 0 - "creates a roll with the first entrada movement and the derived closed status" ✓ | `api/test/inventory.e2e-spec.ts:128` `expect(response.body.balanceGrams).toBe(1000)`; `:129` `expect(response.body.status).toBe('fechado')`; `:133` `expect(movements[0]).toMatchObject({ type: 'entrada', quantity_grams: 1000 })`; `:134` `expect(Number(movements[0].unit_cost_cents_per_gram)).toBe(12)` | PASS |
| C2 | `materialId` inexistente ou inativo -> `400`, nada persistido | mesma invocação - "rejects an unknown or inactive materialId" ✓ | `:138` tabela `[UNKNOWN_MATERIAL_ID, inactiveMaterialId]`; `:141` `expect(response.status).toBe(400)`; `:143` `expect(await countRolls()).toBe(0)` | PASS |
| C3 | `supplierId` inexistente -> `400`, nada persistido | mesma invocação - "rejects an unknown supplierId" ✓ | `:151` `expect(response.status).toBe(400)`; `:152` `expect(await countRolls()).toBe(0)` | PASS |
| C4 | peso 0, tara -1, custo -1 -> `400` (3 casos), nada persistido | mesma invocação - "rejects a non-positive initial weight, a negative tare or a negative cost" ✓ | `:156-159` (3 casos); `:163` `expect(response.status).toBe(400)`; `:165` `expect(await countRolls()).toBe(0)` | PASS |
| C5 | `createRoll` propaga o erro do movimento e a escrita passa pela mesma transação | `npm --prefix api run test -- ...inventory.service.spec.ts` exit 0 - "rolls back the roll when the entrada movement fails to save" ✓ | `api/src/modules/inventory/inventory.service.spec.ts:48` `await expect(service.createRoll(VALID_DTO, 'user-1')).rejects.toThrow('conexão com o banco caiu')`; **`:53` `expect(transaction).toHaveBeenCalledTimes(1)`** (novo); `:55` `expect(rollsRepoMock.save).toHaveBeenCalledTimes(1)`; `:59` `expect(movementsRepoMock.save).toHaveBeenCalledTimes(1)` | PASS - *precision gap da rodada 1 fechado*, ver `Faults` E |
| C6 | `production` e `sales` -> `403` em `POST /inventory/rolls`, nada persistido | e2e file run - "production and sales get 403 on POST /inventory/rolls" ✓ | `:171` `expect(response.status).toBe(403)`; `:172` `expect(response.body).toEqual(PERMISSION_DENIED)`; `:174` `expect(await countRolls()).toBe(0)` | PASS |
| C7 | filtro por `materialId` no envelope AD-020 | e2e file run - "GET /inventory/rolls filters by materialId with the AD-020 pagination envelope" ✓ | `:186` `expect(response.body).toMatchObject({ total: 1, page: 1, pageSize: 20 })`; `:187` `toHaveLength(1)`; `:188` `expect(response.body.items[0].id).toBe(rollId)` | PASS |
| C8 | 2 rolos de custos diferentes -> `totalBalanceGrams: 2000`, `avgCostCentsPerGram: 11`, `rollCount: 2` | e2e file run - "materials-summary averages two rolls of the same material weighted by balance" ✓ | `:222` `expect(item).toMatchObject({ totalBalanceGrams: 2000, avgCostCentsPerGram: 11, rollCount: 2 })` | PASS |
| C9 | fórmula pura: 5 casos (2 rolos, 1 rolo, saldo 0, descartado, lista vazia) | `npm --prefix api run test -- ...average-cost.spec.ts` exit 0 - "weights by remaining balance and excludes empty or discarded rolls" ✓ | `average-cost.spec.ts:23` `.toBe(11)`; `:26` `.toBe(30)`; `:34` `.toBe(10)`; `:42` `.toBe(10)`; `:45` `expect(computeAverageCostCentsPerGram([])).toBeNull()` (`carried from 02bae18`) | PASS |
| C10 | sem saldo -> `avgCostCentsPerGram: null`, `totalBalanceGrams: 0`, `rollCount: 1` | e2e file run - "materials-summary reports null average cost when nothing is in stock" ✓ | `:231` `expect(item).toMatchObject({ totalBalanceGrams: 0, avgCostCentsPerGram: null, rollCount: 1 })` | PASS |
| C11 | `GET /materials` sem campo de saldo/custo (door 5) | e2e file run - "does not add stock or cost fields to GET /materials" ✓ | `:248-250` `expect(Object.keys(material as object).sort()).toEqual(['active','bedTempC','brand','color','densityGCm3','dryingHours','dryingTemperatureC','id','needsDrying','nozzleTempC','type'].sort())` | PASS |
| C12 | 812 g bruto / tara 250 g -> saldo 562 g e `ajuste` de -38 | e2e file run - "weighing 812g gross with a 250g tare leaves the balance at 562g with an ajuste movement" ✓ | `:260` `expect(response.body.balanceGrams).toBe(562)`; `:264` `expect(movements[0]).toMatchObject({ type: 'ajuste', quantity_grams: -38 })` | PASS |
| C13 | bruto abaixo da tara -> `400`, sem movimento e sem mudar saldo | e2e file run - "rejects a gross weight below the roll's tare" ✓ | `:271` `expect(response.status).toBe(400)`; `:272` `expect(await balanceOf(rollId)).toBe(600)`; `:273` `expect(await movementsOf(rollId)).toHaveLength(0)` | PASS |
| C14 | `consumo` e `perda` -> `201`, saldo decrementado, `quantityGrams` negativo | e2e file run - "consumo and perda movements decrement the balance" ✓ | `:279` tabela `['consumo','perda']`; `:282` `toBe(201)`; `:283` `expect(response.body.balanceGrams).toBe(300)`; `:286` `expect(movements[0]).toMatchObject({ type, quantity_grams: -200 })` | PASS |
| C15 | quantidade > saldo -> `400`, nada muda | e2e file run - "rejects a movement quantity greater than the roll's balance" ✓ | `:304` `expect(response.status).toBe(400)`; `:305` `expect(await balanceOf(rollId)).toBe(100)`; `:306` `expect(await movementsOf(rollId)).toHaveLength(0)` | PASS - agora **passa pelo `CHECK`** (a pré-checagem em JS foi removida); morre com o mutante A |
| C16 | duas baixas simultâneas -> uma `201` e uma `400`, saldo 30, garantido pelo `CHECK` (door 3) | e2e file run - "only one of two concurrent movements that would exceed the balance succeeds" ✓ | `:317` `expect(statuses).toEqual([201, 400])`; `:318` `expect(await balanceOf(rollId)).toBe(30)` | **PASS** (era FAIL na rodada 1) - o mutante `23514 -> 99999` agora mata esta prova, ver `Faults` A |
| C17 | descarte grava `perda` pelo saldo inteiro, zera saldo, marca `discardedAt` e deriva `descartado` | e2e file run - "discarding a roll writes a perda movement for the whole remaining balance" ✓ | `:326` `expect(response.body.balanceGrams).toBe(0)`; `:327` `expect(response.body.discardedAt).not.toBeNull()`; **`:328` `expect(response.body.status).toBe('descartado')`** (novo); `:332` `expect(movements[0]).toMatchObject({ type: 'perda', quantity_grams: -200 })` | PASS |
| C18 | `/open` seta `openedAt` e `status: "aberto"`; segunda chamada mantém o mesmo `openedAt` | e2e file run - "opening a roll sets openedAt once and is idempotent on a second call" ✓ | `:342` `expect(first.body.status).toBe('aberto')`; `:343` `expect(first.body.openedAt).not.toBeNull()`; `:347` `expect(second.body.openedAt).toBe(first.body.openedAt)` | PASS |
| C19 | duas chamadas de `/dry` avançam `lastDriedAt` | e2e file run - "drying a roll always advances lastDriedAt" ✓ | `:361-363` `expect(new Date(second.body.lastDriedAt).getTime()).toBeGreaterThan(new Date(first.body.lastDriedAt).getTime())` | PASS |
| C20 | `userId` gravado em cada uma das 3 movimentações, por sessões diferentes | e2e file run - "records the acting user on every movement type" ✓ | `:378` `expect(movements[0]).toMatchObject({ type: 'entrada', user_id: adminId })`; `:379` `{ type: 'ajuste', user_id: productionId }`; `:380` `{ type: 'consumo', user_id: productionId }` | PASS |
| C21 | histórico ordenado por `createdAt` com todos os campos | e2e file run - "GET /inventory/rolls/:id returns the movement history ordered by createdAt" ✓ | `:393` `expect(movements.map((m) => m.type)).toEqual(['entrada','ajuste','consumo'])`; `:395` `expect(timestamps).toEqual([...timestamps].sort((a,b) => a-b))`; `:397-402` `toHaveProperty` de `type`/`quantityGrams`/`unitCostCentsPerGram`/`reason`/`userId`/`createdAt` | PASS |
| C22 | nenhuma rota edita/apaga movimento (`PATCH` e `DELETE` -> `404`) | e2e file run - "no route exists to edit or delete an inventory movement" ✓ | `:418` `expect(patch.status).toBe(404)`; `:423` `expect(del.status).toBe(404)` | PASS |
| C23 | as 9 rotas sem cookie -> `401` | e2e file run - "every inventory route is 401 without a session" ✓ | `:429-439` (9 rotas); `:442` `expect(response.status).toBe(401)`; `:443` `expect(body).toEqual(SESSION_REQUIRED)` | PASS |
| C24 | 6 rotas de rolo com uuid inexistente -> `404` | e2e file run - "every roll-scoped route is 404 for an unknown roll id" ✓ | `:448-455` (6 rotas); `:458` `expect(response.status).toBe(404)`; `:459` `expect(body).toEqual(ROLL_NOT_FOUND)` | PASS |
| C25 | `sales` -> `403` nas 5 rotas operacionais, rolo inalterado | e2e file run - "sales gets 403 on every operational roll route" ✓ | `:465-471` (5 rotas); `:474` `expect(response.status).toBe(403)`; `:475` `expect(body).toEqual(PERMISSION_DENIED)`; `:477` `expect(await balanceOf(rollId)).toBe(200)` | PASS |
| C26 | rolo descartado -> `409` em pesagem, baixa e descarte | e2e file run - "every balance-changing route is 409 on an already discarded roll" ✓ | `:482-486` (3 rotas); `:489` `expect(response.status).toBe(409)`; `:491` `expect(await movementsOf(rollId)).toHaveLength(0)` | PASS |
| C27 | `/inventory` mostra "Carregando…" antes do resumo resolver | `npx vitest run` nos 2 arquivos, exit 0 - "shows loading" ✓ | `web/src/app/(app)/inventory/page.test.tsx:73` `expect(screen.getByText("Carregando…")).toBeTruthy()` (`carried from 02bae18`) | PASS |
| C28 | erro + "Tentar novamente" que refaz a chamada | mesma invocação - "shows the error and retries" ✓ | `page.test.tsx:86` `await screen.findByText("Não foi possível conectar à API")`; `:87` `getByRole("button", { name: "Tentar novamente" })`; `:92` `expect(callsTo(fetchMock, "/inventory/materials-summary")).toHaveLength(2)` (`carried`) | PASS |
| C29 | estado vazio com a ação de cadastrar, para `admin` | mesma invocação - "shows an empty state with the create action only for admin" ✓ | `page.test.tsx:102` `expect(await screen.findByText("Nenhum rolo em estoque.")).toBeTruthy()`; `:103` `getByRole("button", { name: "Cadastrar rolo" })` (`carried`) | PASS |
| C30 | `production` e `sales` não veem "Cadastrar rolo" | mesma invocação - "production and sales do not see the create roll action" ✓ | `page.test.tsx:107` tabela `[PRODUCTION_ME, SALES_ME]`; `:116` `expect(screen.queryByRole("button", { name: "Cadastrar rolo" })).toBeNull()` (`carried`) | PASS |
| C31 | `sales` vê o histórico e nenhum formulário/ação | mesma invocação - "sales sees only the read-only history" ✓ | `[id]/page.test.tsx:99` `await screen.findByText("entrada")`; `:100-104` `queryByRole(... "Pesar"/"Dar baixa"/"Abrir rolo"/"Registrar secagem"/"Descartar")).toBeNull()` (`carried`) | PASS |
| C32 | descarte exige confirmação; cancelar não chama a API | mesma invocação - "confirms before discarding" ✓ | `[id]/page.test.tsx:126` `expect(discardCalled).toBe(false)`; `:127` `expect(screen.queryByRole("dialog")).toBeNull()`; `:133` `expect(callsTo(fetchMock, "/inventory/rolls/r1/discard")).toHaveLength(1)` (`carried`) | PASS |
| C33 | `production` e `sales` -> `200` nas 3 rotas de leitura (lado positivo da matriz) | e2e file run - "production and sales get 200 on every read route" ✓ | `api/test/inventory.e2e-spec.ts:193` tabela `[productionCookie, salesCookie]`; `:194` `expect((await listReq('', cookie)).status).toBe(200)`; `:195` `expect((await getByIdReq(rollId, cookie)).status).toBe(200)`; `:196` `expect((await summaryReq('', cookie)).status).toBe(200)` | PASS (novo) |
| C34 | `?status=aberto` filtra pelo status derivado; `?search=` casa contra `batch` e contra `location` | e2e file run - "GET /inventory/rolls filters by status and by search across batch and location" ✓ | `:206` `expect(items.map((i) => i.id)).toEqual([openId])` (status); `:209` `...toEqual([closedId])` (search por `batch`); `:212` `...toEqual([openId])` (search por `location`) | PASS (novo) |
| C35 | baixa que zera o saldo sem descartar deriva `status: "vazio"` | e2e file run - "a movement that consumes the whole balance without discarding derives status vazio" ✓ | `:294` `expect(response.status).toBe(201)`; `:295` `expect(response.body.balanceGrams).toBe(0)`; `:296` `expect(response.body.status).toBe('vazio')`; `:297` `expect(response.body.discardedAt).toBeNull()` | PASS (novo) |

## Coverage

Recomputada a partir da autoridade de cada conjunto, nunca lida do `checks.md`. As linhas que o fix
tocou (door 2, door 3, door 6a, matriz de papéis, filtros de query, campos do item de
`materials-summary`) vêm `verified at f45f543`; as demais, `carried from 02bae18`.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `POST /inventory/rolls` statuses (4) | `inventory.controller.ts:23-27` + `Surface` (`carried from 02bae18`) | 201 C1 · 400 C2/C3/C4 · 401 C23 · 403 C6 | - |
| `GET /inventory/rolls` statuses (2) | `inventory.controller.ts:30-34` + `Surface` (`carried`) | 200 C7, C33 · 401 C23 | - |
| `GET /inventory/rolls/:id` statuses (3) | `inventory.controller.ts:42-46` + `Surface` (`carried`) | 200 C21, C33 · 401 C23 · 404 C24 | - |
| `PATCH .../weigh` statuses (6) | `inventory.controller.ts:49-57` + `Surface` (`carried`) | 200 C12 · 400 C13 · 401 C23 · 403 C25 · 404 C24 · 409 C26 | - |
| `POST .../movements` statuses (6) | `inventory.controller.ts:59-68` + `Surface` (`carried`) | 201 C14, C35 · 400 C15/C16 · 401 C23 · 403 C25 · 404 C24 · 409 C26 | - |
| `PATCH .../discard` statuses (5) | `inventory.controller.ts:70-77` + `Surface` (`carried`) | 200 C17 · 401 C23 · 403 C25 · 404 C24 · 409 C26 | - |
| `PATCH .../open` statuses (4) | `inventory.controller.ts:79-83` + `Surface` (`carried`) | 200 C18 · 401 C23 · 403 C25 · 404 C24 | - |
| `PATCH .../dry` statuses (4) | `inventory.controller.ts:85-89` + `Surface` (`carried`) | 200 C19 · 401 C23 · 403 C25 · 404 C24 | - |
| `GET /inventory/materials-summary` statuses (2) | `inventory.controller.ts:36-40` + `Surface` (`carried`) | 200 C8/C10, C33 · 401 C23 | - |
| `InventoryMovement.type` (4) | entidade + migration `...720` (`carried`) | `entrada` C1 · `consumo` C14, C35 · `perda` C14/C17 · `ajuste` C12 | - |
| door 1: tabelas `filament_rolls`/`inventory_movements` (2) | migrations `...719`/`...720`, FKs (`carried`) | criadas e populadas por C1; FK `user_id` não nula por C20 | - |
| door 2: rolo + movimento **na mesma** transação (2) | `inventory.service.ts:51-97` (`this.rolls.manager.transaction`, uma só) — **recomputado**, `verified at f45f543` | caminho feliz C1 · reversão na falha C5 (`inventory.service.spec.ts:53` assert direto de que a escrita ocorreu dentro de **uma** `manager.transaction`; mutante "duas transações" morre, `Faults` E) | - |
| door 3: saldo nunca negativo (2) | `inventory.service.ts:183-201` (sem pré-checagem em JS; `UPDATE` relativo + `catch` de `isCheckViolation`) + `CHECK "balance_non_negative"` na migration `...719` + `is-check-violation.ts:3` — **recomputado**, `verified at f45f543` | sequencial via `CHECK` C15 · concorrente via `CHECK` C16 — os dois caem no mesmo `catch`; mutante `23514 -> 99999` mata **as duas** (`Faults` A) | - |
| door 4: custo médio ponderado pelo saldo atual (3) | `average-cost.ts:10-21` (`carried`) | fórmula isolada C9 (5 casos) · referência via API C8 · saldo zero -> `null` C10 | - |
| door 5: `Material` sem coluna nova (1) | migration `...719` + `MaterialResponse` (`carried`) | `GET /materials` inalterado C11 | - |
| door 6a: `status` derivado, 4 valores (4) | `inventory.types.ts:5` (`ROLL_STATUSES`) e `:8-19` (`deriveStatus`) — **recomputado**, `verified at f45f543` | `fechado` C1 (`:129`) · `aberto` C18 (`:342`) · `vazio` C35 (`:296`) · `descartado` C17 (`:328`); mutante que troca os 4 retornos mata C35 e C17 (`Faults` B) | - |
| door 6b: nenhuma rota edita/apaga movimento (1) | `inventory.controller.ts` (`carried`) | C22 | - |
| `GET /inventory/rolls` parâmetros de query (5) | `dto/list-rolls.dto.ts:7-32` + `Surface` — **recomputado**, `verified at f45f543` | `materialId` C7 · `status` C34 · `search` C34 (`batch` e `location`) · `page`/`pageSize` C7 (defaults no envelope) | - |
| item de `materials-summary` (4 campos) | `inventory.types.ts:62-67` + `Surface` — **recomputado**, `verified at f45f543` | `materialId` C8/C10 · `totalBalanceGrams` C8/C10 · `avgCostCentsPerGram` C8/C10 · `rollCount` C8 (`:222` literal `rollCount: 2`) / C10 (`:231` literal `rollCount: 1`) | - |
| matriz de papéis × rota (3 papéis × 2 lados) | `@Roles(...)` em `inventory.controller.ts:23,30,36,42,49,59,70,79,85` + `Assumptions` do plano — **recomputado**, `verified at f45f543` | `admin` cria C1 · `production`/`sales` barrados em criar C6 · `production` opera C12/C14/C17/C18/C19 · `sales` barrado nas 5 operacionais C25 · **`production`/`sales` leem as 3 rotas de leitura C33**; remover os `@Roles('production','sales')` quebra C33 (`Faults` D) | - |
| estados de tela `/inventory` (3) | `web/src/app/(app)/inventory/page.tsx` (`carried`) | carregando C27 · erro C28 · vazio C29 | - |
| UI por papel, `/inventory` (2) | `page.tsx:147` (`canCreate = role === "admin"`) (`carried`) | `admin` vê C29 · `production`/`sales` não veem C30 | - |
| UI por papel, detalhe do rolo (1) | `[id]/page.tsx` (`carried`) | `sales` só leitura C31 | - |
| ação destrutiva confirma antes (1) | `[id]/page.tsx` (`ConfirmDialog`) (`carried`) | descarte C32 | - |

Varredura por conjuntos que nenhum artefato nomeou:

- `ParseUUIDPipe({ errorHttpStatusCode: 400 })` acrescenta um `400` que o `Surface` não declara em
  `GET /rolls/:id`, `/open` e `/dry`. Não é lacuna: mesma convenção das Fases 6-8, não é estado novo
  (`carried from 02bae18`).
- **Risco residual registrado (não é lacuna de membro):** `STATUS_CASE_SQL`
  (`inventory.service.ts:37-42`) é a segunda implementação da regra da door 6a e C34 exercita um dos
  quatro ramos (`aberto`, com o ramo `ELSE` exercitado por exclusão). Nem o `plan.md` nem o
  `checks.md` enumeram os valores aceitos pelo filtro como conjunto — o conjunto que o `Surface` e o
  `ListRollsDto` nomeiam para essa linha são os 5 parâmetros de query, e os 5 estão provados; a
  claim de C34 é explicitamente escopada em `aberto` e é cumprida. Fica anotado que um mutante nos
  ramos `vazio`/`descartado` do `CASE` sobreviveria (não injetado: o teto de 5 faults já estava
  consumido e C34 já foi feita falhar uma vez, `Faults` C).

## Test policy rows

Re-julgadas as quatro linhas que a rodada 1 marcou `partial`/`not met` e as que classificam arquivo
tocado pelo fix (`verified at f45f543`); a primeira linha é `carried from 02bae18`.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `average-cost.ts` - média ponderada pelo saldo atual | `api/src/modules/inventory/average-cost.ts` | unit isolado + e2e pelo endpoint | yes (`carried from 02bae18`) - 5 casos em `average-cost.spec.ts:23,26,34,42,45` + referência via API em `inventory.e2e-spec.ts:222` e `:231` |
| `InventoryService.createRoll` - rolo + primeira movimentação na mesma transação | `api/src/modules/inventory/inventory.service.ts`, `inventory.service.spec.ts` | e2e do caminho feliz + unit da reversão com repositório mockado | yes (lacuna 4 da rodada 1, agora fechada) - caminho feliz C1 (`:128-134`); a reversão agora tem asserção própria sobre o wrapper: `inventory.service.spec.ts:53` `expect(transaction).toHaveBeenCalledTimes(1)`. Comprovado por experimento: o mutante "movimentação numa segunda transação" **sobrevive** ao spec de `02bae18` e fica vermelho contra o spec de `f45f543`, exatamente nessa linha |
| saldo nunca negativo sob concorrência, `CHECK` do banco | `api/src/modules/inventory/is-check-violation.ts`, `inventory.service.ts:183-201`, migration `1790174650719` | e2e de validação isolada + e2e com duas chamadas simultâneas reais | yes (lacuna 1 da rodada 1, agora fechada) - a pré-checagem em JS saiu de `addMovement`, então C15 (sequencial) e C16 (concorrente) atravessam o mesmo `catch (isCheckViolation)`. Com `CHECK_VIOLATION` mutado para `'99999'` as duas provas ficam vermelhas (`:304` e `:317`), ou seja, a constraint é a origem real do `400` |
| `status` derivado de `openedAt`/`balanceGrams`/`discardedAt` | `api/src/modules/inventory/inventory.types.ts` | os 4 valores exercitados, um por check | yes (lacuna 2 da rodada 1, agora fechada) - `fechado` `:129`, `aberto` `:342`, `vazio` `:296` (C35, novo), `descartado` `:328` (C17, asserção nova). Mutante nos 4 retornos mata C35 e C17 |
| `InventoryController` - `RolesGuard` nas 9 rotas | `api/src/modules/inventory/inventory.controller.ts` | e2e tabela-driven por conjunto de rotas × papel, os dois lados | yes (lacuna 5 da rodada 1, agora fechada) - lado negativo C6 (criar) e C25 (5 operacionais); lado positivo C33 (`:193-196`), que quebra se os `@Roles('production','sales')` das 3 rotas de leitura forem removidos |

## Faults injected

Isolamento: `git worktree add <scratch> HEAD` a partir da raiz; nenhuma mutação na árvore real.
`git status --porcelain` da árvore real vazio antes e depois, `HEAD` = `f45f543` nos dois momentos.
Um fault por superfície de asserção distinta (as superfícies que o fix mudou ou criou), teto de 5.

| Mutation | Location | Narrowest covering proof | Killed |
| --- | --- | --- | --- |
| A. backstop do `CHECK`: `CHECK_VIOLATION = '23514'` -> `'99999'` | `api/src/modules/inventory/is-check-violation.ts:3` | e2e C15 e C16 | **yes** - 2 failed (`:304` `400` virou `500`; `:317` `[201,400]` quebrou), 25 passed. *Na rodada 1 este mutante sobrevivia às 24 provas* |
| B. `status` derivado: `return 'descartado'` -> `'aberto'` e `return 'vazio'` -> `'fechado'` | `api/src/modules/inventory/inventory.types.ts:10,13` | e2e C35 e C17 | **yes** - 2 failed (`:296`, `:328`), 25 passed. *Na rodada 1 este mutante sobrevivia às 24 provas* |
| C. filtro de status: `WHEN roll.opened_at IS NOT NULL THEN 'aberto'` -> `'fechado'` | `api/src/modules/inventory/inventory.service.ts:40` (`STATUS_CASE_SQL`) | e2e C34 | yes - 1 failed (`:206`), 26 passed |
| D. matriz de papéis: remove `@Roles('production', 'sales')` das 3 rotas de leitura | `api/src/modules/inventory/inventory.controller.ts:30,36,42` | e2e C33 | yes - 1 failed (`:194`), 26 passed |
| E. door 2: a `InventoryMovement` passa para uma **segunda** `manager.transaction` (rolo já committado = órfão) | `api/src/modules/inventory/inventory.service.ts:64-93` | unit C5 | yes - 1 failed: `expected "vi.fn()" to be called 1 times, but got 2 times` (`inventory.service.spec.ts:53`). **Controle**: o mesmo mutante com o spec de `02bae18` passa verde - a asserção nova é o que o mata |

## Gate

- `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts --reporter=verbose` - **27 passed, 0 failed**
- `npm --prefix api run test -- src/modules/inventory/inventory.service.spec.ts src/modules/inventory/average-cost.spec.ts --reporter=verbose` - 2 passed, 0 failed
- `npx vitest run` nos 2 arquivos de página do web - 6 passed, 0 failed
- `npm --prefix api run test:e2e` (suíte e2e completa) - 253 passed, 0 failed (19 arquivos)
- `npm --prefix api run test` (suíte unitária completa) - 106 passed, 0 failed (24 arquivos)
- `npx vitest run` no web (suíte completa) - 106 passed, 0 failed (21 arquivos)
- `npm --prefix api run lint` - exit 0 · `npm --prefix api run build` - exit 0
- `npm --prefix web run lint` - exit 0 · `npm --prefix web run build` - exit 0 (`carried from 02bae18`; o fix não tocou em nenhum arquivo de `web/`)

## Ranked gaps

Nenhuma. As 6 lacunas da rodada 1 estão fechadas e verificadas independentemente:

1. Mutante do `CHECK` sob concorrência (door 3) - **fechado**, `Faults` A mata C15 e C16.
2. `status` `vazio`/`descartado` sem asserção (door 6a) - **fechado**, `Faults` B mata C35 e C17.
3. `?status=`/`?search=` sem prova - **fechado**, C34 com as 3 asserções em `:206`, `:209`, `:212`.
4. Precision gap de C5 (transação provada por proxy) - **fechado**, `Faults` E com controle contra
   o spec da rodada 1.
5. Lado positivo da matriz de papéis - **fechado**, C33 e `Faults` D.
6. `rollCount` sem asserção - **fechado**, valores literais em `:222` (`rollCount: 2`) e `:231`
   (`rollCount: 1`).
