# Fase 10 — Insumos e peças de reposição · verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 5aa8cda..HEAD (`fdff93c`; a correção desta rodada é o commit `fdff93c`)
**Round**: 3 - scoped
**Verifier**: independent sub-agent (author != verifier)

A correção faz o que o autor alega, e eu reproduzi as duas mortes que ele afirma, mais uma terceira:

1. **C60 fecha o lado recusado do `UpdateStockItemDto`.** Os 9 casos de
   `api/test/stock-items.e2e-spec.ts:247-274` alcançam os 8 campos validados do `PATCH`. Relaxar
   `@MaxLength(150)` para `1500` (`update-stock-item.dto.ts:30`) agora morre em C60, e era o mutante
   que sobrevivia a 301/301 na rodada 2. Remover o `@IsBoolean()` de `active` (`:64`) também morre.
2. **A terceira falha que escolhi morre igual.** Remover o `@IsIn(STOCK_ITEM_CATEGORIES)` de
   `category` (`:23`) devolve `500` no lugar de `400` em C60 — o par `@IsIn`/`@IsBoolean` era o
   "conjunto adjacente sem linha" que a rodada 2 apontou, e é exatamente o que a linha nova de
   `Coverage` (`validadores exclusivos do UpdateStockItemDto`) passou a cobrir.
3. **A correção da rodada 1 não regrediu.** O mutante do AD-023 em `inventory.service.ts:481`
   (pré-checagem em memória + `UPDATE` absoluto no lugar do `shiftBalance`) morre em C24 em
   **4 de 4** rodadas, sempre com `[201, 201]` no lugar de `[201, 400]`.

**Passo 1 (`ui`) não se aplica:** o perfil é `standard` e a correção não tocou interface — o diff é
um arquivo de teste e três arquivos de documentação, sem tela nem contrato para reenumerar.

**O vermelho intermitente de C37 da rodada 2 não reproduziu**, mas o argumento do autor para ele
(um segundo processo sobre o mesmo `forge_test`) **não se sustenta como explicação exclusiva**: eu
vi um vermelho intermitente nesta rodada, sem nada concorrente, em outro arquivo. Está registrado em
`Gate` e em `Determinismo`; não reprova a fase porque nenhuma prova desta fase ficou vermelha, mas
também não fica explicado.

## Sources abertas

`carried from 7022754`. O perfil é `standard`, então o passo 1 não é obrigatório, e a correção não
tocou interface. As 4 fontes que a rodada 1 abriu (`ROADMAP.md` Fase 10, `.specs/STATE.md`
AD-015/018/020/021/022/023/024, `AGENTS.md` + `web/AGENTS.md`, `phase-9/checks.md`) seguem sem
contradição. Reabri nesta rodada só o AD-023 (`.specs/STATE.md:29`), porque é a decisão que a
reinjeção #4 mira: `shiftBalance` (`inventory.service.ts:651-665`) continua sendo o único caminho de
`addItemMovement` (`inventory.service.ts:472`, chamada em `:481`), sem pré-checagem em memória.

**Fora do meu alcance, igual às rodadas 1 e 2:** a validação em navegador. As ferramentas do
Playwright MCP não estão expostas nesta sessão. C44-C53 seguem provados só pelos testes Vitest que
os checks nomeiam; fidelidade visual, layout efetivo e navegação entre as telas novas continuam sem
evidência minha. A enumeração do que isso deixa de fora é a das rodadas anteriores: as 3 telas
novas (`/inventory/items`, `/inventory/items/[id]`, `/inventory/movements`) e o detalhe do rolo.

## Checks

`verified at fdff93c` — **as 60 provas rodaram em full no `HEAD` novo**, em 3 invocações, batendo por
alvo:

- **INV-A** `npx vitest run --config ./vitest.config.e2e.ts test/stock-items.e2e-spec.ts test/inventory.e2e-spec.ts test/movements-migration.e2e-spec.ts -t "<49 nomes>"` — **50 passed, 26 skipped**, exit 0 (50 porque `production and sales get 200 on every read route` existe nos dois arquivos de e2e)
- **INV-B** `npx vitest run src/modules/inventory/stock-item-average-cost.spec.ts -t "folds the ledger into a moving weighted average"` — 1 passed
- **INV-C** (web) `npx vitest run 'src/app/(app)/inventory/items/page.test.tsx' 'src/app/(app)/inventory/items/[id]/page.test.tsx' 'src/app/(app)/inventory/movements/page.test.tsx' 'src/app/(app)/inventory/[id]/page.test.tsx' -t "<10 nomes>"` — 10 passed, 4 skipped

Cada um dos 60 nomes apareceu **individualmente** no output como executado e verde
(`✓ test/... > ...`), nunca só o total, e cada um dos 60 foi localizado na árvore por busca literal
sobre `api/test`, `api/src` e `web/src` (60 nomes, 0 ausentes) — nenhuma prova é um filtro que casa
com nada.

