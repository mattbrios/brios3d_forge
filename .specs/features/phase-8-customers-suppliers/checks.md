# Fase 8 — Clientes e fornecedores · checks

Profile: standard
Plan: `.specs/features/phase-8-customers-suppliers/plan.md`

## Intent

53 checks em 9 fatias · 1 one-way door · nenhuma questão aberta

O `AGENTS.md` não declara perfil. Uso `standard`, mesma régua das Fases 1-7 (só a Fase 0 usou
`light`): a maior parte desta fase copia o padrão de CRUD já provado (Fase 6/7), mas duas formas
são genuinamente novas e sem analogê no repositório. Primeiro, `document` é a primeira coluna do
sistema que é **opcional e única ao mesmo tempo** - `email` (`users`, Fase 3) e `name`
(`sales-channels`, Fase 5) são sempre obrigatórios antes de checar unicidade; aqui a ausência
(`null`) tem que conviver em vários registros enquanto a presença é única. Segundo, o dígito
verificador de CPF/CNPJ é a primeira validação de documento fiscal do sistema: o algoritmo tem um
quirk conhecido (sequências de dígitos repetidos, como `111.111.111-11`, satisfazem a conta do
dígito verificador mas não são documentos válidos) que uma implementação ingênua esquece
facilmente e que um `light` não pegaria - um `standard` tabula esse caso explicitamente e
recomputa a junção de `Coverage` a partir das fontes, não do resumo do autor.

Os valores esperados vêm do `plan.md` (`## Criteria` e `## Landing`) e ficam escritos
**literalmente** nas asserções, nunca derivados chamando o próprio código em teste.

Os e2e (`npm --prefix api run test:e2e`) montam o `AppModule` contra o `forge_test`, com o `db` no
ar e as migrations aplicadas antes da suíte (padrão da Fase 0). Dois arquivos novos,
`customers.e2e-spec.ts` e `suppliers.e2e-spec.ts`, cada um com seu próprio helper
(`customers-helper.ts`, `suppliers-helper.ts`), espelhando `materials.e2e-spec.ts`/
`materials-helper.ts` (Fase 6). O validador de dígito verificador (`is-valid-document.ts`, novo,
reaproveitado pelos dois módulos) ganha um spec Vitest isolado, no mesmo nível de
`pricing.service.spec.ts`. No web, Vitest + Testing Library com o `fetch` substituído, como em
`materials/page.test.tsx`; nenhum componente de `crud/` é retestado aqui -
`DataTable`/`EntityForm`/`ConfirmDialog` já têm seu contrato genérico provado pela Fase 6 e esta
fase só consome o existente.

## Checks

### S1 - Cadastrar cliente, admin e vendas · 4 files · 20 KB · ~5k

**C1** - Tabela sobre sessão de `admin` e de `sales`: `POST /customers` só com `name` (`"Ana
Silva"`, trim aplicado) responde `201` para os dois, com `id` de string não vazia, `active: true`
e `document`/`phone`/`email`/`address` todos `null` (AC 1, AC 5)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "admin and sales create a customer with only name filled"`

**C2** - Tabela sobre um CPF válido (`"123.456.789-09"`) e um CNPJ válido
(`"11.222.333/0001-81"`) em `POST /customers`: cada um responde `201` com `document` gravado só
com os dígitos (`"12345678909"` e `"11222333000181"`) (AC 2)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "stores document as digits only for a valid CPF and CNPJ"`

**C3** - Tabela sobre `document` com 10 dígitos, 15 dígitos, um CPF com dígito verificador errado,
um CNPJ com dígito verificador errado, um CPF com todos os dígitos iguais
(`"111.111.111-11"`) e um CNPJ com todos os dígitos iguais (`"11.111.111/1111-11"`) em
`POST /customers` (6 casos): cada um responde `400`, e nenhum cliente é persistido (AC 3)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "rejects a document with the wrong length, an invalid check digit or a repeated-digit sequence"`

**C4** - Tabela sobre um segundo `POST /customers` com o mesmo `document` já cadastrado, e com o
mesmo `document` formatado de outro jeito (2 casos) em `POST /customers`: cada um responde `409`,
e nenhum segundo cliente é persistido (AC 4)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "rejects a duplicate document even with different formatting"`

