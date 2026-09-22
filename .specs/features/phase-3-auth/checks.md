# Fase 3 — Autenticação · checks

Profile: standard
Plan: `.specs/features/phase-3-auth/plan.md`

## Intent

58 checks em 8 fatias (C53–C58 acrescentados depois da rodada 1 do Verifier, sem alterar os anteriores) · 8 one-way doors · nenhuma questão aberta

O `AGENTS.md` não declara perfil. Uso `standard`, o mesmo das Fases 1 e 2. Esta fase decide quem
entra no sistema. Num guard, num limitador ou num redirecionamento, um teste pode passar com a
implementação errada, e é justamente isso que as falhas injetadas do `standard` pegam.

Os valores esperados vêm do `plan.md` (`## Criteria` e `## Landing`) e ficam escritos
**literalmente** nas asserções. Nunca derive o esperado chamando o próprio código em teste. Por
exemplo, o formato do hash é conferido por regex, e não comparando com `hashPassword` chamado de
novo.

Os e2e (`npm --prefix api run test:e2e`) montam o `AppModule` contra o `forge_test` e precisam do
`db` no ar (`docker compose up -d db`). Os arquivos e2e rodam em paralelo no mesmo banco, então
cada arquivo usa e-mails próprios (`<arquivo>-<caso>@test.local`) e apaga só os usuários que criou.
Os testes de unidade (`npm --prefix api run test`) não precisam do banco. No web, os testes usam
Vitest + Testing Library com o `fetch` substituído (como em `health-status.test.tsx`) e o
`next/navigation` simulado (`useRouter().replace` e `usePathname`).

Onde um critério depende do tempo (limite de tentativas, validade da sessão), a prova usa um
relógio injetado na unidade ou altera `expires_at` direto no banco no e2e. Nenhum teste espera
15 minutos nem 7 dias.

## Checks

### S1 - Login e logout pela API · 5 files · 30 KB · ~8k

**C1** - Com um usuário ativo `c1@test.local` e a senha certa, `POST /auth/login` responde `200` com um corpo cujas chaves são exatamente `id`, `name`, `email` e `role`: `id` no formato UUID, `name` e `email` do usuário, e `role` `"admin"`. O `Set-Cookie` é `forge_session=<43 caracteres base64url>` com `HttpOnly`, `SameSite=Lax`, `Path=/` e `Max-Age=604800` (AC 1, door 4, door 6)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "login returns the user and the session cookie"`

**C2** - Login com `email` `"  C2@Test.Local "` e a senha certa autentica o usuário gravado como `c2@test.local` (`200`, `email` `"c2@test.local"` no corpo) (AC 2)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "normalizes the login email"`

**C3** - Cada uma das 3 credenciais inválidas da tabela `Coverage` (senha errada, e-mail inexistente, usuário com `active` `false` e a senha certa) responde `401` com exatamente `{ "error": "E-mail ou senha inválidos" }` e sem cabeçalho `Set-Cookie` (AC 3)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "invalid credentials are 401"`

**C4** - No serviço de auth, com o repositório de usuários devolvendo nenhum usuário, o login chama a verificação de senha exatamente uma vez com um hash no formato `scrypt$N=131072,r=8,p=1$…` e rejeita com `401`. Com o usuário inativo, também verifica a senha antes de rejeitar (AC 4)
Proof: `npm --prefix api run test -- src/modules/auth/auth.service.spec.ts -t "compares against a dummy hash for unknown emails"`

**C5** - Cada um dos 6 corpos recusados da tabela `Coverage` responde `400` com `{ error }` (string), sem `Set-Cookie`. Uma senha errada com exatamente 256 caracteres responde `401`, e não `400` (AC 5)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "login body validation"`

**C6** - Depois do login de C1, `users.password_hash` desse usuário casa com `^scrypt\$N=131072,r=8,p=1\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{86}==$`, e a linha de `sessions` criada tem `token_hash` igual ao SHA-256 em hex (64 caracteres) do valor do cookie, diferente do próprio valor. Nenhuma coluna de `sessions` nem de `users` contém o token ou a senha em claro (AC 6, door 2, door 3)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "stores only hashes"`

**C7** - `hashPassword("senha-correta-12")` devolve uma string no formato `scrypt$N=131072,r=8,p=1$<salt>$<hash>` com o salt decodificado em 16 bytes e o hash em 64 bytes. Duas chamadas com a mesma senha dão strings diferentes. `verifyPassword` devolve `true` para a senha certa e `false` para `"senha-errada-12"` (door 3)
Proof: `npm --prefix api run test -- src/modules/auth/password.spec.ts -t "scrypt format"`

**C8** - `verifyPassword` lê os parâmetros da própria string: um hash gerado à mão com `crypto.scrypt` e `N=16384,r=8,p=1`, escrito no mesmo formato, verifica `true` com a senha certa. As strings `""`, `"bcrypt$x"`, `"scrypt$N=abc,r=8,p=1$AA==$AA=="` e um hash com 32 bytes no lugar de 64 devolvem `false` sem lançar (door 3)
Proof: `npm --prefix api run test -- src/modules/auth/password.spec.ts -t "verifies with the parameters in the hash"`

**C9** - O usuário `c9@test.local` tem 2 sessões expiradas e 1 válida, e o usuário `c9b@test.local` tem 1 expirada. Depois de um login de `c9`, as 2 expiradas de `c9` somem, e ficam a válida, a nova e a expirada de `c9b` (AC 7)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "login prunes the user's expired sessions"`

