# Fase 4 — Usuários e papéis · verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: `dd8f50c`..working tree (a fase inteira segue sem commit; a base é o topo de `main`)
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

**Resumo**: 53/53 checks provados com evidência localizada · 10 faltas injetadas nesta rodada,
**10 mortas, 0 sobreviventes** · 5 conjuntos de `Coverage` recomputados agora (os outros 18
carregados da rodada 1) · 5 linhas de `Test policy`, todas cumpridas.

As 4 lacunas de check da rodada 1 (C1, C4, C15, C33) estão fechadas, o mutante sobrevivente F4
agora morre, os 3 comandos de prova que não casavam com teste nenhum agora casam, e os 3 membros
de `Coverage` não provados agora têm asserção própria.

## Escopo desta rodada

Rodada escopada, conforme "Re-verifying after a fix" do `verify.md`. O que foi refeito **agora**,
no working tree atual, e o que vem da rodada 1:

| Seção | Estado |
| --- | --- |
| Provas (todas as 53) | **reverificadas agora** — nunca se herda verde |
| Checks C1, C4, C7, C8, C10, C14, C15, C19, C21, C22, C24, C25, C33, C37, C40, C51, C53 | **reverificados agora** (citação e asserção refeitas nos arquivos que o fix tocou) |
| Demais checks | carregados da rodada 1 (veredito PASS restabelecido; nenhum arquivo do fix os toca) |
| `Coverage`: `403` de `GET/POST/PATCH /users`, door 2 por rota, arranjo da tabela `/users`, revogação de sessão | **recomputados agora** |
| Demais linhas de `Coverage` (18) | carregadas da rodada 1 |
| `Test policy` linha 3 (revogação de sessão) | **rejulgada agora** |
| `Test policy` linhas 1, 2, 4, 5 | carregadas da rodada 1 |
| Faltas injetadas | **10 novas**, só nas superfícies que o fix tocou ou criou. F1/F2/F3/F5 da rodada 1 não foram reinjetados (nada perto deles mudou) |
| `Swept existing` | carregado da rodada 1, com as duas ressalvas da rodada 1 agora resolvidas |
| Step 1 (binding sources) | não se aplica — perfil `standard` |

---

## Gate

Uma invocação por alvo, com `--reporter=verbose`, para que **cada teste nomeado apareça
individualmente** na saída como tendo rodado e passado. Todos os nomes citados abaixo foram
conferidos na saída dessas execuções, não lidos do arquivo.

| Alvo | Comando (rodado neste working tree) | Saída |
| --- | --- | --- |
| API e2e | `npm --prefix api run test:e2e -- --testTimeout=180000 --reporter=verbose` | 12 arquivos, **95 passed, 0 failed** |
| API unit | `npm --prefix api run test -- --testTimeout=60000 --reporter=verbose` | 20 arquivos, **94 passed, 0 failed** |
| Web | `npm --prefix web run test -- --reporter=verbose` | 10 arquivos, **58 passed, 0 failed** |
| C6 (shell) | `grep -c "^\| \`" ROADMAP.md \| test "$(grep -A30 '## Matriz de permissões' ROADMAP.md \| grep -c '^\| \`')" -eq 17` | exit 0 (contagem = 17) |
| C53 (shell) | `grep -q "role?: UserRole" web/src/components/app-shell.tsx && grep -q "role={state.user.role}" web/src/components/auth-gate.tsx` | exit 0 |

**Sobre o `--testTimeout`.** Rodei o e2e três vezes com o timeout padrão do repositório
(`vitest.config.e2e.ts`, `testTimeout: 30_000`). Em duas delas, 2 testes estouraram os 30 s; em
uma delas, nenhum. Não é falha de asserção: são estouros de tempo em testes que encadeiam vários
`scrypt` (`N=2^17`) numa máquina com `load average` 6,2 e a VM do Docker em 281 % de CPU. Isolado,
o pior deles (`a correct login never counts as a failure`, código da Fase 3 que este diff não
toca) roda em **4,3 s**. Com o timeout elevado, a suíte fecha **95/95 verdes**, que é a linha
registrada acima. Registrado como observação de ambiente, não como lacuna — veja
`## Observações residuais`.

---

## Checks

### S1 — Autorização por papel na API

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | rota sem `@Roles()` é só de admin, `403` com a mensagem exata, **e a mesma regra na rota real `GET /users`** | `roles.e2e-spec.ts > route without @Roles is admin only` ✓ · `users.e2e-spec.ts > non-admin roles get 403 on the real /users route` ✓ | `api/test/roles.e2e-spec.ts:92` `expect(production.status).toBe(403)` · `:93` `toEqual(PERMISSION_DENIED)` · `:96` sales `403` · `:100` admin `200`; rota real: `api/test/users.e2e-spec.ts:139` `expect(response.status).toBe(403)` · `:140` `toEqual({ error: 'Você não tem permissão para esta ação' })`, no laço `:137` sobre production e sales | PASS (reverificado nesta rodada) |
| C2 | `@Roles('sales')` admite sales, recusa production, admin passa sem estar listado | `roles.e2e-spec.ts > declared roles admit them, admin always passes` ✓ | `api/test/roles.e2e-spec.ts:106` `expect(sales.status).toBe(200)` · `:109` `expect(production.status).toBe(403)` · `:113` `expect(admin.status).toBe(200)` | PASS (carregado da rodada 1, citação refeita) |
| C3 | sem cookie é `401` `SESSION_REQUIRED`, não `403` | `roles.e2e-spec.ts > no session is 401, not 403` ✓ | `api/test/roles.e2e-spec.ts:118` `expect(roles.status).toBe(401)` · `:119` `toEqual(SESSION_REQUIRED)` · `:122-123` idem em `/probe-sales` | PASS (carregado da rodada 1, citação refeita) |
| C4 | papel mudado por `PATCH` vale na requisição seguinte: `/probe-sales` `403`, `/probe-roles` `403` **e uma rota `@Roles('production')` responde `200`** | `roles.e2e-spec.ts > a role change applies on the next request` ✓ | `api/test/roles.e2e-spec.ts:139` `expect(afterSales.status).toBe(403)` · `:143` `expect(afterRoles.status).toBe(403)` · **`:148` `expect(afterProduction.status).toBe(200)`** contra a rota `@Roles('production') @Get('probe-production')` criada em `:39-43` · `:149` `toEqual({ ok: true })` | PASS (lacuna da rodada 1 fechada) |
| C5 | rotas pré-existentes abertas a `production` e `sales` | `roles.e2e-spec.ts > pre-existing routes stay open to every role` ✓ | `api/test/roles.e2e-spec.ts:155` pricing `200` · `:161` import `200` · `:164` `/auth/me` `200` · `:170` `expect(password.status).not.toBe(403)`, os dois papéis no laço `:153` | PASS (carregado da rodada 1, citação refeita) |
| C6 | `@Roles()` só nos controllers documentados + matriz com 17 linhas | `roles.guard.spec.ts > roles decorator is used where documented` ✓ e o `grep` | `api/src/modules/auth/roles.guard.spec.ts:37` `expect(files).toEqual(EXPECTED)` com `EXPECTED` literal em `:7-11`; `grep` exit 0 com 17 linhas | PASS (carregado da rodada 1: as 17 linhas de `ROADMAP.md:233-249` foram conferidas nome a nome contra a lista de módulos de `ROADMAP.md:18`) |

