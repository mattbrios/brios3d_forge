# Fase 1 — Motor de preço (`pricing`)

## Problem

Hoje o sistema não sabe dizer quanto custa uma peça nem por quanto vendê-la. O preço sai de
cabeça ou de uma planilha fora do sistema, e cada canal (balcão, Mercado Livre, Shopee) cobra uma
taxa diferente sobre o preço final. Quem precifica com markup multiplicador sobre o custo vende
abaixo da margem pretendida sempre que imposto e taxa de canal incidem sobre o preço. Custos que
não aparecem na nota do filamento (energia, depreciação, manutenção, mão de obra, custos fixos,
purga e falhas) tendem a ficar de fora.

Quem paga é a empresa, em margem que não percebe perder. Paga também cada fase seguinte que precisa
de um preço: orçamentos (16), catálogo (13), calculadora (12) e margem real (25). Sem um cálculo
único, cada uma faria o seu. O ROADMAP chama isto de "o diferencial do produto" e avisa que "um
erro aqui contamina orçamentos, catálogo e margens". A fonte não traz números de perda.

Quando isto estiver pronto, qualquer módulo, ou um `POST` sem estado, recebe os parâmetros de uma
peça e devolve cada componente de custo, o custo direto, o custo com risco e o preço por canal.
Um caso de referência calculado à mão bate centavo a centavo.

## Flow

Reaproveita o `ValidationPipe` global (AD-003) para validar o formato da entrada e o filtro global
(AD-001) para o formato de erro. Nada de banco: o módulo não importa o `TypeOrmModule`.

1. `POST /pricing/calculate` com o corpo JSON -> `ValidationPipe` (exists) - valida o DTO aninhado e responde `400 { error }` se o formato estiver errado
2. controller de `pricing` (new, no door - placement per AD-004) - repassa o DTO ao serviço
3. `PricingService.calculate(input)` (door 3) - calcula os componentes, o custo direto, o custo com risco e o preço de cada canal. Viola uma regra de domínio -> lança `PricingError` (door 4)
4. arredondamento (door 2) - converte os valores exatos para centavos inteiros num único lugar
5. out: `200` com o resultado (door 1), ou `PricingError` convertido pelo controller em `400 { error }`

## Impact

| Front | What changes |
| --- | --- |
| domain | novo termo: `directCost` (custo direto) - soma dos sete componentes por unidade. Mora em `pricing` |
| domain | novo termo: `costWithRisk` (custo com risco) - `directCost × (1 + failureRate)`. Mora em `pricing` |
| domain | novo termo: `channel` - aqui é só entrada `{ name, feeRate }`. A Fase 5 vai persistir canais com essa mesma taxa, e o cadastro precisa seguir a unidade da door 1 |
| domain | novo termo: `minimumPriceApplied` - flag por canal que indica que o piso do pedido substituiu o preço calculado. Orçamentos (Fase 16) vão exibir essa flag |
| route | nova rota `POST /pricing/calculate`. Nenhuma rota existente muda |
| app | `AppModule` importa o `PricingModule` |
| tests | `vitest.config.ts` ganha um limite de cobertura de linhas para `src/modules/pricing/**`. O `test` sem cobertura não muda |
| web | nada. A primeira tela que consome a rota é a calculadora (Fase 12) |
| stored data | nada para migrar. Nenhuma entidade é criada |

## Relations

`None - no stored-data shape change`. O motor é puro e não persiste nada.

## Surface

| Route | In | Out | Status |
| --- | --- | --- | --- |
| `POST /pricing/calculate` | `quantity`, `printHours`, `materials[]`, `printer`, `energyTariffCentsPerKwh`, `maintenanceCentsPerHour`, `labor`, `supplies[]`, `fixedCosts`, `purgeRate`, `failureRate`, `marginRate`, `taxRate`, `minimumOrderCents`, `channels[]` | `quantity` · `costs` (7 componentes + `directCostCents` + `costWithRiskCents`, por unidade) · `channels[]` (`name`, `unitPriceCents`, `totalPriceCents`, `minimumPriceApplied`) · `{ error }` | `200`, `400` |

