# Fase 12 — Calculadora integrada · checks

Profile: light
Plan: `.specs/features/phase-12-integrated-calculator/plan.md`

## Intent

19 checks em 2 fatias · 1 one-way door · nenhuma questão aberta

`AGENTS.md` não declara perfil - `light` é o default do `tlc-spec-lean`. Nenhuma forma nova aqui:
o serviço de aplicação só orquestra chamadas a serviços já provados (`PricingService.calculate`
puro desde a Fase 1, `average-cost.ts`/`stock-item-average-cost.ts` provados na Fase 9/10,
`RolesGuard` provado nas Fases 4-8) e monta um `PricingInput` já validado por tipo. É o mesmo
shape de "serviço de aplicação que traduz ids para o tipo puro que outra fase já testou" que
`toPricingPrinterInput` (Fase 7) já é, só que buscando de quatro fontes em vez de uma.

Os valores esperados vêm do `plan.md` (`## Criteria`) e ficam escritos **literalmente** nas
asserções, nunca derivados chamando o próprio código em teste.

**Placement resolvido aqui** (não é um door, é formato de mensagem): o AC 4 do plano pede que o
`404` cite qual id falhou. As constantes existentes (`MATERIAL_NOT_FOUND` em `inventory.types.ts`,
`PRINTER_NOT_FOUND` em `printers.types.ts`, `STOCK_ITEM_NOT_FOUND` em `inventory.types.ts`,
`CHANNEL_NOT_FOUND` em `settings.types.ts`) são todas mensagens fixas sem interpolação, e nenhum
módulo hoje inclui o id na mensagem de erro. `QuotePreviewService` lança uma mensagem própria por
entidade, interpolando o id, sem alterar as constantes existentes (que continuam servindo seus
módulos originais sem o id): `` `Material ${id} não encontrado` ``, `` `Impressora ${id} não
encontrada` ``, `` `Insumo ${id} não encontrado` ``, `` `Canal ${id} não encontrado` ``. Isso é
placement porque é reversível e não é consumido por nenhum outro código.

O e2e (`npm --prefix api run test:e2e`) ganha um arquivo novo `pricing-quote-preview.e2e-spec.ts`
com um helper próprio de seed (reaproveitando `createMaterial`, `createPrinter`, `createRoll`,
`createStockItem`, `createItemMovement`, `createSalesChannel`, `resetSettings` dos helpers já
existentes das Fases 6, 7, 9, 10 e 5 - nenhum helper novo). `QuotePreviewService` ganha um spec
Vitest isolado com os quatro serviços dependentes mockados (`InventoryService`, `PrintersService`,
`SettingsService`, `SalesChannelsService` - mesmo nível de `pricing.controller.spec.ts`, que já
usa um `PricingService` fake em vez de instanciar de verdade). No web, uma tela nova `/pricing`
com Vitest + Testing Library e `fetch` substituído, como em `materials/page.test.tsx`; a lista
dinâmica de filamentos reaproveita o padrão já escrito em `print-profile-import.tsx` (Fase 2), sem
duplicar o componente - o `PrintProfileImport` é usado dentro da tela, não reescrito.

## Checks

### S1 - `POST /pricing/quote-preview` · 7 files · 22 KB · ~6k

**C1** - Com um material (2 rolos, 1000 g a R$ 100,00 e 1000 g a R$ 120,00 -> custo médio 11
centavos/g, mesmo caso de referência de C8 da Fase 9), uma impressora e um canal cadastrados,
`POST /pricing/quote-preview` responde `200` com `costs.materialCents` calculado a partir de
`11` centavos/g (não de um valor digitado), igual ao que `PricingService.calculate` devolveria
para o mesmo `PricingInput` resolvido manualmente no teste (AC 1)
Proof: `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "calculates using the material's current average cost per gram"`

**C2** - Com uma impressora e um canal cadastrados e um insumo com uma entrada de custo
(`unitCostCents: 500`), `POST /pricing/quote-preview` responde `200` com `costs.suppliesCents`
calculado a partir do custo médio do insumo (não de um valor digitado) (AC 1)
Proof: `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "calculates using the stock item's current average cost"`

