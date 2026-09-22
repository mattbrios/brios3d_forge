# Fase 3 — Autenticação verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 48eaf95..working tree (uncommitted)
**Round**: 4 - scoped
**Verifier**: independent sub-agent (author != verifier)

A feature continua sem commit. O escopo é `git diff 48eaf95` mais os arquivos não rastreados.
Rodei tudo read-only sobre o tree real. As falhas foram injetadas numa cópia por `rsync` em
`<scratchpad>/verify-tree-r4` (sem `node_modules`, `.next`, `dist` e `.git`, com
`api/node_modules` e `web/node_modules` em symlink para o tree real), apagada no fim. O
`git status --porcelain` do tree real foi gravado antes (40 linhas) e saiu idêntico depois (`diff`
vazio). `git stash` não foi usado (`git stash list`: 0).

**Escopo da correção, conferido por mtime e não pela descrição:** depois do relatório da rodada 3
(`verification.md`, 23:44:19), os únicos arquivos de código alterados são
`api/test/auth.e2e-spec.ts` e `api/vitest.config.e2e.ts` (ambos 23:51:20), mais `checks.md` e o
`api/tsconfig.build.tsbuildinfo` gerado pelo build. Nenhum arquivo de `api/src` nem de `web/`
mudou (`find ... -newer verification.md`). Bate com o brief:

- `api/test/auth.e2e-spec.ts`: `c58@test.local` entrou em `EMAILS` (`:38`), o que deslocou em +1
  todas as citações seguintes até C57; C58 é novo (`:325-333`), inserido antes de C29, que desceu
  para `:335-346` (+11 em relação à rodada 3).
- `api/vitest.config.e2e.ts:13`: `testTimeout: 30_000` (o `git diff 48eaf95` do arquivo mostra só
  essa linha e o comentário `:12`).

**O `testTimeout` pode mascarar algo?** Não para nenhum check. Ele só eleva o limite por teste de
5000 ms para 30 000 ms em todos os e2e; não muda asserção, `include`, `globalSetup`, `setupFiles`
nem o `hookTimeout` (segue o padrão). Uma asserção falsa continua falhando igual; o que o limite
maior deixaria passar é só lentidão ou um teste que termina entre 5 s e 30 s, e nenhum check da
fase afirma tempo pela rota (C4 prova a comparação falsa na unidade por contagem de chamadas, não
por cronômetro). Um travamento real (> 30 s) ainda falha. Os três mutantes desta rodada foram mortos
por asserção (`AssertionError`), não por timeout, então a folga não esconde nenhum deles.

## Binding sources

Carried from round 3: o plano não marca nenhuma fonte como binding, o passo 1 só roda em `ui`, e a
correção não mexeu na interface.

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| none - o plano não marca fonte binding | n/a - `standard` | none | - |

## Round-3 gaps

| # | Lacuna da rodada 3 | Situação na rodada 4 |
| --- | --- | --- |
| 1 | mutante G2 (`if (this.attempts.isBlocked(email)) this.attempts.recordSuccess(email)` em `auth.service.ts:58`) passava nas suítes inteiras | **resolvida** - reinjetado na cópia, morreu em C58: `AssertionError: expected [ 401, 401, 200, 401, 401, 429 ] to deeply equal [ 401, 401, 200, 401, 401, 200 ]` (`api/test/auth.e2e-spec.ts:332`) |
| 2 | membro de cobertura "reset pelo serviço quando o sucesso não bloqueia" (AC 20) sem prova | **resolvida** - provado por C58 pela rota (ver `## Coverage`, linha recomputada) |
| 3 | Test policy "Decide, alcançado pela rota" não atendida | **resolvida** - re-julgada: a decisão de zerar no sucesso agora tem prova na rota nos dois casos (C57 quando o sucesso é a 5ª tentativa, C58 quando não é); F5, G1 e G2 mortos |
| 4 | prova de C57 instável (perto do timeout padrão de 5000 ms, 1 falha em 5) | **resolvida** - com `testTimeout: 30_000`, C57 sozinho como escrito passou 5/5 (4,65–5,35 s); 3 dessas 5 execuções passaram de 5000 ms e teriam estourado o limite antigo, o que confirma o diagnóstico da rodada 3. C58 sozinho passou 5/5 (2,37–2,83 s) |

## Checks

**Rodadas das provas (tree real, round 4, uma invocação por alvo, `--reporter=verbose`):**

- **API unit**: `npm --prefix api run test -- src/modules/auth/auth.service.spec.ts src/modules/auth/password.spec.ts src/modules/auth/session-cookie.spec.ts src/modules/auth/login-attempts.spec.ts --reporter=verbose -t "<13 nomes>"`:
  4 arquivos, 13 passed, cada nome com ✓ na própria linha.