**C10** - `POST /auth/logout` com o cookie de um login responde `204`, a linha dessa sessão some de `sessions`, e o `Set-Cookie` traz `forge_session=` com `Max-Age=0` ou `Expires` no passado. Outra sessão do mesmo usuário continua na tabela (AC 8)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "logout deletes the session"`

**C11** - `POST /auth/logout` sem cookie e com `forge_session=naoexiste` respondem `204` (AC 9)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "logout without a session is 204"`

**C12** - Depois do logout de C10, `GET /auth/me` com o cookie antigo responde `401` (AC 10)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "session is unusable after logout"`

### S2 - Rotas protegidas · 6 files · 35 KB · ~9k

**C13** - `GET /auth/me` com o cookie de C1 responde `200` com exatamente `{ id, name, email, role }` do dono da sessão, os mesmos valores do corpo do login (AC 11, door 6)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "me returns the session user"`

**C14** - `GET /auth/me` responde `401` com exatamente `{ "error": "Sessão expirada ou inexistente. Entre novamente" }` em cada uma das 4 causas da tabela `Coverage`: sem cookie, token que não existe, sessão com `expires_at` no passado e sessão válida de um usuário com `active` `false` (AC 12, AC 13)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "me rejects invalid sessions"`

**C15** - Sem cookie, `POST /pricing/calculate` com o corpo R1 e `POST /print-profiles/import` com a URL do Sea star respondem `401` com a mensagem de C14, e o cliente falso do MakerWorld recebe zero chamadas (AC 12)
Proof: `npm --prefix api run test:e2e -- test/protected-routes.e2e-spec.ts -t "protected routes require a session"`

**C16** - Com o cookie de uma sessão válida, `POST /pricing/calculate` com R1 responde `200` e `POST /print-profiles/import` com a URL do Sea star responde `200`. As suítes e2e anteriores de `pricing` e `print-profiles` passam inteiras, entrando com um usuário antes das chamadas e sem mudar nenhuma asserção (AC 14)
Proof: `npm --prefix api run test:e2e -- test/protected-routes.e2e-spec.ts -t "protected routes answer with a session"`
Proof: `npm --prefix api run test:e2e -- test/pricing.e2e-spec.ts test/print-profiles.e2e-spec.ts`

**C17** - `GET /health` sem cookie responde `200` (AC 15)
Proof: `npm --prefix api run test:e2e -- test/protected-routes.e2e-spec.ts -t "health stays public"`

**C18** - Um controller de teste `GET /probe`, sem nenhum decorator de autenticação, registrado num módulo de teste junto com o `AppModule`, responde `401` sem cookie e `200` com uma sessão válida. Só `GET /health`, `POST /auth/login` e `POST /auth/logout` aparecem com `@Public()` em `api/src/` (AC 16, door 5)
Proof: `npm --prefix api run test:e2e -- test/protected-routes.e2e-spec.ts -t "undecorated route requires a session"`
Proof: `test "$(grep -rl '@Public()' api/src --include='*.controller.ts' | sort | tr '\n' ' ')" = "api/src/modules/auth/auth.controller.ts api/src/modules/health/health.controller.ts "`

**C19** - Depois do login, `sessions.expires_at` − `created_at` é 7 dias (± 1 s). Dez chamadas a `GET /auth/me` não mudam `expires_at`. Com `expires_at` alterado para 1 s no passado, `GET /auth/me` responde `401` (AC 17)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "session lasts seven days without renewal"`

**C20** - O cookie de sessão sai com `Secure` quando `SESSION_COOKIE_SECURE` está ausente ou vale `"true"`, e sem `Secure` quando vale `"false"`. Os outros atributos de C1 são iguais nos 3 casos (door 4, assumption "`Secure` no cookie")
Proof: `npm --prefix api run test -- src/modules/auth/session-cookie.spec.ts -t "secure unless disabled"`

