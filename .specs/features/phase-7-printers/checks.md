# Fase 7 — Impressoras · checks

Profile: standard
Plan: `.specs/features/phase-7-printers/plan.md`

## Intent

41 checks em 7 fatias · 3 one-way doors · nenhuma questão aberta

O `AGENTS.md` não declara perfil. Uso `standard`, mesma régua das Fases 5 e 6: a maior parte desta
fase copia o padrão de CRUD já provado (Fase 6), mas duas formas são genuinamente novas e sem
analogê no repositório. Primeiro, `PATCH /printers/:id/hourmeter` libera escrita a `production` -
toda escrita anterior no sistema (Fases 3-6) é admin-only ou leitura para os demais papéis; nunca
um papel não-admin escreveu nada. Segundo, `toPricingPrinterInput` é a primeira função que liga um
cadastro ao contrato de `pricing.types.ts` (Fase 1) e a AC 32 faz uma afirmação de equivalência
entre dois cálculos - um `light` prova só que a função roda; um `standard` injeta a falha no ponto
exato de cada faixa nova (custo/vida útil/potência, bicos, `amsSlots`) e no mapeamento de campos, e
recomputa a junção de `Coverage` a partir das fontes, não do resumo do autor.

Os valores esperados vêm do `plan.md` (`## Criteria` e `## Landing`) e ficam escritos
**literalmente** nas asserções, nunca derivados chamando o próprio código em teste.

Os e2e (`npm --prefix api run test:e2e`) montam o `AppModule` contra o `forge_test`, com o `db` no
ar e as migrations aplicadas antes da suíte (padrão da Fase 0). O arquivo cria e apaga só as
impressoras/admins que precisa, como `materials.e2e-spec.ts` (Fase 6) já faz - um
`printers-helper.ts` novo espelha `materials-helper.ts`. A AC 32 pede explicitamente um teste
"sem chamada HTTP": `toPricingPrinterInput` e a equivalência com `PricingService.calculate()` vivem
num spec Vitest comum (`printers.types.spec.ts`), no mesmo nível de `pricing.service.spec.ts`. No
web, Vitest + Testing Library com o `fetch` substituído, como em `materials/page.test.tsx`; nenhum
componente de `crud/` é retestado aqui - `DataTable`/`EntityForm`/`ConfirmDialog` já têm seu
contrato genérico provado pela Fase 6 (C31-C33 daquele checks.md) e esta fase só consome o
existente.

## Checks

### S1 - Cadastrar impressora, só admin · 8 files · 20 KB · ~7k

**C1** - `POST /printers` com uma impressora completa sem AMS (`hasAms: false`, sem `amsSlots`,
sem `hourmeterHours`) e sessão de `admin` responde `201` com `id` de string não vazia,
`hourmeterHours: 0`, `amsSlots: null` e `active: true` (AC 1)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "creates a printer without AMS with hourmeterHours 0 and active true"`

**C2** - `POST /printers` com `hasAms: true` e `amsSlots: 4` responde `201` com `amsSlots: 4`
persistido (AC 1)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "creates a printer with AMS and persists amsSlots"`

**C3** - `POST /printers` com `hourmeterHours: 120.5` enviado responde `201` com
`hourmeterHours: 120.5` gravado, em vez do padrão `0` (AC 2)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "persists an explicit hourmeterHours instead of the default"`

**C4** - Tabela sobre `acquisitionCostCents: 0`, `lifespanHours` (`0` e `100001`) e `powerWatts`
(`0` e `5001`) em `POST /printers` (5 casos): cada um responde `400`, e nenhuma impressora é
persistida (AC 3)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "rejects out-of-range cost, lifespan and power fields"`

**C5** - `POST /printers` com `name` vazio e só espaços (2 casos) responde `400` para os dois, e
nenhuma impressora é persistida (AC 4)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "rejects an empty or blank name"`

**C6** - Tabela sobre `nozzles` com 0 itens, 11 itens, um item com `diameterMm: 0`, um item com
`diameterMm: 2.01` e um item com `type` vazio (5 casos) em `POST /printers`: cada um responde
`400`, e nenhuma impressora é persistida (AC 5)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "rejects an out-of-bounds nozzles list"`