- **API e2e**: `npm --prefix api run test:e2e -- test/auth.e2e-spec.ts test/protected-routes.e2e-spec.ts test/cors.e2e-spec.ts test/admin-seed.e2e-spec.ts test/auth-schema.e2e-spec.ts --reporter=verbose -t "<29 nomes>"`:
  5 arquivos, 29 passed, exit 0, cada nome com ✓ (inclui `a correct login never counts as a failure` em 5571 ms e `a correct login clears earlier failures` em 2409 ms).
  A segunda prova de C16 (`test/pricing.e2e-spec.ts test/print-profiles.e2e-spec.ts`) rodou inteira: 2 arquivos, 20 passed, exit 0.
- **Web**: `npm --prefix web run test -- src/components/login-form.test.tsx src/lib/safe-next.test.ts src/lib/api.test.ts src/components/auth-gate.test.tsx --reporter=verbose -t "<15 nomes>"`:
  15 passed e 5 skipped (os 5 testes antigos de `api.test.ts` fora do filtro), exit 0. Cada nome com ✓.
- **Shell**: as provas por `grep` de C18, C22, C38 e C39 saíram todas com exit 0.
- **C57 sozinho, exatamente como escrito** (`npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "a correct login never counts as a failure"`), 5 execuções:
  todas exit 0, `1 passed | 16 skipped`; tempo de testes 4,65 s · 4,85 s · 5,17 s · 5,01 s · 5,35 s.
- **C58 sozinho, exatamente como escrito** (`npm --prefix api run test:e2e -- test/auth.e2e-spec.ts -t "a correct login clears earlier failures"`), 5 execuções:
  todas exit 0, `1 passed | 16 skipped`; tempo de testes 2,81 s · 2,83 s · 2,75 s · 2,72 s · 2,37 s.

