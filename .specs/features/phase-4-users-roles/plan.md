# Fase 4 — Usuários e papéis

## Problem

Hoje o sistema tem um único usuário, o admin criado pelo seed. Não existe rota nem tela para
cadastrar outra pessoa. Para a equipe de produção ou de vendas entrar, alguém precisa inserir a
linha direto no Postgres, com o hash de senha calculado à mão. Quem esquece a senha fica sem
acesso, porque não há como trocá-la nem redefini-la. Desligar alguém também exige mexer no banco.

O papel (`admin`, `production`, `sales`) já está gravado em cada usuário, mas nenhuma rota o
consulta. Um usuário `sales` inserido no banco chega a tudo o que o admin chega. A partir da
Fase 5, isso inclui custos, margens, estoque e dados de clientes. O `CONTEXT.md` pede autenticação
**e papéis** (módulo 12), e o ROADMAP coloca esta fase antes de qualquer cadastro. A fonte não traz
números de incidente. O motivo é estrutural: sem autorização por papel, cada fase seguinte nasceria
aberta para todos os papéis.

Quando isto estiver pronto, o admin abre "Usuários", cria uma conta de vendas e entrega a senha.
Essa pessoa entra, vê só o menu que o papel dela permite e recebe `403` se tentar uma rota de
admin. Qualquer um troca a própria senha em "Minha conta". O admin desativa quem saiu, e a sessão
dessa pessoa cai na hora.

## Flow

Reaproveita o guard de sessão global (AD-015), que já recarrega o `User` a cada requisição (então
uma mudança de papel vale na requisição seguinte), o `hashPassword` em scrypt (AD-017), o
`normalizeEmail` e a detecção de violação de unicidade do seed, o filtro global de erros (AD-001) e
o `apiFetch` (AD-005). Não entra nenhuma dependência nova.

**Toda requisição autenticada**

1. request -> `AuthGuard` (exists) - rota `@Public()` passa direto. Nas demais, confere a sessão e põe o usuário (com o papel) e a sessão atual na requisição, ou lança `401`
2. `RolesGuard` (door 1) - rota `@Public()` passa. `admin` passa sempre. Senão, lê os papéis de `@Roles()`. Sem `@Roles()`, ou com o papel fora da lista, lança `403`
3. controller (exists) - executa a rota

**Administração de usuários**

1. `GET|POST|PATCH /users` -> `ValidationPipe` (exists) - recusa corpo inválido
2. controller de `users` (new, no door - placement per AD-004) - só `admin` (sem `@Roles()`, door 1)
3. serviço de `users` (new, no door - placement) - lista, cria e altera `User` (exists). Toda alteração de `role` ou `active` roda numa transação que trava com `FOR UPDATE` as linhas dos admins ativos e confere que sobra pelo menos um. Desativar ou redefinir a senha apaga as `Session` (exists) do usuário alvo, exceto a sessão da própria requisição
4. out: o usuário no formato da door 2, ou `{ error }` pelo filtro global (exists)

**Trocar a própria senha**

1. `POST /auth/password` -> controller de `auth` (exists) - `@Roles('production', 'sales')`, então todo papel chama
2. serviço de `auth` (exists) - confere a senha atual com o `PasswordHasher` (exists), grava o novo hash e apaga as outras sessões do usuário
3. out: `204`, ou `400 { error }` com a senha atual errada

**Web**

1. qualquer página protegida -> `AuthGate` (exists) - passa o usuário da sessão para o shell e para as páginas
2. `AppShell` (exists) - mostra no menu só os itens que o papel do usuário permite
3. `/users` (new, no door - placement) - lista, cria, edita, ativa e desativa. Para quem não é admin, mostra o aviso de permissão sem chamar a API
4. `/account` (new, no door - placement) - troca a própria senha

## Impact

