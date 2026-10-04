# Issue #9 - Dinheiro em reais, vírgula decimal e números pt-BR - checks

Profile: light
Plan: `.specs/features/issue-9-ptbr-numbers/plan.md`

71 checks em 7 slices · 4 one-way doors · 0 open

`T` abaixo é `npm --prefix web run test --`.

## Checks

### S1 - Funções centrais de entrada · 2 files · ~6 KB · ~2k

**C1** - `parseDecimal("1,8")` retorna `1.8` (AC 1)
Proof: `T src/lib/number-input.test.ts -t "parseDecimal reads 1,8 as 1.8"`

**C2** - `parseDecimal("1.9")` retorna `1.9` (AC 2)
Proof: `T src/lib/number-input.test.ts -t "parseDecimal reads 1.9 as 1.9"`

**C3** - `parseDecimal("1.800")` retorna `1.8`, nunca `1800` (AC 3)
Proof: `T src/lib/number-input.test.ts -t "parseDecimal reads 1.800 as 1.8"`

**C4** - `1.800,90`, `1.2.3` e `1,2,3` retornam inválido com motivo `format` (AC 4)
Proof: `T src/lib/number-input.test.ts -t "parseDecimal rejects more than one separator"`

**C5** - `abc` e `1a` retornam inválido com motivo `format` (AC 5)
Proof: `T src/lib/number-input.test.ts -t "parseDecimal rejects non numeric text"`

**C6** - `""` e `"   "` retornam `ok` com valor `null` (AC 6)
Proof: `T src/lib/number-input.test.ts -t "parseDecimal reads blank as null"`

**C7** - `parseReaisToCents("10,10")` retorna exatamente `1010` (AC 7, door 3)
Proof: `T src/lib/number-input.test.ts -t "parseReaisToCents converts 10,10 to exactly 1010"`

**C8** - `parseReaisToCents("10,12")` retorna `1012` com o limite padrão de 2 casas (AC 8)
Proof: `T src/lib/number-input.test.ts -t "parseReaisToCents accepts 2 decimals by default"`

**C9** - `parseReaisToCents("10,123")` retorna inválido com motivo `decimals` (AC 9)
Proof: `T src/lib/number-input.test.ts -t "parseReaisToCents rejects 3 decimals by default"`

**C10** - `parseReaisToCents("0,8732", 4)` retorna `87.32` (AC 10)
Proof: `T src/lib/number-input.test.ts -t "parseReaisToCents accepts 4 decimals when allowed"`

**C11** - `parseReaisToCents("0,87321", 4)` retorna inválido com motivo `decimals` (AC 11)
Proof: `T src/lib/number-input.test.ts -t "parseReaisToCents rejects 5 decimals when 4 are allowed"`

**C12** - `parseReaisToCents("89")` retorna `8900` (AC 12)
Proof: `T src/lib/number-input.test.ts -t "parseReaisToCents converts whole reais"`

**C13** - `centsToReaisInput(8990)` retorna `89,90` e `centsToReaisInput(180000)` retorna `1800,00` (AC 13)
Proof: `T src/lib/number-input.test.ts -t "centsToReaisInput writes 2 decimals without grouping"`

**C14** - `centsToReaisInput(87.32, 4)` retorna `0,8732` (AC 14)
Proof: `T src/lib/number-input.test.ts -t "centsToReaisInput writes up to 4 decimals"`

**C15** - `decimalToInput(1800)` retorna `1800` e `decimalToInput(1.5)` retorna `1,5` (AC 15)
Proof: `T src/lib/number-input.test.ts -t "decimalToInput writes comma without grouping"`

**C16** - O parser aceita `-5` (`-5`) e `  2,5  ` (`2.5`), e recusa `,5`, `5,` e `1 800` com motivo `format` (Assumptions: formato aceito)
Proof: `T src/lib/number-input.test.ts -t "parseDecimal edge formats"`

### S2 - Formatadores de exibição pt-BR · 2 files · ~3 KB · ~1k

**C17** - `formatCents(180050)` retorna `R$ 1.800,50` (AC 16)
Proof: `T src/lib/format.test.ts -t "formatCents groups thousands"`

**C18** - `formatCents(1050)` retorna `R$ 10,50` (AC 17)
Proof: `T src/lib/format.test.ts -t "formatCents uses comma decimals"`

**C19** - `formatCentsPerUnit(12.34, "g")` retorna `R$ 0,1234/g` (AC 18)
Proof: `T src/lib/format.test.ts -t "formatCentsPerUnit keeps 4 decimals"`