**C5** - Tabela sobre `email` inválido, `phone` com 31 caracteres e `address` com 301 caracteres
em `POST /customers` (3 casos): cada um responde `400`, e nenhum cliente é persistido (AC 6)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "rejects an invalid email or an over-length phone or address"`

**C6** - Tabela sobre `name` vazio, `name` só com espaços e `name` com 151 caracteres em
`POST /customers` (3 casos): cada um responde `400` (AC 7)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "rejects an empty, blank or over-length name"`

**C7** - `POST /customers` com sessão de `production` responde `403`, e nada é persistido (AC 8)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "production gets 403 on POST /customers"`

**C8** - `POST /customers` sem cookie de sessão responde `401`, e nada é persistido (AC 9)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "POST /customers without a session is 401"`

### S2 - Listar clientes com paginação e busca · 3 files · 10 KB · ~3k

**C9** - Com 3 clientes semeados, `GET /customers` sem parâmetros e sessão de `admin`,
`production` e `sales` responde `200` para os três com `{ items, total: 3, page: 1, pageSize: 20 }`
e `items` ordenado por `name` (AC 10)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "GET /customers returns the first page for every role, ordered by name"`

**C10** - Com clientes `"Ana Silva"`/`"ana silva Filmes"`/`"João Pereira"` semeados,
`GET /customers?search=Silva` responde só com os dois cujo `name` contém `Silva`, ignorando caixa
(AC 11)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "searches customers by name ignoring case"`

**C11** - Com 15 clientes semeados (nomeados para uma ordenação previsível),
`GET /customers?page=2&pageSize=10` responde com os 5 itens seguintes aos 10 primeiros da
ordenação de C9 e `total: 15` (AC 12)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "paginates customers with page and pageSize"`

**C12** - Tabela sobre `page=0`, `pageSize=0` e `pageSize=101` em `GET /customers` (3 casos): cada
um responde `400` (AC 13)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "rejects invalid page and pageSize for customers"`

**C13** - `GET /customers` sem cookie de sessão responde `401` (AC 14)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "GET /customers without a session is 401"`

### S3 - Editar cliente, admin e vendas · 4 files · 10 KB · ~3k

**C14** - Tabela sobre sessão de `admin` e de `sales`: `PATCH /customers/:id` alterando só `phone`
responde `200` com `phone` novo e todos os outros campos iguais ao cliente antes do `PATCH`, para
os dois papéis (AC 15)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "admin and sales patch only the sent fields on a customer"`

**C15** - `PATCH /customers/:id` com um uuid que não existe responde `404` (AC 16)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "PATCH customers with an unknown id is 404"`

**C16** - Tabela sobre um CPF com dígito verificador errado, um `email` inválido e um `name` vazio
em `PATCH /customers/:id` (3 casos, mesmas regras do AC 3, AC 6 e AC 7): cada um responde `400`, e
o registro no banco continua com os valores anteriores (AC 17)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "rejects invalid fields on customer PATCH without changing the record"`

**C17** - `PATCH /customers/:id` trocando `document` para um valor já usado por outro cliente
responde `409`, e o registro não muda (AC 18)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "rejects changing a customer's document to one already used by another customer"`

**C18** - `PATCH /customers/:id` com sessão de `production` responde `403` (AC 19)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "production gets 403 on PATCH /customers"`

**C19** - `PATCH /customers/:id` sem cookie de sessão responde `401` (AC 20)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "PATCH /customers without a session is 401"`

### S4 - Ativar e desativar cliente · 1 file · 2 KB · ~1k

**C20** - `PATCH /customers/:id` com `{ "active": false }` responde `200` com `active: false`, e o
cliente continua existindo no banco (AC 21)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "deactivates a customer without deleting it"`

**C21** - `PATCH /customers/:id` com `{ "active": true }` num cliente antes desativado responde
`200` com `active: true` (AC 22)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "reactivates an inactive customer"`

**C22** - `DELETE /customers/:id` responde `404` (rota nunca declarada no controller) (AC 23)
Proof: `npm --prefix api run test:e2e -- test/customers.e2e-spec.ts -t "DELETE /customers/:id does not exist"`

### S5 - Cadastrar fornecedor, só admin · 4 files · 20 KB · ~5k

**C23** - `POST /suppliers` só com `name` (`"Filamentos ABC"`, trim aplicado) e sessão de `admin`
responde `201` com `id` de string não vazia, `active: true` e `document`/`phone`/`email`/`address`
todos `null` (AC 24, AC 28)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "creates a supplier with only name filled"`

