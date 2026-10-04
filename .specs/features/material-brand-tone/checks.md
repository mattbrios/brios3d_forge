# Padrões do novo material, sugestão de marca e tom da cor - checks

Profile: light
Plan: `.specs/features/material-brand-tone/plan.md`

57 checks em 7 slices · 5 one-way doors · 0 open

`T` abaixo é `npm --prefix web run test --` e `E` é `npm --prefix api run test:e2e --`. `PAGE` é
`"src/app/(app)/materials/page.test.tsx"`. Os títulos dos testes contêm literalmente a substring
do `-t` (lição L-047).

## Checks

### S1 - Formulário novo com os valores usuais · 2 files · ~28 KB · ~7k

**C1** - O formulário "Novo material" abre com Tipo, Marca e Cor vazios, sem tom, Densidade `1,24`, Temperatura do bico `220`, Temperatura da mesa `65` e Estoque mínimo `100` (AC 1)
Proof: `T PAGE -t "new material form starts with the usual defaults"`

**C2** - Enviar o formulário novo sem mexer nos números manda `densityGCm3: 1.24`, `nozzleTempC: 220`, `bedTempC: 65` e `minimumStockGrams: 100` no `POST /materials` (AC 2)
Proof: `T PAGE -t "sends the defaults as numbers"`

**C3** - Apagar o Estoque mínimo padrão e enviar manda `minimumStockGrams: null` (AC 3)
Proof: `T PAGE -t "cleared default minimum is sent as null"`

**C4** - Depois de um `201`, o formulário novo volta a Densidade `1,24`, bico `220`, mesa `65`, mínimo `100`, Tipo/Marca/Cor vazios e sem tom, tendo todos sido alterados antes do envio (AC 4)
Proof: `T PAGE -t "resets the new form to the defaults after saving"`

**C5** - Se o `POST /materials` responde `400` com `{ error }`, o formulário mantém os valores digitados (incluindo marca e tom) e mostra a mensagem da API (AC 5)
Proof: `T PAGE -t "keeps the typed values when the create fails"`

**C6** - A edição de um material com densidade `1.1`, bico `200`, mesa `50` e mínimo `null` abre com `1,1`, `200`, `50` e o mínimo vazio, nunca com os padrões (AC 6)
Proof: `T PAGE -t "edit form uses the material values, never the defaults"`

### S2 - `GET /materials/brands` · 6 files · ~22 KB · ~6k

**C7** - `GET /materials/brands` responde `200` com um array de strings para `admin`, `production` e `sales`, tabela por papel (AC 7)
Proof: `E test/materials-brands.e2e-spec.ts -t "GET /materials/brands answers 200 for role"`

**C8** - `GET /materials/brands` sem sessão responde `401` com `{ "error": "Sessão expirada ou inexistente. Entre novamente" }` (AC 8)
Proof: `E test/materials-brands.e2e-spec.ts -t "GET /materials/brands without a session is 401"`

**C9** - Na rota, com `voolt` (criado antes), `VOOLT` (criado depois), `Anycubic` só em material inativo e `bambu`, a resposta é exatamente `["Anycubic", "bambu", "VOOLT"]` (AC 9, AC 10, AC 11 - contrato na rota)
Proof: `E test/materials-brands.e2e-spec.ts -t "route groups, keeps the newest spelling and orders brands"`

**C10** - `MaterialsService.listBrands()` devolve uma única entrada para `voolt` e `Voolt` (agrupamento ignorando maiúsculas) (AC 9, door 3)
Proof: `E test/materials-brands.e2e-spec.ts -t "listBrands groups brands ignoring case"`

**C11** - `listBrands()` devolve a grafia do material de maior `created_at`: `voolt` em 2026-01-01 e `VOOLT` em 2026-02-01 resultam em `["VOOLT"]`, e invertendo as datas em `["voolt"]` (AC 9, door 3)
Proof: `E test/materials-brands.e2e-spec.ts -t "listBrands keeps the spelling of the newest material"`

**C12** - `listBrands()` desempata `created_at` igual pelo maior `id`: `voolt` com id `…0001` e `VOOLT` com id `…0002`, mesmo `created_at`, resultam em `["VOOLT"]` (door 3)
Proof: `E test/materials-brands.e2e-spec.ts -t "listBrands breaks a created_at tie by the greater id"`

