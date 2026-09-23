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

## Handoff

**Feature**: phase-8-customers-suppliers - concluída
**Where**: C1-C53 verificados. Rodada 1 (`standard`): FAIL - mutante sobrevivente no fluxo
"Editar" das telas `/customers` e `/suppliers` (nenhum teste clicava "Editar", então `submitEdit`
tinha cobertura zero), corpo `{ error }` não asserido em 12 combinações rota×status `400`/`409`
novas (AD-001 e o critério do ROADMAP "409 { error }" descobertos sem prova), e o `Test policy`
row da convivência de `document` nulo não provado pelos checks que ele nomeava (C1 apagava a
tabela entre as iterações, C23 criava um único fornecedor), mais 2 precision gaps (C14/C36 sem
`active`/`id`; C5/C27 sem espaço em volta para exercitar o trim). Fix em 4 arquivos de teste
(`api/test/customers.e2e-spec.ts`, `api/test/suppliers.e2e-spec.ts`,
`web/.../customers/page.test.tsx`, `web/.../suppliers/page.test.tsx`), nada em código de
produção - a mutação do fluxo "Editar" foi confirmada morta manualmente antes da rodada 2. Rodada
2 (escopada, `standard`): PASS, `validate_verification.py` exit 0. Validado também com o
Playwright MCP: vendas cadastra cliente só com nome, completa o CPF por edição, desativa com
confirmação, busca sem resultado mostra o vazio, e vê "Fornecedores" leitura-only; admin cadastra
e desativa fornecedor; produção confirma leitura-only nas duas telas
**In progress**: nada
**Next step**: nenhum bloqueio. Fases 9 (estoque de rolo), 16 (orçamentos) e 21 (compras) passam
a referenciar `Customer`/`Supplier` por FK, ainda inexistente hoje (`## Relations` do plano)
**Blockers**: nenhum
**Uncommitted**: `.specs/features/phase-8-customers-suppliers/verification.md`,
`.specs/lessons.json`, `.specs/LESSONS.md` (lições L-014 a L-016, candidate) e este `STATE.md` -
o resto da Fase 8 já está commitado (ver `git log`)
**Branch**: main
