# Fase 9 — Estoque de filamento por rolo · verification

**Verdict**: FAIL
**Profile**: standard
**Diff range**: e9d7157..02bae18
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Todas as 32 provas rodam verdes no `HEAD` e cada teste nomeado existe e aparece individualmente
na saída. O FAIL não vem de um teste vermelho: vem de **dois mutantes sobreviventes** e das
lacunas de `Coverage` que eles expõem. Os dois atingem exatamente as duas formas novas que o
`checks.md` usou para justificar o perfil `standard` (o backstop do `CHECK` sob concorrência e o
`status` derivado em runtime), ou seja, a parte da fase que o perfil foi escolhido para cobrir é
a que não tem asserção.

## Binding sources

O perfil é `standard`, então o passo 1 (enumeração por tela contra a fonte de design) não é
obrigatório. As fontes que o `plan.md` marca como vinculantes foram abertas mesmo assim, porque
vários checks citam os contratos delas.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `ROADMAP.md` Fase 9 (linhas 336-360) - objetivo, tarefas, critérios de aceite | yes - lido no repo | none - os dois casos de referência do ROADMAP (812 g/tara 250 g -> 562 g; 2 rolos de custos diferentes -> custo médio) estão literais em C12 e C8 | - |
| `.specs/STATE.md` AD-001 (erro `{ error }`), AD-006 (centavos/gramas), AD-007, AD-014 (uuid), AD-015 (sessão global), AD-018 (`RolesGuard`), AD-020 (paginação), AD-021 (componentes CRUD) | yes - lido no repo (linhas 7-27) | none - C23/C24/C25/C26 usam o shape `{ error }` do AD-001; C7 usa o envelope do AD-020; C32 usa o `ConfirmDialog` do AD-021 | - |
| `AGENTS.md` (raiz) e `web/AGENTS.md` - convenções de módulo, migration, erro e `NEXT_PUBLIC_API_URL` | yes - lidos no repo | none - módulo em `api/src/modules/inventory/`, schema só por migration, `apiFetch` lê `NEXT_PUBLIC_API_URL` | - |

## Checks

