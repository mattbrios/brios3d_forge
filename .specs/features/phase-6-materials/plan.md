# Fase 6 — Materiais

## Problem

Hoje não existe cadastro de materiais no sistema. `POST /pricing/calculate` (Fase 1) recebe
densidade, custo/g e temperaturas soltos a cada chamada, e o mapeador da Fase 2 devolve
`type`/`color` como texto livre vindo do MakerWorld, sem nenhum registro correspondente no
banco. Quem monta um cálculo hoje precisa redigitar densidade, temperatura de bico/mesa e
parâmetros de secagem de cada material toda vez, e não há de onde a Fase 9 (estoque de rolo,
custo médio ponderado) e a Fase 12 (calculadora integrada) vão puxar essas propriedades por
material. O ROADMAP (Fase 6) descreve os campos e also nomeia esta fase como a que fixa "o
padrão de CRUD reutilizável (API + web)" que as Fases 7 (impressoras), 8 (clientes/fornecedores),
9 (estoque) e 10 (insumos) devem copiar - hoje cada tela (`users`, `sales-channels`) tem sua
própria tabela e formulário duplicados, sem paginação nem busca.

Quando isso existir, um admin cadastra um material uma vez (tipo, marca, cor, densidade,
temperaturas, secagem) e ele fica disponível para toda consulta futura; produção e vendas
enxergam a lista para referência, sem poder editá-la; e as quatro fases seguintes reaproveitam
os mesmos componentes de tabela, formulário e confirmação em vez de duplicar mais telas.

## Flow

Reaproveita o `AuthGuard`/`RolesGuard` globais (Fase 3/4) e o `ValidationPipe` global (Fase 0);
nenhuma rota nova nasce sem essa proteção. `pricing.controller.ts`/`pricing.service.ts` (Fase 1)
não são tocados - ligar `materials` ao cálculo é trabalho da Fase 12.

`single module - materials`:

1. `GET /materials?type=&search=&page=&pageSize=` -> `MaterialsController` (novo, door 1: contrato de paginação/busca) -> `MaterialsService` (novo) - lista `Material` paginada, filtrada por tipo e buscada por tipo/marca/cor
2. `POST /materials` -> `MaterialsController` (novo) -> `MaterialsService` (novo, door 2: entidade `Material`) - valida e persiste um novo `Material`
3. `PATCH /materials/:id` -> `MaterialsController` (novo) -> `MaterialsService` (novo) - atualiza campos e/ou `active` (reaproveita o padrão de "nunca apagar fisicamente" já usado em `users`/`sales-channels`)
4. Web: `/materials` (nova página) usa três componentes novos e reutilizáveis em
   `web/src/components/crud/` - `DataTable`, `EntityForm` e `ConfirmDialog` (door 3) - e reaproveita
   o cliente HTTP `apiFetch` (existe, `web/src/lib/api.ts`) e o padrão de carregamento/erro de
   `sales-channels/page.tsx` (existe); `AppShell` (existe) ganha o item de menu "Materiais",
   visível aos três papéis

## Impact

| Front | O que muda |
| --- | --- |
| domain | termo novo: `Material` - cadastro de tipo/marca/cor/densidade/temperaturas/secagem, mora no módulo `materials` |
| domain | termo existente: `type`/`color` na saída da Fase 2 (`PrintProfileData.profiles[].filaments[]`) continuam texto livre vindo do MakerWorld - esta fase não cria vínculo entre eles e `Material.id`; esse mapeamento é da Fase 12 ("mapear cada filamento do perfil... para um material cadastrado") |
| doc | a linha `materials` na "Matriz de permissões" (`ROADMAP.md`, Fase 4) sai de "a definir na Fase 6" para `admin: x`, `production: leitura`, `sales: leitura` |
| stored data | tabela nova (`materials`); nada para migrar em dado existente |

## Relations

Entidade nova `Material`, autônoma nesta fase - sem FK de saída nem de entrada. A Fase 9 cria
`FilamentRoll ||--o{ Material : "consumes"` depois; até lá `Material` não é referenciado por
ninguém.