**C20** - `formatCentsPerUnit(50, "un")` retorna `R$ 0,50/un` (AC 19)
Proof: `T src/lib/format.test.ts -t "formatCentsPerUnit keeps at least 2 decimals"`

**C21** - `formatCentsPerUnit(12.345, "g")` retorna `R$ 0,1235/g` (AC 20)
Proof: `T src/lib/format.test.ts -t "formatCentsPerUnit rounds at the 4th decimal"`

**C22** - `formatQuantity(1800)` retorna `1.800` (AC 21)
Proof: `T src/lib/format.test.ts -t "formatQuantity groups thousands"`

**C23** - `formatQuantity(1234.5)` retorna `1.234,5` (AC 22)
Proof: `T src/lib/format.test.ts -t "formatQuantity uses comma decimals"`

**C24** - `formatQuantity(1.256)` retorna `1,26` e `formatQuantity(2)` retorna `2` (AC 23)
Proof: `T src/lib/format.test.ts -t "formatQuantity keeps up to 2 decimals without trailing zeros"`

### S3 - Dinheiro digitado em reais · 13 files · ~109 KB · ~27k

**C25** - Em `settings`, os campos `Tarifa de energia`, `Hora de trabalho` e `Manutenção` não têm `centavos` no rótulo e mostram o prefixo `R$` (AC 24)
Proof: `T "src/app/(app)/settings/page.test.tsx" -t "money fields are labelled in reais"`

**C26** - Em `printers`, o campo `Custo de aquisição` não tem `centavos` no rótulo e mostra o prefixo `R$` (AC 24)
Proof: `T "src/app/(app)/printers/page.test.tsx" -t "acquisition cost is labelled in reais"`

**C27** - No cadastro de rolo (`inventory`), o campo `Custo de aquisição` não tem `centavos` no rótulo e mostra o prefixo `R$` (AC 24)
Proof: `T "src/app/(app)/inventory/page.test.tsx" -t "acquisition cost is labelled in reais"`

**C28** - Na entrada de insumo (`inventory/items`), o campo `Custo unitário` não tem `centavos` no rótulo e mostra o prefixo `R$` (AC 24)
Proof: `T "src/app/(app)/inventory/items/page.test.tsx" -t "unit cost is labelled in reais"`

**C29** - Em `pricing`, o campo `Custo da hora de mão de obra` não tem `centavos` no rótulo e mostra o prefixo `R$` (AC 24)
Proof: `T "src/app/(app)/pricing/page.test.tsx" -t "labor cost is labelled in reais"`

**C30** - `EntityForm` renderiza um campo `money` como `type="text"`, `inputMode="decimal"` e prefixo `R$`, e um campo `number` como `type="text"` e `inputMode="decimal"` sem prefixo (door 2, AC 24, AC 29)
Proof: `T src/components/crud/entity-form.test.tsx -t "money and number fields are decimal text inputs"`

**C31** - Enviar `89,90` no custo de aquisição do rolo manda `acquisitionCostCents: 8990` no `POST /inventory/rolls` (AC 25)
Proof: `T "src/app/(app)/inventory/page.test.tsx" -t "sends the acquisition cost in cents"`

**C32** - Enviar `0,8732` na tarifa de energia manda `energyTariffCentsPerKwh: 87.32` no `PATCH /settings` (AC 26)
Proof: `T "src/app/(app)/settings/page.test.tsx" -t "sends the energy tariff in cents with 4 decimals"`

**C33** - Enviar `1.50` no custo de aquisição da impressora manda `acquisitionCostCents: 150` no `POST /printers` (AC 27)
Proof: `T "src/app/(app)/printers/page.test.tsx" -t "dot is always the decimal separator"`

**C34** - Enviar `10,123` no custo da impressora mostra `Valor inválido em Custo de aquisição: use no máximo 2 casas decimais` e nenhum `POST /printers` sai (AC 28)
Proof: `T "src/app/(app)/printers/page.test.tsx" -t "rejects more than 2 decimals without calling the API"`

**C35** - Enviar `0,87321` na tarifa mostra `Valor inválido em Tarifa de energia: use no máximo 4 casas decimais` e nenhum `PATCH /settings` sai (AC 28)
Proof: `T "src/app/(app)/settings/page.test.tsx" -t "rejects more than 4 decimals in the tariff without calling the API"`

### S4 - Vírgula decimal e erro de valor inválido · 14 files · ~174 KB · ~43k

**C36** - Nenhum `.tsx` de produção em `web/src` contém `type="number"` (AC 29)
Proof: `test -z "$(grep -rl 'type="number"' web/src --include='*.tsx' --exclude='*.test.tsx')"`