**C21** - Um preflight `OPTIONS /auth/me` com `Origin: http://localhost:3000` (o `FRONTEND_URL` do teste) responde com `access-control-allow-origin: http://localhost:3000` e `access-control-allow-credentials: true`. Com `Origin: http://evil.test`, a resposta não traz `access-control-allow-origin: http://evil.test` (door 7)
Proof: `npm --prefix api run test:e2e -- test/cors.e2e-spec.ts -t "allows credentials only for the frontend origin"`

**C22** - O CORS é configurado só no `configureApp`, que tanto o `main.ts` quanto os e2e chamam: `api/src/main.ts` chama `configureApp(app)` e não chama `enableCors` (startup config)
Proof: `grep -q "configureApp(app)" api/src/main.ts && ! grep -q "enableCors" api/src/main.ts`

### S3 - Limite de tentativas · 3 files · 12 KB · ~3k

**C23** - No limitador com relógio injetado, 4 falhas para `a@test.local` deixam o e-mail liberado, e a 5ª falha dentro de 15 min o bloqueia (AC 18, door 8)
Proof: `npm --prefix api run test -- src/modules/auth/login-attempts.spec.ts -t "blocks after five failures"`

**C24** - Com a 5ª falha em `t`, o e-mail segue bloqueado em `t + 14 min 59 s` e liberado em `t + 15 min` (AC 19)
Proof: `npm --prefix api run test -- src/modules/auth/login-attempts.spec.ts -t "unblocks fifteen minutes after the fifth failure"`

**C25** - 4 falhas, 1 sucesso e mais 4 falhas deixam o e-mail liberado (AC 20)
Proof: `npm --prefix api run test -- src/modules/auth/login-attempts.spec.ts -t "success resets the count"`

**C26** - 4 falhas em `t` e 1 falha em `t + 15 min + 1 s` deixam o e-mail liberado: só contam as falhas dos últimos 15 min (AC 18)
Proof: `npm --prefix api run test -- src/modules/auth/login-attempts.spec.ts -t "only failures within fifteen minutes count"`

**C27** - 5 falhas de `a@test.local` não bloqueiam `b@test.local` (AC 21)
Proof: `npm --prefix api run test -- src/modules/auth/login-attempts.spec.ts -t "emails are counted independently"`

**C28** - Pela rota: 5 logins de `c28@test.local` com a senha errada respondem `401`. O 6º, com a senha **certa**, responde `429` com exatamente `{ "error": "Muitas tentativas de login. Tente novamente em 15 minutos" }` e sem `Set-Cookie`. No mesmo momento, o login de `c28b@test.local` com a senha certa responde `200` (AC 18, AC 21)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "sixth attempt is 429"`

**C29** - As falhas contam pelo e-mail normalizado e também para um e-mail que não existe: 5 falhas com `"  C29@Test.Local "` bloqueiam o login certo de `c29@test.local` (`429`), e 5 falhas de `naoexiste-c29@test.local` fazem a 6ª tentativa dele responder `429`, não `401` (AC 21)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "attempts count by normalized email"`

### S4 - Seed do primeiro admin · 3 files · 10 KB · ~3k

**C30** - Subir a app com `ADMIN_EMAIL` `"  Seed30@Test.Local "`, `ADMIN_PASSWORD` de exatamente 12 caracteres e sem `ADMIN_NAME` cria exatamente 1 usuário `seed30@test.local`, com `role` `admin`, `active` `true` e `name` `"Administrador"`, e o login com essa senha responde `200`. Com `ADMIN_NAME` `"Mateus"` (outro e-mail), o `name` é `"Mateus"` (AC 22)
Proof: `npm --prefix api run test:e2e -- test/admin-seed.e2e-spec.ts -t "creates the first admin"`

**C31** - Com o usuário de C30 alterado no banco para `role` `sales`, `active` `false` e `name` `"Outro"`, subir a app de novo com o mesmo `ADMIN_EMAIL`, outra `ADMIN_PASSWORD` e outro `ADMIN_NAME` deixa `password_hash`, `name`, `role` e `active` idênticos aos de antes, e continua havendo 1 usuário com esse e-mail (AC 23)
Proof: `npm --prefix api run test:e2e -- test/admin-seed.e2e-spec.ts -t "keeps an existing user untouched"`

**C32** - Sem `ADMIN_EMAIL`, e depois sem `ADMIN_PASSWORD`, a app sobe (`init` resolve), a contagem de usuários não muda e o `Logger` recebe um `warn` contendo `ADMIN_EMAIL` e `ADMIN_PASSWORD` (AC 24)
Proof: `npm --prefix api run test:e2e -- test/admin-seed.e2e-spec.ts -t "skips the seed without admin env"`