Na coluna `Proof run`, "verified in round 4" marca as linhas cujo arquivo de teste a correção tocou
(`auth.e2e-spec.ts`, citações refeitas: +1 até C57, +11 em C29) e a linha nova C58. "carried from
round 3" marca as linhas cujo arquivo não mudou desde a rodada 3 (mtime anterior a 23:44:19), com a
citação herdada. Em todas, a prova foi rodada de novo nesta rodada e o `testTimeout` novo vale para
todas as provas e2e.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | login 200, corpo `{id,name,email,role}`, cookie `forge_session` com atributos | ✓ r4 · verified in round 4 | `api/test/auth.e2e-spec.ts:81` - `Object.keys(body).sort() toEqual(['email','id','name','role'])`; `auth.e2e-spec.ts:82` - `body.id toMatch(UUID)`; `auth.e2e-spec.ts:83` - `toMatchObject({ name: 'Ana C1', email: 'c1@test.local', role: 'admin' })`; `auth.e2e-spec.ts:88` - `parts[0] toMatch(/^forge_session=[A-Za-z0-9_-]{43}$/)`; `auth.e2e-spec.ts:89-92` - `toContain('HttpOnly'/'SameSite=Lax'/'Path=/'/'Max-Age=604800')` | PASS |
| C2 | e-mail com caixa e espaços autentica `c2@test.local` | ✓ r4 · verified in round 4 | `api/test/auth.e2e-spec.ts:98-99` - `status toBe(200)`, `email toBe('c2@test.local')` | PASS |
| C3 | 3 credenciais inválidas: 401, mensagem exata, sem Set-Cookie | ✓ r4 · verified in round 4 | `api/test/auth.e2e-spec.ts:112-114` - `toBe(401)`, `body toEqual(INVALID)` (`:40` `'E-mail ou senha inválidos'`), `set-cookie toBeUndefined()` sobre os 3 casos de `:105-109` | PASS |
| C4 | e-mail inexistente compara com hash falso; inativo também verifica | ✓ r4 · carried from round 3 | `api/src/modules/auth/auth.service.spec.ts:61-65` - `toBe(401)`, `verify toHaveBeenCalledTimes(1)`, `hash toMatch(/^scrypt\$N=131072,r=8,p=1\$/)`; `auth.service.spec.ts:68-70` - inativo `toBe(401)`, `toHaveBeenCalledWith('senha-correta-12', STORED)` | PASS |
| C5 | 6 corpos -> 400 `{error}` sem cookie; 256 chars -> 401 | ✓ r4 · verified in round 4 | `api/test/auth.e2e-spec.ts:129-131` - `toBe(400)`, `typeof error toBe('string')`, `set-cookie toBeUndefined()` sobre `:119-126`; `auth.e2e-spec.ts:134` - `edge.status toBe(401)` | PASS |
| C6 | só hashes no banco | ✓ r4 · verified in round 4 | `api/test/auth.e2e-spec.ts:145-146` - `password_hash toMatch(/^scrypt\$N=131072,r=8,p=1\$[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{86}==$/)`; `auth.e2e-spec.ts:152-154` - `token_hash toBe(sha256(token))`, `toMatch(/^[0-9a-f]{64}$/)`, `not.toBe(token)`; `auth.e2e-spec.ts:157-158` - `not.toContain(token/PASSWORD)` | PASS |
| C7 | formato scrypt, salt 16 / hash 64 bytes, sal aleatório, verify | ✓ r4 · carried from round 3 | `api/src/modules/auth/password.spec.ts:10-12` - `match not.toBeNull()`, `toHaveLength(16)`, `toHaveLength(64)`; `password.spec.ts:14-16` - `not.toBe(stored)`, `toBe(true)`, `toBe(false)` | PASS |
| C8 | parâmetros lidos da string; 4 strings malformadas -> false | ✓ r4 · carried from round 3 | `api/src/modules/auth/password.spec.ts:23` - `N=16384` `toBe(true)`; `password.spec.ts:34` - `resolves.toBe(false)` sobre `''`, `'bcrypt$x'`, `N=abc`, hash de 32 bytes (`:27-32`) | PASS |
| C9 | login poda só as expiradas do próprio usuário | ✓ r4 · verified in round 4 | `api/test/auth.e2e-spec.ts:177` - `c9Hashes toEqual([sha256('c9-valid'), sha256(tokenOf(cookie))].sort())`; `auth.e2e-spec.ts:178` - `toEqual([sha256('c9b-expired')])` | PASS |
| C10 | logout 204, apaga a sessão, expira o cookie, mantém a outra | ✓ r4 · verified in round 4 | `api/test/auth.e2e-spec.ts:194` - `toBe(204)`; `auth.e2e-spec.ts:196` - `hashes toEqual([sha256(tokenOf(other))])`; `auth.e2e-spec.ts:202` - `toBe('forge_session=')`; `auth.e2e-spec.ts:205` - `maxAgeZero` ou `Expires < now` `toBe(true)` | PASS |
| C11 | logout sem cookie / token inexistente -> 204 | ✓ r4 · verified in round 4 | `api/test/auth.e2e-spec.ts:219` - `toBe(204)`; `auth.e2e-spec.ts:221` - `unknown.status toBe(204)` | PASS |
| C12 | sessão encerrada não serve em `/auth/me` | ✓ r4 · verified in round 4 | `api/test/auth.e2e-spec.ts:212` - logout da própria sessão `status toBe(204)`; `auth.e2e-spec.ts:214` - `response.status toBe(401)` | PASS |
| C13 | `/auth/me` devolve o dono da sessão, mesmo corpo do login | ✓ r4 · verified in round 4 | `api/test/auth.e2e-spec.ts:228-231` - `toBe(200)`, `body toEqual(loginResponse.body)`, chaves `['email','id','name','role']`, `toMatchObject({ name: 'Ana C13', email: 'c13@test.local', role: 'sales' })` | PASS |
| C14 | 4 causas -> 401 com a mensagem exata | ✓ r4 · verified in round 4 | `api/test/auth.e2e-spec.ts:252-253` - `toBe(401)`, `body toEqual(SESSION_REQUIRED)` (`:41`) sobre sem cookie, `naoexiste`, expirada e inativo (`:246-249`) | PASS |
| C15 | pricing/import sem cookie -> 401 sem executar | ✓ r4 · carried from round 3 | `api/test/protected-routes.e2e-spec.ts:77-78` - `toBe(401)`, `toEqual(SESSION_REQUIRED)`; `protected-routes.e2e-spec.ts:80` - `fakeClient.calls toBe(0)` | PASS |
| C16 | com sessão, 200 nas duas rotas; suítes antigas passam sem mudar asserção | ✓ r4 + as 2 suítes, 20 passed · carried from round 3 | `api/test/protected-routes.e2e-spec.ts:85` - `pricing.status toBe(200)`; `protected-routes.e2e-spec.ts:90` - `imported.status toBe(200)`; os dois arquivos de suíte não mudaram desde a rodada 3 (mtime), só setup e cookie em relação a `48eaf95` | PASS |
| C17 | `/health` sem cookie 200 | ✓ r4 · carried from round 3 | `api/test/protected-routes.e2e-spec.ts:95` - `status toBe(200)` | PASS |
| C18 | rota nova sem decorator exige sessão; só 3 rotas `@Public()` | ✓ r4 + grep exit 0 · carried from round 3 | `api/test/protected-routes.e2e-spec.ts:100-101` - `toBe(401)`, `toEqual(SESSION_REQUIRED)`; `protected-routes.e2e-spec.ts:103-104` - `toBe(200)`, `toEqual({ ok: true })`; `@Public()` em `api/src/modules/auth/auth.controller.ts:23`, `:36` e `api/src/modules/health/health.controller.ts:6` | PASS |
| C19 | 7 dias fixos, sem renovação, expirada -> 401 | ✓ r4 · verified in round 4 | `api/test/auth.e2e-spec.ts:269` - `abs(ttl - 7*24*3600) toBeLessThanOrEqual(1)`; `auth.e2e-spec.ts:273` - `expires_at toEqual(before.expires_at)`; `auth.e2e-spec.ts:279` - `toBe(401)` | PASS |
| C20 | `Secure` salvo `SESSION_COOKIE_SECURE=false` | ✓ r4 · carried from round 3 | `api/src/modules/auth/session-cookie.spec.ts:11-17` - `toEqual({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 604800 * 1000, secure })` para `{}`->true, `'true'`->true, `'false'`->false | PASS |
| C21 | CORS com credenciais só para o `FRONTEND_URL` | ✓ r4 · carried from round 3 | `api/test/cors.e2e-spec.ts:34-35` - `toBe('http://localhost:3000')`, `toBe('true')`; `cors.e2e-spec.ts:38` - `not.toBe('http://evil.test')` | PASS |
| C22 | CORS só no `configureApp` | grep exit 0 · carried from round 3 | `api/src/main.ts:7` - `configureApp(app);`, sem `enableCors`; `api/src/app.setup.ts:9-12` - `app.enableCors({ origin: ..., credentials: true })` | PASS |
| C23 | 4 falhas liberado, 5ª bloqueia | ✓ r4 · carried from round 3 | `api/src/modules/auth/login-attempts.spec.ts:20` - `toBe(false)`; `login-attempts.spec.ts:23` - `toBe(true)` | PASS |
| C24 | bloqueado em t+14:59, liberado em t+15:00 | ✓ r4 · carried from round 3 | `api/src/modules/auth/login-attempts.spec.ts:33` - `toBe(true)`; `login-attempts.spec.ts:35` - `toBe(false)` | PASS |
| C25 | sucesso zera (no `LoginAttempts`) | ✓ r4 · carried from round 3 | `api/src/modules/auth/login-attempts.spec.ts:43` - `isBlocked toBe(false)` depois de 4 falhas, `recordSuccess` e mais 4 | PASS |
| C26 | só falhas dos últimos 15 min contam | ✓ r4 · carried from round 3 | `api/src/modules/auth/login-attempts.spec.ts:51` - `isBlocked toBe(false)` após `+15 min +1 s` | PASS |
| C27 | e-mails independentes | ✓ r4 · carried from round 3 | `api/src/modules/auth/login-attempts.spec.ts:57-58` - `a toBe(true)`, `b toBe(false)` | PASS |
| C28 | 6ª com senha certa -> 429 exato, sem cookie; outro e-mail 200 | ✓ r4 · verified in round 4 | `api/test/auth.e2e-spec.ts:286` - `toBe(401)` ×5; `auth.e2e-spec.ts:289-293` - `toBe(429)`, `toEqual({ error: 'Muitas tentativas de login. Tente novamente em 15 minutos' })`, `set-cookie toBeUndefined()`; `auth.e2e-spec.ts:294` - `toBe(200)` | PASS |
| C29 | conta pelo e-mail normalizado e para e-mail inexistente | ✓ r4 · verified in round 4 | `api/test/auth.e2e-spec.ts:340` - `toBe(429)` depois de 5 falhas com `'  C29@Test.Local '` (`:337-339`); `auth.e2e-spec.ts:343` - `toBe(401)` ×5; `auth.e2e-spec.ts:345` - `toBe(429)` | PASS |
| C30 | seed cria admin normalizado, nome padrão ou `ADMIN_NAME` | ✓ r4 · carried from round 3 | `api/test/admin-seed.e2e-spec.ts:68-69` - `toHaveLength(1)`, `toMatchObject({ role: 'admin', active: true, name: 'Administrador' })`; `admin-seed.e2e-spec.ts:73` - `login.status toBe(200)`; `admin-seed.e2e-spec.ts:77` - `name toBe('Mateus')` | PASS |
| C31 | seed não mexe em usuário existente | ✓ r4 · carried from round 3 | `api/test/admin-seed.e2e-spec.ts:94-96` - `toHaveLength(1)`, `after[0] toEqual(before)`, `toMatchObject({ role: 'sales', active: false, name: 'Outro' })` | PASS |
| C32 | sem variável: sobe, não insere, avisa | ✓ r4 · carried from round 3 | `api/test/admin-seed.e2e-spec.ts:106-107` - `toHaveLength(0)`, `insert not.toHaveBeenCalled()`; `admin-seed.e2e-spec.ts:110-112` - `some(includes('ADMIN_EMAIL') && includes('ADMIN_PASSWORD')) toBe(true)` | PASS |
| C33 | senha de 11 chars recusa a inicialização | ✓ r4 · carried from round 3 | `api/test/admin-seed.e2e-spec.ts:122` - `rejects.toThrow('ADMIN_PASSWORD precisa ter pelo menos 12 caracteres')`; `admin-seed.e2e-spec.ts:124` - `toHaveLength(0)` | PASS |
| C34 | dois seeds simultâneos criam 1 admin | ✓ r4 · carried from round 3 | `api/test/admin-seed.e2e-spec.ts:131` - `toHaveLength(1)` depois de `Promise.all([boot(), boot()])` (`:129`) | PASS |
| C35 | restrições de `users` | ✓ r4 · carried from round 3 | `api/test/auth-schema.e2e-spec.ts:48-49` - UUID v4 `toMatch`, `active toBe(true)`; `auth-schema.e2e-spec.ts:51-53` - `toBe('23505')`, `toBe('22P02')`, `toBe('23502')` | PASS |
| C36 | restrições de `sessions` | ✓ r4 · carried from round 3 | `api/test/auth-schema.e2e-spec.ts:64` - `toBe('23505')`; `auth-schema.e2e-spec.ts:65-67` - `toBe('23503')`; `auth-schema.e2e-spec.ts:73` - `n toBe(0)` | PASS |
| C37 | logs de sucesso, 3 motivos e bloqueio, sem segredos | ✓ r4 · carried from round 3 | `api/src/modules/auth/auth.service.spec.ts:82-83` - `log toHaveBeenCalledTimes(1)`, `toContain('ana@test.local')`; `auth.service.spec.ts:98-105` - `toContain('wrong password'/'unknown email'/'inactive'/'blocked')`; `auth.service.spec.ts:109` - `everything not.toContain(secret)` | PASS |
| C38 | `.env.example` com as 4 variáveis | grep exit 0 · carried from round 3 | `.env.example:14` `SESSION_COOKIE_SECURE=false`; `.env.example:18-20` `ADMIN_NAME=Administrador`, `ADMIN_EMAIL=admin@brios3d.local`, `ADMIN_PASSWORD=` | PASS |
| C39 | login com campos e botão, sem navegação; layout raiz sem `AppShell` | ✓ r4 + grep exit 0 · carried from round 3 | `web/src/components/login-form.test.tsx:59-62` - `tagName toBe('INPUT')`, `type toBe('password')`, botão `Entrar`, `queryByRole('navigation') toBeNull()`; `web/src/app/layout.tsx:26-28` - só `{children}` | PASS |
| C40 | `Entrando…` desabilitado | ✓ r4 · carried from round 3 | `web/src/components/login-form.test.tsx:69-70` - `findByRole('button', { name: 'Entrando…' })`, `disabled toBe(true)` | PASS |
| C41 | 401/429/400 mostram `{error}`, mantêm e-mail, sem roteador | ✓ r4 · carried from round 3 | `web/src/components/login-form.test.tsx:83-85` - `alert textContent toBe(message)`, `value toBe('ana@brios3d.com')`, `replace not.toHaveBeenCalled()` | PASS |
| C42 | erro de rede | ✓ r4 · carried from round 3 | `web/src/components/login-form.test.tsx:94` - `toBe('Não foi possível conectar à API')` | PASS |
| C43 | 6 valores de `next` | ✓ r4 (2 provas) · carried from round 3 | `web/src/lib/safe-next.test.ts:6-11` - os 6 `toBe`; `web/src/components/login-form.test.tsx:112-113` - `toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith(destination)` sobre os 6 casos (`:98-105`) | PASS |
| C44 | com sessão, `/login` redireciona e esconde o formulário | ✓ r4 · carried from round 3 | `web/src/components/login-form.test.tsx:123-125` - `toHaveBeenCalledWith('/')`, `queryByLabelText('E-mail') toBeNull()`, botão `toBeNull()` | PASS |
| C45 | `credentials: "include"` sempre | ✓ r4 · carried from round 3 | `web/src/lib/api.test.ts:94` - `toEqual(['include','include','include'])` (o 3º com `credentials: 'omit'`, `:91`); `api.test.ts:95-99` - `toMatchObject({ method: 'POST', headers, body: '{}' })` | PASS |
| C46 | sem sessão -> `/login?next=%2Fprint-profiles` | ✓ r4 · carried from round 3 | `web/src/components/auth-gate.test.tsx:82` - `toHaveBeenCalledWith('/login?next=%2Fprint-profiles')`; `auth-gate.test.tsx:84` - conteúdo `toBeNull()` | PASS |
| C47 | `Carregando…` sem conteúdo nem navegação | ✓ r4 · carried from round 3 | `web/src/components/auth-gate.test.tsx:94-96` - `getByText('Carregando…')`, conteúdo `toBeNull()`, `navigation toBeNull()` | PASS |
| C48 | erro de rede / 500 com retry, `me` chamado 2x | ✓ r4 · carried from round 3 | `web/src/components/auth-gate.test.tsx:107-109` - mensagem, botão, `replace not.toHaveBeenCalled()`; `auth-gate.test.tsx:119-120` - `'Internal server error'`; `auth-gate.test.tsx:124-125` - conteúdo, `callsTo(..., '/auth/me') toHaveLength(2)` | PASS |
| C49 | página, navegação com link e nome + `Sair` no banner | ✓ r4 · carried from round 3 | `web/src/components/auth-gate.test.tsx:137-138` - link `Importar do MakerWorld`, `href toBe('/print-profiles')`; `auth-gate.test.tsx:140-141` - `within(banner)` `Ana Souza` e botão `Sair` | PASS |
| C50 | `Sair` -> POST logout -> `/login` | ✓ r4 · carried from round 3 | `web/src/components/auth-gate.test.tsx:155` - `toHaveBeenCalledWith('/login')`; `auth-gate.test.tsx:157-158` - `toBe('http://api.test:3001/auth/logout')`, `method toBe('POST')` | PASS |
| C51 | logout falho mantém a página | ✓ r4 · carried from round 3 | `web/src/components/auth-gate.test.tsx:172-175` - mensagem, `replace not.toHaveBeenCalled()`, conteúdo, `Ana Souza` no banner | PASS |
| C52 | 401 de um filho redireciona | ✓ r4 · carried from round 3 | `web/src/components/auth-gate.test.tsx:190` - `toHaveBeenCalledWith('/login?next=%2Fprint-profiles')`; a metade do login é estrutural (`web/src/app/(app)/layout.tsx:5`) mais C41 `login-form.test.tsx:85` `replace not.toHaveBeenCalled()` | PASS |
| C53 | 10 logins simultâneos: exatamente 5×401 e 5×429 | ✓ r4 · verified in round 4 | `api/test/auth.e2e-spec.ts:303` - `statuses toEqual([401, 401, 401, 401, 401, 429, 429, 429, 429, 429])`, com `:302` `.sort((a, b) => a - b)` sobre `Promise.all` de 10 `login` com `senha-errada-12` (`:299-301`) | PASS |
| C54 | `verifyPassword` false sem lançar para `N=3` e `N=1048576,r=8` | ✓ r4 · carried from round 3 | `api/src/modules/auth/password.spec.ts:41-43` - `expect(verifyPassword(...)).resolves.toBe(false)` sobre `['N=3,r=8,p=1', 'N=1048576,r=8,p=1']` (`:40`) | PASS |
| C55 | poda acima de 10 000 descarta os velhos e mantém o bloqueado | ✓ r4 · carried from round 3 | `api/src/modules/auth/login-attempts.spec.ts:69` - `isBlocked('alvo@test.local') toBe(true)`; `login-attempts.spec.ts:70` - `tracked().sort() toEqual(['alvo@test.local', 'novo@test.local'])` | PASS |
| C56 | janela de 15 min exatos | ✓ r4 · carried from round 3 | `api/src/modules/auth/login-attempts.spec.ts:78` - `isBlocked toBe(true)` com a 5ª em `t + 15 min − 1 ms` (`:76`); `login-attempts.spec.ts:84` - `isBlocked toBe(false)` com a 5ª em `t + 15 min` (`:82`) | PASS |
| C57 | pela rota, login certo não conta: 4 erradas + 2 certas = `401`×4, `200`, `200`; 6 certas de `c57b` = `200`×6 | ✓ r4 no lote (5571 ms), no gate completo (4510 ms) e **sozinho como escrito 5/5 exit 0** (4,65–5,35 s, sob o `testTimeout` de 30 s) · verified in round 4 | `api/test/auth.e2e-spec.ts:316` - `statuses toEqual([401, 401, 401, 401, 200, 200])` sobre 4 logins com `senha-errada-12` (`:310-312`) e 2 com `PASSWORD` (`:313-315`); `auth.e2e-spec.ts:322` - `correct toEqual([200, 200, 200, 200, 200, 200])` sobre 6 logins certos de `c57b@test.local` (`:319-321`). Estabilidade: `api/vitest.config.e2e.ts:13` `testTimeout: 30_000`, folga de ~5,6× sobre a execução mais lenta observada | PASS |
| C58 | pela rota, login certo zera falhas anteriores sem ser a tentativa que bloqueia: `c58` com 2 erradas, 1 certa, 2 erradas, 1 certa = `401`, `401`, `200`, `401`, `401`, `200` | ✓ r4 no lote (2409 ms), no gate completo (2308 ms) e sozinho como escrito 5/5 exit 0 (2,37–2,83 s) · verified in round 4 (novo) | `api/test/auth.e2e-spec.ts:332` - `expect(statuses).toEqual([401, 401, 200, 401, 401, 200])`, sobre a sequência literal `['senha-errada-12', 'senha-errada-12', PASSWORD, 'senha-errada-12', 'senha-errada-12', PASSWORD]` (`:327`) enviada em ordem por `login({ email: 'c58@test.local', password })` (`:329-331`), com o usuário criado em `:326` e `c58@test.local` em `EMAILS` (`:38`, limpo no `beforeAll`/`afterAll`). O valor esperado é o do check, literal na asserção, e a asserção matou G2 e F5 | PASS |

