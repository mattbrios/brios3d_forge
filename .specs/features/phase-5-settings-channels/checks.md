# Fase 5 — Configurações globais e canais de venda · checks

Profile: standard
Plan: `.specs/features/phase-5-settings-channels/plan.md`

## Intent

35 checks em 5 fatias · 3 one-way doors · nenhuma questão aberta

O `AGENTS.md` não declara perfil. Uso `standard`, o mesmo das Fases 1-4: esta fase decide quem
lê e quem edita cada rota (mesmo `RolesGuard` da Fase 4, reaplicado a rotas novas) e tem duas
regras de fronteira fáceis de errar por um `<=`/`<` trocado - a soma `margem + imposto + taxa >= 1`
(igual em espírito ao `IsBelowOne` da Fase 1) e a substituição total de `fixedCostItems` dentro de
uma transação. Um `light` prova o caminho feliz de cada uma; um `standard` injeta a falha no
operador de comparação e no isolamento da transação e confere que o teste morre.

Os valores esperados vêm do `plan.md` (`## Criteria` e `## Landing`) e ficam escritos
**literalmente** nas asserções, nunca derivados chamando o próprio código em teste.

Os e2e (`npm --prefix api run test:e2e`) montam o `AppModule` contra o `forge_test`, com o `db` no
ar e as migrations aplicadas antes da suíte (padrão da Fase 0). Cada arquivo cria e apaga só os
canais/admins que precisa, como os arquivos das Fases 3-4 já fazem (`auth-helper.ts`). No web,
Vitest + Testing Library com o `fetch` substituído, como em `users/page.test.tsx`.

## Checks

### S1 - Leitura de configurações e canais por qualquer papel · 4 files · 14 KB · ~5k

**C1** - `GET /settings` com sessão de `admin`, `production` e `sales` responde `200` para os três,
com o corpo tendo exatamente as chaves `energyTariffCentsPerKwh`, `laborCentsPerHour`,
`defaultMarginRate`, `failureRate`, `purgeRate`, `maintenanceCentsPerHour`,
`productiveHoursPerMonth`, `fixedCostItems` (AC 1)
Proof: `npm --prefix api run test:e2e -- test/settings.e2e-spec.ts -t "GET /settings returns the configured fields for every role"`

**C2** - `GET /settings` sem cookie de sessão responde `401` com a mensagem de sessão da Fase 3
(AC 2)
Proof: `npm --prefix api run test:e2e -- test/settings.e2e-spec.ts -t "GET /settings without a session is 401"`

**C3** - Com um canal desativado no banco, `GET /sales-channels` com sessão de `admin`,
`production` e `sales` responde `200` para os três com a lista completa, incluindo esse canal
inativo (`active: false`) (AC 3)
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "GET /sales-channels lists every channel for every role, including inactive"`

**C4** - `GET /sales-channels` sem cookie de sessão responde `401` (AC 4)
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "GET /sales-channels without a session is 401"`

