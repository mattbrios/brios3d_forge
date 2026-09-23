# Fase 8 — Clientes e fornecedores

## Problem

Hoje não existe cadastro de cliente nem de fornecedor no sistema. A Fase 9 (estoque de filamento
por rolo) precisa de um `Supplier` para registrar de onde veio cada rolo e alimentar o custo médio
ponderado; a Fase 16 (orçamentos) precisa de um `Customer` para saber para quem o orçamento é
feito; a Fase 21 (compras) precisa do mesmo `Supplier` para as ordens de compra. Nenhuma dessas
fases tem hoje onde gravar essa referência.

Quando isso existir, vendas cadastra um cliente rapidamente (nome, e o resto quando disponível)
sem precisar preencher CPF ou endereço na hora, e o admin cadastra os fornecedores que a empresa
já usa para comprar filamento e insumos. As Fases 9, 16 e 21 passam a poder referenciar esses
registros em vez de guardar nome solto em texto livre.

## Flow

Reaproveita o `AuthGuard`/`RolesGuard` globais (Fase 3/4), o `ValidationPipe` global (Fase 0), o
contrato de paginação/busca (`page`, `pageSize`, `search` → `{ items, total, page, pageSize }`,
`AD-020`), os componentes web `DataTable`/`EntityForm`/`ConfirmDialog` (`AD-021`) e
`isUniqueViolation` (`api/src/modules/users/is-unique-violation.ts`, já reaproveitado por
`sales-channels`) para tratar a corrida na unicidade do `document` — nenhum desses nasce de novo
aqui.

1. `GET /customers?search=&page=&pageSize=` (existing contract, AD-020) -> `CustomersController` (new) -> `CustomersService` (new) - lista `Customer` paginado, buscado por `name`
2. `POST /customers` -> `CustomersController` (new) -> `CustomersService` (new, door 1: entidade `Customer`, campo `document` opcional e único quando informado) - valida e persiste um cliente novo
3. `PATCH /customers/:id` -> `CustomersController` (new) -> `CustomersService` (new) - atualiza campos e/ou `active`
4. `GET /suppliers?search=&page=&pageSize=` (existing contract, AD-020) -> `SuppliersController` (new) -> `SuppliersService` (new) - lista `Supplier` paginado, buscado por `name`
5. `POST /suppliers` -> `SuppliersController` (new) -> `SuppliersService` (new, door 1: mesmo campo `document` de `Customer`) - valida e persiste um fornecedor novo
6. `PATCH /suppliers/:id` -> `SuppliersController` (new) -> `SuppliersService` (new) - atualiza campos e/ou `active`
7. Web: `/customers` e `/suppliers` (new) reaproveitam `DataTable`, `EntityForm` e `ConfirmDialog` (existing, Fase 6) e o cliente HTTP `apiFetch` (existing); `AppShell` (existing) ganha os itens de menu "Clientes" e "Fornecedores"

## Impact

| Front | O que muda |
| --- | --- |
| domain | termo novo: `Customer` - cadastro de cliente (nome, documento fiscal opcional, telefone, e-mail, endereço livre), mora no módulo `customers` |
| domain | termo novo: `Supplier` - cadastro de fornecedor, mesmo shape de `Customer`, mora no módulo `suppliers` |
| doc | as linhas `customers` e `suppliers` na "Matriz de permissões" (`ROADMAP.md`, Fase 4) saem de "a definir na Fase 8" para os papéis definidos nesta fase (ver Landing/Assumptions) |
| doc | a questão em aberto #21 do ROADMAP (campos obrigatórios de clientes/fornecedores) passa de aberta para respondida nesta revisão - decisão explícita do usuário |
| stored data | duas tabelas novas (`customers`, `suppliers`); nada para migrar em dado existente |

## Relations

Duas entidades novas, `Customer` e `Supplier`, autônomas nesta fase - sem FK de saída nem de
entrada entre si nem com nenhuma outra tabela. As Fases 9 (rolos), 16 (orçamentos) e 21 (compras)
criam as referências (`Roll ||--o{ Supplier`, `Quote ||--o{ Customer`, `PurchaseOrder ||--o{
Supplier`) depois; até lá nenhuma das duas é referenciada por ninguém.