**C24** - Tabela sobre um CPF válido e um CNPJ válido em `POST /suppliers`: cada um responde `201`
com `document` gravado só com os dígitos (AC 25)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "stores supplier document as digits only for a valid CPF and CNPJ"`

**C25** - Tabela sobre `document` com 10 dígitos, 15 dígitos, um CPF com dígito verificador
errado, um CNPJ com dígito verificador errado, um CPF com todos os dígitos iguais e um CNPJ com
todos os dígitos iguais em `POST /suppliers` (6 casos): cada um responde `400`, e nenhum
fornecedor é persistido (AC 26)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "rejects a supplier document with the wrong length, an invalid check digit or a repeated-digit sequence"`

**C26** - Tabela sobre um segundo `POST /suppliers` com o mesmo `document` já cadastrado, e com o
mesmo `document` formatado de outro jeito (2 casos): cada um responde `409`, e nenhum segundo
fornecedor é persistido (AC 27)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "rejects a duplicate supplier document even with different formatting"`

**C27** - Tabela sobre `email` inválido, `phone` com 31 caracteres e `address` com 301 caracteres
em `POST /suppliers` (3 casos): cada um responde `400`, e nenhum fornecedor é persistido (AC 29)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "rejects an invalid email or an over-length phone or address on suppliers"`

**C28** - Tabela sobre `name` vazio, `name` só com espaços e `name` com 151 caracteres em
`POST /suppliers` (3 casos): cada um responde `400` (AC 30)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "rejects an empty, blank or over-length supplier name"`

**C29** - Tabela sobre sessão de `production` e de `sales`: `POST /suppliers` responde `403` para
os dois, e nada é persistido (AC 31)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "non-admin roles get 403 on POST /suppliers"`

**C30** - `POST /suppliers` sem cookie de sessão responde `401`, e nada é persistido (AC 32)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "POST /suppliers without a session is 401"`

### S6 - Listar fornecedores com paginação e busca · 3 files · 10 KB · ~3k

**C31** - Com 3 fornecedores semeados, `GET /suppliers` sem parâmetros e sessão de `admin`,
`production` e `sales` responde `200` para os três com `{ items, total: 3, page: 1, pageSize: 20 }`
e `items` ordenado por `name` (AC 33)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "GET /suppliers returns the first page for every role, ordered by name"`

**C32** - Com fornecedores `"Filamentos ABC"`/`"filamentos ABC Ltda"`/`"Resinas XYZ"` semeados,
`GET /suppliers?search=Filamentos` responde só com os dois cujo `name` contém `Filamentos`,
ignorando caixa (AC 34)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "searches suppliers by name ignoring case"`

**C33** - Com 15 fornecedores semeados, `GET /suppliers?page=2&pageSize=10` responde com os 5
itens seguintes aos 10 primeiros da ordenação de C31 e `total: 15` (AC 35)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "paginates suppliers with page and pageSize"`

**C34** - Tabela sobre `page=0`, `pageSize=0` e `pageSize=101` em `GET /suppliers` (3 casos): cada
um responde `400` (AC 36)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "rejects invalid page and pageSize for suppliers"`

**C35** - `GET /suppliers` sem cookie de sessão responde `401` (AC 37)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "GET /suppliers without a session is 401"`

### S7 - Editar fornecedor, só admin · 4 files · 10 KB · ~3k

**C36** - `PATCH /suppliers/:id` (sessão `admin`) alterando só `phone` responde `200` com `phone`
novo e todos os outros campos iguais ao fornecedor antes do `PATCH` (AC 38)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "admin patches only the sent fields on a supplier"`

**C37** - `PATCH /suppliers/:id` com um uuid que não existe responde `404` (AC 39)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "PATCH suppliers with an unknown id is 404"`

