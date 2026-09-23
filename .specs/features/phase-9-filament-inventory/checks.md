# Fase 9 — Estoque de filamento por rolo · checks

Profile: standard
Plan: `.specs/features/phase-9-filament-inventory/plan.md`

## Intent

33 checks em 8 fatias · 6 one-way doors · nenhuma questão aberta

O `AGENTS.md` não declara perfil (`light` seria o padrão do `tlc-spec-lean`). Uso `standard`,
como a Fase 8: esta fase tem três formas genuinamente novas, sem análogo no repositório. Primeiro,
a fórmula de custo médio ponderado (door 4 do plano) é o primeiro cálculo de agregação sobre
estado mutável do sistema — diferente do `pricing` (Fase 1, puro e sem acesso ao banco) e diferente
de qualquer `service.list()` existente (que só pagina, nunca agrega). Segundo, a invariante de
saldo nunca-negativo sob concorrência (door 3) é a primeira vez que o sistema depende de um
`CHECK` do banco como último backstop contra uma corrida — todo módulo anterior só tem unicidade
(`document`, `email`), que o Postgres já resolve sozinho sem `CHECK` customizado. Terceiro, `status`
derivado em runtime a partir de três campos (`openedAt`/`balanceGrams`/`discardedAt`, door 6) é a
primeira vez que uma resposta da API expõe um campo que não existe como coluna. Um `light` não
pegaria um mutante que trocasse o operador da fórmula de média, nem uma corrida perdida no `CHECK`,
nem um `status` calculado errado num dos quatro valores — um `standard` tabula os três
explicitamente e recomputa a junção de `Coverage` a partir das fontes, não do resumo do autor.

Os valores esperados vêm do `plan.md` (`## Criteria` e `## Landing`) e ficam escritos
**literalmente** nas asserções, nunca derivados chamando o próprio código em teste.

Os e2e (`npm --prefix api run test:e2e`) montam o `AppModule` contra o `forge_test`, com o `db` no
ar e as migrations aplicadas antes da suíte (padrão da Fase 0), num arquivo novo
`inventory.e2e-spec.ts` com seu próprio `inventory-helper.ts` (login por papel, seed de material/
fornecedor/rolo), espelhando `materials.e2e-spec.ts`/`materials-helper.ts` (Fase 6). A fórmula de
custo médio (`average-cost.ts`, pura, sem acesso ao banco) ganha um spec Vitest isolado, no mesmo
nível de `pricing.service.spec.ts` e de `is-valid-document.spec.ts` (Fase 8). A transação de
`createRoll` ganha um teste unitário do `InventoryService` com o repositório de movimentos mockado
para falhar, no mesmo nível de `auth.service.spec.ts` (único precedente de service testado com
repositório mockado). No web, Vitest + Testing Library com o `fetch` substituído, como em
`materials/page.test.tsx`; nenhum componente de `crud/` é retestado aqui.

## Checks

### S1 - Entrada manual de rolo (admin) · 6 files · 24 KB · ~6k

**C1** - `POST /inventory/rolls` com sessão de `admin` e só os campos obrigatórios
(`materialId` de um material ativo existente, `initialWeightGrams: 1000`, `spoolTareGrams: 250`,
`acquisitionCostCents: 12000`) responde `201` com `balanceGrams: 1000`, `status: "fechado"`, e o
rolo tem exatamente uma `InventoryMovement` tipo `entrada` com `quantityGrams: 1000` e
`unitCostCentsPerGram: 12` (AC 1)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "creates a roll with the first entrada movement and the derived closed status"`

**C2** - Tabela sobre `materialId` inexistente e `materialId` de um material desativado em
`POST /inventory/rolls` (2 casos): cada um responde `400`, e nenhum rolo é persistido (AC 2)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "rejects an unknown or inactive materialId"`

**C3** - `POST /inventory/rolls` com `supplierId` inexistente responde `400`, e nenhum rolo é
persistido (AC 3)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "rejects an unknown supplierId"`

**C4** - Tabela sobre `initialWeightGrams: 0`, `spoolTareGrams: -1` e `acquisitionCostCents: -1`
em `POST /inventory/rolls` (3 casos): cada um responde `400`, e nenhum rolo é persistido (AC 4)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "rejects a non-positive initial weight, a negative tare or a negative cost"`