As citações de `api/test/stock-items.e2e-spec.ts` estão **refrescadas**: o arquivo cresceu 29 linhas
a partir de `:247` (o corpo de C60), então toda citação da rodada 2 acima de `:246` andou +29, e eu
reconferi 59 linhas uma a uma em vez de aplicar o deslocamento no escuro. C60 é julgado de novo
aqui. Para C1-C59 o julgamento da asserção é `carried from 071f914`, com a prova re-rodada verde
agora; as citações dos outros arquivos (`inventory.e2e-spec.ts`, `movements-migration.e2e-spec.ts`,
o spec do fold e os 4 testes de tela) foram reconferidas e não mudaram, porque a correção não tocou
esses arquivos.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | cadastro nasce saldo 0, avg null, ativo, e zero movimento | INV-A | `api/test/stock-items.e2e-spec.ts:148` - `toMatchObject({ balanceQuantity: 0, avgCostCents: null, active: true })`; `:155` - `expect(await movementsOfItem(...)).toHaveLength(0)` | PASS |
| C2 | 3 casos de corpo inválido -> 400, nada persistido | INV-A | `:167` - `expect(response.status).toBe(400)` no loop de 3 casos; `:169` - `expect(await countItems()).toBe(0)` | PASS |
| C3 | sku duplicado no create e no update -> 409, item existente intacto | INV-A | `:179` `toBe(409)`; `:182` `toBe(409)`; `:186` - `expect(rows.map((row) => row.sku)).toEqual(['SKU-1', 'SKU-2'])` | PASS |
| C4 | dois itens sem sku coexistem | INV-A | `:192` - `expect([first.status, second.status]).toEqual([201, 201])`; `:197` - `expect(list.body.total).toBe(2)` | PASS |
| C5 | preferredSupplierId inexistente -> 400, nada persistido | INV-A | `:208` `toBe(400)`; `:209` - `expect(await countItems()).toBe(0)` | PASS |
| C58 | fornecedor existente aceito, devolvido, gravado, e trocado no `PATCH` (+ `location`) | INV-A | `:223` `toBe(201)`; `:224` - `toMatchObject({ preferredSupplierId: firstSupplierId, location: 'gaveta 3' })`; `:231` - linha do banco `toMatchObject({ preferred_supplier_id: firstSupplierId, location: 'gaveta 3' })`; `:234` - o mesmo no `GET /inventory/items/:id`; `:237`/`:238` - `PATCH` 200 e `preferredSupplierId` = `secondSupplierId`; `:241` - o mesmo na lista | PASS |
| C59 | 7 casos de limite/formato no `POST` -> 400, nada persistido | INV-A | `:292` - `expect(cases).toHaveLength(7)`; `:295` - `expect(response.status).toBe(400)` no loop; `:297` `countItems()).toBe(0)`; `:298` `countAllLinks()).toBe(0)` | PASS |
| C60 | os mesmos 7 casos no `PATCH` + `category` fora do enum + `active` não booleano (9 casos) -> 400, linha original intacta, nenhum vínculo | INV-A, **julgado de novo nesta rodada** | `:263` - `expect(cases).toHaveLength(9)` sobre o próprio array de 9 corpos (`:253-261`, um por validador do `UpdateStockItemDto`); `:266` - `expect(response.status).toBe(400)` no loop dos 9; `:272` - `expect(rows[0]).toMatchObject({ name: 'Cola CA', location: 'gaveta 1', category: 'insumo', active: true })` lido do banco; `:273` - `expect(await countAllLinks()).toBe(0)` | PASS |
| C6 | `active: false` -> 200, linha e histórico preservados | INV-A | `:313` - `expect(response.body.active).toBe(false)`; `:316` lista contém o id; `:318` - `expect(detail.body.movements).toHaveLength(1)` | PASS |
| C7 | `DELETE` de item (2 rotas) -> 404 | INV-A | `:327` - `expect(response.status).toBe(404)` no loop das 2 rotas; `:329` `countItems()).toBe(1)` | PASS |
| C8 | production e sales -> 403 no create e no update (4 casos) | INV-A | `:336`/`:340` `toBe(403)` + `toEqual(PERMISSION_DENIED)` (`:337`/`:341`); `:345` - `expect(rows[0].name).toBe('Ímã 6x3')` | PASS |
| C9 | filtro `category` no envelope AD-020 | INV-A | `:354` - `toMatchObject({ total: 1, page: 1, pageSize: 20 })`; `:355` só o id da peça | PASS |
| C10 | `search` casa `name` e `sku` sem diferenciar caixa | INV-A | `:364` - `?search=primer` -> `[byName]`; `:368` - `?search=bico-04` -> `[bySku]` | PASS |
| C11 | production e sales -> 200 nas 3 rotas de leitura (6 casos) | INV-A | `:374-376` - 3 × `toBe(200)` dentro do loop dos 2 cookies | PASS |
| C12 | `pageSize=101` -> 400 nas 2 listas | INV-A | `:381`/`:382` - `expect((await listItemsReq('?pageSize=101', ...)).status).toBe(400)` e idem para movements | PASS |
| C13 | entrada grava movimento com dono item e soma o saldo | INV-A | `:392` balance 100; `:396` - `toMatchObject({ type: 'entrada', stock_item_id: itemId, roll_id: null })`; `:397`/`:398` quantity 100 / unit_cost_cents 50 | PASS |
| C14 | 3 casos (qty 0, -1, custo -1) -> 400, saldo e ledger intactos | INV-A | `:410` `toBe(400)` no loop; `:412` `balanceOfItem(itemId)).toBe(10)`; `:413` 0 movimentos | PASS |
| C15 | duas entradas 100@50 e 100@70 -> saldo 200, média 60 | INV-A | `:423` - `toMatchObject({ balanceQuantity: 200, avgCostCents: 60 })` | PASS |
| C16 | consumo de 150 -> saldo 50, média ainda 60 | INV-A | `:436` - `toMatchObject({ balanceQuantity: 50, avgCostCents: 60 })` | PASS |
| C17 | entrada de 50@100 depois do consumo -> saldo 100, média 80 | INV-A | `:448` - `toMatchObject({ balanceQuantity: 100, avgCostCents: 80 })` | PASS |
| C18 | saldo zerado -> `avgCostCents: null` | INV-A | `:457` - `toMatchObject({ balanceQuantity: 0, avgCostCents: null })` | PASS |
| C19 | fold, 7 casos | INV-B - 1 passed | `api/src/modules/inventory/stock-item-average-cost.spec.ts:36` - `.toEqual({ balanceQuantity: 100, avgCostCents: 80 })`; `:46`, `:56`, `:66`, `:77` (ajuste +/-, perda, entrada após zero); `:86`/`:87` - `expect(reversed).toEqual(forward)`; `:90` - `toEqual({ balanceQuantity: 0, avgCostCents: null })` | PASS |
| C20 | entrada em item inativo -> 400, nada muda | INV-A | `api/test/stock-items.e2e-spec.ts:464` `toBe(400)`; `:465` saldo 5; `:466` 0 movimentos | PASS |
| C21 | production e sales -> 403 em `POST .../entries` | INV-A | `:473`/`:474` `toBe(403)` + `toEqual(PERMISSION_DENIED)`; `:476` saldo 0 | PASS |
| C22 | consumo e perda decrementam, quantity negativa, custo null | INV-A | `:487` - `expect(response.body.balanceQuantity).toBe(300)`; `:491` - `toMatchObject({ type, unit_cost_cents: null })`; `:492` - `Number(movements[0].quantity)).toBe(-200)` | PASS |
| C23 | quantity acima do saldo -> 400, nada muda | INV-A | `:500` `toBe(400)`; `:501` saldo 100; `:502` 0 movimentos. O "decidido pelo `CHECK`, sem pré-checagem" da claim continua indecidível por estas asserções; quem decide isso é C24 (falha #4) | PASS |
| C24 | duas baixas concorrentes -> uma 201 e uma 400, saldo 30 | INV-A | `:534` - `expect(statuses).toEqual([201, 400])`; `:535` `balanceOfItem(itemId)).toBe(30)`; `:536` 1 movimento. A intercalação é **forçada**: `:519-523` lock `FOR UPDATE` + as duas baixas disparadas, `:524` `commitTransaction()` | PASS |
| C25 | `entrada` e `ajuste` na rota de movimento -> 400 | INV-A | `:543` `toBe(400)` no loop dos 2 tipos; `:545` saldo 100; `:546` 0 movimentos | PASS |
| C26 | sales -> 403 em `POST .../movements` | INV-A | `:553`/`:554` `toBe(403)` + `toEqual(PERMISSION_DENIED)` | PASS |
| C27 | contar 45 sobre 50 -> 200, saldo 45, `ajuste` -5 | INV-A | `:566` saldo 45; `:570` - `toMatchObject({ type: 'ajuste' })`; `:571` - `Number(movements[0].quantity)).toBe(-5)` | PASS |
| C28 | contagem sem diferença grava `ajuste` 0 | INV-A | `:582` 1 movimento; `:584` - `Number(movements[0].quantity)).toBe(0)` | PASS |
| C29 | `countedQuantity: -1` -> 400, nada muda | INV-A | `:591` `toBe(400)`; `:592` saldo 50; `:593` 0 movimentos | PASS |
| C30 | sales -> 403 em `PATCH .../count` | INV-A | `:600`/`:601` `toBe(403)` + `toEqual(PERMISSION_DENIED)` | PASS |
| C31 | peça com 2 impressoras -> 201, 2 ids, 2 linhas na junção | INV-A | `:622` - `(response.body.compatiblePrinterIds).slice().sort()).toEqual([printerA, printerB].sort())`; `:625` - `linksOfItem(...)).toHaveLength(2)` | PASS |
| C32 | `compatiblePrinterIds` em insumo (create e update) -> 400, 0 vínculos | INV-A | `:636`/`:639` `toBe(400)`; `:641` - `expect(await countAllLinks()).toBe(0)` | PASS |
| C33 | um id de impressora inexistente derruba o conjunto inteiro | INV-A | `:657`/`:664` `toBe(400)`; `:667` - `expect(await countAllLinks()).toBe(0)` | PASS |
| C34 | `PATCH` substitui o conjunto | INV-A | `:679` - `expect(response.body.compatiblePrinterIds).toEqual([printerB])`; `:680` - `expect(await linksOfItem(partId)).toEqual([printerB])` | PASS |
| C35 | `PATCH` sem o campo preserva os vínculos | INV-A | `:692` - `.slice().sort()).toEqual([printerA, printerB].sort())`; `:695` - `linksOfItem(partId)).toHaveLength(2)` | PASS |
| C36 | lista unificada, ordem decrescente, envelope, dono único por linha | INV-A | `:717` - `toMatchObject({ total: 2, page: 1, pageSize: 20 })`; `:722` - `expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a))`; `:726`/`:727` rolo e item; `:732` - `expect([movement.rollId, movement.stockItemId].filter((owner) => owner !== null)).toHaveLength(1)` | PASS |
| C37 | detalhe do item com histórico crescente e campos do movimento | INV-A, **verde em 6 de 6 invocações dirigidas e em 4 de 4 rodadas da suíte cheia** | `:747` - `toMatchObject({ balanceQuantity: 5, avgCostCents: 500, compatiblePrinterIds: [printerA] })`; `:754` - `toEqual(['entrada', 'consumo', 'ajuste'])`; `:756` ordem crescente; `:758-761` `toHaveProperty` de quantity/unitCostCents/reason/userId | PASS |
| C38 | `userId` de quem fez, nos 4 tipos, por 3 sessões distintas | INV-A | `:774` - `toEqual([['entrada', adminId], ['consumo', productionId], ['perda', productionId], ['ajuste', production2Id]])` | PASS |
| C39 | `CHECK` XOR recusa dois donos e nenhum dono | INV-A | `:805` e `:806` - `toEqual({ code: '23514', constraint: 'movement_single_owner' })` para `(rollId, itemId)` e para `(null, null)`; `:807` 0 movimentos | PASS |
| C40 | histórico do rolo usa as chaves novas e não as antigas | INV-A | `api/test/inventory.e2e-spec.ts:422`/`:423` - `not.toHaveProperty('quantityGrams')` e `not.toHaveProperty('unitCostCentsPerGram')`; `:425` - `toMatchObject({ type: 'entrada', quantity: 1000, unitCostCents: 12 })` | PASS |
| C41 | valores do ledger do rolo inalterados depois da renomeação | INV-A | `api/test/inventory.e2e-spec.ts:439` - `expect(movements.map((m) => Number(m.quantity))).toEqual([1000, -438, -100])`; `:440` unit_cost_cents 12; `:444` `stock_item_id === null` em todos | PASS |
| C42 | `PATCH`/`DELETE` de movimento nos 2 donos -> 404 | INV-A | `api/test/stock-items.e2e-spec.ts:827`/`:828` - `toBe(404)` para patch e delete no loop das 2 rotas; `:830` o movimento semeado continua lá | PASS |
| C43 | `down()` + `up()` preserva a linha, `stock_item_id` nulo, `CHECK` valendo | INV-A | `api/test/movements-migration.e2e-spec.ts:65`/`:66` valores antigos 1000/12 depois do `down()`; `:74`/`:75` 1000/12 depois do `up()`; `:76` - `expect(afterUp[0].stock_item_id).toBeNull()`; `:83` - `expect(constraints).toHaveLength(1)` | PASS |
| C44 | lista mostra "Carregando…" antes do `GET` resolver | INV-C - 10 passed | `web/src/app/(app)/inventory/items/page.test.tsx:89` - `expect(screen.getByText("Carregando…")).toBeTruthy()` | PASS |
| C45 | lista mostra nome/unidade/saldo/custo médio e filtra por categoria | INV-C | `page.test.tsx:106` - `toEqual(["Parafuso M3x8", "Insumo", "un", "200 un", "R$ 0.60/un"])`; `:118` `"—"` para a peça sem média; `:123` - `expect(callsTo(fetchMock, PARTS_PATH)).toHaveLength(1)` | PASS |
| C46 | erro com "Tentar novamente", sem tabela parcial | INV-C | `page.test.tsx:135` `findByRole("alert")`; `:136` - `expect(screen.queryByRole("table")).toBeNull()`; `:143` - `callsTo(fetchMock, ALL_ITEMS_PATH)).toHaveLength(2)` | PASS |
| C47 | vazio com a ação de cadastrar, visível só para admin | INV-C | `page.test.tsx:154` - `getByRole("button", { name: "Cadastrar item" })).toBeTruthy()`; `:165` - `queryByRole(...)).toBeNull()` no loop de production e sales | PASS |
| C48 | production e sales não veem cadastrar nem registrar entrada | INV-C | `page.test.tsx:179`/`:180` - `queryByRole("button", { name: "Cadastrar item" })).toBeNull()` e idem `"Registrar entrada"`; lado positivo em `:192`/`:193` | PASS |
| C49 | sales vê o histórico e não vê baixa, contagem nem desativar | INV-C | `items/[id]/page.test.tsx:109` histórico visível (`findByText("entrada")`); `:110`, `:111`, `:112` - `queryByRole("button", { name: ... })).toBeNull()` para "Dar baixa", "Registrar contagem" e "Desativar" | PASS |
| C50 | detalhe mostra saldo, custo médio, nome da impressora e histórico com usuário e data | INV-C | `items/[id]/page.test.tsx:125` `"5 un"`; `:126` `"R$ 45.00/un"`; `:128` `"Bambu X1C"`; `:132` - `toEqual([...])` com tipo, quantidade, custo, motivo, usuário e data local | PASS |
| C51 | desativar confirma antes; cancelar não chama a API | INV-C | `items/[id]/page.test.tsx:163` - `expect(patched).toBe(false)` depois do "Cancelar"; `:174` - `expect(patchCalls).toHaveLength(1)`; `:175` - `toEqual({ active: false })` | PASS |
| C52 | movimentações de rolo e item na mesma tabela com o dono, + 3 estados | INV-C | `movements/page.test.tsx:75` carregando; `:82` - `getByRole("link", { name: "Rolo" }).getAttribute("href")).toBe("/inventory/r1")`; `:86` - `"Item"` -> `/inventory/items/i1`; `:99`/`:100` erro sem tabela; `:105` retry; `:111` vazio | PASS |
| C53 | tela do rolo lê as chaves renomeadas | INV-C | `inventory/[id]/page.test.tsx:138` - `toEqual(["entrada", "1000", "0.12", <data local>])`; `:142`/`:143` - `"-200"` e `"—"` | PASS |
| C54 | as 8 rotas novas sem cookie -> 401 | INV-A | `api/test/stock-items.e2e-spec.ts:846` - `expect(routes).toHaveLength(8)`; `:849`/`:850` - `toBe(401)` + `toEqual(SESSION_REQUIRED)` no loop | PASS |
| C55 | as 5 rotas de item com uuid inexistente -> 404 | INV-A | `:862` - `toHaveLength(5)`; `:865`/`:866` - `toBe(404)` + `toEqual(ITEM_NOT_FOUND)` | PASS |
| C56 | as 6 rotas com `:id` malformado -> 400 | INV-A | `:879` - `toHaveLength(6)`; `:881` - `expect((await route()).status).toBe(400)` | PASS |
| C57 | baixa de rolo aceita `quantity` e recusa `quantityGrams` | INV-A | `api/test/inventory.e2e-spec.ts:451`/`:452` - `toBe(201)` e `balanceGrams` 450; `:456` - `expect(oldKey.status).toBe(400)`; `:457` saldo inalterado | PASS |

## Coverage

As **3 linhas cuja autoridade a correção tocou** foram recomputadas agora (`verified at fdff93c`),
lendo os dois DTOs direto do código — `create-stock-item.dto.ts` e `update-stock-item.dto.ts` — e
não a tabela do `checks.md`. A terceira delas (`validadores exclusivos do UpdateStockItemDto`)
nasceu nesta correção e é justamente o conjunto adjacente que a rodada 2 apontou como sem linha.
A linha de statuses do `PATCH` ganhou C60 como prova de `400`. As outras 32 linhas são
`carried from 071f914`: a correção não tocou a autoridade delas (nenhuma rota, entidade, migration,
enum, `@Roles` ou tela mudou) e as provas que as sustentam rodaram verdes agora.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| campos de texto com limite declarado, os dois DTOs (8) | **recomputado agora**: `create-stock-item.dto.ts:26` (name 150), `:33` (sku 60), `:39` (unitOfMeasure 1-20), `:46` (location 100) e `update-stock-item.dto.ts:30, 37, 43, 50` — o `UpdateStockItemDto` declara os 4 limites por conta própria, sem `PartialType` | `POST`: name, sku, location, unitOfMeasure -> C59 (`:292` fixa 7 casos, `:295` exige 400) · `PATCH`: name, sku, location, unitOfMeasure -> C60 (`:253-256` são os 4 corpos, `:263` fixa 9 casos, `:266` exige 400) | - |
| formato de id dentro do corpo, os dois DTOs (6) | **recomputado agora**: `create-stock-item.dto.ts:50` (IsUUID), `:56` (ArrayUnique), `:57` (IsUUID each) e `update-stock-item.dto.ts:54, 59, 60` | `POST`: preferredSupplierId não-uuid, printer não-uuid, printer repetido -> C59 (`:283`, `:284`, `:289`) · `PATCH`: os mesmos 3 -> C60 (`:257`, `:258`, `:259`) | - |
| validadores exclusivos do `UpdateStockItemDto` (2) | **recomputado agora** (linha nova desta correção): `update-stock-item.dto.ts:23` (`@IsIn(STOCK_ITEM_CATEGORIES)`) e `:64` (`@IsBoolean()`) — são os 2 que o `POST` não tem como recusar pelo mesmo caminho | `category` fora do enum -> C60 (`:260`, 400 em `:266`; falha #3 morre aqui) · `active` não booleano -> C60 (`:261`, 400 em `:266`; falha #2 morre aqui) | - |
| `StockItem.preferredSupplierId` FK opcional (3) | `carried from 071f914` - plano `Relations` + `Surface` vs. `inventory.service.ts:572` e `inventory.types.ts:162` | omitido -> C1 · id inexistente -> C5 · id válido aceito, gravado e devolvido -> C58 | - |
| `POST /inventory/items` statuses (5) | `carried from 7022754` - plano `Surface` | 201 C1, C58 · 400 C2, C5, C32, C33, C59 · 401 C54 · 403 C8 · 409 C3 | - |
| `PATCH /inventory/items/:id` statuses (6) | `carried from 071f914` - plano `Surface`, com C60 somado ao 400 | 200 C6, C34, C35, C58 · 400 C32, C33, C56, **C60** · 401 C54 · 403 C8 · 404 C55 · 409 C3 | - |
| `GET /inventory/items` statuses (3) | `carried from 7022754` | 200 C9, C10, C11, C58 · 400 C12 · 401 C54 | - |
| `GET /inventory/items/:id` statuses (4) | `carried from 7022754` | 200 C37, C11, C58 · 400 C56 · 401 C54 · 404 C55 | - |
| `POST /inventory/items/:id/entries` statuses (5) | `carried from 7022754` | 201 C13 · 400 C14, C20, C56 · 401 C54 · 403 C21 · 404 C55 | - |
| `POST /inventory/items/:id/movements` statuses (5) | `carried from 7022754` | 201 C22 · 400 C23, C25, C56 · 401 C54 · 403 C26 · 404 C55 | - |
| `PATCH /inventory/items/:id/count` statuses (5) | `carried from 7022754` | 200 C27, C28 · 400 C29, C56 · 401 C54 · 403 C30 · 404 C55 | - |
| `GET /inventory/movements` statuses (3) | `carried from 7022754` | 200 C36, C11 · 400 C12 · 401 C54 | - |
| `GET /inventory/rolls/:id` statuses (4) | `carried from 7022754` | 200 C40 · 400 C56 · 401 Fase 9 C23 · 404 Fase 9 C24 | - |
| `POST /inventory/rolls/:id/movements` statuses (6) | `carried from 7022754` | 201 C57 · 400 C57 · 401 Fase 9 C23 · 403 Fase 9 C25 · 404 Fase 9 C24 · 409 Fase 9 C26 | - |
| rotas novas do módulo (8) | `carried from 7022754` - `inventory.controller.ts:102, 108, 114, 122, 128, 134, 146, 157` | as 8 na tabela de C54, com `expect(routes).toHaveLength(8)` | - |
| `stock_items_category_enum` (2) | `carried from 7022754` | `insumo` C1 · `peca_reposicao` C31 | - |
| tipo de movimento com dono item (4) | `carried from 7022754` | `entrada` C13 · `consumo` C22 · `perda` C22 · `ajuste` C27 | - |
| tipo de movimento com dono rolo, depois da renomeação (4) | `carried from 7022754` | `entrada`/`ajuste`/`consumo` C41 · `perda` Fase 9 C17 | - |
| door 1: `stock_items`, saldo não negativo e `sku` único (4) | `carried from 7022754` | tabela criada e populada C1 · `CHECK` sequencial C23 · `CHECK` concorrente C24 · `sku` único C3 e nulos coexistindo C4 | - |
| door 2: compatibilidade peça×impressora (5) | `carried from 7022754` | cria com 2 C31 · insumo recusado C32 · impressora inexistente recusada C33 · `PATCH` substitui C34 · omissão preserva C35 | - |
| door 3: dono único do movimento (5) | `carried from 7022754` | dono item C13 · dono rolo C41 · dois donos C39 · nenhum dono C39 · linhas existentes sobrevivem C43 | - |
| door 4: contrato renomeado (4) | `carried from 7022754` | resposta do rolo C40 · corpo da baixa C57 · lista unificada C36 · tela do rolo C53 | - |
| door 5: média móvel por replay (5) | `carried from 7022754` | duas entradas C15 · saída não altera C16 · entrada depois da saída C17 · saldo zero -> `null` C18 · fold isolado C19 | - |
| door 6: cadastro sem movimento (2) | `carried from 7022754` | criar não grava movimento C1 · entrada grava C13 | - |
| papel que cadastra e dá entrada (1) | `carried from 7022754` | `admin` C1, C13 | - |
| papéis barrados em cadastro e entrada (2) | `carried from 7022754` | `production` C8, C21 · `sales` C8, C21 | - |
| ações de produção sobre o item (3) | `carried from 7022754` | consumo C22 · perda C22 · contagem C27 | - |
| papel barrado nas ações operacionais (1) | `carried from 7022754` | `sales` C26, C30 | - |
| papéis que leem, lado positivo (3 rotas) | `carried from 7022754` | `GET /inventory/items` C11 · `GET /inventory/items/:id` C11 · `GET /inventory/movements` C11 | - |
| filtros de `GET /inventory/items` (3) | `carried from 7022754` | `category` C9 · `search` em `name` C10 · `search` em `sku` C10 | - |
| estados da tela `/inventory/items` (3) | `carried from 7022754` | carregando C44 · erro C46 · vazio C47 | - |
| estados da tela `/inventory/movements` (3) | `carried from 7022754` | carregando C52 · erro C52 · vazio C52 | - |
| UI por papel nas telas de item (2) | `carried from 7022754` | lista esconde criar/entrada C48 · detalhe só leitura para sales C49 | - |
| ação destrutiva confirma antes (1 tela) | `carried from 7022754` | desativar item C51 | - |
| rota inexistente por design (3) | `carried from 7022754` | `DELETE` de item C7 · `PATCH` de movimento C42 · `DELETE` de movimento C42 | - |
| startup config: entidades e migrations novas visíveis (2 assemblies) | `carried from 7022754` - `data-source.ts:13-14` (globs) + `app.module.ts:24, 37` e `inventory.module.ts:11` | (a) CLI: `migration:run` do `global-setup.ts:26` cria `stock_items`, exercitado por C1 e C43 · (b) app: `autoLoadEntities` + `forFeature([... StockItem, StockItemPrinter])`, exercitado por qualquer rota de item (C1) | - |

**Nenhum validador de nenhum dos dois DTOs ficou sem membro, no recorte por campo.** Varri os dois
arquivos campo a campo: no `CreateStockItemDto` os 7 campos têm ao menos um lado recusado provado
(`category` C2, `name` C2 e C59, `sku` C59, `unitOfMeasure` C2 e C59, `location` C59,
`preferredSupplierId` C5 e C59, `compatiblePrinterIds` C59 com C32 e C33), e no
`UpdateStockItemDto` os 8 estão em C60 (`:253-261`, um corpo por campo). O conjunto adjacente que a
rodada 2 apontou — `@IsIn` de `category` e `@IsBoolean` de `active` — **agora tem linha própria**, e
as duas falhas injetadas nele morrem.

Nível e amostragem (`carried from 071f914`, reconferido em C60): C60 atravessa a fronteira HTTP
(e2e real contra o `AppModule`), confere a linha do banco em `:272` e fixa a cardinalidade da
tabela em `:263`, então a claim "9 casos" não afirma mais do que a prova exercita.

Precision gaps:

1. **C23** (`carried from 071f914`, não corrigido): a claim declara o mecanismo ("decidido pelo
   `CHECK` do banco sobre um `UPDATE` relativo, sem pré-checagem em memória") e as suas asserções
   seguem idênticas sob uma pré-checagem. Cosmético agora: C24 distingue o mecanismo em 4 de 4
   (falha #4). A correção é reescrever a claim de C23 para o que ela prova.
2. **Granularidade do "cada lado recusado"** (novo nesta rodada, e é sobre os checks, não sobre o
   código): a linha de `Test policy` pede um e2e por lado recusado, e os checks operacionalizam isso
   por **campo**, não por decorator. Sobram sem caso, nos dois DTOs, os decorators de forma:
   `@IsString()` (4 campos em cada), `@IsArray()` e o `@IsNotEmpty()` dos dois textos opcionais
   (`create-stock-item.dto.ts:32` e `:45`, `update-stock-item.dto.ts:36` e `:49`). Nenhum teste
   envia `sku: ''` nem `location: ''`, e `inventory.service.ts:354` grava `dto.sku ?? null`, então
   um `''` chegaria à coluna como `''` e colidiria no índice único. **Consequência real hoje: zero**
   — a tela envia `createForm.sku || undefined`
   (`web/src/app/(app)/inventory/items/page.tsx:124-125`), logo nenhum cliente do sistema manda
   `''`. Não injetei falha aqui: é superfície que a correção desta rodada não tocou, e a rodada 2 já
   fechou a linha do create. Fica registrado como imprecisão dos checks, coberta em substância pela
   lição L-027.
3. **C45** (`carried from 7022754`): a claim diz "de cada um" dos dois itens e a asserção cobre as 5
   células do insumo e só a de custo médio da peça. A dimensão em que diferem está coberta.

`Swept` (`carried from 7022754`): as 7 linhas que resolvem para `existing` foram reconferidas na
rodada 1 e a correção não tocou nenhuma. Reabri só a de `concurrency`, que é a que a reinjeção #4
mira: `inventory.service.ts:656` `set({ balanceQuantity: () => 'balance_quantity + :delta' })` e
`:660` `isCheckViolation(error)` -> `BadRequestException` continuam sendo o caminho único, e
`addItemMovement` (`:472`, chamada em `:481`) não ganhou pré-checagem nenhuma.

## Test policy rows

A linha que estava `unmet` foi **rejulgada agora** (`verified at fdff93c`); as outras 7 são
`carried from 071f914` — a correção não tocou nenhum arquivo que elas classificam, porque o diff é
`api/test/stock-items.e2e-spec.ts` mais documentação.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| DTOs de item e de movimento (validação com decisão) — **rejulgada** | `create-stock-item.dto.ts`, `update-stock-item.dto.ts`, `list-stock-items.dto.ts`, `create-entry.dto.ts`, `create-item-movement.dto.ts`, `count-item.dto.ts`, `list-movements.dto.ts` | e2e do lado aceito **e** de cada lado recusado | yes - fechada nos dois arquivos que faltavam: lado aceito em C1, C6, C34, C35 e C58; lado recusado do create pelos 7 casos de C59 (`:292-298`) e do update pelos 9 casos de C60 (`:263-273`), um por campo validado; as 3 falhas injetadas em `update-stock-item.dto.ts` (`:30`, `:64`, `:23`) morrem em C60. Os demais DTOs seguem cobertos por C2, C5, C12, C14, C25 e C29 |
| mappers de resposta (instrumentação) | `inventory.types.ts` (`toStockItemResponse`, `toMovementResponse`) | nenhuma própria, coberto pelos consumidores | yes (`carried from 071f914`) - `location` (`inventory.types.ts:161`) e `preferredSupplierId` (`:162`) asseridos por um consumidor em C58 (`:224`, `:234`, `:241`); os demais campos seguem cobertos por C1, C36 e C37 |
| fold do ledger em média móvel (decide; forma nova) | `stock-item-average-cost.ts` | unit isolado **e** e2e pela rota | yes (`carried from 7022754`) - C19 com 7 casos em `stock-item-average-cost.spec.ts:36-90`, e a sequência pela API em C15-C18 |
| `CHECK` XOR de dono único (decide; dois lados) | `1790189659473-AlterInventoryMovementsOwner.ts` | um teste por lado, direto no banco | yes (`carried from 7022754`) - C39 nos dois lados, `stock-items.e2e-spec.ts:805` e `:806`, com SQLSTATE e nome da constraint |
| migration que altera tabela com linhas (decide) | `1790189659473-AlterInventoryMovementsOwner.ts` | `down()` + `up()` sobre linha semeada | yes (`carried from 7022754`) - C43 em `movements-migration.e2e-spec.ts:63-83` |
| renomeação de contrato consumido (decide) | `inventory.types.ts`, `create-movement.dto.ts`, `web/src/lib/inventory.ts`, `web/.../inventory/[id]/page.tsx` | um e2e por rota afetada **e** um teste de tela | yes (`carried from 7022754`) - C40, C57, C41 e C53 |
| substituição de conjunto no `PATCH` (decide; primeiro N-N) | `inventory.service.ts` (`replaceCompatibility`) | e2e para cada semântica | yes (`carried from 7022754`) - C34, C35 e C33 |
| `RolesGuard` nas 8 rotas novas (decide) | `inventory.controller.ts` | tabela e2e por rotas × papel, os dois lados | yes (`carried from 7022754`) - barrado C8, C21, C26, C30; liberado C11, C1, C6, C13, C22, C27 |

## Faults injected

`verified at fdff93c`. `git worktree add /tmp/verify10r3/scratch HEAD`, nunca `git stash`, nunca a
árvore real; `api/node_modules` linkado do repositório e
`npx vitest run --config ./vitest.config.e2e.ts` de dentro de `<worktree>/api`. Porcelain da árvore
real **antes**: ` M .agents/.skill-lock.json` / ` M .agents/.skill-lock.json.backup` / `?? .kiro/` /
`?? .specs/features/phase-10-stock-items/verification.md`. Cada falha foi revertida
(`git checkout --`) antes da seguinte, com o porcelain do worktree limpo entre elas. Depois de
remover o worktree: porcelain da árvore real **idêntico** ao baseline (`diff` sem saída) e
`git worktree list` só com o repositório.

Quatro falhas: as três que a correção criou, no arquivo que ela passou a alcançar, e uma reinjeção
na superfície que a rodada 1 tinha consertado, para confirmar que não regrediu. As três primeiras
caem na mesma prova de propósito — C60 é a superfície nova, e uma superfície nova nunca foi feita
falhar; cada uma exercita um caso diferente do array de 9, e o status recebido difere entre elas, o
que identifica qual caso disparou.

| Mutation | Location | Narrowest covering proof | Killed |
| --- | --- | --- | --- |
| 1. limite de tamanho relaxado no update: `@MaxLength(150)` -> `@MaxLength(1500)` no `name` (o mutante que sobrevivia na rodada 2) | `api/src/modules/inventory/dto/update-stock-item.dto.ts:30` | C60 | yes - exit 1, `AssertionError: expected 200 to be 400` em `stock-items.e2e-spec.ts:266` (caso 1 do array) |
| 2. `@IsBoolean()` removido de `active`, então `active: 'sim'` passa pelo `ValidationPipe` | `api/src/modules/inventory/dto/update-stock-item.dto.ts:64` | C60 | yes - exit 1, `expected 200 to be 400` em `:266` (caso 9; os 8 anteriores seguem em 400) |
| 3. `@IsIn(STOCK_ITEM_CATEGORIES)` removido de `category`, então `consumivel` chega ao enum do banco | `api/src/modules/inventory/dto/update-stock-item.dto.ts:23` | C60 | yes - exit 1, `expected 500 to be 400` em `:266` (caso 8; o `500` distingue este mutante dos outros dois) |
| 4. saldo por pré-checagem em memória + `UPDATE` absoluto no lugar do `shiftBalance` relativo (o que o AD-023 proíbe) | `api/src/modules/inventory/inventory.service.ts:481` (`addItemMovement`) | C24 | yes - **4 de 4 rodadas**, todas com `AssertionError: expected [ 201, 201 ] to deeply equal [ 201, 400 ]` em `:534`: a correção da rodada 1 continua valendo |

## Determinismo

`verified at fdff93c`. A rodada 2 registrou C37 vermelho 1 vez em 6 invocações, sem atribuição. O
autor argumenta que só um segundo processo sobre o mesmo `forge_test` explica o sintoma, porque o
único código que apaga `stock_items` é o `beforeEach` do próprio arquivo.

**O que rodei, com nada concorrente** (checado: `fileParallelism: false` no
`vitest.config.e2e.ts:16`, então os arquivos já rodam em série dentro de uma invocação; o container
`brios3d_forge-api-1` está ligado a `DB_NAME=forge`, não a `forge_test`, pelo `docker-compose.yml`;
e as minhas invocações foram estritamente sequenciais, uma por vez):

- a invocação dirigida INV-A **6 vezes**: C37 verde em 6 de 6, 50 passed em todas
- a suíte e2e cheia **4 vezes**: C37 verde em 4 de 4

**C37 não reproduziu.** O vermelho da rodada 2 fica sem causa atribuída, e o que fica sem prova é a
afirmação "C37 é determinístico": 10 rodadas verdes seguidas são evidência forte, não demonstração.

**Mas o argumento do autor não fica estabelecido, porque eu vi um vermelho intermitente sem nada
concorrente.** Na 1ª das 4 rodadas da suíte cheia, `api/test/sales-channels.e2e-spec.ts` (arquivo da
Fase 5, que **não** carrega nenhum check desta fase) deu 2 falhas: `expected 426 to be 400` em
`sales-channels.e2e-spec.ts:180` e `expected 404 to be 403` em `:201` — 300 passed, 2 failed. As
outras 3 rodadas da suíte deram 302/302, e o arquivo sozinho deu 17/17 em 3 rodadas seguidas. Dois
fatos ancoram a leitura: `426` não existe em lugar nenhum de `api/src` (busca literal por `426`,
`UPGRADE_REQUIRED` e `UpgradeRequired`, zero ocorrências), então aquela asserção recebeu um status
que a aplicação sob teste não sabe produzir; e não havia segundo processo. Ou seja, a suíte tem
não-determinismo **entre arquivos, no transporte**, que a hipótese do "segundo processo no mesmo
banco" não cobre. Não consegui atribuir a causa sem instrumentar o teste, o que está fora do meu
papel (read-only), e eu **não** transformei isto num FAIL da Fase 10: nenhuma prova desta fase ficou
vermelha em rodada nenhuma, e o arquivo afetado não sustenta nenhum dos 60 checks. É risco aberto
para quem cuidar da suíte, com a observação de que procurar a causa no banco compartilhado é
procurar no lugar errado.

## Gate

- INV-A (49 nomes, 3 arquivos) - **50 passed, 0 failed**, 26 skipped · repetida 6 vezes, verde nas 6
- INV-B (fold) - 1 passed, 0 failed
- INV-C (web, 10 nomes, 4 arquivos) - 10 passed, 0 failed, 4 skipped
- `npx vitest run --config ./vitest.config.e2e.ts` (suíte e2e cheia) - **302 passed, 0 failed** nas rodadas 2, 3 e 4; na rodada 1, 300 passed e 2 failed em `sales-channels.e2e-spec.ts` (Fase 5, sem check desta fase) — ver `Determinismo`
- `npm --prefix api run test` - 107 passed, 0 failed (25 arquivos)
- `npm --prefix web run test` - 118 passed, 0 failed (24 arquivos)
- `npm --prefix api run lint` - exit 0 · `npm --prefix web run lint` - exit 0
- `npm --prefix api run test:e2e` - 302 passed, 0 failed
