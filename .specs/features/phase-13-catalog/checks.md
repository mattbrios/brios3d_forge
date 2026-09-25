# Fase 13 — Catálogo e ficha técnica · checks

Profile: light
Plan: `.specs/features/phase-13-catalog/plan.md`

## Intent

52 checks em 5 fatias · 5 one-way doors · nenhuma questão aberta

O `AGENTS.md` não declara perfil, então vale o `light` do `tlc-spec-lean`. As duas decisões de
produto do plano foram aprovadas pelo usuário na revisão: só `admin` escreve no catálogo, e há um
produto por modelo.

O nível de cada prova segue a "Política de testes" do `AGENTS.md`, que responde às duas perguntas
de nível e profundidade para toda camada tocada. Por isso não há seção `## Test policy`.

- `model-url.ts` decide: detecta a plataforma, recusa host, protocolo e id e normaliza, com 8
  ramos: 3 plataformas aceitas, prefixo de idioma, host estranho, `http`, id ausente e
  porta/credencial. Ele é alcançado por rota, então tem prova e2e **e** `model-url.spec.ts`, um
  caso por linha
- o cálculo de preço do produto decide: filtra as variações ativas e, por variação, escolhe entre
  sucesso e erro. Tem prova e2e **e** um spec do próprio arquivo, com `QuotePreviewService` falso
- `products.service.ts` decide: 404 de produto e de variação, variação que não pertence ao
  produto, substituição de `materials`/`supplies` e tradução de violação de único em 409. Tem
  e2e **e** `products.service.spec.ts`
- os índices únicos (door 3 e door 4) e as FKs `RESTRICT` são invariantes do banco: um teste por
  lado, direto no banco. Não há coluna decrementada, então o AD-023 não se aplica. Mesmo assim, a
  corrida de duas criações do mesmo modelo tem prova (C18), porque o índice é o mecanismo do AC 6
- controller e DTOs não decidem, então a prova é o e2e com o lado aceito e cada lado recusado
- as rotas sem `@Roles()` (escrita) e com `@Roles('production', 'sales')` (leitura) levam e2e
  por papel, com o lado barrado e o liberado
- telas: um teste por estado em `*.test.tsx`

Os valores esperados vêm do `plan.md` e ficam escritos literalmente nas asserções. O custo de
referência reaproveita o caso da Fase 12: material com dois rolos cheios de 1000 g, a R$ 100,00 e
a R$ 120,00, dá custo médio de 11 centavos/g. Em todo e2e de preço, `resetSettings` zera
`purgeRate` e `failureRate`.

## Checks

### S1 - produto e URL do modelo (API) · ~16 files · ~60 KB · ~15k

**C1** - `POST /products` como `admin` com `{ name: "Estrela do mar", modelUrl: "https://makerworld.com/models/3007827" }` responde `201` com `active: true`, `variants: []`, `modelPlatform: "makerworld"`, `commercialUseAllowed: null` e `modelMetadataFetchedAt: null` (AC 1, door 5)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "creates a product with the detected platform and no variants"`

**C2** - Tabela sobre as três URLs dos AC 2, 3 e 4 enviadas a `POST /products` (3 casos). A resposta `201` traz exatamente `makerworld` + `https://makerworld.com/models/3007827`, `printables` + `https://www.printables.com/model/123456` e `thingiverse` + `https://www.thingiverse.com/thing:4567890` (AC 2, 3, 4, door 3)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "stores the canonical url for each platform"`

**C3** - Tabela sobre `modelUrl` com host `example.com`, com `http://www.printables.com/model/1`, com `https://www.thingiverse.com/about` (sem id) e ausente (4 casos). Cada um responde `400`, e os três primeiros trazem `{ "error": "URL do modelo inválida: use um link de modelo do Printables, do MakerWorld ou do Thingiverse" }` (AC 5)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "rejects a model url outside the three platforms"`

**C4** - `parseModelUrl` (`model-url.ts`), um caso por ramo (8 casos):
- MakerWorld com `/pt/`, slug, query e `#profileId-3387944` vira `{ platform: "makerworld", externalId: "3007827" }`
- Printables com slug, `?lang=en` e subcaminho `/files` vira `{ platform: "printables", externalId: "123456" }`
- Printables com prefixo `/pl/` vira o mesmo id
- Thingiverse com `/files` vira `{ platform: "thingiverse", externalId: "4567890" }`
- host `evil-printables.com`, `http:`, caminho sem id e URL com porta ou credencial lançam o erro com a mensagem do AC 5

