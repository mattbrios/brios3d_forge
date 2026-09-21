# Fase 1 — Motor de preço (`pricing`) · checks

Profile: light
Plan: `.specs/features/phase-1-pricing/plan.md`

## Intent

38 checks em 6 fatias · 4 one-way doors · 1 pergunta aberta, que não bloqueia (planilha real para conferir o R1)

O caso **R1** e os valores esperados estão no `plan.md`, seção `## Criteria`. Os testes montam o
R1 a partir de uma fixture única (`src/modules/pricing/fixtures/r1.ts`) e escrevem os números
esperados **literalmente** na asserção, copiados do plano. Nunca calcule o esperado com a fórmula
do código.

Os testes de unidade (`npm --prefix api run test`) não precisam do banco. Os e2e
(`npm --prefix api run test:e2e`) montam a app pelo `AppModule` e precisam do serviço `db` no ar
(`docker compose up -d db`), como na Fase 0.

## Checks

### S1 - Custo detalhado por componente · 4 files · 14 KB · ~4k

**C1** - O R1 devolve `costs.materialCents` `1050` (AC 1)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "R1 material cost"`

**C2** - O R1 devolve `costs.energyCents` `100` (AC 2)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "R1 energy cost"`

**C3** - O R1 devolve `costs.depreciationCents` `400` (AC 3)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "R1 depreciation cost"`

**C4** - O R1 devolve `costs.maintenanceCents` `250` (AC 4)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "R1 maintenance cost"`

**C5** - O R1 devolve `costs.laborCents` `3000` (AC 5)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "R1 labor cost"`

**C6** - O R1 devolve `costs.suppliesCents` `300` (AC 6)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "R1 supplies cost"`

**C7** - O R1 devolve `costs.fixedCostsCents` `1000` (AC 7)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "R1 fixed costs"`

**C8** - O R1 com um segundo material `{ grams: 20, costPerGramCents: 15 }` devolve `costs.materialCents` `1365` (AC 8)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "multimaterial sums before purge"`

**C9** - O R1 com `supplies: []` devolve `costs.suppliesCents` `0`, e os outros seis componentes continuam iguais aos de C1–C5 e C7 (AC 9)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "empty supplies cost zero"`

### S2 - Custo direto, risco e preço por canal · 2 files · 10 KB · ~3k

**C10** - O R1 devolve `costs.directCostCents` `6100` (AC 10)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "R1 direct cost"`

**C11** - O R1 devolve `costs.costWithRiskCents` `6710` (AC 11)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "R1 cost with risk"`

**C12** - O R1 devolve `unitPriceCents` `10485` para `Balcão` e `13980` para `Mercado Livre` (AC 12)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "R1 unit price per channel"`

**C13** - Com os canais de entrada `["C", "A", "B"]`, `channels` devolve três entradas, com `name` `["C", "A", "B"]` nessa ordem (AC 13)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "channels keep input order"`

**C14** - Para o R1 com `quantity` `1`, `3` e `10`, `totalPriceCents` é igual a `unitPriceCents` × `quantity` em todos os canais (AC 14)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "total is unit times quantity"`

**C15** - O R1 com `quantity` `10` devolve `laborCents` `1650`, `directCostCents` `4750`, `costWithRiskCents` `5225`, e para `Balcão` `unitPriceCents` `8165` e `totalPriceCents` `81650` (AC 15)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "batch of 10 dilutes prep and slicing"`

### S3 - Preço mínimo por pedido · 1 file · 6 KB · ~2k

**C16** - O R1 com `minimumOrderCents` `12000` devolve para `Balcão` `unitPriceCents` `12000`, `totalPriceCents` `12000` e `minimumPriceApplied` `true` (AC 16)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "minimum price raises a channel below the floor"`

**C17** - O R1 com `minimumOrderCents` `12000` devolve para `Mercado Livre` `13980` e `false`. Com `minimumOrderCents` `10485` (igual ao preço calculado), `Balcão` devolve `10485` e `false` (AC 17)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "minimum price keeps a channel at or above the floor"`

**C18** - O R1 com `quantity` `3` e `minimumOrderCents` `100000` devolve para `Balcão` `unitPriceCents` `33334`, `totalPriceCents` `100002` e `minimumPriceApplied` `true` (AC 18)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "minimum price per unit rounds up"`

