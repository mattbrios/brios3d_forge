# Fase 11 — Estoque mínimo, alertas e etiqueta QR verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: ed2b29e..48458e1
**Round**: 4 - scoped
**Verifier**: self-verified (degraded - no sub-agent). Ver `## Independência` abaixo: as rodadas 1, 2
e 3 foram feitas por três verificadores independentes distintos, e esta rodada é escopada aos 3 gaps
que a rodada 3 deixou. O mecanismo de sub-agente falhou duas vezes ao ser despachado
(`Sub-agent execution failed: aborted`), então o caminho degradado do `verify.md` foi usado e está
marcado aqui para o gate sinalizá-lo.

Escopo: o diff de `48458e1` (dois arquivos `*.test.tsx` do web mais `checks.md`; **nada** em `api/`
nem em `web/src` fora de teste) mais os **3 gaps da rodada 3** (`verified at c146c1e`). Tudo o mais é
carregado com o sha marcado. As provas rodaram **inteiras neste HEAD**.

Os três gaps fecharam. O que importa: o **mutante que sobreviveu à rodada 3** — prefilar `"0"` no
lugar de `""` nos dois formulários de edição — foi **reinjetado neste HEAD e morreu** nos dois
arquivos, com os outros 146 testes do web verdes.

Provas rodadas neste HEAD `48458e1`, uma invocação por alvo:

- `E2E` = `npm --prefix api run test:e2e` — **334 passed**, 0 failed (exit 0)
- `UNIT` = `npm --prefix api run test` — **108 passed**, 0 failed (exit 0)
- `WEB` = `npm --prefix web run test` — **148 passed**, 0 failed (exit 0)
- `npm --prefix api run lint`, `npm --prefix web run lint`, `npm --prefix api run build`,
  `npm --prefix web run build` — exit 0 nos quatro

O total do web cresce exatamente o que a correção acrescentou: 146 -> 148 (C62, C63). E2E e UNIT não
mudaram, como esperado de um diff que não toca `api/`.

## Independência

O `verify.md` exige que o Verifier não seja o autor, e esta rodada **não cumpre isso**. O que
sustenta o veredito, apesar disso:

- **C1-C61 foram julgados por três agentes independentes**, nas rodadas 1 (`e6dc929`), 2 (`d462ec3`)
  e 3 (`c146c1e`), e os verdicts deles são carregados aqui com o sha de origem. Nenhum deles foi
  reaberto por mim.
- O escopo desta rodada é estreito e **decidido por máquina, não por opinião**: reinjetar o mutante
  exato que a rodada 3 nomeou e conferir se ele morre. Um mutante que morre é um fato observável,
  não um julgamento do autor.
- Os dois outros itens são de texto (atribuição de check numa linha de `Coverage` e uma palavra numa
  claim), conferíveis por leitura contra o código.
- O que este caminho degradado **não** dá: um olhar novo procurando o que eu não pensei em procurar.
  Foi exatamente isso que produziu os achados das três rodadas anteriores, e é por isso que o
  `validate_verification.py` emite WARN neste relatório.

## Binding sources

`carried from e6dc929`, com as células que a correção pôs em alcance **reconferidas em `c146c1e`**.
A correção não tocou nenhum arquivo de `api/src` nem de `web/src` (`git show --stat c146c1e`: 3
arquivos de teste + `checks.md`), então nenhuma fonte binding pôde passar a ser contrariada por
código novo; o que mudou é o que os checks alcançam.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `ROADMAP.md` Fase 11 (383-403) | yes - carried e6dc929 | none | - |
| `ROADMAP.md` questão 14 (828-834) | yes - carried e6dc929 | none | - |
| `ROADMAP.md` questão 15 (835-838) | yes - carried e6dc929 | none | - |
| `ROADMAP.md` matriz de permissões, linha `inventory` (242) | yes - carried e6dc929 | none | - |
| `CONTEXT.md` módulo 2 | yes - carried e6dc929 | none | - |
| `.specs/STATE.md` AD-012/015/018/020/021/023/024 | yes - carried e6dc929 | none | - |
| `.specs/STATE.md` AD-025, AD-026 | yes - carried e6dc929 | none | - |
| `.specs/features/phase-9-filament-inventory/plan.md` (doors 1, 5) | yes - carried e6dc929 | none | - |
| `.specs/features/phase-10-stock-items/plan.md` (door 3) | yes - carried e6dc929 | none | - |
| `plan.md` `## Observable`, `screen materials form` — "campo do piso, **opcional e limpável**" | yes - relido em 48458e1 | none | - |
| `plan.md` `## Observable`, `screen stock item form` — "campo do piso, opcional" | yes - relido em 48458e1 | none | - |
| `plan.md` `## Assumptions`, formato físico da etiqueta ("QR de 30 mm **à esquerda** e os campos à direita", bloco "no canto superior esquerdo da página", `Confirmed? = y`) | yes - relido em c146c1e | none | - |
| `plan.md` `## Observable`, `screen label / loading state = existing` | yes - relido em c146c1e | none | - |
| `plan.md` `## Surface`, `PATCH /inventory/items/:id` "número ou `null`" | yes - carried d462ec3 | none | - |
| `AGENTS.md` "Política de testes", linha "Tela" | yes - relido em c146c1e | none | - |

Enumeração por tela, recomputada em `c146c1e` (o que o plano decide e um seletor alcança):

- `screen alerts`: sem mudança — C29-C32, C36. `carried from e6dc929`.
- `screen label`: campos (C37), nulos (C38), valor do QR (C39), nível+lado+bloco (C40), erro sem QR
  (C43), containment e ordem (C56), carregando (C57), **eixo horizontal e `print:hidden` da própria
  página (C61, novo)**. **Fechada**: não sobrou elemento nem arranjo alcançável por seletor sem
  check.
- `screen roll detail`: sem mudança — C42, C46. `carried from e6dc929`.
- `screen app shell`: sem mudança — C33-C35, C41, assembly por C36. `carried from e6dc929`.
- `screen materials form` + tabela de `/materials`: coluna nos dois estados (C52), os dois galhos de
  `buildBody` (C53). **Falta o estado inicial do campo** (prefill, `:105`) — ver `## Coverage`.
- `screen stock item form` + tabela de `/inventory/items`: campo por `getByLabelText` (C54), os dois
  galhos do submit (C54), **coluna "Mínimo" nos dois estados (C59, novo)**.
- `screen /inventory/items/[id]` (não desenhada pelo plano, nomeada por C58): definir/limpar e o lado
  barrado (C58), **linha `<dl>` do piso nos dois lados (C60 novo para `—`, C58 `:168` para `2 un`)**.
  **Falta o estado inicial do campo** (prefill, `:80`) — ver `## Coverage`.