### S2 — Listar e criar usuários

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C7 | `GET /users` `200`, 5 chaves exatas, ordenado por `name`+`email`; sem cookie `401` | `users.e2e-spec.ts > lists every user ordered by name` ✓ · `users.e2e-spec.ts > GET /users without a session is 401` ✓ | `api/test/users.e2e-spec.ts:110` `toBe(200)` · `:114-118` ordem `ana, bia, zeca` · `:120` `expect(Object.keys(user).sort()).toEqual(['active','email','id','name','role'])` · `:126-127` `401` + `SESSION_REQUIRED` | PASS (o 2º comando de prova agora casa com um `it()` próprio, `:124`) |
| C8 | `POST /users` `201`, **chaves exatas**, e-mail normalizado, login com o papel | `users.e2e-spec.ts > creates a user that can log in with the given role` ✓ | `api/test/users.e2e-spec.ts:149` `toBe(201)` · **`:152-158` `expect(Object.keys(response.body).sort()).toEqual(['active','email','id','name','role'])`** · `:159-163` `toMatchObject({ email: 'bia9@test.local', role: 'sales', active: true })` · `:168` login `200` · `:169` `role === 'sales'` | PASS (door 2 fechada nesta rota) |
| C9 | hash só no formato scrypt do AD-017 | `users.e2e-spec.ts > stores the created password only as a scrypt hash` ✓ | `api/test/users.e2e-spec.ts:174` `expect(hash).toMatch(HASH_FORMAT)`, com o regex literal em `:13` | PASS (carregado da rodada 1, citação refeita) |
| C10 | e-mail duplicado `409` com a mensagem exata, contagem intacta; sem cookie `401` | `users.e2e-spec.ts > duplicate email is 409` ✓ · `users.e2e-spec.ts > POST /users without a session is 401` ✓ | `api/test/users.e2e-spec.ts:184-185` `409` + `DUPLICATE_EMAIL` · `:186` `expect(await countUsers('u10@test.local')).toBe(before)` · `:196-197` `401` + `SESSION_REQUIRED` | PASS (o 2º comando de prova agora casa com um `it()` próprio, `:189`) |
| C11 | 10 `POST` simultâneos: 1× `201`, 9× `409`, 1 usuário | `users.e2e-spec.ts > concurrent creation with the same email creates one user` ✓ | `api/test/users.e2e-spec.ts:204` `expect(statuses).toEqual([201,409,409,409,409,409,409,409,409,409])` · `:205` `toBe(1)` | PASS (carregado da rodada 1, citação refeita) |
| C12 | 8 corpos recusados → `400 { error }`, nada criado | `users.e2e-spec.ts > create body validation` ✓ | `api/test/users.e2e-spec.ts:210-219` os 8 corpos literais · `:222` `toBe(400)` · `:223` `typeof error === 'string'` · `:225` `countUsers(...) === 0` | PASS (carregado da rodada 1, citação refeita) |
| C13 | bordas de `name` (0/100) e `password` (11/12) | `users.e2e-spec.ts > name and password length edges` ✓ | `api/test/users.e2e-spec.ts:233` `400` · `:239` `201` · `:245` `400` · `:251` `201` | PASS (carregado da rodada 1, citação refeita) |

