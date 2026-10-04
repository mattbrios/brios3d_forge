# Issue #9 - Dinheiro em reais, vírgula decimal e números pt-BR

## Problem

Hoje o operador digita dinheiro em **centavos** (`Custo de aquisição (centavos)`, `Tarifa de
energia (centavos/kWh)`): para cadastrar um rolo de R$ 89,90 ele precisa digitar `8990`, e um zero
a menos grava um custo dez vezes menor, que entra no custo médio (AD-024) e em todo orçamento
calculado depois. Os campos numéricos são `type="number"`, que recusam a vírgula digitada por
quem usa teclado brasileiro, enquanto três telas (`products/[id]`, `product-variant-editor`,
`print-profile-import`) aceitam a vírgula com conversões feitas à mão, cada uma do seu jeito.

A exibição é igualmente desencontrada: `formatCents` mostra `R$ 10.50`, as tabelas de movimentação
mostram `10.50` sem moeda, o custo por grama é cortado em 2 casas (`R$ 0.12/g` para um custo real
de R$ 0,1234/g) e saldos aparecem como `1800 g`, enquanto o painel inicial já usa `1.800 g`.

A issue não traz números de incidência (erros de digitação, suporte); a motivação é de usabilidade.

Quando isto entrar: todo campo de dinheiro é digitado em reais com o prefixo "R$", todo campo
numérico aceita `0,9`, um valor malformado é avisado antes de chamar a API, e todo número exibido
segue o padrão pt-BR (`R$ 1.800,50`, `1.234,5 g`). A API e o banco não mudam.

## Flow

Reusa `formatCents` em `web/src/lib/format.ts` e o `Intl.NumberFormat("pt-BR")` que o painel
inicial já usa, em vez de manter as conversões manuais de cada tela; a API continua recebendo
centavos (AD-006) e nada nela muda.

1. texto digitado -> `Input` (exists, `web/src/components/ui/form.tsx`), agora `type="text"` com `inputMode="decimal"` e prefixo "R$" nos campos de dinheiro; `EntityForm` (exists, AD-021) ganha o tipo de campo `money` (door 2)
2. envio do formulário na tela -> `web/src/lib/number-input.ts` (door 1) converte cada campo: número decimal, ou reais -> centavos com limite de casas; se algum campo for inválido, a tela mostra o erro do formulário e para aqui
3. `apiFetch` (exists, AD-005) - envia o mesmo corpo JSON de hoje, em centavos e números
4. resposta da API -> formatadores em `web/src/lib/format.ts` (exists, door 1 amplia) -> texto exibido: dinheiro, dinheiro por unidade, quantidade
5. formulário de edição -> `web/src/lib/number-input.ts` (door 1) devolve o texto de preenchimento (`8990` -> `89,90`, `1800` -> `1800`)

## Impact

| Front | What changes |
| --- | --- |
| domain | termo "centavos" sai da interface: rótulos `(centavos)` em `settings`, `printers`, `inventory`, `inventory/items` e `pricing` perdem o sufixo e o campo ganha o prefixo "R$". O contrato `*Cents` (AD-006) continua igual |
| domain | `formatCents` mudava `1050` -> `R$ 10.50`, passa a `R$ 10,50` (com espaço não separável ` ` do `Intl`). Quem chama hoje: `settings/page.tsx`, `components/cost-breakdown.tsx` (orçamento e ficha do produto) |
| domain | separador de entrada: `1.800` passa a ser lido como `1,8`, nunca como mil e oitocentos (regra da issue). Afeta todo campo numérico, inclusive os que hoje aceitam vírgula à mão |
| tests | testes de tela que fixam o formato antigo mudam porque o comportamento muda: `products/[id]` (`R$ 55.79`), `inventory/items` (`R$ 0.60/un`), `inventory/items/[id]` (`R$ 45.00/un`), `pricing` (`R$ 10.50`), e os que digitam centavos ou usam `spinbutton` |
| stored data | nada a migrar - só o `web/` muda, a API e o banco seguem em centavos |

## Relations

None - no stored-data shape change

## Surface

