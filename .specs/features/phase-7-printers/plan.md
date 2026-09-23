# Fase 7 — Impressoras

## Problem

Hoje não existe cadastro de impressoras no sistema. `PricingInput.printer` (Fase 1,
`api/src/modules/pricing/pricing.types.ts`) já espera `powerWatts`, `costCents` e
`lifespanHours` para calcular energia e depreciação, mas quem chama `POST /pricing/calculate`
redigita esses três valores a cada cálculo, sem nenhum registro correspondente no banco. Não há
onde a Fase 12 (calculadora integrada) vai buscar os dados da impressora escolhida, nem onde a
Fase 19 (fila de impressão) vai gravar o horímetro conforme os jobs terminam, nem onde a Fase 22
(manutenção) vai pendurar planos preventivos por máquina.

Quando isso existir, um admin cadastra cada impressora uma vez (custo, vida útil, potência,
horímetro, bicos instalados, AMS) e produção passa a poder consultar essa lista e ajustar o
horímetro manualmente após uma sessão de impressão, sem precisar do admin para isso. Vendas só
consulta. E os três campos que a calculadora já espera saem prontos do cadastro, sem conversão de
unidade nem digitação repetida.

## Flow

Reaproveita o `AuthGuard`/`RolesGuard` globais (Fase 3/4), o `ValidationPipe` global (Fase 0) e o
contrato de paginação/busca (`page`, `pageSize`, `search` → `{ items, total, page, pageSize }`,
door 1 da Fase 6, `AD-020`) e os componentes web `DataTable`/`EntityForm`/`ConfirmDialog`
(`AD-021`) — nenhum dos dois nasce de novo aqui. `pricing.controller.ts`/`pricing.service.ts`
(Fase 1) não são tocados: ligar `printers` à tela da calculadora é trabalho da Fase 12; esta fase
só prova que a conversão é trivial, com um teste de integração direto no serviço.

`single module - printers`:

1. `GET /printers?search=&hasAms=&page=&pageSize=` (existing contract, AD-020) -> `PrintersController` (novo) -> `PrintersService` (novo) - lista `Printer` paginada, buscada por `name` e filtrada por `hasAms`
2. `POST /printers` -> `PrintersController` (novo) -> `PrintersService` (novo, door 2: entidade
   `Printer`) - valida e persiste uma nova impressora
3. `PATCH /printers/:id` -> `PrintersController` (novo) -> `PrintersService` (novo) - atualiza
   campos e/ou `active`; nunca aceita `hourmeterHours` (rejeitado pelo `ValidationPipe`
   `forbidNonWhitelisted`, ele não existe no DTO)
4. `PATCH /printers/:id/hourmeter` -> `PrintersController` (novo, door 3: endpoint dedicado) ->
   `PrintersService` (novo) - só troca o horímetro
5. `toPricingPrinterInput(printer)` (novo, door 4: contrato de integração com `pricing`) - seleciona
   `powerWatts`, `costCents: printer.acquisitionCostCents`, `lifespanHours` de um `Printer` e monta
   um `PrinterInput` (Fase 1) válido sem nenhuma conversão de unidade
6. Web: `/printers` (nova página) reaproveita `DataTable`, `EntityForm` e `ConfirmDialog`
   (existem, Fase 6) e o cliente HTTP `apiFetch` (existe); ganha um controle extra de "Ajustar
   horímetro" visível também para `production`; `AppShell` (existe) ganha o item de menu
   "Impressoras"

## Impact