(AC 2, 3, 4, 5, nível do arquivo)
Proof: `npm --prefix api run test -- src/modules/products/model-url.spec.ts -t "parseModelUrl"`

**C5** - Com um produto já criado para `https://makerworld.com/models/3007827`, um `POST /products` com `https://makerworld.com/pt/models/3007827-outro-slug` responde `409` com `{ "error": "Já existe um produto para este modelo" }` (AC 6)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "rejects a second product for the same model with 409"`

**C6** - `PATCH /products/:id` que troca a `modelUrl` de um produto para o modelo de outro produto existente responde `409` com a mesma mensagem de C5 (AC 6)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "rejects a patch that points to another product's model with 409"`

**C7** - Tabela sobre `POST /products` com `name: ""`, `name` de 151 caracteres, `description` de 2001 caracteres, `modelImageUrl: "http://img.example/a.png"` e uma propriedade não declarada `cost` (5 casos). Cada um responde `400` com `{ error }`. `name` de 150 caracteres e `description` de 2000 respondem `201`, o lado que não dispara (AC 7)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "validates product field bounds on both sides"`

**C8** - `PATCH /products/:id` com `{ active: false }` responde `200` com `active: false`. Um `GET /products/:id` seguinte ainda devolve o produto e as variações, e `PATCH` com `{ active: true }` o reativa (AC 8)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "deactivates and reactivates a product without deleting it"`

**C9** - Tabela sobre `GET /products/not-a-uuid` e `PATCH /products/not-a-uuid` (400), e sobre `GET` e `PATCH` com um UUID inexistente (404 com `{ "error": "Produto não encontrado" }`) (4 casos) (AC 9)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "returns 400 for a malformed id and 404 for an unknown product"`

**C10** - Com os produtos "Estrela do mar" (`modelTitle: "Sea animals set"`) e "Vaso espiral" (`modelTitle: null`):
- `GET /products?search=SEA` devolve só "Estrela do mar", pelo `modelTitle` e sem diferenciar maiúsculas
- `GET /products?search=espiral` devolve só "Vaso espiral"
- as duas respostas têm o formato `{ items, total: 1, page: 1, pageSize: 20 }`

(AC 10, AD-020)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "searches name and model title case-insensitively with the AD-020 envelope"`

**C11** - `GET /products?platform=printables` devolve só os produtos do Printables. `GET /products?pageSize=101` responde `400` e `pageSize=100` responde `200` (AC 10, AD-020)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "filters by platform and bounds pageSize"`

**C12** - `ProductsService` com repositório falso: `create` e `update` traduzem a violação de único do Postgres (`23505`) em `ConflictException` com a mensagem de C5, e relançam qualquer outro erro sem alteração (2 ramos, nível do arquivo) (AC 6)
Proof: `npm --prefix api run test -- src/modules/products/products.service.spec.ts -t "maps a unique violation on the model to 409 and rethrows anything else"`

### S2 - variações e ficha técnica (API) · ~6 files · ~40 KB · ~10k

**C13** - `POST /products/:id/variants` com:
- `name: "Laranja"`
- uma impressora cadastrada
- `printHours: 0.47`, `prepHours: 0.25`, `slicingHours: 0.1`, `postProcessingHours: 0`
- um material com `grams: 8` e um insumo com `quantity: 2`

responde `201` com `active: true`, a ficha com esses valores exatos e os nomes resolvidos: material `"<type> · <brand> · <color>"`, o nome do insumo e o da impressora (AC 13)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "creates a variant with its tech sheet and resolved names"`