**C5** - `InventoryService.createRoll`, com o repositório de `InventoryMovement` mockado para
rejeitar o `save`, propaga o erro e nunca chama `save` do repositório de `FilamentRoll` fora da
transação revertida (AC 5)
Proof: `npm --prefix api run test -- src/modules/inventory/inventory.service.spec.ts -t "rolls back the roll when the entrada movement fails to save"`

**C6** - Tabela sobre sessão de `production` e de `sales`: `POST /inventory/rolls` responde `403`
para os dois, e nada é persistido (AC 6)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "production and sales get 403 on POST /inventory/rolls"`

### S2 - Saldo e custo médio por material · 5 files · 14 KB · ~4k

**C7** - Com rolos de dois materiais semeados, `GET /inventory/rolls?materialId=<id>` responde
`200` só com os rolos daquele material, no envelope `{ items, total, page, pageSize }` (AD-020)
(AC 7)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "GET /inventory/rolls filters by materialId with the AD-020 pagination envelope"`

**C8** - Com dois rolos do mesmo material entrados com `acquisitionCostCents`/`initialWeightGrams`
diferentes (1000 g a R$ 100,00 e 1000 g a R$ 120,00), `GET /inventory/materials-summary` responde
`200` com o item daquele material trazendo `totalBalanceGrams: 2000` e `avgCostCentsPerGram: 11`
(AC 8, AC 9 - caso de referência do ROADMAP)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "materials-summary averages two rolls of the same material weighted by balance"`

**C9** - `computeAverageCostCentsPerGram`, tabela sobre: dois rolos de custo diferente (mesmo
caso de C8, 12 e 10 -> 11), um único rolo, um rolo com `balanceGrams: 0` excluído do cálculo, um
rolo com `discardedAt` setado excluído do cálculo, e nenhum rolo (`[]` -> `null`) (5 casos) (AC 9)
Proof: `npm --prefix api run test -- src/modules/inventory/average-cost.spec.ts -t "weights by remaining balance and excludes empty or discarded rolls"`

**C10** - Com um material sem nenhum rolo com saldo (todos descartados ou com `balanceGrams: 0`),
o item correspondente em `GET /inventory/materials-summary` traz `avgCostCentsPerGram: null` e
`totalBalanceGrams: 0` (AC 10)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "materials-summary reports null average cost when nothing is in stock"`

**C11** - Depois de criar rolos e movimentações para um material, `GET /materials` continua
respondendo só os campos de `MaterialResponse` já existentes (Fase 6), sem nenhum campo de saldo
ou custo médio (door 5 do plano)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "does not add stock or cost fields to GET /materials"`

### S3 - Pesagem · 4 files · 8 KB · ~2k

**C12** - `PATCH /inventory/rolls/:id/weigh` com sessão de `production` (ou `admin`) e
`grossWeightGrams: 812` num rolo com `spoolTareGrams: 250` e saldo anterior de 600 g responde
`200` com `balanceGrams: 562`, e uma `InventoryMovement` tipo `ajuste` com
`quantityGrams: -38` é gravada (AC 11, AC 12 - caso de referência literal do ROADMAP)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "weighing 812g gross with a 250g tare leaves the balance at 562g with an ajuste movement"`

**C13** - `PATCH /inventory/rolls/:id/weigh` com `grossWeightGrams` menor que `spoolTareGrams` do
rolo responde `400`, e nenhuma movimentação é gravada nem o saldo muda (AC 13)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "rejects a gross weight below the roll's tare"`

### S4 - Baixa de consumo, perda e descarte · 5 files · 12 KB · ~3k

**C14** - Tabela sobre `type: "consumo"` e `type: "perda"` em `POST /inventory/rolls/:id/movements`
com `quantityGrams` menor que o saldo (2 casos): cada um responde `201`, decrementa `balanceGrams`
pela quantidade e grava a movimentação com `quantityGrams` negativo (AC 16)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "consumo and perda movements decrement the balance"`

