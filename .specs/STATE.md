# Project state

## Decisions

| ID | Decision | Rationale | Status | Date |
| --- | --- | --- | --- | --- |
| AD-001 | Todo erro da API responde `{ "error": string }` (chave única) e `500` responde sempre `"Internal server error"` | regra do `AGENTS.md`; um formato só para o web decodificar | active | 2026-09-21 |
| AD-002 | Schema só por migrations do TypeORM (`synchronize: false`), CLI rodando sobre `dist/` depois do build | evita perda de dados silenciosa; sem loader TS instalado e a API é ESM com decorators | active | 2026-09-21 |
| AD-003 | Entrada validada com `class-validator` + `ValidationPipe` global `{ whitelist, forbidNonWhitelisted, transform }` | padrão do Nest; DTO é tipo e schema ao mesmo tempo | active | 2026-09-21 |
| AD-004 | Módulos em `api/src/modules/<nome>/` (module/controller/service, `entities/`, `dto/`, spec ao lado) | 17 módulos previstos no roadmap; precedente vale para todos | active | 2026-09-21 |
| AD-005 | Web fala com a API só por `web/src/lib/api.ts` (`apiFetch`, `ApiError`) | um único lugar decodifica `{ error }` e lê `NEXT_PUBLIC_API_URL` | active | 2026-09-21 |
| AD-006 | Contrato de dinheiro e taxas: centavos com sufixo `Cents` (fracionários na entrada, inteiros na saída), percentuais como fração com sufixo `Rate`, horas decimais, pesos em gramas | o ROADMAP fixa centavos no cálculo; as fases 5, 12, 13, 16 e 25 consomem o mesmo contrato | active | 2026-09-21 |
| AD-007 | Arredondamento só em `pricing/rounding.ts`: custos meio para cima, preço de venda para cima (tolerância `1e-6`), agregados e preço partem dos valores exatos | a margem nunca fica abaixo da pedida; somar componentes já arredondados acumularia erro antes do markup | active | 2026-09-21 |
| AD-008 | Módulo puro lança erro de domínio próprio (`PricingError`), e o controller converte em `BadRequestException` | catálogo e relatórios chamam o cálculo fora de uma requisição, então o serviço não pode depender do HTTP | active | 2026-09-21 |
| AD-009 | Chamada HTTP de saída com `fetch` nativo, `redirect: "error"`, `AbortSignal.timeout`, corpo lido em stream com limite de tamanho, só para hosts fixos no código; a URL do usuário nunca vira a URL da requisição, só identificadores validados são interpolados | evita SSRF e dependência nova; as Fases 14, 28 e 29 também chamam serviços externos | superseded by AD-011 | 2026-09-21 |
| AD-010 | O sistema não lê, recebe nem guarda arquivos G-code/3MF. Os dados de impressão vêm da URL do MakerWorld ou do preenchimento manual | os arquivos passam de 200 MB; decisão do usuário ao revisar a Fase 2 | active | 2026-09-21 |
| AD-011 | Chamada HTTP de saída com `node:https` (`https.get`), sem seguir redirecionamento, `signal: AbortSignal.timeout`, corpo contado com limite de tamanho, só para hosts fixos no código; a URL do usuário nunca vira a URL da requisição, só identificadores validados são interpolados. User-Agent honesto, nunca de navegador | o Cloudflare do MakerWorld desafia o `fetch` nativo do Node (403) e aceita `node:https` com o mesmo User-Agent; mantém a proteção contra SSRF do AD-009 | active | 2026-09-21 |
| AD-012 | Produção em `brios3d.com.br`: web em `https://forge.brios3d.com.br`, API em `https://api.brios3d.com.br` | decisão do usuário; os dois hosts são o mesmo site (`.com.br` é sufixo público), então cookie `SameSite=Lax` e CORS com credenciais funcionam | active | 2026-09-21 |
| AD-013 | Sessão no servidor: token opaco de 32 bytes no cookie `forge_session` (`HttpOnly; SameSite=Lax; Path=/`, `Secure` salvo `SESSION_COOKIE_SECURE=false`), só o SHA-256 do token na tabela `sessions`, prazo fixo de 7 dias | logout e desativação revogam na hora; decisão do usuário na Fase 3 (questão 3 do ROADMAP) | active | 2026-09-21 |
| AD-014 | Entidades identificadas por `uuid` (`gen_random_uuid()`), a começar por `users` e `sessions` | ids sequenciais expõem volume e vizinhos em rotas como `/users/:id`; as FKs das Fases 9+ herdam a largura | active | 2026-09-21 |
| AD-015 | Toda rota da API exige sessão por padrão (`APP_GUARD` global); exceções declaram `@Public()` | uma rota nova esquecida responde `401` em vez de nascer aberta | active | 2026-09-21 |
| AD-016 | O web chama a API sempre com `credentials: "include"`, e a API habilita CORS com `credentials: true` só para `FRONTEND_URL` | o cookie de sessão mora no host da API; sem proxy do Next no meio (AD-005) | active | 2026-09-21 |
| AD-017 | Senhas com `scrypt` do `node:crypto`, no formato `scrypt$N=131072,r=8,p=1$<salt>$<hash>` (parâmetros dentro da string) | mínimo da OWASP sem dependência nativa; os parâmetros podem subir sem invalidar hashes antigos | active | 2026-09-21 |
| AD-018 | Autorização por padrão: `RolesGuard` (`APP_GUARD`, depois do `AuthGuard`) exige `admin` em toda rota protegida sem `@Roles()`; `@Roles(...)` libera outros papéis, e `admin` passa sempre sem precisar ser listado | uma rota nova esquecida nasce só de admin, nunca aberta a todo mundo; mesmo raciocínio do AD-015. Decisão do usuário na Fase 4 | active | 2026-09-22 |
| AD-019 | Contrato do usuário na administração (`PublicUser`): `{ id, name, email, role, active }` em `GET /users`, `POST /users` e `PATCH /users/:id`, sem `password_hash` nem datas | é o `AuthUser` da Fase 3 mais `active`; as fases seguintes que listam ou editam usuários reusam o mesmo formato | active | 2026-09-22 |
| AD-020 | Contrato de paginação/busca/filtro de toda lista futura: query `page` (1-based, default `1`), `pageSize` (default `20`, máx `100`), `search` (substring case-insensitive nos campos de texto do recurso), um filtro exato case-insensitive por campo (ex.: `type`); resposta `{ items, total, page, pageSize }` | primeira lista paginada do sistema (Fase 6, `GET /materials`); o ROADMAP nomeia esta fase como a que fixa o padrão que as Fases 7-10 copiam | active | 2026-09-22 |
| AD-021 | Componentes web reutilizáveis de CRUD em `web/src/components/crud/`: `DataTable<T>({ columns: { key, label, render? }[], rows, getRowId, renderActions? })`, `EntityForm<V>({ fields, values, onChange, onSubmit, submitting, error })`, `ConfirmDialog({ message, confirmLabel, onConfirm, onCancel, pending })` | Fase 6 introduz o padrão nomeado pelo ROADMAP ("padrão de CRUD reutilizável") que as Fases 7-10 devem copiar em vez de duplicar markup por tela | active | 2026-09-22 |
| AD-022 | Ledger de movimentação imutável (`InventoryMovement`): coluna `type` como enum Postgres, `quantityGrams` assinado (positivo em entrada, negativo em saída), `userId` obrigatório, sem rota de update/delete; o saldo é uma coluna materializada (`balanceGrams`) escrita na mesma transação do movimento, nunca recalculada por `SUM()` a cada leitura | Fase 9 introduz o padrão; a Fase 10 (insumos e peças) reaproveita a mesma tabela/shape para um cadastro e uma tela separados | active | 2026-09-23 |
| AD-023 | Decremento concorrente sobre uma coluna materializada: `UPDATE` relativo em SQL (`col = col - :delta`), nunca uma pré-checagem em JS a partir de um valor já lido; um `CHECK` de banco é o único backstop contra o valor ficar negativo, capturado pelo código de erro do Postgres (`isCheckViolation`, mesmo padrão de `isUniqueViolation` da Fase 4) e traduzido para `400` | Fase 9 é a primeira invariante numérica do sistema sob concorrência; uma pré-checagem em JS competindo com o `CHECK` deixa o `CHECK` sem nenhuma prova possível de exercitar (achado da verificação da Fase 9, rodada 1) | active | 2026-09-23 |
| AD-024 | Custo médio ponderado nunca é armazenado: sempre recalculado sob demanda a partir do estado atual do ledger (rolos não descartados com saldo > 0), exposto só por `GET /inventory/materials-summary` | Fase 9 decide isso explicitamente; as Fases 12 (calculadora) e 25 (margem real) devem chamar este endpoint em vez de introduzir um campo cacheado em `Material` | active | 2026-09-23 |
| AD-025 | Piso de estoque ("estoque mínimo") é uma coluna nula da própria tabela do cadastro (`materials.minimum_stock_grams`, `stock_items.minimum_quantity`), sem `DEFAULT`, com `CHECK` de não negatividade; `NULL` significa "sem política de reposição", nunca "mínimo zero". O alerta compara `saldo < piso` (estritamente abaixo) e é leitura derivada, nunca persistida, exposta só por `GET /inventory/alerts` | Fase 11 introduz o padrão; a Fase 15 (produto acabado) e a Fase 27 (projeção de compra) devem reusar a mesma coluna-por-dono e o mesmo `kind` de `StockAlert` em vez de criar tabela polimórfica de mínimos ou uma terceira lista na resposta | active | 2026-09-24 |
| AD-026 | Dado acessório do cabeçalho (hoje a contagem de alertas) é buscado pelo próprio componente do cabeçalho, nunca pelo `AuthGate`, e a falha degrada em silêncio - sem indicador e sem `role="alert"`, com a tela continuando a renderizar | Fase 11: o cabeçalho aparece em toda tela autenticada, então um erro ali apareceria no sistema inteiro por causa de um dado que o usuário não foi ver; buscar no `AuthGate` deixaria a sessão esperando por ele | active | 2026-09-24 |

