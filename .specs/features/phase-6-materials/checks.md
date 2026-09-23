# Fase 6 — Materiais · checks

Profile: standard
Plan: `.specs/features/phase-6-materials/plan.md`

## Intent

37 checks em 5 fatias · 2 one-way doors · nenhuma questão aberta (C34-C37 acrescentados após a
rodada 1 de verify: ver `## Handoff`)

O `AGENTS.md` não declara perfil. Uso `standard`, o mesmo das Fases 1-5: esta fase introduz duas
formas de decisão sem analogê direto no repositório - a paginação/busca/filtro (primeira lista
paginada do sistema) e a obrigatoriedade condicional dos campos de secagem quando
`needsDrying=true` - além do próprio padrão de componentes web reutilizáveis que as Fases 7-10 vão
copiar. Um `light` prova o caminho feliz de cada uma; um `standard` injeta a falha na borda de
cada faixa (densidade, temperatura, paginação, secagem) e no operador de comparação, e confere
que o teste morre, além de recomputar a junção de `Coverage` a partir das fontes (não do resumo
do autor).

Os valores esperados vêm do `plan.md` (`## Criteria` e `## Landing`) e ficam escritos
**literalmente** nas asserções, nunca derivados chamando o próprio código em teste.

Os e2e (`npm --prefix api run test:e2e`) montam o `AppModule` contra o `forge_test`, com o `db` no
ar e as migrations aplicadas antes da suíte (padrão da Fase 0). O arquivo cria e apaga só os
materiais/admins que precisa, como os arquivos das Fases 3-5 já fazem (`auth-helper.ts`). No web,
Vitest + Testing Library com o `fetch` substituído, como em `sales-channels/page.test.tsx`; os
três componentes novos de `web/src/components/crud/` ganham teste próprio, isolado da tela de
materiais, porque são o contrato que a Fase 7 em diante vai consumir.

## Checks

### S1 - Cadastrar material, só admin · 6 files · 16 KB · ~6k

**C1** - `POST /materials` com um PLA completo (`type`, `brand`, `color`, `densityGCm3: 1.24`,
`nozzleTempC: 210`, `bedTempC: 60`, `needsDrying: false`) e sessão de `admin` responde `201` com o
material criado, `id` de string não vazia e `active: true` (AC 1)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "creates a material with active true"`

**C2** - Tabela sobre `densityGCm3` (`0` e `10.01`), `nozzleTempC` (`-1` e `501`) e `bedTempC`
(`-1` e `151`) em `POST /materials` (6 casos): cada um responde `400`, e nenhum material é
persistido (AC 2)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "rejects out-of-range density and temperature fields"`

**C3** - Tabela sobre `type`, `brand` e `color` vazios ou só espaços em `POST /materials` (3
casos): cada um responde `400`, e nenhum material é persistido (AC 3)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "rejects empty type, brand or color"`

**C4** - Tabela sobre `needsDrying: true` com `dryingTemperatureC` ausente, `-1` e `121`, e
`dryingHours` ausente e `0` (5 casos): cada um responde `400`, e nenhum material é persistido
(AC 4)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "rejects invalid drying parameters when needsDrying is true"`

**C5** - `POST /materials` com `needsDrying: false` e `dryingTemperatureC: 60`, `dryingHours: 4`
enviados mesmo assim responde `201` com `dryingTemperatureC: null` e `dryingHours: null` gravados
(AC 5)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "ignores drying fields when needsDrying is false"`

**C6** - `POST /materials` com sessão de `production` e de `sales` responde `403` para os dois, e
nada é persistido (AC 6)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "non-admin roles get 403 on POST /materials"`

**C7** - `POST /materials` sem cookie de sessão responde `401`, e nada é persistido (AC 7)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "POST /materials without a session is 401"`

### S2 - Listar materiais com paginação, busca e filtro · 3 files · 10 KB · ~4k

**C8** - Com 3 materiais semeados, `GET /materials` sem parâmetros e sessão de `admin`,
`production` e `sales` responde `200` para os três com `{ items, total: 3, page: 1, pageSize: 20 }`
e `items` ordenado por `type`, depois `brand`, depois `color` (AC 8)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "GET /materials returns the first page for every role, ordered by type, brand and color"`