**C7** - `POST /printers` com `hasAms: true` e `amsSlots` ausente, e com `amsSlots: 0` (2 casos)
responde `400` para os dois, e nenhuma impressora é persistida (AC 6)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "requires amsSlots when hasAms is true"`

**C8** - `POST /printers` com `hasAms: false` e `amsSlots: 4` enviado mesmo assim responde `201`
com `amsSlots: null` gravado (AC 7)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "ignores amsSlots when hasAms is false"`

**C9** - `POST /printers` com `hourmeterHours: -1` responde `400`, e nenhuma impressora é
persistida (AC 8)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "rejects a negative hourmeterHours on create"`

**C10** - `POST /printers` com sessão de `production` e de `sales` responde `403` para os dois, e
nada é persistido (AC 9)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "non-admin roles get 403 on POST /printers"`

**C11** - `POST /printers` sem cookie de sessão responde `401`, e nada é persistido (AC 10)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "POST /printers without a session is 401"`

### S2 - Listar impressoras com paginação, busca e filtro · 3 files · 10 KB · ~4k

**C12** - Com 3 impressoras semeadas, `GET /printers` sem parâmetros e sessão de `admin`,
`production` e `sales` responde `200` para os três com `{ items, total: 3, page: 1, pageSize: 20 }`
e `items` ordenado por `name` (AC 11)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "GET /printers returns the first page for every role, ordered by name"`

**C13** - Com impressoras `X2D`/`x2d carbon`/`P1S` semeadas, `GET /printers?search=X2D` responde
só com as duas cujo `name` contém `X2D` ignorando caixa (AC 12)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "searches by name ignoring case"`

**C14** - Com impressoras `hasAms: true` e `hasAms: false` semeadas, `GET /printers?hasAms=true`
responde só com as que têm `hasAms: true` (AC 13)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "filters by hasAms"`

**C15** - Com 15 impressoras semeadas (nomeadas para uma ordenação previsível), `GET
/printers?page=2&pageSize=10` responde com os 5 itens seguintes aos 10 primeiros da ordenação de
C12 e `total: 15` (AC 14)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "paginates with page and pageSize"`

**C16** - Tabela sobre `page=0`, `pageSize=0` e `pageSize=101` (3 casos): cada um responde `400`
(AC 15)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "rejects invalid page and pageSize"`

**C17** - `GET /printers` sem cookie de sessão responde `401` (AC 16)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "GET /printers without a session is 401"`

### S3 - Editar impressora, só admin · 4 files · 10 KB · ~4k

**C18** - `PATCH /printers/:id` alterando só `name` responde `200` com `name` novo e todos os
outros campos iguais à impressora antes do PATCH (AC 17)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "PATCH persists only the sent fields"`

**C19** - `PATCH /printers/:id` com um uuid que não existe responde `404` (AC 18)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "PATCH with an unknown id is 404"`

**C20** - Tabela sobre as mesmas 10 bordas do AC 3, AC 5 e AC 6 (custo, vida útil, potência,
contagem/diâmetro/tipo de bico, `amsSlots` obrigatório) em `PATCH /printers/:id`: cada uma responde
`400`, e o registro no banco continua com os valores anteriores (AC 19)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "rejects invalid fields on PATCH without changing the record"`

**C21** - `PATCH /printers/:id` com o corpo `{ "hourmeterHours": 500 }` responde `400`, e o
registro não muda (AC 20)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "rejects hourmeterHours on the general PATCH"`

**C22** - `PATCH /printers/:id` com sessão de `production` e de `sales` responde `403` para os
dois (AC 21)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "non-admin roles get 403 on PATCH /printers"`

**C23** - `PATCH /printers/:id` sem cookie de sessão responde `401` (AC 22)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "PATCH /printers without a session is 401"`

### S4 - Ativar e desativar impressora · 1 file · 2 KB · ~1k

**C24** - `PATCH /printers/:id` com `{ "active": false }` responde `200` com `active: false`, e a
impressora continua existindo no banco (AC 23)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "deactivates a printer without deleting it"`

**C25** - `PATCH /printers/:id` com `{ "active": true }` numa impressora antes desativada responde
`200` com `active: true` (AC 24)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "reactivates an inactive printer"`

**C26** - `DELETE /printers/:id` responde `404` (rota nunca declarada no controller) (AC 25)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "DELETE /printers/:id does not exist"`