## Handoff

**Feature**: phase-11-stock-alerts-qr - concluída (PASS na rodada 4; 3 rodadas independentes antes)
**Where**: C1-C63 em 5 commits (`7d51f03` API, `a0bc9d2` web, `e6dc929` form do piso no item,
`d462ec3` e `c146c1e` e `48458e1` fechando cobertura de tela achada pela verificação). Um builder só
(estimativa de 63k,
abaixo do orçamento de 150k, sem pergunta de mecanismo). API: `minimum_stock_grams` em `materials`
e `minimum_quantity` em `stock_items` (migration `AddStockMinimums`, colunas nulas sem `DEFAULT` +
2 `CHECK`), fold puro `computeStockAlerts` (`stock-alerts.ts`) e `GET /inventory/alerts` devolvendo
`{ items: StockAlert[] }` sem paginação, ordenado pela fração do piso que falta. A consulta parte de
`materials` com `LEFT JOIN filament_rolls ... AND discarded_at IS NULL` no `ON`, para material com
piso e zero rolo aparecer com saldo `0`. Web: tela `/inventory/alerts`, `AlertsIndicator` no slot
novo do `AppShell`, `/inventory/[id]/label` com `QRCodeSVG` (`qrcode.react` fixado em `4.2.0`),
`print:hidden` no `<header>` e no `<nav>`, campo do piso nos formulários de material e de item, e
"Imprimir etiqueta" no detalhe do rolo. `lint`, `test`, `test:e2e` e `build` verdes nas duas pastas
(108 unit + 333 e2e na API, 138 no web)
**Desvios do plano, todos registrados no diff**: (1) `Flow` hop 5 e a linha de `Impact` do
`AppShell` foram reescritos (são "kept true"): quem busca `/inventory/alerts` é o próprio
`AlertsIndicator`, não o `AuthGate` - ver AD-026. (2) O `migration:generate` propôs recriar 3 enums
(churn sem mudança de valor) e derrubar `FK_fixed_cost_items_settings_id`; nada disso pertence à fase
e ficou fora da migration, com o motivo escrito no arquivo. (3) `test/inventory-helper.ts` não ganhou
parâmetro de piso (rolo não tem piso; quem ganhou foram `materials-helper.ts` e
`stock-items-helper.ts`). (4) **Fora dos checks**: o detalhe do item (`/inventory/items/[id]`) ganhou
um formulário admin de "Estoque mínimo", porque a Fase 10 entregou o item só com formulário de
criação e sem isto nenhum item já cadastrado poderia receber um piso pela interface - o AC 7 ficaria
sem caminho de tela. (5) Dois testes de fases anteriores tiveram o conjunto esperado **ampliado**,
nunca relaxado: `inventory.e2e-spec.ts` "does not add stock or cost fields to GET /materials"
(o piso é política, não saldo nem custo - o door 5 da Fase 9 segue valendo) e
`inventory/items/page.test.tsx` (coluna "Mínimo" entre saldo e custo médio)
**Validação em navegador** (Playwright MCP, app em docker): piso de 1000 g no material com 800 g em
rolo e 10 un no insumo com 4 definidos pelos formulários; `/inventory/alerts` com os dois na ordem
certa (60% faltando antes de 20%) e links para `/inventory` e `/inventory/items/<id>`; indicador com
`2` no cabeçalho de `/printers`; entrada de 6 un derrubando para `1 item abaixo do mínimo`; piso do
material limpo levando ao estado vazio e ao indicador desaparecendo; erro da API mostrando
"Tentar novamente" sem tabela parcial e o cabeçalho degradando sem indicador e sem `role="alert"`;
etiqueta 70 × 40 mm com QR de 30 mm (`viewBox 0 0 45 45`), e **o QR foi decodificado de verdade** a
partir do PNG da etiqueta, devolvendo
`http://localhost:3000/inventory/28022a95-abf9-4c56-bd7a-a2e7b5deeecf`; sob `media: print` só o
bloco da etiqueta sai (header, nav, título e botão com `display: none`); a URL do QR sem sessão
redireciona para `/login?next=%2Finventory%2F<id>` e o login aterriza no rolo; vendas vê indicador e
tela sem nenhum botão ou input
**Verificação**: 4 rodadas, perfil `standard`. Rodadas 1, 2 e 3 por três sub-agentes independentes
distintos, todas FAIL, e todas pela **mesma forma**: um galho de tela que decide entre "sem política"
e um valor, sem asserção. Rodada 1: duas telas que o `Observable` decide (`materials form`,
`stock item form`) sem check nenhum -> C52-C58. Rodada 2: o lado `—` dos dois renders irmãos e o eixo
da etiqueta -> C59-C61. Rodada 3: **mutante sobrevivente** — o *prefill* dos dois formulários de
edição, terceira superfície do mesmo campo; prefilar `"0"` no lugar de `""` passava as três suítes, e
um admin salvaria política de zero só por abrir e salvar um cadastro sem piso -> C62-C63 (decisão do
usuário no limite de três rodadas: fechar a lacuna). Rodada 4: **PASS** — 63/63 checks com evidência
localizada, 29 conjuntos recomputados com 0 membros sem prova, 9 linhas de `Test policy` cumpridas, e
o mutante da rodada 3 reinjetado nos dois arquivos **morreu** com os outros 146 testes do web verdes.
Acumulado: 16 faltas injetadas, 16 mortas. `validate_verification.py` exit 0.
A rodada 4 é **degradada**: o despacho de sub-agente falhou duas vezes (`aborted`), então ela foi
feita pelo autor pelo caminho degradado do `verify.md`, marcada como `self-verified` no relatório e
sinalizada por WARN do gate. O que a sustenta: escopo estreito (reinjetar um mutante nomeado, um fato
observável) e C1-C61 carregados dos três verificadores independentes. O que ela não dá: um olhar novo
procurando o que o autor não pensou em procurar — que é justamente o que produziu os achados das três
rodadas anteriores
**In progress**: nada
**Next step**: nenhum bloqueio. Fase 12 (calculadora) consome `GET /inventory/materials-summary` e
`GET /inventory/items`; Fase 15 (produto acabado) e Fase 27 (projeção de compra) reusam AD-025; Fase
19 (baixa automática) e Fase 21 (recebimento de compra) escrevem nas mesmas colunas de saldo
**Riscos abertos**: (0) [FECHADO em 2026-09-25, fora de rodada] o prefill dos formulários de edição
estava guardado só por teste (C62, C63) e nunca tinha sido observado em navegador. Validado agora com
Playwright MCP contra o app em docker: material com piso (PLA, 1000 g) abre "Editar" com o spinbutton
mostrando `1000`; material sem piso (criado e depois desativado no teste) abre com o campo vazio
(`""`, nunca `"0"`); item de estoque com piso (Ímã 6x3, 20 un) mostra `20` no campo "Mínimo (un),
vazio para nenhum"; item sem piso (criado e desativado no teste) mostra `""`. Os dois lados dos dois
formulários confirmados via `input.value` lido no DOM, não só pela snapshot de acessibilidade. Nenhum
dado de teste ficou ativo (os dois registros criados para o teste foram desativados ao final).
(1) com zero alertas o indicador desaparece (AC 27) e não existe item de menu
para `/inventory/alerts`, então a tela de estado vazio só é alcançável por URL - inconsistência
entre o AC 25 e o AC 27 que pertence ao produto, não ao código; nenhum check pede o item de menu, e
adicioná-lo mudaria as listas exatas de `app-shell.test.tsx` (prova da Fase 4). (2) O
`migration:generate` continua propondo o churn de enums e o drop da FK de `fixed_cost_items` a cada
execução - dívida pré-existente do schema contra as entidades, não desta fase. (3) A suíte e2e
mostrou não-determinismo entre arquivos numa das rodadas (2 vermelhos em `inventory.e2e-spec.ts`,
um com status `426`), já registrado na lição L-030; a rodada seguinte veio 333/333 verde
**Blockers**: nenhum
**Uncommitted**: `.specs/STATE.md`, `.specs/LESSONS.md`, `.specs/lessons.json`, `AGENTS.md`,
`.gitignore` e `.agents/.skill-lock.json`
**Branch**: main

