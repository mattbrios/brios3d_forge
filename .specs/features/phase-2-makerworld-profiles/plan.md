# Fase 2 — Dados de impressão pela URL do MakerWorld

## Problem

Hoje quem precifica uma peça digita à mão o tempo de impressão e os gramas de cada filamento. Os
dois números já estão calculados na página do modelo no MakerWorld, no perfil de impressão que a
empresa vai usar. Em multicor (AMS) são vários números por perfil, às vezes espalhados em 11
placas. Cada um é copiado de uma tela, e um erro de digitação vira erro de preço sem ninguém
perceber. Quem paga é quem orça e a margem da empresa. Pagam também a Fase 12 (calculadora), a
Fase 13 (ficha técnica) e a Fase 19 (jobs), que precisam desses números e não têm de onde lê-los.

Ler os arquivos G-code/3MF não resolve isso: eles passam de 200 MB, e a operação não quer
recebê-los nem guardá-los. A fonte não traz números de volume nem de erro de digitação.

Quando isto estiver pronto, o usuário cola a URL do modelo (com ou sem `#profileId-N`) e recebe
o formulário já preenchido com tempo, AMS, impressora e filamentos (tipo, cor, gramas e metros)
do perfil. O que o MakerWorld não informar fica em branco para preencher à mão, e o formulário
continua disponível mesmo quando o MakerWorld falha.

## Flow

Reaproveita o `ValidationPipe` (AD-003), o filtro global de erros (AD-001), o desenho de erro de
domínio convertido pelo controller (AD-008) e o `apiFetch` do web (AD-005). Não usa banco.

1. `POST /print-profiles/import` com `{ "url": string }` -> `ValidationPipe` (exists) - recusa corpo sem `url` ou com outras chaves
2. controller de `print-profiles` (new, no door - placement per AD-004) - chama o serviço e converte `PrintProfileError` em `HttpException` (400, 404 ou 502)
3. `parseMakerWorldUrl` (new, no door - placement) - valida host e caminho e extrai o `designId` e o `profileId` opcional. URL inválida -> `PrintProfileError` 400
4. `MakerWorldClient` (door 2, door 3) - `GET https://makerworld.com/api/v1/design-service/design/<designId>` com timeout, limite de tamanho e sem seguir redirecionamento. Responde 404 -> `PrintProfileError` 404; qualquer outra falha -> `PrintProfileError` 502
5. `mapMakerWorldDesign` (new, no door - função pura) - monta o `PrintProfileImport` (door 1): campo ausente ou inválido vira `null`, os filamentos do perfil são somados por slot a partir das placas e o perfil selecionado é escolhido
6. out: `200` com o `PrintProfileImport`, que a tela `/print-profiles` do web (new, no door) mostra como formulário editável

## Impact

| Front | What changes |
| --- | --- |
| domain | novo termo: `PrintProfileImport` - o modelo e os perfis de impressão lidos de uma URL do MakerWorld. Mora em `print-profiles`. As Fases 12, 13 e 19 vão consumir |
| domain | novo termo: `profile` - um perfil de impressão do MakerWorld (item de `instances[]`). O `id` é o do `#profileId-N` da URL, **não** o campo `profileId` do JSON do MakerWorld |
| domain | termo `slot` - número do filamento no perfil, começando em 1 (o `id` de `plates[].filaments[]`). Não é índice de array, e pode ter buracos (Sea star usa os slots 1 e 4) |
| domain | os gramas são os que o MakerWorld informa (inteiros), sem somar nem tirar purga. As questões 17 (arredondamento) e 32 (purga) do ROADMAP seguem abertas |
| decision | a decisão de nunca processar G-code/3MF vira o AD-010. O padrão de chamada HTTP de saída vira o AD-009, e as Fases 14, 28 e 29 vão copiá-lo |
| route | nova rota `POST /print-profiles/import`. Nenhuma rota existente muda |
| app | `AppModule` importa o `PrintProfilesModule`. Nenhuma variável de ambiente nova e nenhuma dependência nova (`fetch` nativo do Node 24) |
| web | nova página `/print-profiles` e um item na navegação lateral |
| tests | fixture JSON reduzida em `api/test/fixtures/makerworld/` (ver Assumptions). Nenhum teste acessa a internet |
| stored data | nada para migrar. Nenhuma entidade é criada |

## Relations