**C5** - Contra um banco recém-migrado (sem nenhum PATCH aplicado ainda), `GET /settings` responde
`{ energyTariffCentsPerKwh: 0, laborCentsPerHour: 0, defaultMarginRate: 0, failureRate: 0,
purgeRate: 0, maintenanceCentsPerHour: 0, productiveHoursPerMonth: 1, fixedCostItems: [] }` e
`GET /sales-channels` responde exatamente 5 canais - `Balcão`, `Instagram/WhatsApp`,
`Mercado Livre`, `Shopee`, `Loja própria` - cada um com `taxRate: 0`, `feeRate: 0`, `active: true`
(AC 5, door 1)
Proof: `npm --prefix api run test:e2e -- test/settings.e2e-spec.ts -t "the migration seeds the singleton settings row with defaults"`
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "the migration seeds exactly the 5 CONTEXT channels"`

### S2 - Edição das configurações globais, só admin · 5 files · 20 KB · ~7k

**C6** - Um admin altera só `energyTariffCentsPerKwh` via `PATCH /settings`: responde `200` com
esse campo novo e todos os outros iguais ao `GET` anterior; num segundo PATCH, altera só
`laborCentsPerHour` e confere que `energyTariffCentsPerKwh` (do PATCH anterior) permanece (AC 6)
Proof: `npm --prefix api run test:e2e -- test/settings.e2e-spec.ts -t "PATCH persists only the sent fields"`

**C7** - `PATCH /settings` chamado por `production` e por `sales` responde `403` para os dois, e o
`GET /settings` seguinte mostra que nada mudou (AC 7)
Proof: `npm --prefix api run test:e2e -- test/settings.e2e-spec.ts -t "non-admin roles get 403 on PATCH /settings"`

**C8** - `PATCH /settings` sem cookie de sessão responde `401` (AC 8)
Proof: `npm --prefix api run test:e2e -- test/settings.e2e-spec.ts -t "PATCH /settings without a session is 401"`

**C9** - Tabela sobre `defaultMarginRate`, `failureRate`, `purgeRate`: `-0.1`, `1` e `1.1` em cada
um dos três campos (9 casos) respondem `400`, e o `GET /settings` seguinte confirma que nenhum
valor mudou (AC 9)
Proof: `npm --prefix api run test:e2e -- test/settings.e2e-spec.ts -t "rejects out-of-range percentage fields"`

**C10** - Tabela sobre `energyTariffCentsPerKwh: -1`, `laborCentsPerHour: -1`,
`maintenanceCentsPerHour: -1` e `productiveHoursPerMonth: 0` (4 casos) respondem `400`, e o
`GET /settings` seguinte confirma que nenhum valor mudou (AC 10)
Proof: `npm --prefix api run test:e2e -- test/settings.e2e-spec.ts -t "rejects invalid money and hour fields"`

**C11** - `PATCH /settings` com corpo `{}` responde
`400 { "error": "Informe ao menos um campo para alterar" }` (AC 11)
Proof: `npm --prefix api run test:e2e -- test/settings.e2e-spec.ts -t "empty patch body is 400"`

**C12** - Com dois `fixedCostItems` já gravados (`Aluguel` 50000, `Internet` 10000), um
`PATCH /settings` enviando `fixedCostItems: [{ name: "Software", monthlyCents: 8000 }]` responde
`200` com só esse item; a consulta direta à tabela `fixed_cost_items` mostra 1 linha, com um `id`
diferente dos dois itens antigos (prova de que a substituição é atômica, não um merge) (AC 12,
door 2)
Proof: `npm --prefix api run test:e2e -- test/settings.e2e-spec.ts -t "PATCH replaces fixedCostItems wholesale"`

**C13** - Um `PATCH /settings` que envia `energyTariffCentsPerKwh: 500` válido **e**
`fixedCostItems` com um item inválido (nome vazio, nome de 61 caracteres, ou `monthlyCents: -1` -
3 casos) responde `400` para os três, e o `GET /settings` seguinte confirma que nem
`energyTariffCentsPerKwh` nem `fixedCostItems` mudaram (prova de que a rejeição é do PATCH
inteiro, não só do item) (AC 13)
Proof: `npm --prefix api run test:e2e -- test/settings.e2e-spec.ts -t "an invalid fixedCostItems entry rejects the whole PATCH"`

### S3 - Gestão dos canais de venda, só admin · 6 files · 24 KB · ~9k

**C14** - `POST /sales-channels` por um admin com `{ name: "Loja física 2", taxRate: 0.06,
feeRate: 0.02 }` (margem padrão em `0` neste teste) responde `201` com `active: true` e um `id`
novo (AC 14)
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "creates a channel with active true"`

