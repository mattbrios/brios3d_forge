# Fase 11 — Estoque mínimo, alertas e etiqueta QR · checks

Profile: standard
Plan: `.specs/features/phase-11-stock-alerts-qr/plan.md`

63 checks em 4 fatias · 4 one-way doors · nenhuma questão aberta
(os 51 primeiros aprovados antes do build; os 12 seguintes nasceram da verificação, fechando
cobertura de tela — 7 na rodada 1, 3 na rodada 2, 2 na rodada 3)

O `AGENTS.md` não declara perfil (`light` seria o padrão). Uso `standard`, como as Fases 8 a 10,
por três formas que esta fase traz e que o repositório não tem análogo para:

1. **Primeiro predicado de fronteira do sistema.** Todo o resto do estoque é aritmética (soma,
   média, decremento). Aqui o resultado é uma comparação, e `<=` no lugar de `<` continua passando
   por qualquer teste que só use um saldo bem abaixo do piso. Um `light` pede uma asserção
   localizada por check e não pede o lado que não dispara — que é justamente onde o mutante mora.
2. **Primeira ordenação por valor derivado.** A lista sai ordenada pela fração do piso que falta,
   e um mutante que ordenasse pela falta absoluta produziria a mesma ordem em qualquer amostra que
   não misture grama com unidade.
3. **Primeira exclusão em massa por estado.** Quatro razões diferentes tiram uma linha da lista
   (piso `null`, material inativo, item inativo, rolo descartado). Um mutante que esquecesse uma
   delas continua devolvendo uma lista plausível, e nenhuma delas aparece na resposta — o que
   falta é justamente o que não se vê.

Um `light` também não recomputaria a junção de `Coverage` a partir das fontes, e é a junção que
obriga cada um dos quatro motivos de exclusão a ter um token próprio.

Os valores esperados vêm do `plan.md` (`## Criteria` e `## Landing`) e ficam escritos
**literalmente** nas asserções, nunca derivados chamando o próprio código em teste.

Onde as provas rodam. Os e2e (`npm --prefix api run test:e2e`) montam o `AppModule` contra o
`forge_test`, com as migrations aplicadas pelo `global-setup.ts` antes da suíte (padrão da Fase 0),
num arquivo novo `test/inventory-alerts.e2e-spec.ts` que reusa `auth-helper.ts`,
`materials-helper.ts`, `inventory-helper.ts` e `stock-items-helper.ts` (`materials-helper.ts` e
`stock-items-helper.ts` ganham o parâmetro opcional do piso no `INSERT`; `inventory-helper.ts` não,
porque rolo não tem piso). O predicado e a ordenação (`stock-alerts.ts`, função pura,
sem banco) ganham um spec Vitest isolado ao lado de `average-cost.spec.ts`. A migration ganha
arquivo próprio (`test/minimums-migration.e2e-spec.ts`) rodando `down()` e `up()` por
`QueryRunner` sobre linhas semeadas, no mesmo formato de `movements-migration.e2e-spec.ts`
(Fase 10). No web, Vitest + Testing Library com o `fetch` substituído, como em
`materials/page.test.tsx`; o QR não é decodificado opticamente em teste — o que os testes asseram
é a string que entra no componente e as dimensões do bloco, e a leitura real do código impresso é
um passo de navegador/celular na verificação.

## Checks

### S1 - Piso de estoque por material e por item · 16 arquivos · 92 KB · ~23k

**C1** - `PATCH /materials/:id` com sessão de `admin` e `{ "minimumStockGrams": 500 }` responde
`200` com `minimumStockGrams: 500`, a coluna `minimum_stock_grams` da linha fica `500`, e um
segundo `PATCH` com o mesmo valor mantém `500` (escrita absoluta, repetição inócua) (AC 1)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "sets the material minimum to 500 and keeps it on a repeated patch"`

**C2** - `POST /materials` sem `minimumStockGrams` responde `201` com `minimumStockGrams: null`, e
a coluna fica nula na linha criada (AC 2, door 1)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "a material created without a minimum has a null minimumStockGrams"`

**C3** - Num material com `minimumStockGrams: 500`, `PATCH /materials/:id` com
`{ "minimumStockGrams": null }` responde `200` com `minimumStockGrams: null` e deixa a coluna nula
(AC 3)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "clearing the material minimum writes null back"`

**C4** - Tabela sobre `PATCH /materials/:id` com `minimumStockGrams` igual a `-1`, `"500"`,
`""` e `{}` (4 casos): cada um responde `400`, e a coluna continua com o valor anterior (AC 4)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "rejects a negative or non-numeric material minimum"`

**C5** - Tabela sobre sessão de `production` e de `sales` em `PATCH /materials/:id` com
`{ "minimumStockGrams": 500 }` (2 casos): cada um responde `403`, e a coluna não muda (AC 5)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "production and sales get 403 setting the material minimum"`

**C6** - Com um material de piso `500` e outro sem piso, `GET /materials` responde `200` com
`minimumStockGrams: 500` no primeiro e `null` no segundo (AC 6)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "GET /materials returns minimumStockGrams as a number or null"`

**C7** - `PATCH /inventory/items/:id` com sessão de `admin` e `{ "minimumQuantity": 10 }` responde
`200` com `minimumQuantity: 10`, e a coluna `minimum_quantity` da linha fica `10` (AC 7)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "sets the stock item minimum to 10"`

**C8** - Tabela sobre `POST /inventory/items` e `PATCH /inventory/items/:id` com `minimumQuantity`
igual a `-1` e a `"10"` (4 casos): cada um responde `400`, e nada é persistido nem alterado (AC 8)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "rejects a negative or non-numeric item minimum on create and on update"`

