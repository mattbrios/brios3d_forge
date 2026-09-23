# Fase 10 — Insumos e peças de reposição · checks

Profile: standard
Plan: `.specs/features/phase-10-stock-items/plan.md`

57 checks em 8 fatias · 6 one-way doors · nenhuma questão aberta

O `AGENTS.md` não declara perfil (`light` seria o padrão). Uso `standard`, como as Fases 8 e 9,
por quatro formas que o repositório não tem análogo para:

1. **O custo médio do item é um fold, não uma soma.** `average-cost.ts` (Fase 9) é uma média
   ponderada sobre um snapshot de rolos — ordem irrelevante. Aqui o resultado depende da
   intercalação entre `entrada` e saída no ledger (door 5), e um mutante que recalculasse a média
   também na saída passaria por qualquer teste que só somasse duas entradas.
2. **Primeira invariante XOR no banco.** O `CHECK ((roll_id IS NOT NULL) <> (stock_item_id IS NOT
   NULL))` (door 3) tem dois lados de violação (ambos preenchidos, ambos nulos) e um mutante que
   trocasse `<>` por `OR` continuaria aceitando toda linha válida.
3. **Primeira migration deste sistema que altera uma tabela com linhas.** Toda migration anterior
   só criou tabela nova. Renomear duas colunas e relaxar um `NOT NULL` em `inventory_movements`
   roda sobre dado que já existe.
4. **Primeira renomeação de contrato já consumido.** O risco de regressão está em código que esta
   fase não está mudando por outro motivo (as rotas e a tela do rolo), que é exatamente onde um
   `light` não olharia.

Um `light` também não pegaria um `PATCH` de compatibilidade que somasse em vez de substituir o
conjunto. Um `standard` tabula os quatro e recomputa a junção de `Coverage` a partir das fontes,
não do resumo do autor.

Os valores esperados vêm do `plan.md` (`## Criteria` e `## Landing`) e ficam escritos
**literalmente** nas asserções, nunca derivados chamando o próprio código em teste.

Onde as provas rodam: os e2e (`npm --prefix api run test:e2e`) montam o `AppModule` contra o
`forge_test`, com as migrations aplicadas pelo `global-setup.ts` antes da suíte (padrão da Fase 0),
num arquivo novo `test/stock-items.e2e-spec.ts` com seu próprio `test/stock-items-helper.ts`
(login por papel, seed de item/impressora/fornecedor e movimento direto no banco), espelhando
`inventory.e2e-spec.ts`/`inventory-helper.ts` (Fase 9). O fold do custo médio
(`stock-item-average-cost.ts`, puro, sem acesso ao banco) ganha um spec Vitest isolado, no mesmo
nível de `average-cost.spec.ts`. A migration de `inventory_movements` ganha um arquivo próprio
(`test/movements-migration.e2e-spec.ts`) que roda `down()` e `up()` por `QueryRunner` sobre linhas
semeadas — sem CLI e sem `build`, para caber no `testTimeout` de 30 s. No web, Vitest + Testing
Library com o `fetch` substituído, como em `materials/page.test.tsx`; nenhum componente de `crud/`
é retestado aqui.

## Checks

### S1 - Cadastro de item · 6 files · 30 KB · ~8k

**C1** - `POST /inventory/items` com sessão de `admin` e só os obrigatórios
(`category: "insumo"`, `name: "Parafuso M3x8"`, `unitOfMeasure: "un"`) responde `201` com
`balanceQuantity: 0`, `avgCostCents: null`, `active: true`, e o item tem **zero** linha em
`inventory_movements` (AC 1, door 6)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "creates a stock item with zero balance and no ledger movement"`

**C2** - Tabela sobre `category: "consumivel"` (fora do enum), `name: ""` e `unitOfMeasure: ""`
em `POST /inventory/items` (3 casos): cada um responde `400`, e nenhum item é persistido (AC 2)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "rejects an unknown category, an empty name or an empty unit of measure"`

**C3** - Tabela sobre `POST /inventory/items` e `PATCH /inventory/items/:id` com um `sku` que já
existe em outro item (2 casos): cada um responde `409`, e o item existente não muda (AC 3)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "rejects a duplicate sku on create and on update"`

**C4** - Dois `POST /inventory/items` sem `sku` respondem `201` os dois, e os dois itens coexistem
em `GET /inventory/items` (AC 4 - índice único do Postgres não trata dois nulos como duplicados,
mesmo precedente de `Supplier.document`)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "accepts two items without sku"`

**C5** - `POST /inventory/items` com `preferredSupplierId` inexistente responde `400`, e nenhum
item é persistido (AC 5)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "rejects an unknown preferredSupplierId"`

**C6** - `PATCH /inventory/items/:id` com `{ active: false }` responde `200` com `active: false`,
e o item continua aparecendo em `GET /inventory/items` com o histórico intacto (AC 6)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "deactivating an item keeps the row and its history"`