**C15** - Com `defaultMarginRate` ajustada para `0.5` via `PATCH /settings`,
`POST /sales-channels` com `taxRate: 0.3, feeRate: 0.2` (soma exata `1`) e com
`taxRate: 0.3, feeRate: 0.21` (soma `1.01`) respondem `400` para os dois, e nenhum canal é criado
(AC 15)
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "rejects a channel whose combined rate reaches 100%"`

**C16** - Com um canal `"Loja física 2"` já criado, `POST /sales-channels` com
`name: "  Loja física 2  "` (mesmo nome após `trim()`) responde `409` (AC 16)
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "duplicate channel name is 409"`

**C17** - `POST /sales-channels` chamado por `production` e por `sales` responde `403` para os
dois (AC 17)
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "non-admin roles get 403 on POST /sales-channels"`

**C18** - `POST /sales-channels` sem cookie de sessão responde `401` (AC 18)
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "POST /sales-channels without a session is 401"`

**C19** - `PATCH /sales-channels/:id` de um admin alterando só `taxRate` responde `200` mantendo
`name`/`feeRate`/`active`; um segundo PATCH enviando só `active: false` responde `200` com
`active: false` e todo o resto igual (AC 19)
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "PATCH persists only the sent fields, including toggling active"`

**C20** - `PATCH /sales-channels/:id` sem cookie de sessão responde `401` (AC 20)
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "PATCH /sales-channels/:id without a session is 401"`

**C21** - Com dois canais (`"Balcão"` e `"Shopee"`), `PATCH` no canal `"Shopee"` com
`{ name: "  Balcão  " }` responde `409`, e o `GET /sales-channels` seguinte mostra os dois nomes
originais intactos (AC 21)
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "renaming to a duplicate name is 409"`

**C22** - Com `defaultMarginRate` em `0.5` e um canal com `taxRate: 0.2, feeRate: 0.2` (soma
`0.9`), `PATCH` enviando só `feeRate: 0.31` (a soma final vira `1.01` usando o `taxRate` antigo)
responde `400`, e o `GET` seguinte mostra `feeRate` inalterado (AC 22)
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "PATCH validates the combined rate using the final values"`

**C23** - `PATCH /sales-channels/:id` chamado por `production` e por `sales` responde `403` para
os dois (AC 23)
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "non-admin roles get 403 on PATCH /sales-channels/:id"`

**C24** - `PATCH /sales-channels/00000000-0000-0000-0000-000000000000` (uuid válido, inexistente)
responde `404` (AC 24)
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "PATCH with an unknown id is 404"`