| Front | What changes |
| --- | --- |
| domain | o termo `role` do `User` passa a decidir o acesso. Hoje ninguém ramifica nele: a API não o lê, e o web só o tem no tipo `AuthUser` (`web/src/lib/auth.ts`) |
| route | **toda rota protegida sem `@Roles()` passa a ser só de admin** (door 1). Para não mudar o comportamento de hoje, `POST /pricing/calculate`, `POST /print-profiles/import` e `GET /auth/me` recebem `@Roles('production', 'sales')` nesta mesma mudança |
| route | `GET /health`, `POST /auth/login` e `POST /auth/logout` continuam `@Public()` e não passam pelo `RolesGuard` |
| app | o `AuthModule` registra um segundo `APP_GUARD`, depois do `AuthGuard`, para que sem sessão a resposta continue `401` e não `403`. O `UsersModule` ganha controller e serviço. A detecção de violação de unicidade sai do `admin-seed.ts` para ser usada também na criação de usuário |
| tests | o `auth-helper.ts` dos e2e já cria usuários com papel. Os e2e de `pricing` e `print-profiles` passam a provar também os papéis `production` e `sales`. Os testes do web que simulam o `GET /auth/me` passam a variar o papel |
| web | o `AuthGate` expõe o usuário às páginas. O menu ganha "Usuários" (só admin) e "Minha conta" (todos) |
| docs | o ROADMAP ganha a seção "Matriz de permissões", e a questão 4 fica parcialmente respondida |
| decision | a door 1 e a door 2 viram entradas no `STATE.md`, porque as Fases 5 a 29 vão declarar papéis e reusar o contrato |
| stored data | nada para migrar. A tabela `users` já tem `role` e `active` desde a Fase 3. Nenhuma coluna ou índice novo |

## Relations

