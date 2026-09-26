# Fase 13 — Catálogo e ficha técnica verification — histórico

Preservado sem edição de conteúdo (só rebaixado de nível de cabeçalho). Nenhuma célula aqui conta
para o veredito vigente, que está em `.specs/features/phase-13-catalog/verification.md`.

## Round 1 - full (c614ed6) - FAIL

### Fase 13 — Catálogo e ficha técnica verification

**Verdict**: FAIL
**Profile**: light
**Diff range**: `4c568a4..HEAD` (HEAD = `c614ed6`)
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

Commits no range: `76cf572` (feat(products): add the product catalog with tech sheets and live
pricing), `c614ed6` (feat(web): add the product catalog, detail and variant editor screens). Árvore
real antes e depois da verificação: `git status --porcelain` = `?? package-lock.json` (arquivo na
raiz, pré-existente, não tocado).

51 de 52 checks provados com evidência localizada. C31 falha: a afirmação (d) cobre "qualquer erro
que não é `HttpException`", foi provada com um único `Error` genérico, e o código trata um membro
dessa classe (`PricingError`) de forma oposta à afirmação — isola em vez de relançar — sem prova em
nível nenhum.

### Binding sources

Não roda sob `light` (passo 1 é só do perfil `ui`); o plano não marca fonte binding além de
`ROADMAP.md` Fase 13 e `CONTEXT.md`. Pelo mesmo perfil, recomputação de `Coverage`, veredito de
`Test policy` e injeção de falhas também não rodam.

