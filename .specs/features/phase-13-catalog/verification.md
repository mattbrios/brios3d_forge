# Fase 13 — Catálogo e ficha técnica verification

**Verdict**: PASS
**Profile**: light
**Diff range**: `4c568a4..HEAD` (HEAD = `d0ccf1c`); fix da rodada 2 = `c614ed6..d0ccf1c`
**Round**: 2 - scoped
**Verifier**: independent sub-agent (author != verifier)

53 de 53 checks provados com evidência localizada. O único FAIL da rodada 1 (C31 (d), sampling +
precision gap sobre o ramo `PricingError`) está fechado: a claim foi renegociada com o usuário, o
ramo (e) tem prova no nível do arquivo e C53 prova o mesmo ramo na rota. Rodada 1 preservada em
`verification-history.md` ("## Round 1 - full (c614ed6) - FAIL").

Escopo (verify.md "Re-verifying after a fix"): o diff do fix toca só
`.specs/features/phase-13-catalog/checks.md`, `api/src/modules/products/product-pricing.service.spec.ts`
e `api/test/products-pricing.e2e-spec.ts` (`git diff c614ed6..HEAD --stat`: 3 arquivos, +38/-9;
nenhum arquivo de produção, fixture ou helper compartilhado). Todas as provas re-rodaram por inteiro
em `d0ccf1c`. C31 foi rejulgado nos cinco ramos, C53 julgado do zero, e as citações de C26-C30
(mesmo arquivo de e2e) foram refeitas. As demais linhas carregam a citação de `c614ed6`, marcadas
`carried from c614ed6`; os arquivos que elas citam não mudaram no fix.

Árvore real: `git status --porcelain` antes e depois = ` M .specs/LESSONS.md`, ` M .specs/lessons.json`
(lições da rodada 1), `?? .specs/features/phase-13-catalog/verification.md`, `?? package-lock.json`
(raiz, pré-existente). Esta rodada só escreveu `verification.md` e `verification-history.md`.

## checks.md renegociado — verified at d0ccf1c

`git diff c614ed6..HEAD -- .specs/features/phase-13-catalog/checks.md`: muda só C31 (4 -> 5 ramos;
(d) passa a excluir `PricingError`; (e) novo), acrescenta C53, a nota de renegociação, e atualiza
Intent (52 -> 53), as linhas de Coverage "door 2" (2 -> 3 lados, + C53) e "ramos do serviço de
preço" (4 -> 5), o Swept de failure modes (+ C53) e o Progresso. Nenhuma outra claim, Proof ou
número foi alterado; nenhum check ficou mais fraco. A mudança em (d) estreita a classe relançada
exatamente pelo membro que o código isola (`product-pricing.service.ts:61`), e o que saiu de (d)
entrou como afirmação positiva em (e) e C53, então o comportamento total afirmado aumentou. É
consistente com o AC 24 ("regra do pricing") citado na própria claim.

## Binding sources — carried from c614ed6

Não roda sob `light` (passo 1 é só do perfil `ui`); o plano não marca fonte binding além de
`ROADMAP.md` Fase 13 e `CONTEXT.md`. O fix não tocou interface nem tela. Pelo mesmo perfil,
recomputação de `Coverage`, veredito de `Test policy` e injeção de falhas não rodam.