**C33** - Com `ADMIN_PASSWORD` de 11 caracteres, `app.init()` rejeita com um erro cuja mensagem é `"ADMIN_PASSWORD precisa ter pelo menos 12 caracteres"`, e nenhum usuário é criado com aquele e-mail (AC 25)
Proof: `npm --prefix api run test:e2e -- test/admin-seed.e2e-spec.ts -t "refuses a short admin password"`

**C34** - Duas apps sobem ao mesmo tempo (`Promise.all` dos dois `init`) com o mesmo `ADMIN_EMAIL` novo: os dois `init` resolvem e existe exatamente 1 usuário com aquele e-mail
Proof: `npm --prefix api run test:e2e -- test/admin-seed.e2e-spec.ts -t "concurrent seeds create one admin"`

### S5 - Schema e observabilidade · 3 files · 12 KB · ~3k

**C35** - A migration cria `users` com as restrições da door 1: inserir um segundo usuário com o mesmo `email` falha por violação de unicidade (`23505`), `role` `'owner'` falha (`22P02`), `role` nulo falha (`23502`), e um usuário inserido sem `id` nem `active` recebe um UUID e `active` `true` (door 1)
Proof: `npm --prefix api run test:e2e -- test/auth-schema.e2e-spec.ts -t "users constraints"`

**C36** - A migration cria `sessions` com as restrições da door 2: dois `token_hash` iguais falham com `23505`, `user_id` inexistente falha com `23503`, e apagar o usuário apaga as suas sessões (door 2)
Proof: `npm --prefix api run test:e2e -- test/auth-schema.e2e-spec.ts -t "sessions constraints"`

**C37** - O serviço de auth registra: `log` no login certo com o e-mail normalizado; `warn` na falha com o e-mail e o motivo (`wrong password`, `unknown email`, `inactive`); `warn` no bloqueio com o e-mail e `blocked`. Nenhum argumento passado ao `Logger` contém a senha tentada nem o token da sessão (assumption "Log")
Proof: `npm --prefix api run test -- src/modules/auth/auth.service.spec.ts -t "logs login outcomes without secrets"`

**C38** - O `.env.example` declara `ADMIN_NAME`, `ADMIN_EMAIL` (`admin@brios3d.local`), `ADMIN_PASSWORD` vazio e `SESSION_COOKIE_SECURE=false` (assumption "Senha do seed no `.env.example`")
Proof: `grep -qx "ADMIN_NAME=.*" .env.example && grep -qx "ADMIN_EMAIL=admin@brios3d.local" .env.example && grep -qx "ADMIN_PASSWORD=" .env.example && grep -qx "SESSION_COOKIE_SECURE=false" .env.example`

### S6 - Tela de login · 5 files · 15 KB · ~4k

**C39** - A página de login, renderizada com `GET /auth/me` respondendo `401`, mostra um campo com rótulo `E-mail`, um de tipo `password` com rótulo `Senha` e o botão `Entrar`, e nenhum elemento com o papel `navigation`. O `web/src/app/layout.tsx` não renderiza o `AppShell` (AC 26)
Proof: `npm --prefix web run test -- src/components/login-form.test.tsx -t "shows the login form without navigation"`
Proof: `! grep -q "AppShell" web/src/app/layout.tsx`

**C40** - Com o `POST /auth/login` pendente, o botão mostra `Entrando…` e fica `disabled` (AC 27)
Proof: `npm --prefix web run test -- src/components/login-form.test.tsx -t "shows signing in"`

**C41** - Para cada resposta de erro da tabela `Coverage` (`401` `E-mail ou senha inválidos`, `429` `Muitas tentativas de login. Tente novamente em 15 minutos`, `400` `email must be an email`), a tela mostra exatamente a mensagem do `{ error }`, o campo `E-mail` mantém `ana@brios3d.com` e o roteador não é chamado (AC 28)
Proof: `npm --prefix web run test -- src/components/login-form.test.tsx -t "shows the api error and keeps the email"`

**C42** - Com o `fetch` do login rejeitando, a tela mostra `Não foi possível conectar à API` (AC 29)
Proof: `npm --prefix web run test -- src/components/login-form.test.tsx -t "shows the network error"`

**C43** - Depois de um login `200`, o roteador recebe `replace` com o destino de cada um dos 6 valores de `next` da tabela `Coverage`: `/print-profiles` e `/print-profiles?x=1` vão para eles mesmos, e sem `next`, `https://evil.test`, `//evil.test` e `/\evil.test` vão para `/` (AC 30)
Proof: `npm --prefix web run test -- src/lib/safe-next.test.ts -t "only same-site paths"`
Proof: `npm --prefix web run test -- src/components/login-form.test.tsx -t "goes to next after login"`

