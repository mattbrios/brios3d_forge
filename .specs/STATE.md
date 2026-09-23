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

## Handoff

**Feature**: phase-9-filament-inventory - concluída
**Where**: C1-C35 verificados (C33-C35 nasceram na rodada 1 fechando lacunas de cobertura).
Rodada 1 (`standard`): FAIL - 2 mutantes sobreviventes (a pré-checagem em JS de saldo deixava o
`CHECK (balance_grams >= 0)` do banco sem nenhuma prova sob concorrência, door 3; os valores
`vazio`/`descartado` de `status` nunca eram asserted, door 6a), mais 4 lacunas de cobertura (C5
mockava `manager.transaction` como pass-through sem provar que a transação era usada; as 3 rotas
de leitura só tinham prova do lado "barrado", nunca do lado "passa" para produção/vendas; os
filtros `status`/`search` de `GET /inventory/rolls` sem prova; `rollCount` do resumo por material
sem asserção). Fix em `inventory.service.ts` (removida a pré-checagem de `addMovement` - saldo
insuficiente, sequencial ou concorrente, passa sempre pelo mesmo `UPDATE` relativo + `CHECK`,
ver AD-023), `inventory.service.spec.ts` (assert que `manager.transaction` foi chamado) e
`inventory.e2e-spec.ts` (C33-C35 novos + asserções de `status`/`rollCount` adicionadas nos checks
existentes) - nada de código de produção além da remoção da pré-checagem. Rodada 2 (escopada,
`standard`): PASS, `validate_verification.py` exit 0, os 2 mutantes confirmados mortos por
reinjeção. Validado também com o Playwright MCP: admin cadastra material e rolo, pesa (812g/tara
250g → 562g, caso de referência do ROADMAP), dá baixa parcial, abre (idempotente), descarta com
confirmação; resumo por material atualiza saldo e custo médio a cada ação, incluindo custo médio
`null` quando nada sobra em estoque; produção não vê a ação de cadastrar rolo; vendas só lê, sem
nenhum formulário nem botão de descarte; busca por material sem resultado mostra o vazio
**In progress**: nada
**Next step**: nenhum bloqueio. Fase 10 (insumos e peças) reaproveita o ledger `InventoryMovement`
(AD-022) para um cadastro e uma tela separados; Fase 11 (alertas/QR) e Fase 19 (baixa automática
de job) passam a filtrar/gravar direto em `filament_rolls`/`inventory_movements`; Fases 12 e 25
consomem `GET /inventory/materials-summary` para o custo médio (AD-024)
**Blockers**: nenhum
**Uncommitted**: este `STATE.md` - o resto da Fase 9 já está commitado (ver `git log`)
**Branch**: main