### S5 - Ajustar horímetro manualmente · 3 files · 8 KB · ~3k

**C27** - Tabela sobre sessão de `admin` e de `production`: `PATCH /printers/:id/hourmeter` com
`{ "hourmeterHours": 120.5 }` numa impressora com `hourmeterHours: 0` responde `200` com
`hourmeterHours: 120.5` (valor absoluto, não somado) para os dois papéis (AC 26)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "admin and production set an absolute hourmeterHours"`

**C28** - Tabela sobre `{ "hourmeterHours": -1 }` e corpo sem `hourmeterHours` em `PATCH
/printers/:id/hourmeter` (2 casos): cada um responde `400`, e o registro não muda (AC 27)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "rejects a negative or missing hourmeterHours on adjustment"`

**C29** - `PATCH /printers/:id/hourmeter` com um uuid que não existe responde `404` (AC 28)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "hourmeter adjustment with an unknown id is 404"`

**C30** - `PATCH /printers/:id/hourmeter` com sessão de `sales` responde `403` (AC 29)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "sales gets 403 on the hourmeter adjustment"`

**C31** - `PATCH /printers/:id/hourmeter` sem cookie de sessão responde `401` (AC 30)
Proof: `npm --prefix api run test:e2e -- test/printers.e2e-spec.ts -t "hourmeter adjustment without a session is 401"`

### S6 - Impressora alimenta o cálculo de preço sem conversão manual · 2 files · 6 KB · ~2k

**C32** - `toPricingPrinterInput` aplicada a uma `Printer` com `powerWatts: 250`,
`acquisitionCostCents: 500000` e `lifespanHours: 10000` devolve exatamente
`{ powerWatts: 250, costCents: 500000, lifespanHours: 10000 }`, sem nenhum outro campo (AC 31)
Proof: `npm --prefix api run test -- src/modules/printers/printers.types.spec.ts -t "maps printer fields to PrinterInput without conversion"`

**C33** - Passar o resultado de `toPricingPrinterInput` para `PricingService.calculate()` dentro de
um `PricingInput` completo produz o mesmo `depreciationCents` e `energyCents` que chamar
`PricingService.calculate()` com um `PrinterInput` literal contendo os mesmos três valores (AC 32)
Proof: `npm --prefix api run test -- src/modules/printers/printers.types.spec.ts -t "produces the same pricing result as a manually typed PrinterInput"`

### S7 - Web - tela de impressoras no padrão de CRUD reutilizável · 4 files · 40 KB · ~13k

**C34** - A tela `/printers` mostra "Carregando…" antes do `GET /printers` (mock) resolver (AC 33)
Proof: `npm --prefix web run test -- src/app/(app)/printers/page.test.tsx -t "shows loading"`

**C35** - Com o `GET /printers` (mock) rejeitando, a tela mostra a mensagem de erro e um botão
"Tentar novamente" que refaz a chamada (AC 34)
Proof: `npm --prefix web run test -- src/app/(app)/printers/page.test.tsx -t "shows the error and retries"`

**C36** - Com o `GET /printers` (mock) resolvendo `{ items: [], total: 0, page: 1, pageSize: 20 }`,
a tela mostra um estado vazio com um texto diferente do estado de erro (AC 35)
Proof: `npm --prefix web run test -- src/app/(app)/printers/page.test.tsx -t "shows an empty state when there are no printers"`

**C37** - Como `sales`, a tela mostra a listagem sem formulário de criação, sem botões de
editar/ativar/desativar e sem o controle de ajustar horímetro (AC 36)
Proof: `npm --prefix web run test -- src/app/(app)/printers/page.test.tsx -t "sales sees only the read-only list"`

**C38** - Como `production`, a tela mostra só o controle de ajustar horímetro, sem formulário de
criação nem botões de editar/ativar/desativar (AC 37)
Proof: `npm --prefix web run test -- src/app/(app)/printers/page.test.tsx -t "production sees only the hourmeter control"`

**C39** - Como `admin`, clicar em "Desativar" numa linha abre o `ConfirmDialog`; cancelar não chama
a API, e confirmar chama `PATCH /printers/:id` (mock) com `{ active: false }` e atualiza a linha
(AC 38)
Proof: `npm --prefix web run test -- src/app/(app)/printers/page.test.tsx -t "confirms before deactivating"`

