# Fase 14 — Metadados do modelo por URL (Printables e MakerWorld)

## Problem

Hoje o produto do catálogo (Fase 13) só recebe título, designer, licença, uso comercial e
imagem do modelo por **digitação manual**. Quem cadastra um produto precisa abrir a página do
modelo no Printables ou no MakerWorld em outra aba, copiar cada campo à mão e, sobretudo, ler a
licença e decidir se ela permite uso comercial — um julgamento fácil de errar (a licença "Standard
Digital File License" do MakerWorld, por exemplo, proíbe uso comercial, mas o texto não contém a
palavra "commercial" em destaque). Um erro aqui é silencioso: o produto entra no catálogo sem o
aviso da Fase 13 (`LicenseNotice`), e ninguém percebe até vender algo que a licença não permitia.

Depois desta fase, colar a URL do modelo no formulário de produto preenche título, designer,
licença e imagem automaticamente para Printables e MakerWorld, e a flag de uso comercial é
decidida por uma regra escrita, não por leitura humana da licença. O Thingiverse continua manual
nesta fase (ver "Out of scope").

## Flow

Reaproveita o `MakerWorldClient` e o mapeador de modelo da Fase 2 para o MakerWorld; para o
Printables, entra um adaptador novo no mesmo desenho (AD-011). Nenhum dado é persistido pela busca
em si — só as duas ações explícitas abaixo persistem.

**Preview (criação e edição, e primeiro passo da atualização)**

1. `POST /products/model-metadata` com `{ modelUrl }` → `ProductsController` (exists)
2. `ModelMetadataService` (new) → `parseModelUrl` (exists, Fase 13) identifica a plataforma
3. Printables → `HttpPrintablesClient` (new) busca o modelo → `mapPrintablesMetadata` (new, pura)
   extrai título, imagem, designer e a licença bruta
4. MakerWorld → `HttpMakerWorldClient.fetchDesign` (exists, Fase 2, exportado pelo
   `PrintProfilesModule`) → `mapMakerWorldDesign` (exists, Fase 2) → usa só o campo `.model`
5. Thingiverse → `ModelMetadataError(400)` (new): busca automática não suportada nesta fase
6. `normalizeLicense` (new, pura) converte a licença bruta em `{ license, commercialUseAllowed }`
7. out: `{ title, imageUrl, designer, license, commercialUseAllowed }`, nada grava no banco

**Atualizar metadados (produto já existente)**

1. `POST /products/:id/model-metadata/refresh` (admin) → `ProductsController` (exists)
2. `ProductsService.refreshMetadata` (new) carrega o produto (exists) e chama o mesmo
   `ModelMetadataService` acima com a `modelUrl` já gravada
3. Sobrescreve as colunas de metadado do `Product` (exists, Fase 13): `modelTitle`,
   `modelImageUrl`, `modelDesigner`, `modelLicense`, `commercialUseAllowed`, e grava
   `modelMetadataFetchedAt = now()`
4. out: `ProductResponse` (contrato existente)

## Impact

| Front | What changes |
| --- | --- |
| domain | `Product.modelMetadataFetchedAt` (Fase 13, sempre `null` até agora) passa a ser
gravado por `.../refresh`; nenhum outro consumidor lê essa coluna hoje |
| domain | `commercialUseAllowed` (Fase 13, hoje só digitado) ganha um segundo escritor: a
normalização automática da licença. `LicenseNotice` (Fase 13) continua sem mudança — ele só lê a
flag, não importa quem a escreveu |
| stored data | nada a migrar - nenhuma coluna nova |

## Relations