## Landing

| One-way door | Literal shape | Alternative rejected |
| --- | --- | --- |
| 1. unidades do contrato | dinheiro em **centavos**, com o sufixo `Cents` no nome do campo. Na entrada, pode ser fracionário (`costPerGramCents: 2.499`, `energyTariffCentsPerKwh: 78.52`). Na saída, é sempre inteiro. Percentuais são **fração** com o sufixo `Rate` (`marginRate: 0.3`). Horas são decimais (`printHours: 5.5`). Pesos em gramas (`grams`) | reais decimais (`12.34`): o ROADMAP fixa centavos no cálculo, e reais na saída levam `0.1 + 0.2` para dentro do contrato. Percentual inteiro (`30`): contradiz a convenção de fração do ROADMAP e aceita `0.3` por engano sem erro |
| 2. política de arredondamento | uma única função no módulo. Cada componente e os custos são arredondados **meio para cima** para centavos. O preço unitário é arredondado **para cima** (teto), tolerando ruído de ponto flutuante abaixo de `1e-6` centavo. O custo direto, o custo com risco e o preço partem dos valores **exatos**, nunca dos componentes arredondados | teto em tudo: infla cada componente exibido. Meio para cima no preço: pode deixar a margem real meio centavo abaixo da pedida. Somar os componentes já arredondados: acumula até 3,5 centavos de erro no custo direto antes do markup |
| 3. contrato em processo do serviço | `PricingService.calculate(input: PricingInput): PricingResult`, síncrono, sem dependências no construtor (`new PricingService()` funciona), sem I/O. `PricingInput` e `PricingResult` são tipos exportados do módulo, e o DTO da rota implementa `PricingInput` | função solta sem classe: as Fases 13, 16 e 25 injetam o cálculo pelo DI do Nest, e trocar depois muda todos os consumidores. Serviço que lê as configurações do banco: deixa de ser puro, e a Fase 5 ainda não existe |
| 4. erro de domínio | o serviço lança `PricingError extends Error` (não uma `HttpException`). O controller converte em `BadRequestException(message)`, que sai como `400 { error }`. É o precedente para erros de domínio dos próximos módulos puros | lançar `BadRequestException` direto no serviço: prende o cálculo ao HTTP, e as Fases 13 e 25 vão chamá-lo fora de uma requisição (recálculo de catálogo e relatórios) |

- Nothing else in this change is hard to reverse

## Criteria

Nos critérios, o caso **R1** é este (uma peça, valores em centavos):

| Entrada | R1 |
| --- | --- |
| `quantity` | 1 |
| `printHours` | 5 |
| `materials` | `[{ grams: 100, costPerGramCents: 10 }]` (PLA a R$ 100/kg) |
| `printer` | `{ powerWatts: 250, costCents: 400000, lifespanHours: 5000 }` |
| `energyTariffCentsPerKwh` | 80 |
| `maintenanceCentsPerHour` | 50 |
| `labor` | `{ prepHours: 0.25, slicingHours: 0.25, postProcessingHours: 0.5, centsPerHour: 3000 }` |
| `supplies` | `[{ quantity: 2, unitCostCents: 50 }, { quantity: 1, unitCostCents: 200 }]` |
| `fixedCosts` | `{ monthlyCents: 60000, productiveHoursPerMonth: 300 }` |
| `purgeRate` / `failureRate` | 0.05 / 0.10 |
| `marginRate` / `taxRate` | 0.30 / 0.06 |
| `minimumOrderCents` | 0 |
| `channels` | `[{ name: "Balcão", feeRate: 0 }, { name: "Mercado Livre", feeRate: 0.16 }]` |

### S1: Custo detalhado por componente (P1)

O serviço devolve cada componente de custo por unidade, conforme a fórmula do `CONTEXT.md`.