## Checks — proofs verified at d0ccf1c; citations C26-C31, C53 verified at d0ccf1c, demais carried from c614ed6

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `POST /products` 201, `active: true`, `variants: []`, `makerworld`, `commercialUseAllowed: null`, `modelMetadataFetchedAt: null` | e2e batch (3 arquivos) exit 0, teste "creates a product with the detected platform and no variants" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:119` `expect(response.status).toBe(201)`; `:120-128` `toMatchObject({ active: true, variants: [], modelPlatform: 'makerworld', commercialUseAllowed: null, modelMetadataFetchedAt: null, ... })` _(citação carried from c614ed6)_ | PASS |
| C2 | 3 URLs -> plataforma + URL canônica exatas | e2e batch, "stores the canonical url for each platform" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:151-153` por caso: `toBe(201)`, `expect(response.body.modelPlatform).toBe(item.platform)`, `expect(response.body.modelUrl).toBe(item.canonical)`; literais em `:133-147` _(citação carried from c614ed6)_ | PASS |
| C3 | host, `http`, sem id, ausente -> 400; 3 primeiros com a mensagem do AC 5 | e2e batch, "rejects a model url outside the three platforms" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:165-166` `toBe(400)` e `toEqual({ error: INVALID_URL })` (literal em `:15`); ausente `:169` `expect(missing.status).toBe(400)` _(citação carried from c614ed6)_ | PASS |
| C4 | `parseModelUrl`, um caso por ramo (8) | `npm --prefix api run test -- src/modules/products` exit 0, 9 casos `parseModelUrl > ...` ✓ — re-run at `d0ccf1c` | `api/src/modules/products/model-url.spec.ts:30` `expect(parseModelUrl(input)).toEqual(expected)` (4 aceitos, literais `:9-28`); `:46-47` `toBeInstanceOf(BadRequestException)` e `.message).toBe(INVALID)` (5 recusados: host, `http:`, sem id, porta, credencial) _(citação carried from c614ed6)_ | PASS |
| C5 | segundo produto do mesmo modelo (outro slug, `/pt/`) -> 409 com mensagem | e2e batch, "rejects a second product for the same model with 409" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:181` `toBe(409)`; `:182` `toEqual({ error: DUPLICATE_MODEL })` _(citação carried from c614ed6)_ | PASS |
| C6 | `PATCH` para o modelo de outro produto -> 409 | e2e batch, "rejects a patch that points to another product's model with 409" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:189` `toBe(409)`; `:190` `toEqual({ error: DUPLICATE_MODEL })` _(citação carried from c614ed6)_ | PASS |
| C7 | 5 recusados 400 `{ error }`; `name` 150 e `description` 2000 -> 201 | e2e batch, "validates product field bounds on both sides" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:209-210` `toBe(400)` e `typeof errorOf(response)).toBe('string')` por caso; `:213` `name150.status).toBe(201)`; `:219` `description2000.status).toBe(201)` _(citação carried from c614ed6)_ | PASS |
| C8 | desativa 200 `active: false`, GET ainda traz produto e variações, reativa | e2e batch, "deactivates and reactivates a product without deleting it" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:229-230` `toBe(200)`, `active).toBe(false)`; `:233-235` GET 200, `active` false, `variants.length).toBe(1)`; `:238-239` reativa `active).toBe(true)` _(citação carried from c614ed6)_ | PASS |
| C9 | GET/PATCH `not-a-uuid` 400; UUID inexistente 404 com mensagem | e2e batch, "returns 400 for a malformed id and 404 for an unknown product" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:243-244` `toBe(400)` x2; `:246-247` e `:249-250` `toBe(404)` e `toEqual({ error: PRODUCT_NOT_FOUND })` _(citação carried from c614ed6)_ | PASS |
| C10 | `search=SEA` só pelo `modelTitle`, `search=espiral`, envelope `{ total: 1, page: 1, pageSize: 20 }` | e2e batch, "searches name and model title case-insensitively with the AD-020 envelope" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:259` `toEqual(['Estrela do mar'])`; `:260` `toMatchObject({ total: 1, page: 1, pageSize: 20 })`; `:264-265` idem para `['Vaso espiral']` _(citação carried from c614ed6)_ | PASS |
| C11 | `platform=printables` só Printables; `pageSize` 101 -> 400, 100 -> 200 | e2e batch, "filters by platform and bounds pageSize" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:279` `toEqual(['Vaso espiral'])`; `:281` `toBe(400)`; `:282` `toBe(200)` _(citação carried from c614ed6)_ | PASS |
| C12 | `create`/`update` traduzem 23505 em 409, relançam o resto | unit exit 0, 3 testes sob "maps a unique violation ..." ✓ — re-run at `d0ccf1c` | `api/src/modules/products/products.service.spec.ts:41-42` e `:48-49` `rejects.toBeInstanceOf(ConflictException)` e `rejects.toThrow('Já existe um produto para este modelo')`; `:55-58` `rejects.toBe(other)` em create e update _(citação carried from c614ed6)_ | PASS |
| C13 | variação 201, `active: true`, ficha exata e nomes resolvidos | e2e batch, "creates a variant with its tech sheet and resolved names" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:291` `toBe(201)`; `:292-303` `toMatchObject({ active: true, printer: { name: 'Bambu P1S QA' }, printHours: 0.47, prepHours: 0.25, slicingHours: 0.1, postProcessingHours: 0, materials: [{ name: 'PLA · Marca de teste · Natural', grams: 8 }], supplies: [{ name: 'Argola de chaveiro', quantity: 2 }] })` _(citação carried from c614ed6)_ | PASS |
| C14 | 8 recusados 400; `printHours: 0`, 32 materiais, 50 insumos -> 201 | e2e batch, "validates variant bounds on both sides" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:323-324` `toBe(400)` e `{ error }` string por caso (8 casos `:311-320`); `:339` `toBe(201)` por caso aceito (3 casos `:326-336`) _(citação carried from c614ed6)_ | PASS |
| C15 | 404 citando produto, impressora, material, insumo | e2e batch, "returns 404 naming the unknown product, printer, material or stock item" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:349` `toEqual({ error: 'Produto não encontrado' })`; `:353` `` `Impressora ${UNKNOWN_ID} não encontrada` ``; `:357` `` `Material ${UNKNOWN_ID} não encontrado` ``; `:364` `` `Insumo ${UNKNOWN_ID} não encontrado` ``; status 404 em `:348/:352/:356/:363` _(citação carried from c614ed6)_ | PASS |
| C16 | `laranja` em A -> 409; `Laranja` em B -> 201; rename para `LARANJA` -> 409 | e2e batch, "enforces case-insensitive variant name uniqueness within a product only" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:374-375` `toBe(409)`, `toEqual({ error: DUPLICATE_VARIANT })`; `:377` `toBe(201)`; `:381-382` `toBe(409)`, mesma mensagem _(citação carried from c614ed6)_ | PASS |
| C17 | PATCH substitui só a lista enviada | e2e batch, "replaces only the lists sent in a variant patch" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:404-409` materiais = 1 linha nova, insumos intactos; `:413-416` `supplies).toEqual([])` e material mantido; `:420-424` só `name`, listas inalteradas _(citação carried from c614ed6)_ | PASS |
| C18 | duas criações simultâneas -> uma 201 e uma 409, uma linha | e2e batch, "two concurrent creates of the same model yield one 201 and one 409" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:430` `toEqual([201, 409])`; `:434` `rows[0].n).toBe('1')`. `create` não tem pré-checagem (`products.service.ts:93-112`), então o índice é o único mecanismo _(citação carried from c614ed6)_ | PASS |
| C19 | variação de outro produto e `variantId` inexistente -> 404 | e2e batch, "returns 404 for a variant outside the product" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:448-449` e `:452-453` `toBe(404)` e `toEqual({ error: VARIANT_NOT_FOUND })` _(citação carried from c614ed6)_ | PASS |
| C20 | posse da variação e substituição de listas na transação | unit, 3 testes sob "variant ownership and list replacement" ✓ — re-run at `d0ccf1c` | `api/src/modules/products/products.service.spec.ts:136-137` `rejects.toBeInstanceOf(NotFoundException)`, `toThrow('Variação não encontrada')`; `:143-146` sem delete/save; `:152-156` `transactions).toBe(1)`, `materialDeletes).toEqual([{ variantId }])`, `supplyDeletes).toEqual([])` _(citação carried from c614ed6)_ | PASS |
| C21 | variação `active: false` 200 e continua no GET | e2e batch, "deactivates a variant without deleting it" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:463-464` `toBe(200)`, `active).toBe(false)`; `:467` `variants).toEqual([expect.objectContaining({ id: variantId, active: false })])` _(citação carried from c614ed6)_ | PASS |
| C22 | índice único do modelo: mesma plataforma+id 23505, outra plataforma aceita | e2e batch, "unique model index rejects the same platform and id only" ✓ — re-run at `d0ccf1c` | `api/test/products-schema.e2e-spec.ts:61` `toBe('23505')`; `:62` `toBeNull()` _(citação carried from c614ed6)_ | PASS |
| C23 | `Azul`/`AZUL` no mesmo produto 23505; em produtos diferentes aceito | e2e batch, "unique variant name index is case-insensitive and per product" ✓ — re-run at `d0ccf1c` | `api/test/products-schema.e2e-spec.ts:70` `toBe('23505')`; `:71` `toBeNull()` _(citação carried from c614ed6)_ | PASS |
| C24 | DELETE de material, insumo, impressora referenciados 23503; não referenciado passa | e2e batch, "tech sheet foreign keys restrict deleting referenced registries" ✓ — re-run at `d0ccf1c` | `api/test/products-schema.e2e-spec.ts:93-95` `toBe('23503')` por tabela (3 casos `:87-91`); `:97` `toBeNull()` _(citação carried from c614ed6)_ | PASS |
| C25 | `commercial_use_allowed` padrão NULL; `cults3d` 22P02 | e2e batch, "commercial use defaults to null and platform is a closed enum" ✓ — re-run at `d0ccf1c` | `api/test/products-schema.e2e-spec.ts:105` `commercial_use_allowed).toBeNull()`; `:106` `toBe('22P02')` _(citação carried from c614ed6)_ | PASS |
| C26 | pricing 200: `error: null`, `quantity: 1`, `materialCents: 550`, `laborCents: 3000`, só canal ativo | e2e batch at `d0ccf1c` exit 0, "prices each active variant with quantity 1, active channels and the settings labor rate" ✓ | _(verified at d0ccf1c; linhas não mudaram)_ `api/test/products-pricing.e2e-spec.ts:98` `expect(response.status).toBe(200)`; `:104-107` `entry.error).toBeNull()`, `pricing?.quantity).toBe(1)`, `costs.materialCents).toBe(550)`, `costs.laborCents).toBe(3000)`; `:109-110` `channelNames).toContain('Balcão QA')`, `not.toContain('Inativo QA')`. O canal novo `Cem por cento QA` só é criado dentro do teste de C53 (`:160`), e `afterEach(cleanup)` (`:60`) apaga `CHANNELS` (`:16`), então não vaza para C26 | PASS |
| C27 | rolo novo -> `materialCents: 867`, produto e ficha intactos | e2e batch at `d0ccf1c`, "reflects a new roll's average cost without writing to the product" ✓ | _(verified at d0ccf1c)_ `api/test/products-pricing.e2e-spec.ts:131` `materialCents).toBe(867)`; `:132` `expect(await snapshot()).toEqual(stored)` | PASS |
| C28 | "Preto" `pricing: null` + mensagem; "Laranja" com preço | e2e batch at `d0ccf1c`, "isolates one variant's failure from the others" ✓ | _(verified at d0ccf1c)_ `api/test/products-pricing.e2e-spec.ts:151-152` `black?.pricing).toBeNull()`, `black?.error).toBe('Material sem custo médio disponível: PLA · Marca de teste · Preto')`; `:153-154` `orange?.error).toBeNull()`, `materialCents).toBe(550)` | PASS |
| C29 | sem variação e só inativa -> 200 `{ variants: [] }` | e2e batch at `d0ccf1c`, "returns an empty list when no variant is active" ✓ | _(verified at d0ccf1c; linhas moveram +13)_ `api/test/products-pricing.e2e-spec.ts:173-174` e `:179-180` `status).toBe(200)`, `body).toEqual({ variants: [] })` | PASS |
| C30 | pricing `not-a-uuid` 400; inexistente 404 | e2e batch at `d0ccf1c`, "returns 400 for a malformed id and 404 for an unknown product" (pricing) ✓ | _(verified at d0ccf1c; linhas moveram)_ `api/test/products-pricing.e2e-spec.ts:184` `(await getPricing('not-a-uuid')).status).toBe(400)`; `:186-187` `unknown.status).toBe(404)`, `body).toEqual({ error: 'Produto não encontrado' })` | PASS |
| C31 | 5 ramos: (a) inativa sem `preview`; (b) DTO; (c) `HttpException` -> `{ pricing: null, error }`; (d) erro que não é `HttpException` nem `PricingError` é relançado; (e) `PricingError("z")` -> `{ pricing: null, error: "z" }` | unit batch at `d0ccf1c` exit 0, 5 testes `ProductPricingService > (a)..(e)` ✓ individualmente | _(verified at d0ccf1c)_ (a) `api/src/modules/products/product-pricing.service.spec.ts:63` `expect(calls).toHaveLength(1)`, `:64` `toEqual(['v-ativa'])`; (b) `:70-80` `expect(calls).toEqual([{ ..., quantity: 1, channelIds: [ACTIVE_CHANNEL], labor: { ..., centsPerHour: 3000 } }])` e `:81` `expect('minimumOrderCents' in calls[0]).toBe(false)`; (c) `:89-91` `BadRequestException('x')` -> `toEqual([{ variantId: 'v-ativa', name: 'Laranja', pricing: null, error: 'x' }])`, `:95-97` `NotFoundException('y')` -> `error: 'y'`; (d) `:101` `new Error('boom')` (nem `HttpException` nem `PricingError`), `:105` `await expect(service.pricing('p')).rejects.toBe(defect)`; (e) `:110` `throw new PricingError('z')` (importado do módulo real, `:3`), `:112-114` `toEqual([{ variantId: 'v-ativa', name: 'Laranja', pricing: null, error: 'z' }])`. Os cinco ramos batem com o código: `api/src/modules/products/product-pricing.service.ts:24` filtra `active`, `:41-54` monta o DTO, `:61-62` isola `error instanceof HttpException` ou `error instanceof PricingError`, `:64` relança o resto. A redação de (d) agora descreve o que `:61` faz; o gap da rodada 1 está fechado | PASS |
| C32 | `production` e `sales` 200 nas 3 rotas de leitura | e2e batch, "production and sales read the catalog and its pricing" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:478` `expect(response.status, route).toBe(200)` em loop 2 papéis × 3 rotas (`:474-476`); lado `admin` em C10/C8/C26 _(citação carried from c614ed6)_ | PASS |
| C33 | escrita: `production`/`sales` 403 com mensagem, `admin` 201/200 | e2e batch, "only admin writes to the catalog" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:501-502` `toBe(403)`, `toEqual(PERMISSION_DENIED)` por rota × papel (4 × 2); `:506-509` admin `201`/`200`/`201`/`200` _(citação carried from c614ed6)_ | PASS |
| C34 | 7 rotas sem sessão -> 401 | e2e batch, "every products route is 401 without a session" ✓ — re-run at `d0ccf1c` | `api/test/products.e2e-spec.ts:524` `expect(response.status).toBe(401)` sobre as 7 requisições `:514-522` _(citação carried from c614ed6)_ | PASS |
| C35 | `/products` carregando | web batch exit 0, `Products page > shows loading` ✓ — re-run at `d0ccf1c` | `web/src/app/(app)/products/page.test.tsx:74` `getByText("Carregando…")).toBeTruthy()` síncrono após `render`, antes de `resolveProducts`; `:77` some depois _(citação carried from c614ed6)_ | PASS |
| C36 | vazio "Nenhum produto cadastrado" | web, `shows the empty state` ✓ — re-run at `d0ccf1c` | `web/src/app/(app)/products/page.test.tsx:86` `findByText("Nenhum produto cadastrado")).toBeTruthy()` _(citação carried from c614ed6)_ | PASS |
| C37 | erro com `role="alert"` e "Tentar novamente" que refaz a busca | web, `shows the error with retry` ✓ — re-run at `d0ccf1c` | `web/src/app/(app)/products/page.test.tsx:96-97` `findByRole("alert")`, `textContent).toBe("Não foi possível conectar à API")`; `:101` `callsTo(... "/products?pageSize=100")).toHaveLength(2)` _(citação carried from c614ed6)_ | PASS |
| C38 | aviso de licença por estado `false`/`null`/`true` | web, `shows the license notice for each commercial-use state` ✓ — re-run at `d0ccf1c` | `web/src/app/(app)/products/page.test.tsx:123-124` (false), `:127-128` (null), `:131-132` (true, nenhum dos dois textos), todos `within(row)` _(citação carried from c614ed6)_ | PASS |
| C39 | só `admin` vê "Novo produto", "Editar", "Desativar" (3 papéis) | web, `only admin sees create and edit actions` ✓ — re-run at `d0ccf1c` | `web/src/app/(app)/products/page.test.tsx:144-146` `Boolean(queryByRole("button", ...))).toBe(isAdmin)` por papel (loop `:136`) _(citação carried from c614ed6)_ | PASS |
| C40 | form: 400 mostra alerta e mantém campos; sucesso envia só campos do Surface | web, `product form keeps values and shows the api error` ✓ — re-run at `d0ccf1c` | `web/src/app/(app)/products/page.test.tsx:166` `alert.textContent).toBe(INVALID_URL)`; `:167-168` valores mantidos; `:181-190` `body).toEqual({ name, modelUrl, description, modelTitle, modelImageUrl, modelDesigner, modelLicense, commercialUseAllowed: false })` _(citação carried from c614ed6)_ | PASS |
| C41 | detalhe carregando | web, `Product detail page > shows loading` ✓ — re-run at `d0ccf1c` | `web/src/app/(app)/products/[id]/page.test.tsx:128-130` após o fetch do produto sair: `getByText("Carregando…")).toBeTruthy()`, `queryByText("Estrela do mar")).toBeNull()` _(citação carried from c614ed6)_ | PASS |
| C42 | custo pendente: indicador por variação, produto já visível | web, `shows a loading indicator per variant while pricing is pending` ✓ — re-run at `d0ccf1c` | `web/src/app/(app)/products/[id]/page.test.tsx:143` URL do modelo visível; `:144-145` `within(variantCard(...)).getByText("Calculando custo…")` para Laranja e Preto _(citação carried from c614ed6)_ | PASS |
| C43 | preço falha: alerta, retry refaz só o preço, produto visível | web, `keeps the product visible when pricing fails and retries pricing` ✓ — re-run at `d0ccf1c` | `web/src/app/(app)/products/[id]/page.test.tsx:157` `alert.textContent).toBe("Internal server error")`; `:158-160` nome, URL, variação visíveis; `:165-166` pricing chamado 2x, produto 1x _(citação carried from c614ed6)_ | PASS |
| C44 | erro por variação no lugar do custo; outra mostra custo com risco e preço por canal (`R$`) | web, `shows a per-variant error beside the other variants' prices` ✓ — re-run at `d0ccf1c` | `web/src/app/(app)/products/[id]/page.test.tsx:184-185` erro em Preto, sem "Custo com risco"; `:188-190` `getByText("R$ 39.05")`, `"Balcão"`, `"R$ 55.79"` em Laranja _(citação carried from c614ed6)_ | PASS |
| C45 | "Nenhuma variação cadastrada" | web, `shows the empty variants state` ✓ — re-run at `d0ccf1c` | `web/src/app/(app)/products/[id]/page.test.tsx:201` `findByText("Nenhuma variação cadastrada")).toBeTruthy()` _(citação carried from c614ed6)_ | PASS |
| C46 | 404 -> "Produto não encontrado" com `role="alert"` | web, `shows the not found error` ✓ — re-run at `d0ccf1c` | `web/src/app/(app)/products/[id]/page.test.tsx:211-212` `findByRole("alert")`, `textContent).toBe("Produto não encontrado")` _(citação carried from c614ed6)_ | PASS |
| C47 | por papel no detalhe; "Desativar" abre `ConfirmDialog` antes do PATCH | web, `only admin sees variant actions and deactivation confirms` ✓ — re-run at `d0ccf1c` | `web/src/app/(app)/products/[id]/page.test.tsx:234-236` `queryByRole(... "Nova variação"/"Editar"/"Desativar")).toBeNull()` para production e sales; `:249-254` admin vê "Nova variação" e "Editar"; `:257-258` `getByRole("dialog")` e PATCH chamado 0x; `:260` `patched).toEqual({ active: false })` após confirmar _(citação carried from c614ed6)_ | PASS |
| C48 | MakerWorld: URL preenchida, import dá `0.47` h e gramas `8`/`1`, material vazio | web, `prefills the tech sheet from the product's MakerWorld profile` ✓ — re-run at `d0ccf1c` | `web/src/components/product-variant-editor.test.tsx:110` `toBe("https://makerworld.com/models/3007827")`; `:118` `"Horas de impressão")).toBe("0.47")`; `:119-120` `"8"`, `"1"`; `:121-122` `"Material 1"/"Material 2")).toBe("")` _(citação carried from c614ed6)_ | PASS |
| C49 | não MakerWorld: sem import, linhas manuais | web, `offers only manual entry for non-MakerWorld products` ✓ — re-run at `d0ccf1c` | `web/src/components/product-variant-editor.test.tsx:131-132` `queryByLabelText("URL do MakerWorld")).toBeNull()`, botão "Importar" ausente; `:135-136` "Material 1" e "Insumo 1" presentes _(citação carried from c614ed6)_ | PASS |
| C50 | `<select>` do cadastro, nenhum campo de custo, corpo só ids/gramas/quantidades/horas | web, `uses registry selectors and never a cost field` ✓ — re-run at `d0ccf1c` | `web/src/components/product-variant-editor.test.tsx:153` `tagName).toBe("SELECT")` x3; `:155-157` opções do cadastro; `:158` `queryByLabelText(/custo/i)).toBeNull()`; `:162-171` `sent).toEqual({ name, printerId, printHours, prepHours, slicingHours, postProcessingHours, materials: [{ materialId, grams }], supplies: [{ stockItemId, quantity }] })` _(citação carried from c614ed6)_ | PASS |
| C51 | 409 no save: alerta e ficha mantida | web, `keeps the sheet and shows the api error on save failure` ✓ — re-run at `d0ccf1c` | `web/src/components/product-variant-editor.test.tsx:186` `textContent).toBe("Já existe uma variação com este nome neste produto")`; `:188-192` nome, horas, material, gramas, insumo mantidos _(citação carried from c614ed6)_ | PASS |
| C52 | "Catálogo" `href="/products"` para os 3 papéis; listas exatas por papel incluem o item sem remover nenhum | web, `AppShell > Catálogo appears for every role and links to /products` ✓ (+ arquivo inteiro no batch) — re-run at `d0ccf1c` | `web/src/components/app-shell.test.tsx:139-140` `getByRole("link", { name: "Catálogo" })`, `getAttribute("href")).toBe("/products")` por papel (loop `:132`); listas exatas `:66-81` (admin, textos) e `:83-99` (hrefs, `"/products"` em `:87`), `:110-123` (production/sales, `"Catálogo"` em `:114`). Nota: o `-t "Catálogo"` da Proof só seleciona `:131`; as listas exatas estão em testes com outros nomes, que rodaram no meu batch do arquivo inteiro _(citação carried from c614ed6)_ | PASS |
| C53 | canal ativo "Cem por cento QA" (`taxRate: 0.6`, `feeRate: 0.4`, margem `0`) -> `200`, "Laranja" com `pricing: null` e `error` literal do `PricingError` | e2e batch at `d0ccf1c`, "isolates a pricing rule failure in the variant" ✓ (casa exatamente com o `-t` da Proof) | _(verified at d0ccf1c)_ precondição `api/test/products-pricing.e2e-spec.ts:160` `createSalesChannel(dataSource, { name: 'Cem por cento QA', taxRate: 0.6, feeRate: 0.4, active: true })` (margem `0`: `resetSettings` em `:48` só passa `laborCentsPerHour`, e `test/settings-helper.ts:29` usa `defaultMarginRate ?? 0`); `:163` `expect(response.status).toBe(200)`; `:166` `expect(orange?.pricing).toBeNull()`; `:167` `expect(orange?.error).toBe('Channel "Cem por cento QA": margin + taxes + fee must be below 100%')`. O erro nasce no `PricingError` real (`api/src/modules/pricing/pricing.service.ts:72-74`, soma `taxRate + feeRate` por canal em `quote-preview.service.ts:66-69`), atravessa o `QuotePreviewService` real e é isolado em `product-pricing.service.ts:61`; a rota responde 200 em vez de 500, que é o que prova door 2 (lado "regra do pricing") | PASS |