**C13** - `listBrands()` inclui uma marca que só existe em material inativo (AC 10)
Proof: `E test/materials-brands.e2e-spec.ts -t "listBrands includes brands of inactive materials"`

**C14** - `listBrands()` com `Creality`, `bambu` e `Anycubic` devolve `["Anycubic", "bambu", "Creality"]` (AC 11)
Proof: `E test/materials-brands.e2e-spec.ts -t "listBrands orders brands ignoring case"`

**C15** - Sem nenhum material, a rota responde `200` com `[]` (AC 12)
Proof: `E test/materials-brands.e2e-spec.ts -t "GET /materials/brands answers an empty array without materials"`

### S3 - Combobox de marca · 5 files · ~40 KB · ~10k

**C16** - `matchOptions(["3D Fila", "Bambu Lab", "Voolt"], "a", 8)` devolve `["3D Fila", "Bambu Lab"]`: o texto casa em qualquer posição, não só no início (door 5)
Proof: `T src/components/ui/combobox.test.tsx -t "matchOptions matches the text anywhere in the option"`

**C17** - `matchOptions(["Ação 3D", "Voolt"], "ACAO", 8)` devolve `["Ação 3D"]`, e `"açã"` também (door 5)
Proof: `T src/components/ui/combobox.test.tsx -t "matchOptions ignores case and accents"`

**C18** - `matchOptions` sobre 10 opções que casam, com `max = 8`, devolve as 8 primeiras na ordem recebida; com 8 que casam, devolve as 8 (door 5 - os dois lados do limite)
Proof: `T src/components/ui/combobox.test.tsx -t "matchOptions caps the result keeping the input order"`

**C19** - `matchOptions(options, "", 8)` e `matchOptions(options, "   ", 8)` devolvem `[]` (door 5)
Proof: `T src/components/ui/combobox.test.tsx -t "matchOptions returns nothing for blank text"`

**C20** - `matchOptions(["Voolt"], "xyz", 8)` devolve `[]` (door 5)
Proof: `T src/components/ui/combobox.test.tsx -t "matchOptions returns nothing when no option matches"`

**C21** - Com as marcas `["3D Fila", "Bambu Lab", "Voolt"]`, digitar `a` em Marca abre a lista com as opções `3D Fila` e `Bambu Lab`, nessa ordem (AC 13)
Proof: `T PAGE -t "suggests brands containing the typed letter"`

**C22** - Com o campo Marca vazio, o combobox tem `aria-expanded="false"` e nenhum `role="listbox"` visível; depois de apagar o texto digitado, volta a esse estado (AC 14)
Proof: `T PAGE -t "brand list stays closed while the field is empty"`

**C23** - Digitar `ACAO` com a marca `Ação 3D` carregada mostra a opção `Ação 3D` (AC 15)
Proof: `T PAGE -t "suggests brands ignoring case and accents"`

**C24** - Com 10 marcas que contêm `a`, digitar `a` mostra exatamente 8 opções, as 8 primeiras da resposta da API (AC 16)
Proof: `T PAGE -t "shows at most 8 brand suggestions"`

**C25** - Digitar `xyz` mantém `aria-expanded="false"`, sem listbox e sem mensagem (AC 17)
Proof: `T PAGE -t "brand list stays closed when nothing matches"`

**C26** - Clicar na opção `Bambu Lab` deixa o campo Marca com `Bambu Lab` e fecha a lista (AC 18)
Proof: `T PAGE -t "clicking a suggestion fills the brand"`

**C27** - Com a lista aberta, `ArrowDown` + `Enter` deixa o campo com a primeira sugestão, fecha a lista e não chama `POST /materials` (AC 19)
Proof: `T PAGE -t "ArrowDown and Enter pick a suggestion without submitting"`

**C28** - Com a lista aberta, `Escape` fecha a lista e o campo mantém o texto digitado (AC 20)
Proof: `T PAGE -t "Escape closes the brand list and keeps the text"`

**C29** - O campo Marca é `role="combobox"` com nome "Marca", `aria-controls` igual ao `id` do `role="listbox"`, opções `role="option"`, e depois de `ArrowDown` o `aria-activedescendant` é o `id` da opção destacada (AC 21)
Proof: `T PAGE -t "brand combobox exposes the ARIA combobox pattern"`