Uma invocação por alvo: `test/inventory.e2e-spec.ts` inteiro (24 testes, `--reporter=verbose`),
os dois specs Vitest da API juntos, e os dois testes de página do web juntos. Cada teste nomeado
aparece individualmente como executado e verde.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | rolo nasce com saldo cheio, movimento `entrada` e `status` `fechado` | e2e file run, exit 0 - "creates a roll with the first entrada movement and the derived closed status" ✓ | `api/test/inventory.e2e-spec.ts:128` `expect(response.body.balanceGrams).toBe(1000)`; `:129` `expect(response.body.status).toBe('fechado')`; `:133` `expect(movements[0]).toMatchObject({ type: 'entrada', quantity_grams: 1000 })`; `:134` `expect(Number(movements[0].unit_cost_cents_per_gram)).toBe(12)` | PASS |
| C2 | `materialId` inexistente ou inativo -> `400`, nada persistido | mesma invocação - "rejects an unknown or inactive materialId" ✓ | `api/test/inventory.e2e-spec.ts:138` tabela `[UNKNOWN_MATERIAL_ID, inactiveMaterialId]`; `:141` `expect(response.status).toBe(400)`; `:143` `expect(await countRolls()).toBe(0)` | PASS |
| C3 | `supplierId` inexistente -> `400`, nada persistido | mesma invocação - "rejects an unknown supplierId" ✓ | `api/test/inventory.e2e-spec.ts:151` `expect(response.status).toBe(400)`; `:152` `expect(await countRolls()).toBe(0)` | PASS |
| C4 | peso 0, tara -1, custo -1 -> `400` (3 casos), nada persistido | mesma invocação - "rejects a non-positive initial weight, a negative tare or a negative cost" ✓ | `api/test/inventory.e2e-spec.ts:156-160` (3 casos); `:163` `expect(response.status).toBe(400)`; `:165` `expect(await countRolls()).toBe(0)` | PASS |
| C5 | `createRoll` propaga o erro do movimento e não salva o rolo fora da transação | `npm --prefix api run test -- ...inventory.service.spec.ts` exit 0 - "rolls back the roll when the entrada movement fails to save" ✓ | `api/src/modules/inventory/inventory.service.spec.ts:47` `await expect(service.createRoll(VALID_DTO, 'user-1')).rejects.toThrow('conexão com o banco caiu')`; `:50` `expect(rollsRepoMock.save).toHaveBeenCalledTimes(1)` | PASS (precision gap - ver `Coverage`, door 2) |
| C6 | `production` e `sales` -> `403` em `POST /inventory/rolls`, nada persistido | e2e file run - "production and sales get 403 on POST /inventory/rolls" ✓ | `api/test/inventory.e2e-spec.ts:171` `expect(response.status).toBe(403)`; `:172` `expect(response.body).toEqual(PERMISSION_DENIED)`; `:174` `expect(await countRolls()).toBe(0)` | PASS |
| C7 | filtro por `materialId` no envelope AD-020 | e2e file run - "GET /inventory/rolls filters by materialId with the AD-020 pagination envelope" ✓ | `api/test/inventory.e2e-spec.ts:186` `expect(response.body).toMatchObject({ total: 1, page: 1, pageSize: 20 })`; `:187-188` `expect(response.body.items).toHaveLength(1)` / `expect(response.body.items[0].id).toBe(rollId)` | PASS |
| C8 | 2 rolos de custos diferentes -> `totalBalanceGrams: 2000`, `avgCostCentsPerGram: 11` | e2e file run - "materials-summary averages two rolls of the same material weighted by balance" ✓ | `api/test/inventory.e2e-spec.ts:198` `expect(item).toMatchObject({ totalBalanceGrams: 2000, avgCostCentsPerGram: 11 })` | PASS |
| C9 | fórmula pura: 5 casos (2 rolos, 1 rolo, saldo 0, descartado, lista vazia) | `npm --prefix api run test -- ...average-cost.spec.ts` exit 0 - "weights by remaining balance and excludes empty or discarded rolls" ✓ | `api/src/modules/inventory/average-cost.spec.ts:23` `.toBe(11)`; `:26` `.toBe(30)`; `:34` `.toBe(10)` (saldo 0 excluído); `:42` `.toBe(10)` (descartado excluído); `:45` `expect(computeAverageCostCentsPerGram([])).toBeNull()` | PASS |
| C10 | sem saldo -> `avgCostCentsPerGram: null`, `totalBalanceGrams: 0` | e2e file run - "materials-summary reports null average cost when nothing is in stock" ✓ | `api/test/inventory.e2e-spec.ts:207` `expect(item).toMatchObject({ totalBalanceGrams: 0, avgCostCentsPerGram: null })` | PASS |
| C11 | `GET /materials` sem campo de saldo/custo (door 5) | e2e file run - "does not add stock or cost fields to GET /materials" ✓ | `api/test/inventory.e2e-spec.ts:224-226` `expect(Object.keys(material as object).sort()).toEqual([...'active','bedTempC','brand','color','densityGCm3','dryingHours','dryingTemperatureC','id','needsDrying','nozzleTempC','type'].sort())` | PASS |
| C12 | 812 g bruto / tara 250 g -> saldo 562 g e `ajuste` de -38 | e2e file run - "weighing 812g gross with a 250g tare leaves the balance at 562g with an ajuste movement" ✓ | `api/test/inventory.e2e-spec.ts:236` `expect(response.body.balanceGrams).toBe(562)`; `:240` `expect(movements[0]).toMatchObject({ type: 'ajuste', quantity_grams: -38 })` | PASS |
| C13 | bruto abaixo da tara -> `400`, sem movimento e sem mudar saldo | e2e file run - "rejects a gross weight below the roll's tare" ✓ | `api/test/inventory.e2e-spec.ts:247` `expect(response.status).toBe(400)`; `:248` `expect(await balanceOf(rollId)).toBe(600)`; `:249` `expect(await movementsOf(rollId)).toHaveLength(0)` | PASS |
| C14 | `consumo` e `perda` -> `201`, saldo decrementado, `quantityGrams` negativo | e2e file run - "consumo and perda movements decrement the balance" ✓ | `api/test/inventory.e2e-spec.ts:255` tabela `['consumo','perda']`; `:258-259` `expect(response.status).toBe(201)` / `expect(response.body.balanceGrams).toBe(300)`; `:262` `expect(movements[0]).toMatchObject({ type, quantity_grams: -200 })` | PASS |
| C15 | quantidade > saldo -> `400`, nada muda | e2e file run - "rejects a movement quantity greater than the roll's balance" ✓ | `api/test/inventory.e2e-spec.ts:270` `expect(response.status).toBe(400)`; `:271` `expect(await balanceOf(rollId)).toBe(100)`; `:272` `expect(await movementsOf(rollId)).toHaveLength(0)` | PASS |
| C16 | duas baixas simultâneas -> uma `201` e uma `400`, saldo 30, **garantido pelo `CHECK` do banco (door 3)** | e2e file run - "only one of two concurrent movements that would exceed the balance succeeds" ✓ | `api/test/inventory.e2e-spec.ts:283` `expect(statuses).toEqual([201, 400])`; `:284` `expect(await balanceOf(rollId)).toBe(30)` | **FAIL** - a asserção é verde, mas o mutante em `is-check-violation.ts` (código `23514` -> `99999`) sobrevive à suíte e2e inteira: o `400` observado vem da validação de aplicação em `inventory.service.ts:182`, nunca do `CHECK`. A claim afirma um mecanismo que a prova não exercita |
| C17 | descarte grava `perda` pelo saldo inteiro, zera saldo, marca `discardedAt` | e2e file run - "discarding a roll writes a perda movement for the whole remaining balance" ✓ | `api/test/inventory.e2e-spec.ts:292` `expect(response.body.balanceGrams).toBe(0)`; `:293` `expect(response.body.discardedAt).not.toBeNull()`; `:297` `expect(movements[0]).toMatchObject({ type: 'perda', quantity_grams: -200 })` | PASS (a claim não cita `status`; a lacuna de `descartado` está em `Coverage`) |
| C18 | `/open` seta `openedAt` e `status: "aberto"`; segunda chamada mantém o mesmo `openedAt` | e2e file run - "opening a roll sets openedAt once and is idempotent on a second call" ✓ | `api/test/inventory.e2e-spec.ts:307` `expect(first.body.status).toBe('aberto')`; `:308` `expect(first.body.openedAt).not.toBeNull()`; `:312` `expect(second.body.openedAt).toBe(first.body.openedAt)` | PASS |
| C19 | duas chamadas de `/dry` avançam `lastDriedAt` | e2e file run - "drying a roll always advances lastDriedAt" ✓ | `api/test/inventory.e2e-spec.ts:326-328` `expect(new Date(second.body.lastDriedAt).getTime()).toBeGreaterThan(new Date(first.body.lastDriedAt).getTime())` | PASS |
| C20 | `userId` gravado em cada uma das 3 movimentações, por sessões diferentes | e2e file run - "records the acting user on every movement type" ✓ | `api/test/inventory.e2e-spec.ts:343` `expect(movements[0]).toMatchObject({ type: 'entrada', user_id: adminId })`; `:344` `{ type: 'ajuste', user_id: productionId }`; `:345` `{ type: 'consumo', user_id: productionId }` | PASS |
| C21 | histórico ordenado por `createdAt` com todos os campos | e2e file run - "GET /inventory/rolls/:id returns the movement history ordered by createdAt" ✓ | `api/test/inventory.e2e-spec.ts:358` `expect(movements.map((m) => m.type)).toEqual(['entrada','ajuste','consumo'])`; `:360` `expect(timestamps).toEqual([...timestamps].sort((a,b) => a-b))`; `:362-367` `toHaveProperty` de `type`/`quantityGrams`/`unitCostCentsPerGram`/`reason`/`userId`/`createdAt` | PASS |
| C22 | nenhuma rota edita/apaga movimento (`PATCH` e `DELETE` -> `404`) | e2e file run - "no route exists to edit or delete an inventory movement" ✓ | `api/test/inventory.e2e-spec.ts:383` `expect(patch.status).toBe(404)`; `:388` `expect(del.status).toBe(404)` | PASS |
| C23 | as 9 rotas sem cookie -> `401` | e2e file run - "every inventory route is 401 without a session" ✓ | `api/test/inventory.e2e-spec.ts:394-404` (9 rotas); `:407` `expect(response.status).toBe(401)`; `:408` `expect(body).toEqual(SESSION_REQUIRED)` | PASS |
| C24 | 6 rotas de rolo com uuid inexistente -> `404` | e2e file run - "every roll-scoped route is 404 for an unknown roll id" ✓ | `api/test/inventory.e2e-spec.ts:413-420` (6 rotas); `:423` `expect(response.status).toBe(404)`; `:424` `expect(body).toEqual(ROLL_NOT_FOUND)` | PASS |
| C25 | `sales` -> `403` nas 5 rotas operacionais, rolo inalterado | e2e file run - "sales gets 403 on every operational roll route" ✓ | `api/test/inventory.e2e-spec.ts:430-436` (5 rotas); `:439` `expect(response.status).toBe(403)`; `:440` `expect(body).toEqual(PERMISSION_DENIED)`; `:442` `expect(await balanceOf(rollId)).toBe(200)` | PASS |
| C26 | rolo descartado -> `409` em pesagem, baixa e descarte | e2e file run - "every balance-changing route is 409 on an already discarded roll" ✓ | `api/test/inventory.e2e-spec.ts:447-451` (3 rotas); `:454` `expect(response.status).toBe(409)`; `:456` `expect(await movementsOf(rollId)).toHaveLength(0)` | PASS |
| C27 | `/inventory` mostra "Carregando…" antes do resumo resolver | `npx vitest run` nos 2 arquivos, exit 0 - "shows loading" ✓ | `web/src/app/(app)/inventory/page.test.tsx:73` `expect(screen.getByText("Carregando…")).toBeTruthy()` | PASS |
| C28 | erro + "Tentar novamente" que refaz a chamada | mesma invocação - "shows the error and retries" ✓ | `web/src/app/(app)/inventory/page.test.tsx:86` `await screen.findByText("Não foi possível conectar à API")`; `:87` `screen.getByRole("button", { name: "Tentar novamente" })`; `:92` `expect(callsTo(fetchMock, "/inventory/materials-summary")).toHaveLength(2)` | PASS |
| C29 | estado vazio com a ação de cadastrar, para `admin` | mesma invocação - "shows an empty state with the create action only for admin" ✓ | `web/src/app/(app)/inventory/page.test.tsx:102` `expect(await screen.findByText("Nenhum rolo em estoque.")).toBeTruthy()`; `:103` `expect(screen.getByRole("button", { name: "Cadastrar rolo" })).toBeTruthy()` | PASS |
| C30 | `production` e `sales` não veem "Cadastrar rolo" | mesma invocação - "production and sales do not see the create roll action" ✓ | `web/src/app/(app)/inventory/page.test.tsx:107` tabela `[PRODUCTION_ME, SALES_ME]`; `:116` `expect(screen.queryByRole("button", { name: "Cadastrar rolo" })).toBeNull()` | PASS |
| C31 | `sales` vê o histórico e nenhum formulário/ação | mesma invocação - "sales sees only the read-only history" ✓ | `web/src/app/(app)/inventory/[id]/page.test.tsx:99` `await screen.findByText("entrada")`; `:100-104` `queryByRole(... "Pesar" / "Dar baixa" / "Abrir rolo" / "Registrar secagem" / "Descartar")).toBeNull()` | PASS |
| C32 | descarte exige confirmação; cancelar não chama a API | mesma invocação - "confirms before discarding" ✓ | `web/src/app/(app)/inventory/[id]/page.test.tsx:126` `expect(discardCalled).toBe(false)` após Cancelar; `:127` `expect(screen.queryByRole("dialog")).toBeNull()`; `:133` `expect(callsTo(fetchMock, "/inventory/rolls/r1/discard")).toHaveLength(1)` | PASS |