Batches em `d0ccf1c`, todos com `--reporter=verbose` e cada teste listado individualmente:
- API unit `npm --prefix api run test -- src/modules/products --reporter=verbose` — 3 arquivos,
  20 passed (20) (19 da rodada 1 + `(e) a PricingError from preview becomes { pricing: null, error: message }`).
- API e2e `npm --prefix api run test:e2e -- test/products.e2e-spec.ts test/products-schema.e2e-spec.ts
  test/products-pricing.e2e-spec.ts --reporter=verbose` — 3 arquivos, 31 passed (31) (30 +
  `GET /products/:id/pricing (e2e) > isolates a pricing rule failure in the variant`).
- Web `npm --prefix web run test -- 'src/app/(app)/products' src/components/product-variant-editor.test.tsx
  src/components/app-shell.test.tsx --reporter=verbose` — 4 arquivos, 33 passed (33).

Todos os 53 nomes de `-t` casam com um teste que rodou nessa saída; C12, C20 e C31 casam com um
`describe` que rodou 3, 3 e 5 testes. Nenhum filtro caiu em zero. Os testes novos (C31 (e), C53)
estão no diff do fix.

Nível: C53 afirma status e formato no e2e `supertest` contra o `AppModule` real, com o
`PricingError` gerado pelo `PricingService` real — sem level gap. C31 fica no nível do arquivo,
como a política pede para "decide e é alcançado por uma rota" (e2e C26/C28/C53 + spec C31). Demais
julgamentos de nível carried from c614ed6.