### S4 - Arredondamento num lugar só · 3 files · 6 KB · ~2k

**C19** - Nos resultados de R1, R1 com `quantity` `3` e `10`, e R1 com `minimumOrderCents` `100000`, todo campo `*Cents` de `costs` e de `channels` passa em `Number.isInteger` (AC 19)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "every money field is an integer"`

**C20** - `materials: [{ grams: 33, costPerGramCents: 10 }]` com `purgeRate` `0.05` devolve `materialCents` `347`. A função de arredondamento de custo leva `346.5` a `347` e `346.49` a `346` (AC 20)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "half cent rounds up"`
Proof: `npm --prefix api run test -- src/modules/pricing/rounding.spec.ts -t "cost rounds half up"`

**C21** - Um custo com risco de `6400` com `marginRate` `0.3`, `taxRate` `0.06` e `feeRate` `0` devolve `unitPriceCents` `10000`, e não `10001`. A função de arredondamento de preço leva `10000.000000000002` a `10000` e `10000.01` a `10001` (AC 21)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "exact price is not bumped"`
Proof: `npm --prefix api run test -- src/modules/pricing/rounding.spec.ts -t "price rounds up tolerating float noise"`

**C22** - Com energia e manutenção de `100.4` centavos exatos cada e os outros componentes em `0`, o resultado devolve `energyCents` `100`, `maintenanceCents` `100` e `directCostCents` `201` (AC 22)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "direct cost uses unrounded components"`

**C23** - Nenhum arquivo não-spec de `api/src/modules/pricing/`, exceto `rounding.ts`, contém `Math.round`, `Math.ceil`, `Math.floor`, `Math.trunc` ou `toFixed` (AC 23)
Proof: `test -z "$(grep -rlE 'Math\.(round|ceil|floor|trunc)|toFixed' api/src/modules/pricing --include='*.ts' --exclude='*.spec.ts' | grep -v '/rounding\.ts$')"`

### S5 - Regras de domínio e validação · 4 files · 16 KB · ~4k

**C24** - Com `marginRate` `0.5`, `taxRate` `0.3` e o canal `Balcão` com `feeRate` `0.2` (soma exatamente `1`), o serviço lança `PricingError` com a mensagem `Channel "Balcão": margin + taxes + fee must be below 100%`. Com `feeRate` `0.19`, não lança (AC 24)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "rates summing to 100% throw PricingError"`

**C25** - Dois canais com `name` `Balcão` fazem o serviço lançar `PricingError` com a mensagem `Duplicate channel name: "Balcão"` (AC 25)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "duplicate channel name throws PricingError"`

**C26** - Os erros de C24 e C25 são `instanceof PricingError` e não são `instanceof HttpException`, e `pricing.service.ts` não importa nada de `@nestjs/common` além de `Injectable` (AC 26)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "domain errors are not http exceptions"`
Proof: `test -z "$(grep -E "from '@nestjs/common'" api/src/modules/pricing/pricing.service.ts | grep -vE "^import \{ Injectable \} from '@nestjs/common';$")"`

**C27** - `new PricingService()` sem argumentos calcula o R1, duas chamadas com cópias iguais do R1 devolvem resultados `toEqual`, e o objeto de entrada não é modificado (AC 27)
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.service.spec.ts -t "pure and constructible without dependencies"`

**C28** - Para cada um dos 22 campos numéricos da tabela `Coverage` abaixo, o R1 com esse campo em `-1` responde `400` com `error` contendo o nome do campo (AC 28)
Proof: `npm --prefix api run test:e2e -- test/pricing.e2e-spec.ts -t "negative numeric field returns 400"`

**C29** - `quantity` `0`, `1.5` e `"abc"` respondem `400` com `error` contendo `quantity`, e `quantity` `1` responde `200` (AC 29)
Proof: `npm --prefix api run test:e2e -- test/pricing.e2e-spec.ts -t "quantity must be a positive integer"`