**C9** - Com um item de piso `10` e outro sem piso, `GET /inventory/items` e
`GET /inventory/items/:id` respondem `200` trazendo `minimumQuantity: 10` no primeiro e `null` no
segundo (2 rotas) (AC 9)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "both item read routes return minimumQuantity as a number or null"`

**C10** - `POST /inventory/items` com `{ "minimumQuantity": 10 }` responde `201` com
`minimumQuantity: 10`, e a coluna fica `10` (lado aceito do campo no cadastro do item) (AC 8, AC 9)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "creates a stock item with a minimum quantity of 10"`

**C11** - `POST /materials` com `{ "minimumStockGrams": 500 }` responde `201` com
`minimumStockGrams: 500`, e a coluna fica `500` (lado aceito do campo no cadastro do material)
(AC 2, AC 4)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "creates a material with a minimum of 500 grams"`

**C12** - Com um material e um item semeados **antes**, rodar `down()` e depois `up()` da migration
dos pisos por `QueryRunner` preserva as duas linhas, e depois do `up()` as colunas
`minimum_stock_grams` e `minimum_quantity` voltam nulas nelas, sem nenhum backfill (`Impact`:
stored data, door 1)
Proof: `npm --prefix api run test:e2e -- test/minimums-migration.e2e-spec.ts -t "reverting and re-applying the minimums migration preserves existing rows and leaves the columns null"`

**C13** - Tabela sobre `UPDATE` direto em `materials` com `minimum_stock_grams = -1` e em
`stock_items` com `minimum_quantity = -1` (2 casos): o banco rejeita os dois pelo `CHECK` de não
negatividade (código `23514`) (door 1)
Proof: `npm --prefix api run test:e2e -- test/minimums-migration.e2e-spec.ts -t "the database rejects a negative minimum on both tables"`

**C48** - Tabela sobre `PATCH /materials/:id` com `{ "minimumStockGrams": 500 }`: sem cookie de
sessão responde `401`, com uuid inexistente responde `404`, com `:id` que não é uuid responde `400`
(3 casos) (AD-015, `ParseUUIDPipe`)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "the material patch keeps its inherited 401, 404 and 400 with the new field"`

**C49** - Tabela sobre `PATCH /inventory/items/:id` com `{ "minimumQuantity": 10 }`: sem cookie
responde `401`, com sessão de `sales` responde `403`, com uuid inexistente responde `404`, com
`:id` que não é uuid responde `400`, e com um `sku` já existente no mesmo corpo responde `409`
(5 casos)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "the item patch keeps its inherited 401, 403, 404, 400 and 409 with the new field"`

**C50** - Tabela sobre `POST /materials` e `POST /inventory/items` com o campo de piso no corpo:
sem cookie os dois respondem `401`, com sessão de `production` os dois respondem `403`, e o item
com `sku` duplicado responde `409` (5 casos)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "both create routes keep their inherited 401, 403 and 409 with the new field"`

**C51** - Tabela sobre as rotas de leitura que ganharam o campo: `GET /materials` e
`GET /inventory/items` sem cookie respondem `401` e com `pageSize=101` respondem `400`;
`GET /inventory/items/:id` sem cookie responde `401`, com uuid inexistente responde `404` e com
`:id` que não é uuid responde `400` (7 casos)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "the changed read routes keep their inherited statuses"`

### S2 - Alertas na API · 7 arquivos · 62 KB · ~16k

**C14** - Com um material ativo de `minimumStockGrams: 1000` e dois rolos não descartados de `500`
e `300` g, `GET /inventory/alerts` com sessão de `admin` responde `200` com exatamente um item:
`kind: "material"`, `id` igual ao id do material, `label` igual a `"PLA · Voolt · Preto"`,
`balance: 800`, `minimum: 1000` e `unit: "g"` (AC 10, door 4)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "reports a material alert with the summed balance, the label and the gram unit"`

**C15** - Tabela sobre um material de `minimumStockGrams: 1000` com saldo somado de `999`, `1000` e
`1001` g (3 casos): `999` aparece na resposta e `1000` e `1001` não aparecem (AC 11 — os dois
lados da fronteira `saldo < piso`)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "alerts at 999 against a minimum of 1000 and stays silent at 1000 and 1001"`

**C16** - `GET /inventory/alerts` com sessão de `admin` num banco sem nenhum piso definido responde
`200` com `{ "items": [] }` (AC 14, estado vazio do contrato)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "returns an empty list when no minimum is set anywhere"`

**C17** - Material ativo com `minimumStockGrams: 500` e **nenhum** rolo cadastrado aparece em
`GET /inventory/alerts` com `balance: 0` e `minimum: 500` (AC 12 — o `LEFT JOIN`; um `INNER JOIN`
deixaria esse material fora)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "a material with a minimum and no roll alerts with a zero balance"`

**C18** - Material de `minimumStockGrams: 1000` com um rolo ativo de `800` g e um rolo descartado
de `500` g aparece com `balance: 800`, nunca `1300` (AC 13)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "a discarded roll does not count toward the material balance"`

**C19** - Material ativo com `minimumStockGrams: null` e saldo somado `0` não aparece em
`GET /inventory/alerts` (AC 14)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "a material without a minimum never alerts, not even at zero balance"`

**C20** - Material com `active: false`, `minimumStockGrams: 1000` e saldo somado `0` não aparece em
`GET /inventory/alerts` (AC 15)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "an inactive material never alerts"`