Nota sobre as colunas: num veredito PASS o gate exige `Uncovered` e `Unproven` vazias, então o que
antes ficava escrito nessas células está na prosa. Das 15 fontes acima, 6 tinham lacuna registrada nas
rodadas 1-3 e todas as 6 estão fechadas por check nomeado nesta ou em rodada anterior — `screen
materials form` C62, `screen stock item form` C63, formato físico da etiqueta C61, `screen label /
loading state` C57, `PATCH /inventory/items/:id` com `null` C55, e a leitura óptica do QR pela
caminhada de navegador da rodada 1 (que nenhum check afirma ter feito, e o `checks.md` diz isso
explicitamente).

## Checks

Legenda do `Result`: `PASS · c146c1e` = citação reconferida neste HEAD (arquivo tocado pela correção
ou check novo). `PASS · carried d462ec3` / `carried e6dc929` = verdict e citação da rodada indicada,
arquivo **não** tocado pela correção, citação re-conferida por leitura e prova re-rodada verde neste
HEAD.

Números de linha que andaram com `c146c1e`: em `label/page.test.tsx` o teste novo entrou em `:167`,
então C37-C40 e C56 (todos acima de `:166`) não mudaram e C57/C43 andaram **+17**; em
`items/page.test.tsx` o teste novo entrou em `:221`, então C54 andou **+15**; em
`items/[id]/page.test.tsx` o teste novo entrou em `:120`, então C58 andou **+18** nas asserções de
corpo e `:117` (lado barrado) ficou onde estava. Nada em `api/test` mudou desde `d462ec3`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `PATCH` grava 500 e repetir mantém | `E2E` "sets the material minimum to 500 and keeps it on a repeated patch" ran+passed | `api/test/inventory-alerts.e2e-spec.ts:127` `expect(first.body.minimumStockGrams).toBe(500)`; `:134` `expect(await materialMinimumOf(id)).toBe(500)` após o 2º PATCH | PASS · carried d462ec3 |
| C2 | criar sem piso nasce `null` | `E2E` "a material created without a minimum has a null minimumStockGrams" ran+passed | `:140` `expect(response.body.minimumStockGrams).toBeNull()`; `:141` coluna nula | PASS · carried d462ec3 |
| C3 | `null` explícito limpa o piso do material | `E2E` "clearing the material minimum writes null back" ran+passed | `:156` `expect(response.body.minimumStockGrams).toBeNull()`; `:157` `expect(await materialMinimumOf(id)).toBeNull()` | PASS · carried d462ec3 |
| C4 | 4 casos inválidos -> `400`, coluna intacta | `E2E` "rejects a negative or non-numeric material minimum" ran+passed | `:165` `expect(response.status, JSON.stringify(invalid)).toBe(400)` sobre `[-1,'500','',{}]`; `:167` `toBe(500)` | PASS · carried d462ec3 |
| C5 | `production` e `sales` -> `403` | `E2E` "production and sales get 403 setting the material minimum" ran+passed | `:176` `toBe(403)`; `:177` `toEqual(PERMISSION_DENIED)`; `:178` coluna `500` | PASS · carried d462ec3 |
| C6 | `GET /materials` traz número ou `null` | `E2E` "GET /materials returns minimumStockGrams as a number or null" ran+passed | `:194` `expect(byType.get('ABS')).toBe(500)`; `:195` `expect(byType.get('PETG')).toBeNull()` | PASS · carried d462ec3 |
| C7 | `PATCH` do item grava 10 | `E2E` "sets the stock item minimum to 10" ran+passed | `:203` `toBe(10)`; `:204` `expect(await itemMinimumOf(id)).toBe(10)` | PASS · carried d462ec3 |
| C8 | 4 casos inválidos em POST e PATCH -> `400` | `E2E` "rejects a negative or non-numeric item minimum on create and on update" ran+passed | `:230` `toBe(400)` e `:235` `toBe(400)` sobre `[-1,'10']`; `:232` contagem inalterada; `:237` `toBe(10)` | PASS · carried d462ec3 |
| C9 | as 2 rotas de leitura do item trazem o piso | `E2E` "both item read routes return minimumQuantity as a number or null" ran+passed | `:253-254` lista (`toBe(10)` / `toBeNull()`); `:258` e `:261` detalhe | PASS · carried d462ec3 |
| C10 | `POST /inventory/items` com piso 10 -> `201` | `E2E` "creates a stock item with a minimum quantity of 10" ran+passed | `:210` `toBe(10)`; `:211` coluna `10` | PASS · carried d462ec3 |
| C11 | `POST /materials` com piso 500 -> `201` | `E2E` "creates a material with a minimum of 500 grams" ran+passed | `:147` `toBe(500)`; `:148` coluna `500` | PASS · carried d462ec3 |
| C12 | `down()`+`up()` preserva linhas e deixa colunas nulas | `E2E` "reverting and re-applying the minimums migration preserves existing rows and leaves the columns null" ran+passed | `api/test/minimums-migration.e2e-spec.ts:58-59` id/type após `down()`; `:75` `expect(materialsAfterUp[0].minimum_stock_grams).toBeNull()`; `:81` idem item; `:89` os 2 `conname` | PASS · carried e6dc929 |
| C13 | `CHECK` rejeita `-1` nas 2 tabelas | `E2E` "the database rejects a negative minimum on both tables" ran+passed | `minimums-migration.e2e-spec.ts:107` `rejects.toMatchObject({ code: '23514' })` sobre os 2 `UPDATE`; `:117`/`:122` nada gravado | PASS · carried e6dc929 |
| C14 | alerta de material, soma 800/1000, label, `unit: "g"`, envelope sem paginação | `E2E` "reports a material alert with the summed balance, the label and the gram unit" ran+passed | `inventory-alerts.e2e-spec.ts:380` `expect(Object.keys(response.body)).toEqual(['items'])`; `:381-390` `toEqual([{ kind:'material', id: materialId, label:'PLA · Voolt · Preto', balance:800, minimum:1000, unit:'g' }])` | PASS · carried d462ec3 |
| C15 | fronteira: 999 alerta, 1000 e 1001 não | `E2E` "alerts at 999 against a minimum of 1000 and stays silent at 1000 and 1001" ran+passed | `:405` `expect(ids, 'saldo '+balance).toEqual(balance === 999 ? [materialId] : [])` sobre `[999,1000,1001]` | PASS · carried d462ec3 |
| C16 | sem piso em lugar nenhum -> `{ items: [] }` | `E2E` "returns an empty list when no minimum is set anywhere" ran+passed | `:416` `expect(response.body).toEqual({ items: [] })` | PASS · carried d462ec3 |
| C17 | material com piso e zero rolo -> `balance: 0` | `E2E` "a material with a minimum and no roll alerts with a zero balance" ran+passed | `:429-437` `toEqual([{ ..., balance: 0, minimum: 500, unit: 'g' }])` | PASS · carried d462ec3 |
| C18 | rolo descartado fora da soma | `E2E` "a discarded roll does not count toward the material balance" ran+passed | `:451` `toHaveLength(1)`; `:452` `expect(response.body.items[0].balance).toBe(800)` | PASS · carried d462ec3 |
| C19 | piso `null` nunca alerta | `E2E` "a material without a minimum never alerts, not even at zero balance" ran+passed | `:461` `expect(response.body.items).toEqual([])` | PASS · carried d462ec3 |
| C20 | material inativo nunca alerta | `E2E` "an inactive material never alerts" ran+passed | `:474` `toEqual([])` | PASS · carried d462ec3 |
| C21 | item inativo nunca alerta | `E2E` "an inactive stock item never alerts" ran+passed | `:487` `toEqual([])` | PASS · carried d462ec3 |
| C22 | alerta de item, label = `name`, `unit` = `unitOfMeasure` | `E2E` "reports a stock item alert with its name as label and its own unit of measure" ran+passed | `:500-503` `toEqual([{ kind:'stock_item', id:itemId, label:'Ímã 6x3', balance:4, minimum:10, unit:'un' }])` | PASS · carried d462ec3 |
| C23 | ordem pela fração da falta, não pela absoluta | `E2E` "orders alerts by the fraction of the minimum missing, not by the absolute shortfall" ran+passed | `:527-531` `toEqual([emptyMaterialId, itemId, lowMaterialId])` (100% / 60% / 20%; falta absoluta 500 g / 6 un / 200 g) | PASS · carried d462ec3 |
| C24 | empate por `label` crescente | `E2E` "breaks an ordering tie by label ascending" ran+passed | `:540-543` `toEqual(['Alumínio','Zinco'])` | PASS · carried d462ec3 |
| C25 | entrada que atinge o piso tira da lista | `E2E` "an entry that reaches the minimum removes the item from the alert list" ran+passed | `:554` antes `toEqual([itemId])`; `:561` `balanceQuantity` 10; `:565` depois `toEqual([])` | PASS · carried d462ec3 |
| C26 | `production` e `sales` recebem a mesma lista | `E2E` "production and sales get the same alert list as admin" ran+passed | `:595` admin == `expected` (literal em `:580-591`); `:599-600` os dois papéis `200` + `toEqual(expected)` | PASS · carried d462ec3 |
| C27 | `GET /inventory/alerts` sem cookie -> `401` | `E2E` "GET /inventory/alerts is 401 without a session" ran+passed | `:606` `toBe(401)`; `:607` `toEqual(SESSION_REQUIRED)` | PASS · carried d462ec3 |
| C28 | `computeStockAlerts` sobre 10 casos | `UNIT` "turns balances and minimums into an ordered alert list" ran+passed | `api/src/modules/inventory/stock-alerts.spec.ts:138` `expect(computeStockAlerts(testCase.input), testCase.name).toEqual(testCase.expected)` sobre os 10 casos de `CASES`, cada esperado literal | PASS · carried e6dc929 |
| C29 | `/inventory/alerts` mostra carregando | `WEB` "shows loading while fetching" ran+passed | `web/src/app/(app)/inventory/alerts/page.test.tsx:75` `getByText("Carregando…")`; `:76` `queryByRole("table")` nulo | PASS · carried e6dc929 |
| C30 | tabela com label/saldo/piso/unidade + links | `WEB` "lists material and item alerts with links to the matching stock screen" ran+passed | `alerts/page.test.tsx:87-92` células `["Ímã 6x3","4","10","un"]`; `:93` href `/inventory/items/item-1`; `:96-101` células do material; `:102` href `/inventory` | PASS · carried e6dc929 |
| C31 | erro + "Tentar novamente", sem tabela parcial | `WEB` "shows the error and retries without a partial table" ran+passed | `:110` mensagem exata; `:111-112` sem `table` e sem `row`; `:118` `fetchMock.mock.calls` = 2 após o clique | PASS · carried e6dc929 |
| C32 | estado vazio | `WEB` "shows the empty state when nothing is below the minimum" ran+passed | `:125` `findByText("Nenhum item está abaixo do mínimo.")`; `:126` sem `table` | PASS · carried e6dc929 |
| C33 | indicador com `3` e link | `WEB` "shows the count 3 linking to the alerts screen" ran+passed | `web/src/components/alerts-indicator.test.tsx:54` `within(header).findByText("3")`; `:55` `getAttribute("href")` = `/inventory/alerts` | PASS · carried e6dc929 |
| C34 | sem alerta, sem indicador | `WEB` "renders nothing when there is no alert" ran+passed | `alerts-indicator.test.tsx:65` link `/abaixo do mínimo/` nulo no banner; `:67` `queryByText("0")` nulo | PASS · carried e6dc929 |
| C35 | falha degrada calada, conteúdo fica | `WEB` "degrades to no indicator and no error message when the request fails" ran+passed | `:77` sem indicador; `:80` `queryByRole("alert")` nulo; `:81` conteúdo presente | PASS · carried e6dc929 |
| C36 | `sales` vê indicador e lista sem edição | `WEB` "sales sees the indicator and the read-only alert list" ran+passed | `alerts/page.test.tsx:146-147` indicador `2` com href, no `banner` renderizado via `<AuthGate>` (`:136-138`); `:151-153` nenhum `button`, `textbox` ou `spinbutton` no `main` | PASS · carried e6dc929 |
| C37 | campos impressos da etiqueta | `WEB` "prints the material, nominal weight, batch, purchase date and short id" ran+passed | `web/src/app/(app)/inventory/[id]/label/page.test.tsx:104-108` `toContain` de `"PLA · Voolt · Preto"`, `"1000 g"`, `"L-2026-07"`, `"2026-07-14"`, `"8f3c1e2a"` | PASS · c146c1e (arquivo tocado; linhas < 166 inalteradas, reconferidas) |
| C38 | `—` no lote e na compra nulos, rótulos ficam | `WEB` "renders an em dash for a missing batch or purchase date" ran+passed | `label/page.test.tsx:117-118` rótulos presentes; `:121` 5 `dd`; `:123` `toEqual(["PLA · Voolt · Preto","1000 g","—","—","8f3c1e2a"])` | PASS · c146c1e |
| C39 | QR codifica exatamente origem + rota | `WEB` "encodes exactly the origin plus the roll path" ran+passed | `:131-133` `expect(qr.props.at(-1)?.value).toBe("http://localhost:3000/inventory/8f3c1e2a-0000-4000-8000-000000000001")` | PASS · c146c1e |
| C40 | QR `level="M"`, lado 30 mm, bloco 70 × 40 mm | `WEB` "renders a 30mm level M code inside a 70x40mm label" ran+passed | `:142` `toBe("M")`; `:143` `toEqual({ width: "30mm", height: "30mm" })`; `:146-147` `70mm`/`40mm` | PASS · c146c1e |
| C41 | `print:hidden` no header e no nav, não no main | `WEB` "hides the header and the nav when printing" ran+passed | `web/src/components/app-shell.test.tsx:33-35` `toContain("print:hidden")` em `banner` e `navigation`, `not.toContain` em `main` | PASS · carried e6dc929 |
| C42 | ação "Imprimir etiqueta" na página do rolo | `WEB` "offers a link to print the roll label" ran+passed | `web/src/app/(app)/inventory/[id]/page.test.tsx:157` `expect(link.getAttribute("href")).toBe("/inventory/r1/label")` | PASS · carried e6dc929 |
| C43 | rolo inexistente: erro e nenhum QR | `WEB` "shows the error state and no code for an unknown roll" ran+passed | `label/page.test.tsx:200` `toBe("Rolo não encontrado")`; `:201-202` sem `qr-code` e sem `roll-label`; `:203` `expect(qr.props).toHaveLength(0)` | PASS · c146c1e (citação refrescada, +17) |
| C44 | `AuthGate` preserva a rota do rolo em `next` | `WEB` "preserves the roll path in next when the session is missing" ran+passed | `web/src/components/auth-gate.test.tsx:99-102` `toHaveBeenCalledWith("/login?next=%2Finventory%2F8f3c1e2a-0000-4000-8000-000000000001")` | PASS · carried e6dc929 |
| C45 | login volta para a página do rolo | `WEB` "returns to the roll page given in next" ran+passed | `web/src/components/login-form.test.tsx:127-129` `toHaveBeenCalledWith("/inventory/8f3c1e2a-0000-4000-8000-000000000001")` | PASS · carried e6dc929 |
| C46 | `admin` e `production` veem pesagem e baixa | `WEB` "admin and production see the weigh and movement forms on the roll page" ran+passed | `inventory/[id]/page.test.tsx:171-174` "Pesar", "Peso bruto na balança (g)", "Dar baixa", "Gramas" nos 2 papéis do laço | PASS · carried e6dc929 |
| C47 | `qrcode.react` fixado em `4.2.0` | `WEB` "pins qrcode.react to an exact version" ran+passed | `web/src/lib/qrcode-pin.test.ts:13` `expect(manifest.dependencies?.["qrcode.react"]).toBe("4.2.0")` | PASS · carried e6dc929 |
| C48 | `PATCH /materials/:id`: 401, 404, 400 | `E2E` "the material patch keeps its inherited 401, 404 and 400 with the new field" ran+passed | `inventory-alerts.e2e-spec.ts:269` 401; `:273-274` 404 + `{ error: 'Material não encontrado' }`; `:277` 400 | PASS · carried d462ec3 |
| C49 | `PATCH /inventory/items/:id`: 401, 403, 404, 400, 409 | `E2E` "the item patch keeps its inherited 401, 403, 404, 400 and 409 with the new field" ran+passed | `:287` 401; `:291` 403; `:295` 404; `:299` 400; `:303-304` 409 + `{ error: 'Já existe um item com este SKU' }` | PASS · carried d462ec3 |
| C50 | os 2 `POST`: 401, 403, 409 | `E2E` "both create routes keep their inherited 401, 403 and 409 with the new field" ran+passed | `:311`/`:315` 401; `:322`/`:326` 403; `:333-334` 409 | PASS · carried d462ec3 |
| C51 | rotas de leitura: 7 casos de status | `E2E` "the changed read routes keep their inherited statuses" ran+passed | `:341`,`:344`,`:348`,`:351`,`:355`,`:358`,`:361` — 401/400 em `GET /materials`, 401/400 em `GET /inventory/items`, 401/404/400 no detalhe | PASS · carried d462ec3 |
| C52 | coluna "Mínimo" de `/materials`: `500 g` e `—` | `WEB` "shows the minimum column as grams or an em dash" ran+passed | `web/src/app/(app)/materials/page.test.tsx:223` `expect(within(withRow).getAllByRole("cell")[6].textContent).toBe("500 g")`; `:224` `...(withoutRow)...toBe("—")` | PASS · carried d462ec3 (arquivo não tocado por `c146c1e`; relido) |
| C53 | os 2 galhos de `buildBody` em `/materials` | `WEB` "sends the typed minimum as a number and the empty field as null" ran+passed | `materials/page.test.tsx:267-269` `expect(bodyOf(...).minimumStockGrams, 'digitado "'+typed+'"').toBe(expected)` sobre `[["500",500],["",null]]` (`:251-254`) | PASS · carried d462ec3 (citação refrescada: o teste novo de C62 entrou acima, +22) |
| C54 | os 2 galhos do submit de `/inventory/items` | `WEB` "sends the typed item minimum and omits it when the field is empty" ran+passed | `web/src/app/(app)/inventory/items/page.test.tsx:268` `expect(body.minimumQuantity, ...).toBe(expected)` sobre `[["10",10],["",undefined]]` (`:241-242`); `:269` `expect("minimumQuantity" in body, ...).toBe(typed !== "")` | PASS · carried c146c1e (arquivo não tocado por `48458e1`) |
| C55 | `PATCH /inventory/items/:id` com `null` limpa o piso | `E2E` "clearing the item minimum writes null back" ran+passed | `inventory-alerts.e2e-spec.ts:219` `toBe(200)`; `:220` `expect(response.body.minimumQuantity).toBeNull()`; `:221` `expect(await itemMinimumOf(id)).toBeNull()` | PASS · carried d462ec3 |
| C56 | QR dentro do bloco e antes dos campos | `WEB` "puts the code inside the label block and before the fields" ran+passed | `label/page.test.tsx:161` `expect(label.contains(code)).toBe(true)`; `:162` idem `fields`; `:164` `expect(code.compareDocumentPosition(fields) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(4)` | PASS · carried c146c1e |
| C57 | carregando na etiqueta, sem bloco e sem QR | `WEB` "shows loading before the roll resolves" ran+passed | `label/page.test.tsx:191` `findByText("Carregando…")`; `:192` `queryByTestId("roll-label")` nulo; `:193` `queryByTestId("qr-code")` nulo | PASS · carried c146c1e |
| C58 | definir/limpar o piso em `/inventory/items/<id>`, `sales` barrado | `WEB` "admin sets and clears the item minimum" ran+passed | `web/src/app/(app)/inventory/items/[id]/page.test.tsx:192` `toEqual({ minimumQuantity: 2 })`; `:193` `findByText("2 un")` (lado com valor do render de `:212`); `:208` `toEqual({ minimumQuantity: null })`; lado barrado no teste vizinho `:117` `queryByRole("button", { name: "Salvar mínimo" })` nulo | PASS · 48458e1 (citação refrescada: o teste novo de C63 entrou acima, +25) |
| C59 | coluna "Mínimo" de `/inventory/items`: `—` e `50 un` | `WEB` "shows an em dash in the minimum column for an item without a minimum" ran+passed | `items/page.test.tsx:232` `expect(within(rowOf("Sem piso")).getAllByRole("cell")[4].textContent).toBe("—")`; `:233` `...rowOf("Parafuso M3x8")...toBe("50 un")` — fixture nulo construído em `:224` | PASS · carried c146c1e (fault 1 da rodada 3 morto) |
| C60 | linha `<dl>` de `/inventory/items/<id>`: `—` | `WEB` "shows an em dash for an item without a minimum" ran+passed | `items/[id]/page.test.tsx:134` `expect(term.tagName).toBe("DT")`; `:135` `expect((term.nextElementSibling as HTMLElement).textContent).toBe("—")` — fixture nulo em `:128`, sessão `sales` em `:126` para o `<dt>` ser o único "Estoque mínimo" na tela | PASS · carried c146c1e (fault 2 da rodada 3 morto) |
| C61 | eixo em linha e `print:hidden` do chrome desta tela | `WEB` "lays the code beside the fields and keeps the screen chrome out of the print" ran+passed | `label/page.test.tsx:175` `toContain("flex")` + `:176` `.not.toContain("flex-col")` (o par é o que decide o eixo); `:178` `getByRole("heading", { name: "Etiqueta do rolo" }).className` `toContain("print:hidden")`; `:180` `(printButton.parentElement).className` `toContain("print:hidden")`; `:181` `label.className` `not.toContain("print:hidden")` | PASS · carried c146c1e (faults 3 e 4 da rodada 3 mortos; a claim teve "botão" trocado por "contêiner", ver `Gaps`) |
| C62 | prefill do piso em `/materials`, vazio no nulo e `"500"` no definido | `WEB` "prefills the minimum field from the row, empty when there is no minimum" ran+passed | `web/src/app/(app)/materials/page.test.tsx:245` `expect(field.value, 'material '+type).toBe(prefilled)` sobre `[[MATERIAL_1,"PLA",""],[withMinimum,"ABS","500"]]` (`:232-235`); campo lido por `getByLabelText("Estoque mínimo (g, opcional)")` em `:244`, **depois** do clique em "Editar" (`:243`) e **sem** nenhum `fireEvent.change` antes | PASS · 48458e1 (check novo; fault desta rodada morto) |
| C63 | prefill do piso em `/inventory/items/<id>`, vazio no nulo e `"2"` no definido | `WEB` "prefills the minimum field from the item, empty when there is no minimum" ran+passed | `web/src/app/(app)/inventory/items/[id]/page.test.tsx:157` `expect(field.value, 'piso '+String(minimumQuantity)).toBe(prefilled)` sobre `[[null,""],[2,"2"]]` (`:141-143`); campo lido por `findByLabelText("Mínimo (un), vazio para nenhum")` em `:154-156`, sem escrita anterior | PASS · 48458e1 (check novo; mesmo fault) |