**C38** - Tabela sobre um CNPJ com dígito verificador errado, um `email` inválido e um `name`
vazio em `PATCH /suppliers/:id` (3 casos, mesmas regras do AC 26, AC 29 e AC 30): cada um responde
`400`, e o registro no banco continua com os valores anteriores (AC 40)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "rejects invalid fields on supplier PATCH without changing the record"`

**C39** - `PATCH /suppliers/:id` trocando `document` para um valor já usado por outro fornecedor
responde `409`, e o registro não muda (AC 41)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "rejects changing a supplier's document to one already used by another supplier"`

**C40** - Tabela sobre sessão de `production` e de `sales`: `PATCH /suppliers/:id` responde `403`
para os dois (AC 42)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "non-admin roles get 403 on PATCH /suppliers"`

**C41** - `PATCH /suppliers/:id` sem cookie de sessão responde `401` (AC 43)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "PATCH /suppliers without a session is 401"`

### S8 - Ativar e desativar fornecedor · 1 file · 2 KB · ~1k

**C42** - `PATCH /suppliers/:id` com `{ "active": false }` responde `200` com `active: false`, e o
fornecedor continua existindo no banco (AC 44)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "deactivates a supplier without deleting it"`

**C43** - `PATCH /suppliers/:id` com `{ "active": true }` num fornecedor antes desativado responde
`200` com `active: true` (AC 45)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "reactivates an inactive supplier"`

**C44** - `DELETE /suppliers/:id` responde `404` (rota nunca declarada no controller) (AC 46)
Proof: `npm --prefix api run test:e2e -- test/suppliers.e2e-spec.ts -t "DELETE /suppliers/:id does not exist"`

### S9 - Web - telas de clientes e fornecedores no padrão de CRUD reutilizável · 6 files · 35 KB · ~10k

**C45** - As telas `/customers` e `/suppliers` mostram "Carregando…" antes do `GET`
correspondente (mock) resolver (AC 47)
Proof: `npm --prefix web run test -- src/app/(app)/customers/page.test.tsx -t "shows loading"`
Proof: `npm --prefix web run test -- src/app/(app)/suppliers/page.test.tsx -t "shows loading"`

**C46** - Com o `GET` correspondente (mock) rejeitando, as telas `/customers` e `/suppliers`
mostram a mensagem de erro e um botão "Tentar novamente" que refaz a chamada (AC 48)
Proof: `npm --prefix web run test -- src/app/(app)/customers/page.test.tsx -t "shows the error and retries"`
Proof: `npm --prefix web run test -- src/app/(app)/suppliers/page.test.tsx -t "shows the error and retries"`

**C47** - Com o `GET` correspondente (mock) resolvendo `{ items: [], total: 0, page: 1, pageSize:
20 }`, as telas `/customers` e `/suppliers` mostram um estado vazio com um texto diferente do
estado de erro (AC 49)
Proof: `npm --prefix web run test -- src/app/(app)/customers/page.test.tsx -t "shows an empty state when there are no customers"`
Proof: `npm --prefix web run test -- src/app/(app)/suppliers/page.test.tsx -t "shows an empty state when there are no suppliers"`

**C48** - Como `production`, a tela `/customers` mostra a listagem sem formulário de criação e
sem botões de editar/ativar/desativar (AC 50)
Proof: `npm --prefix web run test -- src/app/(app)/customers/page.test.tsx -t "production sees only the read-only list"`

**C49** - Tabela sobre `production` e `sales`: a tela `/suppliers` mostra a listagem sem
formulário de criação e sem botões de editar/ativar/desativar, para os dois papéis (AC 51)
Proof: `npm --prefix web run test -- src/app/(app)/suppliers/page.test.tsx -t "production and sales see only the read-only list"`

**C50** - Tabela sobre `admin` e `sales` na tela `/customers`: clicar em "Desativar" numa linha
abre o `ConfirmDialog`; cancelar não chama a API, e confirmar chama `PATCH /customers/:id` (mock)
com `{ active: false }` e atualiza a linha, para os dois papéis (AC 52)
Proof: `npm --prefix web run test -- src/app/(app)/customers/page.test.tsx -t "confirms before deactivating"`

**C51** - Como `admin`, na tela `/suppliers`, clicar em "Desativar" numa linha abre o
`ConfirmDialog`; cancelar não chama a API, e confirmar chama `PATCH /suppliers/:id` (mock) com
`{ active: false }` e atualiza a linha (AC 52)
Proof: `npm --prefix web run test -- src/app/(app)/suppliers/page.test.tsx -t "confirms before deactivating"`