**C37** - Enviar `1,5` em `Peso inicial` manda `initialWeightGrams: 1.5` no `POST /inventory/rolls` (AC 30)
Proof: `T "src/app/(app)/inventory/page.test.tsx" -t "accepts a comma decimal weight"`

**C38** - Enviar `1.800,90` em `Peso inicial` mostra `Valor inválido em Peso inicial: use ponto ou vírgula apenas como separador decimal` e nenhum `POST /inventory/rolls` sai (AC 31)
Proof: `T "src/app/(app)/inventory/page.test.tsx" -t "rejects a malformed number without calling the API"`

**C39** - Enviar `1,5` em `Potência` manda `powerWatts: 1.5` no `POST /printers`, e o `{ error }` da resposta `400` aparece no formulário (AC 32)
Proof: `T "src/app/(app)/printers/page.test.tsx" -t "integer fields send decimals and show the API error"`

**C40** - Nenhum `.ts`/`.tsx` de produção em `web/src` contém `replace(",", ".")` nem `replace(".", ",")` (AC 33)
Proof: `test -z "$(grep -rlE 'replace\("[.,]", "[.,]"\)' web/src --include='*.ts' --include='*.tsx' --exclude='*.test.ts' --exclude='*.test.tsx')"`

**C41** - Enviar `1.800,90` em `Gramas` na ficha técnica mostra `Valor inválido em Gramas: use ponto ou vírgula apenas como separador decimal` e nenhuma requisição de gravação sai (AC 33)
Proof: `T src/components/product-variant-editor.test.tsx -t "rejects a malformed number without calling the API"`

**C42** - Enviar o cadastro de rolo com `Peso inicial` vazio mostra `Preencha Peso inicial` e nenhum `POST /inventory/rolls` sai (Assumptions: campo obrigatório vazio)
Proof: `T "src/app/(app)/inventory/page.test.tsx" -t "rejects a blank required number without calling the API"`

**C43** - Enviar um material com `Estoque mínimo` vazio manda `minimumStockGrams: null`, como hoje (Assumptions: campo obrigatório vazio, lado opcional)
Proof: `T "src/app/(app)/materials/page.test.tsx" -t "blank optional minimum is sent as null"`

**C44** - Com `Peso inicial` = `1.2.3` e `Tara do carretel` = `abc`, a mensagem cita só `Peso inicial` (Assumptions: mais de um campo inválido)
Proof: `T "src/app/(app)/inventory/page.test.tsx" -t "reports the first invalid field"`

### S5 - Edição preenchida no formato de entrada · 0 new files · ~0k

**C45** - Abrir a edição de uma impressora com `acquisitionCostCents: 8990` preenche o custo com `89,90` (AC 34)
Proof: `T "src/app/(app)/printers/page.test.tsx" -t "edit form shows the cost in reais"`

**C46** - Os parâmetros com `energyTariffCentsPerKwh: 87.32` abrem para o administrador com a tarifa `0,8732` (AC 35)
Proof: `T "src/app/(app)/settings/page.test.tsx" -t "prefills the tariff in reais with 4 decimals"`

**C47** - Abrir a edição de um rolo com `spoolTareGrams: 1800` preenche a tara com `1800` (AC 36)
Proof: `T "src/app/(app)/inventory/[id]/page.test.tsx" -t "edit form shows the tare without grouping"`

### S6 - Exibição pt-BR nas telas · 7 files · ~26 KB · ~7k

**C48** - Em `settings`, o total dos custos fixos `180050` aparece como `R$ 1.800,50` (AC 37)
Proof: `T "src/app/(app)/settings/page.test.tsx" -t "fixed cost total in pt-BR"`

**C49** - Em `settings` somente leitura (papel não admin), a hora de trabalho `4500` aparece como `R$ 45,00` e a tarifa `87.32` como `R$ 0,8732/kWh` (AC 37, AC 38)
Proof: `T "src/app/(app)/settings/page.test.tsx" -t "read only view formats money"`

**C50** - Em `printers`, a coluna de custo mostra `899000` como `R$ 8.990,00` (AC 37)
Proof: `T "src/app/(app)/printers/page.test.tsx" -t "cost column in reais"`

**C51** - No orçamento (`pricing`, via `cost-breakdown`), o preço `1050` aparece como `R$ 10,50` (AC 37)
Proof: `T "src/app/(app)/pricing/page.test.tsx" -t "cost breakdown in pt-BR"`

**C52** - Em `inventory`, o custo médio `12.34` aparece como `R$ 0,1234/g` (AC 38)
Proof: `T "src/app/(app)/inventory/page.test.tsx" -t "average cost per gram with 4 decimals"`