### Checks

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `POST /products` 201, `active: true`, `variants: []`, `makerworld`, `commercialUseAllowed: null`, `modelMetadataFetchedAt: null` | e2e batch (3 arquivos) exit 0, teste "creates a product with the detected platform and no variants" ✓ | `api/test/products.e2e-spec.ts:119` `expect(response.status).toBe(201)`; `:120-128` `toMatchObject({ active: true, variants: [], modelPlatform: 'makerworld', commercialUseAllowed: null, modelMetadataFetchedAt: null, ... })` | PASS |
| C2 | 3 URLs -> plataforma + URL canônica exatas | e2e batch, "stores the canonical url for each platform" ✓ | `api/test/products.e2e-spec.ts:151-153` por caso: `toBe(201)`, `expect(response.body.modelPlatform).toBe(item.platform)`, `expect(response.body.modelUrl).toBe(item.canonical)`; literais em `:133-147` | PASS |
| C3 | host, `http`, sem id, ausente -> 400; 3 primeiros com a mensagem do AC 5 | e2e batch, "rejects a model url outside the three platforms" ✓ | `api/test/products.e2e-spec.ts:165-166` `toBe(400)` e `toEqual({ error: INVALID_URL })` (literal em `:15`); ausente `:169` `expect(missing.status).toBe(400)` | PASS |
| C4 | `parseModelUrl`, um caso por ramo (8) | `npm --prefix api run test -- src/modules/products` exit 0, 9 casos `parseModelUrl > ...` ✓ | `api/src/modules/products/model-url.spec.ts:30` `expect(parseModelUrl(input)).toEqual(expected)` (4 aceitos, literais `:9-28`); `:46-47` `toBeInstanceOf(BadRequestException)` e `.message).toBe(INVALID)` (5 recusados: host, `http:`, sem id, porta, credencial) | PASS |
| C5 | segundo produto do mesmo modelo (outro slug, `/pt/`) -> 409 com mensagem | e2e batch, "rejects a second product for the same model with 409" ✓ | `api/test/products.e2e-spec.ts:181` `toBe(409)`; `:182` `toEqual({ error: DUPLICATE_MODEL })` | PASS |
| C6 | `PATCH` para o modelo de outro produto -> 409 | e2e batch, "rejects a patch that points to another product's model with 409" ✓ | `api/test/products.e2e-spec.ts:189` `toBe(409)`; `:190` `toEqual({ error: DUPLICATE_MODEL })` | PASS |
| C7 | 5 recusados 400 `{ error }`; `name` 150 e `description` 2000 -> 201 | e2e batch, "validates product field bounds on both sides" ✓ | `api/test/products.e2e-spec.ts:209-210` `toBe(400)` e `typeof errorOf(response)).toBe('string')` por caso; `:213` `name150.status).toBe(201)`; `:219` `description2000.status).toBe(201)` | PASS |
| C8 | desativa 200 `active: false`, GET ainda traz produto e variações, reativa | e2e batch, "deactivates and reactivates a product without deleting it" ✓ | `api/test/products.e2e-spec.ts:229-230` `toBe(200)`, `active).toBe(false)`; `:233-235` GET 200, `active` false, `variants.length).toBe(1)`; `:238-239` reativa `active).toBe(true)` | PASS |
| C9 | GET/PATCH `not-a-uuid` 400; UUID inexistente 404 com mensagem | e2e batch, "returns 400 for a malformed id and 404 for an unknown product" ✓ | `api/test/products.e2e-spec.ts:243-244` `toBe(400)` x2; `:246-247` e `:249-250` `toBe(404)` e `toEqual({ error: PRODUCT_NOT_FOUND })` | PASS |
| C10 | `search=SEA` só pelo `modelTitle`, `search=espiral`, envelope `{ total: 1, page: 1, pageSize: 20 }` | e2e batch, "searches name and model title case-insensitively with the AD-020 envelope" ✓ | `api/test/products.e2e-spec.ts:259` `toEqual(['Estrela do mar'])`; `:260` `toMatchObject({ total: 1, page: 1, pageSize: 20 })`; `:264-265` idem para `['Vaso espiral']` | PASS |
| C11 | `platform=printables` só Printables; `pageSize` 101 -> 400, 100 -> 200 | e2e batch, "filters by platform and bounds pageSize" ✓ | `api/test/products.e2e-spec.ts:279` `toEqual(['Vaso espiral'])`; `:281` `toBe(400)`; `:282` `toBe(200)` | PASS |
| C12 | `create`/`update` traduzem 23505 em 409, relançam o resto | unit exit 0, 3 testes sob "maps a unique violation ..." ✓ | `api/src/modules/products/products.service.spec.ts:41-42` e `:48-49` `rejects.toBeInstanceOf(ConflictException)` e `rejects.toThrow('Já existe um produto para este modelo')`; `:55-58` `rejects.toBe(other)` em create e update | PASS |
| C13 | variação 201, `active: true`, ficha exata e nomes resolvidos | e2e batch, "creates a variant with its tech sheet and resolved names" ✓ | `api/test/products.e2e-spec.ts:291` `toBe(201)`; `:292-303` `toMatchObject({ active: true, printer: { name: 'Bambu P1S QA' }, printHours: 0.47, prepHours: 0.25, slicingHours: 0.1, postProcessingHours: 0, materials: [{ name: 'PLA · Marca de teste · Natural', grams: 8 }], supplies: [{ name: 'Argola de chaveiro', quantity: 2 }] })` | PASS |
| C14 | 8 recusados 400; `printHours: 0`, 32 materiais, 50 insumos -> 201 | e2e batch, "validates variant bounds on both sides" ✓ | `api/test/products.e2e-spec.ts:323-324` `toBe(400)` e `{ error }` string por caso (8 casos `:311-320`); `:339` `toBe(201)` por caso aceito (3 casos `:326-336`) | PASS |
| C15 | 404 citando produto, impressora, material, insumo | e2e batch, "returns 404 naming the unknown product, printer, material or stock item" ✓ | `api/test/products.e2e-spec.ts:349` `toEqual({ error: 'Produto não encontrado' })`; `:353` `` `Impressora ${UNKNOWN_ID} não encontrada` ``; `:357` `` `Material ${UNKNOWN_ID} não encontrado` ``; `:364` `` `Insumo ${UNKNOWN_ID} não encontrado` ``; status 404 em `:348/:352/:356/:363` | PASS |
| C16 | `laranja` em A -> 409; `Laranja` em B -> 201; rename para `LARANJA` -> 409 | e2e batch, "enforces case-insensitive variant name uniqueness within a product only" ✓ | `api/test/products.e2e-spec.ts:374-375` `toBe(409)`, `toEqual({ error: DUPLICATE_VARIANT })`; `:377` `toBe(201)`; `:381-382` `toBe(409)`, mesma mensagem | PASS |
| C17 | PATCH substitui só a lista enviada | e2e batch, "replaces only the lists sent in a variant patch" ✓ | `api/test/products.e2e-spec.ts:404-409` materiais = 1 linha nova, insumos intactos; `:413-416` `supplies).toEqual([])` e material mantido; `:420-424` só `name`, listas inalteradas | PASS |
| C18 | duas criações simultâneas -> uma 201 e uma 409, uma linha | e2e batch, "two concurrent creates of the same model yield one 201 and one 409" ✓ | `api/test/products.e2e-spec.ts:430` `toEqual([201, 409])`; `:434` `rows[0].n).toBe('1')`. `create` não tem pré-checagem (`products.service.ts:93-112`), então o índice é o único mecanismo | PASS |
| C19 | variação de outro produto e `variantId` inexistente -> 404 | e2e batch, "returns 404 for a variant outside the product" ✓ | `api/test/products.e2e-spec.ts:448-449` e `:452-453` `toBe(404)` e `toEqual({ error: VARIANT_NOT_FOUND })` | PASS |
| C20 | posse da variação e substituição de listas na transação | unit, 3 testes sob "variant ownership and list replacement" ✓ | `api/src/modules/products/products.service.spec.ts:136-137` `rejects.toBeInstanceOf(NotFoundException)`, `toThrow('Variação não encontrada')`; `:143-146` sem delete/save; `:152-156` `transactions).toBe(1)`, `materialDeletes).toEqual([{ variantId }])`, `supplyDeletes).toEqual([])` | PASS |
| C21 | variação `active: false` 200 e continua no GET | e2e batch, "deactivates a variant without deleting it" ✓ | `api/test/products.e2e-spec.ts:463-464` `toBe(200)`, `active).toBe(false)`; `:467` `variants).toEqual([expect.objectContaining({ id: variantId, active: false })])` | PASS |
| C22 | índice único do modelo: mesma plataforma+id 23505, outra plataforma aceita | e2e batch, "unique model index rejects the same platform and id only" ✓ | `api/test/products-schema.e2e-spec.ts:61` `toBe('23505')`; `:62` `toBeNull()` | PASS |
| C23 | `Azul`/`AZUL` no mesmo produto 23505; em produtos diferentes aceito | e2e batch, "unique variant name index is case-insensitive and per product" ✓ | `api/test/products-schema.e2e-spec.ts:70` `toBe('23505')`; `:71` `toBeNull()` | PASS |
| C24 | DELETE de material, insumo, impressora referenciados 23503; não referenciado passa | e2e batch, "tech sheet foreign keys restrict deleting referenced registries" ✓ | `api/test/products-schema.e2e-spec.ts:93-95` `toBe('23503')` por tabela (3 casos `:87-91`); `:97` `toBeNull()` | PASS |
| C25 | `commercial_use_allowed` padrão NULL; `cults3d` 22P02 | e2e batch, "commercial use defaults to null and platform is a closed enum" ✓ | `api/test/products-schema.e2e-spec.ts:105` `commercial_use_allowed).toBeNull()`; `:106` `toBe('22P02')` | PASS |
| C26 | pricing 200: `error: null`, `quantity: 1`, `materialCents: 550`, `laborCents: 3000`, só canal ativo | e2e batch, "prices each active variant with quantity 1, active channels and the settings labor rate" ✓ | `api/test/products-pricing.e2e-spec.ts:98` `toBe(200)`; `:104-107` `error).toBeNull()`, `quantity).toBe(1)`, `materialCents).toBe(550)`, `laborCents).toBe(3000)`; `:109-110` `toContain('Balcão QA')`, `not.toContain('Inativo QA')` | PASS |
| C27 | rolo novo -> `materialCents: 867`, produto e ficha intactos | e2e batch, "reflects a new roll's average cost without writing to the product" ✓ | `api/test/products-pricing.e2e-spec.ts:131` `materialCents).toBe(867)`; `:132` `expect(await snapshot()).toEqual(stored)` (`updated_at` + linhas da ficha, `:118-125`) | PASS |
| C28 | "Preto" `pricing: null` + mensagem; "Laranja" com preço | e2e batch, "isolates one variant's failure from the others" ✓ | `api/test/products-pricing.e2e-spec.ts:151-152` `toBeNull()`, `toBe('Material sem custo médio disponível: PLA · Marca de teste · Preto')`; `:153-154` `error).toBeNull()`, `materialCents).toBe(550)` | PASS |
| C29 | sem variação e só inativa -> 200 `{ variants: [] }` | e2e batch, "returns an empty list when no variant is active" ✓ | `api/test/products-pricing.e2e-spec.ts:160-161` e `:166-167` `toBe(200)`, `toEqual({ variants: [] })` | PASS |
| C30 | pricing `not-a-uuid` 400; inexistente 404 | e2e batch, "returns 400 for a malformed id and 404 for an unknown product" (pricing) ✓ | `api/test/products-pricing.e2e-spec.ts:171` `toBe(400)`; `:173-174` `toBe(404)`, `toEqual({ error: 'Produto não encontrado' })` | PASS |
| C31 | (a) inativa sem `preview`; (b) DTO; (c) `HttpException` -> `{ pricing: null, error }`; (d) erro que não é `HttpException` é relançado | unit, 4 testes `ProductPricingService > (a)..(d)` ✓ | (a) `api/src/modules/products/product-pricing.service.spec.ts:62` `calls).toHaveLength(1)`; (b) `:69-79` `calls).toEqual([{ ..., quantity: 1, channelIds: [ACTIVE_CHANNEL], labor: { ..., centsPerHour: 3000 } }])` e `:80` `'minimumOrderCents' in calls[0]).toBe(false)`; (c) `:88-97` `error: 'x'` / `error: 'y'`; (d) `:104` `rejects.toBe(defect)` com `new Error('boom')` apenas. **Gap**: `api/src/modules/products/product-pricing.service.ts:61` `if (error instanceof HttpException \|\| error instanceof PricingError)` — `PricingError` (`pricing/pricing.error.ts:3`, `extends Error`, não `HttpException`) é isolado, contrariando (d) como escrito; esse ramo (AC 24 "regra do pricing", ex. canal com margem+taxas >= 100%) não tem prova no spec nem em e2e (`grep PricingError` em `api/src/modules/products/*.spec.ts` e `api/test/products*.ts`: nenhuma ocorrência) | FAIL - sampling + precision gap |
| C32 | `production` e `sales` 200 nas 3 rotas de leitura | e2e batch, "production and sales read the catalog and its pricing" ✓ | `api/test/products.e2e-spec.ts:478` `expect(response.status, route).toBe(200)` em loop 2 papéis × 3 rotas (`:474-476`); lado `admin` em C10/C8/C26 | PASS |
| C33 | escrita: `production`/`sales` 403 com mensagem, `admin` 201/200 | e2e batch, "only admin writes to the catalog" ✓ | `api/test/products.e2e-spec.ts:501-502` `toBe(403)`, `toEqual(PERMISSION_DENIED)` por rota × papel (4 × 2); `:506-509` admin `201`/`200`/`201`/`200` | PASS |
| C34 | 7 rotas sem sessão -> 401 | e2e batch, "every products route is 401 without a session" ✓ | `api/test/products.e2e-spec.ts:524` `expect(response.status).toBe(401)` sobre as 7 requisições `:514-522` | PASS |
| C35 | `/products` carregando | web batch exit 0, `Products page > shows loading` ✓ | `web/src/app/(app)/products/page.test.tsx:74` `getByText("Carregando…")).toBeTruthy()` síncrono após `render`, antes de `resolveProducts`; `:77` some depois | PASS |
| C36 | vazio "Nenhum produto cadastrado" | web, `shows the empty state` ✓ | `web/src/app/(app)/products/page.test.tsx:86` `findByText("Nenhum produto cadastrado")).toBeTruthy()` | PASS |
| C37 | erro com `role="alert"` e "Tentar novamente" que refaz a busca | web, `shows the error with retry` ✓ | `web/src/app/(app)/products/page.test.tsx:96-97` `findByRole("alert")`, `textContent).toBe("Não foi possível conectar à API")`; `:101` `callsTo(... "/products?pageSize=100")).toHaveLength(2)` | PASS |
| C38 | aviso de licença por estado `false`/`null`/`true` | web, `shows the license notice for each commercial-use state` ✓ | `web/src/app/(app)/products/page.test.tsx:123-124` (false), `:127-128` (null), `:131-132` (true, nenhum dos dois textos), todos `within(row)` | PASS |
| C39 | só `admin` vê "Novo produto", "Editar", "Desativar" (3 papéis) | web, `only admin sees create and edit actions` ✓ | `web/src/app/(app)/products/page.test.tsx:144-146` `Boolean(queryByRole("button", ...))).toBe(isAdmin)` por papel (loop `:136`) | PASS |
| C40 | form: 400 mostra alerta e mantém campos; sucesso envia só campos do Surface | web, `product form keeps values and shows the api error` ✓ | `web/src/app/(app)/products/page.test.tsx:166` `alert.textContent).toBe(INVALID_URL)`; `:167-168` valores mantidos; `:181-190` `body).toEqual({ name, modelUrl, description, modelTitle, modelImageUrl, modelDesigner, modelLicense, commercialUseAllowed: false })` | PASS |
| C41 | detalhe carregando | web, `Product detail page > shows loading` ✓ | `web/src/app/(app)/products/[id]/page.test.tsx:128-130` após o fetch do produto sair: `getByText("Carregando…")).toBeTruthy()`, `queryByText("Estrela do mar")).toBeNull()` | PASS |
| C42 | custo pendente: indicador por variação, produto já visível | web, `shows a loading indicator per variant while pricing is pending` ✓ | `web/src/app/(app)/products/[id]/page.test.tsx:143` URL do modelo visível; `:144-145` `within(variantCard(...)).getByText("Calculando custo…")` para Laranja e Preto | PASS |
| C43 | preço falha: alerta, retry refaz só o preço, produto visível | web, `keeps the product visible when pricing fails and retries pricing` ✓ | `web/src/app/(app)/products/[id]/page.test.tsx:157` `alert.textContent).toBe("Internal server error")`; `:158-160` nome, URL, variação visíveis; `:165-166` pricing chamado 2x, produto 1x | PASS |
| C44 | erro por variação no lugar do custo; outra mostra custo com risco e preço por canal (`R$`) | web, `shows a per-variant error beside the other variants' prices` ✓ | `web/src/app/(app)/products/[id]/page.test.tsx:184-185` erro em Preto, sem "Custo com risco"; `:188-190` `getByText("R$ 39.05")`, `"Balcão"`, `"R$ 55.79"` em Laranja | PASS |
| C45 | "Nenhuma variação cadastrada" | web, `shows the empty variants state` ✓ | `web/src/app/(app)/products/[id]/page.test.tsx:201` `findByText("Nenhuma variação cadastrada")).toBeTruthy()` | PASS |
| C46 | 404 -> "Produto não encontrado" com `role="alert"` | web, `shows the not found error` ✓ | `web/src/app/(app)/products/[id]/page.test.tsx:211-212` `findByRole("alert")`, `textContent).toBe("Produto não encontrado")` | PASS |
| C47 | por papel no detalhe; "Desativar" abre `ConfirmDialog` antes do PATCH | web, `only admin sees variant actions and deactivation confirms` ✓ | `web/src/app/(app)/products/[id]/page.test.tsx:234-236` `queryByRole(... "Nova variação"/"Editar"/"Desativar")).toBeNull()` para production e sales; `:249-254` admin vê "Nova variação" e "Editar"; `:257-258` `getByRole("dialog")` e PATCH chamado 0x; `:260` `patched).toEqual({ active: false })` após confirmar | PASS |
| C48 | MakerWorld: URL preenchida, import dá `0.47` h e gramas `8`/`1`, material vazio | web, `prefills the tech sheet from the product's MakerWorld profile` ✓ | `web/src/components/product-variant-editor.test.tsx:110` `toBe("https://makerworld.com/models/3007827")`; `:118` `"Horas de impressão")).toBe("0.47")`; `:119-120` `"8"`, `"1"`; `:121-122` `"Material 1"/"Material 2")).toBe("")` | PASS |
| C49 | não MakerWorld: sem import, linhas manuais | web, `offers only manual entry for non-MakerWorld products` ✓ | `web/src/components/product-variant-editor.test.tsx:131-132` `queryByLabelText("URL do MakerWorld")).toBeNull()`, botão "Importar" ausente; `:135-136` "Material 1" e "Insumo 1" presentes | PASS |
| C50 | `<select>` do cadastro, nenhum campo de custo, corpo só ids/gramas/quantidades/horas | web, `uses registry selectors and never a cost field` ✓ | `web/src/components/product-variant-editor.test.tsx:153` `tagName).toBe("SELECT")` x3; `:155-157` opções do cadastro; `:158` `queryByLabelText(/custo/i)).toBeNull()`; `:162-171` `sent).toEqual({ name, printerId, printHours, prepHours, slicingHours, postProcessingHours, materials: [{ materialId, grams }], supplies: [{ stockItemId, quantity }] })` | PASS |
| C51 | 409 no save: alerta e ficha mantida | web, `keeps the sheet and shows the api error on save failure` ✓ | `web/src/components/product-variant-editor.test.tsx:186` `textContent).toBe("Já existe uma variação com este nome neste produto")`; `:188-192` nome, horas, material, gramas, insumo mantidos | PASS |
| C52 | "Catálogo" `href="/products"` para os 3 papéis; listas exatas por papel incluem o item sem remover nenhum | web, `AppShell > Catálogo appears for every role and links to /products` ✓ (+ arquivo inteiro no batch) | `web/src/components/app-shell.test.tsx:139-140` `getByRole("link", { name: "Catálogo" })`, `getAttribute("href")).toBe("/products")` por papel (loop `:132`); listas exatas `:66-81` (admin, textos) e `:83-99` (hrefs, `"/products"` em `:87`), `:110-123` (production/sales, `"Catálogo"` em `:114`). Nota: o `-t "Catálogo"` da Proof só seleciona `:131`; as listas exatas estão em testes com outros nomes, que rodaram no meu batch do arquivo inteiro | PASS |