**C30** - `printer.lifespanHours` `0` e `fixedCosts.productiveHoursPerMonth` `0` respondem `400` com `error` contendo o nome do campo. `0.1` responde `200` (AC 30)
Proof: `npm --prefix api run test:e2e -- test/pricing.e2e-spec.ts -t "zero divisors return 400"`

**C31** - `purgeRate` `1.01` e `failureRate` `1.01` respondem `400`, e `1` responde `200`. `marginRate` `1`, `taxRate` `1` e `channels[0].feeRate` `1` respondem `400`. Cada `error` contém o nome do campo (AC 31)
Proof: `npm --prefix api run test:e2e -- test/pricing.e2e-spec.ts -t "rate upper bounds"`

**C32** - `materials: []` e `channels: []` respondem `400` com `error` contendo `materials` e `channels`, respectivamente (AC 32)
Proof: `npm --prefix api run test:e2e -- test/pricing.e2e-spec.ts -t "empty materials or channels return 400"`

**C33** - 33 materiais, 51 insumos e 21 canais respondem `400` com `error` contendo `materials`, `supplies` e `channels`. 32 materiais, 50 insumos e 20 canais (nomes distintos) respondem `200` (AC 33)
Proof: `npm --prefix api run test:e2e -- test/pricing.e2e-spec.ts -t "array size limits"`

**C34** - `channels[0].name` `""` e com 61 caracteres respondem `400` com `error` contendo `name`, e com 60 caracteres responde `200` (AC 34)
Proof: `npm --prefix api run test:e2e -- test/pricing.e2e-spec.ts -t "channel name length"`

**C35** - A propriedade não declarada `extra` em `printer`, em `materials[0]` e na raiz responde `400` com `error` contendo `should not exist` (AC 35)
Proof: `npm --prefix api run test:e2e -- test/pricing.e2e-spec.ts -t "undeclared nested property returns 400"`

### S6 - Rota sem estado e cobertura · 6 files · 8 KB · ~2k

**C36** - `POST /pricing/calculate` com o R1 responde `200` (não `201`) com `quantity` `1`, `costs` igual a `{ materialCents: 1050, energyCents: 100, depreciationCents: 400, maintenanceCents: 250, laborCents: 3000, suppliesCents: 300, fixedCostsCents: 1000, directCostCents: 6100, costWithRiskCents: 6710 }` e `channels` igual a `[{ name: "Balcão", unitPriceCents: 10485, totalPriceCents: 10485, minimumPriceApplied: false }, { name: "Mercado Livre", unitPriceCents: 13980, totalPriceCents: 13980, minimumPriceApplied: false }]` (AC 36)
Proof: `npm --prefix api run test:e2e -- test/pricing.e2e-spec.ts -t "R1 returns the full breakdown"`

**C37** - `POST /pricing/calculate` com a soma de taxas de C24 responde `400` com exatamente `{ "error": "Channel \"Balcão\": margin + taxes + fee must be below 100%" }`, e com canais duplicados responde `400` com `{ "error": "Duplicate channel name: \"Balcão\"" }` (AC 37)
Proof: `npm --prefix api run test:e2e -- test/pricing.e2e-spec.ts -t "domain errors return 400"`
Proof: `npm --prefix api run test -- src/modules/pricing/pricing.controller.spec.ts -t "PricingError becomes BadRequestException"`