Nenhum precision gap novo. C58 fixa exatamente o caso que faltava ao AC 20 na rodada 3.

## Coverage

Verified in round 4 só para a linha cuja autoridade a correção tocou (regras do limitador, que ganhou
C58). As outras linhas são carried from round 3, com as provas rodadas de novo nesta rodada; nenhum
arquivo de `api/src` ou `web/` mudou, então nenhum conjunto ganhou membro. Sweep por conjuntos sem
linha: a correção não criou ramo nem enumeração nova (só um teste e uma opção de harness).

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| regras do limitador (10) - verified in round 4 | `api/src/modules/auth/login-attempts.ts:18-60` e as chamadas em `api/src/modules/auth/auth.service.ts:38,44,58` | limiar `login-attempts.ts:35` C23, C28 · desbloqueio `:23` C24 · janela `:33` C26, borda C56 · chave por e-mail C27, C28 · poda `:39-41,52-59` C55 · contagem antes do `await` `auth.service.ts:44` C53 · reset no `LoginAttempts` `:44-46` C25 (camada), C57 pela rota quando a entrada está bloqueada (G1 morto) · reset pelo serviço `auth.service.ts:58` quando o login certo é a 5ª tentativa: C57 (F5 morto) · reset pelo serviço quando o sucesso não bloqueia: C58 (G2 e F5 mortos) · login certo não conta como falha: C57 (`c57b`, 6 certas = `200`×6) | - |
| chave do limitador (2) - carried from round 3 | `auth.service.ts:37` `normalizeEmail` antes de `:38` | normalizado C29 · inexistente C29 | - |
| ramos do `verifyPassword` (4) - carried from round 3 | `password.ts:30`, `:35`, `:44`, `:45` | regex falha C8 · tamanho != 64 C8 · `timingSafeEqual` true/false C7, C8 · `catch` C54 | - |
| `POST /auth/login` statuses (4) - carried from round 3 | `auth.controller.ts:25` `@HttpCode(200)`, `ValidationPipe`, `auth.service.ts:40` (429), `:89` (401) | 200 C1, C57, C58 · 400 C5 · 401 C3, C58 · 429 C28, C29, C53 | - |
| credenciais inválidas (3) - carried from round 3 | `auth.service.ts:49,52,55` | senha errada C3 · inexistente C3, C4 · inativo C3, C4 | - |
| motivos de log (5) - carried from round 3 | `auth.service.ts:39,67,88` | sucesso, `wrong password`, `unknown email`, `inactive`, `blocked` C37 | - |
| causas de 401 no guard (4) - carried from round 3 | `auth.guard.ts:31-33`, `auth.service.ts:72-76` | sem cookie C14, C15 · token inexistente C14 · expirada C14, C19 · inativo C14 | - |
| `POST /auth/logout` statuses (1) - carried from round 3 | `auth.controller.ts:38` `@HttpCode(204)` | 204 C10, C11 | - |
| `GET /auth/me` statuses (2) - carried from round 3 | `auth.controller.ts:50`, `auth.guard.ts:34` | 200 C13 · 401 C12, C14, C19 | - |
| `POST /pricing/calculate` statuses (3) - carried from round 3 | plano `Surface` + suíte existente | 200 C16 · 400 `pricing.e2e-spec.ts:86` com cookie (C16) · 401 C15 | - |
| `POST /print-profiles/import` statuses (5) - carried from round 3 | plano `Surface` + suíte existente | 200 C16 · 400 `print-profiles.e2e-spec.ts:111` · 404 `:145` · 502 `:150`, com cookie (C16) · 401 C15 | - |
| rotas protegidas (4) - carried from round 3 | todo controller sem `@Public()` | `GET /auth/me` C14 · pricing C15 · import C15 · rota nova C18 | - |
| rotas públicas (3) - carried from round 3 | `@Public()` em `auth.controller.ts:23,36`, `health.controller.ts:6` | health C17 · login C1 · logout C11 | - |
| corpos recusados + borda (7) - carried from round 3 | `dto/login-auth.dto.ts:6-14` + `forbidNonWhitelisted` | `{}`, `"ana"`, `""`, 257 chars, `123`, `remember` C5 · 256 aceito C5 | - |
| `SESSION_COOKIE_SECURE` (3) - carried from round 3 | `session-cookie.ts:16` | ausente, `"true"`, `"false"` C20 | - |
| ramos do seed (6) - carried from round 3 | `admin-seed.ts:25,29,34,38,47,50` | falta variável C32 · senha curta C33 · existe C31 · cria sem/com nome C30 · corrida `23505` C34 · outro erro relançado vira falha de boot | - |
| valores de `next` (6) - carried from round 3 | `safe-next.ts:4-9` | os 6 do plano C43 | - |
| estados da tela de login (5) - carried from round 3 | AC 26–31 | formulário C39 · entrando C40 · erro API C41 · rede C42 · já logado C44 | - |
| estados do shell (7) - carried from round 3 | `auth-gate.tsx:9-13,73-114` | carregando C47 · sem sessão C46 · rede C48 · 500 C48 · pronto C49 · logout C50 · falha no logout C51 | - |
| origem do 401 no web (2) - carried from round 3 | `api.ts:44-46` + `auth-gate.tsx:46-50` | `/auth/me` C46 · filho C52 | - |
| one-way doors (8) - carried from round 3 | plano `Landing` | 1 C35, C1 · 2 C36, C6, C9 · 3 C7, C8, C54, C6 · 4 C1, C20 · 5 C18 · 6 C1, C13 · 7 C21, C45 · 8 C23–C29, C53, C55–C58 | - |
| startup config (3) - carried from round 3 | `main.ts:7`, `app.setup.ts:9`, `app.module.ts` | `main.ts` chama `configureApp` C22 · e2e chamam `configureApp` C21 · guard e seed no `AppModule` C18, C30 | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Decide, alcançado pela rota (serviço de auth, guard) - re-judged in round 4 (não atendida na rodada 3) | `auth.service.ts`, `auth.guard.ts`, `auth.controller.ts` | rota: cada status e cada causa de 401 · camada: comparação falsa C4 e log C37 | yes - statuses (C1, C3, C5, C28, C29, C53), causas de 401 (C14, C15, C19), C4 e C37 provados; a decisão de zerar a contagem depois de um login certo (`auth.service.ts:58`, AC 20) agora tem prova pela rota nos dois casos, C57 (sucesso na 5ª tentativa) e C58 (sucesso antes do limite), e os mutantes F5, G1 e G2 dessa superfície morreram |
| Decide, fora da rota (hash, limitador, cookie, `safeNext`) - carried from round 3 | `password.ts`, `login-attempts.ts`, `session-cookie.ts`, `safe-next.ts` | um na própria camada, um caso por linha da regra, com as bordas | yes - carried; C7, C8, C20, C23–C27, C43, C54–C56 rodaram de novo e passaram |
| Seed na inicialização - carried from round 3 | `admin-seed.ts` | um e2e que sobe a app, cada ramo | yes - carried; C30–C34 rodaram de novo e passaram |
| Componente de tela - carried from round 3 | `login-form.tsx`, `auth-gate.tsx`, `app-shell.tsx`, `login/page.tsx`, `(app)/layout.tsx` | Testing Library, cada estado como membro | yes - carried; os 15 testes do web rodaram de novo e passaram |