### S3 — Editar, ativar e desativar

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C14 | `PATCH` só com `name`, depois só com `role`, **chaves exatas**; demais campos intactos | `users.e2e-spec.ts > patch updates only the given fields` ✓ | `api/test/users.e2e-spec.ts:257` `200` · **`:260-266` `expect(Object.keys(nameOnly.body).sort()).toEqual(['active','email','id','name','role'])`** · `:267-272` `toMatchObject({ name:'Bia Nova', email:'u14-bia@test.local', role:'sales', active:true })` · `:276-281` `role:'production'` com os outros iguais | PASS (door 2 fechada nesta rota) |
| C15 | `active:false` → `200`; **sessões apagadas**; sessão antiga `401`; login `401` com a mensagem da Fase 3 | `users.e2e-spec.ts > deactivating a user revokes its session and login` ✓ | `api/test/users.e2e-spec.ts:289-290` `200` + `active:false` · `:292` `expect((await me(targetCookie)).status).toBe(401)` · `:296-297` `401` + `{ error: 'E-mail ou senha inválidos' }` · **`:301-305` `SELECT count(*) FROM sessions WHERE user_id = $1` → `expect(Number(remaining[0]?.count)).toBe(0)`** | PASS (mutante sobrevivente da rodada 1 agora morre — F4', abaixo) |
| C16 | `active:true` → `200` e o login volta | `users.e2e-spec.ts > reactivating restores login` ✓ | `api/test/users.e2e-spec.ts:311-312` `200` + `active:true` · `:317` login `200` | PASS (carregado da rodada 1, citação refeita) |
| C17 | `password` redefinida por outro: login antigo `401`, novo `200`, as 2 sessões do alvo `401` | `users.e2e-spec.ts > resetting the password revokes the target's other sessions` ✓ | `api/test/users.e2e-spec.ts:331` antigo `401` · `:338` novo `200` · `:339` `me(sessionA) === 401` · `:340` `me(sessionB) === 401` (2 sessões criadas em `:322-323`) | PASS (carregado da rodada 1, citação refeita) |
| C18 | trocar a própria senha pelo `PATCH`: a sessão da chamada sobrevive, a outra cai | `users.e2e-spec.ts > changing your own password keeps the current session` ✓ | `api/test/users.e2e-spec.ts:352` `expect((await me(callingSession)).status).toBe(200)` · `:353` `expect((await me(otherSession)).status).toBe(401)` | PASS (carregado da rodada 1, citação refeita) |
| C19 | id não-UUID `400`; UUID inexistente `404` com a mensagem; sem cookie `401` | `users.e2e-spec.ts > invalid id is 400, missing id is 404` ✓ · `users.e2e-spec.ts > PATCH /users/:id without a session is 401` ✓ | `api/test/users.e2e-spec.ts:358` `400` · `:361-362` `404` + `NOT_FOUND` · `:368-369` `401` + `SESSION_REQUIRED` | PASS (o 2º comando de prova agora casa com um `it()` próprio, `:365`) |
| C20 | corpo `{}` → `400` com a mensagem exata | `users.e2e-spec.ts > empty patch body is 400` ✓ | `api/test/users.e2e-spec.ts:375-376` `400` + `{ error: 'Informe ao menos um campo para alterar' }` | PASS (carregado da rodada 1, citação refeita) |
| C21 | 6 corpos recusados → `400`, **alvo intacto** | `users.e2e-spec.ts > patch body validation` ✓ | `api/test/users.e2e-spec.ts:382-389` os 6 corpos literais · `:392` `toBe(400)` · **`:394-401` `SELECT name, email, role, active FROM users WHERE id = $1` → `toMatchObject({ name:'Original', email:'u21-bia@test.local', role:'admin', active:true })`** | PASS (precision gap da rodada 1 fechado) |
| C22 | e-mail já usado por terceiro (maiúsculas) → `409` com a mensagem, **nenhum dos dois muda** | `users.e2e-spec.ts > patch to a duplicate email is 409` ✓ | `api/test/users.e2e-spec.ts:409-410` `409` + `DUPLICATE_EMAIL` · **`:412` `expect(await countUsers('u22-self@test.local')).toBe(1)` · `:413` idem para `u22-other@test.local`** | PASS (precision gap da rodada 1 fechado) |
| C23 | próprio `role`/`active` → `409` com a mensagem exata, papel intacto | `users.e2e-spec.ts > admin cannot change own role or deactivate self` ✓ | `api/test/users.e2e-spec.ts:422-423` `409` + `{ error: 'Você não pode alterar o próprio papel nem se desativar' }` · `:426-427` idem para `active:false` · `:430-431` `me` ainda `admin` | PASS (carregado da rodada 1, citação refeita) |
| C24 | `PATCH` no próprio `id` só com `name` → `200` | `users.e2e-spec.ts > admin can edit own name` ✓ | `api/test/users.e2e-spec.ts:439-440` `200` + `expect((response.body as { name: string }).name).toBe('Outro Nome')` | PASS (a moldura irrelevante "exatamente 1 admin ativo" saiu do check) |
| C25 | rebaixar e desativar outro admin com 2 ativos → `200`, **com o alvo alterado e quem chamou intacto** | `users.e2e-spec.ts > demoting or deactivating another admin succeeds while one remains` ✓ | `api/test/users.e2e-spec.ts:448` `expect(demote.status).toBe(200)` · **`:454` `expect(target1.role).toBe('production')` · `:458` `expect(caller1Row).toEqual({ role: 'admin', active: true })`** · `:464` `expect(deactivate.status).toBe(200)` · **`:469` `expect(target2.active).toBe(false)` · `:473` `expect(caller2Row).toEqual({ role: 'admin', active: true })`** | PASS (precision gap da rodada 1 fechado) |
| C26 | corrida entre os 2 últimos admins: 1× `200`, a outra `409` ou `401`, 1 admin ativo no fim | `users.e2e-spec.ts > concurrent deactivation of the last two admins keeps one` ✓ | `api/test/users.e2e-spec.ts:496` `expect(winner.status).toBe(200)` · `:497` `expect([401,409]).toContain(loser.status)` · `:499`/`:501` a mensagem literal de cada caso · `:507` `expect(rows.filter((row) => row.active)).toHaveLength(1)` | PASS (carregado da rodada 1, citação refeita) |
| C27 | `DELETE /users/:id` → `404` | `users.e2e-spec.ts > there is no delete route` ✓ | `api/test/users.e2e-spec.ts:516` `expect(response.status).toBe(404)` | PASS (carregado da rodada 1, citação refeita) |

### S4 — Trocar a própria senha

Fatia inteira **carregada da rodada 1** (veredito PASS em todos os 5). O fix não tocou
`auth.e2e-spec.ts` nem `auth.service.ts`; conferi que as linhas citadas seguem as mesmas.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C28 | `204`, login antigo `401`, novo `200` | `auth.e2e-spec.ts > changes own password` ✓ | `api/test/auth.e2e-spec.ts:359` `expect(change.status).toBe(204)` · `:361-363` antigo `401` · `:364-366` novo `200` | PASS (carregado da rodada 1) |
| C29 | sessão da chamada `200`, a outra `401` | `auth.e2e-spec.ts > password change revokes other sessions, keeps the current one` ✓ | `api/test/auth.e2e-spec.ts:379` `expect((await me(current)).status).toBe(200)` · `:380` `expect((await me(older)).status).toBe(401)` | PASS (carregado da rodada 1) |
| C30 | `currentPassword` errada → `400` com a mensagem, senha intacta, sessão viva | `auth.e2e-spec.ts > wrong current password is 400, not 401` ✓ | `api/test/auth.e2e-spec.ts:390-391` `400` + `{ error: 'Senha atual incorreta' }` · `:393` login antigo `200` · `:394` `me === 200` | PASS (carregado da rodada 1) |
| C31 | 5 corpos recusados → `400 { error }`, senha intacta | `auth.e2e-spec.ts > password change body validation` ✓ | `api/test/auth.e2e-spec.ts:400-406` os 5 corpos literais · `:409-410` `400` + `error` string · `:412` login antigo ainda `200` | PASS (carregado da rodada 1) |
| C32 | sem sessão → `401` `SESSION_REQUIRED` | `auth.e2e-spec.ts > changing password without a session is 401` ✓ | `api/test/auth.e2e-spec.ts:419-420` `401` + `SESSION_REQUIRED` | PASS (carregado da rodada 1) |

### S5 — Tela de usuários

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C33 | tabela com **os cabeçalhos "Nome", "E-mail", "Papel", "Situação" nessa ordem**, uma linha por usuário na ordem da API, papel e situação traduzidos | `users/page.test.tsx > renders the user table in order` ✓ | **`web/src/app/(app)/users/page.test.tsx:55-58` `expect(headers.slice(0, 4)).toEqual(["Nome", "E-mail", "Papel", "Situação"])`** lidos por `getAllByRole("columnheader")` de `rows[0]` · `:54` `toHaveLength(4)` · `:59-61` ordem Admin/Bia/Zeca · `:62-63` `Vendas`/`Produção` · `:64-65` `Inativo`/`Ativo` | PASS (lacuna de arranjo da rodada 1 fechada) |
| C34 | `Carregando usuários…` sem tabela | `users/page.test.tsx > shows loading` ✓ | `web/src/app/(app)/users/page.test.tsx:73` `expect(screen.getByText("Carregando usuários…")).toBeTruthy()` | PASS (carregado da rodada 1, citação refeita) |
| C35 | erro + `Tentar novamente` recarrega | `users/page.test.tsx > shows the error and retries` ✓ | `web/src/app/(app)/users/page.test.tsx:83` `findByText("Não foi possível conectar à API")` · `:89` `expect(callsTo(fetchMock, "/users")).toHaveLength(2)` | PASS (carregado da rodada 1, citação refeita) |
| C36 | lista vazia → `Nenhum usuário cadastrado` | `users/page.test.tsx > shows the empty state` ✓ | `web/src/app/(app)/users/page.test.tsx:98` `findByText("Nenhum usuário cadastrado")` | PASS (carregado da rodada 1, citação refeita) |
| C37 | `Criando…` desabilitado, linha nova, **os 4 campos de volta ao estado inicial** | `users/page.test.tsx > creates a user and clears the form` ✓ | `web/src/app/(app)/users/page.test.tsx:118` `findByRole("button",{name:"Criando…"})` + `toHaveProperty("disabled", true)` · `:129` a linha "Carla" · `:130-131` Nome e E-mail `""` · **`:132` `expect((screen.getByLabelText("Senha") as HTMLInputElement).value).toBe("")` · `:133` `expect((screen.getByLabelText("Papel") as HTMLSelectElement).value).toBe("sales")`** | PASS (precision gap da rodada 1 fechado) |
| C38 | erro `409` junto ao formulário, campos mantidos | `users/page.test.tsx > shows the create error and keeps the form` ✓ | `web/src/app/(app)/users/page.test.tsx:152` a mensagem · `:153-154` Nome e E-mail preservados | PASS (carregado da rodada 1, citação refeita) |
| C39 | `Salvar` envia só o campo alterado | `users/page.test.tsx > edit form sends only changed fields` ✓ | `web/src/app/(app)/users/page.test.tsx:172` `expect(bodyOf(init as RequestInit)).toEqual({ name: "Bia Nova" })` | PASS (carregado da rodada 1, citação refeita) |
| C40 | `200` fecha a edição; `Cancelar` fecha **sem chamar a API** | `users/page.test.tsx > saving closes the edit, cancel discards it` ✓ | `web/src/app/(app)/users/page.test.tsx:188` sem botão `Salvar` após cancelar · `:189` linha com "Bia" · **`:190` `expect(callsTo(fetchMock, "/users/u2")).toHaveLength(0)`** · `:195-196` dados novos e edição fechada | PASS (precision gap da rodada 1 fechado) |
| C41 | erro do `PATCH` mantém a linha em edição com os valores digitados | `users/page.test.tsx > edit error keeps the row open with typed values` ✓ | `web/src/app/(app)/users/page.test.tsx:213` a mensagem na linha · `:214` `E-mail` ainda `conflito@test.local` | PASS (carregado da rodada 1, citação refeita) |
| C42 | `Desativar` envia `{active:false}`, troca situação e botão; erro mostra a mensagem e mantém o estado | `users/page.test.tsx > toggling active sends the patch and reflects errors` ✓ | `web/src/app/(app)/users/page.test.tsx:232` botão `Ativar` · `:234` `expect(bodyOf(init as RequestInit)).toEqual({ active: false })` · `:238` a mensagem de erro · `:239` situação `Inativo` mantida | PASS (carregado da rodada 1, citação refeita) |
| C43 | linha do próprio admin: sem `Desativar` e sem campo `Papel` na edição | `users/page.test.tsx > the logged-in admin's own row hides deactivate and role` ✓ | `web/src/app/(app)/users/page.test.tsx:249` `queryByRole("button",{name:"Desativar"})` é `null` · `:252` `queryByLabelText("Papel")` é `null` | PASS (carregado da rodada 1, citação refeita) |
| C44 | não-admin vê a mensagem e não chama `GET /users` | `users/page.test.tsx > non-admin sees the permission message without calling the api` ✓ | `web/src/app/(app)/users/page.test.tsx:260` `Você não tem permissão para acessar esta página` · `:261` `expect(callsTo(fetchMock, "/users")).toHaveLength(0)` | PASS (carregado da rodada 1, citação refeita) |

### S6 — Menu por papel e `/account`

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C45 | admin vê 3 itens na ordem, com os `href` certos | `app-shell.test.tsx > admin sees every menu item in order` ✓ | `web/src/components/app-shell.test.tsx:43-47` `toEqual(["Importar do MakerWorld","Usuários","Minha conta"])` · `:48-52` `toEqual(["/print-profiles","/users","/account"])` | PASS (carregado da rodada 1) |
| C46 | production e sales veem 2 itens, sem "Usuários" | `app-shell.test.tsx > production and sales do not see users` ✓ | `web/src/components/app-shell.test.tsx:63-66` `toEqual(["Importar do MakerWorld","Minha conta"])` · `:67` `queryByRole("link",{name:"Usuários"})` é `null`, no laço `:56` sobre `["production","sales"]` | PASS (carregado da rodada 1) |
| C47 | 3 campos `type="password"` e o botão | `account/page.test.tsx > shows the password change form` ✓ | `web/src/app/(app)/account/page.test.tsx:59-61` os três `getAttribute("type")` → `"password"` · `:62` o botão `Trocar senha` | PASS (carregado da rodada 1) |
| C48 | senhas diferentes → mensagem, sem chamada | `account/page.test.tsx > mismatched passwords are not sent` ✓ | `web/src/app/(app)/account/page.test.tsx:69` `As senhas não conferem` · `:70` `expect(fetchMock).not.toHaveBeenCalled()` | PASS (carregado da rodada 1) |
| C49 | `Salvando…` e `disabled` | `account/page.test.tsx > shows saving` ✓ | `web/src/app/(app)/account/page.test.tsx:77-78` `findByRole("button",{name:"Salvando…"})` + `disabled === true` | PASS (carregado da rodada 1) |
| C50 | `204` → `Senha alterada` e 3 campos vazios | `account/page.test.tsx > shows success and clears the form` ✓ | `web/src/app/(app)/account/page.test.tsx:85` `Senha alterada` · `:86-88` os três `value === ""` | PASS (carregado da rodada 1) |
| C51 | `400` mostra a mensagem; `fetch` rejeitando mostra a de rede; **continua em `/account` (nenhum `replace`)** | `account/page.test.tsx > shows api and network errors, stays on the page` ✓ | `web/src/app/(app)/account/page.test.tsx:98` `Senha atual incorreta` · **`:99` `expect(navigation.replace).not.toHaveBeenCalled()`** · `:105` `Não foi possível conectar à API` · **`:106` idem** | PASS (precision gap da rodada 1 fechado) |
| C52 | `401` → `replace("/login?next=%2Faccount")`, não a mensagem de senha errada | `account/page.test.tsx > a 401 redirects like any other protected page` ✓ | `web/src/app/(app)/account/page.test.tsx:125` `expect(navigation.replace).toHaveBeenCalledWith("/login?next=%2Faccount")` · `:127` `queryByText("Senha atual incorreta")` é `null` | PASS (carregado da rodada 1, citação refeita: o fix de C51 deslocou 2 linhas) |
| C53 | `AppShell` declara a prop `role`, `auth-gate.tsx` passa `state.user.role` | `grep -q "role?: UserRole" … && grep -q "role={state.user.role}" …` exit 0 | `web/src/components/app-shell.tsx:15` `role?: UserRole;` · `web/src/components/auth-gate.tsx:94` `role={state.user.role}` | PASS (a prova frouxa `grep -q "role"` da rodada 1 foi trocada pelas duas linhas literais, que é exatamente o que eu rodei) |

**Provas que não casam com teste nenhum**: **nenhuma**. Os três comandos que a rodada 1 encontrou
verdes por `passWithNoTests` (C7, C10, C19) agora resolvem para `it()` próprios, com o nome exato
do `checks.md`, e apareceram individualmente na saída `--reporter=verbose`:
`users.e2e-spec.ts:124`, `:189` e `:365`.

---

## Coverage

Recomputado a partir da autoridade de cada conjunto, não relido da tabela do autor. Para as rotas
e o contrato, a autoridade é o `plan.md` (`## Surface`, `## Landing`) — é o contrato que o código
deve satisfazer. Para os corpos recusados, a autoridade são as classes de DTO no código.

As 5 primeiras linhas foram **recomputadas nesta rodada** (são as que o fix tocou). As demais são
**carregadas da rodada 1**, onde já vinham sem membro não provado.

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| **`GET /users` statuses (3)** — recomputado agora | `plan.md` Surface | `200` C7 (`users.e2e:110`) · `401` C7 (`:126`) · **`403` C1 na rota real (`users.e2e:139-140`, production e sales)** | - |
| **`POST /users` statuses (5)** — recomputado agora | `plan.md` Surface | `201` C8 (`:149`) · `400` C12 (`:222`) · `401` C10 (`:196`) · `409` C10/C11 (`:184`,`:204`) · `403` por composição: C6 prova que `users.controller.ts` não tem nenhuma linha `@Roles(` (`roles.guard.spec.ts:37`, mata até um decorator só no handler — F14) + C1 prova o `403` do guard numa rota sem `@Roles()` (`roles.e2e:92,96`) e na própria `UsersController` (`users.e2e:139`) + `roles.guard.ts:13-34` decide sem ler o verbo HTTP | - |
| **`PATCH /users/:id` statuses (6)** — recomputado agora | `plan.md` Surface | `200` C14 (`:257`) · `400` C19/C20/C21 (`:358`,`:375`,`:392`) · `401` C19 (`:368`) · `404` C19 (`:361`) · `409` C22/C23/C25/C26 (`:409`,`:422`,`:496`) · `403` pela mesma composição da linha acima | - |
| **door 2 — exclusão de `password_hash`/datas (3 rotas)** — recomputado agora | `plan.md` Landing door 2 / AD-019 | `GET /users` C7 (`users.e2e:120`) · **`POST /users` C8 (`:152-158`)** · **`PATCH /users/:id` C14 (`:260-266`)** — as 3 com `Object.keys(...).sort()` exato, nenhuma com `toMatchObject` sozinho | - |
| **arranjo da tabela `/users` (4 colunas + ordem)** — recomputado agora | AC 32 (`plan.md`) | "Nome" 1ª, "E-mail" 2ª, "Papel" 3ª, "Situação" 4ª — todas em C33 (`users/page.test.tsx:55-58`, `getAllByRole("columnheader")` + `toEqual` posicional) | - |
| **revogação de sessão (3 gatilhos)** — recomputado agora | AC 17, AC 20, AC 29 | **desativar C15 (`users.e2e:301-305`, `count(*) = 0`)** · redefinir por outro C17 (`:339-340`) · própria troca C29 (`auth.e2e:380`) | - |
| `POST /auth/password` statuses (3) | `plan.md` Surface | `204` C28 (`auth.e2e:359`) · `400` C30/C31 (`:390`,`:409`) · `401` C32 (`:419`) | - |
| rotas do padrão da door 1 (3) | `plan.md` Landing door 1 | sem `@Roles()` C1 · `@Roles('sales')` C2 · pré-existentes C5 | - |
| papéis × decorator (6 combinações) | `plan.md` Landing door 1 | ausente×{admin `roles.e2e:100`, production `:92`, sales `:96`} · `@Roles('x')`×{admin `:113`, production `:109`, sales `:106`} | - |
| corpos recusados na criação (8) | `CreateUserDto` | os 8 casos literais em `users.e2e:210-219`, todos asseridos em `:222` | - |
| corpos recusados na edição (6) | `UpdateUserDto` | os 6 casos em `users.e2e:382-389`, asseridos em `:392` | - |
| corpos recusados na troca de senha (5) | `ChangePasswordDto` | os 5 casos em `auth.e2e:400-406`, asseridos em `:409-410` | - |
| campos independentes do `PATCH` (5) | `UpdateUserDto` | `name` C14 (`:257`) · `email` C22 (`:409`) · `role` C14 (`:276`) · `active` C15/C16 (`:289`,`:311`) · `password` C17/C18 (`:326`,`:350`) | - |
| motivos de `409` em `PATCH` (3) | `users.service.ts:69`,`:99`,`:113` | e-mail duplicado C22 (`:409`) · própria conta C23 (`:422`) · último admin C26 (`:499`) | - |
| último admin: gatilhos (2) | `users.service.ts:96` | rebaixar C25 (`:448`,`:454`) · desativar C25/C26 (`:464`,`:496`) | - |
| exceção "sessão da própria requisição" (2) | AC 20, AC 29 | `PATCH` na própria senha C18 (`users.e2e:352`) · `POST /auth/password` C29 (`auth.e2e:379`) | - |
| papéis do sistema (3) | `USER_ROLES` (`entities/user.entity.ts`) | `admin` C1/C2/C5 · `production` C1/C4/C5 · `sales` C2/C4/C5 | - |
| módulos da matriz (17) | `ROADMAP.md:18` (lista da seção 2) | as 17 linhas em `ROADMAP.md:233-249`, conferidas nome a nome na rodada 1; C6 prova a contagem | - |
| estados de `/users` (6) | `plan.md` Observable | carregando C34 · vazio C36 · erro C35 · criar C37/C38 · editar C39/C40/C41 · ativar/desativar C42 | - |
| linha do próprio admin (2) | AC 42 | sem "Desativar" C43 (`:249`) · sem "Papel" C43 (`:252`) | - |
| não-admin em `/users` (1) | AC 43 | C44 (`:260`,`:261`) | - |
| itens do menu por papel (3) | AC 44, AC 45 | `admin` C45 (`app-shell.test.tsx:43`) · `production` C46 (`:63`) · `sales` C46 (`:63`, laço `:56`) | - |
| estados de `/account` (6) | `plan.md` Observable | formulário C47 · não conferem C48 · salvando C49 · sucesso C50 · erro API/rede C51 · `401` C52 | - |

**Sobre o `403` de `POST /users` e `PATCH /users/:id`.** A rodada 1 registrou os três `403` como
não provados e o fix fechou só o `GET`. Recomputei os outros dois e os considero **provados por
composição**, não por procuração frouxa, porque cada elo tem prova própria e a falta injetada F14
mata o único desvio plausível que restaria (um `@Roles()` só no handler do `POST`):
`roles.guard.ts:13-34` decide lendo apenas `IS_PUBLIC`, `request.user.role` e a metadata `ROLES` —
nunca o método HTTP —, C6 prova em `roles.guard.spec.ts:37` que `users.controller.ts` não carrega
nenhuma linha `@Roles(`, e C1 prova o `403` do guard tanto na sonda quanto na própria
`UsersController` (`users.e2e:139`). Ainda assim, dois `expect` diretos (um `POST` e um `PATCH`
com cookie de `sales`) custariam quatro linhas e tornariam a cadeia desnecessária — está em
`## Observações residuais` como melhoria, não como lacuna.

---

## Test policy

A linha 3 foi **rejulgada nesta rodada** (era a única "no"). As outras quatro são carregadas da
rodada 1, onde já estavam cumpridas, com as citações refeitas.

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| `RolesGuard` (decide, alcançado pela rota) | `roles.guard.ts` | um e2e por combinação papel × decorator | yes — 6/6 combinações, `roles.e2e-spec.ts:92,96,100,106,109,113` (carregado da rodada 1) |
| serviço de `users` — transação do último admin (decide, com concorrência) | `users.service.ts:76-101` | e2e sequencial **e** e2e simultâneo | yes — sequencial `users.e2e:448`/`:464` (os dois gatilhos, agora com o estado final do alvo e de quem chamou em `:454`,`:458`,`:469`,`:473`), simultâneo `:496-507` (carregado da rodada 1) |
| serviço de `users` / `auth` — revogação de sessão (decide) | `users.service.ts:118-122`, `auth.service.ts:105` | e2e por gatilho, com a exceção da sessão da própria requisição | yes — **rejulgado agora**: os 3 gatilhos têm asserção que observa a exclusão. Desativar: `users.e2e:301-305` (`count(*) = 0`); redefinir por outro: `:339-340`; própria troca: `auth.e2e:380`. A exceção da sessão da chamada em `users.e2e:352` e `auth.e2e:379`. A falta F4' agora morre |
| DTOs de `users` e `auth/password` (validação) | `create-user.dto.ts`, `update-user.dto.ts`, `change-password.dto.ts` | um e2e tabela-driven por DTO, cada regra incluindo as bordas | yes — `users.e2e:208` (8 casos) + `:228` (bordas 0/100/11/12), `users.e2e:380` (6 casos), `auth.e2e:397` (5 casos) (carregado da rodada 1) |
| componentes de tela (`/users`, `/account`, menu) | `users/page.tsx`, `account/page.tsx`, `app-shell.tsx` | um com Testing Library por componente, cada estado como membro | yes — 12 + 6 + 2 testes; a ressalva da rodada 1 (arranjo sem prova) caiu com `users/page.test.tsx:55-58` |

---

## Faults injected

**Isolamento.** A fase inteira segue **sem commit**, então `git worktree add <scratch> HEAD` daria
uma árvore *sem* o código da fase. Usei de novo uma cópia `rsync` completa do working tree em
`…/scratchpad/mutant`, com `node_modules` ligado por symlink, e mutei só ali. Baseline
`git status --porcelain` da árvore real gravado antes (**32 linhas**) e conferido idêntico depois
de cada bloco (`diff` vazio, `TREE_UNCHANGED_OK`), mais uma conferência linha a linha dos arquivos
mutados (`users.service.ts:118`, `roles.decorator.ts:7`, `users.controller.ts`, `users/page.tsx`,
`account/page.tsx`) de volta ao original. A cópia foi descartada ao final.

**Escopo.** Só as superfícies que o fix da rodada 1 tocou ou criou. F1, F2, F3 e F5 da rodada 1
não foram reinjetados: mataram limpo e nada perto deles mudou. Passei do teto de 5 do `verify.md`
deliberadamente, porque seis das superfícies novas são asserções que **nunca tinham sido levadas a
falhar uma vez** e as do web custam ~3 s por experimento — o custo que o teto existe para conter
não se aplica aqui.

| # | Mutation | Location (na cópia) | Narrowest covering proof | Killed |
| --- | --- | --- | --- | --- |
| F4' | `if (dto.active === false \|\| newPasswordHash !== undefined)` → `if (newPasswordHash !== undefined)` (desativar deixa de apagar as sessões do alvo) — **o mutante que sobreviveu na rodada 1** | `api/src/modules/users/users.service.ts:118` | `users.e2e-spec.ts -t "deactivating a user revokes its session and login"` | yes — `expected 1 to be +0` em `users.e2e-spec.ts:305` |
| F6 | `SetMetadata(ROLES, roles)` → `SetMetadata(ROLES, roles.filter((role) => role !== 'production'))` (o papel novo deixa de *conceder* acesso; o lado negativo continua igual) | `api/src/modules/auth/roles.decorator.ts:7` | `roles.e2e-spec.ts -t "a role change applies on the next request"` | yes — `expected 403 to be 200` em `roles.e2e-spec.ts:148` (a asserção nova de C4) |
| F7 | `@Roles('production', 'sales')` acrescentado à classe `UsersController` (a rota real deixa de ser só de admin) | `api/src/modules/users/users.controller.ts:11` | `users.e2e-spec.ts -t "non-admin roles get 403 on the real /users route"` | yes — `expected 200 to be 403` em `users.e2e-spec.ts:139` (o teste novo de C1) |
| F8 | `return toPublicUser(created)` / `return toPublicUser(updated)` → devolver a entidade (vaza `passwordHash`, `createdAt`, `updatedAt`) | `api/src/modules/users/users.service.ts:44` e `:127` | `users.e2e-spec.ts -t "creates a user that can log in with the given role"` e `-t "patch updates only the given fields"` | yes — chaves extras `createdAt`/`passwordHash`/`updatedAt` em `users.e2e-spec.ts:152` e `:260` (as asserções novas da door 2) |
| F9 | `<th>Papel</th><th>Situação</th>` → ordem trocada | `web/src/app/(app)/users/page.tsx:193-194` | `users/page.test.tsx -t "renders the user table in order"` | yes — `toEqual` posicional falha em `users/page.test.tsx:58` (a asserção nova de arranjo) |
| F10 | `Cancelar` dispara um `PATCH` antes de fechar a edição | `web/src/app/(app)/users/page.tsx:260` | `users/page.test.tsx -t "saving closes the edit, cancel discards it"` | yes — `expected 1 to be 0` em `users/page.test.tsx:190` (a asserção nova de C40) |
| F11 | o `catch` de `/account` passa a chamar `router.replace("/login?next=%2Faccount")` em qualquer erro | `web/src/app/(app)/account/page.tsx:36` | `account/page.test.tsx -t "shows api and network errors, stays on the page"` | yes — `Number of calls: 1` em `account/page.test.tsx:99` (a asserção nova de C51) |
| F12 | o reset do formulário preserva `password` e `role` em vez de voltar a `BLANK_CREATE` | `web/src/app/(app)/users/page.tsx:86` | `users/page.test.tsx -t "creates a user and clears the form"` | yes — `+ senha-da-carla-1` em `users/page.test.tsx:132` (a asserção nova de C37) |
| F13 | `if (dto.role !== undefined)` → `if (dto.role !== undefined && user.role !== 'admin')` (rebaixar outro admin devolve `200` sem gravar) | `api/src/modules/users/users.service.ts:105` | `users.e2e-spec.ts -t "demoting or deactivating another admin succeeds while one remains"` | yes — `expected "production", received "admin"` em `users.e2e-spec.ts:454` (a asserção nova de C25) |
| F14 | `@Roles('production', 'sales')` só no handler `@Post()` de `UsersController` (não na classe) | `api/src/modules/users/users.controller.ts:20` | `roles.guard.spec.ts -t "roles decorator is used where documented"` | yes — `+ "users.controller.ts"` em `roles.guard.spec.ts:37`, o elo que sustenta o `403` de `POST`/`PATCH` |

**Superfície nova não coberta por falta**: as asserções "o alvo não mudou" de C21
(`users.e2e:394-401`) e C22 (`:412-413`). Não achei desvio plausível que as derrube sem derrubar
antes a asserção de status do mesmo teste: as duas garantias vêm do `ValidationPipe` global (C21,
o corpo nem chega ao serviço) e do rollback da transação de `users.service.ts:76` (C22), então
qualquer mutação realista vira `400`/`409` errado primeiro. Registrado como observação, não como
lacuna: as duas asserções têm valor esperado literal no ponto da asserção.

---

## Swept existing

Carregado da rodada 1, com as duas ressalvas daquela rodada agora resolvidas. Reli as linhas do
`## Swept` de `checks.md` que resolvem para **existing** contra o código:

| Linha | Constraint citada | Está lá? |
| --- | --- | --- |
| validation | C12, C13, C21, C31 com as bordas de `name`, `password`, `newPassword` | sim — `users.e2e:210-219`, `:228-251`, `:382-389`, `auth.e2e:400-406` |
| failure modes | toda falha vira `{ error }` com status definido | sim — filtro global (AD-001) + as asserções de mensagem literal citadas nos checks |
| idempotency | C16 reativar volta ao estado anterior | sim — `users.e2e:308-317`. A ambiguidade que a rodada 1 apontou (reativar ressuscitaria sessões antigas) deixou de existir: C15 agora prova `count(*) = 0` antes |
| authorization | C1-C6 na API, C43-C44 no web | sim — a ressalva da rodada 1 (nenhum `403` em rota real) caiu com `users.e2e:139` |
| concurrency | C11 criação simultânea, C26 desativação simultânea | sim — `users.e2e:204`, `:496-507` |
| data lifecycle | C15, C17, C29 — sessões apagadas | sim nos três — C15 agora observa a exclusão (`:305`), não só o `401` |
| dependency failure | C35, C51 | sim — `users/page.test.tsx:83`, `account/page.test.tsx:105` |
| state transitions | C15, C16, C4 | sim — ativo→inativo→ativo, e C4 agora nos dois lados (`roles.e2e:139` e `:148`) |
| observability | `n/a` — política aprovada, nada no código para estar errado | n/a |

O `## Out of scope` de `checks.md` bate item a item com o do `plan.md`; nada que os ACs numerados
exigem foi jogado para fora dele.

---

## Observações residuais

Nada aqui é lacuna — nenhum reprova a fase. Fica registrado para quem for mexer nisto depois.

1. **Timeout do e2e apertado sob carga.** `vitest.config.e2e.ts` fixa `testTimeout: 30_000`, e
   nesta máquina (load 6,2; VM do Docker em 281 % de CPU) dois testes estouraram em 2 de 3
   execuções completas: `a correct login never counts as a failure` (`api/test/auth.e2e-spec.ts:310`,
   código da Fase 3 que este diff não toca; 28,7 s na execução limpa, 4,3 s isolado) e, uma vez
   cada, `demoting or deactivating another admin succeeds while one remains`
   (`api/test/users.e2e-spec.ts:443`) e `concurrent deactivation of the last two admins keeps one`
   (`:476`). Nenhuma asserção falhou em nenhuma execução. É flakiness de tempo, não de lógica, mas
   custa uma rodada de CI quando a máquina está ocupada.
2. **`403` direto em `POST /users` e `PATCH /users/:id`.** Provado por composição (ver a nota da
   `Coverage`) e com F14 fechando o desvio plausível. Dois `expect` diretos no
   `non-admin roles get 403 on the real /users route`, reusando os cookies que o teste já tem,
   encurtariam a cadeia de quatro elos para um.
3. **C21 e C22 sem falta injetada** — ver a nota ao pé de `## Faults injected`.

---

## Ranked gaps

Nenhuma. As 7 lacunas roteadas depois da rodada 1 foram todas fechadas e cada uma foi confirmada
por prova rodada agora **e**, onde havia superfície de asserção nova, por uma falta injetada que
morreu nela.
