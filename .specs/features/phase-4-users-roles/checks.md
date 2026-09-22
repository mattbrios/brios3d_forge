# Fase 4 — Usuários e papéis · checks

Profile: standard
Plan: `.specs/features/phase-4-users-roles/plan.md`

## Intent

53 checks em 6 fatias · 2 one-way doors · nenhuma questão aberta

O `AGENTS.md` não declara perfil. Uso `standard`, o mesmo das Fases 1-3: esta fase decide quem
chega a cada rota, e um `RolesGuard` errado (ex.: um `||` que devia ser `&&`, ou um papel
comparado com o array errado) ainda deixa passar o teste que só confere o caminho feliz. É
exatamente o tipo de ramo que uma falha injetada do `standard` mata e um `light` não tenta.

Os valores esperados vêm do `plan.md` (`## Criteria` e `## Landing`) e ficam escritos
**literalmente** nas asserções, nunca derivados chamando o próprio código em teste.

Os e2e (`npm --prefix api run test:e2e`) montam o `AppModule` contra o `forge_test`, com o `db` no
ar. Cada arquivo usa e-mails próprios (`<arquivo>-<caso>@test.local`) e apaga só os que criou,
como a Fase 3 já faz (`auth-helper.ts`). O `auth-helper.ts` ganha um parâmetro de papel opcional
para os e2e desta fase entrarem como `production` ou `sales`. No web, Vitest + Testing Library com
o `fetch` substituído e `next/navigation` simulado, como em `login-form.test.tsx`.

## Checks

### S1 - Autorização por papel na API · 6 files · 12 KB · ~4k

**C1** - Um controller de teste `GET /probe-roles`, sem `@Roles()` nem `@Public()`, registrado num
módulo de teste junto com o `AppModule`: com a sessão de um usuário `production` responde `403`
com exatamente `{ "error": "Você não tem permissão para esta ação" }`, com `sales` também `403`, e
com `admin` `200`. Nenhum dos três chega a executar o handler quando a resposta é `403` (AC 1,
AC 2, AC 4, door 1). A mesma regra vale numa rota real, não só na sonda: `GET /users` (o exemplo
literal do teste independente da S1) responde `403` para `production` e para `sales`
Proof: `npm --prefix api run test:e2e -- test/roles.e2e-spec.ts -t "route without @Roles is admin only"`
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "non-admin roles get 403 on the real /users route"`

**C2** - O mesmo controller de teste com uma segunda rota `GET /probe-sales`, decorada
`@Roles('sales')`: `sales` responde `200`, `production` responde `403` com a mensagem de C1, e
`admin` responde `200` sem estar listado em `@Roles()` (AC 3, AC 4, door 1)
Proof: `npm --prefix api run test:e2e -- test/roles.e2e-spec.ts -t "declared roles admit them, admin always passes"`

**C3** - As duas rotas de C1 e C2 sem cookie de sessão respondem `401` com a mensagem de sessão da
Fase 3 (`SESSION_REQUIRED`), não `403`. O `RolesGuard` não é alcançado sem usuário na requisição
(AC 5)
Proof: `npm --prefix api run test:e2e -- test/roles.e2e-spec.ts -t "no session is 401, not 403"`

**C4** - Com a sessão de C2 (papel `sales`) ativa, alterar o papel desse usuário para `production`
por `PATCH /users/:id` e, na mesma sessão sem novo login: chamar `GET /probe-sales` responde `403`;
chamar `GET /probe-roles` (sem `@Roles()`) responde `403`; e chamar uma rota `@Roles('production')`
nova (`GET /probe-production`) responde `200` - o papel novo concede acesso, não só o antigo perde
(AC 7)
Proof: `npm --prefix api run test:e2e -- test/roles.e2e-spec.ts -t "a role change applies on the next request"`

**C5** - Com sessões de `production` e de `sales`, `POST /pricing/calculate` com o corpo válido da
Fase 1 e `POST /print-profiles/import` com a URL do Sea star respondem `200` para os dois papéis, e
`GET /auth/me` e `POST /auth/password` (corpo válido) também não recebem `403` de nenhum dos dois
(AC 6)
Proof: `npm --prefix api run test:e2e -- test/roles.e2e-spec.ts -t "pre-existing routes stay open to every role"`

**C6** - Um teste varre `api/src` e confirma que `@Roles()` decora rota só nos controllers listados
na matriz do `ROADMAP.md` (`auth`, `pricing`, `print-profiles` - `users` fica implicitamente
admin-only, sem decorator). A seção "Matriz de permissões" tem uma linha para cada um dos 17
módulos da lista de módulos do ROADMAP (seção 2), preenchida para `auth`, `users` e `pricing` e "a
definir na Fase N" para os outros 14; `health` e `print-profiles` não são um desses 17 módulos e
ficam documentados em prosa fora da tabela (AC 8)
Proof: `grep -c "^| \`" ROADMAP.md | test "$(grep -A30 '## Matriz de permissões' ROADMAP.md | grep -c '^| \`')" -eq 17`
Proof: `npm --prefix api run test -- src/modules/auth/roles.guard.spec.ts -t "roles decorator is used where documented"`

### S2 - Listar e criar usuários · 6 files · 14 KB · ~5k

**C7** - Com 3 usuários no banco (`Zeca`/`production`/ativo, `ana@test.local`/`admin`/ativo,
`bia@test.local`/`sales`/inativo), `GET /users` como admin responde `200` com uma lista de 3
objetos, cada um com exatamente as chaves `id`, `name`, `email`, `role`, `active` (sem
`password_hash` nem datas), ordenada por `name` e, no empate de `name`, por `email`. Sem cookie,
a mesma rota responde `401` com a mensagem de sessão da Fase 3, antes de qualquer verificação de
papel (AC 9, AC 5)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "lists every user ordered by name"`
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "GET /users without a session is 401"`

**C8** - `POST /users` como admin com `name`, `email` `"  Bia9@Test.Local "`, `password` de 12
caracteres e `role` `"sales"` responde `201` com um corpo cujas chaves são **exatamente** `id`,
`name`, `email`, `role`, `active` (nunca `password_hash`) e os valores `{ email: "bia9@test.local",
role: "sales", active: true }`, e o login com `bia9@test.local` e a senha enviada responde `200`
com `role: "sales"` (AC 10, AC 12, door 2)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "creates a user that can log in with the given role"`

