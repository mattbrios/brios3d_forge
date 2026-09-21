# AGENTS.md

Monorepo TypeScript. Contexto de negócio em `CONTEXT.md`.

- `api/`: NestJS, Vitest, oxlint (porta 3001)
- `web/`: Next.js App Router (porta 3000). Veja `web/AGENTS.md`.
- Infra local: `docker-compose.yml` (Postgres 17), variáveis em `.env.example`

`api/` e `web/` são independentes e se comunicam só por HTTP/JSON. Não importe código de um no outro.

## Convenções da API

- Cada módulo fica em `api/src/modules/<nome>/`: `<nome>.module.ts`, `<nome>.controller.ts`, `<nome>.service.ts`, `entities/<entidade>.entity.ts` e `dto/<ação>-<nome>.dto.ts`. Os testes `*.spec.ts` ficam ao lado do arquivo testado, e os e2e em `api/test/`.
- DTOs usam `class-validator`. O `ValidationPipe` global recusa propriedades não declaradas.
- Erros saem pelo filtro global (`src/common/filters/`) como `{ "error": "mensagem" }`. Lance `HttpException`s do Nest. Qualquer outra exceção vira `500` genérico.
- O schema só muda por migration (`synchronize: false`): `npm --prefix api run migration:generate -- src/database/migrations/<Nome>`, depois `migration:run`.
- Os e2e rodam no banco `DB_NAME_TEST` (padrão `forge_test`), criado e migrado automaticamente.

## Comandos

Use sempre `npm` (nunca pnpm/yarn), rodando a partir da raiz:

```bash
npm --prefix api run start:dev | build | lint | test | test:e2e
npm --prefix web run dev | build | lint
```

## Regras

- TypeScript `strict`, sem `any`. Código e commits em inglês; comentários podem ser em português.
- API: valide toda entrada externa e retorne erros como `{ "error": "mensagem" }`, sem stack traces.
- Web: a URL da API vem de `NEXT_PUBLIC_API_URL`, nunca fixa no código.
- Novas variáveis de ambiente vão para o `.env.example`. Nunca commite segredos nem `.env`.
- Ao mudar o contrato de uma rota da API, atualize o `web/` na mesma mudança.
- Faça mudanças pequenas e focadas, e adicione testes ao alterar comportamento.
- Antes de concluir, rode `lint`, `test` e `build` nas pastas alteradas.
- Se a mudança toca em telas, valide no final com o Playwright MCP (configurado em `.mcp.json`): abra as páginas afetadas no app rodando e confira o fluxo alterado, incluindo os estados de carregamento, erro e vazio.
- Não faça commit/push nem ações destrutivas sem pedido explícito.
- Toda vez que um item do roadmap estiver completo, marcar ele como done no arquivo ROADMAP.md.