**C9** - Com materiais `PLA`/`pla`/`PETG` semeados, `GET /materials?type=pla` responde só com os
dois materiais cujo `type` é `PLA` ou `pla` (comparação ignorando caixa) (AC 9)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "filters by type ignoring case"`

**C10** - Com materiais cujo `type`, `brand` e `color` contêm "Vermelho" espalhados nos três
campos, `GET /materials?search=vermelho` responde só com esses materiais (comparação ignorando
caixa) (AC 10)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "searches across type, brand and color ignoring case"`

**C11** - Com 15 materiais semeados (nomeados para uma ordenação previsível), `GET
/materials?page=2&pageSize=10` responde com os 5 itens seguintes aos 10 primeiros da ordenação de
C8 e `total: 15` (AC 11)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "paginates with page and pageSize"`

**C12** - Tabela sobre `page=0`, `pageSize=0` e `pageSize=101` (3 casos): cada um responde `400`
(AC 12)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "rejects invalid page and pageSize"`

**C13** - `GET /materials` sem cookie de sessão responde `401` (AC 13)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "GET /materials without a session is 401"`

### S3 - Editar material, só admin · 4 files · 8 KB · ~3k

**C14** - `PATCH /materials/:id` alterando só `color` responde `200` com `color` novo e todos os
outros campos iguais ao material antes do PATCH (AC 14)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "PATCH persists only the sent fields"`

**C15** - `PATCH /materials/:id` com um uuid que não existe responde `404` (AC 15)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "PATCH with an unknown id is 404"`

**C16** - Tabela sobre as mesmas 10 bordas do AC 2 e do AC 4 (densidade, bico, mesa, e os 4 casos
de secagem alcançáveis por um corpo de PATCH - temperatura ausente/baixa/alta, horas ausentes) em
`PATCH /materials/:id`: cada uma responde `400`, e o registro no banco continua com os valores
anteriores de `densityGCm3`, `nozzleTempC`, `bedTempC` e `needsDrying` (AC 16)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "rejects invalid fields on PATCH without changing the record"`

**C17** - `PATCH /materials/:id` com sessão de `production` e de `sales` responde `403` para os
dois (AC 17)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "non-admin roles get 403 on PATCH /materials"`

**C18** - `PATCH /materials/:id` sem cookie de sessão responde `401` (AC 18)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "PATCH /materials without a session is 401"`

**C34** - Um material gravado direto no banco com `needsDrying: true` e `dryingHours: 0` (estado
que o DTO recusa na entrada, mas que o registro já carrega) recebe um `PATCH` que não toca nos
campos de secagem (só `color`): responde `400`, e `color` não muda. Prova que o valor final é
revalidado mesmo quando vem do registro, não só do corpo do PATCH (AC 16, último membro da faixa
de secagem: `dryingHours <= 0`)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "rejects a PATCH that leaves needsDrying true with an existing dryingHours of zero"`

**C35** - `POST /materials` com `type` de 41 caracteres, `brand` ou `color` de 101 caracteres, ou
`needsDrying` como string em vez de boolean (4 casos): cada um responde `400`, e nenhum material é
persistido (Assumptions do plano: `type` 1-40 caracteres; DTOs de `materials`, Test policy)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "rejects out-of-bounds string lengths and a non-boolean needsDrying"`

**C36** - `GET /materials?page=1.5`, `?page=abc` e `?pageSize=abc` (3 casos): cada um responde
`400` (contrato de paginação do Landing - `page`/`pageSize` são inteiros)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "rejects a non-integer page or pageSize"`

**C37** - `PATCH /materials/nao-e-uuid` (id malformado, não-uuid) responde `400` (`ParseUUIDPipe`,
mesmo padrão de `users`/`sales-channels`; AC 15 cobre só o uuid bem-formado mas inexistente, que
continua `404` via C15)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "PATCH with a non-uuid id is 400"`

### S4 - Ativar e desativar material · 1 file · 2 KB · ~1k

**C19** - `PATCH /materials/:id` com `{ "active": false }` responde `200` com `active: false`, e o
material continua existindo no banco (AC 19)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "deactivates a material without deleting it"`

**C20** - `PATCH /materials/:id` com `{ "active": true }` num material antes desativado responde
`200` com `active: true` (AC 20)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "reactivates an inactive material"`