**C7** - Tabela sobre `DELETE /inventory/items/:id` e `DELETE /inventory/items` (2 casos): cada um
responde `404`, porque a rota nunca é declarada no controller (AC 7)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "no route exists to physically delete a stock item"`

**C8** - Tabela sobre sessão de `production` e de `sales` em `POST /inventory/items` e
`PATCH /inventory/items/:id` (4 casos): cada um responde `403`, e nada é persistido (AC 8)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "production and sales get 403 on create and update"`

**C9** - Com um insumo e uma peça semeados, `GET /inventory/items?category=peca_reposicao`
responde `200` só com a peça, no envelope `{ items, total, page, pageSize }` com `page: 1` e
`pageSize: 20` (AC 9, AD-020)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "GET /inventory/items filters by category with the AD-020 pagination envelope"`

**C10** - Tabela sobre `GET /inventory/items?search=` casando contra `name` e contra `sku`, cada
um com o termo em caixa diferente da gravada (2 casos): cada um responde `200` só com o item
esperado (AC 10)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "GET /inventory/items searches name and sku case-insensitively"`

**C11** - Tabela sobre sessão de `production` e de `sales` em `GET /inventory/items`,
`GET /inventory/items/:id` e `GET /inventory/movements` (6 casos): cada um responde `200` (AC 11 -
lado positivo do `@Roles('production', 'sales')`; chamar só com `adminCookie` deixaria o decorator
sem prova, achado da verificação da Fase 9)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "production and sales get 200 on every read route"`

**C12** - Tabela sobre `GET /inventory/items?pageSize=101` e `GET /inventory/movements?pageSize=101`
(2 casos): cada um responde `400` (limite `Max(100)` do AD-020)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "rejects a pageSize above the AD-020 maximum"`

### S2 - Entrada com custo e custo médio ponderado · 5 files · 26 KB · ~7k

**C13** - `POST /inventory/items/:id/entries` com sessão de `admin`, `quantity: 100` e
`unitCostCents: 50` responde `201` com `balanceQuantity: 100`, e grava exatamente uma
`InventoryMovement` tipo `entrada` com `stockItemId` preenchido, `rollId: null`, `quantity: 100` e
`unitCostCents: 50` (AC 12, door 3, door 6)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "an entry writes an item-owned entrada movement and adds to the balance"`

**C14** - Tabela sobre `quantity: 0`, `quantity: -1` e `unitCostCents: -1` em
`POST /inventory/items/:id/entries` (3 casos): cada um responde `400`, e nem o saldo nem o ledger
mudam (AC 13)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "rejects a non-positive entry quantity or a negative unit cost"`

**C15** - Depois de duas entradas no mesmo item (`100` a `50` e `100` a `70`),
`GET /inventory/items/:id` responde `200` com `balanceQuantity: 200` e `avgCostCents: 60`
(AC 14 - caso de referência)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "two entries at different prices average to 60 weighted by quantity"`

**C16** - Partindo do estado de C15 (saldo `200`, média `60`), um `consumo` de `150` deixa
`GET /inventory/items/:id` com `balanceQuantity: 50` e `avgCostCents` ainda `60` (AC 15 - saída
nunca altera a média)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "a consumo leaves the average cost untouched"`

**C17** - Partindo do estado de C16 (saldo `50`, média `60`), uma entrada de `50` a `100` deixa
`balanceQuantity: 100` e `avgCostCents: 80` (AC 16 - média móvel sobre o saldo remanescente,
door 5)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "an entry after a consumo moves the average to 80"`

**C18** - Num item cujo saldo foi zerado por consumo, `GET /inventory/items/:id` responde
`avgCostCents: null` e `balanceQuantity: 0` (AC 17)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "reports a null average cost when the balance reaches zero"`

**C19** - `computeStockItemAverageCost`, tabela sobre 7 casos: a sequência de C15-C17
(`+100@50`, `+100@70`, `-150`, `+50@100` -> `{ balance: 100, avg: 80 }`), um `ajuste` positivo
(saldo sobe, média intacta), um `ajuste` negativo (saldo cai, média intacta), uma `perda` (média
intacta), uma entrada depois do saldo chegar a zero (média = custo da nova entrada), duas entradas
com `createdAt` idêntico em ordens invertidas (mesmo resultado), e ledger vazio (`avg: null`)
(AC 14-17, door 5)
Proof: `npm --prefix api run test -- src/modules/inventory/stock-item-average-cost.spec.ts -t "folds the ledger into a moving weighted average"`

**C20** - `POST /inventory/items/:id/entries` num item com `active: false` responde `400`, e nem o
saldo nem o ledger mudam (AC 18)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "rejects an entry on an inactive item"`

**C21** - Tabela sobre sessão de `production` e de `sales` em `POST /inventory/items/:id/entries`
(2 casos): cada um responde `403`, e nada é persistido (AC 19)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "production and sales get 403 on POST entries"`

### S3 - Consumo e perda · 4 files · 14 KB · ~4k