**C44** - A página de login com `GET /auth/me` respondendo `200` chama `replace("/")` e não mostra o formulário (AC 31)
Proof: `npm --prefix web run test -- src/components/login-form.test.tsx -t "redirects a signed in user"`

**C45** - O `apiFetch` sempre manda `credentials: "include"`, inclusive quando recebe um `init` com `method`, `headers` e `body`. Com um `init` que traz `credentials: "omit"`, ele manda `"include"` mesmo assim (door 7)
Proof: `npm --prefix web run test -- src/lib/api.test.ts -t "sends credentials"`

### S7 - Shell protegido e logout no web · 4 files · 15 KB · ~4k

**C46** - Com `usePathname` `/print-profiles` e `GET /auth/me` respondendo `401`, o shell chama `replace("/login?next=%2Fprint-profiles")` e o conteúdo da página não aparece (AC 32)
Proof: `npm --prefix web run test -- src/components/auth-gate.test.tsx -t "redirects without a session"`

**C47** - Com `GET /auth/me` pendente, o shell mostra `Carregando…`, e nem o conteúdo da página nem a navegação aparecem (AC 33)
Proof: `npm --prefix web run test -- src/components/auth-gate.test.tsx -t "shows loading while checking"`

**C48** - Com `GET /auth/me` rejeitando (rede), o shell mostra `Não foi possível conectar à API` e o botão `Tentar novamente`, e o roteador não é chamado. Com `500` `{ error: "Internal server error" }`, mostra essa mensagem e o mesmo botão. Clicar em `Tentar novamente` com o `me` respondendo `200` mostra o conteúdo, e o `fetch` do `me` foi chamado 2 vezes (AC 34)
Proof: `npm --prefix web run test -- src/components/auth-gate.test.tsx -t "shows the error and retries"`

**C49** - Com `GET /auth/me` respondendo `200` para `{ name: "Ana Souza", … }`, o shell mostra o conteúdo da página, a navegação com o link `Importar do MakerWorld` (`href` `/print-profiles`) e, dentro do `banner`, o texto `Ana Souza` e o botão `Sair` (AC 35)
Proof: `npm --prefix web run test -- src/components/auth-gate.test.tsx -t "shows the page with the user"`

**C50** - Clicar em `Sair` faz um `POST` para `<NEXT_PUBLIC_API_URL>/auth/logout` e, com a resposta `204`, chama `replace("/login")` (AC 36)
Proof: `npm --prefix web run test -- src/components/auth-gate.test.tsx -t "signs out"`

**C51** - Clicar em `Sair` com o `fetch` do logout rejeitando mostra `Não foi possível sair. Tente novamente`, não chama o roteador e mantém o conteúdo da página e o nome no cabeçalho (AC 37)
Proof: `npm --prefix web run test -- src/components/auth-gate.test.tsx -t "sign out failure keeps the page"`

**C52** - Dentro do shell com `usePathname` `/print-profiles` e a sessão válida, um componente filho cujo `apiFetch` recebe `401` faz o shell chamar `replace("/login?next=%2Fprint-profiles")`. Um `401` do `POST /auth/login` na tela de login não aciona esse redirecionamento (C41) (AC 38)
Proof: `npm --prefix web run test -- src/components/auth-gate.test.tsx -t "a 401 inside the page redirects to login"`

### S8 - Lacunas da rodada 1 do Verifier · 5 files · 8 KB · ~2k

Acrescentados depois da verificação da rodada 1 (FAIL: race no limitador, 2 ramos sem prova e 1
borda imprecisa). Nenhum check anterior mudou. Os testes de C12 e C31 passaram a montar o próprio
estado, para cada prova passar sozinha, sem mudar nenhuma asserção.