`api/vitest.config.e2e.ts` não é classificado por nenhuma linha (é harness, não código que decide);
o efeito dele sobre as provas está no início do relatório. `Swept` carried from round 3: o código
citado (`auth.service.ts:38,44`, índice único na migration) não mudou.

## Faults injected

Verified in round 4, na cópia `<scratchpad>/verify-tree-r4`. Cada mutação foi uma substituição exata
com contagem 1 (`assert s.count(old) == 1`), seguida da prova e da restauração do arquivo copiando do
tree real, com `diff -rq` de `api/src` (e de `api/test` no fim) vazio depois de cada uma. Uma de cada
vez; os e2e não rodaram em paralelo com nada.

| Mutation | Location | Killed |
| --- | --- | --- |
| G2 (reinjetada) o serviço só zera quando o próprio login bloqueou: `this.attempts.recordSuccess(email)` -> `if (this.attempts.isBlocked(email)) this.attempts.recordSuccess(email)` | `api/src/modules/auth/auth.service.ts:58` | yes - C58 sozinho, como escrito: exit 1, `× a correct login clears earlier failures`, `AssertionError: expected [ 401, 401, 200, 401, 401, 429 ] to deeply equal [ 401, 401, 200, 401, 401, 200 ]` (`auth.e2e-spec.ts:332`) |
| F5 (reinjetada) sucesso deixa de zerar a contagem pré-contada: removido `this.attempts.recordSuccess(email)` | `api/src/modules/auth/auth.service.ts:58` | yes - C57 e C58 juntos: 2 failed; C57 `expected [ 401, 401, 401, 401, 200, 429 ] to deeply equal [ 401, 401, 401, 401, 200, 200 ]` (`:316`), C58 `expected [ 401, 401, 200, 401, 401, 429 ] to deeply equal [ 401, 401, 200, 401, 401, 200 ]` (`:332`) |
| G1 (reinjetada) o limitador não zera uma entrada bloqueada: `recordSuccess` ganhou `if (this.isBlocked(email)) return;` antes do `delete` | `api/src/modules/auth/login-attempts.ts:44-45` | yes - C57: `expected [ 401, 401, 401, 401, 200, 429 ] to deeply equal [ 401, 401, 401, 401, 200, 200 ]` (`:316`), 1 failed. C58 passa sob G1 (esperado: no caso dele a entrada nunca chega a bloquear), então C57 e C58 são complementares, não redundantes |