**C22** - Tabela sobre `type: "consumo"` e `type: "perda"` em
`POST /inventory/items/:id/movements` com `quantity` menor que o saldo (2 casos): cada um responde
`201`, decrementa `balanceQuantity` pela quantidade e grava a movimentação com `quantity` negativo
e `unitCostCents: null` (AC 20)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "consumo and perda movements decrement the item balance"`

**C23** - `POST /inventory/items/:id/movements` com `quantity` maior que `balanceQuantity`
responde `400`, e nem o saldo nem o ledger mudam (AC 21 - decidido pelo `CHECK` do banco sobre um
`UPDATE` relativo, sem pré-checagem em memória, AD-023)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "rejects a movement quantity greater than the item balance"`

**C24** - Num item com `balanceQuantity: 100`, duas chamadas simultâneas de
`POST /inventory/items/:id/movements` com `quantity: 70` cada resultam em exatamente uma resposta
`201` e uma `400`, e o saldo final no banco é `30`, nunca negativo (AC 22, door 1, AD-023)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "only one of two concurrent item movements that would exceed the balance succeeds"`

**C25** - Tabela sobre `type: "entrada"` e `type: "ajuste"` em
`POST /inventory/items/:id/movements` (2 casos): cada um responde `400`, e nada é persistido
(AC 23 - entrada nasce em `/entries` e ajuste em `/count`)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "rejects entrada and ajuste on the movements route"`

**C26** - `POST /inventory/items/:id/movements` com sessão de `sales` responde `403`, e nada é
persistido (AC 24)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "sales gets 403 on POST movements"`

### S4 - Contagem de inventário · 3 files · 8 KB · ~2k

**C27** - `PATCH /inventory/items/:id/count` com sessão de `production` e `countedQuantity: 45`
num item com `balanceQuantity: 50` responde `200` com `balanceQuantity: 45`, e grava uma
`InventoryMovement` tipo `ajuste` com `quantity: -5` (AC 25 - caso de referência)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "counting 45 against a balance of 50 writes an ajuste of -5"`

**C28** - `PATCH /inventory/items/:id/count` com `countedQuantity` igual ao saldo atual responde
`200` e grava uma `InventoryMovement` tipo `ajuste` com `quantity: 0` (AC 26)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "a count with no difference still records a zero ajuste"`

**C29** - `PATCH /inventory/items/:id/count` com `countedQuantity: -1` responde `400`, e nem o
saldo nem o ledger mudam (AC 27)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "rejects a negative counted quantity"`

**C30** - `PATCH /inventory/items/:id/count` com sessão de `sales` responde `403`, e nada é
persistido (AC 28)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "sales gets 403 on PATCH count"`

### S5 - Compatibilidade da peça com impressoras · 3 files · 12 KB · ~3k

**C31** - `POST /inventory/items` com `category: "peca_reposicao"` e `compatiblePrinterIds` com
dois ids de impressoras existentes responde `201` com os dois ids em `compatiblePrinterIds`, e a
tabela de junção tem exatamente 2 linhas para o item (AC 29, door 2)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "a spare part stores one compatibility link per printer"`

**C32** - Tabela sobre `POST /inventory/items` e `PATCH /inventory/items/:id` enviando
`compatiblePrinterIds` com `category: "insumo"` (2 casos): cada um responde `400`, e nenhum
vínculo é persistido (AC 30)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "rejects compatiblePrinterIds on a consumable"`

**C33** - Tabela sobre `POST /inventory/items` e `PATCH /inventory/items/:id` com
`compatiblePrinterIds` contendo um id válido e um inexistente (2 casos): cada um responde `400`, e
**nenhum** dos dois vínculos é persistido (AC 31)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "rejects the whole set when one printer id is unknown"`

**C34** - Numa peça com 2 vínculos, `PATCH /inventory/items/:id` com `compatiblePrinterIds`
contendo só o segundo id responde `200` com exatamente esse id, e a tabela de junção fica com 1
linha (AC 32 - substitui o conjunto, não soma, door 2)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "PATCH replaces the compatibility set instead of appending"`

**C35** - Numa peça com 2 vínculos, `PATCH /inventory/items/:id` mudando só `location` (sem
`compatiblePrinterIds`) responde `200` mantendo os 2 ids (AC 33)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "PATCH without compatiblePrinterIds keeps the existing links"`

### S6 - Ledger único, histórico unificado e auditoria · 5 files · 34 KB · ~9k

**C36** - Com um movimento de rolo e um movimento de item gravados, `GET /inventory/movements`
responde `200` com os dois na mesma lista ordenada por `createdAt` decrescente, no envelope
`{ items, total, page, pageSize }`, o de rolo com `rollId` preenchido e `stockItemId: null` e o de
item o inverso (AC 34, door 3)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "GET /inventory/movements lists roll and item movements in one ordered page"`

**C37** - Depois de entrada + consumo + contagem, `GET /inventory/items/:id` responde `200` com
`balanceQuantity`, `avgCostCents`, `compatiblePrinterIds` e `movements` ordenado por `createdAt`
crescente, cada um com `type`, `quantity`, `unitCostCents`, `reason` e `userId` (AC 35)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "GET /inventory/items/:id returns the item with its ordered movement history"`