**C3** - `POST /pricing/quote-preview` responde `200` com `channels` no mesmo shape de
`ChannelPrice` (Fase 1: `name`, `unitPriceCents`, `totalPriceCents`, `minimumPriceApplied`) para
dois `channelIds` cadastrados de uma vez (AC 1, reconfirma que o multi-canal do `pricing` puro
continua acessível pela rota nova)
Proof: `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "returns a channel price for each channelId requested"`

**C4** - Com um material cujos rolos estão todos descartados (`avgCostCentsPerGram: null`,
mesmo caso de C10 da Fase 9), `POST /pricing/quote-preview` responde `400` com
`{ "error": "Material sem custo médio disponível: <nome do material>" }`, citando o nome
cadastrado (AC 2)
Proof: `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "rejects a material with no average cost with its name in the message"`

**C5** - Com um insumo sem nenhuma movimentação de entrada (`avgCostCents: null`),
`POST /pricing/quote-preview` responde `400` com
`{ "error": "Insumo sem custo médio disponível: <nome do insumo>" }`, citando o nome cadastrado
(AC 3)
Proof: `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "rejects a stock item with no average cost with its name in the message"`

**C6** - Tabela sobre um `printerId`, um `materialId`, um `stockItemId` e um `channelId`
desconhecidos, cada um numa chamada isolada (4 casos): cada uma responde `404` com
`{ "error": "<Entidade> <id> não encontrad[o|a]" }`, citando o id enviado na mensagem (AC 4)
Proof: `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "returns 404 with the id in the message for an unknown printer, material, stock item or channel"`

**C7** - Com os parâmetros resolvidos formando `marginRate + taxRate + channel.feeRate >= 1`
para um canal cadastrado, `POST /pricing/quote-preview` responde `400` com a mesma mensagem
literal de `PricingError` que `POST /pricing/calculate` já devolve para o mesmo caso
(`` `Channel "<nome>": margin + taxes + fee must be below 100%` ``, AD-008) (AC 5)
Proof: `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "surfaces the same PricingError message as /pricing/calculate for a channel at or above 100%"`

**C8** - `POST /pricing/quote-preview` bem-sucedido responde `200` com, junto de `costs` e
`channels`, um `printer: { id, name }`, um `materials: [{ materialId, name,
avgCostCentsPerGram }]` por material enviado, um `supplies: [{ stockItemId, name, avgCostCents }]`
por insumo enviado, e um `channels: [{ id, name }]` por canal enviado, cada nome igual ao
cadastrado (AC 6)
Proof: `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "echoes the resolved names of every material, supply, printer and channel used"`

**C9** - Tabela sobre sessão de `production` e de `sales` chamando `POST /pricing/quote-preview`
com o mesmo corpo válido de C1 (2 casos): cada uma responde `200`, igual a `admin` (AC 7, mesma
política de `POST /pricing/calculate`)
Proof: `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "production and sales get 200 like admin"`

**C10** - `POST /pricing/quote-preview` sem cookie de sessão responde `401` (AD-015, guard global
já provado na Fase 3 - aqui só confirma que a rota está sob o guard)
Proof: `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "is 401 without a session"`

**C11** - Tabela sobre `materials: []` (lista vazia) e `channelIds: []` (lista vazia) em
`POST /pricing/quote-preview` (2 casos): cada uma responde `400` (o `pricing` puro exige ao
menos 1 material e ao menos 1 canal, `ArrayMinSize(1)` da Fase 1 - aqui confirma que o novo DTO
propaga a mesma regra em vez de aceitar uma lista vazia e deixar o `pricing` puro quebrar depois)
Proof: `npm --prefix api run test:e2e -- test/pricing-quote-preview.e2e-spec.ts -t "rejects an empty materials or channelIds list"`

**C12** - `QuotePreviewService.preview`, com `InventoryService`, `PrintersService`,
`SettingsService` e `SalesChannelsService` mockados devolvendo dados válidos, monta um
`PricingInput` cujo `materials[].costPerGramCents`, `printer` e `channels[].feeRate` vêm
exatamente dos mocks (não de um valor hardcoded no serviço), e o resultado bate com uma chamada
direta a `new PricingService().calculate(...)` com o mesmo `PricingInput` montado à mão no teste
(AC 1, nível do próprio arquivo)
Proof: `npm --prefix api run test -- src/modules/pricing/quote-preview.service.spec.ts -t "builds a PricingInput from the resolved fixtures and matches a direct PricingService.calculate call"`