**C21** - `DELETE /materials/:id` responde `404` (rota nunca declarada no controller) (AC 21)
Proof: `npm --prefix api run test:e2e -- test/materials.e2e-spec.ts -t "DELETE /materials/:id does not exist"`

### S5 - Padrão de CRUD reutilizável e tela de materiais · 9 files · 46 KB · ~15k

**C22** - A tela `/materials` mostra "Carregando…" antes do `GET /materials` (mock) resolver
(AC 22)
Proof: `npm --prefix web run test -- src/app/(app)/materials/page.test.tsx -t "shows loading"`

**C23** - Com o `GET /materials` (mock) rejeitando, a tela mostra a mensagem de erro e um botão
"Tentar novamente" que refaz a chamada (AC 23)
Proof: `npm --prefix web run test -- src/app/(app)/materials/page.test.tsx -t "shows the error and retries"`

**C24** - Com o `GET /materials` (mock) resolvendo `{ items: [], total: 0, page: 1, pageSize: 20 }`,
a tela mostra um estado vazio com um texto diferente do estado de erro (AC 24)
Proof: `npm --prefix web run test -- src/app/(app)/materials/page.test.tsx -t "shows an empty state when there are no materials"`

**C25** - Como `production` (ou `sales`), a tela mostra a listagem sem formulário de criação nem
botões de editar/ativar/desativar (AC 25)
Proof: `npm --prefix web run test -- src/app/(app)/materials/page.test.tsx -t "non-admin sees the list without edit controls"`

**C26** - Como `admin`, clicar em "Desativar" numa linha abre o `ConfirmDialog`; cancelar não
chama a API, e confirmar chama `PATCH /materials/:id` (mock) com `{ active: false }` e atualiza a
linha (AC 26)
Proof: `npm --prefix web run test -- src/app/(app)/materials/page.test.tsx -t "confirms before deactivating"`

**C27** - Como `admin`, submeter o formulário de criação com `densityGCm3: 15` (mock `POST`
respondendo `400 { error }`) mostra essa mensagem de erro sem alterar a listagem (AC 27)
Proof: `npm --prefix web run test -- src/app/(app)/materials/page.test.tsx -t "shows the create error without reloading the list"`

**C28** - `AppShell` com `role="admin"`, `role="production"` e `role="sales"` mostra "Materiais"
no menu para os três, junto dos itens já existentes (AC 28)
Proof: `npm --prefix web run test -- src/components/app-shell.test.tsx -t "materials appears for every role"`

**C29** - Como `admin`, submeter o formulário de criação com dados válidos (mock `POST` `201`)
adiciona a nova linha à listagem com os dados devolvidos, sem recarregar a página (AC 29)
Proof: `npm --prefix web run test -- src/app/(app)/materials/page.test.tsx -t "admin creates a material without reloading"`

**C30** - Como `admin`, editar um material existente e salvar (mock `PATCH` `200`) atualiza a
linha correspondente com os dados devolvidos, sem recarregar a página (AC 30)
Proof: `npm --prefix web run test -- src/app/(app)/materials/page.test.tsx -t "admin edits a material without reloading"`

**C31** - `DataTable` isolado, com colunas e linhas arbitrárias (não as de `Material`), renderiza
uma célula com `render` customizado e uma sem, e chama `renderActions` uma vez por linha (door 2)
Proof: `npm --prefix web run test -- src/components/crud/data-table.test.tsx -t "renders columns and rows with a custom cell render"`

**C32** - `EntityForm` isolado, com uma configuração de campos arbitrária, chama `onChange` ao
digitar, mostra o `error` recebido por prop e desabilita o submit enquanto `submitting` é `true`
(door 2)
Proof: `npm --prefix web run test -- src/components/crud/entity-form.test.tsx -t "renders fields, reports changes and reflects submitting/error state"`