None - nothing consumed outside. Todas as rotas da API mantêm o contrato; o web continua mandando centavos.

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. Contrato central de entrada e exibição numérica, que toda tela futura copia | `web/src/lib/number-input.ts`: `parseDecimal(text): ParseResult` e `parseReaisToCents(text, maxDecimals = 2): ParseResult`, com `type ParseResult = { ok: true; value: number \| null } \| { ok: false; reason: "format" \| "decimals" }` (`null` = campo vazio); `decimalToInput(value)` e `centsToReaisInput(cents, maxDecimals = 2)` para preencher a edição. `web/src/lib/format.ts`: `formatCents(cents)`, `formatCentsPerUnit(cents, unit)` (2 a 4 casas), `formatQuantity(value)` (até 2 casas, sem zeros à direita) | conversão manual por tela (`replace(",", ".")`, `toFixed(2)`): é o que existe hoje e já divergiu em três telas; e uma dependência nova (`currency.js`, `react-number-format`): ~60 linhas puras não justificam um pacote, e máscara de digitação está fora de escopo |
| 2. Tipo de campo `money` no `FieldConfig` do `EntityForm` (contrato reutilizável, AD-021) | `type?: "text" \| "number" \| "money" \| "checkbox"`; `"number"` e `"money"` renderizam `type="text" inputMode="decimal"`, e `"money"` mostra o prefixo "R$". A conversão continua na tela (no `buildBody`), não no `EntityForm` | converter dentro do `EntityForm`: ele hoje só guarda strings e devolve `values`; colocar o parse ali obrigaria a tela a conhecer dois formatos de `values` e a tarifa de 4 casas viraria um caso especial do componente genérico |
| 3. Conversão reais -> centavos sem ponto flutuante | aritmética sobre os dígitos: `"10,10"` -> inteiro `1010` exato; com 4 casas, `"0,8732"` -> `8732 / 100` = `87.32` | `Math.round(Number(text) * 100)`: `10.1 * 100` é `1009.9999999999999`, e o arredondamento esconde o erro só até o próximo caso que ele não cobre |
| 4. Leitura dos campos de um formulário de uma vez (aberta durante o build, ampliando o door 1 sem reescrevê-lo) | `readNumbers({ <campo>: { label, text, money?, maxDecimals?, required? } })` -> `{ ok: true; values }` ou `{ ok: false; message }`, na ordem declarada e parando no primeiro inválido; e `formatUnitCents(cents)` (2 a 4 casas, sem unidade) para as colunas de custo das movimentações | chamar `parseDecimal` campo a campo em cada tela: repetiria em 14 telas a montagem da mensagem e a regra do primeiro inválido, que são exatamente o que precisa ser igual em todas |

- Nothing else in this change is hard to reverse: rótulos, prefixo visual e quais telas usam qual formatador se desfazem num refactor.

## Criteria

### S1: Funções centrais de entrada (P1)

O texto digitado vira número ou centavos com a regra do separador único, sem erro de ponto flutuante.

**Acceptance Criteria**

1. WHEN `parseDecimal` recebe `1,8` THEN the system SHALL retornar `1.8`
2. WHEN `parseDecimal` recebe `1.9` THEN the system SHALL retornar `1.9`
3. WHEN `parseDecimal` recebe `1.800` THEN the system SHALL retornar `1.8`
4. IF `parseDecimal` recebe um texto com dois separadores (`1.800,90`, `1.2.3`, `1,2,3`) THEN the system SHALL retornar inválido com motivo `format`
5. IF `parseDecimal` recebe texto não numérico (`abc`, `1a`) THEN the system SHALL retornar inválido com motivo `format`
6. WHEN `parseDecimal` recebe texto vazio ou só espaços THEN the system SHALL retornar `ok` com valor `null`
7. WHEN `parseReaisToCents` recebe `10,10` THEN the system SHALL retornar exatamente `1010`
8. WHEN `parseReaisToCents` recebe `10,12` com o limite padrão de 2 casas THEN the system SHALL retornar `1012`
9. IF `parseReaisToCents` recebe `10,123` com o limite padrão de 2 casas THEN the system SHALL retornar inválido com motivo `decimals`
10. WHEN `parseReaisToCents` recebe `0,8732` com limite de 4 casas THEN the system SHALL retornar `87.32`
11. IF `parseReaisToCents` recebe `0,87321` com limite de 4 casas THEN the system SHALL retornar inválido com motivo `decimals`
12. WHEN `parseReaisToCents` recebe `89` THEN the system SHALL retornar `8900`
13. WHEN `centsToReaisInput` recebe `8990` THEN the system SHALL retornar `89,90`, e `180000` SHALL virar `1800,00` (sem separador de milhar)
14. WHEN `centsToReaisInput` recebe `87.32` com 4 casas THEN the system SHALL retornar `0,8732`
15. WHEN `decimalToInput` recebe `1800` THEN the system SHALL retornar `1800`, e `1.5` SHALL virar `1,5`

**Independent test:** `npm --prefix web run test -- number-input` com um caso por linha acima.

### S2: Formatadores de exibição pt-BR (P1)

Todo número exibido segue o pt-BR, com casas por tipo de valor.