**C53** - 10 logins simultâneos (`Promise.all`) de `c53@test.local` com a senha errada respondem exatamente 5 vezes `401` e 5 vezes `429`: a tentativa entra na contagem antes de qualquer `await` (AC 18, door 8)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "concurrent attempts cannot bypass the limit"`

**C54** - `verifyPassword` devolve `false`, sem lançar, para um hash bem formado com parâmetros que o scrypt recusa: `N=3` (não é potência de 2) e `N=1048576,r=8` (passa do `maxmem` de 256 MB) (door 3)
Proof: `npm --prefix api run test -- src/modules/auth/password.spec.ts -t "invalid scrypt parameters are false"`

**C55** - Com mais de 10.000 e-mails rastreados, a limpeza descarta os que só têm falhas com mais de 15 min e mantém um e-mail bloqueado: depois de 10.001 e-mails com 1 falha em `t`, 5 falhas de `alvo@test.local` em `t + 1 min` e uma nova falha em `t + 15 min 30 s`, `alvo@test.local` segue bloqueado e o limitador rastreia só `alvo@test.local` e o e-mail da nova falha (door 8)
Proof: `npm --prefix api run test -- src/modules/auth/login-attempts.spec.ts -t "prunes stale entries and keeps blocks"`

**C56** - A janela é de 15 min exatos: 4 falhas em `t` e 1 em `t + 15 min − 1 ms` bloqueiam; 4 falhas em `t` e 1 em `t + 15 min` não bloqueiam (AC 18)
Proof: `npm --prefix api run test -- src/modules/auth/login-attempts.spec.ts -t "window edge is exactly fifteen minutes"`

**C57** - Pela rota, um login certo não entra na contagem: 4 logins de `c57@test.local` com a senha errada e depois 2 com a certa respondem `401` ×4, `200`, `200`; e 6 logins certos seguidos de `c57b@test.local` respondem `200` todas as vezes (AC 20, door 8). Acrescentado depois da rodada 2 do Verifier (mutante F5)
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "a correct login never counts as a failure"`

**C58** - Pela rota, um login certo zera as falhas anteriores mesmo quando não é ele que atinge o limite: para `c58@test.local`, 2 erradas, 1 certa, 2 erradas e 1 certa respondem `401`, `401`, `200`, `401`, `401`, `200` (AC 20, door 8). Acrescentado depois da rodada 3 do Verifier (mutante G2), com autorização do usuário para a rodada 4
Proof: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "a correct login clears earlier failures"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /auth/login` statuses (4) | 200 C1, C2 · 400 C5 · 401 C3, C5 · 429 C28, C29 | - |
| `POST /auth/logout` statuses (1) | 204 C10, C11 | - |
| `GET /auth/me` statuses (2) | 200 C13 · 401 C12, C14, C19 | - |
| `POST /pricing/calculate` statuses (3) | 200 C16 · 400 C16 (suíte `pricing` com sessão) · 401 C15 | - |
| `POST /print-profiles/import` statuses (5) | 200 C16 · 400 C16 · 404 C16 · 502 C16 (suíte `print-profiles` com sessão) · 401 C15 | - |
| credenciais inválidas no login (3) | senha errada C3 · e-mail inexistente C3, C4 · usuário inativo C3, C4 | - |
| corpos recusados no login (6) | `{}` sem nada C5 · `email` `"ana"` sem formato de e-mail C5 · `password` `""` C5 · `password` com 257 caracteres C5 · `password` `123` (não texto) C5 · chave extra `remember: true` C5 | - |
| borda do tamanho da senha (2) | 256 caracteres aceito (`401`, não `400`) C5 · 257 recusado C5 | - |
| causas de `401` numa rota protegida (4) | sem cookie C14, C15 · token inexistente C14 · sessão expirada C14, C19 · usuário desativado C14 | - |
| rotas protegidas nesta fase (4) | `GET /auth/me` C14 · `POST /pricing/calculate` C15 · `POST /print-profiles/import` C15 · rota nova sem decorator C18 | - |
| rotas públicas (3) | `GET /health` C17 · `POST /auth/login` C1 · `POST /auth/logout` C11 | - |
| regras do limitador (7) | bloqueia na 5ª C23, C28 · libera 15 min depois da 5ª C24 · sucesso zera C25, pela rota C57, sem ser a tentativa que bloqueia C58 · janela de 15 min C26, borda exata C56 · por e-mail C27, C28 · tentativas simultâneas C53 · limpeza acima de 10.000 C55 | - |
| chave do limitador (2) | e-mail normalizado C29 · e-mail inexistente C29 | - |
| `SESSION_COOKIE_SECURE` (3 valores) | ausente C20 · `"true"` C20 · `"false"` C20 | - |
| ramos do seed (5) | cria sem `ADMIN_NAME` C30 · cria com `ADMIN_NAME` C30 · usuário já existe C31 · falta variável C32 · senha curta C33 | - |
| variáveis que faltam no seed (2) | `ADMIN_EMAIL` C32 · `ADMIN_PASSWORD` C32 | - |
| motivos de log (5) | sucesso C37 · `wrong password` C37 · `unknown email` C37 · `inactive` C37 · `blocked` C37 | - |
| erros da tela de login (4) | `401` C41 · `429` C41 · `400` C41 · rede C42 | - |
| valores de `next` (6) | `/print-profiles` C43 · `/print-profiles?x=1` C43 · ausente C43 · `https://evil.test` C43 · `//evil.test` C43 · `/\evil.test` C43 | - |
| estados da tela de login (5) | formulário C39 · entrando C40 · erro da API C41 · erro de rede C42 · já logado C44 | - |
| estados do shell protegido (7) | carregando C47 · sem sessão C46 · erro de rede C48 · erro `500` C48 · com sessão C49 · logout C50 · falha no logout C51 | - |
| origem do `401` no web (2) | `GET /auth/me` do shell C46 · chamada de um filho C52 | - |
| ramos de `verifyPassword` (3) | senha certa C7 · formato inválido C8 · parâmetros recusados pelo scrypt C54 | - |
| one-way doors do plano (8) | 1 `users` C35, C1 · 2 `sessions` C36, C6, C9 · 3 formato do hash C7, C8, C6 · 4 cookie C1, C20 · 5 autenticação por padrão C18 · 6 contrato do usuário C1, C13 · 7 credenciais CORS/web C21, C45 · 8 limitador C23–C29 | - |
| entidades (2) | `User` C35 · `Session` C36 | - |
| startup config (3 lugares) | CORS pelo `configureApp` no `main.ts` C22 · CORS pelo `configureApp` nos e2e C21 · guard global e seed dentro do `AppModule`, que o `main.ts` e os e2e montam C18, C30 | - |