Batches: API unit `npm --prefix api run test -- src/modules/products --reporter=verbose` — 3 arquivos,
19 passed (19), cada teste listado individualmente. API e2e `npm --prefix api run test:e2e --
test/products.e2e-spec.ts test/products-schema.e2e-spec.ts test/products-pricing.e2e-spec.ts
--reporter=verbose` — 3 arquivos, 30 passed (30). Web `npm --prefix web run test --
'src/app/(app)/products' src/components/product-variant-editor.test.tsx
src/components/app-shell.test.tsx --reporter=verbose` — 4 arquivos, 33 passed (33). Todos os 52
nomes de `-t` casam com um teste que rodou nessa saída verbosa (C12, C20 e C31 casam com um
`describe`, que rodou 3, 3 e 4 testes). Nenhum filtro caiu em zero. Todos os arquivos de prova
estão no diff `4c568a4..HEAD` (novos, exceto `app-shell.test.tsx`, alterado no range).

Nível: toda claim de status, rota ou formato (C1-C3, C5-C11, C13-C19, C21, C26-C30, C32-C34) tem
asserção num e2e `supertest` contra o `AppModule` real; nenhum level gap. C22-C25 afirmam direto
no banco (`dataSource.query`), como a política pede para invariante do banco. As telas afirmam no
componente renderizado com `fetch` stubado que lança em rota inesperada.