**C38** - Tabela sobre os 4 tipos de movimento de item feitos por sessões diferentes (`entrada`
por `admin`, `consumo` e `perda` por `production`, `ajuste` por outra sessão de `production`):
cada movimento traz o `userId` de quem o fez (AC 36)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "records the acting user on every item movement type"`

**C39** - Tabela sobre `INSERT` direto em `inventory_movements` com `roll_id` **e**
`stock_item_id` preenchidos, e com os dois nulos (2 casos): o banco rejeita os dois pelo `CHECK`
de dono único (código `23514`) (AC 37, door 3)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "the database rejects a movement with two owners or none"`

**C40** - `GET /inventory/rolls/:id` num rolo com histórico responde `200` com cada item de
`movements` trazendo as chaves `quantity` e `unitCostCents`, e **sem** as chaves `quantityGrams` e
`unitCostCentsPerGram` (AC 38, door 4)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "the roll movement history uses the renamed quantity and unitCostCents keys"`

**C41** - Depois da renomeação, criar um rolo (`initialWeightGrams: 1000`,
`acquisitionCostCents: 12000`), pesar (`grossWeightGrams: 812`, tara `250`) e dar baixa de `100`
grava no ledger os mesmos valores de antes: `entrada` com `quantity: 1000` e `unitCostCents: 12`,
`ajuste` com `quantity: -438` e `consumo` com `quantity: -100` (AC 39, door 3, door 4)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "roll entrada, ajuste and consumo keep the same ledger values after the rename"`

**C42** - Tabela sobre `PATCH` e `DELETE` em `/inventory/items/:id/movements/:movementId` e em
`/inventory/rolls/:id/movements/:movementId` (4 casos): cada um responde `404`, porque a rota
nunca é declarada (AC 40, AD-022)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "no route exists to edit or delete a movement of either owner"`

**C43** - Com uma linha de movimento de rolo semeada, rodar `down()` e depois `up()` da migration
de `inventory_movements` por `QueryRunner` preserva o valor de quantidade da linha, deixa
`stock_item_id` nulo e o `CHECK` de dono único satisfeito, sem nenhum backfill (`Impact`: stored
data, door 3)
Proof: `npm --prefix api run test:e2e -- test/movements-migration.e2e-spec.ts -t "reverting and re-applying the movements migration preserves existing rows"`

### S7 - Web - telas de insumos, peças e movimentações · 8 files · 46 KB · ~12k

**C44** - A tela `/inventory/items` mostra "Carregando…" antes do `GET /inventory/items` (mock)
resolver (AC 41)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/items/page.test.tsx' -t "shows loading"`

**C45** - Com dois itens no mock (um insumo e uma peça), a tela `/inventory/items` mostra `name`,
`unitOfMeasure`, saldo e custo médio de cada um, e filtrar por categoria refaz a chamada com
`category=peca_reposicao` e deixa só a peça na tabela (AC 41)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/items/page.test.tsx' -t "lists items with balance and average cost and filters by category"`

**C46** - Com o `GET /inventory/items` (mock) rejeitando, a tela `/inventory/items` mostra a
mensagem de erro e um botão "Tentar novamente" que refaz a chamada, sem tabela parcial (AC 42)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/items/page.test.tsx' -t "shows the error and retries"`

**C47** - Com o `GET /inventory/items` (mock) resolvendo `{ items: [], total: 0 }`, a tela mostra o
estado vazio com a ação de cadastrar, visível só para `admin` (AC 43)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/items/page.test.tsx' -t "shows an empty state with the create action only for admin"`

**C48** - Tabela sobre `production` e `sales`: a tela `/inventory/items` esconde a ação de
cadastrar item e a de registrar entrada para os dois (AC 44)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/items/page.test.tsx' -t "production and sales do not see the create or entry actions"`

**C49** - Como `sales`, a tela `/inventory/items/:id` mostra o histórico mas esconde os formulários
de consumo, perda e contagem, e o botão de desativar (AC 45)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/items/[id]/page.test.tsx' -t "sales sees only the read-only item detail"`

**C50** - Como `admin`, a tela `/inventory/items/:id` de uma peça mostra saldo, custo médio, o nome
das impressoras compatíveis e o histórico com usuário e data de cada movimento (AC 46)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/items/[id]/page.test.tsx' -t "shows balance, average cost, compatible printers and the history"`

**C51** - Como `admin`, clicar em "Desativar" na tela `/inventory/items/:id` abre o
`ConfirmDialog`; cancelar não chama a API, e confirmar chama `PATCH /inventory/items/:id` (mock)
com `{ active: false }` (AC 49, AD-021)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/items/[id]/page.test.tsx' -t "confirms before deactivating the item"`