**C14** - Tabela sobre `POST /products/:id/variants` (8 casos), cada um respondendo `400` com `{ error }`:
- `printHours: -1`
- `prepHours: -0.01`
- `grams: 0`
- `quantity: 0`
- `materials: []`
- 33 linhas de material
- 51 linhas de insumo
- `name: ""`

`printHours: 0`, 32 linhas de material e 50 de insumo respondem `201`, o lado que não dispara (AC 14)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "validates variant bounds on both sides"`

**C15** - Tabela sobre `POST /products/:id/variants` com produto, `printerId`, `materialId` e `stockItemId` inexistentes, um de cada vez (4 casos). Cada um responde `404`, com `{ "error": "Produto não encontrado" }`, `` `Impressora ${id} não encontrada` ``, `` `Material ${id} não encontrado` `` e `` `Insumo ${id} não encontrado` `` (AC 15)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "returns 404 naming the unknown product, printer, material or stock item"`

**C16** - Com a variação "Laranja" no produto A, `POST /products/A/variants` com `name: "laranja"` responde `409` com `{ "error": "Já existe uma variação com este nome neste produto" }`. `name: "Laranja"` no produto B responde `201`, porque o único vale só dentro do produto. Um `PATCH` que renomeia outra variação de A para `"LARANJA"` responde `409` (AC 16, door 4)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "enforces case-insensitive variant name uniqueness within a product only"`

**C17** - Numa variação com 2 materiais e 1 insumo:
- `PATCH` com `materials: [1 linha nova]` deixa exatamente essa linha de material e mantém o insumo intacto
- `PATCH` com `supplies: []` zera os insumos e mantém o material
- `PATCH` só com `name` não toca em nenhuma lista

(AC 17)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "replaces only the lists sent in a variant patch"`

**C18** - Duas chamadas simultâneas a `POST /products` com o mesmo modelo (`Promise.all`) terminam com exatamente uma `201` e uma `409`, e há uma única linha em `products` para esse modelo (AC 6, concorrência, door 3)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "two concurrent creates of the same model yield one 201 and one 409"`

**C19** - `PATCH /products/A/variants/<id de uma variação do produto B>` responde `404` com `{ "error": "Variação não encontrada" }`, e o mesmo vale para um `variantId` inexistente (AC 18)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "returns 404 for a variant outside the product"`

**C20** - `ProductsService` com repositórios falsos:
- a variação encontrada com outro `productId` lança `NotFoundException("Variação não encontrada")`
- `materials: undefined` preserva as linhas existentes
- `materials: [...]` apaga e regrava só as linhas de material, na mesma transação

(3 ramos, nível do arquivo) (AC 17, 18)
Proof: `npm --prefix api run test -- src/modules/products/products.service.spec.ts -t "variant ownership and list replacement"`

