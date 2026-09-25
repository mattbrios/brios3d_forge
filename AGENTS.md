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

## Política de testes

Classifique pela **forma do código**, nunca pelo nome da camada. Um arquivo **decide** quando algo nele muda o resultado: um limite, uma validação, um `switch` por tipo, uma transição de estado, uma ordenação, um guard, uma regra de precedência. É **instrumentação** quando o corpo repassa argumentos ou copia campo a campo, sem nenhuma condicional que decida a saída.

| Forma do código | Provas exigidas | Profundidade |
| --- | --- | --- |
| Decide e é alcançado por uma rota | um e2e na rota **e** um teste no nível do próprio arquivo | o contrato na rota; um caso asserido por linha da tabela de decisão no nível do arquivo |
| Decide e não é alcançado por uma rota (função pura) | um `*.spec.ts` ao lado do arquivo | um caso asserido por linha da tabela de decisão |
| Ponto de entrada que não decide (controller, DTO) | um e2e na rota | o lado aceito **e** cada lado recusado |
| Instrumentação (mapper, repassagem) | nenhuma própria | coberta pela prova de quem consome |
| `CHECK`, índice único ou outra invariante do banco | um teste por lado de violação, direto no banco | cada lado, e também sob concorrência quando a coluna é decrementada (AD-023) |
| Migration que altera tabela com linhas | um e2e próprio que roda `down()` e `up()` sobre linhas semeadas | valores preservados e a restrição nova satisfeita |
| `@Roles()` numa rota | um e2e tabela-driven por papel | o lado barrado **e** o lado liberado |
| Tela | um teste por estado em `*.test.tsx` | carregando, erro, vazio, e o que cada papel vê |

Vale para toda linha acima:

- **Um limite precisa dos dois lados**: o valor que dispara e o valor que não dispara. Só o lado que dispara não distingue `<` de `<=`.
- Escreva o valor esperado **literalmente** na asserção. Nunca derive o esperado chamando o código sob teste.
- Um teste prova a camada onde ele **afirma**, não as camadas pelas quais ele passa. Um e2e que atravessa um `switch` exercita um caminho dele.
- Nunca enfraqueça uma asserção, apague ou pule um teste para a suíte passar.

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
