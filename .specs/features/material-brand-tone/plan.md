# Padrões do novo material, sugestão de marca e tom da cor

## Problem

Para cadastrar um filamento, o administrador preenche do zero densidade, temperatura do bico,
temperatura da mesa e estoque mínimo, mesmo que quase todo material comece com os mesmos valores
(1,24 g/cm³, 220 °C, 65 °C, 100 g). Depois de salvar, o formulário volta vazio e ele digita tudo de
novo no próximo material.

A marca é texto livre sem nenhuma ajuda: a mesma marca acaba gravada como `Voolt`, `voolt` e
`Voolt3D`, e a lista de materiais, a busca e o nome exibido em rolos, orçamentos e ficha técnica
(`tipo · marca · cor`) passam a mostrar o mesmo fornecedor como três marcas diferentes.

A cor é só um nome (`Silk Gold`, `Preto Fosco`). Na tabela de materiais não há como ver a
aparência do filamento, e dois nomes parecidos só se distinguem lendo.

O pedido não traz números de incidência; a motivação é de usabilidade do cadastro.

Quando isto entrar: o formulário novo já vem com os valores usuais e volta para eles depois de
salvar; o campo Marca sugere as marcas já usadas a partir da primeira letra, sem impedir uma marca
nova; e cada material pode ter um tom (`#rrggbb`) que aparece como amostra ao lado do nome da cor
na tabela de materiais.

## Flow