## Coverage

Recomputada a partir da autoridade de cada conjunto, não lida do `checks.md`: as rotas e seus
status vêm de `api/src/modules/inventory/inventory.controller.ts` cruzado com a tabela `Surface`
do `plan.md`; o enum de movimento vem de `entities/inventory-movement.entity.ts` e da migration;
os 4 valores de `status` vêm de `inventory.types.ts:5-19`; a matriz de papéis vem dos decoradores
`@Roles(...)` do controller cruzados com a linha de `Assumptions` do plano.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `POST /inventory/rolls` statuses (4) | `inventory.controller.ts:23-27` + `Surface` | 201 C1 · 400 C2/C3/C4 · 401 C23 · 403 C6 | - |
| `GET /inventory/rolls` statuses (2) | `inventory.controller.ts:30-34` + `Surface` | 200 C7 · 401 C23 | - |
| `GET /inventory/rolls/:id` statuses (3) | `inventory.controller.ts:42-46` + `Surface` | 200 C21 · 401 C23 · 404 C24 | - |
| `PATCH .../weigh` statuses (6) | `inventory.controller.ts:49-57` + `Surface` | 200 C12 · 400 C13 · 401 C23 · 403 C25 · 404 C24 · 409 C26 | - |
| `POST .../movements` statuses (6) | `inventory.controller.ts:59-68` + `Surface` | 201 C14 · 400 C15/C16 · 401 C23 · 403 C25 · 404 C24 · 409 C26 | - |
| `PATCH .../discard` statuses (5) | `inventory.controller.ts:70-77` + `Surface` | 200 C17 · 401 C23 · 403 C25 · 404 C24 · 409 C26 | - |
| `PATCH .../open` statuses (4) | `inventory.controller.ts:79-83` + `Surface` | 200 C18 · 401 C23 · 403 C25 · 404 C24 | - |
| `PATCH .../dry` statuses (4) | `inventory.controller.ts:85-89` + `Surface` | 200 C19 · 401 C23 · 403 C25 · 404 C24 | - |
| `GET /inventory/materials-summary` statuses (2) | `inventory.controller.ts:36-40` + `Surface` | 200 C8/C10 · 401 C23 | - |
| `InventoryMovement.type` (4) | `entities/inventory-movement.entity.ts` + migration `...720` (enum de 4 valores) | `entrada` C1 · `consumo` C14 · `perda` C14/C17 · `ajuste` C12 | - |
| door 1: tabelas `filament_rolls`/`inventory_movements` (2) | migrations `1790174650719`/`1790174650720`, FKs `material_id`/`supplier_id`/`roll_id`/`user_id` | criadas e populadas por C1; FK `user_id` não nula exercitada por C20 | - |
| door 2: rolo + movimento na mesma transação (2) | `inventory.service.ts:52-96` (`this.rolls.manager.transaction`) | caminho feliz C1 | **reversão na falha** - C5 substitui `manager.transaction` por um pass-through (`inventory.service.spec.ts:36`: `transaction: vi.fn((callback) => callback(manager))`), então o teste não pode falhar por rollback ausente: ele só prova "um `save` de rolo e um `save` de movimento". Nenhuma asserção observa que o rolo não ficou persistido (AC 5) |
| door 3: saldo nunca negativo (2) | `inventory.service.ts:182-201` (guarda de aplicação) + `CHECK "balance_non_negative"` na migration `...719` + `is-check-violation.ts` | validação da API C15 | **backstop do `CHECK` sob concorrência** - a suíte e2e inteira (24/24) passa com `CHECK_VIOLATION` trocado de `'23514'` para `'99999'`. As duas chamadas de C16 são serializadas na prática, a segunda relê o saldo já committado e cai na guarda de aplicação; o caminho `23514 -> 400` de `is-check-violation.ts:8-17` nunca é executado por teste nenhum |
| door 4: custo médio ponderado pelo saldo atual (3) | `average-cost.ts:10-21` | fórmula isolada C9 (5 casos) · caso de referência via API C8 · saldo zero -> `null` C10 | - |
| door 5: `Material` sem coluna nova (1) | migration `...719` (nenhum `ALTER TABLE materials`) + `MaterialResponse` | `GET /materials` inalterado C11 | - |
| door 6a: `status` derivado, 4 valores (4) | `inventory.types.ts:5` (`ROLL_STATUSES`) e `:8-19` (`deriveStatus`) | `fechado` C1 (`:129`) · `aberto` C18 (`:307`) | **`vazio` e `descartado`** - nenhuma asserção em `api/` toca esses dois valores (`rg "vazio"` só acha código-fonte e o tipo do web). A atribuição do `checks.md` está errada: C16 termina com saldo 30, não 0, e nunca lê `status`; C17 lê `balanceGrams`/`discardedAt`, nunca `status`. Mutante `'vazio' -> 'fechado'` + `'descartado' -> 'aberto'` sobrevive às 24 provas e2e |
| door 6b: nenhuma rota edita/apaga movimento (1) | `inventory.controller.ts` (nenhum `@Patch`/`@Delete` de movimento) | C22 | - |
| `GET /inventory/rolls` filtros de query (5) | `dto/list-rolls.dto.ts` + `Surface` (`materialId?`, `status?`, `search?`, `page?`, `pageSize?`) | `materialId` C7 · `page`/`pageSize` (defaults no envelope) C7 | **`status` e `search`** - nenhum teste passa `?status=` ou `?search=` em `/inventory/rolls`. O filtro `status` roda um `CASE` SQL próprio (`inventory.service.ts:37-42`, aplicado em `:112-114`) que espelha `deriveStatus` e não tem nenhuma prova - é a segunda cópia, também não testada, da mesma regra da door 6a |
| item de `materials-summary` (4 campos) | `inventory.types.ts:62-67` + `Surface` | `materialId` C8/C10 · `totalBalanceGrams` C8/C10 · `avgCostCentsPerGram` C8/C10 | **`rollCount`** - declarado no `Surface` do plano e devolvido em `inventory.service.ts:307`, sem asserção em nenhum check (`toMatchObject` de C8/C10 ignora o campo) |
| matriz de papéis × rota (3 papéis) | `@Roles(...)` em `inventory.controller.ts:22,30,36,42,49,59,70,79,85` + `Assumptions` do plano ("vendas só lê") | `admin` cria C1 · `production`/`sales` barrados em criar C6 · `production` opera C12/C14/C17/C18/C19 · `sales` barrado nas 5 operacionais C25 | **`production` e `sales` conseguem ler** - `GET /inventory/rolls`, `GET /inventory/rolls/:id` e `GET /inventory/materials-summary` só são chamados com `adminCookie` (`inventory.e2e-spec.ts:184,195,204,220,354`). Remover `@Roles('production','sales')` dessas três rotas (AD-018: sem `@Roles` a rota vira admin-only) não quebraria nenhuma prova, embora o plano decida que os três papéis leem |
| estados de tela `/inventory` (3) | `web/src/app/(app)/inventory/page.tsx:127-144,159-167` | carregando C27 · erro C28 · vazio C29 | - |
| UI por papel, `/inventory` (2) | `page.tsx:147` (`canCreate = role === "admin"`) | `admin` vê C29 · `production`/`sales` não veem C30 | - |
| UI por papel, detalhe do rolo (1) | `[id]/page.tsx` | `sales` só leitura C31 | - |
| ação destrutiva confirma antes (1) | `[id]/page.tsx` (`ConfirmDialog`) | descarte C32 | - |