**C25** - `PATCH /sales-channels/nao-e-uuid` responde `400` (AC 25)
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "PATCH with a non-uuid id is 400"`

**C26** - 10 chamadas `POST /sales-channels` simultâneas com o mesmo `name` respondem uma vez
`201` e nove vezes `409`; a tabela `sales_channels` tem exatamente 1 linha com esse nome (mesmo
padrão do teste de criação simultânea de `users`, Fase 4) (AC 26, door 3)
Proof: `npm --prefix api run test:e2e -- test/sales-channels.e2e-spec.ts -t "concurrent creation with the same name creates one channel"`

### S4 - Tela de configurações · 4 files · 13 KB · ~4k

**C27** - A tela `/settings` mostra "Carregando…" antes do `GET /settings` (mock) resolver
(AC 27)
Proof: `npm --prefix web run test -- src/app/(app)/settings/page.test.tsx -t "shows loading"`

**C28** - Com o `GET /settings` (mock) rejeitando, a tela mostra a mensagem de erro e um botão
"Tentar novamente" que refaz a chamada (AC 28)
Proof: `npm --prefix web run test -- src/app/(app)/settings/page.test.tsx -t "shows the error and retries"`

**C29** - Como `admin`, a tela mostra um formulário editável; alterar `energyTariffCentsPerKwh` e
salvar chama `PATCH /settings` (mock) e atualiza o valor exibido sem recarregar a página (AC 29)
Proof: `npm --prefix web run test -- src/app/(app)/settings/page.test.tsx -t "admin edits and saves without reloading"`

**C30** - Como `sales` (ou `production`), a tela mostra os mesmos valores do `GET /settings`
(mock) sem nenhum `<input>` nem botão "Salvar" (AC 30)
Proof: `npm --prefix web run test -- src/app/(app)/settings/page.test.tsx -t "non-admin sees read-only values"`

### S5 - Tela de canais de venda e menu · 5 files · 15 KB · ~5k

**C31** - A tela `/sales-channels` lista os canais do `GET /sales-channels` (mock) com nome, %
imposto, % taxa e situação (ativo/inativo) por linha (AC 31)
Proof: `npm --prefix web run test -- src/app/(app)/sales-channels/page.test.tsx -t "lists channels with name, rates and status"`

**C32** - Com o `GET /sales-channels` (mock) rejeitando, a tela mostra a mensagem de erro e um
botão "Tentar novamente" (AC 32)
Proof: `npm --prefix web run test -- src/app/(app)/sales-channels/page.test.tsx -t "shows the error and retries"`

**C33** - Como `admin`, a tela mostra um formulário de criação e, por linha, controles de
editar/ativar/desativar; criar um canal (mock `POST`) adiciona a linha, e desativar um canal
(mock `PATCH`) atualiza a situação, os dois sem recarregar a página (AC 33)
Proof: `npm --prefix web run test -- src/app/(app)/sales-channels/page.test.tsx -t "admin creates and toggles a channel without reloading"`

**C34** - Como `sales` (ou `production`), a tela mostra a lista sem formulário de criação nem
botões de editar/ativar/desativar (AC 34)
Proof: `npm --prefix web run test -- src/app/(app)/sales-channels/page.test.tsx -t "non-admin sees the list without edit controls"`

**C35** - `AppShell` com `role="admin"` mostra "Configurações" e "Canais de venda" no menu, nessa
ordem junto dos itens já existentes; com `role="production"` ou `role="sales"` nenhum dos dois
aparece (AC 35)
Proof: `npm --prefix web run test -- src/components/app-shell.test.tsx -t "admin sees every menu item in order"`
Proof: `npm --prefix web run test -- src/components/app-shell.test.tsx -t "production and sales do not see settings or sales channels"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /settings` statuses (2) | 200 C1 · 401 C2 | - |
| `PATCH /settings` statuses (4) | 200 C6 · 400 C9, C10, C11, C13 · 401 C8 · 403 C7 | - |
| `GET /sales-channels` statuses (2) | 200 C3 · 401 C4 | - |
| `POST /sales-channels` statuses (5) | 201 C14 · 400 C15 · 401 C18 · 403 C17 · 409 C16 | - |
| `PATCH /sales-channels/:id` statuses (6) | 200 C19 · 400 C22, C25 · 401 C20 · 403 C23 · 404 C24 · 409 C21 | - |
| doors do plano (3) | 1 linha única de `Settings` C1, C5, C6 · 2 `fixedCostItems` sem CRUD dedicado C12, C13 · 3 `sales_channels.name` único C16, C21, C26 | - |
| papéis que leem (3) | `admin` C1, C3 · `production` C1, C3 · `sales` C1, C3 | - |
| papéis barrados na escrita (6) | `PATCH /settings` × `production` C7 · `PATCH /settings` × `sales` C7 · `POST /sales-channels` × `production` C17 · `POST /sales-channels` × `sales` C17 · `PATCH /sales-channels/:id` × `production` C23 · `PATCH /sales-channels/:id` × `sales` C23 | - |
| bordas de percentual em `Settings` (9) | `defaultMarginRate` × `-0.1` C9 · `defaultMarginRate` × `1` C9 · `defaultMarginRate` × `1.1` C9 · `failureRate` × `-0.1` C9 · `failureRate` × `1` C9 · `failureRate` × `1.1` C9 · `purgeRate` × `-0.1` C9 · `purgeRate` × `1` C9 · `purgeRate` × `1.1` C9 | - |
| campos de dinheiro/hora inválidos em `Settings` (4) | `energyTariffCentsPerKwh` C10 · `laborCentsPerHour` C10 · `maintenanceCentsPerHour` C10 · `productiveHoursPerMonth` C10 | - |
| itens inválidos de `fixedCostItems` (3) | nome vazio C13 · nome de 61 chars C13 · `monthlyCents` negativo C13 | - |
| fronteira soma margem+imposto+taxa (2 rotas) | `POST /sales-channels` C15 · `PATCH /sales-channels/:id` (valor final) C22 | - |
| seed da migration (2) | `Settings` única C5 · 5 `SalesChannel` nomeados C5 | - |
| estados de tela (4) | `/settings` carregando C27 · `/settings` erro C28 · `/sales-channels` carregando C31 · `/sales-channels` erro C32 | - |
| UI por papel (4) | `/settings` admin edita C29 · `/settings` não-admin só leitura C30 · `/sales-channels` admin edita C33 · `/sales-channels` não-admin só leitura C34 | - |
| itens novos do menu (2) | "Configurações" C35 · "Canais de venda" C35 | - |

- Claims que citam um código de status, rota ou formato de resposta: C1 a C26 - cada uma tem uma
  prova que cruza a fronteira HTTP (e2e real contra o `AppModule`)
- Nenhuma claim afirma mais do que o único caso que a prova exercita

## Test policy

O repo já decide, desde a Fase 4, onde prova um guard de autorização e uma regra de fronteira:
rota para o contrato HTTP (e2e), unidade só quando o ramo é invisível na rota. Nada nesta fase
tem um ramo invisível na rota - inclusive a fronteira `margem + imposto + taxa >= 1` e a
substituição transacional de `fixedCostItems` respondem no próprio corpo/status HTTP - então sigo
a mesma divisão sem introduzir uma camada de unidade nova.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| `SettingsController`/`SalesChannelsController` - `RolesGuard` aplicado (decide, alcançado pela rota, mesma forma da Fase 4) | um e2e por combinação rota × papel | as 5 rotas × os 3 papéis onde aplicável (C1-C4, C7, C8, C14-C26) |
| `SettingsService` - fronteira de percentuais e de dinheiro/hora (decide, sem estado entre requisições) | e2e tabela-driven por grupo de campo | os 3 campos de percentual e os 4 de dinheiro/hora, nas bordas (C9, C10) |
| `SettingsService` - substituição de `fixedCostItems` (decide, com transação) | um e2e para a substituição bem-sucedida, um para a rejeição atômica | remove-e-grava-os-novos (C12); PATCH inteiro rejeitado por um item inválido (C13) |
| `SalesChannelsService` - fronteira margem+imposto+taxa (decide, lê `Settings` fora do próprio corpo da requisição) | um e2e no `POST`, um no `PATCH` usando o valor final combinado | soma exata `1` e soma `> 1`, nos dois verbos (C15, C22) |
| DTOs de `settings` e `sales-channels` (validação, sem lógica própria) | e2e tabela-driven por DTO | cada regra do `class-validator`, incluindo as bordas (C9, C10, C13) |
| componentes de tela (`/settings`, `/sales-channels`, menu) | um teste com Testing Library por componente | cada estado como membro (C27-C35) |

Evidence:

- `sales-channels.service.ts` (novo): decide sobre a soma de 3 valores (`defaultMarginRate` lido
  de `Settings`, `taxRate`, `feeRate`) contra o limite `1` -> mesma forma decisória do
  `IsBelowOne` da Fase 1 (`pricing/dto/is-below-one.decorator.ts`), mas cruzando duas tabelas, por
  isso provado na rota (e2e) e não como decorator isolado
- `settings.service.ts` (novo): substituição de `fixedCostItems` numa transação -> mesma forma da
  transação com `FOR UPDATE` da Fase 4 (`users.service.ts`, regra do último admin), provada só no
  e2e porque a regra não existe fora da rota
- `roles.guard.ts` da Fase 4 não muda; as rotas novas só reaplicam o decorator existente, então
  não repito a prova unitária do guard em si (já coberta por `roles.guard.spec.ts`)

Cost: 2 arquivos e2e novos (`settings.e2e-spec.ts`, `sales-channels.e2e-spec.ts`), 2 páginas web
novas com teste, 1 arquivo de teste existente estendido (`app-shell.test.tsx`). Sem C13, uma
implementação que grava os campos válidos do PATCH antes de validar `fixedCostItems` passaria
pelo caminho feliz e só falharia num PATCH que só contém `fixedCostItems`.

## Swept

- validation: C9, C10, C11, C13 - bordas de percentual, de dinheiro/hora, corpo vazio e itens de
  `fixedCostItems`
- failure modes: C9, C10, C13 - toda rejeição responde `400 { error }` sem persistir nada, nem
  os campos válidos do mesmo PATCH
- idempotency: C16, C21, C26 - nome de canal duplicado nunca cria uma segunda linha, seja
  sequencial (C16, C21) ou simultâneo (C26)
- authorization: C2, C4, C7, C8, C17, C18, C20, C23 - sessão e papel nas 5 rotas
- concurrency: C26 (criação simultânea de canal com o mesmo nome). `PATCH /settings` não tem
  prova de concorrência - a Assumption do plano decide não usar lock otimista ali (última escrita
  vence), então não há uma regra observável para provar além do que C6 já cobre
- data lifecycle: C12 - `fixedCostItems` antigos são apagados e substituídos na mesma transação
- dependency failure: n/a - o módulo `settings` não chama nenhum serviço externo (diferente da
  Fase 2)
- state transitions: C19 - canal ativo -> inativo -> (implicitamente reversível, mesmo padrão de
  `users`)
- observability: n/a - mesma decisão da Fase 4: nenhum AC desta fase exige uma linha de log
  específica

## Handoff

Arquivos existentes tocados: `app.module.ts` (registra `SettingsModule`), `app-shell.tsx` + teste
(dois itens de menu) ≈ 3 KB reais de diferença. Novos: `settings.module.ts`,
`settings.controller.ts`, `settings.service.ts`, `settings.types.ts`,
`entities/settings.entity.ts`, `entities/fixed-cost-item.entity.ts`,
`entities/sales-channel.entity.ts`, `dto/update-settings.dto.ts`,
`sales-channels.controller.ts`, `sales-channels.service.ts`,
`dto/create-sales-channel.dto.ts`, `dto/update-sales-channel.dto.ts`, 1 migration nova
(`CreateSettingsAndSalesChannels.ts`, com o seed), 2 e2e novos (`settings.e2e-spec.ts`,
`sales-channels.e2e-spec.ts`), `web/src/lib/settings.ts`, `web/src/lib/sales-channels.ts`, páginas
`/settings` e `/sales-channels` com testes ≈ 75 KB.

- S1-S5 ≈ 3 KB + ~75 KB novos ≈ 78 KB ≈ 20k tokens: S1-S3 na API, S4-S5 no web. Abaixo do
  orçamento padrão de 150k: um builder só, sem pergunta
- Validação final com o Playwright MCP (`AGENTS.md`): entrar como admin, abrir `/settings`,
  alterar a tarifa de energia e salvar; abrir `/sales-channels`, criar um canal, editar a taxa
  dele e desativá-lo; entrar como `sales`, confirmar que as duas telas ficam só leitura e que
  "Configurações" e "Canais de venda" não aparecem no menu

<Preenchido pelo builder ao final:>

- **Boundary:**
- **Settled mid-build:**
- **Abandoned:**