Tally: 3 injected, 3 killed. Os três matam por asserção de valor, não por timeout.

## Gate

Tree real, working tree sobre `48eaf95`, round 4:

- `npm --prefix api run lint`: exit 0; `oxlint --type-aware src/ test/ -f json`: 0 diagnostics, 77 arquivos
- `npm --prefix api run test`: 93 passed, 0 failed (19 files)
- `npm --prefix api run test:e2e`: 60 passed, 0 failed (10 files), exit 0 (C57 em 4510 ms, C58 em 2308 ms)
- `npm --prefix web run lint`: exit 0
- `npm --prefix web run test`: 38 passed, 0 failed (8 files)
- Provas de C57 e C58 sozinhas como escritas: 10/10 exit 0 (ver `## Checks`)
- Builds não rodaram nesta rodada: nenhum arquivo de `api/src` nem de `web/` mudou desde a rodada 3 (o `test:e2e` roda `nest build` no `globalSetup` e passou)

## Ranked gaps

Nenhuma. As 4 lacunas da rodada 3 estão resolvidas (ver `## Round-3 gaps`), os 58 checks têm prova
verde com `file:line`, nenhum membro de cobertura ficou sem prova, as 4 linhas de Test policy estão
atendidas e as 3 falhas injetadas morreram.