**C21** - Item com `active: false`, `minimumQuantity: 10` e `balanceQuantity: 0` não aparece em
`GET /inventory/alerts` (AC 16)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "an inactive stock item never alerts"`

**C22** - Item ativo com `name: "Ímã 6x3"`, `minimumQuantity: 10`, `balanceQuantity: 4` e
`unitOfMeasure: "un"` aparece com `kind: "stock_item"`, `id` do item, `label: "Ímã 6x3"`,
`balance: 4`, `minimum: 10` e `unit: "un"` (AC 17, door 4)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "reports a stock item alert with its name as label and its own unit of measure"`

**C23** - Com um material de piso `500` e saldo `0` (falta 100% do piso), um item de piso `10` e
saldo `4` (falta 60%) e um material de piso `1000` e saldo `800` (falta 20%),
`GET /inventory/alerts` responde os três nessa ordem exata (AC 18 — a falta absoluta daria
`500 g`, `6 un`, `200 g`, ordem diferente)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "orders alerts by the fraction of the minimum missing, not by the absolute shortfall"`

**C24** - Com dois itens de piso `10` e saldo `5` cada (mesma fração), nomes `"Zinco"` e
`"Alumínio"`, `GET /inventory/alerts` responde `"Alumínio"` antes de `"Zinco"` (AC 18 — empate por
`label` crescente)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "breaks an ordering tie by label ascending"`

**C25** - Num item de piso `10` e saldo `4` que aparece nos alertas, um
`POST /inventory/items/:id/entries` de `6` faz a chamada seguinte a `GET /inventory/alerts` não
trazer mais aquele item (AC 19)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "an entry that reaches the minimum removes the item from the alert list"`

**C26** - Tabela sobre sessão de `production` e de `sales` em `GET /inventory/alerts` (2 casos):
cada um responde `200` com a mesma lista que o `admin` recebe, item por item (AC 20 — lado positivo
do `@Roles('production', 'sales')`)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "production and sales get the same alert list as admin"`

**C27** - `GET /inventory/alerts` sem cookie de sessão responde `401` (AC 21, AD-015)
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "GET /inventory/alerts is 401 without a session"`

**C28** - `computeStockAlerts`, tabela sobre 10 casos: saldo abaixo do piso entra; saldo igual ao
piso fica fora; saldo acima fica fora; piso `null` fica fora; dono inativo fica fora; saldo `0`
com piso definido entra; `unit` é `"g"` no material e o `unitOfMeasure` no item; a ordem sai pela
fração da falta decrescente; o empate sai por `label` crescente; e entrada vazia devolve lista
vazia (AC 10-18, door 4)
Proof: `npm --prefix api run test -- src/modules/inventory/stock-alerts.spec.ts -t "turns balances and minimums into an ordered alert list"`

### S3 - Tela de alertas e indicador no layout · 8 arquivos · 42 KB · ~11k

**C29** - A tela `/inventory/alerts` mostra "Carregando…" antes do `GET /inventory/alerts` (mock)
resolver (AC 23)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/alerts/page.test.tsx' -t "shows loading"`

**C30** - Com um alerta de material e um de item no mock, a tela `/inventory/alerts` mostra o
`label`, o saldo, o piso e a unidade de cada um, o link do material aponta para `/inventory` e o
link do item aponta para `/inventory/items/<id>` (AC 22)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/alerts/page.test.tsx' -t "lists material and item alerts with links to the matching stock screen"`

**C31** - Com o `GET /inventory/alerts` (mock) rejeitando, a tela mostra a mensagem de erro e um
botão "Tentar novamente" que refaz a chamada, sem nenhuma linha de tabela na tela (AC 24)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/alerts/page.test.tsx' -t "shows the error and retries without a partial table"`

**C32** - Com o `GET /inventory/alerts` (mock) resolvendo `{ items: [] }`, a tela mostra o estado
vazio dizendo que nenhum item está abaixo do mínimo (AC 25)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/alerts/page.test.tsx' -t "shows the empty state when nothing is below the minimum"`

**C33** - Com `GET /inventory/alerts` (mock) devolvendo 3 itens, o cabeçalho renderiza o indicador
com o texto `3` e um link para `/inventory/alerts` (AC 26)
Proof: `npm --prefix web run test -- src/components/alerts-indicator.test.tsx -t "shows the count 3 linking to the alerts screen"`

**C34** - Com `GET /inventory/alerts` (mock) devolvendo `{ items: [] }`, o cabeçalho não renderiza
nenhum indicador (AC 27)
Proof: `npm --prefix web run test -- src/components/alerts-indicator.test.tsx -t "renders nothing when there is no alert"`

**C35** - Com `GET /inventory/alerts` (mock) rejeitando, o cabeçalho não renderiza indicador nem
nenhum elemento `role="alert"`, e o conteúdo passado ao `AppShell` continua na tela (AC 28)
Proof: `npm --prefix web run test -- src/components/alerts-indicator.test.tsx -t "degrades to no indicator and no error message when the request fails"`

**C36** - Com sessão de `sales` (mock de `/auth/me`) e 2 alertas, o indicador aparece com `2`, a
tela `/inventory/alerts` lista os dois, e nenhum botão ou formulário de edição aparece em nenhuma
das duas (AC 29)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/alerts/page.test.tsx' -t "sales sees the indicator and the read-only alert list"`

### S4 - Etiqueta com QR e leitura no celular · 10 arquivos · 44 KB · ~11k

**C37** - Com o mock de `GET /inventory/rolls/:id` e de `GET /materials`, a tela
`/inventory/<rollId>/label` mostra `"PLA · Voolt · Preto"`, `1000 g` de peso nominal, o lote
`"L-2026-07"`, a data de compra `2026-07-14` e os 8 primeiros caracteres do id do rolo (AC 30)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/[id]/label/page.test.tsx' -t "prints the material, nominal weight, batch, purchase date and short id"`