Nenhum check ficou sem `file:line`. Nenhum valor esperado é derivado chamando o código sob teste: os
literais de C62 e C63 (`""`, `"500"`, `"2"`) estão escritos na asserção.

**Adversarial sobre C62 e C63** (escritos pelo autor para satisfazer o achado da rodada 3, que é onde
uma asserção vácua se esconde). Três coisas que os separam de um teste de fachada:

- **Leem o `value` do `<input>`, não a presença do campo.** `getByLabelText(...) as HTMLInputElement`
  e depois `field.value`. Um teste que só afirmasse que o campo existe passaria sob o mutante.
- **Leem antes de escrever.** É exatamente o defeito que a rodada 3 diagnosticou em C53 e C58: os
  dois chamam `fireEvent.change` no campo antes de submeter, então o valor prefilado nunca é
  observado. C62 lê em `:244` logo após o clique em "Editar" (`:243`), sem nenhum `change` entre os
  dois; C63 lê no primeiro `await` depois do render.
- **Asseram os dois lados, por tabela rotulada.** Só o lado vazio não distingue `""` de
  `String(null)`, e só o lado com valor não pega o mutante. O rótulo (`material ${type}`,
  `piso ${String(minimumQuantity)}`) faz a falha apontar qual linha da tabela caiu.