`None - no stored-data shape change` (as 6 colunas de metadado já existem desde a Fase 13)

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `POST /products/model-metadata` | `modelUrl` | `title`, `imageUrl`, `designer`, `license`, `commercialUseAllowed` | `200`, `400`, `404`, `502` |
| `POST /products/:id/model-metadata/refresh` | *(sem corpo)* | `ProductResponse` (contrato da Fase 13) | `200`, `400`, `403`, `404`, `502` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| Adaptador HTTP por plataforma (padrão que o MakerWorld já fixou, AD-011) | `PrintablesClient`
interface `fetchModel(externalId: string): Promise<unknown>`, token de DI `PRINTABLES_CLIENT`,
implementação com `node:https`, sem seguir redirecionamento, `AbortSignal.timeout`, limite de
bytes do corpo, User-Agent `Brios3DForge/<version>` (mesmo padrão do `HttpMakerWorldClient`,
`node:https` no `POST` em vez de `GET`) | `fetch` nativo do Node: funcionou nos testes manuais de
hoje contra `api.printables.com`, mas AD-011 já é uma decisão de projeto para toda chamada de
saída (proteção contra SSRF via host fixo, não é só contorno de Cloudflare), e divergir aqui só
para o Printables criaria dois padrões onde um resolveria |
| Regra de normalização de licença → `commercialUseAllowed` | Prioridade fixa, testada por
palavra-chave (case-insensitive): (1) contém `noncommercial`/`non-commercial` → `false`; (2) é
exatamente `Standard Digital File License` → `false`; (3) é uma licença permissiva conhecida
(Creative Commons sem `noncommercial`, `CC0`, domínio público, MIT, BSD, GPL) → `true`; (4)
qualquer outro texto (incluindo vazio/ausente) → `null`, mantendo o texto original em `license`
| Tabela de strings exatas por plataforma: desqualificada porque o texto da licença varia por
idioma e por pequenas mudanças de redação ao longo do tempo (ex.: "Creative Commons — Attribution"
vs "CC BY 4.0"); uma tabela exata erraria silenciosamente para qualquer variação não cadastrada,
e o door 5 da Fase 13 já fixou que `null` nunca pode significar "permitido" - uma regra por
palavra-chave degrada para `null` em vez de uma classificação errada |

- Nenhum outro dado novo persistido; `modelMetadataFetchedAt` só é escrito por `.../refresh`
  (ver Assumption abaixo)

## Criteria

### S1: Preview de metadados por URL (P1)

Colar a URL de um modelo do Printables ou do MakerWorld devolve os metadados sem gravar nada.

**Acceptance Criteria**

1. WHEN `POST /products/model-metadata` recebe a URL de um modelo do Printables THEN a API SHALL responder `200` com `title`, `imageUrl`, `designer` e a licença normalizada
2. WHEN `POST /products/model-metadata` recebe a URL de um modelo do MakerWorld THEN a API SHALL responder `200` reaproveitando os campos de modelo já mapeados pela Fase 2 (`title`, `coverUrl`, `license`, `designCreator.name`)
3. IF a URL não pertence ao Printables, ao MakerWorld nem ao Thingiverse THEN a API SHALL responder `400` com a mesma mensagem `INVALID_MODEL_URL` já usada em `POST /products`
4. IF a URL é do Thingiverse THEN a API SHALL responder `400` com uma mensagem informando que a busca automática não está disponível nesta plataforma e que o preenchimento é manual
5. IF o modelo não existe na plataforma de origem THEN a API SHALL responder `404`
6. IF a plataforma de origem estiver fora do ar, bloqueada ou responder um formato irreconhecível THEN a API SHALL responder `502` com uma mensagem que convida ao preenchimento manual, sem vazar o detalhe da falha upstream
7. The API SHALL nunca gravar nenhum dado ao processar `POST /products/model-metadata`

**Independent test:** chamar a rota com a URL de um modelo real de cada plataforma (fixture) e
com uma URL do Thingiverse; nenhuma linha de `products` muda.

### S2: Normalização da licença (P1)

A flag de uso comercial nunca vem de leitura humana do texto da licença.

**Acceptance Criteria**

8. WHEN o texto da licença contém `noncommercial` ou `non-commercial` (qualquer capitalização) THEN a normalização SHALL resultar em `commercialUseAllowed = false`
9. WHEN o texto da licença é exatamente `Standard Digital File License` THEN a normalização SHALL resultar em `commercialUseAllowed = false`
10. WHEN o texto da licença corresponde a uma licença permissiva conhecida (Creative Commons sem `noncommercial`, `CC0`, domínio público, MIT, BSD, GPL) THEN a normalização SHALL resultar em `commercialUseAllowed = true`
11. IF o texto da licença não corresponder a nenhum padrão conhecido, incluindo vazio ou ausente, THEN a normalização SHALL resultar em `commercialUseAllowed = null`, preservando o texto original em `license`

**Independent test:** função pura, um caso por linha da tabela acima, incluindo o texto vazio.