**C52** - A tela `/inventory/movements` mostra os movimentos de rolo e de item na mesma tabela
identificando o dono de cada linha, e tabela sobre os três estados: carregando, erro com
"Tentar novamente", e vazio com `{ items: [] }` (3 casos) (AC 47)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/movements/page.test.tsx' -t "lists roll and item movements with the owner, and covers loading, error and empty"`

**C53** - A tela `/inventory/:id` (detalhe do rolo) renderiza as colunas de quantidade e de custo
do histórico a partir das chaves `quantity` e `unitCostCents` do mock, com os valores visíveis na
tabela (AC 48, door 4)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/[id]/page.test.tsx' -t "renders the movement history from the renamed keys"`

### S8 - Regras cruzadas de rota: sessão, id e o corpo renomeado · 2 files · 8 KB · ~2k

**C54** - Tabela sobre as 8 rotas novas do módulo sem cookie de sessão (`POST`/`PATCH`/`GET
/inventory/items`, `GET /inventory/items/:id`, `POST .../entries`, `POST .../movements`,
`PATCH .../count`, `GET /inventory/movements`): cada uma responde `401` (AD-015 - o guard global já
está provado na Fase 3; aqui só confirma que as rotas novas nascem sob ele)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "every new inventory route is 401 without a session"`

**C55** - Tabela sobre um uuid de item inexistente em `PATCH /inventory/items/:id`,
`GET /inventory/items/:id`, `POST .../entries`, `POST .../movements` e `PATCH .../count`
(5 casos): cada um responde `404`
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "every item-scoped route is 404 for an unknown item id"`

**C56** - Tabela sobre um `:id` que não é uuid nas mesmas 5 rotas de C55 mais
`GET /inventory/rolls/:id` (6 casos): cada um responde `400` (`ParseUUIDPipe` com
`errorHttpStatusCode: 400`)
Proof: `npm --prefix api run test:e2e -- test/stock-items.e2e-spec.ts -t "every id-scoped route is 400 for a malformed uuid"`