**C21** - Variação com `PATCH { active: false }` responde `200` com `active: false` e continua em `GET /products/:id` (AC 8, door 4, transição de estado)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "deactivates a variant without deleting it"`

### S3 - invariantes do banco · ~2 files · ~10 KB · ~3k

**C22** - Direto no banco (`dataSource.query`):
- inserir dois `products` com o mesmo (`model_platform`, `model_external_id`) falha com `23505`
- o mesmo `model_external_id` com outra plataforma é aceito

(door 3, cada lado)
Proof: `npm --prefix api run test:e2e -- test/products-schema.e2e-spec.ts -t "unique model index rejects the same platform and id only"`

**C23** - Direto no banco:
- inserir duas `product_variants` no mesmo produto com nomes `"Azul"` e `"AZUL"` falha com `23505`
- `"Azul"` em dois produtos diferentes é aceito

(door 4, cada lado)
Proof: `npm --prefix api run test:e2e -- test/products-schema.e2e-spec.ts -t "unique variant name index is case-insensitive and per product"`

**C24** - Direto no banco, tabela sobre `DELETE` de um `materials`, de um `stock_items` e de um `printers` referenciados por uma ficha (3 casos). Cada um falha com `23503` (FK `RESTRICT`), e o `DELETE` de um material não referenciado passa (door 4, cada lado)
Proof: `npm --prefix api run test:e2e -- test/products-schema.e2e-spec.ts -t "tech sheet foreign keys restrict deleting referenced registries"`

**C25** - Direto no banco: `INSERT` em `products` sem `commercial_use_allowed` grava `NULL`, não `true` nem `false`, e um `model_platform` fora do enum (`'cults3d'`) falha com `22P02` (door 3, door 5)
Proof: `npm --prefix api run test:e2e -- test/products-schema.e2e-spec.ts -t "commercial use defaults to null and platform is a closed enum"`

### S4 - custo e preço sugerido (API) · ~6 files · ~30 KB · ~8k

**C26** - Cenário: material com dois rolos cheios (R$ 100,00 e R$ 120,00 por 1000 g, 11 centavos/g), variação "Laranja" com `grams: 50`, `prepHours: 0.5`, `slicingHours: 0.25`, `postProcessingHours: 0.25`, `laborCentsPerHour: 3000`, um canal ativo "Balcão QA" e um inativo "Inativo QA". `GET /products/:id/pricing` responde `200` com uma entrada para "Laranja" em que:
- `error: null`
- `pricing.quantity: 1`
- `pricing.costs.materialCents: 550`
- `pricing.costs.laborCents: 3000`
- `pricing.channels` contém "Balcão QA" e não contém "Inativo QA"

(AC 22)
Proof: `npm --prefix api run test:e2e -- test/products-pricing.e2e-spec.ts -t "prices each active variant with quantity 1, active channels and the settings labor rate"`

**C27** - No cenário de C26, depois de `createRoll` de um terceiro rolo cheio de 1000 g a R$ 300,00 do mesmo material, a próxima chamada responde `materialCents: 867` (50 g × 17,33 centavos/g, meio para cima), e `products.updated_at` e as linhas da ficha continuam iguais (AC 23, AD-024)
Proof: `npm --prefix api run test:e2e -- test/products-pricing.e2e-spec.ts -t "reflects a new roll's average cost without writing to the product"`

**C28** - Produto com a variação "Laranja" (com custo) e a variação "Preto", cujo único material tem todos os rolos descartados. `GET /products/:id/pricing` responde `200`:
- "Preto" vem com `pricing: null` e `error: "Material sem custo médio disponível: <type> · <brand> · <color>"`
- "Laranja" vem com `pricing` preenchido e `error: null`

(AC 24, door 2)
Proof: `npm --prefix api run test:e2e -- test/products-pricing.e2e-spec.ts -t "isolates one variant's failure from the others"`

**C29** - Um produto sem variação e um produto cuja única variação está inativa respondem `200` com `{ "variants": [] }` (AC 25, AC 22 "ativa")
Proof: `npm --prefix api run test:e2e -- test/products-pricing.e2e-spec.ts -t "returns an empty list when no variant is active"`

**C30** - `GET /products/not-a-uuid/pricing` responde `400`, e um UUID inexistente responde `404` com `{ "error": "Produto não encontrado" }` (Surface)
Proof: `npm --prefix api run test:e2e -- test/products-pricing.e2e-spec.ts -t "returns 400 for a malformed id and 404 for an unknown product"`

**C31** - Serviço de preço do produto com `QuotePreviewService`, `SettingsService` e `SalesChannelsService` falsos (4 ramos, nível do arquivo):
- (a) variação inativa não gera chamada a `preview`
- (b) o DTO enviado a `preview` tem `quantity: 1`, `channelIds` só dos canais com `active: true`, `labor.centsPerHour` igual ao `laborCentsPerHour` falso (`3000`) e nenhum `minimumOrderCents`
- (c) `preview` rejeitando com `BadRequestException("x")` vira `{ pricing: null, error: "x" }`, e o mesmo vale para `NotFoundException("y")`
- (d) um erro que não é `HttpException` é relançado, não engolido

(AC 22, 24)
Proof: `npm --prefix api run test -- src/modules/products/product-pricing.service.spec.ts -t "ProductPricingService"`

### S5 - papéis, telas e navegação · ~12 files · ~90 KB · ~23k

**C32** - Tabela por papel sobre `GET /products`, `GET /products/:id` e `GET /products/:id/pricing`: `production` e `sales` respondem `200`, como `admin` (3 rotas × 2 papéis) (AC 30)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "production and sales read the catalog and its pricing"`