| Front | O que muda |
| --- | --- |
| domain | termo novo: `Printer` - cadastro de custo, vida útil, potência, horímetro, bicos e AMS, mora no módulo `printers` |
| domain | termo existente: `PrinterInput` (`pricing.types.ts`, Fase 1) continua o mesmo shape; esta fase adiciona um seletor (`toPricingPrinterInput`) que o preenche a partir de `Printer`, sem alterar `PricingInput` nem `pricing.service.ts` |
| doc | a linha `printers` na "Matriz de permissões" (`ROADMAP.md`, Fase 4) sai de "a definir na Fase 7" para `admin: x`, `production: leitura + PATCH /printers/:id/hourmeter`, `sales: leitura` |
| doc | a questão em aberto #5 do ROADMAP (manutenção R$/h por impressora) continua parcialmente respondida - decisão explícita do usuário: fora do escopo desta fase, a lista de tarefas da Fase 7 não pede esse campo |
| stored data | tabela nova (`printers`); nada para migrar em dado existente |

## Relations

Entidade nova `Printer`, autônoma nesta fase - sem FK de saída nem de entrada. `nozzles` fica
numa coluna `jsonb` da própria `Printer` (lista de valores, sem identidade própria), não numa
tabela filha: diferente do `FixedCostItem` (Fase 5), que virou tabela separada só porque aquela
relação precisava de uma entidade TypeORM bidirecional e o import circular ESM
(`emitDecoratorMetadata`) aparece exatamente nesse caso. Bico não precisa de identidade nem de
referência de volta, então a coluna `jsonb` evita o problema sem precisar da tabela.

A Fase 19 (jobs) e a Fase 22 (manutenção) criam `PrintJob ||--o{ Printer` e
`MaintenancePlan ||--o{ Printer` depois; até lá `Printer` não é referenciado por ninguém.