**C38** - Com o rolo do mock tendo `batch: null` e `purchaseDate: null`, a etiqueta mostra `—` nos
dois campos, e nenhum dos dois rótulos desaparece da etiqueta (AC 31)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/[id]/label/page.test.tsx' -t "renders an em dash for a missing batch or purchase date"`

**C39** - Na tela da etiqueta, o `value` que chega ao QR é exatamente
`http://localhost:3000/inventory/8f3c1e2a-0000-4000-8000-000000000001` para esse id com essa
origem, sem sufixo, prefixo ou parâmetro (AC 32, door 3)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/[id]/label/page.test.tsx' -t "encodes exactly the origin plus the roll path"`

**C40** - Na tela da etiqueta, o QR é renderizado com `level="M"` e lado `30mm`, dentro de um bloco
de `70mm` × `40mm` (AC 33)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/[id]/label/page.test.tsx' -t "renders a 30mm level M code inside a 70x40mm label"`

**C41** - O `<header>` e o `<nav>` do `AppShell` carregam a variante `print:hidden`, e o conteúdo
principal não (AC 34)
Proof: `npm --prefix web run test -- src/components/app-shell.test.tsx -t "hides the header and the nav when printing"`

**C42** - A tela `/inventory/<rollId>` mostra a ação "Imprimir etiqueta" apontando para
`/inventory/<rollId>/label` (AC 35)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/[id]/page.test.tsx' -t "offers a link to print the roll label"`

**C43** - Com o `GET /inventory/rolls/:id` (mock) respondendo `404`, a tela da etiqueta mostra o
estado de erro e não renderiza nenhum elemento de QR (AC 36)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/[id]/label/page.test.tsx' -t "shows the error state and no code for an unknown roll"`

**C44** - Com `GET /auth/me` (mock) respondendo `401` numa navegação para
`/inventory/8f3c1e2a-0000-4000-8000-000000000001`, o `AuthGate` redireciona para
`/login?next=%2Finventory%2F8f3c1e2a-0000-4000-8000-000000000001` (AC 37)
Proof: `npm --prefix web run test -- src/components/auth-gate.test.tsx -t "preserves the roll path in next when the session is missing"`

**C45** - No formulário de login com `next=/inventory/8f3c1e2a-0000-4000-8000-000000000001` na
query, o login bem-sucedido redireciona para `/inventory/8f3c1e2a-0000-4000-8000-000000000001`
(AC 37, `safeNext` existente)
Proof: `npm --prefix web run test -- src/components/login-form.test.tsx -t "returns to the roll page given in next"`

**C46** - Tabela sobre sessão de `admin` e de `production` na tela `/inventory/<rollId>` (2 casos):
cada uma mostra o formulário de pesagem e o de baixa na mesma tela, sem navegação adicional
(AC 38)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/[id]/page.test.tsx' -t "admin and production see the weigh and movement forms on the roll page"`

**C47** - `web/package.json` declara `qrcode.react` em `dependencies` com a versão exata `4.2.0`,
sem `^` nem `~` (door 2, regra de versão fixada do `AGENTS.md`)
Proof: `npm --prefix web run test -- src/lib/qrcode-pin.test.ts -t "pins qrcode.react to an exact version"`

### Nascidos da verificação, rodada 1

A rodada 1 passou os 51 checks com evidência localizada e matou as 5 falhas injetadas, e reprovou por
**cobertura**: duas telas que o `plan.md` `## Observable` decide (`screen materials form` e
`screen stock item form`) não eram alcançadas por check nenhum, o galho numérico de `buildBody` e a
composição da etiqueta não tinham asserção, e `{ "minimumQuantity": null }` — o corpo que o próprio
web envia para limpar a política — não tinha prova em nível de rota. C52-C58 fecham isso. Os valores
esperados continuam vindo do `plan.md`, escritos literalmente.

**C52** - Na tela `/materials`, com um material de piso `500` e outro sem piso, a coluna "Mínimo"
mostra `500 g` na linha do primeiro e `—` na do segundo (AC 6 no nível da tela; um `render` que
trocasse o nulo por `0 g` passava a suíte inteira)
Proof: `npm --prefix web run test -- 'src/app/(app)/materials/page.test.tsx' -t "shows the minimum column as grams or an em dash"`

**C53** - Tabela sobre os dois galhos de `buildBody` na tela `/materials` (2 casos): preencher
"Estoque mínimo (g, opcional)" com `500` e salvar manda `minimumStockGrams: 500` no corpo; deixar o
campo vazio manda `minimumStockGrams: null` (AC 1, AC 3 no nível da tela)
Proof: `npm --prefix web run test -- 'src/app/(app)/materials/page.test.tsx' -t "sends the typed minimum as a number and the empty field as null"`

**C54** - Tabela sobre o cadastro de item na tela `/inventory/items` (2 casos): com
"Estoque mínimo (opcional)" igual a `10`, o `POST` leva `minimumQuantity: 10`; com o campo vazio, a
chave **não** aparece no corpo (omitir é o que grava `null`, door 1) (AC 7, AC 9 no nível da tela)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/items/page.test.tsx' -t "sends the typed item minimum and omits it when the field is empty"`

**C55** - Num item com `minimumQuantity: 10`, `PATCH /inventory/items/:id` com
`{ "minimumQuantity": null }` responde `200` com `minimumQuantity: null` e deixa a coluna
`minimum_quantity` nula (o simétrico de C3 no item, e o corpo exato que a tela do item envia para
limpar a política; `## Surface`: "número ou `null`")
Proof: `npm --prefix api run test:e2e -- test/inventory-alerts.e2e-spec.ts -t "clearing the item minimum writes null back"`