**C33** - Tabela por papel sobre `POST /products`, `PATCH /products/:id`, `POST /products/:id/variants` e `PATCH /products/:id/variants/:variantId`. `production` e `sales` respondem `403` com `{ "error": "Você não tem permissão para esta ação" }`, e `admin` responde `201`/`200` (4 rotas × 3 papéis) (AC 31)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "only admin writes to the catalog"`

**C34** - Tabela sobre as sete rotas de `/products*` sem cookie de sessão (7 casos): cada uma responde `401` (AD-015)
Proof: `npm --prefix api run test:e2e -- test/products.e2e-spec.ts -t "every products route is 401 without a session"`

**C35** - `/products` mostra o indicador de carregamento antes de `GET /auth/me` e `GET /products` (mocks) resolverem (AC 34, carregando)
Proof: `npm --prefix web run test -- 'src/app/(app)/products/page.test.tsx' -t "shows loading"`

**C36** - Com `GET /products` (mock) devolvendo `items: []`, `/products` mostra "Nenhum produto cadastrado" (AC 34, vazio)
Proof: `npm --prefix web run test -- 'src/app/(app)/products/page.test.tsx' -t "shows the empty state"`

**C37** - Com `GET /products` (mock) rejeitando, `/products` mostra a mensagem com `role="alert"` e o botão "Tentar novamente", que refaz a busca (AC 34, erro)
Proof: `npm --prefix web run test -- 'src/app/(app)/products/page.test.tsx' -t "shows the error with retry"`

**C38** - Lista com três produtos (`commercialUseAllowed` `false`, `null` e `true`). A linha do primeiro mostra "Licença não permite uso comercial", a do segundo "Licença não informada", e a do terceiro nenhum dos dois textos (AC 11, 12, tela `/products`)
Proof: `npm --prefix web run test -- 'src/app/(app)/products/page.test.tsx' -t "shows the license notice for each commercial-use state"`

**C39** - Tabela por papel na tela `/products`: `admin` vê o botão "Novo produto" e as ações de editar/desativar, e `production` e `sales` veem a lista sem nenhum desses botões (3 casos) (AC 32)
Proof: `npm --prefix web run test -- 'src/app/(app)/products/page.test.tsx' -t "only admin sees create and edit actions"`

**C40** - O formulário de produto de `/products`, com `POST /products` (mock) rejeitando `400` com a mensagem do AC 5, mostra a mensagem com `role="alert"` e mantém os campos preenchidos. Num sucesso, envia só os campos declarados no `Surface` (AC 5, 7, erro ao salvar)
Proof: `npm --prefix web run test -- 'src/app/(app)/products/page.test.tsx' -t "product form keeps values and shows the api error"`

**C41** - `/products/[id]` mostra o indicador de carregamento do produto antes de `GET /products/:id` (mock) resolver (tela do detalhe, carregando)
Proof: `npm --prefix web run test -- 'src/app/(app)/products/[id]/page.test.tsx' -t "shows loading"`

**C42** - Com `GET /products/:id` (mock) resolvido e `GET /products/:id/pricing` pendente, cada variação mostra um indicador de carregamento na área de custo, e os dados do produto já aparecem (AC 26)
Proof: `npm --prefix web run test -- 'src/app/(app)/products/[id]/page.test.tsx' -t "shows a loading indicator per variant while pricing is pending"`

**C43** - Com `GET /products/:id/pricing` (mock) rejeitando, o detalhe mostra a mensagem com `role="alert"` e "Tentar novamente", que refaz só a busca de preço, e mantém nome, URL do modelo e variações visíveis (AC 27)
Proof: `npm --prefix web run test -- 'src/app/(app)/products/[id]/page.test.tsx' -t "keeps the product visible when pricing fails and retries pricing"`

**C44** - Com `GET /products/:id/pricing` (mock) devolvendo "Laranja" com `pricing` e "Preto" com `error: "Material sem custo médio disponível: PLA · Bambu · Preto"`:
- "Preto" mostra essa mensagem no lugar do custo
- "Laranja" mostra o custo com risco e o preço por canal formatados (`R$`)

(AC 28, 22)
Proof: `npm --prefix web run test -- 'src/app/(app)/products/[id]/page.test.tsx' -t "shows a per-variant error beside the other variants' prices"`

**C45** - Com `GET /products/:id` (mock) devolvendo `variants: []`, o detalhe mostra "Nenhuma variação cadastrada" (AC 29)
Proof: `npm --prefix web run test -- 'src/app/(app)/products/[id]/page.test.tsx' -t "shows the empty variants state"`

**C46** - Com `GET /products/:id` (mock) rejeitando `404`, o detalhe mostra "Produto não encontrado" com `role="alert"` (tela do detalhe, erro)
Proof: `npm --prefix web run test -- 'src/app/(app)/products/[id]/page.test.tsx' -t "shows the not found error"`

**C47** - Tabela por papel no detalhe:
- `admin` vê "Nova variação", "Editar" e "Desativar"
- `production` e `sales` veem as variações e o custo sem nenhum desses botões
- "Desativar" abre o `ConfirmDialog` antes de chamar `PATCH`

(3 casos) (AC 32, 11, ação destrutiva)
Proof: `npm --prefix web run test -- 'src/app/(app)/products/[id]/page.test.tsx' -t "only admin sees variant actions and deactivation confirms"`

**C48** - Produto do MakerWorld: o editor de variação mostra a importação de perfil com o campo de URL preenchido com `https://makerworld.com/models/3007827`. Importar o fixture da Fase 2 (mock de `POST /print-profiles/import`, perfil "Sea star") preenche as horas de impressão com `0.47` (1707 s ÷ 3600, duas casas) e duas linhas de material com `8` e `1` gramas, com o seletor de material vazio (AC 19)
Proof: `npm --prefix web run test -- src/components/product-variant-editor.test.tsx -t "prefills the tech sheet from the product's MakerWorld profile"`