Varredura por conjuntos que nenhum artefato nomeou: o `ParseUUIDPipe({ errorHttpStatusCode: 400 })`
das rotas por `:id` acrescenta um `400` que o `Surface` não declara para `GET /rolls/:id`,
`/open` e `/dry`. Não conto como lacuna: é a mesma convenção já estabelecida nos módulos das
Fases 6-8, e não é um estado novo desta fase.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `average-cost.ts` - média ponderada pelo saldo atual | `api/src/modules/inventory/average-cost.ts` | unit isolado + e2e pelo endpoint | yes - 5 casos em `average-cost.spec.ts:23,26,34,42,45` e o caso de referência via API em `inventory.e2e-spec.ts:198` e `:207` |
| `InventoryService.createRoll` - rolo + primeira movimentação na mesma transação | `api/src/modules/inventory/inventory.service.ts` | e2e do caminho feliz + unit da reversão com repositório mockado | partial - o caminho feliz está (C1, `:128-134`); a reversão não: `inventory.service.spec.ts:36` troca `manager.transaction` por um pass-through, então nada no teste pode falhar se o rollback sumir (ver `Coverage`, door 2) |
| saldo nunca negativo sob concorrência, `CHECK` do banco | `api/src/modules/inventory/is-check-violation.ts`, migration `1790174650719` | e2e de validação isolada + e2e com duas chamadas simultâneas reais | **not met** - a validação isolada está (C15); a corrida existe como teste (C16) mas não alcança o `CHECK`: com `CHECK_VIOLATION` mutado a suíte inteira continua verde, ou seja, "e2e com duas chamadas simultâneas reais" não exercita a constraint que a linha foi escrita para cobrir |
| `status` derivado de `openedAt`/`balanceGrams`/`discardedAt` | `api/src/modules/inventory/inventory.types.ts` | os 4 valores exercitados, um por check | **not met** - só `fechado` (`:129`) e `aberto` (`:307`) são afirmados; `vazio` e `descartado` não aparecem em nenhuma asserção da API. A própria linha diz "sem check dedicado extra, reaproveita a asserção do campo nesses quatro" - dois desses quatro não têm a asserção |
| `InventoryController` - `RolesGuard` nas 9 rotas | `api/src/modules/inventory/inventory.controller.ts` | e2e tabela-driven por conjunto de rotas × papel | partial - a negativa está coberta (C6 criar, C25 as 5 operacionais); o lado positivo das 3 rotas de leitura para `production`/`sales` não (ver `Coverage`, matriz de papéis) |