Pontos lidos, sem virar falha:
- C53 cria o canal direto no banco (`products-pricing.e2e-spec.ts:158-160`, com comentário de que a
  rota de canais recusaria a soma de 100%); é precondição, não atalho da asserção.
- C52 (menor, carried): o `-t "Catálogo"` da Proof só seleciona `app-shell.test.tsx:131`; as listas
  exatas estão em testes de outros nomes, que rodaram no batch do arquivo inteiro.

## Swept — carried from c614ed6, exceto failure modes (verified at d0ccf1c)

- validation (C3, C4, C7, C14): `api/src/modules/products/dto/create-product.dto.ts:12-13`
  `@IsNotEmpty()` `@Length(1, 150)` em `name`, `:18` `@MaxLength(2000)`, `:33` `@IsUrl({ protocols:
  ['https'] ...})`; `dto/create-product-variant.dto.ts:51-63` `@Min(0)` nas quatro horas, `:24`/`:33`
  `@IsPositive()`, `:67-68` `@ArrayMinSize(1)` `@ArrayMaxSize(MAX_MATERIAL_LINES)` (=32, `:37`),
  `:76` `@ArrayMaxSize(MAX_SUPPLY_LINES)` (=50, `:38`); `dto/list-products.dto.ts:25` `@Max(100)`;
  `model-url.ts:30` recusa protocolo, porta e credencial. Existe como citado.
- failure modes (C28, C31, C43, C44, C53) — _verified at d0ccf1c_: `product-pricing.service.ts:55-65`
  isola por variação; `:61` cobre `HttpException` e `PricingError`, agora cada um com prova (C31 (c),
  C31 (e), e C53 na rota); `:64` relança o resto (C31 (d)). Existe.
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

## Gate — verified at d0ccf1c

```
npm --prefix api run lint        -> oxlint --type-aware src/ test/, exit 0
npm --prefix api run test        -> Test Files 30 passed (30) · Tests 129 passed (129)
npm --prefix api run build       -> nest build, exit 0
npm --prefix api run test:e2e    -> Test Files 27 passed (27) · Tests 376 passed (376), exit 0
npm --prefix web run lint        -> eslint, exit 0
npm --prefix web run test        -> Test Files 33 passed (33) · Tests 183 passed (183)
npm --prefix web run build       -> exit 0, rotas /products e /products/[id] geradas
```

53/53 checks provados; nenhum FAIL.

**Ranked gaps**: nenhum que falhe a feature. Nota menor carried: C52, Proof `-t "Catálogo"` não
seleciona os testes das listas exatas (`web/src/components/app-shell.test.tsx:58` e `:102`).