**C15** - `POST /inventory/rolls/:id/movements` com `quantityGrams` maior que `balanceGrams` do
rolo responde `400`, e nem a movimentação nem o saldo mudam (AC 17)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "rejects a movement quantity greater than the roll's balance"`

**C16** - Num rolo com `balanceGrams: 100`, disparar duas chamadas simultâneas de
`POST /inventory/rolls/:id/movements` com `quantityGrams: 70` cada (juntas excederiam o saldo)
resulta em exatamente uma resposta `201` e uma `400`, e o saldo final no banco é `30`, nunca
negativo (AC 18, door 3)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "only one of two concurrent movements that would exceed the balance succeeds"`

**C17** - `PATCH /inventory/rolls/:id/discard` num rolo com `balanceGrams: 200` responde `200`
com `balanceGrams: 0` e `discardedAt` preenchido, e uma `InventoryMovement` tipo `perda` com
`quantityGrams: -200` é gravada (AC 19)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "discarding a roll writes a perda movement for the whole remaining balance"`

### S5 - Abertura e secagem · 3 files · 6 KB · ~2k

**C18** - `PATCH /inventory/rolls/:id/open` num rolo fechado responde `200` com `openedAt`
preenchido e `status: "aberto"`; uma segunda chamada responde `200` com o mesmo `openedAt` da
primeira, sem alterá-lo (AC 21, AC 22)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "opening a roll sets openedAt once and is idempotent on a second call"`

**C19** - Duas chamadas de `PATCH /inventory/rolls/:id/dry` em sequência respondem `200` cada
uma com um `lastDriedAt` diferente (o segundo mais recente que o primeiro) (AC 23)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "drying a roll always advances lastDriedAt"`

### S6 - Auditoria e histórico · 3 files · 8 KB · ~2k

**C20** - Depois de uma entrada, uma pesagem e uma baixa de consumo feitas por sessões diferentes,
cada uma das três `InventoryMovement` do rolo traz o `userId` de quem a fez (AC 24)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "records the acting user on every movement type"`

**C21** - `GET /inventory/rolls/:id` depois de entrada + pesagem + baixa responde `200` com
`movements` ordenado por `createdAt` crescente, cada item com `type`, `quantityGrams`,
`unitCostCentsPerGram`, `reason` e `userId` (AC 25)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "GET /inventory/rolls/:id returns the movement history ordered by createdAt"`

**C22** - Nenhuma rota SHALL existir para editar ou apagar uma `InventoryMovement`: tabela sobre
`PATCH /inventory/rolls/:id/movements/:movementId` e
`DELETE /inventory/rolls/:id/movements/:movementId` (2 casos), cada um responde `404` (rota nunca
declarada no controller) (AC 26)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "no route exists to edit or delete an inventory movement"`

### S7 - Regras cruzadas de rota: sessão, papel e rolo inexistente · 1 file · 6 KB · ~2k

**C23** - Tabela sobre as 9 rotas do módulo sem cookie de sessão: cada uma responde `401`
(AD-015, guard global já provado na Fase 3 - aqui só confirma que o módulo está registrado sob o
guard)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "every inventory route is 401 without a session"`

**C24** - Tabela sobre um uuid de rolo inexistente em `GET /inventory/rolls/:id`,
`PATCH .../weigh`, `POST .../movements`, `PATCH .../discard`, `PATCH .../open` e
`PATCH .../dry` (6 casos): cada um responde `404`
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "every roll-scoped route is 404 for an unknown roll id"`