## Faults injected

Isolamento: `git worktree add <scratch> HEAD` a partir da raiz; nenhuma mutação na árvore real.
`git status --porcelain` antes e depois: vazio nos dois casos, `HEAD` = `02bae18` nos dois casos.
Um fault por superfície de asserção distinta, teto de 5.

| Mutation | Location | Narrowest covering proof | Killed |
| --- | --- | --- | --- |
| divisor da média: `weightedCostCents / totalBalanceGrams` -> `/ eligible.length` (11 -> 11000) | `api/src/modules/inventory/average-cost.ts:20` | `average-cost.spec.ts` (C9) | yes - 1 failed |
| pesagem: `grossWeightGrams - spoolTareGrams` -> `+` (562 -> 1062) | `api/src/modules/inventory/inventory.service.ts:150` | e2e `-t "weighing 812g gross with a 250g tare..."` (C12) | yes - 1 failed |
| backstop do `CHECK`: `CHECK_VIOLATION = '23514'` -> `'99999'` (a violação deixa de virar `400`) | `api/src/modules/inventory/is-check-violation.ts:3` | e2e `-t "only one of two concurrent movements..."` (C16); depois a suíte e2e inteira | **no** - C16 passa; as 24 provas e2e passam |
| `status` derivado: `return 'vazio'` -> `'fechado'` e `return 'descartado'` -> `'aberto'` | `api/src/modules/inventory/inventory.types.ts:13,10` | suíte e2e inteira (C16 e C17 são as provas que o `checks.md` atribui a esses valores) | **no** - 24/24 passam |
| idempotência de `/open`: remove o `if (roll.openedAt === null)`, sempre reescreve | `api/src/modules/inventory/inventory.service.ts:260-263` | e2e `-t "opening a roll sets openedAt once..."` (C18) | yes - 1 failed |