**C40** - Tabela sobre sessão de `admin` e de `production`: ajustar o horímetro pela tela chama
`PATCH /printers/:id/hourmeter` (mock `200`) e atualiza a linha correspondente sem recarregar a
página, para os dois papéis (AC 39)
Proof: `npm --prefix web run test -- src/app/(app)/printers/page.test.tsx -t "admin and production adjust the hourmeter without reloading"`

**C41** - `AppShell` com `role="admin"`, `role="production"` e `role="sales"` mostra "Impressoras"
no menu para os três, junto dos itens já existentes (AC 40)
Proof: `npm --prefix web run test -- src/components/app-shell.test.tsx -t "printers appears for every role"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /printers` statuses (3) | 200 C12 · 400 C16 · 401 C17 | - |
| `POST /printers` statuses (4) | 201 C1, C2, C3 · 400 C4, C5, C6, C7, C9 · 401 C11 · 403 C10 | - |
| `PATCH /printers/:id` statuses (5) | 200 C18, C24, C25 · 400 C20, C21 · 401 C23 · 403 C22 · 404 C19 | - |
| `PATCH /printers/:id/hourmeter` statuses (5) | 200 C27 · 400 C28 · 401 C31 · 403 C30 · 404 C29 | - |
| doors do plano (3) | 1 integração `toPricingPrinterInput` -> `PricingInput.printer` C32, C33 · 2 endpoint dedicado de horímetro C27, C28, C29, C30, C31 · 3 `production` ajusta horímetro C27, C30 | - |
| papéis que leem `GET /printers` (3) | `admin` C12 · `production` C12 · `sales` C12 | - |
| papéis barrados na escrita geral (4) | `POST` × `production` C10 · `POST` × `sales` C10 · `PATCH` × `production` C22 · `PATCH` × `sales` C22 | - |
| bordas de custo/vida útil/potência (5) | `acquisitionCostCents` baixo C4 · `lifespanHours` baixo C4 · `lifespanHours` alto C4 · `powerWatts` baixo C4 · `powerWatts` alto C4 | - |
| bordas de `nozzles` (4) | contagem baixa C6 · contagem alta C6 · `diameterMm` fora de faixa C6 · `type` vazio C6 | - |
| `amsSlots` condicional (2) | obrigatório quando `hasAms=true` C7 · ignorado/`null` quando `hasAms=false` C8 | - |
| `hourmeterHours` bordas (3) | negativo na criação C9 · negativo no ajuste C28 · ausente no ajuste C28 | - |
| faixas revalidadas no `PATCH` (10) - mesmas bordas do AC 3 + AC 5 + AC 6 | `acquisitionCostCents` baixo C20 · `lifespanHours` baixo C20 · `lifespanHours` alto C20 · `powerWatts` baixo C20 · `powerWatts` alto C20 · contagem baixa de `nozzles` C20 · contagem alta de `nozzles` C20 · `diameterMm` fora de faixa C20 · `type` vazio C20 · `amsSlots` obrigatório C20 | - |
| `hourmeterHours` bloqueado no `PATCH` geral (1) | chave rejeitada C21 | - |
| transições de `active` (3) | ativo -> inativo C24 · inativo -> ativo C25 · exclusão física nunca existe C26 | - |
| campos mapeados por `toPricingPrinterInput` (3) | `powerWatts` C32 · `costCents` (de `acquisitionCostCents`) C32 · `lifespanHours` C32 | - |
| equivalência de cálculo com `PricingService.calculate()` (2) | `depreciationCents` C33 · `energyCents` C33 | - |
| estados de tela (3) | carregando C34 · erro C35 · vazio C36 | - |
| UI por papel (3) | `admin` usa todos os controles C39, C40 · `production` só ajusta horímetro C38, C40 · `sales` só lê C37 | - |
| item de menu (1) | "Impressoras" para os três papéis C41 | - |

- Claims que citam um código de status, rota ou formato de resposta: C1-C31 - cada uma tem uma
  prova que cruza a fronteira HTTP (e2e real contra o `AppModule`)
- C32 e C33 citam um formato de dado (`PrinterInput`) sem cruzar HTTP - a prova é um teste Vitest
  comum contra as funções reais, sem dublê, como a AC 32 pede