None - no stored-data shape change. `User` e `Session` já existem (AD-013, AD-014) e esta fase só
lê e altera linhas deles.

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /users` | cookie `forge_session` | lista de `id` · `name` · `email` · `role` · `active` · `{ error }` | `200`, `401`, `403` |
| `POST /users` | `name`, `email`, `password`, `role` | `id` · `name` · `email` · `role` · `active` · `{ error }` | `201`, `400`, `401`, `403`, `409` |
| `PATCH /users/:id` | `name`, `email`, `role`, `active`, `password` (todos opcionais, pelo menos um) | `id` · `name` · `email` · `role` · `active` · `{ error }` | `200`, `400`, `401`, `403`, `404`, `409` |
| `POST /auth/password` | `currentPassword`, `newPassword` | vazio · `{ error }` | `204`, `400`, `401` |
| `POST /pricing/calculate`, `POST /print-profiles/import`, `GET /auth/me` | igual ao atual | igual ao atual | os atuais, sem `403` para nenhum papel |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. autorização por papel (precedente) | `APP_GUARD` `RolesGuard` depois do `AuthGuard`. Rota protegida sem `@Roles()` é só de `admin`. `@Roles('production', 'sales')` libera outros papéis, e `admin` passa sempre, sem precisar ser listado. Recusa com `403 { "error": "Você não tem permissão para esta ação" }`. A matriz de permissões no ROADMAP registra o `@Roles()` de cada módulo | sem `@Roles()` liberar qualquer usuário logado: esquecer o decorator numa rota de custos ou de financeiro das Fases 5 a 29 a abriria para `sales` e `production` em silêncio, o mesmo motivo do AD-015. Exigir que o `admin` apareça em cada `@Roles()`: esquecê-lo trancaria o próprio admin para fora, e o `CONTEXT.md` não restringe nada ao administrador |
| 2. contrato do usuário na administração | `{ "id": "<uuid>", "name": "Ana", "email": "ana@brios3d.com", "role": "sales", "active": true }` em `GET /users` (lista sem envelope), `POST /users` e `PATCH /users/:id`. É o contrato da Fase 3 (`AuthUser`) mais `active`. `password_hash` e as datas nunca saem | devolver a entidade: vazaria o hash. Uma lista paginada ou com envelope `{ items, total }`: uma empresa com poucos operadores não chega a precisar, e a Fase 3 já fixou respostas sem envelope |

- Nada mais nesta mudança é difícil de reverter. As rotas novas só têm o web deste repositório como consumidor

## Criteria

### S1: autorização por papel na API (P1)

Cada rota protegida só responde aos papéis que ela declara, e o admin chega a todas.

**Acceptance Criteria**

1. IF um usuário `production` ou `sales` chama uma rota protegida sem `@Roles()` (ex.: `GET /users`) THEN the system SHALL responder `403` com `{ "error": "Você não tem permissão para esta ação" }` sem executar a rota
2. The system SHALL tratar uma rota nova sem `@Roles()` e sem `@Public()`, que não mencione papéis, como só de admin: `403` para `production` e `sales`, e `200` para `admin`
3. WHEN uma rota declara `@Roles('sales')` e recebe uma sessão de `sales` THEN the system SHALL executar a rota. WHEN recebe uma sessão de `production` THEN the system SHALL responder `403`
4. The system SHALL executar para um usuário `admin` toda rota protegida, com ou sem `@Roles()`
5. IF uma rota protegida, com ou sem `@Roles()`, chega sem sessão válida THEN the system SHALL responder `401` com a mensagem de sessão da Fase 3, e não `403`
6. WHEN `POST /pricing/calculate`, `POST /print-profiles/import`, `GET /auth/me` ou `POST /auth/password` recebem uma sessão válida de `production` ou de `sales` THEN the system SHALL responder como para o `admin`, sem `403`
7. WHEN o papel de um usuário muda por `PATCH /users/:id` THEN the system SHALL autorizar a próxima requisição da sessão dele pelo papel novo, sem novo login
8. The system SHALL documentar no `ROADMAP.md` uma seção "Matriz de permissões" com uma linha para cada um dos 17 módulos da API e as colunas `admin`, `production` e `sales`, preenchida para `auth`, `users`, `health`, `pricing` e `print-profiles` e marcada "a definir na Fase N" para os demais

**Independent test:** criar um usuário `sales`, entrar com ele e chamar `GET /users` (`403`) e `POST /pricing/calculate` (`200`).

### S2: listar e criar usuários (P1)

O admin vê todos os usuários e cadastra novos, que já conseguem entrar.

**Acceptance Criteria**

9. WHEN um admin chama `GET /users` THEN the system SHALL responder `200` com a lista de todos os usuários, ativos e inativos, cada um como `{ id, name, email, role, active }`, sem `password_hash` nem datas, ordenada por `name` e, no empate, por `email`
10. WHEN um admin chama `POST /users` com `name`, `email`, `password` e `role` válidos THEN the system SHALL responder `201` com `{ id, name, email, role, active: true }`, com o e-mail em minúsculas e sem espaços nas pontas
11. The system SHALL guardar a senha de um usuário criado só no formato `scrypt$N=131072,r=8,p=1$<salt>$<hash>` (AD-017)
12. WHEN o usuário criado por `POST /users` faz login com o e-mail e a senha informados THEN the system SHALL responder `200` com o papel informado na criação
13. IF o e-mail de `POST /users`, depois de normalizado, já pertence a outro usuário THEN the system SHALL responder `409` com `{ "error": "Já existe um usuário com este e-mail" }` e não gravar nada
14. IF duas chamadas `POST /users` com o mesmo e-mail chegam ao mesmo tempo THEN the system SHALL gravar um único usuário e responder `409` à outra
15. IF o corpo de `POST /users` tem `name` vazio depois de tirar os espaços ou com mais de 100 caracteres, `email` sem formato de e-mail, `password` com menos de 12 ou mais de 256 caracteres, `role` fora de `admin`, `production` e `sales`, algum dos quatro campos faltando ou outras chaves THEN the system SHALL responder `400` com `{ error }` e não gravar nada

**Independent test:** `curl -b jar -X POST localhost:3001/users -d '{"name":"Bia","email":"bia@brios3d.com","password":"senha-da-bia-1","role":"sales"}'`, depois `GET /users` mostra a Bia e o login dela devolve `200`.

### S3: editar, ativar e desativar usuários (P1)

O admin corrige dados, troca o papel, redefine a senha e desativa quem saiu, sem apagar ninguém.

**Acceptance Criteria**

16. WHEN um admin chama `PATCH /users/:id` com qualquer subconjunto não vazio de `name`, `email`, `role`, `active` e `password` THEN the system SHALL responder `200` com o usuário atualizado, e os campos não enviados SHALL ficar como estavam
17. WHEN `PATCH /users/:id` define `active: false` THEN the system SHALL apagar todas as sessões desse usuário, e a próxima requisição com o cookie dele SHALL responder `401`
18. WHILE um usuário está inativo the system SHALL responder `401` com `{ "error": "E-mail ou senha inválidos" }` ao login dele, mesmo com a senha certa
19. WHEN `PATCH /users/:id` define `active: true` num usuário inativo THEN the system SHALL aceitar de novo o login dele com a senha que ele já tinha
20. WHEN `PATCH /users/:id` define `password` THEN the system SHALL aceitar o login do usuário alvo só com a senha nova e apagar todas as sessões dele, exceto a sessão da própria requisição
21. IF o `:id` não é um UUID THEN the system SHALL responder `400` com `{ error }`. IF é um UUID sem usuário THEN the system SHALL responder `404` com `{ "error": "Usuário não encontrado" }`
22. IF o corpo de `PATCH /users/:id` não traz nenhum dos cinco campos THEN the system SHALL responder `400` com `{ "error": "Informe ao menos um campo para alterar" }`
23. IF um campo de `PATCH /users/:id` fere a regra do AC 15, `active` não é booleano ou o corpo traz outras chaves THEN the system SHALL responder `400` com `{ error }` e não alterar nada
24. IF o `email` novo, depois de normalizado, pertence a outro usuário THEN the system SHALL responder `409` com `{ "error": "Já existe um usuário com este e-mail" }` e não alterar nada
25. IF o admin tenta mudar o próprio `role` ou definir o próprio `active` como `false` THEN the system SHALL responder `409` com `{ "error": "Você não pode alterar o próprio papel nem se desativar" }` e não alterar nada
26. IF a alteração deixaria o sistema sem nenhum usuário `admin` ativo, inclusive quando dois admins rebaixam ou desativam um ao outro ao mesmo tempo THEN the system SHALL responder `409` com `{ "error": "O sistema precisa de pelo menos um administrador ativo" }` e manter pelo menos um admin ativo
27. The system SHALL não apagar usuários: não existe rota `DELETE /users/:id`, e ela responde `404`

**Independent test:** criar a Bia (S2), entrar como ela em outra sessão, desativá-la como admin, ver o `GET /auth/me` dela dar `401` e o login dela dar `401`. Reativar e ver o login dar `200`.

### S4: trocar a própria senha (P1)

Qualquer usuário logado troca a própria senha informando a atual.

**Acceptance Criteria**

28. WHEN `POST /auth/password` recebe `currentPassword` correta e `newPassword` válida THEN the system SHALL responder `204`, e o login SHALL passar a aceitar só a senha nova
29. WHEN a troca do AC 28 dá certo THEN the system SHALL apagar as outras sessões desse usuário e manter válida a sessão da requisição
30. IF `currentPassword` está errada THEN the system SHALL responder `400` com `{ "error": "Senha atual incorreta" }`, não alterar a senha e não encerrar a sessão (um `401` faria o web mandar a pessoa para o login)
31. IF `newPassword` tem menos de 12 ou mais de 256 caracteres, `currentPassword` não é texto não vazio, algum dos dois falta ou o corpo traz outras chaves THEN the system SHALL responder `400` com `{ error }` e não alterar nada

**Independent test:** entrar, `POST /auth/password` com a senha atual e uma nova (`204`), sair, entrar com a antiga (`401`) e com a nova (`200`).

### S5: tela de usuários (P1)

O admin administra os usuários pela tela `/users`.

**Acceptance Criteria**

32. WHEN um admin abre `/users` THEN the system SHALL mostrar uma tabela com as colunas "Nome", "E-mail", "Papel" e "Situação", na ordem da API, com o papel como "Administrador", "Produção" ou "Vendas" e a situação como "Ativo" ou "Inativo"
33. WHILE a lista está carregando the system SHALL mostrar "Carregando usuários…" no lugar da tabela
34. IF `GET /users` falha THEN the system SHALL mostrar a mensagem do `{ error }` (ou "Não foi possível conectar à API") e um botão "Tentar novamente" que carrega a lista de novo
35. IF `GET /users` devolve uma lista vazia THEN the system SHALL mostrar "Nenhum usuário cadastrado" no lugar da tabela
36. WHEN o admin preenche "Nome", "E-mail", "Senha" e "Papel" no formulário "Novo usuário" e clica em "Criar usuário" THEN the system SHALL mostrar "Criando…" no botão desabilitado e, com `201`, incluir o usuário na tabela e limpar o formulário
37. IF a criação falha THEN the system SHALL mostrar a mensagem do `{ error }` junto ao formulário e manter os valores digitados
38. WHEN o admin clica em "Editar" numa linha THEN the system SHALL mostrar nessa linha os campos "Nome", "E-mail", "Papel" e "Nova senha" (vazia) e os botões "Salvar" e "Cancelar". "Salvar" envia só os campos alterados, e uma "Nova senha" vazia não é enviada
39. WHEN o `PATCH` da edição responde `200` THEN the system SHALL fechar a edição e mostrar os dados novos na linha. WHEN o admin clica em "Cancelar" THEN the system SHALL fechar a edição sem chamar a API
40. IF o `PATCH` da edição falha THEN the system SHALL mostrar a mensagem do `{ error }` na linha e manter a edição aberta com os valores digitados
41. WHEN o admin clica em "Desativar" num usuário ativo, ou em "Ativar" num inativo THEN the system SHALL enviar `PATCH` com `active` e, com `200`, mostrar a nova situação e o botão oposto na linha. Com erro, SHALL mostrar a mensagem do `{ error }` na linha
42. WHILE a linha é a do próprio admin logado the system SHALL não mostrar o botão "Desativar" e não mostrar o campo "Papel" na edição dessa linha
43. IF um usuário `production` ou `sales` abre `/users` THEN the system SHALL mostrar "Você não tem permissão para acessar esta página" sem chamar `GET /users`

**Independent test:** entrar como admin, abrir `/users`, criar a Bia, editar o nome dela, desativá-la e reativá-la. Repetir com a API parada para ver o erro.

### S6: menu por papel e troca de senha na tela (P1)

Cada papel vê só o que pode usar, e todos trocam a própria senha em `/account`.

**Acceptance Criteria**

44. WHILE o usuário logado é `admin` the system SHALL mostrar no menu "Importar do MakerWorld", "Usuários" e "Minha conta"
45. WHILE o usuário logado é `production` ou `sales` the system SHALL mostrar no menu "Importar do MakerWorld" e "Minha conta", sem "Usuários"
46. WHEN a página `/account` abre THEN the system SHALL mostrar os campos "Senha atual", "Nova senha" e "Confirmar nova senha" e o botão "Trocar senha"
47. IF "Nova senha" e "Confirmar nova senha" são diferentes THEN the system SHALL mostrar "As senhas não conferem" sem chamar a API
48. WHILE a troca está em andamento the system SHALL mostrar "Salvando…" no botão e desabilitá-lo
49. WHEN a API responde `204` à troca THEN the system SHALL mostrar "Senha alterada" e limpar os três campos
50. IF a API responde erro à troca (ex.: `400` "Senha atual incorreta") ou não responde THEN the system SHALL mostrar a mensagem do `{ error }` (ou "Não foi possível conectar à API") e continuar em `/account` com a sessão

**Independent test:** entrar como `sales`, conferir que o menu não tem "Usuários", abrir `/account`, errar a senha atual (mensagem na tela) e depois trocar com sucesso.

## Out of scope

| Excluded | Why |
| --- | --- |
| Apagar usuários fisicamente | o ROADMAP pede só desativar, e as movimentações da Fase 9 vão apontar para o usuário |
| Papéis além de `admin`, `production` e `sales`, ou permissões configuráveis pela tela | o `CONTEXT.md` fixa os três papéis, e a matriz fica no código (`@Roles()`) |
| Esconder custos e margens por papel dentro de uma resposta | é a questão 4 e depende das telas de custo das Fases 5, 12 e 13. Aqui a autorização é por rota |
| Recuperar a senha por e-mail | o sistema não envia e-mail. O admin redefine a senha (AC 20) |
| Obrigar a troca de senha no primeiro login | o `CONTEXT.md` não pede. O usuário pode trocar em `/account` |
| Listar e encerrar sessões ativas pela tela | a desativação e a troca de senha já encerram as sessões (AC 17, 20, 29) |
| Log de auditoria consultável das alterações de usuário | o log de auditoria do `CONTEXT.md` é das movimentações de estoque (Fase 9) |
| Paginação e busca na lista de usuários | a empresa tem poucos operadores |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Quem usa as rotas de hoje (questão 4, parte) | `POST /pricing/calculate` e `POST /print-profiles/import` liberadas para os três papéis (AC 6) | mantém o comportamento da Fase 3. Vendas precisa do preço para orçar, e produção dos dados de impressão. Esconder o detalhamento de custo é decisão das Fases 5, 12 e 13 | n |
| Padrão da door 1 | rota sem `@Roles()` é só de admin, e o admin passa sempre | mesmo raciocínio do AD-015: o esquecimento vira `403`, não acesso indevido | n |
| Onde o admin redefine a senha de outro | campo `password` no `PATCH /users/:id` e "Nova senha" na edição da linha | a Fase 3 deixou a redefinição para esta fase, e uma rota separada só repetiria a validação | n |
| Status da senha atual errada | `400`, não `401` nem `403` | o `apiFetch` trata todo `401` como sessão expirada e manda para o login | n |
| Confirmação ao desativar | sem diálogo de confirmação | "Ativar" desfaz na hora, e a pessoa só precisa entrar de novo | n |
| Tamanho do nome | 1 a 100 caracteres depois de tirar os espaços das pontas | a coluna `name` é `varchar` sem limite, e 100 cabe em qualquer nome com folga numa tabela | n |
| Limite de tentativas na troca de senha | nenhum | a rota exige uma sessão válida, que já dá acesso à conta. O limite do login (Fase 3) continua valendo para quem não tem sessão | n |
| Log | o `Logger` do Nest registra criação, mudança de papel, ativação, desativação e redefinição de senha, com o id de quem fez e de quem sofreu a alteração, e a troca da própria senha. Nunca registra a senha | é o único rastro de quem mexeu em quem até existir auditoria | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| API `GET /users` | response shape | AC 9 (door 2) |
| API `POST /users` | response shape | AC 10 (door 2) |
| API `PATCH /users/:id` | response shape | AC 16 (door 2) |
| API `POST /auth/password` | response shape | AC 28 |
| all new `/users*` | error shape and codes | AC 1, AC 5, AC 13, AC 14, AC 15, AC 21, AC 22, AC 23, AC 24, AC 25, AC 26 |
| API `POST /auth/password` | error shape and codes | AC 5, AC 30, AC 31 |
| all protected routes | who may call it | AC 1, AC 2, AC 3, AC 4, AC 6 (door 1) |
| all new `/users*`, `POST /auth/password` | versioning | n/a - o projeto não versiona rotas, e o único consumidor é o web deste repositório |
| all new `/users*` | rate limit | n/a - só o admin chama, com sessão válida, e nenhuma dessas rotas testa senha |
| API `POST /auth/password` | rate limit | n/a - exige sessão válida. Veja a linha de limite em Assumptions |
| screen `/users` | empty state | AC 35 |
| screen `/users` | loading state | AC 33 |
| screen `/users` | error state | AC 34, AC 37, AC 40, AC 41 |
| screen `/users` | unauthorised state | AC 43. Sem sessão, o `AuthGate` da Fase 3 já manda para o login |
| screen `/users` | density and ordering | AC 32 - uma linha por usuário, na ordem da API (AC 9) |
| screen `/users` | destructive action confirms | n/a - não há exclusão (AC 27), e desativar se desfaz com "Ativar" (AC 41) |
| screen `/account` | empty state | AC 46 - o formulário abre vazio |
| screen `/account` | loading state | AC 48 |
| screen `/account` | error state | AC 47, AC 50 |
| screen `/account` | unauthorised state | n/a - todo papel pode trocar a própria senha. Sem sessão, o `AuthGate` já manda para o login |
| screen `/account` | density and ordering | n/a - três campos e um botão |
| screen `/account` | destructive action confirms | n/a - pedir a senha atual já confirma a troca |
| screen menu do shell | unauthorised state | AC 44, AC 45 |
| screen menu do shell | empty, loading, error states | existing - o `AuthGate` da Fase 3 só mostra o menu com a sessão carregada |
| screen menu do shell | density and ordering | AC 44 - a ordem dos itens é a listada |
| screen menu do shell | destructive action confirms | n/a - o menu só navega |

## Sources

- `ROADMAP.md`, Fase 4 e questão 4 - tarefas, critérios de aceite e a matriz de permissões a preencher fase a fase
- `CONTEXT.md`, módulo 12 - papéis administrador, operador de produção e vendas
- `.specs/features/phase-3-auth/plan.md` - contrato do usuário (door 6), guard global (door 5) e a redefinição de senha deixada para esta fase