## Gate

- `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts --reporter=verbose` - 24 passed, 0 failed
- `npm --prefix api run test` (suíte completa) - 106 passed, 0 failed (24 arquivos)
- `npx vitest run` no web (suíte completa) - 106 passed, 0 failed (21 arquivos)
- `npm --prefix api run lint` - exit 0 · `npm --prefix web run lint` - exit 0
- `npm --prefix api run build` - exit 0 · `npm --prefix web run build` - exit 0

## Ranked gaps

1. **Mutante sobrevivente - o `CHECK (balance_grams >= 0)` sob concorrência nunca é exercitado**
   (door 3, C16, `Test policy` linha 3) - `api/src/modules/inventory/is-check-violation.ts:3`.
   Com o SQLSTATE trocado para um código inexistente, as 24 provas e2e continuam verdes: as duas
   chamadas de C16 se serializam, a segunda relê o saldo já committado e é barrada pela guarda de
   aplicação em `api/src/modules/inventory/inventory.service.ts:182`. Hoje, se o mapeamento
   `23514 -> 400` quebrar, a corrida real vaza `500` sem nenhum teste pegando - exatamente o risco
   que o `checks.md` cita como justificativa do perfil `standard`. Correção: uma prova que force a
   violação do `CHECK` de verdade (por exemplo, duas transações abertas em paralelo com o `UPDATE`
   relativo, ou um teste de integração que dispare o `UPDATE` sem passar pela guarda de aplicação)
   e assertar o `400`.