**C9** - Depois de C8, `users.password_hash` da Bia casa com
`^scrypt\$N=131072,r=8,p=1\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{86}==$` (AC 11)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "stores the created password only as a scrypt hash"`

**C10** - `POST /users` com o e-mail de um usuário já existente (mesmo em maiúsculas ou com
espaços) responde `409` com exatamente `{ "error": "Já existe um usuário com este e-mail" }`, e a
contagem de usuários não muda. Sem cookie, `POST /users` com um corpo válido responde `401` com a
mensagem de sessão da Fase 3 (AC 13, AC 5)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "duplicate email is 409"`
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "POST /users without a session is 401"`

**C11** - 10 chamadas simultâneas (`Promise.all`) de `POST /users` com o mesmo e-mail novo:
exatamente uma responde `201` e as outras 9 respondem `409`, e existe exatamente 1 usuário com
aquele e-mail (AC 14)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "concurrent creation with the same email creates one user"`

**C12** - Cada um dos 8 corpos recusados da tabela `Coverage` responde `400` com `{ error }`
(string), e nenhum usuário é criado por nenhum deles (AC 15)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "create body validation"`

**C13** - As bordas de `name` (0 e 100 caracteres depois de tirar espaços) e de `password` (11 e 12
caracteres) do assumption "Tamanho do nome" e do AC 15: `name` vazio recusa `400`, `name` com 100
caracteres cria `201`; `password` de 11 caracteres recusa `400`, de 12 cria `201`
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "name and password length edges"`

### S3 - Editar, ativar e desativar usuários · 8 files · 16 KB · ~6k

**C14** - `PATCH /users/:id` da Bia com só `{ "name": "Bia Nova" }` responde `200` com um corpo de
chaves **exatamente** `id`, `name`, `email`, `role`, `active` (nunca `password_hash`), `name:
"Bia Nova"` e `email`, `role`, `active` iguais aos de antes; com só `{ "role": "production" }`
responde `200` com `role: "production"` e os outros campos intactos (AC 16, door 2)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "patch updates only the given fields"`

**C15** - `PATCH /users/:id` da Bia com `{ "active": false }` responde `200` com `active: false`; a
sessão que a Bia tinha aberta responde `401` na chamada seguinte a `GET /auth/me`, o login dela com
a senha certa responde `401` com `{ "error": "E-mail ou senha inválidos" }`, e a linha da sessão
dela **some** de `sessions` (`count(*) = 0`, não só fica inválida pelo `active` do usuário) (AC 17,
AC 18)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "deactivating a user revokes its session and login"`

**C16** - `PATCH /users/:id` da Bia (inativa desde C15) com `{ "active": true }` responde `200` com
`active: true`, e o login dela com a senha antiga responde `200` (AC 19)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "reactivating restores login"`

**C17** - `PATCH /users/:id` da Bia com `{ "password": "senha-nova-2026" }`: o login com a senha
antiga responde `401`, com a nova responde `200`. A Bia tem 2 sessões antes do `PATCH`; a chamada
usa a sessão do admin (outro usuário), e depois do `PATCH` as 2 sessões da Bia respondem `401` em
`GET /auth/me` (AC 20)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "resetting the password revokes the target's other sessions"`