Constraint one-way: `document` único por entidade (`Customer.document`, `Supplier.document`),
aplicada só quando o campo for informado - um índice único padrão do Postgres não considera dois
`NULL` como duplicados, então vários registros sem documento convivem (door 1).

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /customers` | query: `search?`, `page?`, `pageSize?` | `{ items: CustomerResponse[], total, page, pageSize }` | `200`, `400`, `401` |
| `POST /customers` | `name`, `document?`, `phone?`, `email?`, `address?` | `CustomerResponse` | `201`, `400`, `401`, `403`, `409` |
| `PATCH /customers/:id` | subconjunto dos campos acima + `active?` | `CustomerResponse` | `200`, `400`, `401`, `403`, `404`, `409` |
| `GET /suppliers` | query: `search?`, `page?`, `pageSize?` | `{ items: SupplierResponse[], total, page, pageSize }` | `200`, `400`, `401` |
| `POST /suppliers` | `name`, `document?`, `phone?`, `email?`, `address?` | `SupplierResponse` | `201`, `400`, `401`, `403`, `409` |
| `PATCH /suppliers/:id` | subconjunto dos campos acima + `active?` | `SupplierResponse` | `200`, `400`, `401`, `403`, `404`, `409` |

`CustomerResponse` e `SupplierResponse`: `{ id, name, document, phone, email, address, active }`
(mesmo shape nas duas entidades).

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| `document` (CPF/CNPJ) opcional, com índice único só quando informado, em `Customer` e `Supplier` | coluna `document` `varchar` nullable, índice único por entidade; comparação feita só pelos dígitos (formatação removida antes de gravar) | `document` obrigatório nos dois cadastros - rejeitada por decisão explícita do usuário nesta revisão do plano: cliente de balcão/Instagram raramente tem CPF à mão no primeiro contato, e exigi-lo bloquearia o cadastro rápido |

- Nada mais nesta mudança é difícil de reverter: os limites de validação, a ausência de estrutura
  no `address` e a ausência de endpoint de exclusão física são decisões reversíveis num refactor
  futuro, não portas de uma via.

## Criteria

### S1: Cadastrar cliente (P1)

Um admin ou vendas registra um cliente novo, podendo informar só o nome.

**Acceptance Criteria**

1. WHEN um admin ou `sales` autenticado envia `POST /customers` com `name` (não vazio após `trim()`, até 150 caracteres) THEN o sistema SHALL responder `201` com o cliente criado, incluindo `id` gerado e `active: true`
2. WHEN `POST /customers` incluir `document` correspondente a um CPF (11 dígitos) ou CNPJ (14 dígitos) com dígito verificador válido, com ou sem formatação (pontos, traço, barra) THEN o sistema SHALL gravar `document` só com os dígitos
3. IF `document` for enviado e, após remover a formatação, não tiver 11 nem 14 dígitos ou o dígito verificador for inválido THEN o sistema SHALL responder `400 { error }` sem gravar nada
4. IF `document` for enviado e já existir (comparando só os dígitos) em outro `Customer` THEN o sistema SHALL responder `409 { error }` sem gravar nada
5. WHEN `POST /customers` for enviado sem `document`, `phone`, `email` ou `address` THEN o sistema SHALL gravar esses campos como `null` e responder `201` normalmente
6. IF `email` for enviado e não for um endereço de e-mail válido, ou `phone` (após `trim()`) tiver mais de 30 caracteres, ou `address` (após `trim()`) tiver mais de 300 caracteres, THEN o sistema SHALL responder `400 { error }` sem gravar nada
7. IF `name` vier vazio (ou só espaços, após `trim()`) ou tiver mais de 150 caracteres THEN o sistema SHALL responder `400 { error }`
8. IF quem chama `POST /customers` não tiver papel `admin` nem `sales` THEN o sistema SHALL responder `403 { error }` sem gravar nada
9. IF `POST /customers` for chamado sem cookie de sessão THEN o sistema SHALL responder `401 { error }` sem gravar nada

**Independent test:** `POST /customers` só com `name` e checar o `201` com os demais campos
`null`; repetir com um CPF inválido e checar o `400`; repetir com um CNPJ já cadastrado e checar o
`409`.

### S2: Listar clientes com paginação e busca (P1)

Qualquer papel autenticado consulta o cadastro de clientes.

**Acceptance Criteria**

10. WHEN qualquer papel autenticado chama `GET /customers` sem parâmetros THEN o sistema SHALL responder `200` com `{ items, total, page: 1, pageSize: 20 }`, `items` ordenado por `name`
11. WHEN `GET /customers?search=Silva` for chamado THEN o sistema SHALL responder só com clientes cujo `name` contenha `Silva`, ignorando caixa
12. WHEN `GET /customers?page=2&pageSize=10` for chamado com 15 clientes cadastrados THEN o sistema SHALL responder com os 5 itens seguintes aos 10 primeiros (pela ordenação do AC 10) e `total: 15`
13. IF `page` for menor que `1`, ou `pageSize` for menor que `1` ou maior que `100`, THEN o sistema SHALL responder `400 { error }`
14. IF `GET /customers` for chamado sem cookie de sessão THEN o sistema SHALL responder `401 { error }`

**Independent test:** semear 15 clientes, chamar `GET /customers?page=2&pageSize=10` e checar 5
itens com `total: 15`.

### S3: Editar cliente (P2)

Um admin ou vendas corrige ou completa os dados de um cliente existente.

**Acceptance Criteria**

15. WHEN um admin ou `sales` chama `PATCH /customers/:id` com um subconjunto válido de campos THEN o sistema SHALL atualizar só os campos enviados e responder `200` com o cliente atualizado
16. IF `:id` não corresponder a um cliente existente THEN o sistema SHALL responder `404 { error }`
17. IF o corpo de `PATCH /customers/:id` violar as mesmas regras do AC 3, AC 6 ou AC 7 THEN o sistema SHALL responder `400 { error }` sem alterar o registro
18. IF `PATCH /customers/:id` trocar `document` para um valor que já existe em outro `Customer` THEN o sistema SHALL responder `409 { error }` sem alterar o registro
19. IF quem chama `PATCH /customers/:id` não tiver papel `admin` nem `sales` THEN o sistema SHALL responder `403 { error }`
20. IF `PATCH /customers/:id` for chamado sem cookie de sessão THEN o sistema SHALL responder `401 { error }`

**Independent test:** criar um cliente só com `name`, completar `document` e `phone` por `PATCH`
e checar `200`; repetir com um `document` já usado por outro cliente e checar `409`.

### S4: Ativar e desativar cliente (P2)

Um admin ou vendas desativa um cliente sem apagá-lo, e pode reativá-lo depois.

**Acceptance Criteria**

21. WHEN um admin ou `sales` envia `PATCH /customers/:id` com `{ "active": false }` THEN o sistema SHALL marcar o cliente como inativo, mantendo o registro
22. WHEN um admin ou `sales` envia `PATCH /customers/:id` com `{ "active": true }` num cliente inativo THEN o sistema SHALL reativá-lo
23. The system SHALL nunca expor uma rota de exclusão física de `Customer`

**Independent test:** desativar um cliente e checar `active: false` em `GET /customers`; reativar
e checar `active: true`.

### S5: Cadastrar fornecedor (P1)

Um admin registra um fornecedor novo, podendo informar só o nome.

**Acceptance Criteria**

24. WHEN um admin autenticado envia `POST /suppliers` com `name` (não vazio após `trim()`, até 150 caracteres) THEN o sistema SHALL responder `201` com o fornecedor criado, incluindo `id` gerado e `active: true`
25. WHEN `POST /suppliers` incluir `document` correspondente a um CPF (11 dígitos) ou CNPJ (14 dígitos) com dígito verificador válido, com ou sem formatação THEN o sistema SHALL gravar `document` só com os dígitos
26. IF `document` for enviado e, após remover a formatação, não tiver 11 nem 14 dígitos ou o dígito verificador for inválido THEN o sistema SHALL responder `400 { error }` sem gravar nada
27. IF `document` for enviado e já existir (comparando só os dígitos) em outro `Supplier` THEN o sistema SHALL responder `409 { error }` sem gravar nada
28. WHEN `POST /suppliers` for enviado sem `document`, `phone`, `email` ou `address` THEN o sistema SHALL gravar esses campos como `null` e responder `201` normalmente
29. IF `email` for enviado e não for um endereço de e-mail válido, ou `phone` (após `trim()`) tiver mais de 30 caracteres, ou `address` (após `trim()`) tiver mais de 300 caracteres, THEN o sistema SHALL responder `400 { error }` sem gravar nada
30. IF `name` vier vazio (ou só espaços, após `trim()`) ou tiver mais de 150 caracteres THEN o sistema SHALL responder `400 { error }`
31. IF quem chama `POST /suppliers` não tiver papel `admin` THEN o sistema SHALL responder `403 { error }` sem gravar nada
32. IF `POST /suppliers` for chamado sem cookie de sessão THEN o sistema SHALL responder `401 { error }` sem gravar nada

**Independent test:** `POST /suppliers` só com `name` e checar o `201`; repetir como `sales` e
checar o `403`.

### S6: Listar fornecedores com paginação e busca (P1)

Qualquer papel autenticado consulta o cadastro de fornecedores.

**Acceptance Criteria**

33. WHEN qualquer papel autenticado chama `GET /suppliers` sem parâmetros THEN o sistema SHALL responder `200` com `{ items, total, page: 1, pageSize: 20 }`, `items` ordenado por `name`
34. WHEN `GET /suppliers?search=Filamentos` for chamado THEN o sistema SHALL responder só com fornecedores cujo `name` contenha `Filamentos`, ignorando caixa
35. WHEN `GET /suppliers?page=2&pageSize=10` for chamado com 15 fornecedores cadastrados THEN o sistema SHALL responder com os 5 itens seguintes aos 10 primeiros e `total: 15`
36. IF `page` for menor que `1`, ou `pageSize` for menor que `1` ou maior que `100`, THEN o sistema SHALL responder `400 { error }`
37. IF `GET /suppliers` for chamado sem cookie de sessão THEN o sistema SHALL responder `401 { error }`

**Independent test:** semear 15 fornecedores, chamar `GET /suppliers?page=2&pageSize=10` e checar
5 itens com `total: 15`.

### S7: Editar fornecedor (P2)

Um admin corrige ou completa os dados de um fornecedor existente.

**Acceptance Criteria**

38. WHEN um admin chama `PATCH /suppliers/:id` com um subconjunto válido de campos THEN o sistema SHALL atualizar só os campos enviados e responder `200` com o fornecedor atualizado
39. IF `:id` não corresponder a um fornecedor existente THEN o sistema SHALL responder `404 { error }`
40. IF o corpo de `PATCH /suppliers/:id` violar as mesmas regras do AC 26, AC 29 ou AC 30 THEN o sistema SHALL responder `400 { error }` sem alterar o registro
41. IF `PATCH /suppliers/:id` trocar `document` para um valor que já existe em outro `Supplier` THEN o sistema SHALL responder `409 { error }` sem alterar o registro
42. IF quem chama `PATCH /suppliers/:id` não tiver papel `admin` THEN o sistema SHALL responder `403 { error }`
43. IF `PATCH /suppliers/:id` for chamado sem cookie de sessão THEN o sistema SHALL responder `401 { error }`

**Independent test:** criar um fornecedor só com `name`, completar `document` por `PATCH` e checar
`200`; repetir como `production` e checar `403`.

### S8: Ativar e desativar fornecedor (P2)

Um admin desativa um fornecedor sem apagá-lo, e pode reativá-lo depois.

**Acceptance Criteria**

44. WHEN um admin envia `PATCH /suppliers/:id` com `{ "active": false }` THEN o sistema SHALL marcar o fornecedor como inativo, mantendo o registro
45. WHEN um admin envia `PATCH /suppliers/:id` com `{ "active": true }` num fornecedor inativo THEN o sistema SHALL reativá-lo
46. The system SHALL nunca expor uma rota de exclusão física de `Supplier`

**Independent test:** desativar um fornecedor e checar `active: false` em `GET /suppliers`;
reativar e checar `active: true`.

### S9: Web - telas de clientes e fornecedores no padrão de CRUD reutilizável (P1)

As telas `/customers` e `/suppliers` usam os mesmos três componentes da Fase 6 para listar,
cadastrar, editar e desativar/reativar.

**Acceptance Criteria**

47. WHEN a tela `/customers` ou `/suppliers` carrega THEN o sistema SHALL mostrar o estado de carregamento até a resposta do `GET` correspondente
48. IF o `GET` correspondente falhar THEN a tela SHALL mostrar a mensagem de erro e um botão "Tentar novamente", reaproveitando o padrão de `/materials`
49. WHILE a resposta do `GET` correspondente tiver `items` vazio, a tela SHALL mostrar um estado vazio distinto do estado de erro
50. WHEN um usuário com papel `production` acessa `/customers` THEN a tela SHALL esconder os controles de criar, editar e desativar/reativar, mostrando só a listagem
51. WHEN um usuário com papel `production` ou `sales` acessa `/suppliers` THEN a tela SHALL esconder os controles de criar, editar e desativar/reativar, mostrando só a listagem
52. WHEN um admin (em `/customers` ou `/suppliers`) ou `sales` (em `/customers`) aciona "Desativar" ou "Reativar" numa linha THEN a tela SHALL abrir o `ConfirmDialog` reutilizável e só chamar o `PATCH` correspondente após a confirmação
53. WHEN `AppShell` renderiza com `role: "admin"`, `"production"` ou `"sales"` THEN o sistema SHALL mostrar os itens "Clientes" e "Fornecedores" no menu para os três papéis
54. WHEN um admin ou `sales` cadastra, edita ou ativa/desativa um cliente ou fornecedor pela tela THEN a tela SHALL atualizar a linha correspondente sem recarregar a página

**Independent test:** Playwright - carregar `/customers`, cadastrar um cliente só com nome,
completar o documento por edição, desativá-lo com confirmação; carregar `/suppliers` como
`production` e ver que só a listagem aparece.

## Out of scope

| Excluded | Why |
| --- | --- |
| Rota de exclusão física de `Customer`/`Supplier` | mesmo precedente de `Material`/`Printer`/`users`/`sales-channels`: nunca apagar fisicamente |
| Unicidade de `name` | ROADMAP não pede; duas empresas podem ter nome fantasia parecido, só `document` precisa ser único |
| Referência de `Customer`/`Supplier` em outras entidades (rolo, orçamento, compra) | é das Fases 9, 16 e 21, citadas explicitamente no ROADMAP como posteriores |
| Múltiplos endereços ou contatos por cliente/fornecedor | ROADMAP pede um cadastro simples; a questão #21 falava em "endereço, contato" no singular |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| `document` (CPF/CNPJ) é opcional para clientes e fornecedores, único quando informado | `document` nullable, índice único por entidade | decisão do usuário nesta revisão do plano | y |
| Só `name` é obrigatório; `phone`, `email` e `address` ficam opcionais | shape acima | decisão do usuário nesta revisão do plano | y |
| `document` é validado com dígito verificador (CPF 11 dígitos, CNPJ 14 dígitos) e gravado só com dígitos | validador dedicado no módulo, sem biblioteca nova | a Fase 28 (fiscal) vai emitir documento em cima desse campo; validar o dígito verificador agora evita lixo em produção sem depender de uma dependência nova | n |
| `address` é um campo de texto livre, até 300 caracteres, sem estrutura (rua/cidade/UF/CEP) | `address: string` opcional | o ROADMAP não pede endereço estruturado nesta fase; estruturar fica para quando compras/logística (Fases 21+) precisarem | n |
| Papéis: `customers` - `admin` e `sales` leem e escrevem tudo, `production` só lê; `suppliers` - `admin` lê e escreve tudo, `production` e `sales` só leem | shape acima | `sales` cadastra clientes para orçamentos (Fase 16); fornecedores são operação de compras, hoje concentrada no `admin`, mesmo padrão restrito já usado em `materials`/`printers` (campos administrativos) | n |
| `name` não é único | sem constraint de unicidade em `name` | mesmo padrão de `Printer.name` (Fase 7); só `document` precisa ser único | n |
| `phone` é texto livre (até 30 caracteres), sem validação de formato além do tamanho | shape acima | o ROADMAP não define um formato de telefone (fixo, celular, DDI); validar demais arriscaria rejeitar números válidos | n |

**Open questions:** none - todas as decisões acima foram confirmadas pelo usuário ou assumidas
com um default e ficam abertas para correção nesta revisão do plano.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| tela `/customers` | estado de carregamento | AC 47 |
| tela `/customers` | estado de erro | AC 48 |
| tela `/customers` | estado vazio | AC 49 |
| tela `/customers` | estado não autorizado (`production` leitura-only) | AC 50 |
| tela `/customers` | ação destrutiva confirma antes de executar | AC 52 |
| tela `/customers` | densidade e ordenação da listagem | AC 10 |
| tela `/suppliers` | estado de carregamento | AC 47 |
| tela `/suppliers` | estado de erro | AC 48 |
| tela `/suppliers` | estado vazio | AC 49 |
| tela `/suppliers` | estado não autorizado (`production` e `sales` leitura-only) | AC 51 |
| tela `/suppliers` | ação destrutiva confirma antes de executar | AC 52 |
| tela `/suppliers` | densidade e ordenação da listagem | AC 33 |
| API `GET /customers` | forma de erro e códigos | AC 13, 14 |
| API `POST /customers` | forma de erro e códigos | AC 3, 4, 6, 7, 9 |
| API `POST /customers` | quem pode chamar | AC 8, 9 |
| API `PATCH /customers/:id` | forma de erro e códigos | AC 16, 17, 18, 20 |
| API `PATCH /customers/:id` | quem pode chamar | AC 19, 20 |
| API `GET /suppliers` | forma de erro e códigos | AC 36, 37 |
| API `POST /suppliers` | forma de erro e códigos | AC 26, 27, 29, 30, 32 |
| API `POST /suppliers` | quem pode chamar | AC 31, 32 |
| API `PATCH /suppliers/:id` | forma de erro e códigos | AC 39, 40, 41, 43 |
| API `PATCH /suppliers/:id` | quem pode chamar | AC 42, 43 |
| `AppShell` | itens de menu novos aparecem para os três papéis | AC 53 |
| tela `/customers`, `/suppliers` | criação/edição/ativação refletem sem recarregar | AC 54 |
| todas `/customers*`, `/suppliers*` | versionamento, rate limit | n/a - módulo interno sem consumidor externo, mesmo padrão de `materials`/`printers`/`users`/`sales-channels` |

## Sources

- `ROADMAP.md`, Fase 8 (Tarefas e Critérios de aceite) - define os dois cadastros e o `409` de
  documento duplicado "se for exigido"
- `ROADMAP.md`, "Questões em aberto" #21 - respondida nesta revisão do plano (ver Assumptions)
- `.specs/STATE.md` AD-001 (formato de erro), AD-004 (layout de módulo), AD-014 (`uuid`), AD-018
  (autorização por padrão), AD-020 (paginação/busca), AD-021 (componentes CRUD reutilizáveis) -
  precedentes herdados sem alteração
- `api/src/modules/users/is-unique-violation.ts` e `users.service.ts` - padrão de tratamento de
  unicidade com `409`, já reaproveitado por `sales-channels`, reaproveitado de novo aqui
- `.specs/features/phase-7-printers/plan.md` - padrão de CRUD que esta fase copia (entidade,
  DTOs, componentes web)