`None - no stored-data shape change`. A importação não persiste nada.

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `POST /print-profiles/import` | `url` | `source` · `model` · `selectedProfileId` · `profiles[]` (com `filaments[]` e `plates[]`) · `{ error }` | `200`, `400`, `404`, `502` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. contrato `PrintProfileImport` | `{ source: { platform: "makerworld", designId: 3007827, url: "https://makerworld.com/models/3007827" }, model: { title: "Sea animals - set", coverUrl: "https://…jpeg", license: "Standard Digital File License", designer: "Real_Prints" }, selectedProfileId: 3387944, profiles: [{ id: 3387944, title: "Sea star", printSeconds: 1707, totalGrams: 9, needsAms: true, printer: { name: "X2D", nozzleDiameterMm: 0.4 }, settings: { layerHeightMm: 0.2, wallLoops: 2, sparseInfillRate: 0.15 }, filaments: [{ slot: 1, type: "PLA", color: "#FD8008", grams: 8, meters: 2.66 }], plates: [{ index: 1, printSeconds: 1707, totalGrams: 9, filaments: [ …mesmo formato… ] }] }] }`. Todo campo escalar de `model`, `profiles[]`, `printer`, `settings` e `filaments[]` pode ser `null`; `id`, `slot` e `index` nunca. Tempo em segundos inteiros (`Seconds`), percentual como fração (`Rate`, AD-006), cor `#RRGGBB` em maiúsculas | horas decimais (AD-006): `1707 s` vira `0.4741…` e o critério deixa de ser exato, então a conversão fica com quem consome (`÷ 3600`). Devolver só o perfil selecionado: trocar de perfil na tela exigiria uma nova chamada ao MakerWorld. Repassar o JSON do MakerWorld: os consumidores ficariam presos a um formato não documentado que pode mudar |
| 2. fonte dos dados | API JSON não documentada `GET https://makerworld.com/api/v1/design-service/design/<designId>`, atrás da interface `MakerWorldClient { fetchDesign(designId: number): Promise<unknown> }`, injetada por token para os testes a substituírem | scraping do HTML: a página responde `403` com o desafio do Cloudflare (verificado em 2026-09-21). Navegador headless: dependência de centenas de MB para uma página que também é bloqueada. Baixar o 3MF do perfil: é justamente o arquivo pesado que a fase existe para evitar (e também responde `403`) |
| 3. padrão de chamada HTTP de saída (AD-009) | `fetch(url, { redirect: "error", signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" } })`, corpo lido em stream e abortado acima de 5 MB, só `https://makerworld.com`. A URL do usuário nunca vira a URL da requisição: só o `designId` numérico é interpolado | `axios`/`@nestjs/axios`: dependência nova para o que o `fetch` nativo já faz. Seguir redirecionamentos: abriria SSRF para outro host. Montar a requisição a partir da URL colada: mesmo risco |

- Nada mais nesta mudança é difícil de reverter

## Criteria

### S1: importar um perfil pela URL (P1)

A URL do exemplo do ROADMAP devolve o perfil "Sea star" com os valores da página.

**Acceptance Criteria**

1. WHEN a URL `https://makerworld.com/pt/models/3007827-sea-animals-set?from=recommend#profileId-3387944` é importada com a fixture THEN the system SHALL devolver `selectedProfileId` `3387944` e, nesse perfil, `title` `"Sea star"`, `printSeconds` `1707`, `totalGrams` `9`, `needsAms` `true`, `printer` `{ name: "X2D", nozzleDiameterMm: 0.4 }` e `settings` `{ layerHeightMm: 0.2, wallLoops: 2, sparseInfillRate: 0.15 }`
2. WHEN a mesma URL é importada THEN the system SHALL devolver os filamentos do perfil "Sea star" como slot `1` `PLA` `#FD8008` `8` g `2.66` m e slot `4` `PLA` `#000000` `1` g `0.08` m, nessa ordem de slot
3. WHEN a mesma URL é importada THEN the system SHALL devolver `model` `{ title: "Sea animals - set", license: "Standard Digital File License", designer: "Real_Prints" }` com o `coverUrl` da fixture, e `source` `{ platform: "makerworld", designId: 3007827, url: "https://makerworld.com/models/3007827" }`
4. WHEN o perfil `3377800` é importado THEN the system SHALL devolver 11 `plates`, `printSeconds` `77054`, `totalGrams` `408` e os filamentos do perfil somados por slot: slot `1` `246` g, slot `2` `64` g, slot `3` `37` g, slot `4` `61` g
5. WHEN a URL não tem `#profileId-N` THEN the system SHALL usar o `defaultInstanceId` do modelo como `selectedProfileId` (`3377800` na fixture)
6. The system SHALL devolver todos os perfis do modelo em `profiles[]`, na ordem da resposta do MakerWorld
7. WHEN o perfil tem `needAms` `false` THEN the system SHALL devolver `needsAms` `false` (perfil "Sea shell", `3388305`)
8. The system SHALL aceitar a URL com e sem prefixo de idioma (`/pt/`, `/en/`), com e sem `www.`, com e sem slug e query string