**C30** - Digitar `Marca Nova`, que não está na lista, e enviar manda `brand: "Marca Nova"` (AC 22)
Proof: `T PAGE -t "accepts a new brand typed freely"`

**C31** - No formulário de edição, digitar `a` em Marca abre as mesmas sugestões de C21 (AC 23)
Proof: `T PAGE -t "edit form offers the same brand suggestions"`

**C32** - Depois de salvar um material com `Marca Nova`, digitar `Nova` no formulário novo sugere `Marca Nova` sem nova chamada a `GET /materials/brands` (AC 24)
Proof: `T PAGE -t "a saved new brand joins the suggestions"`

**C33** - Se `GET /materials/brands` falha, a tabela e o formulário renderizam, não há `role="alert"`, e digitar `a` em Marca não abre lista (AC 25)
Proof: `T PAGE -t "brands failure keeps the page working without suggestions"`

### S4 - Tom na API · 6 files · ~25 KB · ~6k

**C34** - `POST /materials` com `colorHex: "#FF8800"` responde `201` com `colorHex: "#ff8800"`, e a linha tem `color_hex = '#ff8800'` (AC 26, door 2)
Proof: `E test/materials.e2e-spec.ts -t "POST stores colorHex in lowercase"`

**C35** - `POST /materials` sem `colorHex` responde `201` com `colorHex: null`, e com `colorHex: null` também (AC 27)
Proof: `E test/materials.e2e-spec.ts -t "POST without colorHex or with null answers null"`

**C36** - `POST /materials` com `colorHex` igual a `"#fff"`, `"ff8800"`, `"#gg0000"`, `"#ff88001"`, `""` e `123` responde `400` com `{ "error": "colorHex deve estar no formato #rrggbb" }` e a tabela continua sem materiais, tabela sobre os 6 valores (AC 28)
Proof: `E test/materials.e2e-spec.ts -t "POST rejects colorHex"`

**C37** - `PATCH /materials/:id` com `colorHex: "#00AA11"` responde `200` com `colorHex: "#00aa11"` (AC 29)
Proof: `E test/materials.e2e-spec.ts -t "PATCH stores colorHex in lowercase"`

**C38** - `PATCH /materials/:id` com `colorHex: null` num material com `#ff8800` responde `200` com `colorHex: null`, e a linha tem `color_hex IS NULL` (AC 30)
Proof: `E test/materials.e2e-spec.ts -t "PATCH with colorHex null removes the tone"`

**C39** - `PATCH /materials/:id` só com `color: "Laranja"` num material com `#ff8800` mantém `colorHex: "#ff8800"` (AC 31)
Proof: `E test/materials.e2e-spec.ts -t "PATCH without colorHex keeps the tone"`

**C40** - `PATCH /materials/:id` com `colorHex: "#ff88"` responde `400` com `{ "error": "colorHex deve estar no formato #rrggbb" }` e a linha mantém `#ff8800` (AC 32)
Proof: `E test/materials.e2e-spec.ts -t "PATCH rejects an invalid colorHex and keeps the tone"`

**C41** - `GET /materials` devolve `colorHex: "#ff8800"` no material com tom e `colorHex: null` no sem tom (AC 33)
Proof: `E test/materials.e2e-spec.ts -t "GET /materials includes colorHex on each item"`

**C42** - Os status já existentes de `POST /materials` continuam: `403` para `production` e `sales`, `401` sem sessão (Surface)
Proof: `E test/materials.e2e-spec.ts -t "non-admin roles get 403 on POST /materials"`
Proof: `E test/materials.e2e-spec.ts -t "POST /materials without a session is 401"`

**C43** - Os status já existentes de `PATCH /materials/:id` continuam: `403` para `production` e `sales`, `401` sem sessão, `404` para id desconhecido (Surface)
Proof: `E test/materials.e2e-spec.ts -t "non-admin roles get 403 on PATCH /materials"`
Proof: `E test/materials.e2e-spec.ts -t "PATCH /materials without a session is 401"`
Proof: `E test/materials.e2e-spec.ts -t "PATCH with an unknown id is 404"`

