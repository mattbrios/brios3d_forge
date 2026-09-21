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

## Handoff

**Feature**: phase-2-makerworld-profiles - concluída
**Where**: C1–C56 verificados. Rodada 6 (escopada, `standard`): PASS, 56/56, 6 falhas injetadas e 6 mortas, `validate_verification.py` exit 0. As rodadas 1–5 deram FAIL, sempre por lacuna de teste (o código estava certo); o usuário autorizou as rodadas 4 a 6 além do limite de 3. Conferido também com o Playwright contra o MakerWorld real (importação, troca de perfil, URL inválida)
**In progress**: nada
**Next step**: Fase 3 - autenticação. Antes do uso real da Fase 2, responder a questão 34 do ROADMAP (termos de uso da API não documentada do MakerWorld)
**Blockers**: nenhum para a Fase 3
**Uncommitted**: nada
**Branch**: main (commits só locais; nada foi enviado ao remoto)