Nenhuma constraint one-way nesta fase: não há índice único sobre `type`+`brand`+`color` (a chave
de agregação do custo médio ponderado é decisão da Fase 9 - questão 12 do ROADMAP - e travar uma
unicidade agora poderia contradizer o que aquela fase decidir).

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /materials` | query: `type?`, `search?`, `page?`, `pageSize?` | `{ items: MaterialResponse[], total, page, pageSize }` | `200`, `400`, `401` |
| `POST /materials` | `type`, `brand`, `color`, `densityGCm3`, `nozzleTempC`, `bedTempC`, `needsDrying`, `dryingTemperatureC?`, `dryingHours?` | `MaterialResponse` | `201`, `400`, `401`, `403` |
| `PATCH /materials/:id` | subconjunto dos campos acima + `active?` | `MaterialResponse` | `200`, `400`, `401`, `403`, `404` |

`MaterialResponse`: `{ id, type, brand, color, densityGCm3, nozzleTempC, bedTempC, needsDrying, dryingTemperatureC, dryingHours, active }`.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| Contrato de paginação/busca/filtro de `GET /materials`, precedente para toda lista futura (Fases 7-10) | Query `page` (1-based, default `1`), `pageSize` (default `20`, máx `100`), `search` (substring case-insensitive em `type`+`brand`+`color`), `type` (match exato case-insensitive). Resposta `{ items, total, page, pageSize }`, ordenada por `type`, depois `brand`, depois `color` | Paginação por cursor - descartada porque não há necessidade de consistência sob inserção concorrente numa tela administrativa de baixo volume, e ela complicaria o `DataTable` reutilizável exigido nesta mesma fase sem ganho aqui |
| Contrato dos componentes web reutilizáveis de listagem/formulário/confirmação, precedente que as Fases 7-10 copiam (nome literal do ROADMAP: "padrão de CRUD reutilizável") | `web/src/components/crud/data-table.tsx` exporta `DataTable<T>({ columns: { key, label, render? }[], rows: T[], getRowId(row): string, renderActions?(row) })`; `entity-form.tsx` exporta `EntityForm<V>({ fields, values, onChange, onSubmit, submitting, error })`; `confirm-dialog.tsx` exporta `ConfirmDialog({ message, confirmLabel, onConfirm, onCancel, pending })` | Continuar duplicando o markup por tela, como em `users/page.tsx` e `sales-channels/page.tsx` - descartada porque o ROADMAP nomeia esta fase como a que fixa o padrão que as próximas 4 fases replicam, e cada nova duplicação multiplica o custo de manter estado de loading/erro/edição repetido |

- Nada mais nesta mudança é difícil de reverter: `type` como texto livre (sem enum), as faixas de
  validação e a ausência de endpoint de exclusão física são todas decisões reversíveis num
  refactor futuro, não portas de uma via.

## Criteria

### S1: Cadastrar material (P1)

Um admin registra um material novo com suas propriedades físicas e, se aplicável, os parâmetros
de secagem.

**Acceptance Criteria**

1. WHEN um admin autenticado envia `POST /materials` com `type`, `brand`, `color` (não vazios após `trim()`), `densityGCm3` em `(0, 10]`, `nozzleTempC` em `[0, 500]`, `bedTempC` em `[0, 150]` e `needsDrying` THEN o sistema SHALL responder `201` com o material criado, incluindo `id` gerado e `active: true`
2. IF `densityGCm3` estiver fora de `(0, 10]`, `nozzleTempC` fora de `[0, 500]` ou `bedTempC` fora de `[0, 150]` THEN o sistema SHALL responder `400 { error }` sem gravar nada
3. IF `type`, `brand` ou `color` vier vazio (ou só espaços, após `trim()`) THEN o sistema SHALL responder `400 { error }`
4. IF `needsDrying` for `true` e `dryingTemperatureC` estiver ausente ou fora de `[0, 120]`, ou `dryingHours` estiver ausente ou `<= 0`, THEN o sistema SHALL responder `400 { error }`
5. WHILE `needsDrying` for `false`, o sistema SHALL gravar `dryingTemperatureC` e `dryingHours` como `null`, ignorando qualquer valor enviado para eles
6. IF quem chama `POST /materials` não tiver papel `admin` THEN o sistema SHALL responder `403 { error }` sem gravar nada
7. IF `POST /materials` for chamado sem cookie de sessão THEN o sistema SHALL responder `401 { error }` sem gravar nada

**Independent test:** `POST /materials` com um PLA completo e checar o `201`; repetir com
densidade `15` e checar o `400`.

### S2: Listar materiais com paginação, busca e filtro (P1)

Qualquer papel autenticado consulta o catálogo de materiais.

**Acceptance Criteria**

8. WHEN qualquer papel autenticado chama `GET /materials` sem parâmetros THEN o sistema SHALL responder `200` com `{ items, total, page: 1, pageSize: 20 }`, `items` ordenado por `type`, depois `brand`, depois `color`
9. WHEN `GET /materials?type=PLA` for chamado THEN o sistema SHALL responder só com materiais cujo `type` seja igual a `PLA` ignorando caixa
10. WHEN `GET /materials?search=verm` for chamado THEN o sistema SHALL responder só com materiais cujo `type`, `brand` ou `color` contenha `verm`, ignorando caixa
11. WHEN `GET /materials?page=2&pageSize=10` for chamado com 15 materiais cadastrados THEN o sistema SHALL responder com os 5 itens seguintes aos 10 primeiros (pela ordenação do AC 8) e `total: 15`
12. IF `page` for menor que `1`, ou `pageSize` for menor que `1` ou maior que `100`, THEN o sistema SHALL responder `400 { error }`
13. IF `GET /materials` for chamado sem cookie de sessão THEN o sistema SHALL responder `401 { error }`

**Independent test:** semear 15 materiais, chamar `GET /materials?page=2&pageSize=10` e checar 5
itens com `total: 15`.

### S3: Editar material (P2)

Um admin corrige ou completa os dados de um material existente.

**Acceptance Criteria**

14. WHEN um admin chama `PATCH /materials/:id` com um subconjunto válido de campos THEN o sistema SHALL atualizar só os campos enviados e responder `200` com o material atualizado
15. IF `:id` não corresponder a um material existente THEN o sistema SHALL responder `404 { error }`
16. IF o corpo de `PATCH /materials/:id` violar as mesmas faixas do AC 2 ou do AC 4 THEN o sistema SHALL responder `400 { error }` sem alterar o registro
17. IF quem chama `PATCH /materials/:id` não tiver papel `admin` THEN o sistema SHALL responder `403 { error }`
18. IF `PATCH /materials/:id` for chamado sem cookie de sessão THEN o sistema SHALL responder `401 { error }`

**Independent test:** criar um material, `PATCH` só a `color` e checar que os outros campos não
mudaram.

### S4: Ativar e desativar material (P2)

Um admin desativa um material sem apagá-lo, e pode reativá-lo depois.

**Acceptance Criteria**

19. WHEN um admin envia `PATCH /materials/:id` com `{ "active": false }` THEN o sistema SHALL marcar o material como inativo, mantendo o registro
20. WHEN um admin envia `PATCH /materials/:id` com `{ "active": true }` num material inativo THEN o sistema SHALL reativá-lo
21. The system SHALL nunca expor uma rota de exclusão física de `Material`

**Independent test:** desativar um material e checar `active: false` em `GET /materials`;
reativar e checar `active: true`.

### S5: Web - padrão de CRUD reutilizável e tela de materiais (P1)

A tela `/materials` usa os três componentes novos para listar, cadastrar, editar e
desativar/reativar, nos três estados de carregamento, erro e vazio.

**Acceptance Criteria**

22. WHEN a tela `/materials` carrega THEN o sistema SHALL mostrar o estado de carregamento até a resposta de `GET /materials`
23. IF `GET /materials` falhar THEN a tela SHALL mostrar a mensagem de erro e um botão "Tentar novamente", reaproveitando o padrão de `sales-channels/page.tsx`
24. WHILE a resposta de `GET /materials` tiver `items` vazio, a tela SHALL mostrar um estado vazio distinto do estado de erro
25. WHEN um usuário com papel `production` ou `sales` acessa `/materials` THEN a tela SHALL esconder os controles de criar, editar e desativar/reativar, mostrando só a listagem
26. WHEN um admin aciona "Desativar" ou "Reativar" numa linha THEN a tela SHALL abrir o `ConfirmDialog` reutilizável e só chamar `PATCH /materials/:id` após a confirmação
27. WHEN um admin submete o `EntityForm` de criação com um valor fora de faixa (ex.: densidade `15`) THEN a tela SHALL mostrar o erro devolvido pela API sem recarregar a listagem
28. WHEN `AppShell` renderiza com `role: "admin"`, `"production"` ou `"sales"` THEN o sistema SHALL mostrar o item "Materiais" no menu para os três papéis, na mesma lista dos itens já existentes
29. WHEN um admin submete o `EntityForm` de criação com dados válidos THEN a tela SHALL adicionar a nova linha à listagem com os dados devolvidos pela API, sem recarregar a página
30. WHEN um admin edita um material existente pelo `EntityForm` e salva THEN a tela SHALL atualizar a linha correspondente na listagem com os dados devolvidos pela API, sem recarregar a página

**Independent test:** Playwright - carregar `/materials`, cadastrar um material, editá-lo,
desativá-lo com confirmação e ver o estado vazio com um filtro sem resultado.

## Out of scope

| Excluded | Why |
| --- | --- |
| Rota de exclusão física de `Material` | precedente de `users`/`sales-channels` (Fases 3-5) é nunca apagar fisicamente; ver `Landing` e Assumptions |
| `GET /materials/types` (lista de tipos distintos para popular um seletor) | o ROADMAP pede só "filtro por tipo"; o campo de filtro no web é texto livre, não um seletor fechado |
| Vínculo com custo médio ponderado e rolos (`FilamentRoll`) | é a Fase 9; `Material` nesta fase só guarda propriedades físicas |
| Mapear `type`/`color` do perfil MakerWorld (Fase 2) para um `Material.id` | é a Fase 12 ("mapear cada filamento do perfil... para um material cadastrado") |
| Seed de materiais padrão | ao contrário dos canais de venda (Fase 5, que o CONTEXT nomeia), o CONTEXT não lista materiais fixos para semear; a empresa cadastra o que usa |
| Importação em lote (CSV) | não pedido pelo ROADMAP nesta fase |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| `type` é texto livre (trim, 1-40 caracteres), sem enum fechado no banco | texto livre | o ROADMAP lista os tipos com reticências ("PLA, PETG, ABS, ASA, TPU, Nylon…") - lista aberta; um enum exigiria migration a cada material novo | n |
| Papéis: `admin` lê e escreve; `production` e `sales` só leem | leitura para os três, escrita só admin | espelha a linha `settings` já preenchida na "Matriz de permissões" (Fase 4/5) para dado de referência consumido por produção e vendas mas mantido só pelo admin | n |
| Nunca existe rota de exclusão física; "desativar em vez de apagar quando houver referências" (ROADMAP) se resolve reaproveitando o toggle `active` de `users`/`sales-channels`, sem checagem condicional de referências (não há nenhuma referência possível a `Material` até a Fase 9) | só `PATCH .../active` | evita construir uma checagem de referência que não tem o que checar ainda, e mantém o mesmo padrão já usado duas vezes | n |
| `dryingTemperatureC` (`[0,120]`) e `dryingHours` (`> 0`) só são obrigatórios quando `needsDrying=true`; caso contrário ficam `null` | shape acima | o ROADMAP não detalha os campos de secagem além de "parâmetros de secagem, se houver"; a faixa de temperatura cobre secagem de PETG/Nylon/TPU em estufas domésticas típicas | n |
| Faixas de validação: densidade `(0, 10] g/cm³`, bico `[0, 500] °C`, mesa `[0, 150] °C` | faixas acima | cobrem materiais FDM comuns e especiais (ex.: filamentos com carga metálica chegam a ~4-6 g/cm³) e ainda rejeitam erro de unidade (ex.: digitar gramas em vez de g/cm³) | n |
| Paginação: `page` 1-based, default `1`; `pageSize` default `20`, máx `100`; sem parâmetro de ordenação (fixa por `type,brand,color`) | shape acima | é a primeira lista paginada do sistema (nenhum módulo anterior pagina); esse contrato vira o que as Fases 7-10 copiam, então fica registrado como door em vez de decidido em silêncio | n |

**Open questions:** none - todas as decisões acima foram assumidas com um default e ficam
abertas para o usuário corrigir nesta revisão do plano.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| tela `/materials` | estado de carregamento | AC 22 |
| tela `/materials` | estado de erro | AC 23 |
| tela `/materials` | estado vazio | AC 24 |
| tela `/materials` | estado não autorizado (leitura-only) | AC 25 |
| tela `/materials` | ação destrutiva confirma antes de executar | AC 26 |
| tela `/materials` | densidade e ordenação da listagem | AC 8 |
| API `GET /materials` | forma de erro e códigos | AC 12, 13 |
| API `POST /materials` | forma de erro e códigos | AC 2, 3, 4, 6, 7 |
| API `PATCH /materials/:id` | forma de erro e códigos | AC 15, 16, 18 |
| API `PATCH /materials/:id` | quem pode chamar | AC 17, 18 |
| `AppShell` | item de menu novo aparece para os três papéis | AC 28 |
| tela `/materials` | criação/edição pelo admin reflete sem recarregar | AC 29, 30 |
| todas `/materials*` | versionamento, rate limit | n/a - módulo interno sem consumidor externo, mesmo padrão de `users`/`sales-channels` |

## Sources

- `ROADMAP.md`, Fase 6 (Tarefas e Critérios de aceite) - define os campos, o padrão de CRUD
  reutilizável e os critérios de aceite de origem
- `.specs/STATE.md` AD-014, AD-015, AD-018 - ids `uuid`, guard de autenticação e de papel por
  padrão, que este módulo herda sem alteração