**C49** - Produto do Printables: o editor de variação não mostra a importação de perfil, e permite adicionar linhas de material e insumo manualmente (AC 20)
Proof: `npm --prefix web run test -- src/components/product-variant-editor.test.tsx -t "offers only manual entry for non-MakerWorld products"`

**C50** - No editor de variação, material, insumo e impressora são `<select>` com as opções do cadastro, e não existe nenhum campo com rótulo de custo. O corpo enviado a `POST /products/:id/variants` (mock) contém só ids, gramas, quantidades e horas (AC 21)
Proof: `npm --prefix web run test -- src/components/product-variant-editor.test.tsx -t "uses registry selectors and never a cost field"`

**C51** - Com `POST /products/:id/variants` (mock) rejeitando `409`, o editor mostra a mensagem com `role="alert"` e mantém a ficha preenchida (erro ao salvar)
Proof: `npm --prefix web run test -- src/components/product-variant-editor.test.tsx -t "keeps the sheet and shows the api error on save failure"`

**C52** - O menu tem o item "Catálogo" com `href="/products"` para `admin`, `production` e `sales`. As listas exatas por papel em `app-shell.test.tsx` passam a incluí-lo, sem remover nenhum item existente (AC 33)
Proof: `npm --prefix web run test -- src/components/app-shell.test.tsx -t "Catálogo"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /products` statuses (3) | 200 C10 · 400 C11 · 401 C34 | - |
| `POST /products` statuses (5) | 201 C1 · 400 C3 · 401 C34 · 403 C33 · 409 C5 | - |
| `GET /products/:id` statuses (4) | 200 C8 · 400 C9 · 401 C34 · 404 C9 | - |
| `PATCH /products/:id` statuses (6) | 200 C8 · 400 C9 · 401 C34 · 403 C33 · 404 C9 · 409 C6 | - |
| `POST /products/:id/variants` statuses (6) | 201 C13 · 400 C14 · 401 C34 · 403 C33 · 404 C15 · 409 C16 | - |
| `PATCH /products/:id/variants/:variantId` statuses (6) | 200 C17 · 400 C14 · 401 C34 · 403 C33 · 404 C19 · 409 C16 | - |
| `GET /products/:id/pricing` statuses (4) | 200 C26 · 400 C30 · 401 C34 · 404 C30 | - |
| plataformas aceitas (3) | `makerworld` C2 · `printables` C2 · `thingiverse` C2 | - |
| ramos de `parseModelUrl` (8) | C4, table-driven over all 8 | - |
| URL recusada na rota (4) | host C3 · `http` C3 · sem id C3 · ausente C3 | - |
| limites do produto (4) | `name` 0/150/151 C7 · `description` 2000/2001 C7 · `modelImageUrl` http C7 · propriedade extra C7 | - |
| limites da variação, 8 que disparam e 3 que não disparam (11) | C14, table-driven over all 11 | - |
| entidade inexistente na variação (4) | produto C15 · impressora C15 · material C15 · insumo C15 | - |
| listas substituídas no PATCH (3) | `materials` C17 · `supplies` C17 · nenhuma C17 | - |
| door 1 - `QuotePreviewService` exportado e consumido (1) | C26 (a rota só responde passando pelo `PricingModule` real) | - |
| door 2 - resposta por variação (2 lados) | sucesso C26 · erro isolado C28 | - |
| door 3 - identidade do modelo (4) | canônica C2 · único na rota C5 · único no banco C22 · enum fechado C25 | - |
| door 4 - ficha (4) | único na rota C16 · único no banco C23 · FK `RESTRICT` C24 · sem DELETE (desativar) C21 | - |
| door 5 - licença tri-estado (3) | `null` padrão C1, C25 · `false` com aviso C38 · `true` sem aviso C38 | - |
| entidade `Product` (1) | C1 | - |
| entidade `ProductVariant` (1) | C13 | - |
| entidade `ProductVariantMaterial` (1) | C13, C17 | - |
| entidade `ProductVariantSupply` (1) | C13, C17 | - |
| ramos do serviço de preço do produto (4) | inativa C31 · DTO C31 · `HttpException` C31 · outro erro C31 | - |
| papéis na leitura (3) | `admin` C26 · `production` C32 · `sales` C32 | - |
| papéis na escrita (3) | `admin` C33 · `production` C33 · `sales` C33 | - |
| estados da tela `/products` (4) | carregando C35 · vazio C36 · erro C37 · por papel C39 | - |
| estados da tela `/products/[id]` (6) | carregando C41 · custo carregando C42 · erro de custo C43 · erro por variação C44 · vazio C45 · erro do produto C46 | - |
| o que cada papel vê no detalhe (3) | `admin` C47 · `production` C47 · `sales` C47 | - |
| origem da ficha no editor (2) | MakerWorld C48 · manual C49 | - |
| avisos de licença na tela (3) | `false` C38 · `null` C38 · `true` C38 | - |