**C33** - `ConfirmDialog` isolado chama `onConfirm` ao confirmar, `onCancel` ao cancelar e não
chama nenhum dos dois enquanto `pending` é `true` (door 2)
Proof: `npm --prefix web run test -- src/components/crud/confirm-dialog.test.tsx -t "confirms, cancels and disables both while pending"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /materials` statuses (3) | 200 C8 · 400 C12 · 401 C13 | - |
| `POST /materials` statuses (4) | 201 C1 · 400 C2, C3, C4 · 401 C7 · 403 C6 | - |
| `PATCH /materials/:id` statuses (5) | 200 C14, C19, C20 · 400 C16 · 401 C18 · 403 C17 · 404 C15 | - |
| doors do plano (2) | 1 contrato de paginação/busca/filtro C8, C9, C10, C11, C12 · 2 componentes web reutilizáveis C31, C32, C33 | - |
| papéis que leem `GET /materials` (3) | `admin` C8 · `production` C8 · `sales` C8 | - |
| papéis barrados na escrita (4) | `POST` × `production` C6 · `POST` × `sales` C6 · `PATCH` × `production` C17 · `PATCH` × `sales` C17 | - |
| bordas de densidade/temperatura (6) | `densityGCm3` baixo C2 · `densityGCm3` alto C2 · `nozzleTempC` baixo C2 · `nozzleTempC` alto C2 · `bedTempC` baixo C2 · `bedTempC` alto C2 | - |
| campos vazios em `POST /materials` (3) | `type` C3 · `brand` C3 · `color` C3 | - |
| secagem condicional (5) | temperatura ausente C4 · temperatura `< 0` C4 · temperatura `> 120` C4 · horas ausentes C4 · horas `<= 0` C4 | - |
| bordas de paginação (3) | `page < 1` C12 · `pageSize < 1` C12 · `pageSize > 100` C12 | - |
| transições de `active` (3) | ativo -> inativo C19 · inativo -> ativo C20 · exclusão física nunca existe C21 | - |
| estados de tela (4) | carregando C22 · erro C23 · vazio C24 · formulário com erro C27 | - |
| UI por papel (2) | `admin` usa os controles (criar C29, editar C30, desativar C26) · não-`admin` não vê os controles C25 | - |
| item de menu (1) | "Materiais" para os três papéis C28 | - |
| faixas revalidadas no `PATCH` (11) - AC 16, mesmas bordas do AC 2 + AC 4 | `densityGCm3` baixo C16 · `densityGCm3` alto C16 · `nozzleTempC` baixo C16 · `nozzleTempC` alto C16 · `bedTempC` baixo C16 · `bedTempC` alto C16 · temperatura de secagem ausente C16 · temperatura de secagem baixa C16 · temperatura de secagem alta C16 · horas de secagem ausentes C16 · horas de secagem `<= 0` (valor já gravado) C34 | - |
| regras de `class-validator` sem borda provada até a rodada 1 do verify (4) | `type` acima de 40 C35 · `brand`/`color` acima de 100 C35 · `needsDrying` não-boolean C35 · `page`/`pageSize` não-inteiro C36 | - |
| id malformado vs. inexistente em `PATCH /materials/:id` (2) | malformado -> `400` C37 · uuid bem-formado inexistente -> `404` C15 | - |

- Claims que citam um código de status, rota ou formato de resposta: C1-C21, C34-C37 - cada uma
  tem uma prova que cruza a fronteira HTTP (e2e real contra o `AppModule`)
- Nenhuma claim afirma mais do que o único caso que a prova exercita

## Test policy