### S3: Atualizar metadados de um produto existente (P1)

Um admin repete a busca sem reabrir o formulário inteiro.

**Acceptance Criteria**

12. WHEN um admin chama `POST /products/:id/model-metadata/refresh` num produto do Printables ou do MakerWorld THEN a API SHALL buscar os metadados atuais, sobrescrever `modelTitle`, `modelImageUrl`, `modelDesigner`, `modelLicense` e `commercialUseAllowed`, gravar `modelMetadataFetchedAt` com o instante da chamada e responder `200` com o produto atualizado
13. IF o produto não existir THEN a API SHALL responder `404` com `PRODUCT_NOT_FOUND`
14. IF o produto for do Thingiverse THEN a API SHALL responder `400` com a mesma mensagem do AC 4, sem alterar nenhum campo do produto
15. IF a busca upstream falhar (404 ou 502 da fonte) THEN a API SHALL responder o mesmo código, sem alterar nenhum campo do produto
16. IF quem chama não for admin THEN a API SHALL responder `403`
17. The API SHALL permitir chamar `.../refresh` repetidamente sobre o mesmo produto, cada chamada sobrescrevendo os mesmos campos e avançando `modelMetadataFetchedAt`

**Independent test:** produto de fixture com dados desatualizados; chamar a rota e comparar o
produto antes/depois pelo `GET /products/:id`.

### S4: Web - formulário de produto usa o preview antes de salvar (P1)

**Acceptance Criteria**

18. WHEN o usuário cola uma URL do Printables ou do MakerWorld no formulário de produto (criação ou edição) e aciona "Buscar metadados" THEN a tela SHALL preencher título, designer, licença, uso comercial e mostrar a imagem, sem gravar nada até "Salvar" ser acionado
19. WHILE a busca está em andamento THEN a tela SHALL mostrar o estado de carregamento
20. IF a busca falhar (URL inválida, Thingiverse, 404 ou 502) THEN a tela SHALL mostrar a mensagem de erro devolvida pela API e manter os campos editáveis para preenchimento manual

**Independent test:** Playwright colando uma URL de fixture válida, uma do Thingiverse e uma
inválida; os três estados aparecem sem travar o formulário.

### S5: Web - "Atualizar metadados" no detalhe do produto (P2)

**Acceptance Criteria**

21. WHEN um admin abre "Atualizar metadados" no detalhe de um produto do Printables ou do MakerWorld THEN a tela SHALL buscar o preview atual e mostrar, lado a lado, o valor gravado e o valor buscado para título, designer, licença, uso comercial e imagem, antes de gravar
22. WHEN o admin confirma a atualização THEN a tela SHALL chamar `POST /products/:id/model-metadata/refresh` e refletir o produto atualizado, incluindo a data da última busca
23. IF o admin cancelar antes de confirmar THEN a tela SHALL não persistir nada
24. IF o produto for do Thingiverse THEN a tela SHALL não exibir o botão "Atualizar metadados"
25. IF a busca do preview falhar (400/404/502) THEN a tela SHALL mostrar a mensagem de erro e manter os dados atuais do produto sem alteração

**Independent test:** Playwright abrindo o detalhe de um produto de fixture, comparando o diff
mostrado, confirmando e conferindo o produto atualizado; repetir cancelando.

## Out of scope