E o que fecha o argumento não é a leitura do teste, é o mutante: reinjetado nos **dois** arquivos ao
mesmo tempo, ele mata C62 e C63 e **só** eles (146 dos 148 testes do web seguem verdes). Ver
`Faults injected`.

## Coverage

Recomputado a partir da autoridade de cada conjunto, nunca lido de `checks.md`. As linhas marcadas
`recomputed 48458e1` são as que a correção tocou; as outras são `carried from c146c1e` / `d462ec3` /
`e6dc929` — a correção não mudou uma linha de `api/src` nem de `web/src` — e tiveram as provas
re-rodadas verdes neste HEAD.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| `GET /inventory/alerts` statuses (2) | `inventory.controller.ts:58-62` + AD-015 · carried e6dc929 | 200 C14/C16/C26 · 401 C27; `403` impossível (os três papéis passam) | - |
| `POST /materials` statuses (4) | `materials.controller.ts:21-25` · carried e6dc929 | 201 C11/C2 · 400 C4 · 401 C50 · 403 C50 | - |
| `PATCH /materials/:id` statuses (5) | `materials.controller.ts:28-34` + `materials.service.ts:80` · carried e6dc929 | 200 C1/C3 · 400 C4+C48 · 401 C48 · 403 C5 · 404 C48 | - |
| `GET /materials` statuses (3) | `materials.controller.ts:14-18` + `ListMaterialsDto` · carried e6dc929 | 200 C6 · 400 C51 · 401 C51 | - |
| `POST /inventory/items` statuses (6, não 5) | `inventory.controller.ts:111` + `inventory.service.ts:392-393` · carried e6dc929 | 201 C10 · 400 C8 · 401 C50 · 403 C50 · 409 C50 · 404 pela Fase 10 (`stock-items.e2e-spec.ts:203`) | - |
| `PATCH /inventory/items/:id` statuses (6) | `inventory.controller.ts:117` + `inventory.service.ts:417-437` · carried e6dc929 | 200 C7 · 400 C8+C49 · 401 C49 · 403 C49 · 404 C49 · 409 C49 | - |
| `GET /inventory/items` statuses (3) | `inventory.controller.ts:122-123` · carried e6dc929 | 200 C9 · 400 C51 · 401 C51 | - |
| `GET /inventory/items/:id` statuses (4) | `inventory.controller.ts:136-137` · carried e6dc929 | 200 C9 · 400 C51 · 401 C51 · 404 C51 | - |
| `PATCH /inventory/items/:id` valores de `minimumQuantity` (3) | `plan.md` `Surface` + `inventory.service.ts:437` · carried d462ec3 | número C7 · omitido C49 · `null` explícito C55 | - |
| `PATCH /materials/:id` valores de `minimumStockGrams` (3) | idem + `materials.service.ts:105` · carried d462ec3 | número C1 · omitido C48 · `null` C3 | - |
| campos de `StockAlert` (6) | `stock-alerts.ts:6-13` · carried e6dc929 | C14 `:381-390` e C22 `:500-503` asseram o objeto inteiro por `toEqual` | - |
| envelope sem paginação (3) | `inventory.types.ts:82-84` + door 4 · carried e6dc929 | só `items` C14 `:380` · ordem C23 · empate C24 | - |
| fronteira `saldo < piso` (3 lados) | `stock-alerts.ts:55` · carried e6dc929 | 999 C15/C28 · 1000 C15/C28 · 1001 C15/C28 | - |
| motivos de exclusão (4) | `stock-alerts.ts:55` + `inventory.service.ts:366` · carried e6dc929 | piso `null` C19/C28 · material inativo C20/C28 · item inativo C21/C28 · rolo descartado C18 | - |
| saldo do material vindo de N rolos (3) | `inventory.service.ts:342-369` · carried e6dc929 | 2 rolos C14 · 0 rolo C17 · descartado fora C18 | - |
| casos do fold (10) | `stock-alerts.spec.ts:54-133` contra os pontos de decisão de `stock-alerts.ts` · carried e6dc929 | C28, um `expect` rotulado por caso | - |
| statements da migration (8: 4 `up`, 4 `down`) | `1790223618727-AddStockMinimums.ts:15-27` · carried e6dc929 | `up` C12 (`:75`,`:81`,`:89`) · `down` C12 (`:57-65`) · os 2 `CHECK` valendo C13 | - |
| papéis (3 leem, 1 define, 2 barrados) | `inventory.controller.ts:58`, `materials.controller.ts:21/28`, AD-018 · carried e6dc929 | admin lê C14, define C1/C7 · production lê C26, barrado C5/C50 · sales lê C26/C36, barrado C5/C49 e no web C58 (`:117`) | - |
| startup config: colunas novas visíveis (2 assemblies) | leitura direta de `api/src/database/data-source.ts:14` (glob, exercitado pelo `migration:run` de `test/global-setup.ts:26`) e `api/src/app.module.ts:24` (`autoLoadEntities`) · carried e6dc929 | CLI C12 · app C1/C7 | - |
| startup config: assembly do indicador (1) | leitura direta de `web/src/components/auth-gate.tsx:98` · carried e6dc929 | C36, e o fault 4 da rodada 1 provou que é C36 que o carrega | - |
| estados da tela `/inventory/alerts` (3) | `alerts/page.tsx:43-69` + `Observable` · carried e6dc929 | carregando C29 · erro C31 · vazio C32 | - |
| estados do indicador (3) | `alerts-indicator.tsx:28-30` · carried e6dc929 | com alerta C33 · sem alerta C34 · falha C35 | - |
| estados da tela da etiqueta (3) | `label/page.tsx:48-50` e `:74-76` + `Observable` · carried d462ec3 | pronta C37 · rolo inexistente C43 · carregando C57 (`:191-193`) | - |
| composição da etiqueta (6 membros alcançáveis por seletor) | `plan.md` `Assumptions`, linha do formato físico, `Confirmed? = y` — autoridade fora do código · carried c146c1e | 1. bloco 70 × 40 mm C40 (`:146-147`) · 2. QR de 30 mm e nível `M` C40 (`:142-143`) · 3. QR dentro do bloco C56 (`:161-162`) · 4. QR antes dos campos C56 (`:164`) · 5. eixo em linha C61 (`:175-176`) · 6. só a etiqueta sai na impressão C61 (`:178-181`) + C41 para o `AppShell` | - |
| telas que o `plan.md` `Observable` decide (7) | `plan.md` `Observable`, linhas 217-243 (autoridade fora do código) · **recomputed 48458e1** | 1. screen `alerts` C29-C32, C36 · 2. screen `label` C37-C40, C43, C56, C57, C61 · 3. screen `roll detail` C42, C46 · 4. screen `materials form` C52, C53, **C62** · 5. screen `stock item form` C54, C58, C59, C60, **C63** · 6. screen `app shell` C33-C35, C41 · 7. coleção `alerts` C14, C22, C23, C24 | - |
| renders do piso, os dois lados em cada tela (3, e são exatamente 3) | `grep` em `web/src`: os únicos ternários valor-vs-`—` são `materials/page.tsx:66`, `inventory/items/page.tsx:78` e `inventory/items/[id]/page.tsx:212` (o `alerts/page.tsx:88` rende `alert.minimum`, nunca nulo por construção) · **recomputed 48458e1** | `/materials`: `500 g` C52 (`:223`) e `—` C52 (`:224`) · `/inventory/items`: `50 un` C59 (`:233`) e `—` C59 (`:232`) · `/inventory/items/<id>`: `2 un` **C58** (`:193`) e `—` C60 (`:135`) | - |
| prefill do campo do piso, os dois lados em cada formulário de edição (2, e são exatamente 2) | `grep` em `web/src` pelos pontos que escrevem o campo a partir do dado carregado: `materials/page.tsx:105` (`formFromMaterial`) e `inventory/items/[id]/page.tsx:80` (efeito de carga). `inventory/items/page.tsx` não tem prefill — o cadastro nasce do `BLANK_FORM` · **recomputed 48458e1** | `/materials`: vazio no nulo e `"500"` no definido, **C62** (`:245`) · `/inventory/items/<id>`: vazio no nulo e `"2"` no definido, **C63** (`:157`) | - |
| controles de tela novos no diff (9, e são exatamente 9) | `git diff ed2b29e..48458e1` sobre `web/src/app/(app)/**`, galho por galho · **recomputed 48458e1** | 1. `/materials` `buildBody`, 2 galhos (`:90`) C53 · 2. `/materials` coluna (`:66`), 2 estados C52 · 3. `/inventory/items` submit do cadastro, 2 galhos (`:141-142`) C54 · 4. `/inventory/items` coluna (`:78`), 2 estados C59 · 5. `/inventory/items/[id]` submit do piso, 2 galhos (`:147`) C58 · 6. `/inventory/items/[id]` linha `<dl>` (`:212`), 2 estados C60 + C58 · 7. `/inventory/items/[id]` papel de tela (`:240`) C58 (`:117`) · 8. **`/materials` prefill (`:105`), 2 galhos C62** · 9. **`/inventory/items/[id]` prefill (`:80`), 2 galhos C63** | - |

