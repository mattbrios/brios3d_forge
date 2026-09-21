# Fase 2 — Dados de impressão pela URL do MakerWorld · checks

Profile: standard
Plan: `.specs/features/phase-2-makerworld-profiles/plan.md`

## Intent

46 checks em 6 fatias (C42–C46 acrescentados depois da rodada 1 do Verifier, sem alterar C1–C41) · 4 one-way doors (a door 4 veio no build) · 2 perguntas abertas, uma `blocks go-live` (termos de uso do MakerWorld) e nenhuma que bloqueie o build

O `AGENTS.md` não declara perfil. Uso `standard`, o mesmo em que a Fase 1 foi verificada: a
fase depende de uma API externa não documentada e tem um mapeador cheio de ramos, justamente o
tipo de código em que um teste pode passar com a implementação errada.

Os valores esperados vêm do `plan.md` (`## Criteria`) e da fixture
`api/test/fixtures/makerworld/design-3007827.json`, salva da resposta real de 2026-09-21. Os
testes escrevem os números **literalmente** na asserção. Nunca derive o esperado lendo a fixture
com o próprio código do mapeador.

**Nenhum teste acessa a internet.** O cliente HTTP é testado contra um servidor `node:http` local
(`127.0.0.1`, porta aleatória), construído com `baseUrl`, `timeoutMs` e `maxBytes` injetados. O
e2e substitui o provider do cliente por um falso que devolve a fixture ou lança o erro pedido.

Os testes de unidade (`npm --prefix api run test`) não precisam do banco. Os e2e
(`npm --prefix api run test:e2e`) montam o `AppModule` e precisam do `db` no ar
(`docker compose up -d db`), como nas Fases 0 e 1. Os testes do web usam Vitest + Testing Library
com o `fetch` substituído, como em `web/src/components/health-status.test.tsx`.

## Checks

### S1 - URL e mapeamento do perfil · 6 files · 45 KB · ~11k