**Acceptance Criteria**

1. The pricing service SHALL compute `materialCents` as Σ(`grams` × `costPerGramCents`) × (1 + `purgeRate`), which for R1 is `1050`
2. The pricing service SHALL compute `energyCents` as `powerWatts` / 1000 × `printHours` × `energyTariffCentsPerKwh`, which for R1 is `100`
3. The pricing service SHALL compute `depreciationCents` as `costCents` / `lifespanHours` × `printHours`, which for R1 is `400`
4. The pricing service SHALL compute `maintenanceCents` as `maintenanceCentsPerHour` × `printHours`, which for R1 is `250`
5. The pricing service SHALL compute `laborCents` as ((`prepHours` + `slicingHours`) / `quantity` + `postProcessingHours`) × `centsPerHour`, which for R1 is `3000`
6. The pricing service SHALL compute `suppliesCents` as Σ(`quantity` × `unitCostCents`) of the supplies, which for R1 is `300`
7. The pricing service SHALL compute `fixedCostsCents` as `monthlyCents` / `productiveHoursPerMonth` × `printHours`, which for R1 is `1000`
8. WHERE `materials` has more than one entry the pricing service SHALL sum every entry before applying the purge, so R1 with a second material `{ grams: 20, costPerGramCents: 15 }` yields `materialCents` `1365`
9. WHERE `supplies` is empty the pricing service SHALL return `suppliesCents` `0`

**Independent test:** `new PricingService().calculate(R1).costs` devolve os sete componentes acima.

### S2: Custo direto, risco e preço por canal (P1)

A partir dos componentes, o serviço chega ao preço de cada canal com markup divisor.

**Acceptance Criteria**

10. The pricing service SHALL compute `directCostCents` as the sum of the seven unrounded components, which for R1 is `6100`
11. The pricing service SHALL compute `costWithRiskCents` as the unrounded direct cost × (1 + `failureRate`), which for R1 is `6710`
12. The pricing service SHALL compute each channel's `unitPriceCents` as the unrounded cost with risk / (1 − `marginRate` − `taxRate` − `feeRate`), rounded up to the cent, which for R1 is `10485` for `Balcão` and `13980` for `Mercado Livre`
13. The pricing service SHALL return one entry in `channels` per input channel, in the input order, each with the input `name`
14. The pricing service SHALL return `totalPriceCents` equal to `unitPriceCents` × `quantity` for every channel
15. WHEN `quantity` is `10` on R1 THEN the pricing service SHALL return `laborCents` `1650`, `directCostCents` `4750`, `costWithRiskCents` `5225`, and for `Balcão` `unitPriceCents` `8165` and `totalPriceCents` `81650`

**Independent test:** `calculate(R1).channels` devolve `10485` e `13980`. Com `quantity: 10`, o preço unitário do balcão cai para `8165`.

### S3: Preço mínimo por pedido (P1)

O pedido nunca sai abaixo do piso, e o resultado indica quando o piso foi aplicado.

**Acceptance Criteria**

16. IF a channel's `unitPriceCents` × `quantity` is below `minimumOrderCents` THEN the pricing service SHALL set that channel's `unitPriceCents` to `minimumOrderCents` / `quantity` rounded up to the cent and `minimumPriceApplied` to `true`, so R1 with `minimumOrderCents` `12000` yields `12000` and `true` for `Balcão`
17. WHILE a channel's `unitPriceCents` × `quantity` is at or above `minimumOrderCents` the pricing service SHALL keep the calculated price and set `minimumPriceApplied` to `false`, so R1 with `minimumOrderCents` `12000` yields `13980` and `false` for `Mercado Livre`
18. WHEN R1 has `quantity` `3` and `minimumOrderCents` `100000` THEN the pricing service SHALL return for `Balcão` `unitPriceCents` `33334` and `totalPriceCents` `100002`

**Independent test:** R1 com `minimumOrderCents: 12000` devolve o balcão no piso e o Mercado Livre no preço calculado.