**C52** - `AppShell` com `role="admin"`, `role="production"` e `role="sales"` mostra "Clientes" e
"Fornecedores" no menu para os três, junto dos itens já existentes (AC 53)
Proof: `npm --prefix web run test -- src/components/app-shell.test.tsx -t "customers and suppliers appear for every role"`

**C53** - Nas telas `/customers` e `/suppliers`, cadastrar, editar ou ativar/desativar uma linha
(mock `200`/`201`) atualiza a linha correspondente sem recarregar a página (AC 54)
Proof: `npm --prefix web run test -- src/app/(app)/customers/page.test.tsx -t "updates the row without reloading"`
Proof: `npm --prefix web run test -- src/app/(app)/suppliers/page.test.tsx -t "updates the row without reloading"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `GET /customers` statuses (3) | 200 C9 · 400 C12 · 401 C13 | - |
| `POST /customers` statuses (5) | 201 C1, C2 · 400 C3, C5, C6 · 401 C8 · 403 C7 · 409 C4 | - |
| `PATCH /customers/:id` statuses (6) | 200 C14, C20, C21 · 400 C16 · 401 C19 · 403 C18 · 404 C15 · 409 C17 | - |
| `GET /suppliers` statuses (3) | 200 C31 · 400 C34 · 401 C35 | - |
| `POST /suppliers` statuses (5) | 201 C23, C24 · 400 C25, C27, C28 · 401 C30 · 403 C29 · 409 C26 | - |
| `PATCH /suppliers/:id` statuses (6) | 200 C36, C42, C43 · 400 C38 · 401 C41 · 403 C40 · 404 C37 · 409 C39 | - |
| door do plano: `document` opcional e único só quando informado (1) | `Customer` C1 (ausência convive), C4 (duplicata) · `Supplier` C23 (ausência convive), C26 (duplicata) | - |
| bordas de `document` em `POST` (6) | tamanho curto C3, C25 · tamanho longo C3, C25 · CPF dígito verificador errado C3, C25 · CNPJ dígito verificador errado C3, C25 · CPF dígitos repetidos C3, C25 · CNPJ dígitos repetidos C3, C25 | - |
| duplicata de `document` (2) | valor exato C4, C26 · mesmo valor formatado diferente C4, C26 | - |
| bordas de `email`/`phone`/`address` (3) | `email` inválido C5, C27 · `phone` acima do limite C5, C27 · `address` acima do limite C5, C27 | - |
| bordas de `name` (3) | vazio C6, C28 · só espaços C6, C28 · acima do limite C6, C28 | - |
| papéis que escrevem `customers` (2) | `admin` C1, C14 · `sales` C1, C14 | - |
| papéis que escrevem `suppliers` (1) | `admin` C23, C36 | - |
| papel barrado em `customers` (1) | `production` C7, C18 | - |
| papéis barrados em `suppliers` (2) | `production` C29, C40 · `sales` C29, C40 | - |
| papéis que leem, comum a `customers` e `suppliers` (3) | `admin` C9, C31 · `production` C9, C31 · `sales` C9, C31 | - |
| transições de `active` em `Customer` (3) | ativo -> inativo C20 · inativo -> ativo C21 · exclusão física nunca existe C22 | - |
| transições de `active` em `Supplier` (3) | ativo -> inativo C42 · inativo -> ativo C43 · exclusão física nunca existe C44 | - |
| estados de tela, 2 telas × 3 estados (6) | `/customers` carregando C45 · `/customers` erro C46 · `/customers` vazio C47 · `/suppliers` carregando C45 · `/suppliers` erro C46 · `/suppliers` vazio C47 | - |
| UI por papel (3) | `admin`/`sales` usam os controles completos em `/customers` C50 · `admin` usa os controles completos em `/suppliers` C51 · `production` (e `sales` em `/suppliers`) só leem C48, C49 | - |
| ação destrutiva confirma antes de executar (2 telas) | `/customers` C50 · `/suppliers` C51 | - |
| item de menu (1) | "Clientes" e "Fornecedores" para os três papéis C52 | - |
| tela reflete sem recarregar (2 telas) | `/customers` C53 · `/suppliers` C53 | - |

- Claims que citam um código de status, rota ou formato de resposta: C1-C44 - cada uma tem uma
  prova que cruza a fronteira HTTP (e2e real contra o `AppModule`)
- Nenhuma claim afirma mais do que os casos que a prova exercita

## Test policy

| Code | Required proofs | Coverage expectation |
| --- | --- | --- |
| `CustomersController`/`SuppliersController` - `RolesGuard` aplicado nas 6 rotas (decide, alcançado pela rota, mesma forma das Fases 4-7) | um e2e por combinação rota × papel | as 6 rotas × os papéis onde aplicável (C1, C7, C8, C9, C13, C14, C18, C19, C20, C21, C22, C23, C29, C30, C31, C35, C36, C40, C41, C42, C43, C44) |
| `CustomersService`/`SuppliersService` - `document` opcional com índice único só quando informado (decide; forma nova - primeira coluna do sistema opcional e única ao mesmo tempo, diferente de `email` (`users`) e `name` (`sales-channels`), sempre obrigatórios) | e2e cobrindo dois registros sem `document` convivendo, duplicata exata e duplicata com formatação diferente | ausência convive (C1, C23) · duplicata exata (C4, C26) · duplicata com formatação diferente (C4, C26) |
| validador de dígito verificador de CPF/CNPJ, `is-valid-document.ts` (decide; forma nova - primeira validação de documento fiscal do sistema, sem analogê, com o quirk conhecido dos dígitos repetidos) | teste unitário isolado do validador, e e2e tabela-driven cobrindo tamanho, dígito verificador e dígitos repetidos | 6 bordas em `POST /customers` (C3) e as mesmas revalidadas em `POST /suppliers` (C25), mais o teste unitário direto da função |
| `CustomersService` - dois papéis de escrita (`admin` e `sales`), diferente de `SuppliersService` (só `admin`) (decide; forma nova - primeiro par de módulos irmãos do sistema com matriz de escrita diferente entre si) | e2e por papel em cada rota de escrita de cada módulo | `admin`/`sales` no `POST`/`PATCH` de `customers` (C1, C14); `admin` no `POST`/`PATCH` de `suppliers` (C23, C36); `production` barrado nos dois (C7, C18); `production`/`sales` barrados em `suppliers` (C29, C40) |

Evidence:

- `customers.service.ts`/`suppliers.service.ts` (novos): decidem sobre `document` opcional +
  único -> forma nova, sem analogê direto (`users.service.ts` e `sales-channels.service.ts`
  tratam unicidade só sobre campo obrigatório); ganham e2e dedicado à convivência de `null`s e à
  duplicata formatada diferente
- `is-valid-document.ts` (novo, reaproveitado pelos dois módulos): sem analogê no repositório
  (primeira validação de documento fiscal) -> ganha teste unitário isolado além da cobertura e2e
- `customers.controller.ts`/`suppliers.controller.ts` (novos): `RolesGuard` com matrizes
  diferentes entre os dois módulos irmãos -> mesma forma decisória das Fases 4-7, mas primeira vez
  que dois módulos do mesmo par têm matrizes de escrita distintas; e2e por papel em cada rota de
  cada módulo, sem reaproveitar o teste de um módulo para o outro

Cost: 2 arquivos e2e novos na API (`customers.e2e-spec.ts`, `suppliers.e2e-spec.ts`) cobrindo 6
rotas × papéis, 1 spec Vitest novo para `is-valid-document.ts`, 2 arquivos de teste de página
novos no web, 1 arquivo de teste existente estendido (`app-shell.test.tsx`, dois itens de menu), 1
arquivo de teste existente estendido (`roles.guard.spec.ts`, adiciona os dois controllers novos à
whitelist de `@Roles()`). Sem C4/C26, um `document` opcional que vira único só ao ser preenchido
poderia deixar um `UNIQUE` mal configurado aceitar duplicata silenciosamente - é o risco novo
desta fase. Sem o teste unitário de `is-valid-document.ts`, uma sequência de dígitos repetidos
(`"111.111.111-11"`) poderia passar como CPF válido sem nenhum teste pegando isso.

## Swept

- validation: C3, C5, C6, C12, C25, C27, C28, C34 - bordas de `document`, `email`/`phone`/
  `address`, `name`, `page`/`pageSize`, nos dois módulos
- failure modes: C3, C5, C6, C7, C12, C16, C25, C27, C28, C29, C34, C38 - toda rejeição responde
  `400`/`403` `{ error }` sem gravar ou alterar nada
- idempotency, retry, duplicates: C4, C26 - repetir o `POST` com o mesmo `document` sempre
  responde `409` sem criar um segundo registro; sem `document` a criação não é idempotente por
  design (cada `POST` cria um cliente/fornecedor novo, mesmo padrão de `materials`/`printers`)
- authorization: C1, C7, C8, C9, C13, C14, C18, C19, C23, C29, C30, C31, C35, C36, C40, C41
- concurrency and ordering: C9, C31 - a ordenação estável por `name` garante paginação consistente
  entre chamadas concorrentes de leitura; a corrida de escrita sobre `document` é coberta pelo
  índice único do banco mais `isUniqueViolation` (C4, C26), mesmo padrão de `users`/
  `sales-channels`
- data lifecycle: n/a - sem TTL nem arquivamento; o único ciclo de vida é `active`/`inactive`,
  coberto em state transitions
- external-dependency failure: n/a - `customers` e `suppliers` não chamam nenhum serviço externo
- state transitions: C20, C21, C22, C42, C43, C44
- observability: n/a - mesma decisão das Fases 4-7: nenhum AC desta fase exige uma linha de log
  específica

## Out of scope

`plan.md` já carrega `## Out of scope`; nada adicional surgiu na derivação dos checks.