2. **Mutante sobrevivente - `status` `vazio` e `descartado` sem nenhuma asserção** (door 6a, C16/C17,
   `Test policy` linha 4) - `api/src/modules/inventory/inventory.types.ts:10,13`. As atribuições do
   `checks.md` não fecham: C16 termina com saldo 30 (nunca `vazio`) e C17 não lê `status`. Correção
   mínima: `expect(response.body.status).toBe('descartado')` em
   `api/test/inventory.e2e-spec.ts:292` e um caso que zere o saldo por baixa afirmando `'vazio'`.
3. **`GET /inventory/rolls?status=` sem prova** - `api/src/modules/inventory/inventory.service.ts:37-42`
   e `:112-114`. O `CASE` SQL é a segunda implementação da mesma regra da door 6a, pode divergir de
   `deriveStatus` e não tem nenhum teste. `?search=` (`:115-119`) também não.
4. **Precision gap em C5 - a reversão de `createRoll` é provada por proxy** -
   `api/src/modules/inventory/inventory.service.spec.ts:36`. O mock substitui
   `manager.transaction` por um pass-through, então o teste é estruturalmente incapaz de falhar se
   o `transaction` sumir do serviço; ele só conta chamadas de `save`. Um e2e que force o `save` do
   movimento a falhar e depois conte `filament_rolls` (o helper `countRolls` já existe,
   `api/test/inventory.e2e-spec.ts:109`) provaria AC 5 de verdade.
5. **Lado positivo da matriz de papéis sem prova** - `api/src/modules/inventory/inventory.controller.ts:30,36,42`.
   Nenhuma prova chama as 3 rotas de leitura com `productionCookie`/`salesCookie`; pelo AD-018,
   remover os `@Roles('production','sales')` tornaria as telas de estoque inacessíveis a esses
   papéis sem quebrar nenhum teste.
6. **`rollCount` do `materials-summary` sem asserção** - `api/src/modules/inventory/inventory.service.ts:307`.
   Campo declarado no `Surface` do plano; `toMatchObject` de C8/C10 o ignora. Menor.