Nenhuma constraint one-way de unicidade nesta fase: `name` não é único (duas impressoras podem
ter o mesmo modelo).

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /printers` | query: `search?`, `hasAms?`, `page?`, `pageSize?` | `{ items: PrinterResponse[], total, page, pageSize }` | `200`, `400`, `401` |
| `POST /printers` | `name`, `acquisitionCostCents`, `lifespanHours`, `powerWatts`, `hourmeterHours?`, `nozzles` (`{ diameterMm, type }[]`), `hasAms`, `amsSlots?` | `PrinterResponse` | `201`, `400`, `401`, `403` |
| `PATCH /printers/:id` | subconjunto dos campos acima (exceto `hourmeterHours`) + `active?` | `PrinterResponse` | `200`, `400`, `401`, `403`, `404` |
| `PATCH /printers/:id/hourmeter` | `hourmeterHours` | `PrinterResponse` | `200`, `400`, `401`, `403`, `404` |

`PrinterResponse`: `{ id, name, acquisitionCostCents, lifespanHours, powerWatts, hourmeterHours, nozzles, hasAms, amsSlots, active }`.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| Contrato de integração `Printer` → `PricingInput.printer` (Fase 1), precedente que a tela da Fase 12 consome direto | função pura `toPricingPrinterInput(printer: Printer): PrinterInput` em `printers.types.ts`, retornando `{ powerWatts: printer.powerWatts, costCents: printer.acquisitionCostCents, lifespanHours: printer.lifespanHours }` - nenhum outro campo, nenhuma conversão de unidade | Duplicar os três campos com os nomes de `PrinterInput` na própria entidade (`costCents` em vez de `acquisitionCostCents`) - descartada porque o nome do domínio ("custo de aquisição", como o ROADMAP chama) fica mais claro que o nome genérico do módulo de cálculo, e a seleção de campos já é trivial sem precisar dos mesmos nomes |
| Endpoint dedicado para o horímetro, separado do `PATCH` geral - precedente que a atualização automática da Fase 19 vai chamar | `PATCH /printers/:id/hourmeter` só aceita `{ hourmeterHours: number }`; `PATCH /printers/:id` nunca aceita esse campo (fora do DTO, rejeitado pelo `forbidNonWhitelisted`) | Aceitar `hourmeterHours` dentro do `PATCH` geral - descartada porque a Fase 19 precisa de um contrato estável e isolado para escrever automaticamente sem herdar a autorização e a validação dos campos administrativos (custo, vida útil), que só `admin` deve poder mudar |
| Papel que pode ajustar o horímetro manualmente | `production` e `admin` chamam `PATCH /printers/:id/hourmeter`; `sales` não | Só `admin` - descartada porque quem opera a impressora fisicamente (produção) é quem lê o horímetro depois de uma sessão, e exigir o admin para cada ajuste tornaria o dado sistematicamente desatualizado |

- Nada mais nesta mudança é difícil de reverter: os limites de validação, `name` livre e a ausência
  de endpoint de exclusão física são decisões reversíveis num refactor futuro, não portas de uma
  via.

## Criteria

### S1: Cadastrar impressora (P1)

Um admin registra uma impressora nova com seus dados de custo, potência, bicos e capacidade de
AMS.

**Acceptance Criteria**

1. WHEN um admin autenticado envia `POST /printers` com `name` (não vazio após `trim()`), `acquisitionCostCents` `> 0`, `lifespanHours` em `(0, 100000]`, `powerWatts` em `(0, 5000]`, `nozzles` com 1 a 10 itens (cada um com `diameterMm` em `(0, 2]` e `type` não vazio) e `hasAms` THEN o sistema SHALL responder `201` com a impressora criada, incluindo `id` gerado, `hourmeterHours: 0` (quando `hourmeterHours` não for enviado) e `active: true`
2. WHEN `POST /printers` incluir `hourmeterHours` `>= 0` THEN o sistema SHALL gravar esse valor em vez do padrão `0`
3. IF `acquisitionCostCents` for `<= 0`, `lifespanHours` estiver fora de `(0, 100000]` ou `powerWatts` estiver fora de `(0, 5000]` THEN o sistema SHALL responder `400 { error }` sem gravar nada
4. IF `name` vier vazio (ou só espaços, após `trim()`) THEN o sistema SHALL responder `400 { error }`
5. IF `nozzles` vier com menos de 1 ou mais de 10 itens, ou algum item tiver `diameterMm` fora de `(0, 2]` ou `type` vazio, THEN o sistema SHALL responder `400 { error }` sem gravar nada
6. IF `hasAms` for `true` e `amsSlots` estiver ausente ou `< 1` THEN o sistema SHALL responder `400 { error }`
7. WHILE `hasAms` for `false`, o sistema SHALL gravar `amsSlots` como `null`, ignorando qualquer valor enviado para ele
8. IF `hourmeterHours` for enviado e for `< 0` THEN o sistema SHALL responder `400 { error }`
9. IF quem chama `POST /printers` não tiver papel `admin` THEN o sistema SHALL responder `403 { error }` sem gravar nada
10. IF `POST /printers` for chamado sem cookie de sessão THEN o sistema SHALL responder `401 { error }` sem gravar nada

**Independent test:** `POST /printers` com uma impressora com AMS completa e checar o `201`;
repetir com `powerWatts: 8000` e checar o `400`.

### S2: Listar impressoras com paginação, busca e filtro (P1)

Qualquer papel autenticado consulta o cadastro de impressoras.

**Acceptance Criteria**

11. WHEN qualquer papel autenticado chama `GET /printers` sem parâmetros THEN o sistema SHALL responder `200` com `{ items, total, page: 1, pageSize: 20 }`, `items` ordenado por `name`
12. WHEN `GET /printers?search=X2D` for chamado THEN o sistema SHALL responder só com impressoras cujo `name` contenha `X2D`, ignorando caixa
13. WHEN `GET /printers?hasAms=true` for chamado THEN o sistema SHALL responder só com impressoras com `hasAms: true`
14. WHEN `GET /printers?page=2&pageSize=10` for chamado com 15 impressoras cadastradas THEN o sistema SHALL responder com os 5 itens seguintes aos 10 primeiros (pela ordenação do AC 11) e `total: 15`
15. IF `page` for menor que `1`, ou `pageSize` for menor que `1` ou maior que `100`, THEN o sistema SHALL responder `400 { error }`
16. IF `GET /printers` for chamado sem cookie de sessão THEN o sistema SHALL responder `401 { error }`

**Independent test:** semear 15 impressoras, chamar `GET /printers?page=2&pageSize=10` e checar 5
itens com `total: 15`.

### S3: Editar impressora (P2)

Um admin corrige os dados administrativos de uma impressora existente, sem poder mudar o
horímetro por essa rota.

**Acceptance Criteria**

17. WHEN um admin chama `PATCH /printers/:id` com um subconjunto válido de campos (exceto `hourmeterHours`) THEN o sistema SHALL atualizar só os campos enviados e responder `200` com a impressora atualizada
18. IF `:id` não corresponder a uma impressora existente THEN o sistema SHALL responder `404 { error }`
19. IF o corpo de `PATCH /printers/:id` violar as mesmas faixas do AC 3, AC 5 ou AC 6 THEN o sistema SHALL responder `400 { error }` sem alterar o registro
20. IF `PATCH /printers/:id` incluir a chave `hourmeterHours` THEN o sistema SHALL responder `400 { error }` sem alterar o registro
21. IF quem chama `PATCH /printers/:id` não tiver papel `admin` THEN o sistema SHALL responder `403 { error }`
22. IF `PATCH /printers/:id` for chamado sem cookie de sessão THEN o sistema SHALL responder `401 { error }`

**Independent test:** criar uma impressora, `PATCH` só o `name` e checar que os outros campos não
mudaram; repetir enviando `hourmeterHours` e checar o `400`.

### S4: Ativar e desativar impressora (P2)

Um admin desativa uma impressora sem apagá-la, e pode reativá-la depois.

**Acceptance Criteria**

23. WHEN um admin envia `PATCH /printers/:id` com `{ "active": false }` THEN o sistema SHALL marcar a impressora como inativa, mantendo o registro
24. WHEN um admin envia `PATCH /printers/:id` com `{ "active": true }` numa impressora inativa THEN o sistema SHALL reativá-la
25. The system SHALL nunca expor uma rota de exclusão física de `Printer`

**Independent test:** desativar uma impressora e checar `active: false` em `GET /printers`;
reativar e checar `active: true`.

### S5: Ajustar horímetro manualmente (P1)

Produção ou admin corrige o horímetro depois de uma sessão de impressão, sem passar pelo `PATCH`
administrativo geral.

**Acceptance Criteria**

26. WHEN um admin ou `production` chama `PATCH /printers/:id/hourmeter` com `hourmeterHours >= 0` THEN o sistema SHALL gravar esse valor absoluto (substituindo o anterior, sem somar) e responder `200` com a impressora atualizada
27. IF `hourmeterHours` for `< 0` ou ausente THEN o sistema SHALL responder `400 { error }` sem alterar o registro
28. IF `:id` não corresponder a uma impressora existente THEN o sistema SHALL responder `404 { error }`
29. IF quem chama `PATCH /printers/:id/hourmeter` tiver papel `sales` THEN o sistema SHALL responder `403 { error }`
30. IF `PATCH /printers/:id/hourmeter` for chamado sem cookie de sessão THEN o sistema SHALL responder `401 { error }`

**Independent test:** ajustar o horímetro de 0 para 120.5, checar `200` com `hourmeterHours: 120.5`
via `GET /printers`; repetir com `sales` e checar `403`.

### S6: Impressora alimenta o cálculo de preço sem conversão manual (P1)

Os três campos que `PricingInput.printer` já espera (Fase 1) saem prontos do cadastro.

**Acceptance Criteria**

31. WHEN `toPricingPrinterInput` receber uma `Printer` persistida THEN o sistema SHALL devolver um `PrinterInput` cujos `powerWatts`, `costCents` e `lifespanHours` sejam exatamente `printer.powerWatts`, `printer.acquisitionCostCents` e `printer.lifespanHours`, sem arredondamento nem mudança de unidade
32. WHEN esse `PrinterInput` for passado para `PricingService.calculate()` (Fase 1) junto com um `PricingInput` completo THEN o sistema SHALL calcular `depreciationCents` e `energyCents` exatamente como calcularia com os mesmos três valores digitados manualmente (teste de integração comparando os dois resultados, sem chamada HTTP)

**Independent test:** criar uma `Printer` com `powerWatts: 250`, `acquisitionCostCents: 500000`,
`lifespanHours: 10000`; chamar `toPricingPrinterInput` e `PricingService.calculate()` com o
resultado; comparar com o mesmo cálculo feito passando os três valores à mão.

### S7: Web - tela de impressoras no padrão de CRUD reutilizável (P1)

A tela `/printers` usa os mesmos três componentes da Fase 6 para listar, cadastrar, editar e
desativar/reativar, mais um controle específico para o horímetro.

**Acceptance Criteria**

33. WHEN a tela `/printers` carrega THEN o sistema SHALL mostrar o estado de carregamento até a resposta de `GET /printers`
34. IF `GET /printers` falhar THEN a tela SHALL mostrar a mensagem de erro e um botão "Tentar novamente", reaproveitando o padrão de `/materials`
35. WHILE a resposta de `GET /printers` tiver `items` vazio, a tela SHALL mostrar um estado vazio distinto do estado de erro
36. WHEN um usuário com papel `sales` acessa `/printers` THEN a tela SHALL esconder os controles de criar, editar, desativar/reativar e ajustar horímetro, mostrando só a listagem
37. WHEN um usuário com papel `production` acessa `/printers` THEN a tela SHALL mostrar só o controle de ajustar horímetro, escondendo criar, editar e desativar/reativar
38. WHEN um admin aciona "Desativar" ou "Reativar" numa linha THEN a tela SHALL abrir o `ConfirmDialog` reutilizável e só chamar `PATCH /printers/:id` após a confirmação
39. WHEN um admin ou `production` ajusta o horímetro pela tela THEN a tela SHALL chamar `PATCH /printers/:id/hourmeter` e atualizar a linha correspondente sem recarregar a página
40. WHEN `AppShell` renderiza com `role: "admin"`, `"production"` ou `"sales"` THEN o sistema SHALL mostrar o item "Impressoras" no menu para os três papéis, na mesma lista dos itens já existentes

**Independent test:** Playwright - carregar `/printers`, cadastrar uma impressora com AMS,
editá-la, ajustar o horímetro como `production`, desativá-la como admin com confirmação e ver o
estado vazio com um filtro sem resultado.

## Out of scope

| Excluded | Why |
| --- | --- |
| Custo de manutenção R$/h por impressora | decisão explícita do usuário nesta revisão: a lista de tarefas da Fase 7 não pede esse campo; a questão #5 do ROADMAP continua aberta para a Fase 22 |
| Rota de exclusão física de `Printer` | mesmo precedente de `Material`/`users`/`sales-channels`: nunca apagar fisicamente |
| Atualização automática do horímetro pelos jobs | é a Fase 19, citada explicitamente no ROADMAP como posterior |
| Planos de manutenção preventiva, uso de peças, métricas por máquina | é a Fase 22 |
| CRUD dedicado de bicos (entidade própria, histórico de troca) | o ROADMAP pede só "bicos instalados", uma lista de valores no cadastro da impressora |
| Ligar a tela `/printers` à calculadora (`POST /pricing/calculate`) | é a Fase 12; esta fase só prova que a conversão é trivial com um teste de integração direto no serviço (S6) |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Nenhum custo de manutenção por impressora nesta fase | campo não existe em `Printer` nem em `PrinterInput` | decisão do usuário nesta revisão do plano | y |
| Bicos ficam numa coluna `jsonb` da própria `Printer`, não numa entidade/tabela separada | `nozzles: { diameterMm, type }[]` em `jsonb` | decisão do usuário nesta revisão do plano | y |
| Faixas de validação: `powerWatts` `(0, 5000]` W, `lifespanHours` `(0, 100000]` h, `diameterMm` `(0, 2]` mm | faixas acima | cobrem impressoras FDM domésticas e de pequeno porte industrial, e ainda rejeitam erro de unidade (ex.: digitar Wh em vez de W) | n |
| `nozzles` exige de 1 a 10 itens | `@ArrayMinSize(1) @ArrayMaxSize(10)` | uma impressora sempre tem ao menos um bico instalado; 10 é generoso para impressoras multi-extrusora sem abrir espaço para entrada acidental | n |
| `hourmeterHours` aceita qualquer valor `>= 0` no ajuste manual, sem exigir que seja maior que o valor anterior | sem checagem de monotonicidade | o ROADMAP não pede essa regra, e uma correção de leitura errada pode legitimamente baixar o valor; adicionar a checagem depois é reversível | n |
| Papéis: `admin` lê e escreve tudo; `production` lê tudo e chama só `PATCH /printers/:id/hourmeter`; `sales` só lê | shape acima | produção é quem lê o horímetro fisicamente após uma sessão; os demais campos (custo, vida útil, AMS) são administrativos, mesmo padrão de acesso restrito a admin já usado em `materials` | n |
| `GET /printers` filtra por `hasAms` além de buscar por `name`; não filtra por outro campo | shape acima | `hasAms` é o único campo categórico de baixa cardinalidade do cadastro; os demais são numéricos ou texto livre, sem filtro exato útil | n |
| `amsSlots` (`>= 1`, inteiro) só é obrigatório quando `hasAms=true`; caso contrário fica `null` | shape acima | mesmo padrão do par `needsDrying`/`dryingTemperatureC` da Fase 6 (AC 4/5 daquele plano) | n |

**Open questions:** none - todas as decisões acima foram assumidas com um default e ficam
abertas para o usuário corrigir nesta revisão do plano.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| tela `/printers` | estado de carregamento | AC 33 |
| tela `/printers` | estado de erro | AC 34 |
| tela `/printers` | estado vazio | AC 35 |
| tela `/printers` | estado não autorizado (`sales` leitura-only) | AC 36 |
| tela `/printers` | estado não autorizado (`production` só ajusta horímetro) | AC 37 |
| tela `/printers` | ação destrutiva confirma antes de executar | AC 38 |
| tela `/printers` | densidade e ordenação da listagem | AC 11 |
| API `GET /printers` | forma de erro e códigos | AC 15, 16 |
| API `POST /printers` | forma de erro e códigos | AC 3, 4, 5, 6, 8, 9, 10 |
| API `PATCH /printers/:id` | forma de erro e códigos | AC 18, 19, 20, 22 |
| API `PATCH /printers/:id` | quem pode chamar | AC 21, 22 |
| API `PATCH /printers/:id/hourmeter` | forma de erro e códigos, quem pode chamar | AC 27, 28, 29, 30 |
| `AppShell` | item de menu novo aparece para os três papéis | AC 40 |
| tela `/printers` | criação/edição/ajuste refletem sem recarregar | AC 39 |
| todas `/printers*` | versionamento, rate limit | n/a - módulo interno sem consumidor externo, mesmo padrão de `materials`/`users`/`sales-channels` |

## Sources

- `ROADMAP.md`, Fase 7 (Tarefas e Critérios de aceite) - define os campos, o endpoint de horímetro
  e o critério "sem conversão manual" com `pricing/calculate`
- `api/src/modules/pricing/pricing.types.ts` (`PrinterInput`) - o contrato que `Printer` precisa
  alimentar sem conversão
- `.specs/STATE.md` AD-006 (centavos fracionários na entrada), AD-014 (`uuid`), AD-018
  (autorização por padrão), AD-020 (paginação/busca), AD-021 (componentes CRUD reutilizáveis) -
  precedentes herdados sem alteração
- `.specs/features/phase-6-materials/plan.md` - padrão de CRUD que esta fase copia (entidade,
  DTOs, componentes web)