**C25** - Tabela sobre sessão de `sales` em `PATCH .../weigh`, `POST .../movements`,
`PATCH .../discard`, `PATCH .../open` e `PATCH .../dry` (5 casos): cada um responde `403`, e
nada muda no rolo (AC 15 e a matriz de papéis do plano - vendas só lê)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "sales gets 403 on every operational roll route"`

**C26** - Num rolo já descartado, tabela sobre `PATCH .../weigh`, `POST .../movements` e
`PATCH .../discard` (3 casos): cada um responde `409`, e o rolo não muda (AC 14, AC 20)
Proof: `npm --prefix api run test:e2e -- test/inventory.e2e-spec.ts -t "every balance-changing route is 409 on an already discarded roll"`

### S8 - Web - telas de estoque · 6 files · 30 KB · ~9k

**C27** - A tela `/inventory` mostra "Carregando…" antes do `GET /inventory/materials-summary`
(mock) resolver (AC 27)
Proof: `npm --prefix web run test -- src/app/(app)/inventory/page.test.tsx -t "shows loading"`

**C28** - Com o `GET /inventory/materials-summary` (mock) rejeitando, a tela `/inventory` mostra a
mensagem de erro e um botão "Tentar novamente" que refaz a chamada, sem lista parcial (AC 28)
Proof: `npm --prefix web run test -- src/app/(app)/inventory/page.test.tsx -t "shows the error and retries"`

**C29** - Com o `GET /inventory/materials-summary` (mock) resolvendo `{ items: [] }`, a tela
`/inventory` mostra um estado vazio com a ação de cadastrar rolo, visível só para `admin` (AC 29)
Proof: `npm --prefix web run test -- src/app/(app)/inventory/page.test.tsx -t "shows an empty state with the create action only for admin"`

**C30** - Tabela sobre `production` e `sales`: a tela `/inventory` esconde a ação de entrada
manual de rolo para os dois (AC 30)
Proof: `npm --prefix web run test -- src/app/(app)/inventory/page.test.tsx -t "production and sales do not see the create roll action"`

**C31** - Como `sales`, a tela de detalhe do rolo (`/inventory/:id`) mostra o histórico de
movimentações mas esconde os formulários de pesagem, baixa, abertura, secagem e o botão de
descarte (AC 31)
Proof: `npm --prefix web run test -- src/app/(app)/inventory/[id]/page.test.tsx -t "sales sees only the read-only history"`

**C32** - Como `production`, clicar em "Descartar" na tela de detalhe do rolo abre o
`ConfirmDialog`; cancelar não chama a API, e confirmar chama `PATCH /inventory/rolls/:id/discard`
(mock) e atualiza a tela (AC 32)
Proof: `npm --prefix web run test -- src/app/(app)/inventory/[id]/page.test.tsx -t "confirms before discarding"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /inventory/rolls` statuses (4) | 201 C1 · 400 C2, C3, C4 · 401 C23 · 403 C6 | - |
| `GET /inventory/rolls` statuses (2) | 200 C7 · 401 C23 | - |
| `GET /inventory/rolls/:id` statuses (3) | 200 C21 · 401 C23 · 404 C24 | - |
| `PATCH /inventory/rolls/:id/weigh` statuses (6) | 200 C12, C18 · 400 C13 · 401 C23 · 403 C25 · 404 C24 · 409 C26 | - |
| `POST /inventory/rolls/:id/movements` statuses (6) | 201 C14 · 400 C15, C16 · 401 C23 · 403 C25 · 404 C24 · 409 C26 | - |
| `PATCH /inventory/rolls/:id/discard` statuses (5) | 200 C17 · 401 C23 · 403 C25 · 404 C24 · 409 C26 | - |
| `PATCH /inventory/rolls/:id/open` statuses (4) | 200 C18 · 401 C23 · 403 C25 · 404 C24 | - |
| `PATCH /inventory/rolls/:id/dry` statuses (4) | 200 C19 · 401 C23 · 403 C25 · 404 C24 | - |
| `GET /inventory/materials-summary` statuses (2) | 200 C8, C10 · 401 C23 | - |
| `InventoryMovement.type` (4) | `entrada` C1 · `consumo` C14 · `perda` C14, C17 · `ajuste` C12 | - |
| door 1: novas tabelas `filament_rolls`/`inventory_movements` (1) | criadas e populadas por C1 | - |
| door 2: `balanceGrams`+movimento na mesma transação (2) | caminho feliz C1 · reversão na falha C5 | - |
| door 3: saldo nunca negativo (2) | validação da API C15 · backstop do `CHECK` sob concorrência C16 | - |
| door 4: custo médio ponderado pelo saldo atual (3) | fórmula isolada C9 · caso de referência via API C8 · saldo zero -> `null` C10 | - |
| door 5: `Material` sem coluna nova (1) | `GET /materials` inalterado C11 | - |
| door 6a: `status` derivado, 4 valores (4) | `fechado` C1 · `aberto` C18 · `vazio` C16 (saldo zerado por baixa) · `descartado` C17 | - |
| door 6b: nenhuma rota edita/apaga `InventoryMovement` (1) | C22 | - |
| papéis que criam rolo (1) | `admin` C1 | - |
| papéis barrados em criar rolo (2) | `production` C6 · `sales` C6 | - |
| papéis que operam o rolo, produção (5) | pesagem C12 · baixa C14 · descarte C17 · abertura C18 · secagem C19 | - |
| papel barrado nas ações operacionais (1) | `sales` C25 (5 rotas) | - |
| rolo já descartado bloqueia ação (3 rotas) | pesagem C26 · baixa C26 · descarte C26 | - |
| estados de tela `/inventory` (3) | carregando C27 · erro C28 · vazio C29 | - |
| UI por papel na tela `/inventory` (1) | `production`/`sales` sem ação de criar C30 | - |
| UI por papel no detalhe do rolo (1) | `sales` só leitura C31 | - |
| ação destrutiva confirma antes (1 tela) | descarte C32 | - |

- Claims que citam um código de status, rota ou formato de resposta: C1-C26 - cada uma tem uma
  prova que cruza a fronteira HTTP (e2e real contra o `AppModule`)
- Nenhuma claim afirma mais do que os casos que a prova exercita

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| `average-cost.ts` - média ponderada pelo saldo atual (decide; forma nova - primeira agregação sobre estado mutável do sistema, sem analogê no `pricing` puro nem em nenhum `service.list()`) | unit test isolado da função pura, e um e2e cobrindo a fórmula pelo endpoint | 5 casos da função (C9) e o caso de referência pela API (C8, C10) |
| `InventoryService.createRoll` - rolo + primeira movimentação na mesma transação (decide; forma nova - primeiro `create` do sistema com um efeito colateral em segunda tabela dentro da mesma transação) | e2e do caminho feliz e um teste unitário da reversão com o repositório mockado | caminho feliz (C1) e reversão na falha (C5) |
| saldo nunca negativo sob concorrência, `CHECK` do banco (decide; forma nova - primeira invariante do sistema que depende de uma constraint de banco como backstop, e não só de índice único) | e2e de validação isolada e e2e com duas chamadas simultâneas reais | validação isolada (C15) e a corrida (C16) |
| `status` derivado de `openedAt`/`balanceGrams`/`discardedAt` (decide; forma nova - primeiro campo de resposta que não é uma coluna) | os 4 valores cada um exercitado por um check que já prova a transição correspondente | `fechado` (C1), `aberto` (C18), `vazio` (C16), `descartado` (C17) - sem check dedicado extra, reaproveita a asserção do campo nesses quatro |
| `InventoryController` - `RolesGuard` aplicado nas 9 rotas (decide, alcançado pela rota, mesma forma das Fases 4-8) | um e2e tabela-driven por conjunto de rotas × papel | criar (C6), ações operacionais (C25) |

Evidence:

- `average-cost.ts` (novo): pondera por saldo, exclui saldo zero e `discardedAt` -> forma nova, sem
  analogê direto (`pricing` é puro mas nunca agrega uma lista mutável; nenhum `service.ts` atual
  calcula uma média) -> ganha spec Vitest isolado além da cobertura e2e
- `inventory.service.ts` (novo), `createRoll`: grava `FilamentRoll` e `InventoryMovement` na mesma
  `manager.transaction` -> primeira vez que um create do sistema tem efeito colateral em segunda
  tabela dentro da mesma transação (`materials`/`printers`/`customers`/`suppliers` só gravam a
  própria linha) -> ganha teste unitário com o repositório de movimentos mockado para falhar
- migration `filament_rolls`: `CHECK (balance_grams >= 0)` -> primeira constraint de banco usada
  como backstop de concorrência no sistema (`document` único em `customers`/`suppliers` já é
  resolvido pelo índice único do Postgres sozinho, sem `CHECK` customizado) -> ganha e2e com duas
  chamadas simultâneas reais, não só a validação de aplicação
- `inventory.types.ts` (novo), `toRollResponse`: deriva `status` de três campos -> primeiro campo
  de resposta da API que não é uma coluna própria -> sem spec dedicado extra; os quatro valores já
  aparecem como asserção de campo nos checks que provam cada transição

Cost: 1 arquivo e2e novo (`inventory.e2e-spec.ts`) cobrindo 9 rotas × papéis × estados do rolo, 1
spec Vitest novo para `average-cost.ts`, 1 spec Vitest novo para `inventory.service.ts` (transação),
2 arquivos de teste de página novos no web (lista e detalhe). Sem C9, um erro de sinal na fórmula
(por exemplo, ponderar pelo peso inicial em vez do saldo atual) passaria despercebido enquanto os
saldos ainda são iguais entre si e só apareceria meses depois, com o estoque desbalanceado. Sem
C16, duas baixas simultâneas poderiam juntas deixar o saldo negativo sem nenhum teste pegando isso
- é o risco novo desta fase (a Fase 8 não tinha nenhuma invariante numérica sob concorrência).

## Swept

- validation: C2, C3, C4, C13, C15 - `materialId`/`supplierId` inexistentes, pesos e custos não
  positivos, pesagem abaixo da tara, movimentação acima do saldo
- failure modes: C5 - a movimentação falha depois do rolo já estar montado em memória e a
  transação reverte os dois
- idempotency, retry, duplicates: C18 - `PATCH .../open` é idempotente numa segunda chamada;
  `POST /inventory/rolls` e `POST .../movements` não são idempotentes por design (cada chamada cria
  um registro novo, mesmo padrão de `materials`/`customers`)
- authorization: C6, C23, C25
- concurrency and ordering: C16 - duas baixas simultâneas, só uma reduz o saldo, garantido pelo
  `CHECK` do banco (door 3); C21 - histórico ordenado por `createdAt` mesmo com movimentações
  gravadas fora de ordem de chegada
- data lifecycle: n/a - o ledger é permanente por design (auditoria); o único ciclo de vida do
  rolo é o `status` derivado, coberto em state transitions
- external-dependency failure: n/a - `inventory` não chama nenhum serviço externo
- state transitions: C1 (nasce fechado), C16 (esvazia), C18 (abre), C17 (descarta, terminal), C26
  (descartado bloqueia qualquer nova ação)
- observability: n/a - mesma decisão das Fases 4-8: nenhum AC desta fase exige uma linha de log
  específica; a auditoria funcional (C20) cobre a rastreabilidade pedida

## Out of scope

`plan.md` já carrega `## Out of scope`; nada adicional surgiu na derivação dos checks.