## Handoff anterior

**Feature**: phase-10-stock-items - concluída (Verifier PASS na rodada 3)
**Where**: C1-C57 construídos em 3 commits (`375e3e8` artefatos, `4b07126` API, `53ad563` web),
um builder só (estimativa de 37k, abaixo do orçamento de 150k). API: `StockItem` +
`StockItemPrinter`, 8 rotas novas em `inventory`, fold `computeStockItemAverageCost` (PMP por
replay do ledger), e o ledger `inventory_movements` passou a ter dono único
(`roll_id` XOR `stock_item_id`) com as colunas renomeadas para `quantity`/`unit_cost_cents` em
duas migrations (`CreateStockItems`, `AlterInventoryMovementsOwner`, esta última com
`RENAME COLUMN` e sem backfill). Web: telas `/inventory/items`, `/inventory/items/[id]` e
`/inventory/movements`, menu com "Filamento"/"Insumos e peças"/"Movimentações", e o detalhe do
rolo lendo as chaves novas. `lint`, `test`, `test:e2e` e `build` verdes nas duas pastas (107 unit
+ 299 e2e na API, 118 no web). Validado também no navegador contra o app rodando: custo médio
0,60/un depois de 100@50 e 100@70, consumo de 150 sem mexer na média, perda e contagem por
produção (ajuste de -5 no histórico), papéis (admin cadastra e dá entrada; produção só movimenta;
vendas só lê), estados de carregando/erro/vazio das duas telas novas, e o histórico do rolo
íntegro depois da renomeação (1000 g a 0,12/g, baixa -100)
**Verificação**: 3 rodadas, perfil `standard`, sempre por sub-agente independente.
Rodada 1: FAIL - 2 mutantes sobreviventes (o lado **aceito** de `preferredSupplierId` não tinha
prova em lugar nenhum, então um `assertSupplierExists` que recusasse todo fornecedor válido passava
pelos 72 testes; e C24 matava o mutante do AD-023 - pré-checagem em memória + `UPDATE` absoluto - em
só 1 de 4 rodadas, porque a intercalação era esperada e não forçada), mais 2 linhas de `Test policy`
sem cumprimento. Fix em `c8c1876`: nasceram C58 (lado aceito do fornecedor e do `location`, asserido
na resposta, na linha do banco, no detalhe, no `PATCH` e na lista) e C59 (7 lados recusados de
limite/formato do `POST`), e C24 passou a **forçar** a intercalação com um `SELECT ... FOR UPDATE` do
próprio teste. Rodada 2: FAIL - 1 mutante sobrevivente, o `UpdateStockItemDto` redeclara os 8
validadores em vez de estender o do `POST`, e nenhum lado recusado dele tinha prova (relaxar
`@MaxLength(150)` lá passava por 301/301). Fix em `fdff93c`: nasceu C60, 9 casos sobre o `PATCH`.
Rodada 3: **PASS** - 60/60 checks com evidência localizada, 3 sets recomputados com 0 membros sem
prova, 4 falhas injetadas e 4 mortas (incluindo a reinjeção do AD-023, morta 4 de 4),
`validate_verification.py` exit 0.
Rodada 4 (escopada ao passo 5, walk the flow): **PASS**. Existiu para corrigir um erro do autor - as
três primeiras rodadas registraram a validação em navegador como "fora de alcance" porque ele
afirmou que as ferramentas do Playwright MCP não estavam expostas, sem nunca tê-las chamado; elas
estavam. O MCP foi configurado em `.kiro/settings/mcp.json` (`npx @playwright/mcp@0.0.82
--headless`, chromium 1246 em cache) e um Verifier independente percorreu as telas: ACs 41-49 com
evidência de navegador, 3 sessões reais (admin, produção, vendas), incluindo o detalhe de um rolo
cujo ledger foi gravado **antes** da Fase 10, com as colunas de quantidade e custo íntegras depois
do `RENAME` (AC 48). Três notas sem reprovar: nenhuma tela define a compatibilidade peça×impressora
(o vínculo só entra pela API, e nenhuma fonte binding pede tela - buraco de produto que pertence ao
roadmap, e a Fase 22 é quem consome o vínculo), `Usuário` aparece como uuid no histórico porque é o
que o contrato devolve, e não há tela de edição de item. Lições L-023 a L-032 gravadas
**In progress**: nada
**Next step**: nenhum bloqueio. Fase 11 (estoque mínimo, alertas e QR) consome `stock_items` e
`filament_rolls`; Fase 21 (recebimento de compra) e Fase 15 (produto acabado) copiam o precedente do
door 6 (cadastro sem movimento, entrada como segunda chamada) e, no caso da Fase 15, pagam a coluna
nula do door 3; Fase 22 (manutenção) consome `stock_item_printers` para a pergunta inversa "quais
peças servem nesta impressora"; Fase 12 passa a puxar o custo médio de insumo de
`GET /inventory/items` em vez do parâmetro solto de `pricing`
**Riscos abertos** (levantados pela verificação, nenhum reprovando a fase): (1) a suíte e2e tem
não-determinismo **entre arquivos**, pré-existente e fora desta fase - a rodada 3 viu 2 vermelhos em
`test/sales-channels.e2e-spec.ts` (Fase 5) sem nada concorrente, um deles com status `426`, que não
existe em `api/src`, o que indica vazamento no transporte e não no dado (lição L-030); (2) C23
declara na claim um mecanismo (`CHECK` sobre `UPDATE` relativo) que as suas asserções não
distinguem - quem distingue é C24; (3) "cada lado recusado" dos DTOs é operacionalizado por campo e
não por decorator, então `@IsString()`, `@IsArray()` e o `@IsNotEmpty()` dos textos opcionais ficam
sem caso (consequência real hoje é zero: a tela envia `sku || undefined`)
**Blockers**: nenhum
**Uncommitted**: nada além deste `STATE.md`
**Branch**: main