### S2 - Web - tela `/pricing` · 5 files · 20 KB · ~6k

**C13** - A tela `/pricing` mostra "Carregando…" antes dos `GET /materials`, `GET /printers`,
`GET /inventory/items` e `GET /settings/sales-channels` (mocks) resolverem (AC 12)
Proof: `npm --prefix web run test -- 'src/app/(app)/pricing/page.test.tsx' -t "shows loading"`

**C14** - Com `GET /materials` (mock) resolvendo uma lista vazia, o seletor de material da tela
`/pricing` mostra um estado vazio orientando a cadastrar antes de calcular, em vez de um
`<select>` sem opções (AC 15)
Proof: `npm --prefix web run test -- 'src/app/(app)/pricing/page.test.tsx' -t "shows an empty state on the material selector when none are registered"`

**C15** - Colar a URL de exemplo do fixture da Fase 2 (`design-3007827`, mock de
`POST /print-profiles/import`) na tela `/pricing` preenche o tempo de impressão e a lista de
filamentos como a Fase 2 já faz, e cada linha de filamento ganha um seletor de `Material`
cadastrado ao lado (AC 8)
Proof: `npm --prefix web run test -- 'src/app/(app)/pricing/page.test.tsx' -t "imports filaments from a MakerWorld URL and adds a material selector per filament"`

**C16** - Sem colar nenhuma URL, a tela `/pricing` permite adicionar uma linha de material e uma
linha de insumo manualmente, cada uma com um seletor do cadastro (nenhum campo de custo digitável
na tela) (AC 9)
Proof: `npm --prefix web run test -- 'src/app/(app)/pricing/page.test.tsx' -t "adds a material or supply line manually with a registry selector, never a free-text cost field"`

**C17** - Selecionar uma impressora cadastrada no seletor da tela `/pricing` usa o `id` dela como
`printerId` na chamada a `POST /pricing/quote-preview` (mock), nunca um nome digitado (AC 10)
Proof: `npm --prefix web run test -- 'src/app/(app)/pricing/page.test.tsx' -t "sends the selected printer's id, never a typed name"`

**C18** - Preencher impressora, um material, quantidade e um canal e clicar em "Calcular" chama
`POST /pricing/quote-preview` (mock) e exibe o custo por componente e o preço de cada canal
devolvido; enquanto a chamada está pendente, o botão "Calcular" fica desabilitado e um indicador
de carregamento aparece (AC 11, AC 12)
Proof: `npm --prefix web run test -- 'src/app/(app)/pricing/page.test.tsx' -t "calculates and shows the breakdown, disabling the button while pending"`

**C19** - Com `POST /pricing/quote-preview` (mock) rejeitando com `400`, a tela `/pricing` mostra
a mensagem de erro (`role="alert"`) sem apagar o formulário preenchido; mudar a quantidade e
calcular de novo refaz a chamada sem perder o restante do formulário (AC 13, AC 14)
Proof: `npm --prefix web run test -- 'src/app/(app)/pricing/page.test.tsx' -t "shows the error without clearing the form and allows recalculating after changing quantity"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /pricing/quote-preview` statuses (4) | 200 C1, C2, C3, C8, C9 · 400 C4, C5, C7, C11 · 401 C10 · 404 C6 | - |
| custo médio ausente, por entidade (2) | material C4 · insumo C5 | - |
| entidade desconhecida no corpo, por tipo (4) | `printerId` C6 · `materialId` C6 · `stockItemId` C6 · `channelId` C6 | - |
| nomes resolvidos ecoados na resposta (4) | `printer` C8 · `materials[]` C8 · `supplies[]` C8 · `channels[]` C8 | - |
| papéis que chamam a rota, lado positivo (3) | `admin` C1 · `production` C9 · `sales` C9 | - |
| listas mínimas do `pricing` puro propagadas pelo novo DTO (2) | `materials` vazio C11 · `channelIds` vazio C11 | - |
| estados da tela `/pricing` (3) | carregando C13 · erro C19 · vazio (seletor de material) C14 | - |
| seletores da tela `/pricing` usam id do cadastro, nunca texto livre (1) | impressora C17 | - |
| composição manual vs. importada dos filamentos/insumos (2) | importada da URL C15 · manual C16 | - |