- Claims que citam status, rota ou formato de resposta: C1-C3, C5-C11, C13-C19, C21, C26-C30,
  e de C32 a C34. Cada uma tem prova e2e que cruza a fronteira HTTP contra o `AppModule` real
- A prova de cada arquivo que decide (C4, C12, C20, C31) complementa o e2e e não o substitui
- O aviso de licença no detalhe (AC 11, 12) usa o mesmo componente da lista. Isso é placement, e
  C38 prova a decisão na lista. Se o detalhe renderizar o aviso por outro caminho, o builder
  acrescenta a prova no detalhe antes do commit

## Swept

- validation: C3, C4, C7, C14 - URL, limites do produto e da variação, dos dois lados
- failure modes: C28, C31, C43, C44 - falha de uma variação isolada na API e na tela; falha total do preço sem esconder o produto
- idempotency, retry, duplicates: C5, C16 - repetir a criação de um produto ou variação responde `409` e não duplica
- authorization: C32, C33, C34 - leitura para os três papéis, escrita só de admin, sessão obrigatória
- concurrency and ordering: C18 - duas criações simultâneas do mesmo modelo; o índice único é o mecanismo. A substituição das listas da ficha roda numa transação só (C20)
- data lifecycle: C8, C21, C24 - nada é apagado, só desativado; o banco recusa apagar cadastro referenciado por ficha
- external-dependency failure: n/a - esta fase não faz chamada de saída; a importação de perfil reusa `PrintProfileImport` e `POST /print-profiles/import` da Fase 2 sem alteração, e os erros 502 de lá já estão provados
- state transitions: C8, C21, C29 - `active` true -> false -> true no produto, false na variação, e variação inativa fora do preço
- observability: n/a - nenhum AC pede log ou métrica; mesma decisão das Fases 9-12