**C57** - `POST /inventory/rolls/:id/movements` com `{ type, quantity }` responde `201`, e o mesmo
corpo com a chave antiga `quantityGrams` responde `400` (propriedade não declarada recusada pelo
`ValidationPipe`, AD-003) (door 4)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "the roll movement route takes quantity and rejects the old quantityGrams key"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /inventory/items` statuses (5) | 201 C1 · 400 C2, C5, C32, C33 · 401 C54 · 403 C8 · 409 C3 | - |
| `PATCH /inventory/items/:id` statuses (6) | 200 C6, C34, C35 · 400 C32, C33 · 401 C54 · 403 C8 · 404 C55 · 409 C3 | - |
| `GET /inventory/items` statuses (3) | 200 C9, C10, C11 · 400 C12 · 401 C54 | - |
| `GET /inventory/items/:id` statuses (4) | 200 C37, C11 · 400 C56 · 401 C54 · 404 C55 | - |
| `POST /inventory/items/:id/entries` statuses (5) | 201 C13 · 400 C14, C20 · 401 C54 · 403 C21 · 404 C55 | - |
| `POST /inventory/items/:id/movements` statuses (5) | 201 C22 · 400 C23, C25 · 401 C54 · 403 C26 · 404 C55 | - |
| `PATCH /inventory/items/:id/count` statuses (5) | 200 C27, C28 · 400 C29 · 401 C54 · 403 C30 · 404 C55 | - |
| `GET /inventory/movements` statuses (3) | 200 C36, C11 · 400 C12 · 401 C54 | - |
| `GET /inventory/rolls/:id` statuses (4) | 200 C40 · 400 C56 · 401 Fase 9 C23 · 404 Fase 9 C24 | - |
| `POST /inventory/rolls/:id/movements` statuses (6) | 201 C57 · 400 C57 · 401 Fase 9 C23 · 403 Fase 9 C25 · 404 Fase 9 C24 · 409 Fase 9 C26 | - |
| `stock_items_category_enum` (2) | `insumo` C1 · `peca_reposicao` C31 | - |
| tipo de movimento com dono item (4) | `entrada` C13 · `consumo` C22 · `perda` C22 · `ajuste` C27 | - |
| tipo de movimento com dono rolo, depois da renomeação (4) | `entrada` C41 · `ajuste` C41 · `consumo` C41 · `perda` Fase 9 C17 (valores não mudam, chaves cobertas por C40) | - |
| door 1: `stock_items` com saldo não negativo e `sku` único (4) | tabela criada e populada C1 · `CHECK` sequencial C23 · `CHECK` concorrente C24 · `sku` único C3 e nulos coexistindo C4 | - |
| door 2: compatibilidade peça×impressora (5) | cria com 2 C31 · insumo recusado C32 · impressora inexistente recusada C33 · `PATCH` substitui C34 · omissão preserva C35 | - |
| door 3: dono único do movimento (5) | dono item C13 · dono rolo C41 · `CHECK` com dois donos C39 · `CHECK` sem dono C39 · linhas existentes sobrevivem C43 | - |
| door 4: contrato renomeado (4) | resposta do rolo C40 · corpo da baixa de rolo C57 · lista unificada C36 · tela do rolo lê as chaves novas C53 | - |
| door 5: média móvel por replay do ledger (5) | duas entradas C15 · saída não altera C16 · entrada depois da saída C17 · saldo zero -> `null` C18 · fold isolado, 7 casos C19 | - |
| door 6: cadastro sem movimento (2) | criar não grava movimento C1 · entrada grava C13 | - |
| papel que cadastra e dá entrada (1) | `admin` C1, C13 | - |
| papéis barrados em cadastro e entrada (2) | `production` C8, C21 · `sales` C8, C21 | - |
| ações de produção sobre o item (3) | consumo C22 · perda C22 · contagem C27 | - |
| papel barrado nas ações operacionais (1) | `sales` C26, C30 | - |
| papéis que leem, lado positivo (3 rotas) | `GET /inventory/items` C11 · `GET /inventory/items/:id` C11 · `GET /inventory/movements` C11 | - |
| filtros de `GET /inventory/items` (3) | `category` C9 · `search` em `name` C10 · `search` em `sku` C10 | - |
| estados da tela `/inventory/items` (3) | carregando C44 · erro C46 · vazio C47 | - |
| estados da tela `/inventory/movements` (3) | carregando C52 · erro C52 · vazio C52 | - |
| UI por papel nas telas de item (2) | lista esconde criar/entrada para production e sales C48 · detalhe só leitura para sales C49 | - |
| ação destrutiva confirma antes (1 tela) | desativar item C51 | - |
| rota inexistente por design (3) | `DELETE` de item C7 · `PATCH` de movimento C42 · `DELETE` de movimento C42 | - |
| startup config: entidades novas visíveis (2 assemblies) | glob do `data-source.ts` do CLI, exercitado pelo `migration:run` do `global-setup.ts` que cria `stock_items` C1, C43 · `AppModule` com `autoLoadEntities`, exercitado por qualquer rota de item C1 | - |

- Claims que citam um código de status, rota ou formato de resposta: C1-C18, C20-C43, C54-C57 -
  cada uma tem uma prova que cruza a fronteira HTTP (e2e real contra o `AppModule`), exceto C19
  (função pura, que não cita rota) e C39/C43 (que afirmam sobre o banco e provam no banco)
- C19 é a única prova em nível de unidade cujo claim também aparece pela rota (C15-C18): o fold
  ganha os dois níveis por decidir a média em 7 casos que a rota não exercita todos
- Nenhuma claim afirma mais do que os casos que a prova exercita

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| `stock-item-average-cost.ts` - fold do ledger em média móvel (decide; forma nova - o resultado depende da ordem dos movimentos, diferente de `average-cost.ts`, que soma um snapshot e é indiferente à ordem) | unit test isolado da função pura **e** um e2e cobrindo a sequência pela rota | 7 casos da função (C19) e a sequência de referência pela API (C15-C18) |
| `CHECK` XOR de dono único em `inventory_movements` (decide; forma nova - primeira constraint com dois lados de violação; o `CHECK` da Fase 9 só tem um) | um teste por lado, direto no banco | dois donos (C39) e nenhum dono (C39) |
| migration que altera tabela com linhas (decide; forma nova - toda migration anterior só cria tabela) | um teste que roda `down()` e `up()` sobre linha semeada | valor preservado, `stock_item_id` nulo e `CHECK` satisfeito (C43) |
| renomeação de contrato consumido (decide; o risco está em código que esta fase não tocaria de outro jeito) | um e2e por rota afetada **e** um teste de tela | resposta do rolo (C40), corpo da baixa com a chave nova e a antiga (C57), valores do ledger inalterados (C41), tela do rolo (C53) |
| substituição de conjunto no `PATCH` (decide; forma nova - primeiro relacionamento N-N do sistema) | e2e para cada semântica | substitui (C34), omissão preserva (C35), conjunto inteiro rejeitado num id inválido (C33) |
| `InventoryController` - `RolesGuard` nas 8 rotas novas (decide, alcançado pela rota, mesma forma das Fases 4-9) | um e2e tabela-driven por conjunto de rotas × papel, os **dois** lados | cadastro/entrada barrados (C8, C21), operação barrada (C26, C30), leitura liberada - lado positivo (C11) |
| DTOs de item e de movimento (instrumentação com decisão de validação; mesma forma dos DTOs das Fases 5-9) | e2e do lado aceito e de cada lado recusado | C2, C5, C12, C14, C25, C29 |
| mapper `toStockItemResponse` / `toMovementResponse` (instrumentação - copia campo a campo, sem condicional que decida o resultado) | nenhuma própria | coberto pelas provas dos consumidores (C1, C36, C37) |

Evidence:

- `stock-item-average-cost.ts` (novo): um fold sequencial com 2 ramos por movimento (`entrada`
  recalcula a média, os outros 3 tipos só mexem no saldo) -> decide, e a ordem importa, ao
  contrário de `average-cost.ts` (Fase 9), que é uma soma ponderada sobre um snapshot -> ganha spec
  Vitest isolado além da cobertura e2e
- migration de `inventory_movements`: 4 operações de schema (`DROP NOT NULL`, `ADD COLUMN`,
  `ADD CONSTRAINT`, 2 `RENAME COLUMN`) sobre uma tabela com linhas -> nenhum análogo no repositório
  (as 8 migrations existentes só criam tabela) -> ganha arquivo de teste próprio rodando `down()`
  e `up()`
- `inventory.service.ts` (existente, cresce): `addItemMovement` repete o padrão de `addMovement`
  (`UPDATE` relativo + `isCheckViolation`), já provado sequencial e concorrente na Fase 9 -> o
  análogo mais próximo do repositório é ele mesmo, e está provado neste nível, então a peça nova
  herda o mesmo par de provas (C23, C24) em vez de um nível mais barato
- `inventory.controller.ts` (existente, cresce): 8 rotas novas, cada uma com um `@Roles()` (ou a
  ausência dele, que significa só admin por AD-018) -> decide, alcançado pela rota -> tabela e2e
  por papel, com o lado positivo explícito (a verificação da Fase 9 achou justamente o lado
  positivo faltando)
- mappers de resposta: copiam campo a campo, sem condicional, exceto `avgCostCents` que vem do
  fold já provado em C19 -> instrumentação

Cost: 1 arquivo e2e novo (`stock-items.e2e-spec.ts`) cobrindo 8 rotas × papéis × estados do item,
1 arquivo e2e novo só para a migration, 1 spec Vitest novo para o fold, 3 arquivos de teste de
página novos no web, e asserções novas em `inventory.e2e-spec.ts` e no teste da tela do rolo.
Sem C19, um mutante que recalculasse a média também na saída passaria por C15 (duas entradas, sem
saída no meio) e só apareceria como custo errado em orçamento meses depois. Sem C57 e C53, a
renomeação do door 4 quebraria a baixa de rolo em produção com a suíte verde, porque nenhum teste
da Fase 9 assert a chave do corpo. Sem C43, a migration só seria exercitada contra um banco vazio,
que é o único cenário em que ela não pode falhar.

Uma pergunta, e só ela: estas linhas devem entrar nas diretrizes do repositório (`AGENTS.md`)? Sem
resposta, construo sob elas e não mexo no arquivo.

## Swept

- validation: C2, C5, C12, C14, C23, C25, C29, C32, C33 - categoria fora do enum, nome e unidade
  vazios, fornecedor e impressora inexistentes, `pageSize` acima do máximo, quantidade não
  positiva, custo negativo, tipo de movimento na rota errada, contagem negativa
- failure and partial failure: C33 - um id de impressora inválido no meio do conjunto não deixa
  vínculo parcial persistido; C13 - o movimento e o saldo são escritos na mesma transação, então a
  falha de um reverte o outro (mesmo mecanismo provado em `createRoll`, Fase 9 C5)
- idempotency, retry, duplicates: C3 - `sku` duplicado é recusado com `409`; C28 - uma contagem
  repetida com o mesmo valor grava `ajuste` de `0` e deixa o saldo igual, então repetir é inócuo.
  `POST .../entries` e `POST .../movements` **não** são idempotentes por design (cada chamada é um
  lançamento novo do ledger), mesmo padrão da Fase 9
- authorization and rate limits: C8, C11, C21, C26, C30, C54 - os dois lados da matriz em toda rota
  nova. Rate limit: n/a - nenhum módulo do sistema aplica rate limit (mesma decisão das Fases 4-9)
- concurrency and ordering: C24 - duas baixas simultâneas do mesmo item, só uma reduz o saldo,
  garantido pelo `CHECK` do banco (AD-023); C19 - duas entradas com `createdAt` idêntico em ordens
  invertidas dão o mesmo resultado, então o fold não depende de desempate; C36, C37 - ordenação do
  histórico afirmada explicitamente (decrescente na lista unificada, crescente no detalhe)
- data lifecycle: C43 - a migration roda sobre linhas que já existem, sem backfill; o ledger em si é
  permanente por design (auditoria, AD-022) e a desativação do item (C6) preserva a linha e o
  histórico em vez de apagar
- external-dependency failure: n/a - `inventory` não chama nenhum serviço externo
- state transitions: C6 - ativo -> inativo, e o efeito da transição na entrada (C20 barra, C22
  segue permitindo baixa); C18 - saldo positivo -> zero muda `avgCostCents` para `null`
- observability: n/a - mesma decisão das Fases 4-9: nenhum critério desta fase exige uma linha de
  log específica; a auditoria funcional (C38) cobre a rastreabilidade pedida pelo CONTEXT

## Out of scope

`plan.md` já carrega `## Out of scope`; nada novo surgiu na derivação. A derivação achou uma
lacuna de outro tipo, e ela voltou para o `plan.md` em vez de virar um check solto: a linha
`Observable` da ação destrutiva da tela de item apontava para o AC 6, que é um critério de API -
nenhum critério exigia a confirmação na tela. O AC 49 foi acrescentado ao `plan.md` e é o que
C51 prova.