Reusa o módulo `materials` (controller, service, DTOs e `toMaterialResponse`), o `RolesGuard` com
`@Roles('production', 'sales')` já usado em `GET /materials`, o `EntityForm` (AD-021) e o
`readNumbers` (issue #9) da tela; nenhum módulo novo na API.

1. migration `AddMaterialColorHex` (door 1) adiciona `materials.color_hex` nula, sem tocar nas linhas existentes
2. `POST /materials` e `PATCH /materials/:id` -> `CreateMaterialDto` / `UpdateMaterialDto` (exists) aceitam `colorHex` (door 2), passam para minúsculas e recusam outro formato com `400` -> `MaterialsService` (exists) grava -> `toMaterialResponse` (exists) devolve `colorHex`
3. `GET /materials/brands` (door 3) -> `MaterialsController` (exists) -> `MaterialsService` (exists) agrupa `brand` por `lower(brand)`, escolhe a grafia do material mais recente e ordena -> `string[]`
4. tela `/materials` (exists) -> `apiFetch` (exists, AD-005) carrega `/auth/me`, `/materials` e, para o admin, `/materials/brands`
5. `EntityForm` (exists, AD-021) ganha `FieldConfig.render` (door 4) -> o campo Marca renderiza o `Combobox` (door 5) com as marcas carregadas, e o campo Cor renderiza o texto + a amostra (`<input type="color">`) + "Remover"
6. envio -> `buildBody` (exists) junta `brand`, `colorHex` (`null` quando sem tom) e os números de `readNumbers` -> `POST`/`PATCH`; no sucesso do novo, o formulário volta para `NEW_MATERIAL_DEFAULTS` e a marca salva entra nas sugestões
7. out: `DataTable` (exists) desenha na coluna Cor a amostra do `colorHex` ao lado do nome

## Impact

| Front | What changes |
| --- | --- |
| domain | novo termo: `Tom` - a aparência da cor, um hex `#rrggbb` opcional, `colorHex` no contrato e `color_hex` no banco. Já descrito no `CONTEXT.md` (alteração ainda não commitada na árvore, entra nesta mudança) |
| domain | termo existente: `Cor` continua sendo o nome livre; `Marca` continua texto livre, só ganha sugestão. Ninguém ramifica por eles hoje: `materialDisplayName` (products) e `stock-alerts` só concatenam `tipo · marca · cor` |
| contract | `MaterialResponse` (API) e `Material` (`web/src/lib/materials.ts`) ganham `colorHex: string \| null`. Quem tipa `Material` no web: `materials`, `inventory`, `inventory/[id]`, `inventory/[id]/label`, `pricing`, painel inicial e `product-variant-editor`; as fixtures dos testes dessas telas ganham `colorHex: null` (mudança de tipo, não de comportamento) |
| tests | os testes de `materials/page.test.tsx` que digitam densidade/temperaturas no formulário novo partem de um campo vazio; com os padrões, eles passam a limpar o campo antes (o comportamento mudou). O helper `api/test/materials-helper.ts` ganha `colorHex` opcional |
| stored data | coluna nova nula, sem backfill: toda linha existente fica "sem tom". O `down()` derruba a coluna e o tom gravado não volta |

## Relations

None - no stored-data shape change. Só uma coluna nula nova em `materials`, sem entidade nem cardinalidade nova; ela está no door 1.

## Surface

Only routes this adds or whose signature changes.

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /materials/brands` | - | `string[]` | `200`, `401` |
| `POST /materials` | + `colorHex?` (`#rrggbb` ou `null`) | `Material` + `colorHex` | `201`, `400`, `401`, `403` |
| `PATCH /materials/:id` | + `colorHex?` (`#rrggbb`, `null` remove, omitido preserva) | `Material` + `colorHex` | `200`, `400`, `401`, `403`, `404` |
| `GET /materials` | - | `items[].colorHex` | `200`, `400`, `401` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. Coluna do tom | migration `AddMaterialColorHex`: `ALTER TABLE "materials" ADD "color_hex" character varying(7)` (nula, sem `DEFAULT`, sem `CHECK`); o valor gravado é sempre minúsculo. `down()`: `DROP COLUMN "color_hex"` | `CHECK (color_hex ~ '^#[0-9a-f]{6}$')`: a API é a única escritora e já recusa com `400`; o `CHECK` exigiria prova direta no banco por lado e um `isCheckViolation` que nenhum cenário alcança (a lição do AD-023). Guardar como inteiro RGB ou sem `#`: o `<input type="color">` fala `#rrggbb`, e toda leitura teria que converter |
| 2. Campo `colorHex` no contrato de materiais | `colorHex: string \| null` em `MaterialResponse` e `Material`; entrada `@IsOptional()` + `@Transform(lowercase)` + `@Matches(/^#[0-9a-f]{6}$/, { message: 'colorHex deve estar no formato #rrggbb' })`; no `PATCH`, `undefined` preserva e `null` remove (mesma semântica do `minimumStockGrams`, Fase 11) | `""` para remover: faria a string vazia ser um valor válido ao lado de um formato inválido; nome `color` ou `hex`: `color` já é o nome livre, e `colorHex` diz o formato |
| 3. Rota de marcas | `@Roles('production', 'sales') @Get('brands')` declarada antes de qualquer `:id`; SQL `SELECT DISTINCT ON (lower(brand)) brand FROM materials ORDER BY lower(brand), created_at DESC, id DESC`; resposta `200` com `string[]` | filtrar no web a partir de `GET /materials?pageSize=100`: o teto de 100 (AD-020) corta marcas quando houver mais materiais; envelope `{ items, total, page, pageSize }` do AD-020: a lista não é paginada e não tem `total` que signifique algo |
| 4. Campo customizado no `EntityForm` (contrato reutilizável, AD-021) | `FieldConfig<V>` ganha `render?: (props: { values: V; onChange: (values: V) => void }) => ReactNode`; com `render`, o `EntityForm` envolve o retorno no mesmo `<Field label>` (o id do `Field` continua chegando ao `Input` interno pelo contexto) | novos `type: "combobox"` e `type: "color"`: o componente genérico passaria a ter um ramo por widget de domínio; sair do `EntityForm` na tela de materiais: duplicaria o markup que o AD-021 existe para evitar |
| 5. Combobox acessível próprio | `web/src/components/ui/combobox.tsx`: `Combobox({ value, onChange, options, maxOptions = 8 })`, padrão ARIA 1.2 "combobox com lista": `<input role="combobox" aria-expanded aria-controls aria-autocomplete="list" aria-activedescendant>` + `<ul role="listbox">` com `role="option"`; filtro puro `matchOptions(options, text, max)` (normaliza NFD, remove diacríticos, minúsculas, `includes`) | `<datalist>`: o casamento é do navegador (prefixo no Safari, substring no Chrome e Firefox), sem ignorar acentos, sem limite de 8 e sem como testar no jsdom; biblioteca (`downshift`, Headless UI): dependência nova para um campo |

- Nothing else in this change is hard to reverse: os padrões do formulário são constantes do web, a amostra é só apresentação, e a ordem e o limite das sugestões mudam num refactor.

## Criteria

### S1: Formulário "Novo material" com os valores usuais (P1)

O admin abre a tela e o formulário novo já tem os valores mais comuns; depois de salvar, volta para eles.

**Acceptance Criteria**

1. WHEN o admin abre `/materials` THEN the system SHALL mostrar o formulário "Novo material" com Densidade `1,24`, Temperatura do bico `220`, Temperatura da mesa `65`, Estoque mínimo `100`, Tipo, Marca e Cor vazios, e sem tom
2. WHEN o admin envia o formulário novo sem mudar os padrões THEN the system SHALL enviar `densityGCm3: 1.24`, `nozzleTempC: 220`, `bedTempC: 65` e `minimumStockGrams: 100` para `POST /materials`
3. WHEN o admin apaga o Estoque mínimo e envia THEN the system SHALL enviar `minimumStockGrams: null`
4. WHEN `POST /materials` responde `201` THEN the system SHALL voltar o formulário novo para os valores do AC 1, inclusive marca vazia e sem tom, mesmo que todos tenham sido alterados antes do envio
5. IF `POST /materials` falha THEN the system SHALL manter no formulário os valores digitados e mostrar o `{ error }` da API
6. WHEN o admin abre a edição de um material THEN the system SHALL preencher o formulário com os valores do material (um material sem mínimo mostra o campo vazio), nunca com os padrões do AC 1

**Independent test:** abrir `/materials` como admin, salvar sem tocar nos números e conferir o corpo do `POST` e o formulário de volta aos padrões.

### S2: Marcas já usadas pela API (P1)

`GET /materials/brands` devolve uma marca por grafia ignorando maiúsculas, em ordem.

**Acceptance Criteria**

7. WHEN um usuário `admin`, `production` ou `sales` chama `GET /materials/brands` THEN the system SHALL responder `200` com um array de strings
8. IF a chamada não tem sessão THEN the system SHALL responder `401` com `{ "error": "Sessão expirada ou inexistente. Entre novamente" }`
9. WHEN existem materiais com marca `voolt` (criado antes) e `VOOLT` (criado depois) THEN the system SHALL devolver uma única entrada `VOOLT`
10. WHEN uma marca existe só em materiais inativos THEN the system SHALL incluí-la na lista
11. The system SHALL ordenar as marcas em ordem alfabética ignorando maiúsculas: materiais com `Creality`, `bambu` e `Anycubic` resultam em `["Anycubic", "bambu", "Creality"]`
12. WHEN não há nenhum material THEN the system SHALL responder `200` com `[]`

**Independent test:** semear `voolt` e depois `VOOLT` e `Anycubic` inativo, chamar a rota como `sales` e conferir `["Anycubic", "VOOLT"]`.

### S3: Sugestão de marca no formulário (P1)

O campo Marca, no novo e na edição, sugere as marcas já usadas e aceita uma nova.

**Acceptance Criteria**

13. WHEN o admin digita `a` no campo Marca e as marcas carregadas são `["3D Fila", "Bambu Lab", "Voolt"]` THEN the system SHALL abrir a lista com `3D Fila` e `Bambu Lab`, nessa ordem
14. WHILE o campo Marca está vazio the system SHALL manter a lista fechada (`aria-expanded="false"`)
15. WHEN o admin digita `ACAO` e existe a marca `Ação 3D` THEN the system SHALL sugerir `Ação 3D` (ignora maiúsculas e acentos)
16. WHEN o texto casa com 10 marcas THEN the system SHALL mostrar exatamente 8 sugestões, as 8 primeiras na ordem da API
17. IF o texto não casa com nenhuma marca THEN the system SHALL manter a lista fechada, sem mensagem
18. WHEN o admin clica numa sugestão THEN the system SHALL colocar no campo o texto exato da sugestão e fechar a lista
19. WHEN o admin pressiona `ArrowDown` e depois `Enter` com a lista aberta THEN the system SHALL escolher a primeira sugestão e SHALL NOT enviar o formulário
20. WHEN o admin pressiona `Escape` com a lista aberta THEN the system SHALL fechar a lista e manter o texto digitado
21. The system SHALL expor o campo Marca como `role="combobox"` com nome acessível "Marca", `aria-controls` apontando para o `role="listbox"`, sugestões com `role="option"` e `aria-activedescendant` na sugestão destacada
22. WHEN o admin digita `Marca Nova`, que não está na lista, e envia THEN the system SHALL enviar `brand: "Marca Nova"`
23. WHEN o admin abre a edição de um material THEN the system SHALL oferecer o mesmo combobox no campo Marca, com as mesmas sugestões
24. WHEN um material é salvo com a marca `Marca Nova` THEN the system SHALL incluir `Marca Nova` nas sugestões sem recarregar a página
25. IF `GET /materials/brands` falha THEN the system SHALL renderizar a tela normalmente, sem alerta, com o campo Marca aceitando texto livre e sem sugestões

**Independent test:** no formulário novo, digitar `a`, escolher `Bambu Lab` pelo teclado e conferir `brand: "Bambu Lab"` no `POST`.

### S4: Tom na API (P1)

O material guarda um tom opcional `#rrggbb`, sempre em minúsculas.

**Acceptance Criteria**

26. WHEN `POST /materials` recebe `colorHex: "#FF8800"` THEN the system SHALL responder `201` com `colorHex: "#ff8800"` e gravar `#ff8800`
27. WHEN `POST /materials` não recebe `colorHex`, ou recebe `null` THEN the system SHALL responder `201` com `colorHex: null`
28. IF `POST /materials` recebe `colorHex` igual a `"#fff"`, `"ff8800"`, `"#gg0000"`, `"#ff88001"`, `""` ou `123` THEN the system SHALL responder `400` com `{ "error": "colorHex deve estar no formato #rrggbb" }` e SHALL NOT gravar o material
29. WHEN `PATCH /materials/:id` recebe `colorHex: "#00AA11"` THEN the system SHALL responder `200` com `colorHex: "#00aa11"`
30. WHEN `PATCH /materials/:id` recebe `colorHex: null` num material com tom THEN the system SHALL responder `200` com `colorHex: null` e gravar `NULL`
31. WHEN `PATCH /materials/:id` não recebe `colorHex` THEN the system SHALL preservar o tom gravado
32. IF `PATCH /materials/:id` recebe `colorHex: "#ff88"` THEN the system SHALL responder `400` com `{ "error": "colorHex deve estar no formato #rrggbb" }` e manter o tom gravado
33. The system SHALL incluir `colorHex` (hex minúsculo ou `null`) em cada item de `GET /materials`

**Independent test:** criar com `#FF8800`, editar com `null` e listar, conferindo `#ff8800` e depois `null`.

### S5: Migration do tom sobre linhas existentes (P1)

A coluna entra e sai sem perder materiais.

**Acceptance Criteria**

34. WHEN o `down()` de `AddMaterialColorHex` roda sobre materiais semeados THEN the system SHALL remover a coluna `color_hex` e manter as linhas com tipo, marca, cor, densidade, temperaturas, situação e mínimo inalterados
35. WHEN o `up()` roda em seguida THEN the system SHALL recriar `color_hex` como nula e deixar as linhas existentes com `NULL`

**Independent test:** `npm --prefix api run test:e2e -- color-hex-migration`.

### S6: Tom no formulário e na tabela (P1)

O admin escolhe o tom numa amostra ao lado da Cor, e a tabela mostra a amostra.

**Acceptance Criteria**

36. WHEN o formulário novo abre THEN the system SHALL mostrar a amostra "sem tom", rotulada "Escolher tom", e SHALL NOT mostrar o botão "Remover"
37. The system SHALL fazer da amostra o rótulo de um `<input type="color">` com nome acessível "Tom", ao lado do campo Cor, de modo que clicar nela abra o seletor nativo
38. WHEN o admin escolhe `#ff8800` no seletor THEN the system SHALL pintar a amostra com `#ff8800`, mostrar o botão "Remover" e, no envio, mandar `colorHex: "#ff8800"`
39. WHEN o admin clica "Remover" THEN the system SHALL voltar a amostra para "sem tom", esconder o botão "Remover" e, no envio, mandar `colorHex: null`
40. WHEN a edição de um material com `colorHex: "#ff8800"` abre THEN the system SHALL mostrar a amostra com `#ff8800` e o botão "Remover"; num material com `colorHex: null`, a amostra "sem tom"
41. WHEN um material tem `colorHex` THEN the system SHALL mostrar na coluna Cor da tabela, ao lado do nome, uma amostra `role="img"` com nome acessível `Tom #ff8800`
42. WHEN um material tem `colorHex: null` THEN the system SHALL mostrar na coluna Cor só o nome, sem amostra

**Independent test:** escolher `#ff8800`, salvar e ver a amostra laranja ao lado do nome na nova linha da tabela.

## Out of scope

Product capabilities only. Process and harness rules live in AGENTS.md or as Observable `n/a`.

| Excluded | Why |
| --- | --- |
| Amostra do tom em rolos, etiqueta, calculadora, catálogo e painel | o pedido limita a amostra à tabela de materiais "por enquanto" |
| Padrões configuráveis em Configurações (densidade, temperaturas, mínimo) | são constantes do web; a API não muda |
| Normalizar ou fundir marcas já gravadas com grafias diferentes | a sugestão evita grafias novas; corrigir as antigas é edição manual |
| Agrupar marcas ignorando acentos na API | o pedido agrupa só por maiúsculas; acento é ignorado só na busca do combobox |
| Paleta de tons pré-definidos ou tom por marca | o tom é um hex livre escolhido no seletor nativo |

## Assumptions

Defaults that are not already a numbered criterion. Drop a row once it is.

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| "Material mais recente" que dá a grafia da marca | maior `created_at`, desempate por `id` | `updated_at` muda ao desativar ou ajustar o mínimo, o que não tem relação com a grafia; criar é o ato que escolhe a grafia | n |
| Formato da resposta de `GET /materials/brands` | `string[]` puro | a lista não é paginada; o único consumidor é o web, atualizado na mesma mudança | n |
| Quem carrega as marcas no web | só o admin, que é o único que vê os formulários | produção e vendas não têm onde usar a sugestão | n |
| Valor do `<input type="color">` quando sem tom | o input nativo mostra `#000000`, mas o estado do formulário guarda `""` e envia `null` | o input nativo não tem estado vazio; quem decide é o estado, não o input | n |
| O formulário envia `colorHex` sempre | `POST` e `PATCH` mandam `colorHex` (hex ou `null`) em todo envio do formulário | o formulário de edição é a fonte inteira do material; o "Desativar/Reativar" continua mandando só `active` | n |

**Open questions:** none - all resolved or logged above.

## Observable

Worksheet, not the review. `n/a` needs its reason. One row may group the same decision
across several routes.

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `/materials` | loading state | existing - `Loading` enquanto `/auth/me` e `/materials` carregam; as marcas não seguram a tela (AC 25) |
| screen `/materials` | error state | existing - `PageError` com "Tentar novamente"; falha só das marcas em AC 25 |
| screen `/materials` | empty state | existing - "Nenhum material encontrado."; formulário novo com padrões mesmo sem materiais (AC 1) |
| screen `/materials` | unauthorised state | existing - produção e vendas veem a lista sem formulários; a amostra da tabela aparece para todos (AC 41) |
| screen `/materials` | density and ordering | AC 13, AC 16 |
| screen `/materials` | destructive action confirms | n/a - "Remover" o tom só muda o formulário, que ainda precisa ser salvo; desativar já confirma (existing) |
| combobox Marca | empty, no-match and failure states | AC 14, AC 17, AC 25 |
| API `GET /materials/brands` | response shape | AC 7 |
| API `GET /materials/brands` | error shape and codes | AC 8 |
| API `GET /materials/brands` | who may call it | AC 7 |
| API `POST /materials`, `PATCH /materials/:id` | error shape and codes for `colorHex` | AC 28, AC 32 |
| all changed `/materials*` | versioning, rate limits | n/a - API interna consumida só pelo web do mesmo repositório, sem versionamento nem limite em nenhuma rota |
| collection brands | grouping criterion and duplicates | AC 9 |
| collection brands | naming | AC 9 |
| collection brands | ordering | AC 11 |
| collection brands | the exception that does not fit | AC 10, AC 12 |

## Sources

- Pedido do usuário nesta sessão (2026-10-04) - fixa os padrões, a rota de marcas, o combobox, o tom e as provas
- `CONTEXT.md` (alteração não commitada) - define Cor, Tom e Marca