## Handoff

Estimativa por analogia com os arquivos equivalentes medidos com `wc -c`:
- `materials` somou ~14 KB de módulo
- `quote-preview.service.ts` + spec, ~12,5 KB
- `materials.e2e-spec.ts`, ~15 KB
- `pricing-quote-preview.e2e-spec.ts`, ~14,7 KB
- `materials/page.tsx` + teste, ~25,8 KB
- `pricing/page.tsx`, ~20 KB
- `app-shell` + teste, ~19,5 KB

| Slice | O que entra | Estimativa |
| --- | --- | --- |
| S1 | módulo `products` (module, controller, service + spec, types, 4 entidades, ~6 DTOs), `model-url.ts` + spec, migration, `test/products-helper.ts`, parte de `test/products.e2e-spec.ts`, `pricing.module.ts` (export) | ~60 KB, ~15k |
| S2 | serviço e DTOs de variação, restante de `products.e2e-spec.ts` | ~40 KB, ~10k |
| S3 | `test/products-schema.e2e-spec.ts` | ~10 KB, ~3k |
| S4 | `product-pricing.service.ts` + spec, `test/products-pricing.e2e-spec.ts`; lê `quote-preview.service.ts` (7 KB) | ~30 KB, ~8k |
| S5 | `web/src/lib/products.ts`, `(app)/products/page.tsx` + teste, `(app)/products/[id]/page.tsx` + teste, `components/product-variant-editor.tsx` + teste, `app-shell.tsx` + teste (19,5 KB), leitura de `print-profile-import.tsx`, `ROADMAP.md` | ~90 KB, ~23k |

- Total: ~230 KB ÷ 4 ≈ 59k tokens, abaixo do orçamento padrão de 150k. Um builder só, sem pergunta de mecanismo
- Mecanismo: um builder (estimativa dentro do orçamento)
- Progresso: C1-C34 (API) fechados no commit `feat(products)`; C35-C52 (web) no commit `feat(web)`
- Extração de placement prevista: o quadro de custo inline de `pricing/page.tsx` (`COST_ROWS` + JSX) pode virar um componente compartilhado para o detalhe do produto. A prova de `/pricing` (Fase 12) segue valendo sem mudança de asserção
- `ROADMAP.md`: marcar as tarefas da Fase 13 e o status ✅ ao fechar, e preencher a linha `products` da matriz de permissões (`x` / leitura / leitura)
- Validação final com o Playwright MCP (`AGENTS.md`):
  - como `admin`, criar produto pela URL do MakerWorld com `/pt/` e `?from=recommend`, criar uma variação importada do perfil e outra manual, e ver o custo
  - dar entrada num rolo mais caro e reabrir o produto, vendo o custo subir
  - marcar a licença como não comercial e ver o aviso
  - URL fora das três plataformas mostrando o erro
  - estados de carregamento, erro e vazio
  - como `sales`, ver sem botões de edição