- Nenhuma claim afirma mais do que o único caso que a prova exercita

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| `PrintersController` - `RolesGuard` aplicado nas 4 rotas (decide, alcançado pela rota, mesma forma das Fases 4-6) | um e2e por combinação rota × papel | as 4 rotas × os papéis onde aplicável (C1, C10, C11, C12, C17, C18, C22, C23, C24, C25, C26, C27, C30, C31) |
| `PrintersController`/`PrintersService` - `PATCH /printers/:id/hourmeter` libera escrita a `production` (decide; forma nova - nenhuma rota anterior do sistema libera escrita a um papel não-admin) | e2e por papel na rota dedicada, isolado do `PATCH` geral | `admin` escreve C27 · `production` escreve C27 · `sales` barrado C30 · `PATCH` geral nunca aceita a chave C21 |
| `PrintersService` - faixas de custo/vida útil/potência (decide, mesma forma do `Min`/`IsPositive` já usados em `materials`/`pricing`) | e2e tabela-driven por campo | as 5 bordas no `POST` (C4) e as mesmas revalidadas no `PATCH` (C20) |
| `PrintersService`/DTO - `nozzles` (array de objetos aninhados com bordas por item) (decide; mesmo padrão de `ArrayMinSize`/`ArrayMaxSize`/`ValidateNested` já usado em `CalculatePricingDto.materials`, Fase 1) | e2e tabela-driven pelos 4 casos | contagem e bordas de item no `POST` (C6) e revalidadas no `PATCH` (C20) |
| `PrintersService`/DTO - `amsSlots` condicional a `hasAms` (decide; mesmo padrão do par `needsDrying`/`dryingTemperatureC` da Fase 6) | e2e pelos 2 casos, entrada e revalidação | obrigatório quando `true` (C7), ignorado quando `false` (C8), revalidado no `PATCH` (C20) |
| `toPricingPrinterInput` (decide; forma nova - primeira função de mapeamento entre um cadastro e o contrato de `pricing.types.ts`) | um teste unitário isolado da função pura, e um teste que chama `PricingService.calculate()` real com o resultado, sem HTTP | mapeamento exato dos 3 campos (C32) e equivalência do cálculo de depreciação e energia (C33) |

Evidence:

- `printers.service.ts` (novo): decide sobre 5 faixas de valor (custo, vida útil, potência) ->
  mesma forma decisória já usada em `materials.service.ts`/`pricing`, provado no mesmo nível
  (e2e/DTO, sem unidade isolada)
- `dto/create-printer.dto.ts` (novo): `nozzles` com `ArrayMinSize`/`ArrayMaxSize`/`ValidateNested`
  -> mesma forma de `CalculatePricingDto.materials` (`pricing`, Fase 1), provada no mesmo nível
  (e2e)
- `dto/create-printer.dto.ts`/`printers.service.ts` (novo): `amsSlots` condicional -> mesma forma
  do par `needsDrying`/`dryingTemperatureC` (Fase 6, `materials.e2e-spec.ts`)
- `printers.controller.ts` (novo): `PATCH /printers/:id/hourmeter` libera escrita a `production`
  -> sem analogê no repositório (toda escrita anterior é admin-only); ganha e2e dedicado por papel
- `printers.types.ts` (novo, `toPricingPrinterInput`): sem analogê no repositório (primeira função
  que liga um cadastro ao contrato de `pricing.types.ts`) -> ganha teste unitário isolado e teste
  de integração com `PricingService.calculate()` real, sem HTTP

Cost: 1 arquivo e2e novo na API (`printers.e2e-spec.ts`) cobrindo 4 rotas × papéis, 1 spec Vitest
novo para `toPricingPrinterInput` e a equivalência com `PricingService.calculate()`, 1 arquivo de
teste de página novo no web, 1 arquivo de teste existente estendido (`app-shell.test.tsx`, um item
de menu), 1 arquivo de teste existente estendido (`roles.guard.spec.ts`, adiciona
`printers.controller.ts` à whitelist de `@Roles()`). Sem C27/C30, um endpoint que libera escrita a
um papel não-admin poderia vazar acesso de escrita para `sales` ou negar indevidamente a
`production` sem nenhum teste pegando isso - é o risco novo desta fase. Sem C32/C33, um erro de
nome de campo ou de unidade entre `Printer` e `PrinterInput` só apareceria visualmente na tela da
Fase 12, não num teste.