## Handoff

Novos (API): `inventory.module.ts`, `inventory.controller.ts`, `inventory.service.ts`,
`inventory.types.ts`, `average-cost.ts` + `average-cost.spec.ts`,
`entities/filament-roll.entity.ts`, `entities/inventory-movement.entity.ts`,
`dto/create-roll.dto.ts`, `dto/list-rolls.dto.ts`, `dto/weigh-roll.dto.ts`,
`dto/create-movement.dto.ts`; `inventory.service.spec.ts`; 2 migrations (`CreateFilamentRolls.ts`,
`CreateInventoryMovements.ts`); `test/inventory.e2e-spec.ts`, `test/inventory-helper.ts` ≈ 72 KB.
Existente tocado: `app.module.ts` (registra o módulo), `roles.guard.spec.ts` (adiciona o
controller à whitelist), `ROADMAP.md` (linha `inventory` na "Matriz de permissões", marca a Fase 9
como concluída) ≈ 2 KB. Web novos: `lib/inventory.ts`, `app/(app)/inventory/page.tsx` + teste,
`app/(app)/inventory/[id]/page.tsx` + teste ≈ 53 KB. Web existente tocado: `app-shell.tsx` + teste
(item de menu "Estoque") ≈ 1 KB.

- Total ≈ 128 KB ≈ 32k tokens. Abaixo do orçamento padrão de 150k: um builder só, sem pergunta
- Validação final com o Playwright MCP (`AGENTS.md`): como `admin`, abrir `/inventory`, cadastrar
  um rolo, ver o resumo por material atualizar o custo médio; abrir o detalhe do rolo, pesar, dar
  baixa parcial e descartar com confirmação; como `production`, repetir pesagem/baixa/abertura/
  secagem e confirmar que a criação de rolo está escondida; como `sales`, confirmar leitura-only
  na lista e no detalhe, incluindo o estado vazio filtrando por um material sem rolos