**C18** - `PATCH /users/:id` com a própria sessão do admin que faz a chamada, alterando a própria
`password`: a sessão da própria chamada continua válida em `GET /auth/me` logo depois, e as
*outras* sessões desse admin (aberta antes) respondem `401` (AC 20, distinção "exceto a sessão da
própria requisição")
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "changing your own password keeps the current session"`

**C19** - `PATCH /users/naoexiste` (string que não é UUID) responde `400` com `{ error }`.
`PATCH /users/<uuid aleatório sem usuário>` responde `404` com exatamente `{ "error": "Usuário não
encontrado" }`. Sem cookie, `PATCH /users/:id` com um corpo válido e um `id` existente responde
`401` com a mensagem de sessão da Fase 3, antes de tocar o usuário (AC 21, AC 5)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "invalid id is 400, missing id is 404"`
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "PATCH /users/:id without a session is 401"`

**C20** - `PATCH /users/:id` com corpo `{}` responde `400` com exatamente `{ "error": "Informe ao
menos um campo para alterar" }`, sem alterar nada (AC 22)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "empty patch body is 400"`

**C21** - Cada um dos 6 corpos recusados da tabela `Coverage` (`name` vazio, `email` sem formato,
`role` `"owner"`, `password` de 11 caracteres, `active` `"sim"` string e chave extra `foo: 1`)
responde `400` com `{ error }`, e depois dos 6, o usuário alvo continua com o `name`, `email`,
`role` e `active` originais (AC 23)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "patch body validation"`

**C22** - `PATCH /users/:id` de um segundo usuário com o `email` já usado por um terceiro (em
maiúsculas) responde `409` com a mensagem de C10, e depois nenhum dos dois usuários muda de e-mail
(contagem por e-mail original intacta para os dois) (AC 24)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "patch to a duplicate email is 409"`

**C23** - O próprio admin chamando `PATCH` no próprio `id` com `{ "role": "sales" }` responde `409`
com exatamente `{ "error": "Você não pode alterar o próprio papel nem se desativar" }`, e o papel
não muda; o mesmo com `{ "active": false }` (AC 25)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "admin cannot change own role or deactivate self"`

**C24** - `PATCH` de um admin no próprio `id` com `{ "name": "Outro Nome" }` (sem tocar `role` nem
`active`) responde `200` (AC 25, delimitação: só `role` e `active` são bloqueados na própria
conta)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "admin can edit own name"`

**C25** - Com 2 admins ativos (Ana chamando, Beto alvo), `PATCH` de Ana rebaixando Beto para
`"production"` responde `200`, e ao final Beto tem `role: "production"` e Ana continua
`role: "admin"`, `active: true`. Em outro par de 2 admins ativos, `PATCH` desativando o alvo
responde `200` e, ao final, o alvo tem `active: false` e quem chamou continua `admin` ativo (AC 26,
caminho permitido: o próprio autor da chamada nunca é o alvo, então sempre sobra pelo menos ele)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "demoting or deactivating another admin succeeds while one remains"`

**C26** - Com exatamente 2 admins ativos, 2 chamadas simultâneas (`Promise.all`) de
`PATCH /users/:id` cada uma desativando o outro admin: exatamente uma responde `200`, a outra
nunca responde `200`, e ao final existe exatamente 1 admin ativo (AC 26). Esta é a única forma de
alcançar o bloqueio: como quem chama nunca é o alvo (C23 bloqueia isso à parte), uma chamada
sequencial sempre deixa quem chamou como admin restante; só a corrida entre dois admins removendo
um ao outro visita o caso em que a contagem chegaria a zero. A perdedora bloqueia de duas formas
igualmente corretas, e o teste aceita as duas: `409` com `{ "error": "O sistema precisa de pelo
menos um administrador ativo" }` quando a própria sessão dela ainda era válida na hora de checar a
regra, ou `401` com a mensagem de sessão da Fase 3 quando o `PATCH` vencedor já tinha revogado essa
sessão (ela é o alvo dele) antes disso - a pessoa realmente não está mais logada nesse caso, então
`401` é tão correto quanto `409`
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "concurrent deactivation of the last two admins keeps one"`

**C27** - `DELETE /users/:id` com o `id` de um usuário existente responde `404` (AC 27)
Proof: `npm --prefix api run test:e2e -- test/users.e2e-spec.ts -t "there is no delete route"`

### S4 - Trocar a própria senha · 4 files · 8 KB · ~3k

**C28** - Com a sessão de um usuário `sales` criado com a senha `"senha-antiga-1"`,
`POST /auth/password` com `{ currentPassword: "senha-antiga-1", newPassword: "senha-nova-99" }`
responde `204`, o login com a senha antiga responde `401` e com a nova `200` (AC 28)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "changes own password"`

**C29** - O usuário de C28 tinha 2 sessões antes da troca (a que fez a chamada e outra aberta
antes). Depois da troca, a sessão da própria chamada responde `200` em `GET /auth/me`, e a outra
responde `401` (AC 29)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "password change revokes other sessions, keeps the current one"`

**C30** - `POST /auth/password` com `currentPassword` errada responde `400` com exatamente
`{ "error": "Senha atual incorreta" }`, a senha não muda (login antigo continua `200`) e a sessão
da própria chamada continua válida em `GET /auth/me` logo depois (AC 30)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "wrong current password is 400, not 401"`

**C31** - Cada um dos 5 corpos recusados da tabela `Coverage` (`newPassword` de 11 caracteres, de
257 caracteres, `currentPassword` `123` não texto, campo faltando, chave extra) responde `400` com
`{ error }`, e a senha não muda em nenhum caso (AC 31)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "password change body validation"`

**C32** - `POST /auth/password` sem sessão responde `401` com a mensagem `SESSION_REQUIRED` da
Fase 3, não `400` nem `403` (AC 5)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "changing password without a session is 401"`

### S5 - Tela de usuários · 8 files · 20 KB · ~7k

**C33** - `/users`, renderizada com o usuário logado `admin` e `GET /users` respondendo os 3
usuários de C7, mostra uma tabela com as colunas na ordem "Nome", "E-mail", "Papel", "Situação",
uma linha por usuário na ordem recebida, com `role` mostrado como "Administrador", "Produção" ou
"Vendas" e `active` como "Ativo" ou "Inativo" (AC 32)
Proof: `npm --prefix web run test -- src/app/(app)/users/page.test.tsx -t "renders the user table in order"`

**C34** - Com `GET /users` pendente, a tela mostra `Carregando usuários…` e não mostra a tabela
(AC 33)
Proof: `npm --prefix web run test -- src/app/(app)/users/page.test.tsx -t "shows loading"`

**C35** - Com `GET /users` respondendo `500` `{ error: "Internal server error" }`, a tela mostra
essa mensagem e o botão `Tentar novamente`; clicar nele com `GET /users` respondendo `200` na
segunda chamada mostra a tabela (AC 34)
Proof: `npm --prefix web run test -- src/app/(app)/users/page.test.tsx -t "shows the error and retries"`

**C36** - Com `GET /users` respondendo `200` com lista vazia, a tela mostra `Nenhum usuário
cadastrado` no lugar da tabela (AC 35)
Proof: `npm --prefix web run test -- src/app/(app)/users/page.test.tsx -t "shows the empty state"`

**C37** - Preencher "Nome", "E-mail", "Senha" e "Papel" (`"Produção"`) no formulário "Novo usuário"
e clicar em "Criar usuário": enquanto `POST /users` está pendente o botão mostra `Criando…` e fica
`disabled`; com `201`, a tabela ganha uma linha com os dados criados e o formulário volta ao
estado inicial: "Nome", "E-mail" e "Senha" vazios, "Papel" de volta a `"Vendas"` (o padrão) (AC 36)
Proof: `npm --prefix web run test -- src/app/(app)/users/page.test.tsx -t "creates a user and clears the form"`

**C38** - Com `POST /users` respondendo `409` `{ error: "Já existe um usuário com este e-mail" }`,
a tela mostra essa mensagem junto ao formulário e mantém os 4 campos preenchidos como estavam (AC
37)
Proof: `npm --prefix web run test -- src/app/(app)/users/page.test.tsx -t "shows the create error and keeps the form"`

**C39** - Clicar em "Editar" numa linha mostra nela os campos "Nome", "E-mail", "Papel" e "Nova
senha" (vazia) preenchidos com os valores atuais e os botões "Salvar" e "Cancelar". Alterar só o
"Nome" e clicar em "Salvar" envia `PATCH` com exatamente `{ name: <valor novo> }` (sem `email`,
`role` nem `password`) (AC 38)
Proof: `npm --prefix web run test -- src/app/(app)/users/page.test.tsx -t "edit form sends only changed fields"`

**C40** - Com `PATCH` respondendo `200`, a linha fecha a edição e mostra os dados novos. Clicar em
"Cancelar" fecha a edição sem chamar a API, e a linha mostra os dados antigos (nenhum `PATCH`
disparado) (AC 39)
Proof: `npm --prefix web run test -- src/app/(app)/users/page.test.tsx -t "saving closes the edit, cancel discards it"`

**C41** - Com `PATCH` respondendo `409` `{ error: "Já existe um usuário com este e-mail" }`, a
linha mostra essa mensagem, continua em edição e mantém os valores digitados (AC 40)
Proof: `npm --prefix web run test -- src/app/(app)/users/page.test.tsx -t "edit error keeps the row open with typed values"`

**C42** - Clicar em "Desativar" numa linha ativa envia `PATCH` com `{ active: false }` e, com
`200`, a linha passa a mostrar "Inativo" e o botão "Ativar" no lugar de "Desativar". Clicar em
"Ativar" numa linha inativa envia `{ active: true }` e volta a mostrar "Ativo" e "Desativar". Com
`PATCH` respondendo erro, a linha mostra a mensagem do `{ error }` e mantém a situação e o botão
anteriores (AC 41)
Proof: `npm --prefix web run test -- src/app/(app)/users/page.test.tsx -t "toggling active sends the patch and reflects errors"`

**C43** - Na linha do próprio admin logado (mesmo `id` de `GET /auth/me`), a tela não mostra o
botão "Desativar", e o modo de edição dessa linha não mostra o campo "Papel" (AC 42)
Proof: `npm --prefix web run test -- src/app/(app)/users/page.test.tsx -t "the logged-in admin's own row hides deactivate and role"`

**C44** - Renderizada com o usuário logado `sales` (ou `production`), a tela mostra "Você não tem
permissão para acessar esta página" e nenhuma chamada a `GET /users` acontece (AC 43)
Proof: `npm --prefix web run test -- src/app/(app)/users/page.test.tsx -t "non-admin sees the permission message without calling the api"`

### S6 - Menu por papel e troca de senha na tela · 6 files · 12 KB · ~4k

**C45** - Com o usuário logado `admin`, o menu do shell mostra os 3 itens "Importar do MakerWorld",
"Usuários" e "Minha conta", nessa ordem, com `href` `/print-profiles`, `/users` e `/account` (AC
44)
Proof: `npm --prefix web run test -- src/components/app-shell.test.tsx -t "admin sees every menu item in order"`

**C46** - Com o usuário logado `production` e depois `sales`, o menu mostra só "Importar do
MakerWorld" e "Minha conta", sem "Usuários" nos dois casos (AC 45)
Proof: `npm --prefix web run test -- src/components/app-shell.test.tsx -t "production and sales do not see users"`

**C47** - `/account`, renderizada com qualquer papel, mostra os campos "Senha atual", "Nova senha"
e "Confirmar nova senha" (todos `type="password"`) e o botão "Trocar senha" (AC 46)
Proof: `npm --prefix web run test -- src/app/(app)/account/page.test.tsx -t "shows the password change form"`

**C48** - Preencher "Nova senha" e "Confirmar nova senha" com valores diferentes e clicar em
"Trocar senha" mostra `As senhas não conferem` sem nenhuma chamada à API (AC 47)
Proof: `npm --prefix web run test -- src/app/(app)/account/page.test.tsx -t "mismatched passwords are not sent"`

**C49** - Com os dois campos de senha nova iguais e o `POST /auth/password` pendente, o botão
mostra `Salvando…` e fica `disabled` (AC 48)
Proof: `npm --prefix web run test -- src/app/(app)/account/page.test.tsx -t "shows saving"`

**C50** - Com `POST /auth/password` respondendo `204`, a tela mostra `Senha alterada` e os 3 campos
voltam a ficar vazios (AC 49)
Proof: `npm --prefix web run test -- src/app/(app)/account/page.test.tsx -t "shows success and clears the form"`

**C51** - Com `POST /auth/password` respondendo `400` `{ error: "Senha atual incorreta" }`, a tela
mostra essa mensagem e continua em `/account` (nenhum `replace` do roteador). Com o `fetch`
rejeitando, mostra `Não foi possível conectar à API` (AC 50)
Proof: `npm --prefix web run test -- src/app/(app)/account/page.test.tsx -t "shows api and network errors, stays on the page"`

**C52** - `/account` respondendo `401` a `POST /auth/password` (ex.: sessão expirada durante a
troca) chama `replace("/login?next=%2Faccount")`, seguindo o comportamento já provado do shell
(Fase 3, C52), e não a mensagem de senha errada de C51 (limite entre S6 e S4)
Proof: `npm --prefix web run test -- src/app/(app)/account/page.test.tsx -t "a 401 redirects like any other protected page"`

**C53** - O `AppShell` recebe o papel do usuário como prop (não lê `role` de um contexto global
novo), e `auth-gate.tsx` continua passando `state.user` inteiro para ele: `grep` confirma que
`app-shell.tsx` declara uma prop `role` e que `auth-gate.tsx` passa `state.user.role` (startup
config / placement, não é door)
Proof: `grep -q "role?: UserRole" web/src/components/app-shell.tsx && grep -q "role={state.user.role}" web/src/components/auth-gate.tsx`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /users` statuses (3) | 200 C7 · 401 C7 · 403 C1 | - |
| `POST /users` statuses (5) | 201 C8 · 400 C12, C13 · 401 C10 · 403 C1 · 409 C10, C11 | - |
| `PATCH /users/:id` statuses (6) | 200 C14 · 400 C19, C20, C21 · 401 C19 · 403 C1 · 404 C19 · 409 C22, C23, C25, C26 | - |
| `POST /auth/password` statuses (3) | 204 C28 · 400 C30, C31 · 401 C32 | - |
| rotas do padrão da door 1 (3) | sem `@Roles()` C1 · `@Roles('sales')` C2 · rotas pré-existentes (pricing, print-profiles, auth/me, auth/password) C5 | - |
| papéis que chamam uma rota (3) | `admin` C1, C2, C5 · `production` C1, C4, C5 · `sales` C2, C4, C5 | - |
| corpos recusados na criação (8) | `name` vazio C12 · `name` 101 chars C12 · `email` sem formato C12 · `password` 11 chars C12, C13 · `password` 257 chars C12 · `role` `"owner"` C12 · campo faltando C12 · chave extra C12 | - |
| corpos recusados na edição (6) | `name` vazio C21 · `email` sem formato C21 · `role` `"owner"` C21 · `password` 11 chars C21 · `active` string C21 · chave extra C21 | - |
| corpos recusados na troca de senha (5) | `newPassword` 11 chars C31 · `newPassword` 257 chars C31 · `currentPassword` não texto C31 · campo faltando C31 · chave extra C31 | - |
| campos independentes do `PATCH` (4) | `name` C14 · `role` C14, C4 · `active` C15, C16 · `password` C17, C18 | - |
| motivos de `409` em `PATCH` (3) | e-mail duplicado C22 · própria conta (papel/ativo) C23 · último admin C25, C26 | - |
| último admin: quem dispara (2) | rebaixar C25 · desativar C25, C26 | - |
| revogação de sessão (3 gatilhos) | desativar C15 · redefinir senha por outro C17 · trocar a própria senha C29 | - |
| exceção "sessão da própria requisição" (2) | `PATCH` na própria senha por outro admin não afeta quem chamou C18 · `POST /auth/password` mantém a sessão da chamada C29 | - |
| doors do plano (2) | 1 `RolesGuard`/padrão de admin C1, C2, C3, C4, C6 · 2 contrato do usuário na administração C7, C8, C14 | - |
| door 2 - exclusão de `password_hash`/datas por rota (3) | `GET /users` C7 · `POST /users` C8 · `PATCH /users/:id` C14 - as 3 com chaves exatas, não `toMatchObject` | - |
| estados de `/users` (6) | carregando C34 · vazio C36 · erro C35 · criar (pendente/erro) C37, C38 · editar (salvar/cancelar/erro) C39, C40, C41 · desativar/ativar C42 | - |
| arranjo da tabela `/users` (4) | "Nome" 1ª coluna C33 · "E-mail" 2ª C33 · "Papel" 3ª C33 · "Situação" 4ª C33 | - |
| linha do próprio admin em `/users` (2) | sem "Desativar" C43 · sem campo "Papel" na edição C43 | - |
| não-admin em `/users` (1) | mensagem sem chamar a API C44 | - |
| itens do menu por papel (3) | `admin` (3 itens) C45 · `production` (2 itens) C46 · `sales` (2 itens) C46 | - |
| estados de `/account` (5) | formulário C47 · senhas não conferem C48 · salvando C49 · sucesso C50 · erro da API/rede C51 · 401 redireciona C52 | - |

- Claims naming a status code, route or response shape: C1, C2, C3, C5, C7 through C12, C14
  through C17, C19 through C23, and C25 through C32 - each has a proof that crosses the HTTP
  boundary
- C6 usa `grep` porque a claim é sobre *onde* `@Roles()` aparece no código-fonte, não sobre uma
  resposta em runtime; nenhuma outra claim desta fase usa esse atalho
- C53 é placement documentado, não um door: existe porque o `AppShell` (Fase 3) não tinha
  parâmetro de papel, e a claim é só "a prop existe e é usada", não uma regra de negócio

## Test policy

O repo não decide isoladamente onde prova um guard de autorização nem uma regra de concorrência
sobre `active`/`role`. Sigo a divisão das Fases 2 e 3: rota para o contrato HTTP, unidade só onde
o ramo é invisível na rota.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| `RolesGuard` (decide, alcançado pela rota) | um e2e por combinação papel × decorator | cada papel (admin, production, sales) × cada forma de decorator (ausente, `@Roles('x')`) |
| serviço de `users` - transação do último admin (decide, com concorrência) | e2e sequencial **e** e2e simultâneo | cada gatilho (rebaixar, desativar) na sequência; a corrida no simultâneo |
| serviço de `users` / `auth` - revogação de sessão (decide) | e2e por gatilho | os 3 gatilhos, com a exceção da sessão da própria requisição onde ela existe |
| DTOs de `users` e `auth/password` (validação, sem lógica própria) | um e2e tabela-driven por DTO | cada regra do `class-validator`, incluindo as bordas |
| componentes de tela (`/users`, `/account`, menu) | um com Testing Library por componente | cada estado como membro |

Evidence:

- `roles.guard.ts` (novo): dispatch sobre metadata ausente/presente × 3 papéis -> decide, mesma
  forma que `auth.guard.ts` da Fase 3, provado na rota (`protected-routes.e2e-spec.ts`)
- `users.service.ts` (novo): transação com `FOR UPDATE` sobre os admins ativos -> decide com
  concorrência, mesma forma que a poda de sessões e o seed concorrente da Fase 3 (C9, C34)
- `login-attempts.ts` da Fase 3 é o análogo mais próximo para "regra provada na própria camada
  e de novo na rota": aqui a regra do último admin só existe na rota (não há uma unidade separada
  para a query), então a prova sequencial e a simultânea substituem a dupla camada/rota

Cost: 1 arquivo e2e novo (`roles.e2e-spec.ts`), 1 arquivo e2e novo (`users.e2e-spec.ts`, o maior
desta fase), 3 componentes de tela novos com teste. Sem a linha C26, a regra do último admin só
seria provada pelo caminho sequencial, que uma implementação com `SELECT` sem `FOR UPDATE`
também passaria.

## Swept

- validation: C12, C13, C21, C31 - corpos de criação, edição e troca de senha, com as bordas de
  `name`, `password` e `newPassword`
- failure modes: C10, C19, C20, C22, C23, C25, C30 - toda falha vira `{ error }` com status
  definido; nenhuma grava nem altera parcialmente
- idempotency: C16 (reativar depois de desativar volta ao estado anterior); `PATCH` não é
  chamado duas vezes seguidas em nenhum check, então não há claim de idempotência da própria
  escrita além da unicidade de C11
- authorization: C1-C6 (a fatia inteira). C43-C44 no web
- concurrency: C11 (criação simultânea com o mesmo e-mail), C26 (desativação simultânea dos
  últimos dois admins)
- data lifecycle: C15, C17, C29 - sessões apagadas por desativação e por troca de senha (própria
  ou por outro admin)
- dependency failure: C35, C51 - API fora do ar ou com `500` em `/users` e em `/account`, mesmo
  padrão da Fase 3 (`Não foi possível conectar à API`)
- state transitions: C15, C16, C4 - ativo -> inativo -> ativo, e o papel valendo na requisição
  seguinte sem novo login
- observability: n/a - a assumption "Log" desta fase não vira critério numerado (nenhum AC exige
  uma linha de log específica), diferente da Fase 3 onde o log tinha AC próprio. Ficou fora do
  perímetro provável; se um builder decidir logar, não precisa de prova

## Out of scope

- Apagar usuários fisicamente - `plan.md`
- Papéis além dos três fixos, ou permissões configuráveis pela tela - `plan.md`
- Esconder custos/margens por papel dentro de uma resposta - `plan.md` (Fases 5, 12, 13)
- Recuperação de senha por e-mail - `plan.md`
- Troca de senha obrigatória no primeiro login - `plan.md`
- Listar e encerrar sessões ativas pela tela - `plan.md` (a desativação e a troca já encerram)
- Log de auditoria consultável - `plan.md` (Fase 9)
- Paginação e busca em `/users` - `plan.md`

## Handoff

Arquivos existentes tocados: `auth.module.ts`, `auth.controller.ts`, `auth.service.ts`, `users.module.ts`, `app.module.ts`, `auth-helper.ts`, `app-shell.tsx` + teste, `auth.ts` (tipo web) ≈ 91 KB somando com `ROADMAP.md` (a matriz de permissões é só um acréscimo nele, não uma reescrita - conto 3 KB do que realmente muda nele, não os 57 KB inteiros) ≈ 20 KB reais. Novos: `roles.decorator.ts`, `roles.guard.ts` + specs, `users.controller.ts`, `users.service.ts`, `dto/create-user.dto.ts`, `dto/update-user.dto.ts`, `dto/change-password.dto.ts`, 2 e2e novos (`roles.e2e-spec.ts`, `users.e2e-spec.ts`), páginas e componentes `/users` e `/account` com testes ≈ 85 KB.

- S1-S6 ≈ 20 KB + ~85 KB novos ≈ 105 KB ≈ 26k tokens: S1-S4 na API, S5-S6 no web. Abaixo do
  orçamento padrão de 150k: um builder só, sem pergunta
- Validação final com o Playwright MCP (AGENTS.md): entrar como admin, criar um usuário `sales`,
  ver "Usuários" sumir do menu dele e "Minha conta" aparecer; entrar como esse usuário e trocar a
  senha; voltar como admin, desativar e reativar o usuário; tentar desativar a própria conta do
  admin (sem botão); repetir uma chamada de `pricing` como `sales` para confirmar que continua
  liberada

- **Boundary:** C1-C53 fechados no working tree sobre `dd8f50c` (topo de `main`), sem commit (o
  `AGENTS.md` pede pedido explícito para commitar, mesma prática da Fase 3). API: lint ok, 94
  unitários (20 arquivos), 91 e2e (12 arquivos), build ok. Web: lint ok, 58 testes (10 arquivos),
  build ok. Provas por `grep`/bash de C6 e C53 ok
- **Settled mid-build:** C26 (corrida entre os dois últimos admins) revelou que a perdedora pode
  legitimamente responder `401` em vez de `409` - quando a sessão dela é revogada pelo `PATCH`
  vencedora antes da própria checagem, ela não está mais logada, o que é tão correto quanto o
  `409`. Corrigido o check e o teste para aceitar as duas respostas, nunca as duas `200` e nunca
  as duas bloqueadas. Nenhuma migration nova: `users`/`sessions` já tinham `role` e `active` desde
  a Fase 3. A questão 4 do ROADMAP recebeu uma nota de resposta parcial
- **Abandoned:** nada
- **Playwright (app no Docker, API real):** login como admin; `/users` mostra a tabela sem
  "Desativar" na própria linha; criou "Bia Vendas" (`sales`), formulário limpo depois; saiu e
  entrou como a Bia - menu com só "Importar do MakerWorld" e "Minha conta"; abrir `/users` pela
  URL mostra a mensagem de permissão sem carregar a tabela; trocou a própria senha em `/account`
  ("Senha alterada", campos limpos) e confirmou o login com a senha nova; voltou como admin,
  desativou a Bia ("Inativo"/"Ativar") e reativou ("Ativo"/"Desativar")

- **Verification round 1 (`standard`):** FAIL - 49/53 provados com evidência localizada, 5 faltas
  injetadas e 4 mortas (F4 sobreviveu), 21 conjuntos de `Coverage` recomputados com 3 membros não
  provados. Lacunas corrigidas nesta ordem:
  1. F4 sobrevivente (`users.e2e-spec.ts` C15): desativar apagava as sessões, mas nenhuma prova
     observava a exclusão - o `401` de `GET /auth/me` já vinha do `active` do usuário, não da
     ausência da linha. Acrescentada a contagem `SELECT count(*) FROM sessions`. Reinjetei F4 à
     mão depois do fix: agora morre (`users.service.ts:266`)
  2. C4 provado só na metade negativa: acrescentada `GET /probe-production` (`@Roles('production')`)
     e a asserção `200` depois da promoção, em `roles.e2e-spec.ts`
  3. C7, C10, C19: os comandos de prova apontavam para testes que não existiam (`passWithNoTests`,
     exit 0 sem rodar nada). Extraídos em `it()` próprios com o nome exato do `checks.md`
  4. Door 2 provada só em `GET /users`: `POST /users` (C8) e `PATCH /users/:id` (C14) passaram a
     conferir `Object.keys(...).sort()` exato, não só `toMatchObject`
  5. C33 sem prova de arranjo: acrescentada a asserção dos 4 cabeçalhos na ordem, em
     `users/page.test.tsx`
  6. `403` em `/users` provado só pela sonda sintética: acrescentado
     `non-admin roles get 403 on the real /users route` em `users.e2e-spec.ts`, referenciado como
     segunda prova de C1
  7. Precision gaps: C21/C22 passaram a conferir que o alvo não mudou; C24 perdeu a moldura
     "exatamente 1 admin ativo" (não era a claim real); C25 passou a conferir o papel/estado de
     quem chamou e do alvo, não uma contagem global; C37 passou a conferir "Senha" e "Papel"
     (volta a `"Vendas"`); C40 passou a contar as chamadas ao `PATCH` no cancelar (zero); C51
     passou a conferir que o roteador não é chamado; a prova de C53 trocou `grep -q "role"` (frouxo
     demais) pelas duas linhas literais
- **Round 1 fix:** todas as suítes verdes de novo depois (API: 95 e2e em 12 arquivos, 94
  unitários em 20; web: 58 em 10), lint e build ok nos dois. `validate_checks.py` exit 0