**C38** - `test:cov` passa com a suíte completa e sai com código diferente de `0` quando as specs de `pricing` são excluídas, porque a cobertura de linhas de `src/modules/pricing/**` cai abaixo de 95% (AC 38)
Proof: `npm --prefix api run test:cov`
Proof: `! npm --prefix api run test:cov -- --exclude 'src/modules/pricing/**'`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /pricing/calculate` statuses (2) | 200 C36 · 400 C37 | - |
| componentes de custo (7) | material C1 · energy C2 · depreciation C3 · maintenance C4 · labor C5 · supplies C6 · fixedCosts C7 | - |
| agregados de custo (2) | directCost C10 · costWithRisk C11 | - |
| campos do resultado por canal (4) | name C13 · unitPriceCents C12 · totalPriceCents C14 · minimumPriceApplied C16 | - |
| `quantity` (3 valores) | 1 C1 · 3 C18 · 10 C15 | - |
| preço mínimo (3 ramos) | abaixo do piso C16 · igual ao piso C17 · acima do piso C17 | - |
| arredondamento (4 regras) | custo meio para cima C20 · preço para cima C12 · preço exato sem centavo a mais C21 · agregados a partir do exato C22 | - |
| erros de domínio (2) | soma de taxas ≥ 100% C24 · canal duplicado C25 | - |
| soma de taxas (2 bordas) | 1 C24 · 0.99 C24 | - |
| campos numéricos negativos (22) | C28, table-driven over all 22: `printHours` · `materials[].grams` · `materials[].costPerGramCents` · `printer.powerWatts` · `printer.costCents` · `printer.lifespanHours` · `energyTariffCentsPerKwh` · `maintenanceCentsPerHour` · `labor.prepHours` · `labor.slicingHours` · `labor.postProcessingHours` · `labor.centsPerHour` · `supplies[].quantity` · `supplies[].unitCostCents` · `fixedCosts.monthlyCents` · `fixedCosts.productiveHoursPerMonth` · `purgeRate` · `failureRate` · `marginRate` · `taxRate` · `minimumOrderCents` · `channels[].feeRate` | - |
| `quantity` inválida (3) | 0 C29 · 1.5 C29 · `"abc"` C29 | - |
| divisores zero (2) | `printer.lifespanHours` C30 · `fixedCosts.productiveHoursPerMonth` C30 | - |
| limites superiores de taxa (5) | `purgeRate` C31 · `failureRate` C31 · `marginRate` C31 · `taxRate` C31 · `feeRate` C31 | - |
| listas vazias (2) | `materials` C32 · `channels` C32 | - |
| tamanho das listas, cada uma nas duas bordas (3) | `materials` 32/33 C33 · `supplies` 50/51 C33 · `channels` 20/21 C33 | - |
| propriedade não declarada, por nível (3) | raiz C35 · objeto aninhado `printer` C35 · item de lista `materials[0]` C35 | - |
| one-way doors do plano (4) | 1 unidades do contrato C36, C19 · 2 arredondamento C20, C21, C22, C23 · 3 contrato em processo C27 · 4 erro de domínio C26, C37 | - |
| startup config: `PricingModule` montado (1 assembly compartilhada) | `AppModule`, usado pelo `main.ts` e pelo e2e C36 | - |

- Claims naming a status code, route or response shape: C28–C37 - each has a proof that crosses the `POST /pricing/calculate` boundary
- C24 and C25 assert at the service layer, and C37 re-asserts the same two errors at the boundary. One does not substitute for the other
- C19 claims only the four inputs its proof builds, not every possible input

## Swept

- validation: C28, C29, C30, C31, C32, C33, C34, C35
- failure modes: C24, C25, C37 - uma regra de domínio violada vira `400` com mensagem, nunca `500`
- idempotency: C27 - o serviço é puro, e entradas iguais dão resultados iguais sem efeito colateral
- authorization: n/a - a rota é pública até a Fase 3, que coloca autenticação em todas as rotas
- concurrency: n/a - o serviço não guarda estado entre chamadas (C27) e não há recurso compartilhado para disputar
- data lifecycle: n/a - nada é persistido
- dependency failure: n/a - o cálculo não chama banco, rede nem outro serviço
- state transitions: n/a - não existe entidade com estado nesta fase
- observability: existing - o filtro global (AD-001) já registra a stack de qualquer erro inesperado. Erro de domínio é `400` e não é registrado, como toda `HttpException`

## Handoff

Arquivos que a fase toca: 2 existentes (`api/src/app.module.ts` 0,6 KB e `api/vitest.config.ts` 0,3 KB, medidos com `wc -c`) e uns 11 novos no módulo e nos testes. As novas specs são a maior parte, uns 50 KB estimados.

- S1–S6 ≈ 60 KB ≈ 15k tokens, tudo em `pricing`, mais uma linha no `AppModule` e o limite de cobertura. Fica bem abaixo do orçamento padrão de 150k: um builder só, sem pergunta