Outros pontos lidos, sem virar falha:
- C4 diz 8 ramos e o spec tem 9 casos (porta e credencial separados): amostra maior, não menor.
- C7 e C14 afirmam só `typeof error === 'string'` no lado recusado, que é exatamente o `{ error }`
  da claim.
- C28 e o e2e cobrem só "material sem custo médio"; "insumo sem custo médio" do AC 24 chega pela
  mesma `BadRequestException` e está coberto no nível do arquivo por C31 (c). O ramo que falta é o
  `PricingError` de C31.

### Swept

- validation (C3, C4, C7, C14): `api/src/modules/products/dto/create-product.dto.ts:12-13`
  `@IsNotEmpty()` `@Length(1, 150)` em `name`, `:18` `@MaxLength(2000)`, `:33` `@IsUrl({ protocols:
  ['https'] ...})`; `dto/create-product-variant.dto.ts:51-63` `@Min(0)` nas quatro horas, `:24`/`:33`
  `@IsPositive()`, `:67-68` `@ArrayMinSize(1)` `@ArrayMaxSize(MAX_MATERIAL_LINES)` (=32, `:37`),
  `:76` `@ArrayMaxSize(MAX_SUPPLY_LINES)` (=50, `:38`); `dto/list-products.dto.ts:25` `@Max(100)`;
  `model-url.ts:30` recusa protocolo, porta e credencial. Existe como citado.