**C1** - `parseMakerWorldUrl` devolve `{ designId: 3007827, profileId: 3387944 }` para `https://makerworld.com/pt/models/3007827-sea-animals-set?from=recommend#profileId-3387944`, e `{ designId: 3007827, profileId: null }` para cada uma das outras 6 URLs aceitas da tabela `Coverage`, todas sem fragmento (AC 8)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-url.spec.ts -t "accepts makerworld model urls"`

**C2** - `parseMakerWorldUrl` lança `PrintProfileError` com status `400` e a mensagem `URL inválida: cole o link de um modelo do MakerWorld (https://makerworld.com/models/…)` para cada uma das 8 entradas inválidas da tabela `Coverage` (AC 13)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-url.spec.ts -t "rejects non makerworld urls"`

**C3** - `parseMakerWorldUrl` devolve `profileId` `null` para `#profileId-abc`, `#profileId-` e `#outro` (fragmento fora do formato `profileId-<dígitos>` é ignorado) (AC 5)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-url.spec.ts -t "ignores malformed profile fragment"`

**C4** - Com a fixture e `profileId` `3387944`, `mapMakerWorldDesign` devolve `selectedProfileId` `3387944` e, no perfil `3387944`, `title` `"Sea star"`, `printSeconds` `1707`, `totalGrams` `9`, `needsAms` `true`, `printer` `{ name: "X2D", nozzleDiameterMm: 0.4 }` e `settings` `{ layerHeightMm: 0.2, wallLoops: 2, sparseInfillRate: 0.15 }` (AC 1)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-design.mapper.spec.ts -t "maps the sea star profile"`

**C5** - No perfil `3387944`, `filaments` é exatamente `[{ slot: 1, type: "PLA", color: "#FD8008", grams: 8, meters: 2.66 }, { slot: 4, type: "PLA", color: "#000000", grams: 1, meters: 0.08 }]`, e `plates` é `[{ index: 1, printSeconds: 1707, totalGrams: 9, filaments: <os mesmos dois> }]` (AC 2)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-design.mapper.spec.ts -t "sea star filaments by slot"`

**C6** - Com a fixture, `model` é `{ title: "Sea animals - set", coverUrl: "https://makerworld.bblmw.com/makerworld/model/USafe737868bbaa/design/6c21105d01a14e2f.jpeg", license: "Standard Digital File License", designer: "Real_Prints" }` e `source` é `{ platform: "makerworld", designId: 3007827, url: "https://makerworld.com/models/3007827" }` (AC 3)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-design.mapper.spec.ts -t "maps model and source"`

**C7** - No perfil `3377800`, `plates` tem 11 itens com `index` `1` a `11`, `printSeconds` é `77054`, `totalGrams` é `408`, e `filaments` é `[{ slot: 1, grams: 246 }, { slot: 2, grams: 64 }, { slot: 3, grams: 37 }, { slot: 4, grams: 61 }]` (com `type` `"PLA"` e as cores `#FECC66`, `#000000`, `#66CCFF`, `#66FF66`), e os metros somados `79.82`, `19.42`, `11.86`, `19.62` com tolerância `1e-9` (AC 4)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-design.mapper.spec.ts -t "sums plate filaments by slot"`

**C8** - Com a fixture e `profileId` `null`, `selectedProfileId` é `3377800` (o `defaultInstanceId`) (AC 5)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-design.mapper.spec.ts -t "defaults to the default instance"`

**C9** - `profiles.map(p => p.id)` é `[3387944, 3388305, 3377800]`, a ordem de `instances[]` na fixture (AC 6)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-design.mapper.spec.ts -t "keeps profile order"`

**C10** - O perfil `3388305` ("Sea shell") devolve `needsAms` `false`, e não `null` (AC 7)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-design.mapper.spec.ts -t "needs ams false"`

### S2 - Campos ausentes, dados inválidos e erros de domínio · 2 files · 20 KB · ~5k

**C11** - Para cada um dos 19 campos escalares da tabela `Coverage`, removê-lo da fixture faz esse campo voltar `null` e deixa os outros campos do mesmo objeto iguais aos de C4–C6 (AC 9)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-design.mapper.spec.ts -t "missing field becomes null"`

**C12** - `usedG` `"abc"`, `"-1"` e `""` devolvem `grams` `null`; `prediction` `"abc"` e `-5` devolvem `printSeconds` `null`; `usedM` `"2.66"` devolve `meters` `2.66` (número, não texto) (AC 10)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-design.mapper.spec.ts -t "invalid numbers become null"`

**C13** - `color` `"#fd8008"` devolve `"#FD8008"`, `"red"` e `"#FD80"` devolvem `null`; `sparseInfillDensity` `"15%"` devolve `sparseInfillRate` `0.15`, `"abc"` devolve `null`; `layerHeight` `"0.2"` devolve `layerHeightMm` `0.2`; `wallLoops` `"2"` devolve `2` (door 1)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-design.mapper.spec.ts -t "normalizes color and rates"`

**C14** - Um perfil sem `plates` devolve `plates` `[]` e `filaments` a partir de `instanceFilaments` com `slot` `1`, `2`, … na ordem recebida (Sea star: slot `1` `#FD8008` `8` g, slot `2` `#000000` `1` g) (AC 11)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-design.mapper.spec.ts -t "falls back to instance filaments"`

**C15** - `instances: []` e `instances` ausente devolvem `profiles` `[]` e `selectedProfileId` `null`, sem lançar (AC 12)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-design.mapper.spec.ts -t "model without profiles"`

**C16** - `profileId` `999` com a fixture lança `PrintProfileError` com status `400` e a mensagem `Perfil 999 não existe no modelo 3007827. Remova o #profileId da URL para ver os perfis disponíveis` (AC 15)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-design.mapper.spec.ts -t "unknown profile id"`

**C17** - As respostas `[]`, `null`, `"texto"` e `{}` (objeto sem `id` numérico) lançam `PrintProfileError` com status `502` e a mensagem `Não foi possível consultar o MakerWorld agora. Preencha os dados manualmente` (AC 17)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-design.mapper.spec.ts -t "unrecognized design is 502"`

### S3 - Cliente HTTP do MakerWorld · 2 files · 18 KB · ~5k

**C18** - Contra o servidor local, `fetchDesign(3007827)` faz exatamente um `GET /api/v1/design-service/design/3007827`, com `accept: application/json` e `user-agent` `Brios3DForge/<version do api/package.json>`, e devolve o JSON recebido (door 2, door 3, AC 19)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld.client.spec.ts -t "requests the design endpoint"`

**C19** - O cliente construído sem opções usa `baseUrl` `https://makerworld.com`, `timeoutMs` `10000` e `maxBytes` `5242880` (door 3)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld.client.spec.ts -t "default limits"`

**C20** - O servidor local respondendo `404` faz `fetchDesign(3007827)` lançar `PrintProfileError` com status `404` e a mensagem `Modelo 3007827 não encontrado no MakerWorld` (AC 16)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld.client.spec.ts -t "upstream 404"`

**C21** - Cada uma das 7 falhas do upstream da tabela `Coverage` faz `fetchDesign` lançar `PrintProfileError` com status `502` e a mensagem `Não foi possível consultar o MakerWorld agora. Preencha os dados manualmente`. O redirecionamento `301` não gera uma segunda requisição ao servidor local (AC 17, door 3)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld.client.spec.ts -t "upstream failures are 502"`

**C22** - Em cada falha de C21, o `Logger` do Nest recebe um `warn` contendo `3007827` e o motivo (`timeout`, `status 500`, `status 403`, `redirect`, `too large`, `invalid json`, `network`), e a mensagem do erro lançado não contém nenhum desses motivos
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld.client.spec.ts -t "logs upstream failure"`

**C23** - Com o `timeoutMs` `200` e o servidor local segurando a resposta por 5 s, `fetchDesign` rejeita em menos de 2 s (AC 17)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld.client.spec.ts -t "timeout aborts the request"`

### S4 - Rota `POST /print-profiles/import` · 5 files · 30 KB · ~8k

**C24** - Com o cliente falso devolvendo a fixture, `POST /print-profiles/import` com `{ url: "https://makerworld.com/pt/models/3007827-sea-animals-set?from=recommend#profileId-3387944" }` responde `200` (não `201`) com `source`, `model` e `selectedProfileId` iguais aos de C6 e C4, `profiles` com 3 itens, e o perfil `3387944` igual por `toEqual` ao objeto literal completo de C4 e C5 (AC 1, AC 2, AC 3, door 1)
Proof: `npm --prefix api run test:e2e -- test/print-profiles.e2e-spec.ts -t "imports the sea star profile"`

**C25** - Para a URL de C24, o cliente falso recebe exatamente uma chamada, com o argumento `3007827` do tipo `number` (AC 19)
Proof: `npm --prefix api run test:e2e -- test/print-profiles.e2e-spec.ts -t "client receives only the design id"`

**C26** - `{ url: "https://www.printables.com/model/1" }` responde `400` com exatamente `{ "error": "URL inválida: cole o link de um modelo do MakerWorld (https://makerworld.com/models/…)" }`, e o cliente falso não é chamado (AC 13)
Proof: `npm --prefix api run test:e2e -- test/print-profiles.e2e-spec.ts -t "invalid url returns 400"`

**C27** - `{}`, `{ url: 123 }` e `{ url: "<URL de C24>", extra: 1 }` respondem `400` com `error` contendo `url` nos dois primeiros e `should not exist` no terceiro (AC 14)
Proof: `npm --prefix api run test:e2e -- test/print-profiles.e2e-spec.ts -t "body validation"`

**C28** - A URL `https://makerworld.com/models/3007827#profileId-999` responde `400` com exatamente `{ "error": "Perfil 999 não existe no modelo 3007827. Remova o #profileId da URL para ver os perfis disponíveis" }` (AC 15)
Proof: `npm --prefix api run test:e2e -- test/print-profiles.e2e-spec.ts -t "unknown profile returns 400"`

**C29** - Com o cliente falso lançando o erro de C20, a rota responde `404` com exatamente `{ "error": "Modelo 3007827 não encontrado no MakerWorld" }`. Com o erro de C21, responde `502` com exatamente `{ "error": "Não foi possível consultar o MakerWorld agora. Preencha os dados manualmente" }`, e em seguida `GET /health` responde `200` (AC 16, AC 17, AC 18)
Proof: `npm --prefix api run test:e2e -- test/print-profiles.e2e-spec.ts -t "upstream errors"`

**C30** - Com o cliente falso devolvendo a fixture com `instances: []`, a rota responde `200` com `profiles` `[]` e `selectedProfileId` `null` (AC 12)
Proof: `npm --prefix api run test:e2e -- test/print-profiles.e2e-spec.ts -t "model without profiles returns 200"`

**C31** - `PrintProfileError` com status `400`, `404` e `502` vira, no controller, `BadRequestException`, `NotFoundException` e `BadGatewayException` com a mesma mensagem (AD-008)
Proof: `npm --prefix api run test -- src/modules/print-profiles/print-profiles.controller.spec.ts -t "maps domain errors to http"`

**C32** - `Test.createTestingModule({ imports: [PrintProfilesModule] })` resolve o token do cliente para a implementação HTTP real, e o `AppModule` importa o `PrintProfilesModule` (startup config)
Proof: `npm --prefix api run test -- src/modules/print-profiles/print-profiles.module.spec.ts -t "wires the http client"`

**C33** - Nenhum arquivo de `api/src/modules/print-profiles/` importa `typeorm` ou `@nestjs/typeorm` (AC 20)
Proof: `test -z "$(grep -rlE "from '(typeorm|@nestjs/typeorm)'" api/src/modules/print-profiles)"`

### S5 - Tela `/print-profiles` · 6 files · 35 KB · ~9k

**C34** - Com o `fetch` devolvendo a resposta de C24, colar a URL de C24 e clicar em "Importar" mostra o tempo `0 h 28 min`, AMS marcado, impressora `X2D`, bico `0,4 mm` e duas linhas de filamento com os valores slot `1` `PLA` `#FD8008` `8` e slot `4` `PLA` `#000000` `1`, cada uma com um elemento de amostra cujo `background-color` é a cor da linha (AC 21)
Proof: `npm --prefix web run test -- src/components/print-profile-import.test.tsx -t "fills the form from the import"`

**C35** - Com o `fetch` pendente, a tela mostra `Importando…` e o botão "Importar" fica `disabled` (AC 22)
Proof: `npm --prefix web run test -- src/components/print-profile-import.test.tsx -t "shows importing"`

**C36** - Com a resposta de C24, o seletor de perfil tem 3 opções, cada uma com título, tempo e gramas (`Sea star · 0 h 28 min · 9 g`), com `3387944` selecionado. Escolher `3377800` troca o tempo para `21 h 24 min` e mostra 4 filamentos, e o `fetch` continua com 1 chamada (AC 23)
Proof: `npm --prefix web run test -- src/components/print-profile-import.test.tsx -t "switches profile without refetch"`

**C37** - Uma resposta com `printer.name` `null` e `filaments[0].grams` `null` mostra esses dois campos com valor `""`, e digitar neles altera o valor (AC 24)
Proof: `npm --prefix web run test -- src/components/print-profile-import.test.tsx -t "null fields are blank and editable"`

**C38** - Uma resposta `502` com `{ error: "Não foi possível consultar o MakerWorld agora. Preencha os dados manualmente" }` mostra essa mensagem e o formulário com todos os campos vazios e editáveis. Um `fetch` que rejeita (API fora) mostra `Não foi possível conectar à API` e o mesmo formulário vazio (AC 25)
Proof: `npm --prefix web run test -- src/components/print-profile-import.test.tsx -t "error shows message and blank form"`

**C39** - Uma resposta `200` com `profiles: []` mostra `Este modelo não tem perfis de impressão no MakerWorld. Preencha os dados manualmente` e o formulário vazio (AC 26)
Proof: `npm --prefix web run test -- src/components/print-profile-import.test.tsx -t "model without profiles"`

**C40** - Na tela recém-aberta, sem `fetch` chamado, há o campo de URL e o formulário vazio com zero linhas de filamento. "Adicionar filamento" duas vezes deixa 2 linhas vazias, e "Remover" na primeira deixa 1 (AC 27, AC 28)
Proof: `npm --prefix web run test -- src/components/print-profile-import.test.tsx -t "blank form and filament rows"`

**C41** - O `AppShell` mostra na navegação lateral um link `Importar do MakerWorld` com `href` `/print-profiles`. `formatPrintTime` leva `1707` a `0 h 28 min`, `77054` a `21 h 24 min`, `89` a `0 h 1 min` e `29` a `0 h 0 min` (AC 29, assumption "Tempo na tela")
Proof: `npm --prefix web run test -- src/components/app-shell.test.tsx -t "links to print profiles"`
Proof: `npm --prefix web run test -- src/lib/format-print-time.test.ts -t "rounds to the nearest minute"`

### S6 - Lacunas da rodada 1 do Verifier · 5 files · 6 KB · ~2k

Acrescentados depois da verificação da rodada 1 (FAIL: 3 falhas injetadas sobreviveram). Nenhum
check anterior mudou.

**C42** - Com o `baseUrl` padrão, `fetchDesign(3007827)` chama o `get` do `node:https` uma vez, com a URL `https://makerworld.com/api/v1/design-service/design/3007827`, `accept: application/json`, `user-agent` começando com `Brios3DForge/` e um `AbortSignal`, e não chama o `get` do `node:http` (door 4, AD-011)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld.client.https.spec.ts -t "uses node:https for the default base url"`

**C43** - `formatPrintTime` arredonda o meio minuto para cima: `90` vira `0 h 2 min`, `3569` vira `0 h 59 min` e `3570` vira `1 h 0 min` (assumption "Tempo na tela")
Proof: `npm --prefix web run test -- src/lib/format-print-time.test.ts -t "rounds half a minute up"`

**C44** - `{ url }` com mais de 2048 caracteres responde `400` com `error` contendo `url` e sem `URL inválida` (recusado pelo `ValidationPipe`), e o cliente falso não é chamado (AC 14)
Proof: `npm --prefix api run test:e2e -- test/print-profiles.e2e-spec.ts -t "url longer than 2048 characters returns 400"`

**C45** - `parseMakerWorldUrl` lança `PrintProfileError` `400` com a mensagem de C2 para `https://user@makerworld.com/models/3007827`, `https://user:pass@makerworld.com/models/3007827` e `https://makerworld.com/models/0` (AC 13)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-url.spec.ts -t "rejects userinfo and non positive design ids"`

**C46** - Sem `profileId` e com `defaultInstanceId` ausente ou apontando para um perfil que não existe (`123`), `selectedProfileId` é `3387944`, o primeiro perfil (AC 5)
Proof: `npm --prefix api run test -- src/modules/print-profiles/makerworld-design.mapper.spec.ts -t "falls back to the first profile"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /print-profiles/import` statuses (4) | 200 C24, C30 · 400 C26, C27, C28 · 404 C29 · 502 C29 | - |
| URLs aceitas (7) | ROADMAP `/pt/…?from=recommend#profileId-3387944` C1 · `/en/models/3007827-sea-animals-set` C1 · `https://www.makerworld.com/models/3007827` C1 · `/models/3007827` sem slug C1 · `/models/3007827-sea-animals-set?from=recommend` C1 · `/models/3007827/` com barra final C1 · `/pt/models/3007827` sem slug C1 | - |
| URLs recusadas (11) | `https://user@makerworld.com/models/3007827` C45 · `https://user:pass@makerworld.com/models/3007827` C45 · `https://makerworld.com/models/0` C45 · `http://makerworld.com/models/3007827` C2 · `https://www.printables.com/model/1` C2 · `https://makerworld.com.evil.com/models/3007827` C2 · `https://evil.makerworld.com/models/3007827` C2 · `https://makerworld.com:8443/models/3007827` C2 · `https://makerworld.com/models/abc` C2 · `https://makerworld.com/collections/3007827` C2 · `não é url` C2 | - |
| fragmento de perfil (3 formas) | válido `#profileId-3387944` C1 · malformado C3 · ausente C1, C8 | - |
| campos escalares que podem voltar `null` (19) | C11, table-driven over all 19: `model.title` · `model.coverUrl` · `model.license` · `model.designer` · `profile.title` · `profile.printSeconds` · `profile.totalGrams` · `profile.needsAms` · `printer.name` · `printer.nozzleDiameterMm` · `settings.layerHeightMm` · `settings.wallLoops` · `settings.sparseInfillRate` · `filament.type` · `filament.color` · `filament.grams` · `filament.meters` · `plate.printSeconds` · `plate.totalGrams` | - |
| números inválidos (4 formas) | texto `"abc"` C12 · negativo `"-1"`/`-5` C12 · vazio `""` C12 · texto numérico válido `"2.66"` C12 | - |
| normalização de formato (4 campos) | `color` C13 · `sparseInfillRate` C13 · `layerHeightMm` C13 · `wallLoops` C13 | - |
| origem dos filamentos do perfil (2 ramos) | soma das placas C5, C7 · `instanceFilaments` sem placas C14 | - |
| escolha do perfil (4 ramos) | `profileId` existente C4 · ausente -> `defaultInstanceId` C8 · ausente sem `defaultInstanceId` válido -> primeiro perfil C46 · inexistente C16, C28 | - |
| perfis da fixture (3) | `3387944` C4, C5 · `3377800` C7 · `3388305` C10 | - |
| resposta irreconhecível (4 formas) | `[]` C17 · `null` C17 · `"texto"` C17 · `{}` C17 | - |
| falhas do upstream (7) | C21, table-driven over all 7: timeout C21, C23 · `500` C21 · `403` (Cloudflare) C21 · redirect `301` C21 · corpo > `maxBytes` C21 · corpo que não é JSON C21 · conexão recusada C21 | - |
| tamanho do corpo `url` (1 borda) | 2049 caracteres recusado C44 | - |
| erros de domínio -> HTTP (3) | 400 C31 · 404 C31 · 502 C31 | - |
| estados da tela (5) | inicial vazio C40 · carregando C35 · sucesso C34 · erro (API e rede) C38 · modelo sem perfis C39 | - |
| ações nas linhas de filamento (2) | adicionar C40 · remover C40 | - |
| formatação do tempo (5 casos) | `1707` C41 · `77054` C41 · `89` C41 · arredonda para baixo `29` C41, `3569` C43 · arredonda o meio minuto para cima `90` C43, `3570` C43 | - |
| one-way doors do plano (4) | 1 contrato `PrintProfileImport` C24, C13 · 2 fonte e interface do cliente C18, C32 · 3 padrão de saída (redirect, timeout, tamanho, host fixo, só `designId`) C18, C19, C21, C23, C25 · 4 `node:https` no baseUrl padrão C42 | - |
| startup config do `PrintProfilesModule` (2) | `AppModule` usado pelo `main.ts` e pelo e2e C24 · token do cliente -> implementação HTTP C32 | - |

- Claims naming a status code, route or response shape: C24–C30 - each has a proof that crosses the `POST /print-profiles/import` boundary
- C16, C17, C20 and C21 assert at their own layer, and C28 and C29 re-assert the same errors at the boundary. One does not substitute for the other
- The e2e replaces the HTTP client with a fake, so the real client is proven only at its own layer (C18–C23) and its wiring only by C32. Nothing proves the live MakerWorld still answers in this format - that is the Playwright pass at the end, against the real site
- C11 claims only the 19 fields in its table, removed one at a time

## Test policy

O repo diz onde os testes ficam (`AGENTS.md`), mas não em que nível cada código se prova nem quanto
da entrada a prova precisa cobrir.

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| Decide, alcançado pela rota | um na rota **e** um na própria camada | na rota, o contrato e cada status; na camada, um caso por linha da tabela de decisão |
| Decide, fora da rota (cliente HTTP) | um na própria camada, contra servidor local | cada falha do upstream como membro |
| Entrada que não decide (controller) | um na rota | entrada aceita, cada entrada recusada, cada erro |
| Componente de tela | um com Testing Library | cada estado da tela como membro |

Evidence:

- `makerworld-url`: host, esquema, porta, formato do caminho e do fragmento, 8 formas recusadas e 3 formas de fragmento -> decide
- `makerworld-design.mapper`: ausente/inválido/normalizado por campo (19 campos), 2 origens de filamento, 3 ramos de escolha de perfil, 4 formas irreconhecíveis -> decide
- `makerworld.client`: 1 caminho feliz, 404 e 7 falhas -> decide
- controller: converte 3 status de `PrintProfileError` em `HttpException` -> decide pouco, provado nas duas camadas (C31 e C26–C29)
- análogo no repo: `pricing.service.spec.ts` + `pricing.e2e-spec.ts` na Fase 1, mesma divisão serviço/rota; `health-status.test.tsx` para os estados da tela

Cost: 4 specs de unidade na API, 1 e2e, 3 testes no web. Sem essas linhas, as 19 linhas do mapeador e as 7 falhas do cliente só seriam cobertas pelo caminho feliz do e2e.

## Swept

- validation: C1, C2, C3, C12, C13, C27
- failure modes: C16, C17, C20, C21, C29, C38 - toda falha vira `{ error }` com status definido, nunca `500`
- idempotency: n/a - a rota não grava nada (C33). Repetir a importação só repete a leitura
- authorization: n/a - a rota é pública até a Fase 3, que já lista `/print-profiles/import` entre as rotas a proteger
- concurrency: n/a - não há estado compartilhado nem gravação. Duas importações simultâneas são duas leituras independentes
- data lifecycle: n/a - nada é persistido (C33). A fixture é o único dado novo e vive nos testes
- dependency failure: C21, C23, C29 (timeout de 10 s, limite de 5 MB, sem redirecionamento, `502` com preenchimento manual), C38 no web
- state transitions: n/a - não existe entidade com estado. Os estados da tela estão em C34–C40
- observability: C22 - toda falha do MakerWorld gera um `warn` com o `designId` e o motivo, que é o sinal de que a API mudou ou passou a bloquear

## Handoff

Arquivos que a fase toca: 3 existentes (`api/src/app.module.ts` 0,7 KB, `web/src/components/app-shell.tsx` 0,8 KB e seu teste, medidos com `wc -c`), a fixture de 17 KB já salva e uns 18 novos (módulo, specs e e2e na API; página, componente, formatador e testes no web).

- S1–S5 ≈ 150 KB ≈ 38k tokens: S1–S4 em `print-profiles` na API, S5 no web. Fica abaixo do orçamento padrão de 150k: um builder só, sem pergunta
- Validação final com o Playwright MCP (AGENTS.md): abrir `/print-profiles` com a API rodando e conferir importação real da URL do ROADMAP, troca de perfil, URL inválida, estado inicial e a API parada

- **Boundary:** C1-C41 closed at `6f4a6ed`; C42-C46 closed in the commit that adds them
- **Settled mid-build:** o usuário escolheu `node:https` no lugar do `fetch` (door 4, AD-011), porque o Cloudflare do MakerWorld desafia o `fetch` do Node. `app-shell.test.tsx` trocou a asserção "menu sem links" pela de C41 (AC 29)
- **Abandoned:** `fetch` nativo (door 3 como aprovado) - 403 com `cf-mitigated: challenge` contra o MakerWorld real
- **Verification round 1 (`standard`):** FAIL - C1-C41 provados, 3 falhas sobreviveram (F9 transporte https, F6 arredondamento, F10 `MaxLength`). C42-C46 acrescentados; os três mutantes foram reinjetados e morreram