**C44** - Os status já existentes de `GET /materials` continuam: `400` para `page`/`pageSize` inválidos, `401` sem sessão (Surface)
Proof: `E test/materials.e2e-spec.ts -t "rejects invalid page and pageSize"`
Proof: `E test/materials.e2e-spec.ts -t "GET /materials without a session is 401"`

### S5 - Migration do tom · 3 files · ~7 KB · ~2k

**C45** - O `down()` de `AddMaterialColorHex` sobre dois materiais semeados (um com `#ff8800`, um sem tom) remove a coluna `color_hex` e mantém as duas linhas com tipo, marca, cor, densidade, temperaturas, situação e mínimo iguais aos semeados (AC 34, door 1)
Proof: `E test/color-hex-migration.e2e-spec.ts -t "down keeps the seeded rows and drops color_hex"`

**C46** - O `up()` em seguida recria `color_hex` com `is_nullable = 'YES'`, `character_maximum_length = 7` e `column_default` nulo, e as duas linhas ficam com `color_hex IS NULL` (AC 35, door 1)
Proof: `E test/color-hex-migration.e2e-spec.ts -t "up recreates color_hex as nullable with NULL on existing rows"`

### S6 - Tom no formulário e na tabela · 3 files · ~32 KB · ~8k

**C47** - O formulário novo mostra o botão de amostra "Escolher tom" sem cor e nenhum botão "Remover" (AC 36)
Proof: `T PAGE -t "new form starts without a tone"`

**C48** - Existe um `<input type="color">` com nome acessível "Tom", e a amostra é o `<label>` associado a ele (`htmlFor` igual ao `id` do input) (AC 37)
Proof: `T PAGE -t "the swatch labels a color input named Tom"`

**C49** - Mudar o input "Tom" para `#ff8800` pinta a amostra com `#ff8800`, mostra "Remover", e o envio manda `colorHex: "#ff8800"` (AC 38)
Proof: `T PAGE -t "picking a tone paints the swatch and sends it"`

**C50** - Depois de escolher `#ff8800`, clicar "Remover" volta a amostra a "sem tom", esconde "Remover", e o envio manda `colorHex: null` (AC 39)
Proof: `T PAGE -t "Remover returns to no tone and sends null"`

**C51** - A edição de um material com `colorHex: "#ff8800"` mostra a amostra `#ff8800` e "Remover"; a de um material com `colorHex: null` mostra "sem tom" e nenhum "Remover" (AC 40)
Proof: `T PAGE -t "edit form shows the stored tone"`

**C52** - Na tabela, a célula Cor de um material com `#ff8800` tem o nome da cor e um `role="img"` com nome `Tom #ff8800` (AC 41)
Proof: `T PAGE -t "table shows the tone swatch beside the color name"`

**C53** - Na tabela, a célula Cor de um material com `colorHex: null` tem só o nome, sem nenhum `role="img"` (AC 42)
Proof: `T PAGE -t "table shows only the color name without a tone"`

### S7 - Contrato, glossário e decisão · ~10 files · ~60 KB · ~15k (só fixtures)

**C54** - Todo consumidor de `Material` no web compila com `colorHex: string | null` (Impact - contract)
Proof: `npm --prefix web run build`

**C55** - A API compila com `colorHex` na entidade, nos DTOs e no `MaterialResponse` (Impact - contract)
Proof: `npm --prefix api run build`

**C56** - O `CONTEXT.md` define **Cor**, **Tom** e **Marca** (Impact - domain)
Proof: `grep -q '\*\*Cor:\*\*' CONTEXT.md && grep -q '\*\*Tom:\*\*' CONTEXT.md && grep -q '\*\*Marca:\*\*' CONTEXT.md`

