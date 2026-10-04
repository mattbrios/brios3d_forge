# Barra de saldo de filamento na cor do Tom - checks

Profile: light
Plan: `.specs/features/filament-meter-tone/plan.md`

32 checks em 6 slices · 0 one-way doors · 0 open

`T` abaixo é `npm --prefix web run test --`. Os arquivos, relativos a `web/`, são:
`TONE` = `src/lib/meter-tone.test.ts`, `METER` = `src/components/ui/data.test.tsx`,
`INV` = `"src/app/(app)/inventory/page.test.tsx"`, `ROLL` = `"src/app/(app)/inventory/[id]/page.test.tsx"`,
`HOME` = `"src/app/(app)/page.test.tsx"`. Os títulos dos testes contêm literalmente a substring do `-t`.

O jsdom normaliza a cor inline para `rgb()`: `#1e88e5` é lido como `rgb(30, 136, 229)` e `#ffffff`
como `rgb(255, 255, 255)`. "Sem `background` inline" é `style.background === ""`, como já asserido
na amostra de `materials/page.test.tsx`.

## Checks

### S1 - Decisão do preenchimento (`meterFillFor`) · 2 files · ~3 KB · ~1k

**C1** - `meterFillFor(null)` devolve `null` (AC 1)
Proof: `T TONE -t "no tone returns null"`

**C2** - `meterFillFor(undefined)` devolve `null` (AC 2)
Proof: `T TONE -t "material not found returns null"`

**C3** - `meterFillFor("#1e88e5")` devolve `{ color: "#1e88e5", outlined: false }` (AC 3)
Proof: `T TONE -t "dark tone is drawn without outline"`

**C4** - `meterFillFor("#ffffff")` devolve `{ color: "#ffffff", outlined: true }` (AC 4)
Proof: `T TONE -t "white is drawn with outline"`

**C5** - `meterFillFor("#FFFFFF")` devolve `{ color: "#FFFFFF", outlined: true }` (AC 5; caixa preservada, premissa do plano)
Proof: `T TONE -t "uppercase white is drawn with outline"`

**C6** - `meterFillFor("#c7c7c7")` (contraste 1,4967) devolve `{ color: "#c7c7c7", outlined: true }` (AC 6)
Proof: `T TONE -t "last tone below the 1.5 contrast gets outline"`

**C7** - `meterFillFor("#c6c6c6")` (contraste 1,5123) devolve `{ color: "#c6c6c6", outlined: false }` (AC 7)
Proof: `T TONE -t "first tone at or above the 1.5 contrast has no outline"`

**C8** - `meterFillFor("#ffd400")` devolve `{ color: "#ffd400", outlined: true }` (AC 8)
Proof: `T TONE -t "vivid yellow gets outline"`

**C9** - `meterFillFor("#fff")` devolve `null` (premissa do plano: Tom fora de `#rrggbb` vale como sem Tom)
Proof: `T TONE -t "malformed tone returns null"`

### S2 - Precedência no `StockMeter` · 2 files · ~3 KB · ~1k

**C10** - `StockMeter` com `value=500`, `minimum=null` e `fill={ color: "#1e88e5", outlined: false }` desenha `.bf-meter__fill` com `style.background` `rgb(30, 136, 229)` e sem a classe `bf-meter__fill--outlined` (AC 9)
Proof: `T METER -t "ok tone paints the fill with the tone"`

**C11** - `StockMeter` com `value=500`, `minimum=null` e `fill={ color: "#ffffff", outlined: true }` desenha `.bf-meter__fill` com `style.background` `rgb(255, 255, 255)` e a classe `bf-meter__fill--outlined` (AC 13)
Proof: `T METER -t "outlined fill gets the outline class"`

**C12** - `StockMeter` com `value=60`, `minimum=100` e `fill={ color: "#1e88e5", outlined: true }` tem a classe `bf-meter--warning`, `.bf-meter__fill` com `style.background` `""` e sem `bf-meter__fill--outlined` (AC 11)
Proof: `T METER -t "warning ignores the fill"`

**C13** - `StockMeter` com `value=40`, `minimum=100` e `fill={ color: "#1e88e5", outlined: true }` tem a classe `bf-meter--danger`, `.bf-meter__fill` com `style.background` `""` e sem `bf-meter__fill--outlined` (AC 12)
Proof: `T METER -t "danger ignores the fill"`

**C14** - `StockMeter` sem `fill` (`value=500`, `minimum=null`) desenha `.bf-meter__fill` com `style.background` `""` e sem `bf-meter__fill--outlined` (AC 23)
Proof: `T METER -t "without fill keeps the default fill"`