| Excluded | Why |
| --- | --- |
| Busca automática de metadados no Thingiverse | a API oficial (`api.thingiverse.com`) responde
`401` sem token; não existe fluxo de OAuth por usuário final, é preciso registrar um app no
Thingiverse Developer Portal e gerar um App Token estático manualmente. Nenhuma página HTML do
Thingiverse carrega dados do modelo no HTML inicial (é Next.js client-side), então também não há
como usar Open Graph/JSON-LD como alternativa. Fica para quando alguém gerar o token; revisitar a
questão 34 do ROADMAP |
| Guardar cópia local da imagem do modelo | a Fase 13 já decidiu exibir por hotlink direto da
plataforma (questão aberta 23 do ROADMAP); esta fase não muda esse comportamento |
| Atualização automática/agendada dos metadados | ROADMAP pede só a ação manual "atualizar
metadados"; nenhuma tarefa fala de rodar isso em segundo plano |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Thingiverse fica fora da busca automática nesta fase | preenchimento manual continua sendo a
única via; `POST /products/model-metadata` e `.../refresh` respondem `400` para URLs do
Thingiverse | decisão do usuário nesta conversa (opção B) | y |
| `modelMetadataFetchedAt` só é gravado por `.../refresh`, nunca por `POST /products` (criação)
mesmo quando o formulário foi prefilled pelo preview | criar um produto grava `modelTitle` etc.
como hoje (Fase 13), mas `modelMetadataFetchedAt` continua `null` até o primeiro "Atualizar
metadados" | evita confiar num timestamp que o cliente não pode provar (o preview e o "salvar"
são chamadas HTTP separadas, sem garantia de que os valores salvos vieram do preview e não foram
editados); manter a coluna significando "resultado de uma busca verificada pelo servidor" em vez
de "quando o formulário mudou" | n |
| API GraphQL do Printables (`https://api.printables.com/graphql/`) é usada como fonte, apesar de
não documentada e sem introspecção pública | mesmo tratamento de risco do MakerWorld (AD-011):
adaptador isolado, mapeador tolera campos ausentes, preenchimento manual sempre disponível |
verificado ao vivo nesta conversa (2026-09-28): responde sem autenticação, sem CORS restritivo
detectado, com `license.name`, `image.filePath`, `user.publicUsername`, `name`; introspecção
(`__type`) está desligada, então os campos foram descobertos por tentativa, não por schema
publicado | n |
| Regra de normalização de licença (palavras-chave, prioridade fixa) descrita em `Landing` | ver
Landing acima | evita depender de uma tabela exaustiva de strings exatas, que fica obsoleta a
cada variação de redação | n |
| Botão "Buscar metadados" chama a mesma rota de preview independente da plataforma da URL
colada, deixando a API decidir 400 para Thingiverse (em vez da tela pré-filtrar por domínio) |
um único caminho de erro (AC 20) cobre URL inválida, Thingiverse e falha upstream, em vez de três
caminhos de tela distintos | menos estado na tela, e a API já precisa validar a URL de qualquer
forma (SSRF) | n |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| API `POST /products/model-metadata` | error shape and codes | AC 3-6 |
| API `POST /products/model-metadata` | quem pode chamar | admin apenas (sem `@Roles()`, AD-018);
n/a - mesma regra de `POST /products`, nada novo a decidir |
| API `POST /products/:id/model-metadata/refresh` | error shape and codes | AC 13-16 |
| API `POST /products/:id/model-metadata/refresh` | quem pode chamar | AC 16 |
| screen formulário de produto (criação/edição) | loading state | AC 19 |
| screen formulário de produto (criação/edição) | error state | AC 20 |
| screen formulário de produto (criação/edição) | empty state | n/a - busca de um único
registro, não uma lista; sem coleção para ficar vazia |
| screen formulário de produto (criação/edição) | destructive action confirms | n/a - o preview
não sobrescreve nada até "Salvar" (AC 18), que já é a confirmação existente da Fase 13 |
| screen detalhe do produto, ação "Atualizar metadados" | loading state | existe o padrão de
`loading` reusável (`Loading`, `ui/feedback.tsx`, Fase 0); n/a - reaproveita o componente |
| screen detalhe do produto, ação "Atualizar metadados" | error state | AC 25 |
| screen detalhe do produto, ação "Atualizar metadados" | destructive action confirms | AC 21-23
(mostra o diff e exige confirmação antes de sobrescrever campos já gravados) |
| screen detalhe do produto, ação "Atualizar metadados" | empty state | n/a - não é uma lista |

## Sources

- `ROADMAP.md`, seção "Fase 14 — Metadados do modelo por URL" - tarefas e critérios de aceite
  que este plano deriva
- `https://api.printables.com/graphql/` - verificado ao vivo em 2026-09-28 (consulta
  `query($id:ID!){ print(id:$id){ id name license { id name } user { publicUsername } image {
  filePath } } }`, sem autenticação; `image.filePath` resolvido em
  `https://media.printables.com/<filePath>`, confirmado com `200` e `content-type: image/jpeg`)
- `https://www.thingiverse.com/developers` e `api.thingiverse.com/things/:id` (retornou `401`
  sem token nesta conversa) - base para o "Out of scope" do Thingiverse