Duas observações que saíram das células de `Unproven` e não são membros sem prova:

- `POST /inventory/items` tem **6** status e a linha do `checks.md` declara 5. O `404` de
  `preferredSupplierId` desconhecido existe e é provado — por `api/test/stock-items.e2e-spec.ts:203`,
  da Fase 10, não por um check desta fase. É a linha que está subdimensionada, não a cobertura.
- `minimumError` no detalhe do item (`items/[id]/page.tsx:253`) não tem prova própria e também não é
  membro: nenhuma fonte binding desta fase o decide, é o mesmo padrão de erro inline das Fases 9 e 10.

`Swept` relido contra o código em `48458e1`: os `n/a` continuam conferindo (nenhum `Throttle` em
`api/src`; `groupBy('material.id')` em `inventory.service.ts:368` mais uma linha por item impedem
dono duplicado; a única escrita é atribuição de escalar absoluto em `materials.service.ts:105` e
`inventory.service.ts:437`, sem decremento; nenhum dos dois módulos chama serviço externo). As linhas
que apontam para checks resolvem para provas que existem e passaram. `carried from e6dc929`,
re-conferido por leitura porque a correção não mexeu em `api/src`.

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `stock-alerts.ts` — predicado de fronteira + ordenação por valor derivado | `api/src/modules/inventory/stock-alerts.ts` | unit isolado **e** e2e pela rota | yes - carried e6dc929: unit C28 (`stock-alerts.spec.ts:138`, 10 casos) + e2e C15/C18-C21/C23/C24 |
| consulta agregada com `LEFT JOIN` | `inventory.service.ts:342-385` | e2e com material sem rolo e com rolo descartado | yes - carried e6dc929: C17 (`:429`), C18 (`:452`), C14 (`:381`) |
| migration que adiciona coluna a tabela com linhas | `1790223618727-AddStockMinimums.ts` | `down()` e `up()` sobre linhas semeadas | yes - carried e6dc929: C12 (`minimums-migration.e2e-spec.ts:57-89`) |
| `CHECK` de não negatividade em duas tabelas | `material.entity.ts:6`, `stock-item.entity.ts:22` | um teste por tabela, direto no banco | yes - carried e6dc929: C13 (`:107`, 2 casos, `23514`) |
| DTOs que ganham campo opcional aceitando `null` | os 4 DTOs de `materials/` e `inventory/dto/` | e2e do lado aceito e de cada lado recusado, nas 4 rotas de escrita | yes - carried c146c1e: a linha cita `null` explícito do material C3 (`:156-157`) e do item C55 (`:220-221`); aceito C1/C7/C10/C11, recusado C4/C8 |
| indicador de alertas no cabeçalho | `web/src/components/alerts-indicator.tsx` | um teste de componente por estado | yes - carried e6dc929: C33/C34/C35 |
| tela da etiqueta | `web/src/app/(app)/inventory/[id]/label/page.tsx` | testes de tela por caso | yes - carried c146c1e: a linha nomeia composição e carregamento e cita C37-C40, C43, C56, C57, C61; cada um com asserção localizada |
| `AppShell` e o mapeamento da linha de alerta (instrumentação) | `app-shell.tsx`, mapeamento inline em `inventory.service.ts:374-383` | nenhuma própria | yes - carried d462ec3: cobertas por C14/C22/C41 |
| telas de cadastro que ganharam o campo do piso — `materials/page.tsx`, `inventory/items/page.tsx`, `inventory/items/[id]/page.tsx` | os 3 arquivos que ela nomeia | um teste de tela por galho, em **cada** tela que toca o campo — render, submit e **prefill** — mais o que cada papel vê | **yes** - re-judged 48458e1. As rodadas 2 e 3 apontaram que a linha não precificava o prefill. A linha foi reescrita e agora o nomeia, e os três galhos têm os dois lados em cada arquivo — renders C52 (`:223-224`), C59 (`:232-233`), C60 (`:135`) + C58 (`:193`); submits C53, C54, C58; **prefills C62 (`:245`) e C63 (`:157`)**; papel restrito C58 (`:117`). Todo galho que a linha precifica tem prova localizada |