**C15** - `StockMeter` com `value=100`, `minimum=100` e `fill={ color: "#1e88e5", outlined: false }` tem a classe `bf-meter--ok` e `style.background` `rgb(30, 136, 229)` - saldo igual ao mínimo não é alerta (AC 9, lado que não dispara de AC 11)
Proof: `T METER -t "balance equal to the minimum keeps the tone"`

**C16** - `StockMeter` com `value=50`, `minimum=100` e um `fill` tem a classe `bf-meter--warning` e não `bf-meter--danger` - metade exata não é crítico (AC 11, lado que não dispara de AC 12)
Proof: `T METER -t "balance at half the minimum is warning, not danger"`

### S3 - Barra por material em `/inventory` · 3 files · ~23 KB · ~6k

**C17** - Em `/inventory`, a linha de um material com Tom `#1e88e5` e sem mínimo tem `.bf-meter__fill` com `style.background` `rgb(30, 136, 229)` e sem `bf-meter__fill--outlined` (AC 9)
Proof: `T INV -t "material row meter uses the material tone"`

**C18** - Em `/inventory`, a linha de um material com `colorHex: null` tem `.bf-meter__fill` com `style.background` `""` (AC 10)
Proof: `T INV -t "material row without tone keeps the default fill"`

**C19** - Em `/inventory`, um material com Tom `#1e88e5`, mínimo `100` e saldo `60` mostra a barra com `bf-meter--warning`, `.bf-meter__fill` com `style.background` `""` e o badge "Abaixo do mínimo" (AC 11)
Proof: `T INV -t "low balance shows warning instead of the tone"`

**C20** - Em `/inventory`, um material com Tom `#1e88e5`, mínimo `100` e saldo `40` mostra a barra com `bf-meter--danger`, `.bf-meter__fill` com `style.background` `""` e o badge "Abaixo do mínimo" (AC 12)
Proof: `T INV -t "critical balance shows danger instead of the tone"`

**C21** - Em `/inventory`, a linha de um material com Tom `#ffffff` tem `.bf-meter__fill` com `style.background` `rgb(255, 255, 255)` e a classe `bf-meter__fill--outlined` (AC 13)
Proof: `T INV -t "white tone row meter is outlined"`

**C22** - Em `/inventory`, uma linha cujo `materialId` não está em `GET /materials` tem `.bf-meter__fill` com `style.background` `""` (AC 14)
Proof: `T INV -t "material missing from the list keeps the default fill"`

**C23** - `forge.css` contém a regra literal `.bf-meter__fill--outlined{box-shadow:inset 0 0 0 1px var(--ink-300)}` (AC 15)
Proof: `grep -F '.bf-meter__fill--outlined{box-shadow:inset 0 0 0 1px var(--ink-300)}' web/src/app/forge.css`

### S4 - Rolos expandidos e detalhe do rolo · 4 files · ~56 KB · ~14k

**C24** - Em `/inventory`, ao clicar "Ver rolos" de um material com Tom `#1e88e5` e dois rolos, os dois `.bf-meter__fill` dos rolos têm `style.background` `rgb(30, 136, 229)` (AC 16)
Proof: `T INV -t "expanded rolls use the material tone"`

**C25** - Em `/inventory`, ao clicar "Ver rolos" de um material com `colorHex: null`, o `.bf-meter__fill` de cada rolo tem `style.background` `""` (AC 17)
Proof: `T INV -t "expanded rolls without tone keep the default fill"`

**C26** - Em `/inventory/[id]`, o rolo de um material com Tom `#1e88e5` tem `.bf-meter__fill` com `style.background` `rgb(30, 136, 229)` (AC 18)
Proof: `T ROLL -t "roll meter uses the material tone"`

**C27** - Em `/inventory/[id]`, o rolo de um material com `colorHex: null` tem `.bf-meter__fill` com `style.background` `""` (AC 19)
Proof: `T ROLL -t "roll meter without tone keeps the default fill"`

### S5 - Início · 2 files · ~13 KB · ~3k

**C28** - Em `/`, "Filamento por material" com um material de Tom `#1e88e5` tem o `.bf-meter__fill` desse item com `style.background` `rgb(30, 136, 229)` (AC 20)
Proof: `T HOME -t "filament by material meter uses the material tone"`

**C29** - Em `/`, "Filamento por material" com um material de `colorHex: null` tem o `.bf-meter__fill` desse item com `style.background` `""` (AC 21)
Proof: `T HOME -t "filament by material without tone keeps the default fill"`