**Acceptance Criteria**

16. WHEN `formatCents` recebe `180050` THEN the system SHALL retornar `R$ 1.800,50`
17. WHEN `formatCents` recebe `1050` THEN the system SHALL retornar `R$ 10,50`
18. WHEN `formatCentsPerUnit` recebe `12.34` e `g` THEN the system SHALL retornar `R$ 0,1234/g`
19. WHEN `formatCentsPerUnit` recebe `50` e `un` THEN the system SHALL retornar `R$ 0,50/un` (mínimo de 2 casas)
20. WHEN `formatCentsPerUnit` recebe `12.345` e `g` THEN the system SHALL retornar `R$ 0,1235/g` (arredonda na 4ª casa)
21. WHEN `formatQuantity` recebe `1800` THEN the system SHALL retornar `1.800`
22. WHEN `formatQuantity` recebe `1234.5` THEN the system SHALL retornar `1.234,5`
23. WHEN `formatQuantity` recebe `1.256` THEN the system SHALL retornar `1,26`, e `2` SHALL virar `2` (sem zeros à direita)

**Independent test:** `npm --prefix web run test -- format` com um caso por linha acima.

### S3: Dinheiro digitado em reais nos formulários (P1)

O operador digita `89,90` e a API recebe `8990`.

**Acceptance Criteria**

24. The system SHALL mostrar os campos de dinheiro sem `(centavos)` no rótulo e com o prefixo "R$": tarifa de energia, hora de trabalho e manutenção (`settings`), custo de aquisição (`printers` e cadastro de rolo em `inventory`), custo unitário da entrada (`inventory/items`) e custo da hora de mão de obra (`pricing`)
25. WHEN o operador envia `89,90` no custo de aquisição do rolo THEN the system SHALL enviar `acquisitionCostCents: 8990` para `POST /inventory/rolls`
26. WHEN o administrador envia `0,8732` na tarifa de energia THEN the system SHALL enviar `energyTariffCentsPerKwh: 87.32` para `PATCH /settings`
27. WHEN o operador envia `1.50` no custo de aquisição da impressora THEN the system SHALL enviar `acquisitionCostCents: 150` (o ponto é sempre decimal; corrigido de `1.500`, que contradizia o AC 9 - decisão do usuário em 2026-10-04)
28. IF um campo de dinheiro tem mais casas que o limite (`10,123`, ou `0,87321` na tarifa) THEN the system SHALL mostrar o erro do formulário `Valor inválido em <campo>: use no máximo <2|4> casas decimais` e SHALL NOT chamar a API

**Independent test:** na tela de impressoras, cadastrar com custo `89,90` e conferir o corpo do `POST /printers` com `8990`.

### S4: Vírgula decimal e erro de valor inválido em todo campo numérico (P1)

Todo campo numérico aceita `0,9`, e um valor malformado para o envio na própria tela.

**Acceptance Criteria**

29. The system SHALL renderizar todo campo numérico de formulário como `type="text"` com `inputMode="decimal"`, nunca `type="number"`
30. WHEN o operador envia `1,5` em Peso inicial THEN the system SHALL enviar `initialWeightGrams: 1.5`
31. IF um campo numérico tem formato inválido (`1.800,90`) THEN the system SHALL mostrar o erro do formulário `Valor inválido em <campo>: use ponto ou vírgula apenas como separador decimal` e SHALL NOT chamar a API
32. WHEN um campo inteiro (peças, slots, potência) recebe `1,5` THEN the system SHALL enviar `1.5` sem erro próprio no web, e o erro exibido SHALL ser o `{ error }` da API
33. The system SHALL converter os campos de `products/[id]`, `product-variant-editor` e `print-profile-import` pelas mesmas funções de S1, sem `replace(",", ".")` nem `replace(".", ",")` restantes no `web/src`

**Independent test:** no cadastro de rolo, enviar `1.800,90` no peso e conferir o alerta sem nenhuma requisição `POST`.

### S5: Formulário de edição preenchido no formato de entrada (P2)

Quem abre a edição vê o valor como digitaria.

**Acceptance Criteria**

34. WHEN a edição de uma impressora com `acquisitionCostCents: 8990` abre THEN the system SHALL preencher o custo com `89,90`
35. WHEN os parâmetros com `energyTariffCentsPerKwh: 87.32` abrem para o administrador THEN the system SHALL preencher a tarifa com `0,8732`
36. WHEN a edição de um rolo com `spoolTareGrams: 1800` abre THEN the system SHALL preencher a tara com `1800`, sem separador de milhar

**Independent test:** abrir a edição de uma impressora e ler o valor do campo de custo.