## Handoff

Novos (API): `customers.module.ts`, `customers.controller.ts`, `customers.service.ts`,
`entities/customer.entity.ts`, `dto/create-customer.dto.ts`, `dto/update-customer.dto.ts`,
`dto/list-customers.dto.ts`; o mesmo conjunto para `suppliers`; `is-valid-document.ts` +
`is-valid-document.spec.ts` (compartilhado, num dos dois módulos); 2 migrations
(`CreateCustomers.ts`, `CreateSuppliers.ts`); `test/customers.e2e-spec.ts`,
`test/customers-helper.ts`, `test/suppliers.e2e-spec.ts`, `test/suppliers-helper.ts` ≈ 55 KB.
Existente tocado: `app.module.ts` (registra os dois módulos), `roles.guard.spec.ts` (adiciona os
dois controllers à whitelist), `ROADMAP.md` (linhas `customers`/`suppliers` na "Matriz de
permissões") ≈ 2 KB. Web novos: `lib/customers.ts`, `lib/suppliers.ts`,
`app/(app)/customers/page.tsx` + teste, `app/(app)/suppliers/page.tsx` + teste ≈ 35 KB. Web
existente tocado: `app-shell.tsx` + teste (dois itens de menu) ≈ 2 KB.

- S1-S8 ≈ 57 KB na API; S9 ≈ 37 KB no web ≈ 94 KB ≈ 24k tokens no total. Abaixo do orçamento
  padrão de 150k: um builder só, sem pergunta
- Validação final com o Playwright MCP (`AGENTS.md`): entrar como `admin`, abrir `/customers`,
  cadastrar um cliente só com nome, completar o documento por edição, desativá-lo com confirmação
  e ver o estado vazio filtrando por uma busca sem resultado; repetir em `/suppliers`; entrar como
  `production` e confirmar leitura-only nos dois; entrar como `sales` e confirmar escrita em
  `/customers` e leitura-only em `/suppliers`, com "Clientes" e "Fornecedores" no menu para os
  três papéis

- **Boundary:** C1-C53 fechados em `6b506d7` (S1-S8 na API: `c3614aa`, `7b49ff2`, `bb0b10b`; S9
  no web: `6b506d7`)
- **Settled mid-build:** nenhuma clarificação do usuário durante a construção que não tenha virado
  um row do `Landing` ou um check editado
- **Abandoned:** nada tentado e descartado; a migration única gerada por `migration:generate`
  (`customers` + `suppliers` juntos) foi refeita como duas migrations separadas
  (`CreateCustomers`, `CreateSuppliers`) para bater com o `Handoff` já escrito - não é um
  abandono de abordagem, só a granularidade certa da migration
