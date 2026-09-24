# Fase 11 — Estoque mínimo, alertas e etiqueta QR

## Problem

O sistema sabe quanto tem de cada coisa e não sabe quanto **deveria** ter. Nenhum material e
nenhum item de estoque guarda um piso de reposição: as colunas não existem (confirmado por busca
em `api/src` — `minimum` só aparece em `minimumOrderCents`, do `pricing`), não existe rota de
alerta e não existe tela. Quem quer saber se vai faltar filamento preto amanhã tem de abrir
`/inventory`, ler o saldo de cada material e comparar de cabeça com um número que só existe na
cabeça de quem compra. O resultado prático é o que o `CONTEXT.md` pede desde o começo ("Estoque
mínimo com alertas") e que o sistema ainda não faz: a falta é descoberta quando o rolo acaba no
meio de um pedido.

O segundo furo é físico. O sistema tem uma página por rolo (`/inventory/<id>`) com pesagem e
baixa, e o rolo na prateleira não tem nada que leve até ela: o operador precisa achar o rolo
certo numa lista de rolos idênticos, por id, no navegador. O `CONTEXT.md` pede "Etiqueta com QR
code no rolo" e hoje não existe nenhum código de QR nem nenhuma folha de estilo de impressão no
repositório.

Quando isto for entregue: admin define o mínimo de cada material (em gramas, somando os rolos) e
de cada insumo/peça; qualquer papel abre uma tela que lista o que está abaixo do piso e vê um
indicador com a contagem no cabeçalho de todas as telas; e cada rolo pode ser etiquetado com um
QR que, lido pelo celular, abre a página daquele rolo com pesar e dar baixa à mão.

## Flow

Reaproveita a página do rolo que já existe como destino do QR (`/inventory/[id]`, com pesagem e
baixa desde a Fase 9) e o par `AuthGate`/`AppShell` como lugar do indicador, em vez de um provider
novo; o cálculo do alerta é uma função pura ao lado de `average-cost.ts`, no formato que a Fase 9
e a Fase 10 já usam para custo médio.

1. Admin define o piso -> `MaterialsService.update` (exists) e `InventoryService.updateItem`
   (exists) -> persistem a coluna nova em `materials` e em `stock_items` (door 1)
2. Leitura dos alertas (qualquer papel) -> `InventoryService.alerts` (new, no door - placement na
   convenção do módulo) -> uma consulta agregada parte de `materials` e soma o saldo dos rolos
   **não descartados** por `LEFT JOIN` (material com piso e zero rolo tem de aparecer com saldo
   `0`), outra lê `stock_items` com saldo materializado
3. `stock-alerts.ts` (new, no door - placement, função pura ao lado de `average-cost.ts`) ->
   compara saldo com piso, monta `label` e `unit` por tipo de dono e ordena pela fração do piso
   que falta (door 4)
4. out: `GET /inventory/alerts` -> `{ items: StockAlert[] }` (door 4)
5. Web: `AuthGate` (exists) monta `AlertsIndicator` (new, no door - placement ao lado de
   `health-status.tsx`) no slot `alerts` do `AppShell` (exists), e o indicador busca
   `/inventory/alerts` por conta própria, mostrando a contagem no cabeçalho com link para a tela.
   Buscar dentro do `AuthGate` deixaria a sessão esperando por um dado acessório, e o AC 28 pede
   justamente o contrário: a falha do alerta não pode atrasar nem derrubar a tela
6. Web: `/inventory/alerts` (new, no door - placement ao lado de `/inventory/items`) lista os
   alertas; `/inventory/[id]/label` (new, no door - placement) renderiza a etiqueta com
   `QRCodeSVG` (door 2) codificando `<origem>/inventory/<rollId>` (door 3), e o chrome do
   `AppShell` sai na impressão
7. Ler o QR abre `/inventory/[id]` (exists, já tem pesagem e baixa); sem sessão, o `AuthGate`
   (exists) manda para `/login?next=...` e o `safeNext` (exists) volta para a página do rolo

## Impact

| Front | O que muda |
| --- | --- |
| domain | novo termo: `minimumStockGrams` em `Material` — piso do material em gramas, comparado com a **soma** dos rolos não descartados; `null` = sem política de reposição |
| domain | novo termo: `minimumQuantity` em `StockItem` — piso na unidade do próprio item; `null` = sem política |
| domain | novo termo: `StockAlert` — linha de leitura (um material ou um item abaixo do piso), calculada a cada chamada e nunca persistida, no mesmo espírito do custo médio (AD-024) |
| domain | existente: "estoque mínimo" ganha um significado único no sistema (saldo somado `<` piso). Quem vai branchar nele depois: a Fase 15 (produto acabado reusa o alerta) e a Fase 27 (projeção de compra parte do mesmo piso) |
| contrato consumido | `MaterialResponse` ganha `minimumStockGrams` e `StockItemResponse` ganha `minimumQuantity` — aditivo, nenhum campo muda de nome. Quem lê hoje: `web/src/lib/materials.ts`, `web/src/lib/stock-items.ts`, as telas `/materials`, `/inventory`, `/inventory/items`, `/inventory/items/[id]` e o detalhe do rolo (que já busca `/materials?pageSize=100`) |
| contrato consumido | `AppShell` ganha o slot `alerts` no cabeçalho (mais `print:hidden` no `<header>` e no `<nav>`) e `AuthGate` passa a montar `AlertsIndicator` nesse slot; quem busca `/inventory/alerts` é o próprio indicador. Quem depende: `web/src/components/app-shell.test.tsx` e `auth-gate.test.tsx`, atualizados na mesma mudança |
| stored data | `materials` e `stock_items` existem e têm linhas: as duas colunas entram **nulas**, então não há backfill e nenhuma linha atual passa a gerar alerta enquanto ninguém definir o piso |
| dependência | `web/package.json` ganha `qrcode.react` fixado em `4.2.0` (door 2); `api/` não ganha dependência nenhuma |
| doc | `ROADMAP.md`: a linha `inventory` da matriz de permissões passa a citar a leitura de alertas e a edição do piso (admin); as questões abertas 14 (formato da etiqueta) e 15 (mínimo por material em gramas) passam a "respondida (Fase 11)" |

## Relations

Nenhuma entidade nova e nenhuma cardinalidade nova: o alerta é derivado das relações que já
existem (`Material` ||--o{ `FilamentRoll`, e `StockItem` sozinho com o saldo materializado da
Fase 10). `Material` e `StockItem` passam a carregar o próprio piso (door 1).

One-way constraints: o piso é opcional e `NULL` significa "sem mínimo", nunca "mínimo zero"
(door 1); quando informado, nunca negativo, reforçado por `CHECK` no banco além do `400` da API,
no mesmo padrão dos saldos (AD-023); nenhum `StockAlert` é gravado em lugar nenhum.

## Surface

Toda rota herda o guard global de sessão (AD-015) e o `RolesGuard` (AD-018): `401` sem cookie e
`403` fora do papel entram no `Status` de cada linha.

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `GET /inventory/alerts` | — | `{ items: StockAlert[] }`, cada um com `kind` (`material` ou `stock_item`), `id`, `label`, `balance`, `minimum`, `unit` | `200`, `401` |
| `POST /materials` (assinatura muda) | ganha `minimumStockGrams?` | `MaterialResponse` com `minimumStockGrams` | `201`, `400`, `401`, `403` |
| `PATCH /materials/:id` (assinatura muda) | ganha `minimumStockGrams?` (número ou `null` para limpar) | `MaterialResponse` com `minimumStockGrams` | `200`, `400`, `401`, `403`, `404` |
| `GET /materials` (assinatura muda) | — | cada item com `minimumStockGrams` | `200`, `400`, `401` |
| `POST /inventory/items` (assinatura muda) | ganha `minimumQuantity?` | `StockItemResponse` com `minimumQuantity` | `201`, `400`, `401`, `403`, `409` |
| `PATCH /inventory/items/:id` (assinatura muda) | ganha `minimumQuantity?` (número ou `null`) | `StockItemResponse` com `minimumQuantity` | `200`, `400`, `401`, `403`, `404`, `409` |
| `GET /inventory/items`, `GET /inventory/items/:id` (assinatura muda) | — | cada item com `minimumQuantity` | `200`, `400`, `401`, `404` |

## Landing

| One-way door | Literal shape | Alternativa rejeitada |
| --- | --- | --- |
| 1. O piso é uma coluna nula na própria tabela do cadastro, e `NULL` significa "sem mínimo" | `ALTER TABLE materials ADD COLUMN minimum_stock_grams double precision NULL`; `ALTER TABLE materials ADD CONSTRAINT materials_minimum_non_negative CHECK (minimum_stock_grams IS NULL OR minimum_stock_grams >= 0)`; o par equivalente em `stock_items ADD COLUMN minimum_quantity double precision NULL` + `stock_items_minimum_non_negative`. Nenhuma das duas tem `DEFAULT` | `NOT NULL DEFAULT 0` — rejeitada porque zero é uma política ("aceito ficar sem nenhum grama") e todo cadastro atual passaria a viver exatamente no limite, sem como distinguir "não definido" de "definido como zero". Uma tabela `stock_minimums(owner_kind, owner_id, minimum)` — rejeitada pelo mesmo motivo que a Fase 9 (door 1) e a Fase 10 (door 3) recusaram polimorfismo sem FK, agora para guardar um único escalar por linha que já tem tabela e dono |
| 2. QR gerado no navegador por `qrcode.react`, fixado em versão exata | `"qrcode.react": "4.2.0"` em `dependencies` de `web/package.json` (ISC, sem dependência transitiva além de `react`, peer `react ^19` atendido pelo `19.2.8` do projeto); uso: `import { QRCodeSVG } from "qrcode.react"` e `<QRCodeSVG value={url} level="M" size={...} />` | Gerar a imagem numa rota da API (`GET /inventory/rolls/:id/label.svg`) — rejeitada porque a origem que vai dentro do QR só existe no navegador (a API não sabe por qual host o web está sendo acessado) e porque criaria uma rota de imagem com superfície de autenticação própria. Escrever o encoder à mão (Reed-Solomon, máscaras, versionamento) — rejeitada por ser desproporcional: centenas de linhas de código criptograficamente irrelevante para o produto |
| 3. A URL impressa no QR é a rota que já existe, com o uuid do rolo | `${window.location.origin}/inventory/${roll.id}`, ex.: `https://forge.brios3d.com.br/inventory/8f3c1e2a-...` (AD-012) | Um encurtador interno (`/r/<código>` com coluna nova no rolo e redirect) — rejeitada porque exigiria um segundo identificador, uma rota de redirect e uma política de colisão para economizar caracteres num QR que já cabe num módulo de 30 mm. **Custo assumido:** a etiqueta é física e sobrevive a qualquer refactor, então trocar a rota `/inventory/:id` ou o host depois de imprimir obriga a reimprimir as etiquetas ou a manter um redirect do endereço antigo |
| 4. Uma lista só de alertas, com o tipo de dono no campo `kind` e a unidade no campo `unit` | `StockAlert { kind: 'material' \| 'stock_item', id, label, balance, minimum, unit }`; `GET /inventory/alerts` -> `{ items: StockAlert[] }`, sem paginação, ordenado por `(minimum - balance) / minimum` decrescente e `label` crescente no empate; `unit` é `"g"` para material e o `unitOfMeasure` do item para item | Duas listas separadas na resposta (`materials[]` e `items[]`) — rejeitada porque o indicador do cabeçalho precisa de uma contagem só e a tela mostra uma tabela só, e porque a Fase 15 (produto acabado) acrescentaria uma terceira lista em vez de um terceiro valor de `kind`. Devolver só os ids, sem `label` — rejeitada porque obrigaria a tela a buscar `/materials?pageSize=100` para rotular cada linha, que é exatamente o remendo que o detalhe do rolo já faz hoje e que para de funcionar no material 101 |

- Nada mais nesta mudança é difícil de reverter: nome de arquivo, pasta de tela, layout da
  etiqueta, textos e o formato do indicador se resolvem no diff.

## Criteria

### S1: Piso de estoque por material e por item (P1)

Admin diz quanto precisa ter de cada material e de cada insumo/peça, e pode voltar atrás.

**Acceptance Criteria**

1. WHEN um admin envia `PATCH /materials/:id` com `minimumStockGrams: 500` THEN o sistema SHALL gravar `500` e responder `200` com `minimumStockGrams: 500` no corpo
2. WHEN um admin envia `POST /materials` sem `minimumStockGrams` THEN o sistema SHALL criar o material com `minimumStockGrams: null` e responder `201`
3. WHEN um admin envia `PATCH /materials/:id` com `minimumStockGrams: null` em um material que tinha piso THEN o sistema SHALL gravar `null` e responder `200`
4. IF `minimumStockGrams` vier negativo, vazio ou não numérico THEN o sistema SHALL responder `400 { error }` sem gravar nada
5. WHEN `production` ou `sales` envia `PATCH /materials/:id` com `minimumStockGrams` THEN o sistema SHALL responder `403`
6. WHEN `GET /materials` é chamado THEN cada item da resposta SHALL trazer `minimumStockGrams` com o número gravado ou `null`
7. WHEN um admin envia `PATCH /inventory/items/:id` com `minimumQuantity: 10` THEN o sistema SHALL gravar `10` e responder `200` com `minimumQuantity: 10`
8. IF `minimumQuantity` vier negativo ou não numérico em `POST /inventory/items` ou `PATCH /inventory/items/:id` THEN o sistema SHALL responder `400 { error }` sem gravar nada
9. WHEN `GET /inventory/items` e `GET /inventory/items/:id` são chamados THEN cada item SHALL trazer `minimumQuantity` com o número gravado ou `null`, que é o valor de um item cadastrado sem piso

**Independent test:** definir 500 g num material e 10 un num item, limpar o do material e conferir os três valores na listagem.

### S2: Alertas na API (P1)

Uma chamada devolve tudo que está abaixo do piso, filamento e insumo na mesma lista.

**Acceptance Criteria**

10. WHEN `GET /inventory/alerts` é chamado e um material ativo tem `minimumStockGrams: 1000` com dois rolos não descartados somando `800` g THEN o sistema SHALL retornar um alerta com `kind: "material"`, `id` do material, `label` no formato `"<tipo> · <marca> · <cor>"`, `balance: 800`, `minimum: 1000` e `unit: "g"`
11. WHEN a soma do saldo dos rolos é exatamente igual ao `minimumStockGrams` THEN o sistema SHALL não retornar alerta desse material
12. WHEN um material ativo tem piso definido e nenhum rolo cadastrado THEN o sistema SHALL retornar o alerta com `balance: 0`
13. WHILE um rolo está descartado o sistema SHALL não contar o saldo dele na soma do material
14. IF `minimumStockGrams` é `null` THEN o sistema SHALL não retornar alerta desse material, qualquer que seja o saldo
15. IF o material está inativo THEN o sistema SHALL não retornar alerta dele, mesmo com piso definido e saldo abaixo
16. IF o item de estoque está com `active: false` THEN o sistema SHALL não retornar alerta dele
17. WHEN um item ativo tem `minimumQuantity: 10`, `balanceQuantity: 4` e `unitOfMeasure: "un"` THEN o sistema SHALL retornar um alerta com `kind: "stock_item"`, `label` igual ao `name`, `balance: 4`, `minimum: 10` e `unit: "un"`
18. WHEN a resposta tem mais de um alerta THEN o sistema SHALL ordená-los pela fração do piso que falta (`(minimum - balance) / minimum`) em ordem decrescente, com empate resolvido por `label` crescente
19. WHEN uma entrada leva o saldo a ficar igual ou maior que o piso THEN a chamada seguinte a `GET /inventory/alerts` SHALL não trazer mais aquele material ou item
20. WHEN `production` ou `sales` chama `GET /inventory/alerts` THEN o sistema SHALL responder `200` com a mesma lista que o admin recebe
21. IF `GET /inventory/alerts` é chamado sem cookie de sessão THEN o sistema SHALL responder `401 { error }`

**Independent test:** material com 800 g de 1000, material zerado com piso, item 4 de 10 e um material sem piso — conferir três alertas, na ordem, e o quarto ausente.

### S3: Tela de alertas e indicador no layout (P1)

O alerta chega sem ninguém ir procurar.

**Acceptance Criteria**

22. WHEN a tela `/inventory/alerts` termina de carregar THEN o sistema SHALL mostrar uma tabela com `label`, saldo, piso e unidade de cada alerta, cada linha com link para o estoque correspondente (`/inventory` no material, `/inventory/items/<id>` no item)
23. WHILE a tela `/inventory/alerts` busca os dados o sistema SHALL mostrar um estado de carregamento
24. IF a chamada de `/inventory/alerts` falhar THEN a tela SHALL mostrar um estado de erro com a ação de tentar novamente, sem tabela parcial
25. IF a resposta vier sem nenhum alerta THEN a tela SHALL mostrar um estado vazio dizendo que nenhum item está abaixo do mínimo
26. WHILE existem `3` alertas o cabeçalho de toda tela autenticada SHALL mostrar um indicador com o número `3`, com link para `/inventory/alerts`
27. IF não houver nenhum alerta THEN o cabeçalho SHALL não mostrar indicador nenhum
28. IF a busca dos alertas do cabeçalho falhar THEN o cabeçalho SHALL renderizar sem indicador e sem mensagem de erro, e o conteúdo da tela SHALL continuar sendo exibido
29. WHEN `sales` está logado THEN o indicador e a tela de alertas SHALL aparecer do mesmo jeito que para o admin, sem nenhuma ação de edição

**Independent test:** três alertas com o indicador mostrando 3, repor um e ver 2, zerar tudo e ver o indicador desaparecer.

### S4: Etiqueta com QR e leitura no celular (P1)

O rolo na prateleira leva até a própria página.

**Acceptance Criteria**

30. WHEN um usuário com sessão abre `/inventory/<rollId>/label` THEN o sistema SHALL renderizar a etiqueta com o QR e com material (`<tipo> · <marca> · <cor>`), peso nominal em gramas, lote, data de compra e os 8 primeiros caracteres do id do rolo
31. WHERE o rolo não tem lote ou data de compra a etiqueta SHALL imprimir `—` no lugar do valor, sem deixar o campo em branco
32. The system SHALL codificar no QR exatamente a string `<origem do web>/inventory/<rollId>`, sem nenhum outro conteúdo
33. The system SHALL gerar o QR com nível de correção de erro `M` e lado de `30` mm na impressão, dentro de uma etiqueta de `70` mm × `40` mm
34. WHEN a página da etiqueta é impressa THEN o cabeçalho e o menu lateral do `AppShell` SHALL não aparecer na impressão
35. WHEN a página do rolo (`/inventory/<rollId>`) carrega THEN ela SHALL oferecer a ação "Imprimir etiqueta" que abre `/inventory/<rollId>/label`
36. IF o rolo do parâmetro não existir THEN a página da etiqueta SHALL mostrar o estado de erro e SHALL não renderizar nenhum QR
37. WHEN a URL codificada no QR é aberta sem sessão THEN o sistema SHALL redirecionar para `/login?next=/inventory/<rollId>` e, depois do login, abrir a página daquele rolo
38. WHEN a página do rolo aberta pelo QR carrega para `admin` ou `production` THEN ela SHALL oferecer os formulários de pesagem e de baixa sem nenhuma navegação adicional

**Independent test:** imprimir (em PDF) a etiqueta de um rolo, ler o QR com o celular, cair no login, entrar e aterrizar na página do rolo com pesagem e baixa.

## Out of scope

| Excluído | Por quê |
| --- | --- |
| Folha com várias etiquetas e impressão em lote | O ROADMAP pede "uma etiqueta imprimível com QR code por rolo"; a folha é aditiva e reversível |
| Etiqueta com QR para insumo, peça de reposição e produto acabado | O ROADMAP limita o QR ao rolo; produto acabado é Fase 15 |
| Alerta por e-mail, push ou job agendado | O sistema não tem nenhuma infra de notificação nem de agendamento; o alerta é lido sob demanda |
| Mínimo por número de rolos fechados (questão 15 do ROADMAP) | A tarefa desta fase define o piso em gramas, somando os rolos |
| Integração com impressora térmica por ESC/POS ou driver próprio | A impressão sai pelo diálogo do navegador |
| Sugestão de quanto comprar e projeção de consumo | Fase 27 do ROADMAP; esta fase só diz que está abaixo do piso |
| Paginação e filtros em `GET /inventory/alerts` | O conjunto é pequeno por natureza (só o que está abaixo do piso) e o indicador precisa da contagem total numa chamada |
| Histórico de quando um alerta apareceu ou sumiu | Nenhum consumidor até a Fase 27; o alerta é leitura derivada, não fato persistido |
| Alerta de rolo individual quase vazio | O piso é do material (soma dos rolos); um rolo acabando é o esperado, não uma exceção |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Formato físico da etiqueta (questão 14 do ROADMAP) | Bloco de 70 × 40 mm no canto superior esquerdo da página, QR de 30 mm à esquerda e os campos à direita, impresso pelo diálogo do navegador sem fixar `@page size` | Funciona em A4 (uma etiqueta por folha, recorte manual) e em térmica, porque o usuário escolhe o papel no diálogo; fixar `size: 70mm 40mm` quebraria a impressão em A4, que é a impressora que a empresa certamente tem. Apresentado na revisão do plano com a alternativa (fixar 50 × 30 mm de térmica) e aprovado como está | y |
| Dados impressos na etiqueta | Material, peso nominal, lote, data de compra, 8 primeiros caracteres do id e o QR | São os campos que identificam o rolo na prateleira sem abrir o sistema. O saldo fica fora de propósito: muda a cada baixa e a etiqueta é impressa uma vez | n |
| Nível de correção de erro do QR | `M` (~15%) | Padrão da maioria dos geradores; equilibra densidade de módulos com tolerância a sujeira e arranhão de prateleira | n |
| De onde vem a origem da URL do QR | `window.location.origin`, no navegador | A etiqueta é impressa de onde o operador navega, que em produção é `forge.brios3d.com.br` (AD-012); uma variável nova (`NEXT_PUBLIC_WEB_URL`) seria uma segunda fonte de verdade para o mesmo host, e errada em desenvolvimento | n |
| Limite do alerta | `saldo < piso` (estritamente abaixo) | "Abaixo do mínimo" ao pé da letra; o piso é o valor aceitável, não um valor proibido. Apontado explicitamente na revisão do plano (piso 1000 com saldo 1000 não alerta) e aprovado | y |
| Ordenação dos alertas | Fração do piso que falta, decrescente | Grama e unidade não são comparáveis em valor absoluto (300 g contra 3 un); a fração é, e coloca no topo quem está mais perto de parar a produção | n |
| Papéis | Definir o piso é admin; ler alertas é para os três papéis | Mesmo corte das Fases 9 e 10: o que tem consequência de compra fica com admin, a leitura é de todos | n |
| Falha na busca de alertas no cabeçalho | O indicador simplesmente não aparece, sem mensagem | Um erro no cabeçalho apareceria em toda tela do sistema por causa de um dado acessório; o alerta não é o que o usuário foi fazer ali | n |
| Onde o piso é editado | Nos formulários que já existem de material e de item de estoque | Evita uma tela de "política de estoque" para dois campos escalares | n |
| Material inativo e item inativo | Fora da lista de alertas | Material inativo não aceita rolo novo (Fase 9) e item inativo não aceita entrada (Fase 10): mandar repor o que não se compra mais é ruído | n |
| Quantidade do piso é inteira ou fracionária | Fracionária, como o saldo | O saldo do rolo é fracionário e o do item também (tinta em litro, tubo em metro); um `@IsInt` no piso criaria uma assimetria sem ganho | n |

**Open questions:** none — o formato da etiqueta está decidido por padrão na tabela acima, e é a primeira coisa a confirmar na revisão deste plano.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screen `alerts` | loading state | AC 23 |
| screen `alerts` | error state | AC 24 |
| screen `alerts` | empty state | AC 25 |
| screen `alerts` | unauthorised state | n/a - a rota exige sessão (AD-015) e os três papéis podem ler; sem sessão o `AuthGate` já manda para o login |
| screen `alerts` | densidade e ordenação | AC 18/22 - uma tabela, ordenada pela fração do piso que falta |
| screen `alerts` | ação destrutiva confirma antes | n/a - a tela é só leitura, nada nela apaga ou movimenta |
| screen `label` | loading state | existing - mesmo `<p>Carregando…</p>` que a página do rolo usa enquanto resolve `params` e busca o rolo |
| screen `label` | error state | AC 36 |
| screen `label` | empty state | n/a - a etiqueta é de um rolo específico; "nenhum dado" aqui é rolo inexistente, que é o AC 36 |
| screen `label` | unauthorised state | AC 37 - a rota está sob o `AuthGate`, que redireciona para o login preservando o destino |
| screen `label` | densidade e ordenação | AC 33 - bloco de 70 × 40 mm com QR de 30 mm, um por página |
| screen `label` | ação destrutiva confirma antes | n/a - imprimir não altera nenhum dado |
| screen `roll detail` (existente) | ganha a ação de etiqueta sem regredir | AC 35, AC 38 |
| screen `materials form` (existente) | campo do piso, opcional e limpável | AC 1, AC 3, AC 4 |
| screen `stock item form` (existente) | campo do piso, opcional | AC 7, AC 8 |
| screen `app shell` (existente) | indicador presente, ausente e em falha | AC 26, AC 27, AC 28 |
| API `GET /inventory/alerts` | formato e códigos de erro | AD-001; AC 21 |
| API `GET /inventory/alerts` | quem pode chamar | AC 20, AC 29 |
| API `POST`/`PATCH` de material e de item | formato e códigos de erro | AD-001; AC 4, AC 8 |
| API `POST`/`PATCH` de material e de item | quem pode chamar | AC 5; Fase 10 AC 8 já cobre o `403` de item |
| all `/inventory/alerts` e rotas alteradas | versionamento, rate limit | n/a - nenhum módulo do sistema versiona rota nem aplica rate limit, e esta fase não abre exceção |
| command ou scheduled task | - | n/a - nenhum comando e nenhum job nesta fase; o alerta é lido sob demanda |
| documento ou copy | etiqueta impressa é lida por humano | AC 30, AC 31 - os campos e o que aparece quando o valor é nulo |
| coleção `alerts` | critério de agrupamento | door 4 - uma lista só, com o tipo no campo `kind` |
| coleção `alerts` | nomeação | AC 10, AC 17 - `label` vem do material (`tipo · marca · cor`) ou do `name` do item |
| coleção `alerts` | duplicados | n/a - a chave é o dono (um material ou um item aparece no máximo uma vez, porque a consulta agrupa por id) |
| coleção `alerts` | ordenação | AC 18 |
| coleção `alerts` | exceção que não se encaixa | AC 14, AC 15, AC 16 - sem piso, material inativo e item inativo ficam fora |

## Sources

- `ROADMAP.md` Fase 11 — objetivo, as 6 tarefas, os 2 critérios de aceite e o risco anotado sobre o formato da etiqueta
- `ROADMAP.md` questões abertas 14 (formato e dados da etiqueta) e 15 (mínimo por material em gramas ou por rolos fechados)
- `CONTEXT.md` módulo 2 — "Estoque mínimo com alertas" e "Etiqueta com QR code no rolo"
- `.specs/STATE.md` — AD-012 (hosts de produção), AD-015/AD-018 (sessão e papéis por padrão), AD-020 (paginação), AD-021 (componentes CRUD), AD-023 (`CHECK` como backstop) e AD-024 (leitura derivada em vez de coluna cacheada)
- `.specs/features/phase-9-filament-inventory/plan.md` e `phase-10-stock-items/plan.md` — o shape do ledger, o corte de papéis e o precedente de função pura para cálculo derivado