- Claims naming a status code, route or response shape: C1–C3, C5, C10–C19, C21, C28, C29 - each has a proof that crosses the HTTP boundary
- C23–C27 prove the limitador at its own layer with a clock; C28 and C29 re-prove it at the route. One does not substitute for the other
- C4 and C37 assert at the service layer because the dummy comparison and the log arguments are invisible at the route
- C16 reruns the two existing suites under a session: their `400`, `404` and `502` members stay proven by the Fase 2 checks C26–C30 and the Fase 1 checks, now with a cookie
- Nothing proves the browser actually sends the cookie across `3000` → `3001`: C21 proves the CORS headers and C45 the `credentials`, and the Playwright pass at the end proves the real login in the browser

## Test policy

O repo diz onde os testes ficam, mas não em que nível cada código se prova. Sigo a política da Fase 2.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decide, alcançado pela rota (serviço de auth, guard) | um na rota **e** um na própria camada quando o ramo é invisível na rota | na rota, cada status e cada causa de `401`; na camada, a comparação falsa e o log |
| Decide, fora da rota (hash, limitador, cookie, `safeNext`) | um na própria camada | um caso por linha da regra, com as bordas |
| Seed na inicialização | um e2e que sobe a app | cada ramo do seed |
| Componente de tela | um com Testing Library | cada estado da tela como membro |

Evidence:

- `password`: formato, parâmetros lidos da string, 4 formas malformadas -> decide
- `login-attempts`: 5 regras (limiar, desbloqueio, reset, janela, chave) -> decide
- serviço de auth: 3 motivos de `401`, comparação falsa, poda de sessões, 4 logs -> decide
- guard: `@Public()`, 4 causas de `401` -> decide, provado na rota (C14, C18)
- análogo no repo: `print-profiles` na Fase 2, mesma divisão entre unidade e e2e; `health-status.test.tsx` para os estados da tela

Cost: 4 specs de unidade na API, 5 arquivos e2e novos mais 2 ajustados, 4 testes no web. Sem essas
linhas, o limitador só seria provado pelo caminho de `429` do e2e, e o formato do hash só pela regex.

## Swept

- validation: C5, C8, C43 - corpo do login, strings de hash malformadas e o `next` do login
- failure modes: C3, C14, C33, C42, C48, C51 - toda falha vira `{ error }` com status definido, e o seed com a senha curta impede a inicialização em vez de subir sem admin
- idempotency: C11 (logout repetido é `204`), C31 (o seed não muda nada na segunda vez)
- authorization: C14, C15, C18 - toda rota exige sessão, exceto as 3 públicas (C17, C18)
- concurrency: C34 - dois seeds simultâneos criam 1 admin, pelo índice único de C35. C53 - logins simultâneos não furam o limite: a tentativa conta antes do primeiro `await` (a redação da rodada 1, "sem corrida entre `await`s", estava errada; o Verifier achou a corrida)
- data lifecycle: C9 (poda das sessões expiradas no login), C10 (logout apaga a sessão), C36 (apagar o usuário apaga as sessões)
- dependency failure: C42, C48, C51 - API fora do ar na tela de login, no shell e no logout. O banco fora do ar segue o filtro global (`500` genérico, AD-001)
- state transitions: C12, C19, C14 - sessão válida -> encerrada (logout) ou expirada; usuário ativo -> inativo corta a sessão
- observability: C37 (login, falha com motivo e bloqueio, sem segredos), C32 (seed ignorado)

## Handoff