**C57** - O `.specs/STATE.md` tem o AD-032 ativo (combobox e `FieldConfig.render`) (door 4, door 5)
Proof: `grep -q '^| AD-032 |.*| active |' .specs/STATE.md`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /materials/brands` statuses (2) | 200 C7 · 401 C8 | - |
| `GET /materials/brands` roles (3) | admin C7 · production C7 · sales C7 | - |
| `POST /materials` statuses (4) | 201 C34 · 400 C36 · 401 C42 · 403 C42 | - |
| `PATCH /materials/:id` statuses (5) | 200 C37 · 400 C40 · 401 C43 · 403 C43 · 404 C43 | - |
| `GET /materials` statuses (3) | 200 C41 · 400 C44 · 401 C44 | - |
| `colorHex` rejected values (6) | C36, table-driven over all 6 | - |
| `colorHex` on PATCH (3) | value C37 · null C38 · omitted C39 | - |
| `colorHex` on POST (3) | value C34 · null C35 · omitted C35 | - |
| `listBrands` decision rows (6) | case grouping C10 · newest spelling C11 · id tiebreak C12 · inactive C13 · order C14 · empty C15 | - |
| `matchOptions` decision rows (6) | substring C16 · case and accent C17 · cap above 8 C18 · cap at 8 C18 · blank C19 · no match C20 | - |
| combobox interactions (5) | typing C21 · click C26 · ArrowDown+Enter C27 · Escape C28 · free text C30 | - |
| combobox closed states (3) | empty C22 · no match C25 · brands failure C33 | - |
| combobox forms (2) | new C21 · edit C31 | - |
| new form defaults (8) | type C1 · brand C1 · color C1 · tone C1 · density C1 · nozzle C1 · bed C1 · minimum C1 | - |
| new form after save (2) | `201` resets C4 · failure keeps C5 | - |
| tone in the form (4) | none C47 · pick C49 · remove C50 · edit prefill C51 | - |
| tone in the table (2) | with tone C52 · without tone C53 | - |
| migration directions (2) | down C45 · up C46 | - |
| Landing doors (5) | door 1 C45 · door 2 C34 · door 3 C10 · door 4 C48 · door 5 C16 | - |

- Claims naming a status code, route or response shape: C7, C8, C9, C15, C34-C44 - each has an e2e that crosses the HTTP boundary
- `listBrands` decide e é alcançado por rota: o contrato na rota (C9) e uma linha por decisão chamando o serviço direto contra o banco (C10-C15), como pede a política do `AGENTS.md`
- `matchOptions` é função pura: um caso por linha no próprio `combobox.test.tsx` (C16-C20), além da tela (C21-C25)
- No other check claims more than the single case its proof exercises

## Swept

- validation: C36, C40 (formato do `colorHex`); C3 (mínimo vazio vira `null`)
- failure modes: C5 (falha do `POST` mantém o formulário); C33 (falha das marcas não derruba a tela)
- idempotency: n/a - `POST /materials` não tem chave de deduplicação e não ganha uma aqui (materiais repetidos já são permitidos); `GET /materials/brands` só lê
- authorization: C7, C8 (rota nova com o mesmo acesso de `GET /materials`); C42, C43 (escrita continua só admin, AD-018)
- concurrency: n/a - nenhuma coluna decrementada nem unicidade nova; dois `PATCH` simultâneos no tom seguem a última escrita, como todo campo do material hoje
- data lifecycle: C45, C46 (coluna nula sem backfill; o `down()` perde o tom, como registrado no `Impact`)
- dependency failure: C33 (o web degrada sem sugestões quando a rota de marcas falha)
- state transitions: C49, C50 (sem tom -> com tom -> sem tom); C4 (formulário volta aos padrões só depois do `201`)
- observability: n/a - nenhum requisito de log; erros saem pelo filtro global (AD-001)

## Handoff

- S1-S7 ≈ 38k tokens (≈ 150 KB / 4: os arquivos de `materials` na API e no web somam 65 KB por `wc -c`, mais ~25 KB de arquivos novos e 60 KB das 6 fixtures de outras telas que só ganham `colorHex: null`), abaixo do orçamento de 150k - one builder
- Mechanism: one builder (cabe no orçamento, sem pergunta)

- **Boundary:** C7-C15, C34-C46, C55 closed at `5314026` (API); C1-C6, C16-C33, C47-C54 closed in the web commit that carries this line; C56-C57 closed at `f627535`
- **Settled mid-build:** commits locais na branch `feat/material-brand-tone`, sem push (pedido do usuário, já que o `AGENTS.md` exige pedido explícito para commit)
- **Abandoned:** asserir `getAttribute("style") === null` na amostra sem tom - o React deixa o atributo vazio, não ausente; a afirmação do check (amostra sem cor) é `style.background === ""`. Dois testes de chaves exatas da resposta de material (`materials.e2e-spec.ts`, `inventory.e2e-spec.ts`) tiveram o conjunto esperado ampliado com `colorHex`, nunca relaxado