- Claims que citam um código de status, rota ou formato de resposta: C1-C11 - cada uma tem uma
  prova que cruza a fronteira HTTP (e2e real contra o `AppModule`)
- Nenhuma claim afirma mais do que os casos que a prova exercita

## Swept

- validation: C11 - listas mínimas do `pricing` puro (`materials`, `channelIds`) propagadas pelo
  novo DTO em vez de deixar o erro vazar do `pricing` puro sem contexto do novo contrato
- failure modes: C4, C5, C6, C7 - custo médio ausente, entidade inexistente e regra de domínio do
  `pricing` puro, cada um com o código e a mensagem certos
- idempotency, retry, duplicates: n/a - a rota não persiste nada; chamar duas vezes com o mesmo
  corpo sempre recalcula do zero e nunca duplica um registro, porque não existe registro
- authorization: C9, C10 (existing - mesmo `RolesGuard` global das Fases 3-4, aqui só confirma o
  registro da rota nova sob o guard, mesma forma de C23 da Fase 9)
- concurrency and ordering: n/a - o serviço não escreve estado nenhum; duas chamadas simultâneas
  são duas leituras independentes, sem corrida possível (diferente da Fase 9, que decrementa saldo)
- data lifecycle: n/a - nada é persistido por esta fase; não há TTL, archival nem backfill
- external-dependency failure: n/a - `QuotePreviewService` só lê o próprio banco via os serviços
  existentes; a única dependência externa do fluxo (MakerWorld) já é tratada pela Fase 2 e não é
  tocada aqui
- state transitions: n/a - não há máquina de estados nesta fase; a rota é uma leitura pura
- observability: n/a - mesma decisão das fases anteriores de `pricing`/`inventory`: nenhum AC
  exige uma linha de log específica

## Out of scope

`plan.md` já carrega `## Out of scope`; nada adicional surgiu na derivação dos checks.

## Handoff

Novos (API): `dto/create-quote-preview.dto.ts` (com `QuoteMaterialDto`, `QuoteSupplyDto`
aninhados, seguindo o padrão de `@ValidateNested({ each: true })` + `@Type()` de
`calculate-pricing.dto.ts`), `quote-preview.service.ts` + `quote-preview.service.spec.ts`,
`quote-preview.types.ts` (shape da resposta estendida), rota nova em `pricing.controller.ts`
(sem controller novo - mesmo módulo `pricing`); `test/pricing-quote-preview.e2e-spec.ts` ≈ 34 KB.
Existente tocado: `pricing.module.ts` (registra as dependências de `InventoryModule`,
`PrintersModule`, `SettingsModule` como imports), `ROADMAP.md` (marca a Fase 12 como concluída)
≈ 2 KB. Web novos: `app/(app)/pricing/page.tsx` + `page.test.tsx` (reaproveita
`PrintProfileImport` e os seletores do padrão `EntityForm` onde fizer sentido), `lib/pricing.ts`
(tipos espelhando `quote-preview.types.ts`) ≈ 26 KB. Web existente tocado: `app-shell.tsx` + teste
(item de menu "Calculadora") ≈ 1 KB.

- Total ≈ 63 KB ≈ 16k tokens. Abaixo do orçamento padrão de 150k: um builder só, sem pergunta
- Validação final com o Playwright MCP (`AGENTS.md`): como `admin`, importar a URL de exemplo do
  MakerWorld, mapear os filamentos para materiais cadastrados, escolher impressora e canal,
  calcular e comparar com o valor manual; mudar o custo de um material (nova entrada de rolo) e
  recalcular vendo o preço mudar sem nenhuma ação manual; como `production` e `sales`, confirmar
  que a tela calcula normalmente; estados de carregamento, erro e vazio dos seletores