## Handoff

Novos (API): `entities/stock-item.entity.ts`, `entities/stock-item-printer.entity.ts`,
`stock-item-average-cost.ts` + `stock-item-average-cost.spec.ts`, `dto/create-stock-item.dto.ts`,
`dto/update-stock-item.dto.ts`, `dto/list-stock-items.dto.ts`, `dto/create-entry.dto.ts`,
`dto/create-item-movement.dto.ts`, `dto/count-item.dto.ts`, `dto/list-movements.dto.ts`, 2
migrations (`CreateStockItems`, `AlterInventoryMovementsOwner`), `test/stock-items.e2e-spec.ts`,
`test/stock-items-helper.ts`, `test/movements-migration.e2e-spec.ts` ≈ 37 KB.
Existente tocado (API): `inventory.service.ts` (11 KB), `test/inventory.e2e-spec.ts` (23 KB),
`inventory.types.ts` (3 KB), `inventory.controller.ts` (3 KB), `inventory.service.spec.ts` (3 KB),
`test/inventory-helper.ts` (2,5 KB), `entities/inventory-movement.entity.ts` (1,5 KB),
`dto/create-movement.dto.ts` (0,6 KB), `inventory.module.ts` (0,5 KB), `ROADMAP.md` (linha
`inventory` da matriz de permissões e o status da Fase 10) ≈ 48 KB.
Web novos: `lib/stock-items.ts`, `app/(app)/inventory/items/page.tsx` + teste,
`app/(app)/inventory/items/[id]/page.tsx` + teste, `app/(app)/inventory/movements/page.tsx` +
teste ≈ 40 KB. Web existente tocado: `lib/inventory.ts` (1,3 KB),
`app/(app)/inventory/[id]/page.tsx` (11,5 KB) + teste (4,7 KB), `app-shell.tsx` (3,3 KB) + teste
≈ 22 KB.