Arquivos que a fase toca: 14 existentes somando 35 KB (`wc -c`: `main.ts`, `app.setup.ts`, `app.module.ts`, os e2e de `pricing` e `print-profiles`, `.env.example`, `layout.tsx`, `page.tsx`, `app-shell.tsx` e seu teste, `api.ts` e seu teste, `print-profile-import.tsx`) e uns 28 novos (módulos `auth` e `users`, migration, 4 specs, 5 e2e, página e componentes de login e do shell, `safeNext` e testes).

- S1–S7 ≈ 35 KB + ~95 KB novos ≈ 130 KB ≈ 33k tokens: S1–S5 na API, S6–S7 no web. Fica abaixo do orçamento padrão de 150k: um builder só, sem pergunta
- Validação final com o Playwright MCP (AGENTS.md): sem cookie, abrir `/print-profiles` e cair no login; errar a senha; entrar e voltar para `/print-profiles` com o nome no cabeçalho; importar a URL do MakerWorld com a sessão; sair; repetir com a API parada

- **Boundary:** C1-C52 fechados no working tree sobre `48eaf95`, sem commit (o `AGENTS.md` pede pedido explícito para commitar). API: lint ok, 90 unitários, 57 e2e em 10 arquivos, build ok. Web: lint ok, 38 testes, build ok. Provas por `grep` de C18, C22, C38 e C39 ok
- **Settled mid-build:** o usuário definiu os domínios de produção (`forge.brios3d.com.br` e `api.brios3d.com.br`, AD-012), o que fechou a questão aberta do plano. O `docker-compose.yml` passou a repassar as variáveis novas ao container da API. O controller de sondagem de `errors.e2e-spec.ts` (Fase 0) ganhou `@Public()`, porque prova o contrato de erro e não a autenticação. Nenhuma asserção mudou. Em C32, a prova de que "a contagem não muda" usa um espião no `insert` do repositório em vez de `count(*)`, porque os outros arquivos e2e gravam usuários em paralelo
- **Abandoned:** conferir a sessão num effect que dependia do `router`: a referência instável refazia o `GET /auth/me` em loop (6 chamadas no C48). Trocado por um contador de tentativas
- **Playwright (app no Docker, API real e MakerWorld real):** sem cookie, `/print-profiles` -> `/login?next=%2Fprint-profiles`; senha errada mostra `E-mail ou senha inválidos`; senha certa volta para `/print-profiles` com `Admin Local` e `Sair` no cabeçalho; a importação do Sea star preenche o formulário; a sessão expirada no banco durante a importação leva de volta ao login; `Sair` leva a `/login`; com a API parada, `/` mostra `Não foi possível conectar à API` e `Tentar novamente`, que depois de religar a API leva ao login
- **Verification round 1 (`standard`):** FAIL - 50/52 provados, 5 falhas injetadas e 5 mortas. Lacunas: race no limitador (10 logins simultâneos sem nenhum `429`), C12 e C31 dependiam da ordem dos testes, `catch` de `verifyPassword` e limpeza do limitador sem prova, borda da janela imprecisa. Corrigido: a tentativa conta antes do primeiro `await` (`auth.service.ts`), C12 e C31 montam o próprio estado, C53–C56 acrescentados. Lições L-006 a L-009 registradas
- **Verification round 2 (`standard`, escopada):** FAIL - 56/56 provados, as 6 lacunas da rodada 1 resolvidas, 5 falhas injetadas e 4 mortas. Sobreviveu F5 (sem `recordSuccess`, o 2º login certo depois de 4 falhas dava `429`). C57 acrescentado; o aviso do oxlint no `.sort()` de C53 foi corrigido. Lição L-010 registrada
- **Verification round 3 (`standard`, escopada):** FAIL - 56/57 PASS, F5 e G1 mortos pelo C57, oxlint limpo. Sobreviveu G2 (o serviço só zerava quando o próprio login bloqueava; a sequência 2 erradas, 1 certa, 2 erradas, 1 certa dá `429` no fim). C57 é instável: roda perto do timeout padrão de 5000 ms e estourou 1 vez em 5. Limite de 3 rodadas atingido; aguardando o usuário. Lições L-011 e L-012 registradas
- **Round 4 fix (autorizada pelo usuário além do limite de 3):** C58 acrescentado (2 erradas, 1 certa, 2 erradas, 1 certa -> `200` no fim); `testTimeout: 30_000` no `vitest.config.e2e.ts` para os testes que fazem vários hashes scrypt
- **Verification round 4 (`standard`, escopada, autorizada pelo usuário):** PASS - 58/58 provados, G2, F5 e G1 mortos, C57 5/5 sozinho com o timeout de 30 s. `validate_verification.py` exit 0