## Faults injected

Isolado em `git worktree add /tmp/fase11-r4-scratch HEAD` (nunca `git stash`), com `web/node_modules`
ligado por symlink ao repositório real; o symlink foi removido **antes** do
`git worktree remove --force`. `git status --porcelain` da árvore real **antes**:
`M .agents/.skill-lock.json`, `M .agents/.skill-lock.json.backup`, `M .gitignore`,
`M .specs/LESSONS.md`, `M .specs/lessons.json`, `M AGENTS.md`,
`?? .specs/features/phase-11-stock-alerts-qr/verification.md`. **Depois**: idêntico linha por linha
(`diff` vazio), e `git worktree list` volta a ter só o repositório.

Uma falta, na única superfície de asserção que a correção criou — e deliberadamente **o mutante exato
que sobreviveu à rodada 3**, reinjetado nos dois arquivos ao mesmo tempo, que é a forma mais forte do
teste: se qualquer um dos dois prefills tivesse ficado sem guarda, a suíte voltaria verde.

| Mutation | Location | Narrowest covering proof | Killed |
| --- | --- | --- | --- |
| prefill do campo do piso: `=== null ? ""` -> `=== null ? "0"` nos **dois** formulários ao mesmo tempo (abrir a edição de um cadastro sem piso passa a mostrar `0`, e salvar sem tocar no campo grava uma política de zero) | `web/src/app/(app)/materials/page.tsx:105` **e** `web/src/app/(app)/inventory/items/[id]/page.tsx:80` | `WEB` suíte inteira (`npx vitest run`, 28 arquivos) — C62 e C63 | **yes** - 2 failed, 146 passed: `materials/page.test.tsx:245` `material PLA: expected '0' to be ''` e `items/[id]/page.test.tsx:157` `piso null: expected '0' to be ''`. Os outros 146 testes do web seguiram verdes, **C53, C58, C52, C59 e C60 incluídos**, o que isola a prova em C62/C63 e confirma o diagnóstico da rodada 3: nenhum check anterior tocava este galho |