**Independent test:** `curl -X POST localhost:3001/print-profiles/import -H 'content-type: application/json' -d '{"url":"https://makerworld.com/pt/models/3007827-sea-animals-set#profileId-3387944"}'` e comparar com a página do modelo.

### S2: dados ausentes viram campos em branco (P1)

Uma resposta incompleta do MakerWorld preenche o que der e deixa o resto `null`.

**Acceptance Criteria**

9. IF um campo escalar do perfil, do modelo, da impressora, das configurações ou de um filamento está ausente na resposta do MakerWorld THEN the system SHALL devolvê-lo como `null` e manter os demais campos preenchidos
10. IF um número chega como texto inválido (`usedG` `"abc"`) ou negativo THEN the system SHALL devolver esse campo como `null`
11. IF o perfil não tem `plates` THEN the system SHALL devolver `plates` `[]` e os filamentos de `instanceFilaments` com `slot` sequencial a partir de `1`
12. WHEN o modelo não tem nenhum perfil de impressão THEN the system SHALL responder `200` com `profiles` `[]` e `selectedProfileId` `null`

**Independent test:** importar a fixture com campos removidos e conferir quais voltam `null`.

### S3: recusar URLs e sobreviver a falhas do MakerWorld (P1)

Toda falha volta como `{ error }` com uma mensagem que diz o que fazer, e a API continua de pé.

**Acceptance Criteria**

13. IF a URL não é `https` no host `makerworld.com` (ou `www.makerworld.com`) com caminho `/models/<número>` THEN the system SHALL responder `400` com `{ "error": "URL inválida: cole o link de um modelo do MakerWorld (https://makerworld.com/models/…)" }` sem chamar o MakerWorld
14. IF o corpo não tem `url` ou `url` não é texto THEN the system SHALL responder `400` com `{ error }` pelo `ValidationPipe`
15. IF o `#profileId-N` não existe no modelo THEN the system SHALL responder `400` com `{ "error": "Perfil <N> não existe no modelo <designId>. Remova o #profileId da URL para ver os perfis disponíveis" }`
16. IF o MakerWorld responde `404` THEN the system SHALL responder `404` com `{ "error": "Modelo <designId> não encontrado no MakerWorld" }`
17. IF o MakerWorld não responde em 10 s, responde outro status que não `200`/`404`, redireciona, devolve mais de 5 MB ou devolve algo que não é um objeto JSON com `id` THEN the system SHALL responder `502` com `{ "error": "Não foi possível consultar o MakerWorld agora. Preencha os dados manualmente" }`
18. WHEN o MakerWorld falha THEN the system SHALL continuar respondendo `200` em `GET /health` logo depois
19. The system SHALL montar a requisição ao MakerWorld só com o `designId` numérico, nunca com o texto da URL recebida
20. WHEN a importação termina THEN the system SHALL não ter gravado nada no banco

**Independent test:** importar `https://printables.com/model/1`, um `designId` inexistente e, com o cliente falso, um timeout.

### S4: tela de importação com preenchimento manual (P1)

A página `/print-profiles` importa a URL e mostra um formulário editável, preenchido ou em branco.

**Acceptance Criteria**