### S4: Arredondamento num lugar só (P1)

Todo valor de dinheiro na saída é um inteiro de centavos, e a regra está numa única função.

**Acceptance Criteria**

19. The pricing service SHALL return every money field of the result as an integer number of cents
20. WHEN a cost value is exactly half a cent above an integer THEN the pricing service SHALL round it up, so `materials` `[{ grams: 33, costPerGramCents: 10 }]` with `purgeRate` `0.05` yields `materialCents` `347`
21. WHEN the exact unit price is an integer number of cents THEN the pricing service SHALL return that integer without adding a cent, so a cost with risk of `6400` with rates summing to `0.36` yields `10000`
22. WHEN two components are each `100.4` cents exact and the others are `0` THEN the pricing service SHALL return each component as `100` and `directCostCents` as `201`
23. The pricing module SHALL perform every rounding to cents through a single exported function

**Independent test:** os três casos numéricos acima como testes de unidade da função de arredondamento e do serviço.

### S5: Regras de domínio e validação (P1)

Entrada impossível é recusada com uma mensagem útil, tanto no serviço quanto na rota.

**Acceptance Criteria**

24. IF `marginRate` + `taxRate` + a channel's `feeRate` is at or above `1` THEN the pricing service SHALL throw `PricingError` with the message `Channel "<name>": margin + taxes + fee must be below 100%`
25. IF two channels share the same `name` THEN the pricing service SHALL throw `PricingError` with the message `Duplicate channel name: "<name>"`
26. The pricing service SHALL never throw an `HttpException`
27. The pricing service SHALL be constructible with no arguments and SHALL return equal results for equal inputs
28. IF any numeric input is negative THEN `POST /pricing/calculate` SHALL respond `400` with `error` naming the field
29. IF `quantity` is not an integer of at least `1` THEN `POST /pricing/calculate` SHALL respond `400` with `error` naming `quantity`
30. IF `lifespanHours` or `productiveHoursPerMonth` is `0` THEN `POST /pricing/calculate` SHALL respond `400` with `error` naming the field
31. IF `purgeRate` or `failureRate` is above `1`, or `marginRate`, `taxRate` or a `feeRate` is at or above `1` THEN `POST /pricing/calculate` SHALL respond `400` with `error` naming the field
32. IF `materials` or `channels` is empty THEN `POST /pricing/calculate` SHALL respond `400` with `error` naming the field
33. IF `materials` has more than 32 entries, `supplies` more than 50, or `channels` more than 20 THEN `POST /pricing/calculate` SHALL respond `400` with `error` naming the field
34. IF a channel `name` is empty or longer than 60 characters THEN `POST /pricing/calculate` SHALL respond `400` with `error` naming `name`
35. IF a nested object carries a property the DTO does not declare THEN `POST /pricing/calculate` SHALL respond `400` with `error` containing `should not exist`

**Independent test:** `curl` com `marginRate: 0.5, taxRate: 0.3` e `feeRate: 0.2` devolve `400 { "error": "Channel \"Balcão\": margin + taxes + fee must be below 100%" }`.

### S6: Rota sem estado e cobertura (P1)

A rota expõe o motor sem persistir nada, e a cobertura do módulo é um portão.

**Acceptance Criteria**

36. WHEN `POST /pricing/calculate` receives R1 THEN the API SHALL respond `200` with `quantity` `1`, `costs` holding the values of AC 1–7, 10 and 11, and `channels` holding the values of AC 12 with `totalPriceCents` equal to the unit price and `minimumPriceApplied` `false`
37. IF `PricingError` is thrown while handling `POST /pricing/calculate` THEN the API SHALL respond `400` with `{ "error": <the PricingError message> }`
38. WHEN `npm --prefix api run test:cov` runs and line coverage of `src/modules/pricing/**` is below 95% THEN the command SHALL exit non-zero