**C56** - Na tela da etiqueta, o elemento do QR é **descendente** do bloco de `70mm` × `40mm` e vem
antes do `<dl>` dos campos na ordem do documento (composição aprovada em `## Assumptions`: "QR de
30 mm à esquerda e os campos à direita"; C40 mede os dois separadamente e não prova containment)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/[id]/label/page.test.tsx' -t "puts the code inside the label block and before the fields"`

**C57** - Enquanto o `GET /inventory/rolls/:id` não resolve, a tela da etiqueta mostra "Carregando…"
e não renderiza nem o bloco da etiqueta nem o QR (`Observable`: `screen label / loading state`)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/[id]/label/page.test.tsx' -t "shows loading before the roll resolves"`

**C58** - Na tela `/inventory/items/<id>`, `admin` define o piso (corpo `{ "minimumQuantity": 2 }`) e
depois o limpa com o campo vazio (corpo `{ "minimumQuantity": null }`), e `sales` não vê a ação
"Salvar mínimo" (a Fase 10 entregou o item sem formulário de edição, então sem esta seção nenhum item
já cadastrado recebe piso pela interface — AC 7 ficaria sem caminho de tela)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/items/[id]/page.test.tsx' -t "admin sets and clears the item minimum"`

### Nascidos da verificação, rodada 2

A rodada 2 fechou os 7 gaps da rodada 1 e reprovou pela **mesma forma, nos irmãos**: C52 provou os
dois lados do render do piso em `/materials` e os dois outros lugares que rendem piso continuaram com
só o lado que tem valor. Mais o eixo da etiqueta, que a ordem do documento (C56) não decide.

**C59** - Na lista `/inventory/items`, um item com `minimumQuantity: null` mostra `—` na coluna
"Mínimo" e um com `50` mostra `50 un` (o lado nulo do render; `0 un` é uma política diferente de
"sem mínimo", door 1)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/items/page.test.tsx' -t "shows an em dash in the minimum column for an item without a minimum"`

**C60** - Na tela `/inventory/items/<id>`, um item com `minimumQuantity: null` mostra `—` na linha
"Estoque mínimo" da lista de dados (o lado nulo do mesmo render, na outra tela)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/items/[id]/page.test.tsx' -t "shows an em dash for an item without a minimum"`

**C61** - Na tela da etiqueta, o bloco de `70mm` × `40mm` dispõe QR e campos **em linha** (classe
`flex` sem `flex-col`, o que decide "QR à esquerda, campos à direita" da `## Assumptions`), e o
título e o **contêiner** do botão "Imprimir" **desta página** carregam `print:hidden` enquanto o
bloco da etiqueta não (C41 assera o `AppShell`, que é outro arquivo)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/[id]/label/page.test.tsx' -t "lays the code beside the fields and keeps the screen chrome out of the print"`

### Nascidos da verificação, rodada 3

A rodada 3 fechou os 3 gaps da rodada 2 e reprovou por **um mutante sobrevivente**: o terceiro lugar
em que o mesmo campo aparece — o **pré-preenchimento** dos dois formulários de edição — não tinha
asserção nenhuma. Prefilar `"0"` no lugar de `""` passava as três suítes inteiras e fazia o admin
gravar política de zero só por abrir o formulário de um cadastro sem piso e salvar sem tocar no
campo: exatamente a confusão "sem política" × "política de zero" que o door 1 recusou no banco.

**C62** - Na tela `/materials`, abrir "Editar" de um material com `minimumStockGrams: null` deixa o
campo "Estoque mínimo (g, opcional)" **vazio**, e de um com `500` deixa `"500"` (2 casos; só o lado
vazio não distingue `""` de `String(null)`)
Proof: `npm --prefix web run test -- 'src/app/(app)/materials/page.test.tsx' -t "prefills the minimum field from the row, empty when there is no minimum"`

**C63** - Na tela `/inventory/items/<id>`, um item com `minimumQuantity: null` deixa o campo
"Mínimo (un), vazio para nenhum" **vazio**, e um com `2` deixa `"2"` (2 casos, o mesmo galho na outra
tela)
Proof: `npm --prefix web run test -- 'src/app/(app)/inventory/items/[id]/page.test.tsx' -t "prefills the minimum field from the item, empty when there is no minimum"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /inventory/alerts` statuses (2) | 200 C14, C16, C26 · 401 C27 | - |
| `POST /materials` statuses (4) | 201 C11, C2 · 400 C4 · 401 C50 · 403 C50 | - |
| `PATCH /materials/:id` statuses (5) | 200 C1, C3 · 400 C4, C48 · 401 C48 · 403 C5 · 404 C48 | - |
| `GET /materials` statuses (3) | 200 C6 · 400 C51 · 401 C51 | - |
| `POST /inventory/items` statuses (5) | 201 C10 · 400 C8 · 401 C50 · 403 C50 · 409 C50 | - |
| `PATCH /inventory/items/:id` statuses (6) | 200 C7 · 400 C8, C49 · 401 C49 · 403 C49 · 404 C49 · 409 C49 | - |
| `GET /inventory/items` statuses (3) | 200 C9 · 400 C51 · 401 C51 | - |
| `GET /inventory/items/:id` statuses (4) | 200 C9 · 400 C51 · 401 C51 · 404 C51 | - |
| door 1: piso como coluna nula nas duas tabelas (6) | material grava C1 · item grava C7 · cadastro sem piso nasce `null` C2, C10 · limpar volta a `null` C3 · `CHECK` não negativo nas duas tabelas C13 · migration sobre linhas existentes C12 | - |
| door 2: `qrcode.react` fixado (3) | versão exata no manifest C47 · QR renderizado com o valor certo C39 · nível e tamanho C40 | - |
| door 3: URL impressa no QR (4) | valor exato codificado C39 · a rota abre a página do rolo com as ações C46 · sem sessão vai ao login preservando o destino C44 · o login volta para o rolo C45 | - |
| door 4: campos do contrato `StockAlert` (6) | `kind` C14, C22 · `id` C14, C22 · `label` C14, C22 · `balance` C14, C17 · `minimum` C14, C22 · `unit` C14, C22 | - |
| door 4: envelope sem paginação e ordenado (3) | lista sem `total`/`page` C14 · ordem por fração da falta C23 · empate por `label` C24 | - |
| fronteira `saldo < piso` (3 lados) | `999` alerta C15 · `1000` silencia C15 · `1001` silencia C15 | - |
| motivos de exclusão do alerta (4) | piso `null` C19 · material inativo C20 · item inativo C21 · rolo descartado C18 | - |
| `kind` do alerta (2) | `material` C14 · `stock_item` C22 | - |
| unidade por tipo de dono (2) | `"g"` no material C14 · `unitOfMeasure` no item C22 | - |
| `label` por tipo de dono (2) | `tipo · marca · cor` no material C14 · `name` no item C22 | - |
| saldo do material vindo de N rolos (3) | dois rolos somados C14 · zero rolo C17 · rolo descartado fora da soma C18 | - |
| casos do fold `stock-alerts.ts` (10) | C28, table-driven sobre os 10 casos | - |
| papel que define o piso (1) | `admin` C1, C7 | - |
| papéis barrados na definição do piso (2) | `production` C5, C50 · `sales` C5, C49 | - |
| papéis que leem alertas, lado positivo (3) | `admin` C14 · `production` C26 · `sales` C26, C36 | - |
| estados da tela `/inventory/alerts` (3) | carregando C29 · erro C31 · vazio C32 | - |
| estados do indicador no cabeçalho (3) | com alerta C33 · sem alerta C34 · falha na busca C35 | - |
| estados da tela da etiqueta (3) | etiqueta pronta C37 · rolo inexistente C43 · carregando C57 | - |
| campos impressos na etiqueta (5) | material C37 · peso nominal C37 · lote C37, C38 · data de compra C37, C38 · id curto C37 | - |
| composição da etiqueta (4) | lado do QR e do bloco C40 · QR dentro do bloco C56 · QR antes dos campos C56 · eixo em linha, e o chrome desta tela fora da impressão, C61 | - |
| telas que o `plan.md` `## Observable` decide (7) | alerts C29-C32, C36 · label C37-C40, C43, C56, C57, C61 · roll detail C42, C46 · app shell C33-C35, C41 · materials form C52, C53 · stock item form C54, C58, C59, C60 · coleção `alerts` C14, C22, C23, C24 | - |
| renders do piso, os dois lados em cada tela (3 telas) | `/materials` coluna: `500 g` e `—` C52 · `/inventory/items` coluna: `50 un` e `—` C59 · `/inventory/items/<id>` linha da `<dl>`: `—` C60 e `2 un` C58 | - |
| prefill do campo do piso, os dois lados em cada formulário de edição (2 telas) | `/materials` C62 · `/inventory/items/<id>` C63 | - |
| `PATCH /inventory/items/:id`, valores de `minimumQuantity` (3) | número C7 · omitido C49 (o `PATCH` de `sku` não zera o piso) · `null` explícito C55 | - |
| `PATCH /materials/:id`, valores de `minimumStockGrams` (3) | número C1 · omitido C48 · `null` explícito C3 | - |
| startup config: colunas novas visíveis (2 assemblies) | glob do `data-source.ts` do CLI, exercitado pelo `migration:run` do `global-setup.ts` C12 · `AppModule` com `autoLoadEntities`, exercitado por qualquer rota que leia o campo C1, C7 | - |

- Claims que citam código de status, rota ou formato de resposta: C1-C27, C48-C51 — cada uma tem
  prova que cruza a fronteira HTTP (e2e real contra o `AppModule`), exceto C13, que afirma sobre o
  banco e prova no banco
- C28 é a única prova de unidade cujo claim também aparece pela rota (C14-C24): o predicado e a
  ordenação decidem em 10 casos que a rota não exercita todos, então ganham os dois níveis
- C39 e C40 asseram o que entra no componente de QR e as dimensões do bloco, nunca que o código é
  opticamente legível — essa leitura é um passo de navegador/celular na verificação, e nenhuma
  claim aqui afirma tê-la feito
- Nenhuma outra claim afirma mais do que os casos que a prova exercita

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| `stock-alerts.ts` — predicado de fronteira + ordenação por valor derivado (decide; forma nova, o repositório não tem nenhuma comparação de limite nem ordenação calculada) | unit test isolado da função pura **e** e2e pela rota | os 3 lados da fronteira e os 4 motivos de exclusão (C28, C15, C18-C21), mais a ordem e o empate pela API (C23, C24) |
| consulta agregada com `LEFT JOIN` de `materials` para `filament_rolls` (decide: incluir quem não tem rolo, excluir rolo descartado) | e2e com material sem rolo e com rolo descartado | zero rolo (C17), rolo descartado fora da soma (C18), dois rolos somados (C14) |
| migration que adiciona coluna a tabela com linhas (decide; segunda do sistema, precedente `movements-migration.e2e-spec.ts`) | um teste que roda `down()` e `up()` sobre linhas semeadas | linhas preservadas e colunas nulas depois do `up()` (C12) |
| `CHECK` de não negatividade novo em duas tabelas (decide; um lado de violação por tabela) | um teste por tabela, direto no banco | `materials` e `stock_items` (C13) |
| DTOs que ganham campo opcional aceitando `null` (instrumentação com decisão de validação; mesma forma dos DTOs das Fases 5-10) | e2e do lado aceito e de cada lado recusado, nas quatro rotas de escrita | aceito C1, C7, C10, C11; recusado C4, C8; `null` explícito no material C3 e no item C55 |
| indicador de alertas no cabeçalho (decide: 3 estados, e um deles é uma falha silenciosa) | um teste de componente por estado | com alerta (C33), sem alerta (C34), falha (C35) |
| tela da etiqueta (decide: valor do QR, campos nulos, rolo inexistente, composição, carregamento) | testes de tela por caso | C37-C40, C43, C56, C57, C61 |
| `AppShell` e o mapeamento da linha de alerta para a resposta (instrumentação — copiam campo a campo, sem condicional que decida o resultado). O mapeamento ficou inline em `inventory.service.ts`, não num `toAlertResponse` próprio | nenhuma própria | cobertas pelas provas dos consumidores (C14, C22, C41) |
| telas de cadastro que ganharam o campo do piso — `materials/page.tsx`, `inventory/items/page.tsx`, `inventory/items/[id]/page.tsx` (decidem: `buildBody` escolhe entre número e `null`, o submit do item escolhe entre número e omitir, **três** `render` escolhem entre valor e `—`, e **dois prefill** escolhem entre `String(valor)` e vazio) | um teste de tela por galho, em **cada** tela que toca o campo — render, submit e prefill — mais o que cada papel vê | os dois galhos do piso do material (C53), os dois do item (C54); os três renders nos dois estados — `/materials` C52, `/inventory/items` C59, `/inventory/items/<id>` C60 + C58; os dois prefill nos dois estados — C62, C63; e definir/limpar mais o lado barrado no detalhe do item (C58) |

Evidence:

- `stock-alerts.ts` (novo): 1 predicado de fronteira, 4 guardas de exclusão e 1 comparador com
  desempate -> 6 pontos de decisão, e nenhum análogo no repositório: `average-cost.ts` e
  `stock-item-average-cost.ts` (Fases 9 e 10) são aritmética sobre um conjunto, sem limite e sem
  ordem -> ganha spec Vitest isolado além da cobertura e2e
- `inventory.service.ts` (existente, cresce): a consulta de alerta é a primeira do módulo que
  precisa da linha **sem** correspondência (`materialsSummary` parte dos rolos e por isso nunca
  veria um material sem rolo) -> decide, alcançada pela rota -> e2e com os três formatos de saldo
- migration dos pisos: 2 `ADD COLUMN` + 2 `ADD CONSTRAINT` sobre tabelas com linhas. O análogo mais
  próximo é `AlterInventoryMovementsOwner` (Fase 10), que ganhou arquivo de teste próprio -> mesmo
  tratamento
- `materials.service.ts` e `inventory.service.ts` no `PATCH`: copiam campo a campo com
  `if (dto.x !== undefined)`, e o campo novo aceita `null` como valor legítimo, o que é a primeira
  vez que `undefined` e `null` significam coisas diferentes num `PATCH` deste sistema -> por isso
  C3 existe separado de C1
- `alerts-indicator.tsx` (novo): 3 estados, um deles silencioso -> decide; o análogo é
  `health-status.tsx`, provado por estado em `health-status.test.tsx` -> mesmo nível
- `AppShell` e os mappers de resposta: copiam entrada em saída, sem condicional -> instrumentação

Cost: 1 arquivo e2e novo (`inventory-alerts.e2e-spec.ts`) cobrindo a rota de alerta e o campo novo
nas 6 rotas alteradas, 1 arquivo e2e novo só para a migration e os dois `CHECK`, 1 spec Vitest novo
para o fold, 3 arquivos de teste novos no web (tela de alertas, tela da etiqueta, indicador) e
asserções novas em `app-shell.test.tsx`, `auth-gate.test.tsx`, `login-form.test.tsx` e no teste da
tela do rolo. Sem C15, um `<=` no predicado passa por qualquer amostra que não use o saldo
exatamente igual ao piso, e o sistema deixa de avisar no único ponto em que avisar importa. Sem
C17, um `INNER JOIN` esconde justamente o material que zerou. Sem C23, ordenar pela falta absoluta
mistura grama com unidade e ninguém percebe. Sem C12, a migration só é exercitada contra banco
vazio, que é o único cenário em que ela não pode falhar.

**Aprovado pelo usuário e escrito no repositório:** estas linhas estão no `AGENTS.md`, seção
"Política de testes", generalizadas por forma de código (decide / instrumentação / invariante de
banco / migration sobre linhas / `@Roles()` / tela) em vez de nomeadas por arquivo desta fase. A
partir daqui elas valem para toda fase, e esta deixa de ser a única que as carrega.

## Swept

- validation: C4, C8, C13 — piso negativo e não numérico nas quatro rotas de escrita, e o `CHECK`
  do banco como backstop nas duas tabelas
- failure and partial failure: C35 — a falha da chamada de alertas no cabeçalho não derruba a tela
  nem mostra erro; C43 — rolo inexistente na etiqueta mostra erro e não renderiza QR pela metade; e
  C4, em que um `PATCH` recusado deixa a coluna com o valor anterior
- idempotency, retry, duplicates: C1 — o `PATCH` do piso é escrita absoluta, então repetir o mesmo
  valor não muda nada; C14, C25 — `GET /inventory/alerts` não tem efeito colateral e só muda de
  resposta quando o saldo ou o piso muda. Duplicados: n/a — o alerta não é criado, é derivado, e
  a consulta agrupa por dono, então um dono não pode aparecer duas vezes
- authorization and rate limits: C5, C26, C27, C36, C48, C49, C50, C51 — os dois lados em toda rota
  alterada e na rota nova. Rate limit: n/a — nenhum módulo do sistema aplica rate limit (mesma
  decisão das Fases 4-10)
- concurrency and ordering: C23, C24 — a ordenação da lista é afirmada explicitamente, com
  desempate. Corrida: n/a — a única escrita desta fase é um escalar absoluto por linha (último
  valor vence, sem invariante entre linhas e sem decremento), e a leitura de alertas é um snapshot
  sem efeito; a concorrência do saldo continua provada onde ela mora (Fase 9 e Fase 10, AD-023)
- data lifecycle: C12 — as colunas entram nulas sobre linhas que já existem, sem backfill; o
  alerta não é persistido, então não há o que expirar ou arquivar, e limpar o piso (C3) é a única
  forma de "apagar" a política
- external-dependency failure: C35 — para o web, a API é a dependência externa, e a falha dela no
  cabeçalho degrada sem mensagem. Do lado da API: n/a — `inventory` e `materials` não chamam nenhum
  serviço externo, e `qrcode.react` é dependência de build no navegador, não um serviço em runtime
- state transitions: C3 — piso definido -> limpo (sai da lista); C25 — abaixo do piso -> reposto
  (sai da lista); C20, C21 — ativo -> inativo (sai da lista)
- observability: n/a — mesma decisão das Fases 4-10: nenhum critério desta fase exige uma linha de
  log específica, e o alerta é a própria evidência que o usuário lê

## Out of scope

`plan.md` já carrega `## Out of scope`; nada novo surgiu na derivação. Duas coisas que a derivação
acrescentou sem sair do escopo aprovado: C16 (lista vazia como contrato, não só como estado de
tela) e C46 (a página do rolo tem de oferecer pesagem e baixa para os dois papéis operacionais, que
é o que o AC 38 pede e que nenhum teste da Fase 9 assert junto).

## Handoff

Novos (API): `stock-alerts.ts` + `stock-alerts.spec.ts`, 1 migration (`AddStockMinimums`),
`test/inventory-alerts.e2e-spec.ts`, `test/minimums-migration.e2e-spec.ts` ≈ 32 KB.
Existente tocado (API): `test/stock-items.e2e-spec.ts` (39,7 KB), `inventory.service.ts` (25,4 KB),
`test/materials.e2e-spec.ts` (15 KB), `inventory.controller.ts` (5,8 KB), `inventory.types.ts`
(5,4 KB), `materials.service.ts` (4,6 KB), `test/stock-items-helper.ts` (2,6 KB),
`test/inventory-helper.ts` (2,5 KB), `entities/stock-item.entity.ts` (2 KB), `dto/create-stock-item.dto.ts`
(1,4 KB), `dto/update-stock-item.dto.ts` (1,3 KB), `dto/create-material.dto.ts` (1,4 KB),
`dto/update-material.dto.ts` (1,3 KB), `materials.types.ts` (1,2 KB), `entities/material.entity.ts`
(1,2 KB), `test/materials-helper.ts` (1,3 KB), `ROADMAP.md` ≈ 115 KB.
Web novos: `lib/alerts.ts`, `lib/qrcode-pin.test.ts`, `components/alerts-indicator.tsx` + teste,
`app/(app)/inventory/alerts/page.tsx` + teste, `app/(app)/inventory/[id]/label/page.tsx` + teste
≈ 26 KB. Web existente tocado: `app/(app)/inventory/[id]/page.tsx` (11,6 KB) + teste (6,4 KB),
`app/(app)/inventory/items/[id]/page.tsx` (11,1 KB), `app/(app)/materials/page.tsx` (10,7 KB),
`app/(app)/inventory/items/page.tsx` (9,2 KB), `auth-gate.test.tsx` (6,5 KB), `app-shell.test.tsx`
(5,2 KB), `login-form.test.tsx` (4,8 KB), `app-shell.tsx` (4 KB), `auth-gate.tsx` (3,5 KB),
`lib/inventory.ts` (1,5 KB), `lib/stock-items.ts` (1,3 KB), `lib/materials.ts` (0,4 KB),
`package.json` ≈ 78 KB.

- Total ≈ 251 KB ≈ 63k tokens (`wc -c` sobre os arquivos tocados ÷ 4). Abaixo do orçamento padrão
  de 150k: **um builder só, sem pergunta de mecanismo**
- A fatia mais pesada é S1 (92 KB ≈ 23k), porque o campo novo atravessa os dois cadastros e os dois
  arquivos e2e maiores do repositório; nenhuma fatia sozinha chega perto do orçamento, então não há
  corte a propor
- Ordem de construção: migration + colunas + DTOs (S1) antes de tudo, porque S2 lê as colunas; a
  rota de alerta e o fold (S2) antes das telas; a etiqueta (S4) é independente de S2 e S3 e pode
  fechar por último
- Validação final com o Playwright MCP (`AGENTS.md`): como `admin`, definir 1000 g de piso num
  material com 800 g em rolos e 10 un num insumo com 4, abrir `/inventory/alerts` e conferir a
  ordem, o indicador com a contagem no cabeçalho de outra tela, repor o insumo e ver o indicador
  cair; limpar o piso do material e ver a lista esvaziar com o estado vazio; como `sales`,
  confirmar que o indicador e a tela aparecem sem nenhuma ação de edição; abrir a etiqueta de um
  rolo, imprimir em PDF conferindo que cabeçalho e menu não saem, e **ler o QR impresso** com um
  leitor real, confirmando que ele abre `/inventory/<id>` — passando antes pelo login quando a
  sessão não existe