- failure modes (C28, C31, C43, C44): `product-pricing.service.ts:55-65` isola por variação; o
  isolamento cobre `HttpException` **e** `PricingError` (`:61`), e só o primeiro tem prova — é o gap
  de C31.
- idempotency, retry, duplicates (C5, C16): migration `1790377409148-CreateProducts.ts:18`
  `UNIQUE INDEX products_model_identity_unique (model_platform, model_external_id)` e `:20`
  `UNIQUE INDEX product_variants_product_name_unique (product_id, lower(name))`;
  `products.service.ts:276` `isUniqueViolation(error) ? new ConflictException(message) : error`.
  Existe.
- authorization (C32-C34): `auth/auth.module.ts:22-23` `APP_GUARD` global para `AuthGuard` e
  `RolesGuard`; `products.controller.ts:28/:40/:51` `@Roles('production', 'sales')` só nas três
  leituras, escritas sem `@Roles()`. Existe.
- concurrency and ordering (C18, C20): índice único acima; `create` sem pré-checagem
  (`products.service.ts:93-112`); `updateVariant` numa `transaction` (`:179`), com delete+rewrite de
  materiais dentro dela (`:195-199`). Existe.
- data lifecycle (C8, C21, C24): nenhum `@Delete` em `products.controller.ts`; FKs `ON DELETE
  RESTRICT` para `stock_items`, `printers`, `materials` na migration `:24`, `:26`, `:28` (e `products`
  em `:25`). Existe.