21. WHEN o usuário cola a URL do S1 e clica em "Importar" THEN the system SHALL mostrar o formulário do perfil "Sea star" com tempo `0 h 28 min`, AMS marcado, impressora `X2D`, bico `0,4 mm` e dois filamentos (slot 1 PLA #FD8008 8 g; slot 4 PLA #000000 1 g), cada um com uma amostra da cor
22. WHILE a importação está em andamento the system SHALL mostrar "Importando…" e desabilitar o botão "Importar"
23. WHEN o modelo tem mais de um perfil THEN the system SHALL mostrar um seletor com o título, o tempo e os gramas de cada perfil, com o `selectedProfileId` escolhido, e trocar o formulário sem nova chamada à API
24. WHEN um campo volta `null` THEN the system SHALL mostrá-lo vazio e editável
25. IF a API responde com erro THEN the system SHALL mostrar a mensagem do `{ error }` e o formulário em branco, pronto para o preenchimento manual
26. WHEN o modelo não tem perfis THEN the system SHALL mostrar "Este modelo não tem perfis de impressão no MakerWorld. Preencha os dados manualmente" e o formulário em branco
27. WHEN o usuário clica em "Adicionar filamento" ou em "Remover" numa linha THEN the system SHALL acrescentar uma linha vazia ou retirar aquela linha da lista de filamentos
28. WHEN a página abre sem nenhuma importação THEN the system SHALL mostrar o campo de URL e o formulário em branco
29. The system SHALL mostrar um item "Importar do MakerWorld" na navegação lateral que leva a `/print-profiles`

**Independent test:** abrir `/print-profiles` com a API e o cliente falso, importar a URL do S1, trocar de perfil, e repetir com a API parada.

## Out of scope

| Excluded | Why |
| --- | --- |
| Ler, receber ou guardar arquivos G-code/3MF | decisão do usuário (AD-010): passam de 200 MB |
| URLs do Printables e do Thingiverse | não publicam dados de fatiamento estruturados. Nessas o preenchimento é manual, e a Fase 14 cuida dos metadados |
| Gravar o perfil importado ou o formulário | não há onde gravar ainda. A ficha técnica é a Fase 13 e a calculadora é a Fase 12 |
| Mapear o filamento para um material cadastrado | depende da Fase 6. É tarefa da Fase 12 |
| Calcular os gramas por `usedM` × densidade (questão 17) | depende da densidade do material cadastrado (Fase 6) |
| Decidir se `usedG` inclui purga (questão 32) | os gramas voltam como o MakerWorld informa |
| Cache das respostas do MakerWorld | uma chamada por importação feita pelo usuário. Cache só se aparecer bloqueio por volume |
| Autenticação do endpoint | vem na Fase 3, que já lista `/print-profiles/import` entre as rotas a proteger |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Fixture no git (questão 33) | JSON reduzido aos campos usados e a três perfis (Sea star `3387944`, `3377800` com 11 placas, Sea shell `3388305`), mais o `defaultInstanceId`. A resposta completa (1 MB) fica fora do git | evita versionar a página de terceiro inteira e mantém a CI sem rede. Os valores dos critérios vêm da resposta real de 2026-09-21 | n |
| Totais do perfil | `printSeconds` e `totalGrams` vêm de `prediction` e `weight` do perfil, não da soma das placas | é o que a página mostra. Na fixture os dois coincidem (AC 4) | n |
| Tempo na tela | horas e minutos, com os segundos arredondados para o minuto mais próximo (`1707 s` → `0 h 28 min`) | ninguém orça por segundo, e o contrato da API mantém os segundos exatos | n |
| User-Agent da requisição | `Brios3DForge/<versão do package.json>` | identifica o sistema. Se o MakerWorld passar a exigir um User-Agent de navegador, é um sinal de bloqueio a registrar, não a contornar | n |
| Log das falhas | `Logger` do Nest registra o `designId`, o status e o tipo da falha do MakerWorld, sem stack no corpo da resposta | é a única forma de perceber que a API mudou ou passou a bloquear | n |
| URL canônica em `source.url` | `https://makerworld.com/models/<designId>`, sem idioma, slug, query nem fragmento | a Fase 13 grava o endereço canônico do modelo | n |

**Open questions:**

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | blocks go-live | O uso pontual da API não documentada do MakerWorld é aceitável pelos termos de uso (questão 34 do ROADMAP)? | a tela funciona, mas o uso real depende desse aceite |
| 2 | open | Os gramas do perfil vêm arredondados para inteiros (questão 17) | a tela mostra os gramas como vêm e permite editar |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| API `POST /print-profiles/import` | response shape | AC 1, AC 2, AC 3, AC 4, AC 12 |
| API `POST /print-profiles/import` | error shape and codes | AC 13, AC 14, AC 15, AC 16, AC 17 |
| API `POST /print-profiles/import` | who may call it | n/a - a autenticação global só existe a partir da Fase 3, que já lista esta rota para proteger |
| API `POST /print-profiles/import` | versioning | n/a - a rota nasce sem consumidor externo e o projeto não versiona rotas |
| API `POST /print-profiles/import` | rate limit | n/a - o projeto não limita taxa em nenhuma rota. A chamada ao MakerWorld só acontece por ação do usuário, e o timeout (AC 17) limita quanto cada uma segura |
| screen `/print-profiles` | empty state | AC 26, AC 28 |
| screen `/print-profiles` | loading state | AC 22 |
| screen `/print-profiles` | error state | AC 25 |
| screen `/print-profiles` | unauthorised state | n/a - não existe login até a Fase 3 |
| screen `/print-profiles` | density and ordering | AC 2, AC 23 (filamentos por slot, perfis na ordem do MakerWorld) |
| screen `/print-profiles` | destructive action confirms | n/a - remover uma linha do formulário não grava nada e se desfaz adicionando outra |

## Sources

- `ROADMAP.md`, Fase 2 e questões 17, 32, 33 e 34 - tarefas, fonte dos dados e o que segue em aberto
- Resposta de `GET https://makerworld.com/api/v1/design-service/design/3007827` em 2026-09-21 - campos, valores dos critérios e o `403` da página HTML