- Total ≈ 147 KB ≈ 37k tokens (`wc -c` sobre os arquivos tocados ÷ 4). Abaixo do orçamento padrão
  de 150k: **um builder só, sem pergunta de mecanismo**
- A fatia mais pesada é S6 (34 KB), que é onde a renomeação do door 4 atravessa API e web ao mesmo
  tempo; nenhuma fatia sozinha chega perto do orçamento, então não há corte a propor
- Ordem de construção: a migration e a renomeação (S6) antes de tudo, porque S1-S5 gravam no ledger
  já renomeado; as telas (S7) depois da API inteira verde
- Validação final com o Playwright MCP (`AGENTS.md`): como `admin`, abrir `/inventory/items`,
  cadastrar um insumo e uma peça (com duas impressoras compatíveis), dar duas entradas a preços
  diferentes e ver o custo médio virar 60, consumir e ver a média ficar parada, desativar com
  confirmação; como `production`, consumir, lançar perda e fazer contagem, e confirmar que
  cadastrar e dar entrada estão escondidos; como `sales`, confirmar leitura-only na lista e no
  detalhe, e o estado vazio filtrando por uma categoria sem itens; abrir `/inventory/movements` e
  ver movimento de rolo e de item na mesma tabela; reabrir o detalhe de um rolo e confirmar que o
  histórico não regrediu com a renomeação

- **Boundary:** C1-C57 fechados em `375e3e8` (artefatos), `4b07126` (API) e `53ad563` (web).
  Um builder só, como a aritmética previu; nenhuma fatia precisou de corte
- **Settled mid-build:** nada - nenhuma pergunta nova apareceu. A precedência de segmento
  estático sobre dinâmico no App Router (assunção do plano) foi confirmada no `next build`, que
  lista `/inventory/items` e `/inventory/movements` como rotas estáticas ao lado do
  `/inventory/[id]` dinâmico, e confirmada em runtime abrindo `/inventory/items` no navegador
- **Abandoned:** o `migration:generate` do TypeORM, como fonte da migration do door 3: ele emite
  `DROP COLUMN` + `ADD COLUMN` no lugar de `RENAME COLUMN` (perderia o valor das linhas
  existentes) e arrasta ruído não relacionado (um `DROP CONSTRAINT` da FK de `fixed_cost_items` e
  a recriação de dois enums com os mesmos valores). A saída dele foi usada como ponto de partida e
  as duas migrations foram escritas à mão com o shape literal do `Landing`