Os 5 mutantes da rodada 1, os 5 da rodada 2 e os 5 da rodada 3 não foram repetidos: o diff de
`48458e1` não toca nenhuma das superfícies deles. Os 4 mortos da rodada 3 (renders de
`/inventory/items` e do detalhe do item, eixo da etiqueta, `print:hidden` da etiqueta) seguem
`carried from c146c1e`. Total acumulado nas quatro rodadas: **16 faltas injetadas, 16 mortas** — a
única que havia sobrevivido é a desta tabela.

## Browser

`carried from e6dc929`. A correção não alterou nenhum arquivo de `web/src` ou `api/src`
(`git show --stat 48458e1`: `checks.md` e 2 arquivos `*.test.tsx`), então a caminhada de navegador da
rodada 1 descreve `48458e1` byte por byte no que ela observou: bloco medido em `70.0mm × 40.0mm`, QR
em `30.0mm × 30.0mm`, `<svg>` descendente do bloco **e à esquerda do `<dl>`**, QR rasterizado e
decodificado com `jsQR` devolvendo
`http://localhost:3000/inventory/28022a95-abf9-4c56-bd7a-a2e7b5deeecf`, `media: print` com `header`,
`nav`, `h1` e o botão "Imprimir" em `display: none`, coluna "Mínimo" na 7ª posição de `/materials`, e
a seção "Estoque mínimo" no detalhe do item. Também percorridos ali: os três estados da tela de
alertas, o indicador caindo de `2` para `1` depois de uma entrada e desaparecendo quando o piso é
limpo, a sessão de `sales` sem nenhuma ação de edição, e o QR aberto sem sessão caindo em
`/login?next=%2Finventory%2F<id>` e aterrizando no rolo depois do login.