O repo já decide, desde a Fase 4, onde prova um guard de autorização: rota para o contrato HTTP
(e2e). O que esta fase introduz de novo - paginação/busca/filtro e a obrigatoriedade condicional
de secagem - não tem analogê exato no repositório, então aplico a mesma régua da Fase 5 para
decidir o nível: decisão sem ramo invisível na própria rota vai só no e2e; o padrão de componentes
web reutilizáveis, por ser o próprio contrato que a Fase 7 em diante vai consumir, ganha teste de
componente isolado além do teste de integração via `/materials`.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| `MaterialsController` - `RolesGuard` aplicado (decide, alcançado pela rota, mesma forma da Fase 4/5) | um e2e por combinação rota × papel | as 3 rotas × os papéis onde aplicável (C1, C6, C7, C8, C13, C14, C17, C18, C19, C20, C21) |
| `MaterialsService` - faixas de densidade/temperatura (decide, sem estado entre requisições, mesma forma do `Min`/`IsBelowOne` já usados em `pricing`/`sales-channels`) | e2e tabela-driven por campo | as 6 bordas no `POST` (C2) e as mesmas 6 revalidadas no `PATCH` (C16) |
| `MaterialsService`/DTO - obrigatoriedade condicional de secagem quando `needsDrying=true` (decide; forma nova, analogê mais próximo é a validação por item de `fixedCostItems` da Fase 5) | e2e tabela-driven pelos 5 casos, na entrada (DTO) e na revalidação do valor final (serviço) | temperatura ausente, `<0`, `>120`, horas ausentes, `<=0` no `POST` (C4); caminho `needsDrying=false` ignora os campos (C5); os mesmos 4 casos alcançáveis por corpo revalidados no `PATCH` (C16) e o 5º (`dryingHours<=0` já gravado) via registro pré-existente (C34) |
| `MaterialsService` - paginação/busca/filtro (decide; forma nova, sem analogê no repositório - primeira lista paginada do sistema) | e2e por comportamento | ordenação estável (C8), filtro exato (C9), busca substring (C10), corte de página (C11), bordas de `page`/`pageSize` (C12), não-inteiro (C36) |
| `DataTable`/`EntityForm`/`ConfirmDialog` (decide; renderização condicional por props genéricas - é o próprio padrão reutilizável que esta fase introduz) | um teste de componente isolado (contrato genérico) e um teste de integração via `/materials` (consumidor real) | contrato genérico (C31, C32, C33) e o consumo real na tela (C22-C30) |
| DTOs de `materials` (validação, sem lógica própria) | e2e tabela-driven por DTO | cada regra do `class-validator`, incluindo as bordas: faixas numéricas (C2, C3, C4, C12), tamanho de string e tipo de `needsDrying` (C35), inteiro de `page`/`pageSize` (C36), uuid malformado em `:id` (C37) |

Evidence:

- `materials.service.ts` (novo): decide sobre 3 faixas de valor (densidade, bico, mesa) -> mesma
  forma decisória do `Min`/`IsBelowOne` já usados em `sales-channels`/`pricing`, provado no mesmo
  nível (e2e/DTO, sem unidade isolada)
- `materials.service.ts`/`dto/create-material.dto.ts` (novo): obrigatoriedade condicional de
  `dryingTemperatureC`/`dryingHours` -> analogê mais próximo é a validação por item de
  `fixedCostItems` (Fase 5, `settings.e2e-spec.ts`), provada só no e2e porque a regra não existe
  fora da rota
- `materials.service.ts` (novo): offset/limit/count/ordenação -> sem analogê no repositório
  (primeira lista paginada); provado no e2e porque a regra depende do TypeORM query builder
  contra o banco real, não de uma função pura isolável
- `web/src/components/crud/*.tsx` (novos): é o próprio padrão reutilizável que a Fase 6 introduz
  para as Fases 7-10 copiarem -> por isso ganha teste de componente isolado (garante o contrato
  genérico) além do teste de integração via `/materials`

Cost: 1 arquivo e2e novo na API (`materials.e2e-spec.ts`), 3 arquivos de teste de componente novos
no web, 1 teste de página novo, 1 arquivo de teste existente estendido (`app-shell.test.tsx`). Sem
os checks C31 a C33, um `DataTable` que só funciona para as colunas exatas de `/materials`
passaria pela tela de materiais e quebraria silenciosamente na primeira reutilização da Fase 7.

## Swept

- validation: C2, C3, C4, C12, C16, C34, C35, C36, C37 - bordas de densidade/temperatura (POST e
  PATCH), campos vazios, secagem condicional (POST, PATCH e valor já gravado), paginação,
  tamanho de string, tipo de `needsDrying` e uuid malformado
- failure modes: C2, C3, C4, C12, C16, C34, C35, C36 - toda rejeição responde `400 { error }` sem
  gravar ou alterar nada
- idempotency, retry, duplicates: n/a - sem restrição de unicidade sobre `type`+`brand`+`color`
  (Relations do plano), então não há duplicata a impedir; `PATCH` já é idempotente por natureza
  (repetir o mesmo corpo produz o mesmo estado), sem chave de deduplicação necessária