**C53** - Em `inventory/items`, o custo médio `60` aparece como `R$ 0,60/un` (AC 38)
Proof: `T "src/app/(app)/inventory/items/page.test.tsx" -t "average unit cost in pt-BR"`

**C54** - Em `inventory/items/[id]`, o custo médio `4500` aparece como `R$ 45,00/un` (AC 38)
Proof: `T "src/app/(app)/inventory/items/[id]/page.test.tsx" -t "average unit cost in pt-BR"`

**C55** - Em `inventory/movements`, o custo unitário `1050` aparece como `R$ 10,50` (AC 39)
Proof: `T "src/app/(app)/inventory/movements/page.test.tsx" -t "unit cost in reais"`

**C56** - Em `inventory/[id]`, o custo de movimento `12.34` aparece como `R$ 0,1234` (AC 39, até 4 casas por ser custo por grama)
Proof: `T "src/app/(app)/inventory/[id]/page.test.tsx" -t "movement cost in reais"`

**C57** - Em `inventory/items/[id]`, o custo unitário de movimento `1050` aparece como `R$ 10,50` (AC 39)
Proof: `T "src/app/(app)/inventory/items/[id]/page.test.tsx" -t "movement cost in reais"`

**C58** - Em `inventory`, o saldo `1800` de um material aparece como `1.800 g` (AC 40)
Proof: `T "src/app/(app)/inventory/page.test.tsx" -t "balance in pt-BR"`

**C59** - Em `inventory/[id]`, o saldo `1800` aparece como `1.800 g` e a quantidade de movimento `-1200` como `-1.200` (AC 40)
Proof: `T "src/app/(app)/inventory/[id]/page.test.tsx" -t "quantities in pt-BR"`

**C60** - Em `inventory/items`, o saldo `1200` aparece como `1.200 un` (AC 40)
Proof: `T "src/app/(app)/inventory/items/page.test.tsx" -t "balance in pt-BR"`

**C61** - Em `inventory/items/[id]`, o saldo `1200` aparece como `1.200 un` (AC 40)
Proof: `T "src/app/(app)/inventory/items/[id]/page.test.tsx" -t "balance in pt-BR"`

**C62** - Em `inventory/alerts`, saldo `1500` e mínimo `2000` aparecem como `1.500` e `2.000` (AC 40)
Proof: `T "src/app/(app)/inventory/alerts/page.test.tsx" -t "quantities in pt-BR"`

**C63** - Em `materials`, o mínimo `1000` aparece como `1.000 g` (AC 40)
Proof: `T "src/app/(app)/materials/page.test.tsx" -t "minimum in pt-BR"`

**C64** - Em `printers`, a vida útil `20000` aparece como `20.000` (AC 40)
Proof: `T "src/app/(app)/printers/page.test.tsx" -t "quantities in pt-BR"`

**C65** - Em `products/[id]`, `1.5` horas aparecem como `1,5 h` e `1234.5` gramas como `1.234,5 g` (AC 40)
Proof: `T "src/app/(app)/products/[id]/page.test.tsx" -t "quantities in pt-BR"`

**C66** - Na etiqueta (`inventory/[id]/label`), o peso nominal `1000` aparece como `1.000 g` (AC 40)
Proof: `T "src/app/(app)/inventory/[id]/label/page.test.tsx" -t "nominal weight in pt-BR"`

**C67** - Em `printers`, uma impressora com `amsSlots: 1000` mostra `Sim (1000)`, sem separador (AC 41)
Proof: `T "src/app/(app)/printers/page.test.tsx" -t "ams slots are not grouped"`

### S7 - Lacunas fechadas após a verificação da rodada 1 · 3 files · ~25 KB · ~6k

Adicionados depois do PASS da rodada 1, a pedido do usuário (2026-10-04): o card de alertas do Início ficou fora da lista de telas de quantidade, e `readNumbers` (door 4) não tinha prova no próprio nível.

**C68** - No Início, o card "Abaixo do mínimo" mostra saldo `1800` e mínimo `2500` como `1.800 g / 2.500 g` (AC 40)
Proof: `T "src/app/(app)/page.test.tsx" -t "alert quantities in pt-BR"`

**C69** - `readNumbers` converte decimal (`1,5` -> `1.5`), dinheiro (`89,90` -> `8990`), tarifa com 4 casas (`0,8732` -> `87.32`) e vazio opcional (`null`) (door 4)
Proof: `T src/lib/number-input.test.ts -t "readNumbers converts decimals and money in reais"`