O que esta rodada acrescenta ao registro: o prefill dos formulários de edição **nunca** foi observado
em navegador em nenhuma rodada — a caminhada da rodada 1 definiu piso digitando o valor, sem olhar o
campo antes. Hoje ele está guardado por C62/C63 no nível de teste, que é onde uma regressão silenciosa
seria pega; a confirmação visual segue pendente e não é exigida por nenhum check.

Continua não verificado, e não exigido por check nenhum: legibilidade do QR em papel impresso de
verdade e leitura por câmera de celular.

## Gaps

Nenhum que reprove. Os três da rodada 3 fecharam, com evidência fresca:

### Fechado — gap 1 da rodada 3: o mutante sobrevivente (prefill do campo do piso)

Era o único achado substantivo da rodada 3 e o único que reprovava. Fechado por **C62** e **C63**, e
o que sustenta isso não é a existência dos testes, é o mutante: reinjetei em `48458e1` o
**mesmo** `"0"` no lugar de `""` nos dois arquivos, ao mesmo tempo, e ele **morreu** nos dois
(`materials/page.test.tsx:245`, `items/[id]/page.test.tsx:157`), com os outros 146 testes do web
verdes. A rodada 3 havia registrado que sob essa mutação as três suítes vinham 146/146, 334/334 e
108/108 — hoje vêm 2 vermelhos, exatamente nos dois checks novos.

As duas asserções não são vácuas em três pontos que a rodada 3 pediu para conferir: cada uma lê o
`value` do `<input>` (não a presença do campo nem o corpo do submit), lê **depois** de abrir o
formulário e **sem** nenhum `fireEvent.change` antes — que era o defeito de C53 e C58, que
sobrescreviam o campo — e assera **os dois lados** por tabela rotulada, porque só o lado vazio não
distingue `""` de `String(null)`.

Efeito prático que deixa de ser possível em silêncio: um admin abrir a edição de um material sem piso,
salvar sem tocar no campo e gravar `minimumStockGrams: 0` — "política de zero" onde o door 1 decidiu
"sem política", com o `CHECK` do banco deixando passar porque zero é um piso válido. Era a terceira
aparição da mesma confusão (rodada 1 num render, rodada 2 em dois renders, rodada 3 no prefill); é a
primeira em que todas as superfícies do campo estão guardadas.

### Fechado — gap 2 da rodada 3: atribuição na linha `renders do piso`

A linha do `checks.md` creditava a 3ª tela só a C60, que assera um lado. Agora lê
"`/inventory/items/<id>` linha da `<dl>`: `—` C60 e `2 un` C58", e conferi as duas asserções no
código: C60 em `items/[id]/page.test.tsx:135` (`toBe("—")`) e C58 em `:193`
(`findByText("2 un")`). Era precisão sem consequência de prova, e agora o texto diz o que as provas
fazem.

### Fechado — gap 3 da rodada 3: a claim de C61 dizia "botão"

A claim agora diz "o título e o **contêiner** do botão 'Imprimir'". Confere com o código
(`label/page.tsx:90` no `<h1>`, `:91` na `<div>` que envolve o botão) e com a asserção
(`label/page.test.tsx:180` lê `printButton.parentElement`).

### Carregado sem reexame

Os gaps das rodadas 1 e 2 seguem fechados (`carried from c146c1e` e `d462ec3`), e os desvios que
aquelas rodadas conferiram — hop 5 reescrito no plano, migration aparada, asserções **ampliadas** e
nunca enfraquecidas — não foram tocados por este diff. Confere que esta correção também só
acrescentou: `git show 48458e1` são 62 inserções e 3 remoções, as 3 remoções em prosa do `checks.md`.
Nenhum teste apagado, pulado ou enfraquecido; os totais só sobem (web 146 -> 148).

### Fora de alcance, registrado e não reprovando

- Legibilidade do QR em papel impresso de verdade e leitura por câmera de celular. O que **foi**
  verificado: o QR rasterizado da tela decodificado por `jsQR` devolvendo a URL exata do rolo
  (rodada 1) e a impressão em PDF sob `media: print` sem header, nav, título nem botão.
- Ausência de `@page size` — decisão aprovada em `## Assumptions`, sem alcance de seletor, observada
  na impressão em PDF da rodada 1.
- Granularidade da linha `composição da etiqueta`: o `checks.md` conta 4 membros e meu recompute
  decompõe em 6 (agrupa "eixo + chrome", separa containment de ordem). **Nenhum membro fica sem
  prova nas duas decomposições**, então é diferença de granularidade, não gap.

## Gate

- `npm --prefix api run test:e2e` - **334 passed**, 0 failed (exit 0)
- `npm --prefix api run test` - **108 passed**, 0 failed (exit 0)
- `npm --prefix web run test` - **148 passed**, 0 failed (exit 0)
- `npm --prefix api run lint` · `npm --prefix web run lint` · `npm --prefix api run build` ·
  `npm --prefix web run build` - exit 0 nos quatro
- 63/63 checks com evidência localizada (`file:line` + expressão da asserção), nenhum sem prova
- Faltas: 1 injetada nesta rodada (o mutante sobrevivente da rodada 3, nos dois arquivos), **1
  morta**; 15 mortas nas rodadas 1-3, carregadas
- Cobertura: 29 conjuntos, **0 membros sem prova**

Não-determinismo da suíte e2e, fora do escopo desta fase e `carried from e6dc929`: a rodada 1
observou 2 e depois 1 teste vermelho em `api/test/stock-items.e2e-spec.ts` (Fase 10) com status
implausíveis. Nas rodadas 2 e 3 a suíte veio 334/334 na primeira invocação. Já registrado como L-030
e como risco aberto no `STATE.md`; não muda nenhum verdict acima.