## Swept

- validation: C4, C5, C6, C7, C9, C20, C21, C28 - bordas de custo/vida útil/potência, nome vazio,
  bicos, `amsSlots` condicional (`POST` e `PATCH`), chave `hourmeterHours` bloqueada no `PATCH`
  geral, e bordas do ajuste de horímetro
- failure modes: C4, C5, C6, C7, C9, C20, C21, C28 - toda rejeição responde `400 { error }` sem
  gravar ou alterar nada
- idempotency, retry, duplicates: n/a - `PATCH /printers/:id/hourmeter` grava um valor absoluto
  (não soma), repetir a mesma chamada produz o mesmo estado; sem restrição de unicidade sobre
  `name` (Relations do plano), então não há duplicata a impedir
- authorization: C10, C11, C17, C22, C23, C27 (tabela `admin`/`production`), C30, C31
- concurrency and ordering: C12 - a ordenação estável por `name` garante paginação consistente
  entre chamadas concorrentes de leitura; sem restrição de unicidade (Landing) não há corrida de
  escrita a provar
- data lifecycle: n/a - sem TTL nem arquivamento; o único ciclo de vida é `active`/`inactive`,
  coberto em state transitions
- external-dependency failure: n/a - `printers` não chama nenhum serviço externo;
  `toPricingPrinterInput`/`PricingService.calculate()` (C32, C33) são chamadas internas puras
- state transitions: C24, C25, C26
- observability: n/a - mesma decisão das Fases 4-6: nenhum AC desta fase exige uma linha de log
  específica

## Out of scope

`plan.md` já carrega `## Out of scope`; nada adicional surgiu na derivação dos checks.

## Handoff

Novos: `printers.module.ts`, `printers.controller.ts`, `printers.service.ts`, `printers.types.ts`,
`entities/printer.entity.ts`, `dto/create-printer.dto.ts`, `dto/update-printer.dto.ts`,
`dto/list-printers.dto.ts`, `dto/adjust-hourmeter.dto.ts`, 1 migration (`CreatePrinters.ts`),
`test/printers.e2e-spec.ts`, `test/printers-helper.ts`, `printers.types.spec.ts` ≈ 55 KB.
Existente tocado: `app.module.ts` (registra `PrintersModule`), `roles.guard.spec.ts` (adiciona
`printers.controller.ts` à whitelist), `ROADMAP.md` (linha `printers` na "Matriz de permissões")
≈ 2 KB. Web novos: `lib/printers.ts`, `app/(app)/printers/page.tsx` + teste ≈ 40 KB. Web existente
tocado: `app-shell.tsx` + teste (um item de menu) ≈ 2 KB.

- S1-S6 ≈ 57 KB na API; S7 ≈ 42 KB no web ≈ 99 KB ≈ 27k tokens no total. Abaixo do orçamento
  padrão de 150k: um builder só, sem pergunta
- Validação final com o Playwright MCP (`AGENTS.md`): entrar como `admin`, abrir `/printers`,
  cadastrar uma impressora com AMS, editá-la, ajustar o horímetro, desativá-la com confirmação e
  ver o estado vazio filtrando por uma busca sem resultado; entrar como `production`, confirmar
  que só o controle de horímetro aparece; entrar como `sales`, confirmar leitura-only e
  "Impressoras" no menu para os três papéis

<Preenchido pelo builder ao final:>

- **Boundary:** feature completa em um builder só, C1-C41 fechados numa passada; sem handoff.
- **Settled mid-build:** nozzles não tem campo dedicado no `EntityForm` reutilizável (só
  text/number/checkbox) - resolvido com um único campo de texto `"diâmetro:tipo, diâmetro:tipo"`
  parseado no cliente (`parseNozzles`/`formatNozzles`), decisão reversível de UI, não um door do
  plano. `acquisitionCostCents` foi modelado como `double precision` (não `integer`) para seguir
  o mesmo padrão fracionário de `FixedCostItem.monthlyCents` (AD-006), mais estrito que o texto
  literal do AC 1 ("`> 0`") mas consistente com o resto do contrato de dinheiro.
- **Abandoned:** nada.
