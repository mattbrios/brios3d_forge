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

## Handoff

**Feature**: phase-3-auth - concluída
**Where**: C1–C58 verificados. Rodada 4 (escopada, `standard`, autorizada pelo usuário além do limite de 3): PASS, 58/58, `validate_verification.py` exit 0. As rodadas 1–3 deram FAIL: um bug real (logins simultâneos furavam o limitador, corrigido contando a tentativa antes do primeiro `await`) e lacunas de teste. Conferido também com o Playwright no app rodando (login, senha errada, `next`, sessão expirada, logout, API parada)
**In progress**: nada
**Next step**: o usuário decide sobre o commit (o `AGENTS.md` pede pedido explícito). Depois, Fase 4 - usuários e papéis
**Blockers**: nenhum
**Uncommitted**: toda a Fase 3 (API, web, migration, specs, ROADMAP, STATE, `docker-compose.yml`, `.env.example`)
**Branch**: main