- external-dependency failure: `n/a` — política aprovada; nada no diff faz chamada de saída
  (`print-profile-import.tsx` só teve 5 linhas mudadas para aceitar a URL inicial).
- state transitions (C8, C21, C29): `products.service.ts:134` e `:193` aplicam `active`;
  `product-pricing.service.ts:24` filtra `variant.active`. Existe.
- observability: `n/a` — política aprovada.

### Gate

```
npm --prefix api run lint        -> oxlint --type-aware src/ test/, exit 0, sem avisos
npm --prefix api run test        -> Test Files 30 passed (30) · Tests 128 passed (128)
npm --prefix api run build       -> nest build, exit 0
npm --prefix api run test:e2e    -> Test Files 27 passed (27) · Tests 375 passed (375), exit 0
npm --prefix web run lint        -> eslint, exit 0
npm --prefix web run test        -> Test Files 33 passed (33) · Tests 183 passed (183)
npm --prefix web run build       -> exit 0, rotas /products e /products/[id] geradas
```

O e2e completo passou de primeira; o vermelho intermitente conhecido (ex. `settings.e2e-spec.ts`)
não apareceu nesta rodada.

51/52 checks provados; 1 FAIL (C31).

**Ranked gaps**
1. C31 (d) — sampling + precision gap: a claim cobre todo erro que não é `HttpException`, a prova
   usa só `new Error('boom')` (`api/src/modules/products/product-pricing.service.spec.ts:104`), e o
   código isola `PricingError` em vez de relançar
   (`api/src/modules/products/product-pricing.service.ts:61`). O comportamento do código segue o
   AC 24 ("regra do pricing"), então o que falta é: corrigir a redação de C31 (d) para "um erro que
   não é `HttpException` nem `PricingError`", acrescentar um caso (e) em que `preview` rejeita com
   `PricingError("…")` e vira `{ pricing: null, error: "…" }`, e de preferência um e2e com um canal
   ativo de margem+taxas >= 100% mostrando a mensagem literal do `PricingError` na variação.
2. C52 (menor, não falha) — o `-t "Catálogo"` da Proof não seleciona os testes das listas exatas
   (`web/src/components/app-shell.test.tsx:58` e `:102`); a evidência existe e rodou, mas a Proof
   como escrita não a executa.