### S6: Números exibidos em pt-BR nas telas (P2)

Valores e quantidades aparecem no padrão brasileiro em toda tela; identificadores não.

**Acceptance Criteria**

37. The system SHALL exibir dinheiro com `formatCents` (2 casas) no total de custos fixos, nos parâmetros somente leitura, na coluna de custo de `printers` e no detalhamento de custo (`cost-breakdown`)
38. The system SHALL exibir a tarifa de energia somente leitura como `R$ 0,8732/kWh` e o custo por grama ou unidade com `formatCentsPerUnit` (até 4 casas) em `inventory`, `inventory/items` e `inventory/items/[id]`
39. The system SHALL exibir o custo unitário das tabelas de movimentação (`inventory/movements`, `inventory/[id]`, `inventory/items/[id]`) com "R$" (`1050` -> `R$ 10,50`) no lugar de `10.50`
40. The system SHALL exibir quantidades (gramas, kg, horas, horímetro, vida útil, potência, saldos, mínimos, quantidades de movimento e da contagem de alertas) com `formatQuantity` (`1800 g` -> `1.800 g`)
41. The system SHALL exibir identificadores e códigos (documento, telefone, SKU, PIN, número de pedido, ano, slots do AMS) sem separador de milhar

**Independent test:** abrir o detalhe de um rolo com saldo `1800` e ler `1.800 g`.

## Out of scope

| Excluded | Why |
| --- | --- |
| Mudar contrato da API ou o banco | decisão da issue: a API segue em centavos (AD-006) |
| Máscara de digitação estilo "caixa eletrônico" | decisão da issue |
| Validação de inteiro no web | decisão da issue: a recusa vem da API |
| Exibir taxas (`marginRate`, `failureRate`, `taxRate`, `feeRate`) como percentual | a issue não pede; os campos continuam como fração e só ganham a vírgula na entrada |
| Vírgula decimal no campo de bicos (`0.4:Hardened Steel, 0.6:...`) | a vírgula já é o separador da lista nesse campo |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Campo obrigatório deixado vazio | erro do formulário `Preencha <campo>`, sem chamar a API; campo opcional mantém o mapeamento de hoje (`null`, omitido ou `0`) | hoje `Number("")` manda `0` em silêncio, e um custo zero passaria pela API | y |
| Formato aceito pelo parser | `^-?\d+([.,]\d+)?$` depois de `trim()`: aceita sinal negativo (a API decide o sinal), recusa `,5`, `5,` e espaço interno | regra da issue estendida ao mínimo; sinal não é validação nova no web | y |
| Nome do campo na mensagem de erro | o rótulo sem a unidade entre parênteses (`Peso inicial (g)` -> `Peso inicial`) | é o exemplo da issue | y |
| Mais de um campo inválido | a mensagem cita o primeiro campo inválido na ordem do formulário | uma mensagem por vez, como os erros da API hoje | y |
| Mensagem do limite de casas | `Valor inválido em <campo>: use no máximo 2 casas decimais` (4 na tarifa) | a issue dá só a mensagem de formato | y |
| Espaço entre "R$" e o valor | o ` ` que o `Intl` produz | impede quebra de linha entre moeda e valor; os testes asserem o literal | y |
| Painel inicial (`KG` com 1 casa) | fica como está | já usa `Intl` pt-BR; a issue não pede mudança ali | y |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screens com formulário numérico | erro de valor inválido | AC 28, AC 31 |
| screens com formulário numérico | carregamento e erro da API | existing - `Loading`, `PageError` e o `Alert` do formulário, sem mudança |
| screens com formulário numérico | estado vazio | existing - cada tela já tem o seu `EmptyState`; esta mudança não altera listas |
| screens com formulário numérico | o que cada papel vê | existing - os parâmetros só leitura (não admin) passam a formatar dinheiro, AC 37 e AC 38 |
| screens com formulário numérico | ação destrutiva confirma | existing - `ConfirmDialog`; o texto do descarte do rolo passa a usar `formatQuantity`, AC 40 |
| screens com tabelas | densidade e ordenação | n/a - a issue muda só o texto de cada célula, não a ordem nem as colunas |
| copy dos rótulos | estrutura e tom | AC 24 |
| API (todas as rotas consumidas) | shape de resposta, erro, versionamento, rate limit | n/a - nenhuma rota muda; o erro da API continua `{ error }` exibido como hoje |

## Sources

- https://github.com/mattbrios/brios3d_forge/issues/9 - regras de entrada, exibição, escopo e testes
- `.specs/STATE.md` AD-006 (contrato em centavos), AD-021 (`EntityForm`/`DataTable`)