**C70** - `readNumbers` cita o primeiro campo inválido na ordem declarada e monta as mensagens `format` e `decimals` (2 e 4 casas) (door 4)
Proof: `T src/lib/number-input.test.ts -t "readNumbers reports the first invalid field in declaration order"`

**C71** - `readNumbers` recusa vazio só quando `required` (`Preencha Peso inicial`) e devolve `null` no opcional (door 4)
Proof: `T src/lib/number-input.test.ts -t "readNumbers rejects a blank required field only"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `parseDecimal` decision table (7) | vírgula C1 · ponto C2 · ponto com 3 casas C3 · dois separadores C4 · não numérico C5 · vazio C6 · bordas (sinal, espaço, `,5`, `5,`) C16 | - |
| limite de 2 casas no dinheiro (2 edges) | 2 casas C8 · 3 casas C9 | - |
| limite de 4 casas na tarifa (2 edges) | 4 casas C10 · 5 casas C11 | - |
| motivos de recusa no formulário (3) | `format` C38 · `decimals` C34, C35 · vazio obrigatório C42 | - |
| preenchimento da edição (3 formatos) | dinheiro 2 casas C13, C45 · dinheiro 4 casas C14, C46 · quantidade C15, C47 | - |
| campos de dinheiro (7) | tarifa C25 · hora de trabalho C25 · manutenção C25 · custo da impressora C26 · custo do rolo C27 · custo unitário da entrada C28 · mão de obra do orçamento C29 | - |
| conversões manuais de hoje (3 arquivos) | `products/[id]` C40 · `product-variant-editor` C40, C41 · `print-profile-import` C40 | - |
| `formatCents` (4 lugares) | custos fixos C48 · parâmetros só leitura C49 · coluna de `printers` C50 · `cost-breakdown` C51 | - |
| dinheiro por unidade (4 lugares) | tarifa só leitura C49 · `inventory` C52 · `inventory/items` C53 · `inventory/items/[id]` C54 | - |
| tabelas de movimentação (3) | `inventory/movements` C55 · `inventory/[id]` C56 · `inventory/items/[id]` C57 | - |
| quantidades por tela (10) | Início C68 · `inventory` C58 · `inventory/[id]` C59 · `inventory/items` C60 · `inventory/items/[id]` C61 · `inventory/alerts` C62 · `materials` C63 · `printers` C64 · `products/[id]` C65 · etiqueta C66 | - |
| Landing doors (4) | door 1 C1-C24 · door 2 C30 · door 3 C7 · door 4 C69, C70, C71 | - |
| Surface routes (0) | none - o plano não muda rota | - |

- Nenhum check afirma uma rota ou status da API além do corpo enviado: C31-C35, C37-C39, C41-C44 asserem o corpo da requisição mockada ou a ausência dela
- Nenhum outro check afirma mais do que o caso que a sua prova exercita

## Swept

- validation: C1-C16, C34, C35, C38, C41, C42
- failure modes: C34, C38, C42 - inválido para antes da API; C39 - a recusa `400` da API aparece no formulário
- idempotency: n/a - nenhuma escrita nova; cada envio é o mesmo `POST`/`PATCH` de hoje
- authorization: existing - `RolesGuard` (AD-018) e as checagens de papel das telas não mudam; a visão só leitura formata dinheiro em C49
- concurrency: n/a - a conversão é síncrona e pura no navegador, sem nova ordem de requisições
- data lifecycle: n/a - nada persistido muda, a API segue em centavos
- dependency failure: existing - `apiFetch` e o `Alert` do formulário; C39 mostra o erro da API
- state transitions: n/a - nenhuma máquina de estado é tocada
- observability: n/a - o `web/` não tem logging nem métricas, e esta mudança não adiciona

## Handoff

Tamanho por `wc -c` dos arquivos que cada slice toca (código + teste), dividido por 4:

- S1 + S2 = ~9 KB (~3k), só `web/src/lib`; S3 entra nas telas de dinheiro e no `EntityForm` em ~30k; S4 entra nas demais telas de formulário em ~73k; S5 não toca arquivo novo; S6 entra nas telas só de exibição em ~80k total, abaixo do budget de 150k - one builder

- **Boundary:** C1-C67 closed na working tree sobre `3fd0128` (sem commit: o `AGENTS.md` proíbe commit sem pedido explícito)
- **Settled mid-build:** AC 27 / C33 trocado de `1.500` para `1.50` (o original contradizia o AC 9); decisão do usuário em 2026-10-04
- **Abandoned:** cast genérico de `FIELDS` para `readNumbers` em `settings` - trocado por declaração explícita dos sete campos, mais legível
- **Boundary (rodada 2):** C68-C71 closed na working tree, depois do PASS da rodada 1