**Independent test:** `curl -X POST localhost:3001/pricing/calculate -H 'content-type: application/json' -d @r1.json` devolve o R1 completo.

## Out of scope

| Excluded | Why |
| --- | --- |
| Tarifa fixa por item do canal (ex.: a taxa fixa do Mercado Livre e da Shopee) | a fórmula do `CONTEXT.md` só tem `% taxa do canal`. Entra quando a Fase 5 cadastrar canais |
| Ler tarifas, margens e % de falha das configurações | a Fase 5 cria as configurações e a Fase 12 as injeta no motor. Aqui, tudo chega no corpo |
| % de falha calculada das falhas reais | Fase 20. Aqui é só a entrada `failureRate` |
| Tela da calculadora | Fase 12 |
| Faixas de desconto por quantidade além da diluição do preparo e do fatiamento | o ROADMAP define o desconto por quantidade só como diluição no lote |
| Custo detalhado por material ou por insumo (linha a linha) | o `CONTEXT.md` pede o detalhamento por componente. A lista por material pode entrar com a Fase 12 |
| Persistir cálculos | o motor é sem estado. Orçamentos (Fase 16) guardam o resultado |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Unidade do dinheiro no contrato (door 1) | centavos com sufixo `Cents`, fracionários na entrada e inteiros na saída | o ROADMAP fixa centavos no cálculo, e a rota é o contrato que a Fase 12 e os módulos internos vão consumir | n |
| Arredondamento do preço de venda (door 2) | teto no preço unitário, meio para cima nos custos | com o teto, a margem nunca fica abaixo da pedida. Custa no máximo 1 centavo por unidade | n |
| O que se dilui no lote | preparo e fatiamento são por lote. Pós-processamento, material, máquina, insumos e custos fixos são por unidade | o ROADMAP diz "diluir preparo e fatiamento no lote". O pós-processamento é feito peça por peça | n |
| Unidade da entrada de impressão | `printHours`, `grams` e `supplies` descrevem **uma** unidade | com isso, `quantity` só multiplica e dilui, e o caso de uma unidade é o mais comum na calculadora | n |
| Onde o piso se aplica | ao total do pedido (`unitPrice × quantity`), por canal, subindo o preço unitário para o teto de `minimum / quantity` | o ROADMAP diz "preço mínimo por pedido", e manter `total = unit × quantity` evita dois números que não batem | n |
| `printHours` igual a `0` | aceito, e zera energia, depreciação, manutenção e custos fixos | não há motivo de domínio para recusar, e o zero não causa divisão por zero | n |
| Limites de tamanho das listas | 32 materiais, 50 insumos e 20 canais | 32 cobre 4 AMS de 4 slots mais a bobina externa com folga. Os outros são folgados para uma peça | n |

**Open questions:**

| # | Kind | Question | Until answered |
| --- | --- | --- | --- |
| 1 | open | A empresa tem uma planilha de preço já usada para validar o R1 (o ROADMAP sugere isso)? | o R1 é conferido só pelo cálculo à mão deste plano. Se houver planilha, um caso real vira mais um teste |

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| API `POST /pricing/calculate` | response shape | AC 36 |
| API `POST /pricing/calculate` | error shape and codes | AC 24, 25, 28–35, 37 (formato vem do AD-001) |
| API `POST /pricing/calculate` | who may call it | n/a - público até a Fase 3, que coloca autenticação em todas as rotas |
| API `POST /pricing/calculate` | versioning | n/a - o único consumidor futuro é o web deste repositório, que muda junto (regra do `AGENTS.md`) |
| API `POST /pricing/calculate` | rate limit | n/a - cálculo puro em memória, com as listas limitadas pelo AC 33. Não há recurso caro para proteger |
| command `test:cov` | exit codes | AC 38 |

## Sources

- `ROADMAP.md` Fase 1 - tarefas e critérios de aceite
- `CONTEXT.md` §4 - fórmula da calculadora e markup divisor
- `.specs/STATE.md` AD-001, AD-003, AD-004