- authorization: C6, C7, C13, C17, C18 - sessão e papel nas 3 rotas
- concurrency and ordering: C8 - a ordenação estável (`type`, `brand`, `color`) garante paginação
  consistente entre chamadas concorrentes de leitura; sem restrição de unicidade (Landing) não há
  corrida de escrita a provar
- data lifecycle: n/a - sem TTL nem arquivamento; o único ciclo de vida é `active`/`inactive`,
  coberto em state transitions
- external-dependency failure: n/a - `materials` não chama nenhum serviço externo
- state transitions: C19, C20, C21 - ativo -> inativo -> ativo, e nunca exclusão física
- observability: n/a - mesma decisão das Fases 4/5: nenhum AC desta fase exige uma linha de log
  específica

## Out of scope

`plan.md` já carrega `## Out of scope`; nada adicional surgiu na derivação dos checks.

## Handoff

Novos: `materials.module.ts`, `materials.controller.ts`, `materials.service.ts`,
`materials.types.ts`, `entities/material.entity.ts`, `dto/create-material.dto.ts`,
`dto/update-material.dto.ts`, `dto/list-materials.dto.ts`, 1 migration
(`CreateMaterials.ts`), `test/materials.e2e-spec.ts` ≈ 30 KB. Existente tocado: `app.module.ts`
(registra `MaterialsModule`) ≈ 1 KB. Web novos: `lib/materials.ts`,
`components/crud/data-table.tsx` + teste, `components/crud/entity-form.tsx` + teste,
`components/crud/confirm-dialog.tsx` + teste, `app/(app)/materials/page.tsx` + teste ≈ 46 KB.
Web existente tocado: `app-shell.tsx` + teste (um item de menu) ≈ 2 KB.

- S1-S4 ≈ 31 KB na API; S5 ≈ 48 KB no web ≈ 79 KB ≈ 20k tokens no total. Abaixo do orçamento
  padrão de 150k: um builder só, sem pergunta
- Validação final com o Playwright MCP (`AGENTS.md`): entrar como `admin`, abrir `/materials`,
  cadastrar um material com secagem, editar a densidade, desativá-lo com confirmação e ver o
  estado vazio filtrando por um tipo inexistente; entrar como `sales`, confirmar que a tela fica
  só leitura e que "Materiais" aparece no menu

<Preenchido pelo builder ao final:>

- **Boundary:** um builder só, como estimado; nenhum handoff precisou ser acionado.
- **Settled mid-build:** `migration:generate` também propôs recriar o enum
  `users_role_enum` e a FK de `fixed_cost_items` (ruído do comparador do TypeORM, idênticos ao
  schema já existente) - removidos da migration final, que só cria `materials` (Impact do
  plano); `EntityForm<V>` usa `V extends object` em vez de `V extends Record<string, unknown>`
  (o segundo rejeita interfaces concretas no `next build`, por não terem index signature
  estrutural); `roles.guard.spec.ts` (Fase 4) precisou ganhar `materials.controller.ts` na
  whitelist de `@Roles()`, e a "Matriz de permissões" do `ROADMAP.md` foi preenchida
  (`materials`: admin x, production/sales leitura), ambos já previstos no Impact do plano.
  Rodada 1 do verify (`standard`) devolveu FAIL: um mutante sobrevivente na revalidação de
  secagem do `PATCH` (`finalDryingHours > 0` -> `>= 0` passava pelos 144 e2e, porque nenhum teste
  de `PATCH` semeava `needsDrying: true`) e 3 lacunas de cobertura/`Test policy` (as mesmas
  faixas do AC 2/AC 4 revalidadas no `PATCH`, e regras de `class-validator` sem borda provada:
  tamanho de string, tipo de `needsDrying`, inteiro de `page`/`pageSize`; mais um precision gap
  nos checks sobre id malformado). C16 foi ampliado para tabela-driven e C34-C37 foram
  acrescentados para fechar as 4 lacunas; nenhum código de produção mudou, só os testes (e a
  descrição de C16). Mutante confirmado morto manualmente antes da rodada 2 do verify.
- **Abandoned:** nada.