**C30** - Em `/`, "Abaixo do mínimo" com um alerta de um material de Tom `#1e88e5` tem o `.bf-meter__fill` desse alerta com `style.background` `""` (AC 22)
Proof: `T HOME -t "below minimum meter ignores the material tone"`

### S6 - O que não muda · 3 files · ~0 KB lidos para mudar · ~0k

**C31** - `/inventory/alerts`, `/inventory/items` e `/inventory/items/[id]` não passam `fill` ao `StockMeter` (AC 23; o efeito sem `fill` é C14)
Proof: `! grep -n "fill=" "web/src/app/(app)/inventory/alerts/page.tsx" "web/src/app/(app)/inventory/items/page.tsx" "web/src/app/(app)/inventory/items/[id]/page.tsx"`

**C32** - Os testes de estado já existentes das três telas continuam verdes sem edição: carregando, erro, vazio e o que cada papel vê (AC 24)
Proof: `T INV -t "shows loading"`
Proof: `T INV -t "shows the error and retries"`
Proof: `T INV -t "shows an empty state with the create action only for admin"`
Proof: `T INV -t "production and sales do not see the create roll action"`
Proof: `T ROLL -t "sales sees only the read-only history"`
Proof: `T ROLL -t "admin and production see the weigh and movement forms on the roll page"`
Proof: `T HOME -t "shows loading while fetching"`
Proof: `T HOME -t "shows the empty states when there is no roll and no alert"`
Proof: `T HOME -t "shows the api error and retries"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `meterFillFor` decision rows (9) | `null` C1 · `undefined` C2 · dark C3 · white C4 · uppercase C5 · `#c7c7c7` C6 · `#c6c6c6` C7 · `#ffd400` C8 · malformed C9 | - |
| contrast bound `1.5` (2 sides) | below C6 · at-or-above C7 | - |
| `StockMeter` precedence rows (7) | ok + fill C10 · ok + outlined C11 · warning + fill C12 · danger + fill C13 · no fill C14 · balance = minimum C15 · balance = minimum / 2 C16 | - |
| rules R1–R5 on B1 (5) | R1 C20 · R2 C19 · R3 C18 · R4 C21 · R5 C17 | - |
| R3 causes (2) | no tone C18 · material not found C22 | - |
| bars in scope B1–B4 (4) | B1 C17 · B2 C24 · B3 C26 · B4 C28 | - |
| bars out of scope (4 places) | `/inventory/alerts` C31 · "Abaixo do mínimo" no Início C30 · `/inventory/items` C31 · `/inventory/items/[id]` C31 | - |
| screen states kept (3 screens) | `/inventory` C32 · `/inventory/[id]` C32 · `/` C32 | - |

- Claims naming a status code, route or response shape: none - o plano não tem `Surface`, nenhuma rota muda
- Os dois limites do `StockMeter` (mínimo e metade do mínimo) têm os dois lados: C12/C15 e C13/C16

## Swept

- validation: C9 (Tom fora de `#rrggbb` vale como sem Tom); C5 (caixa do hex)
- failure modes: C22 (material fora dos 100 carregados degrada para laranja); o erro de carregamento das telas é o estado existente, C32
- idempotency: n/a - a mudança só renderiza; nenhuma escrita nem requisição nova
- authorization: existing - a barra é igual para todo papel que já vê a tela; a visão por papel continua provada em C32
- concurrency: n/a - nenhuma escrita, nenhuma coluna decrementada
- data lifecycle: n/a - nenhum dado persistido nem migrado
- dependency failure: C22 (a lista de materiais não traz o material); falha de `GET /materials` cai no estado de erro existente, C32
- state transitions: C12, C13, C15, C16 (ok -> warning -> danger, com o Tom só no ok)
- observability: n/a - componente visual, sem requisito de log

## Handoff

- S1-S6 ≈ 28k tokens (≈ 111 KB / 4 por `wc -c`: `data.tsx` 2 KB, as três telas 40 KB, os três testes de tela 29 KB, `forge.css` 34 KB e ~6 KB de arquivos novos), abaixo do orçamento de 150k - one builder
- Mechanism: one builder (cabe no orçamento, sem pergunta)

- **Boundary:** C1-C32 closed in the working tree over `c2acc1c` (sem commit: o `AGENTS.md` exige pedido explícito)
- **Settled mid-build:** nenhum esclarecimento novo; C30 usa um alerta com saldo igual ao mínimo, o único caso em que a barra fica no tom "ok" e um `fill` passado por engano apareceria
- **Abandoned:** nada
