# Barra de saldo de filamento na cor do Tom

## Problem

As barras de saldo de filamento (`StockMeter`) são sempre preenchidas com o laranja de destaque
(`--accent`, `#FE6F02`). Com vários materiais na lista de estoque e no Início, a barra não ajuda a
reconhecer o filamento: um PLA preto e um PETG azul aparecem iguais, e quem opera o estoque precisa
ler o rótulo `tipo · marca · cor` de cada linha. O material já tem um **Tom** (`colorHex`, hex
`#rrggbb` opcional), mas hoje ele só aparece como amostra na tabela de materiais.

O PRD não traz números de incidência; a motivação é de reconhecimento visual.

Quando isto entrar: nas quatro barras de filamento (lista de estoque, rolos expandidos, detalhe do
rolo e "Filamento por material" no Início) o preenchimento usa o Tom do material. Um alerta de
estoque mínimo continua amarelo ou vermelho, um material sem Tom continua laranja, e um Tom claro
demais para se ver contra o trilho cinza ganha um contorno de 1px.

## Flow

Reusa o `StockMeter` (que já decide `ok` / `warning` / `danger` pelo mínimo), o `colorHex` que já
vem em `GET /materials?pageSize=100` e a lista `materials` que as três telas já carregam; nenhuma
chamada nova à API.

1. `/inventory`, `/inventory/[id]` e `/` (exists) já carregam `materials` -> encontram o material
   pelo `materialId` (o mesmo `find` de `materialLabel`) e passam o `colorHex` dele, ou `undefined`
   quando não está na lista
2. `meterFillFor` em `web/src/lib/meter-tone.ts` (new, no door - placement per conventions) - decide
   R3–R5: `null` sem Tom, senão `{ color, outlined }` com `outlined` quando o contraste WCAG contra
   `#F1F1F1` é `< 1.5`
3. `StockMeter` em `web/src/components/ui/data.tsx` (exists) - recebe `fill` opcional; com tom `ok`
   aplica `background` inline e a classe `bf-meter__fill--outlined`; com `warning` ou `danger`
   ignora `fill` e o CSS atual decide (R1/R2)
4. out: `.bf-meter__fill` desenhado; `forge.css` (exists) ganha `.bf-meter__fill--outlined`

## Impact

| Front | What changes |
| --- | --- |
| domain | existing term: `Tom` significava "hex usado para desenhar a amostra", agora significa "hex que representa a cor do filamento na interface: amostra e preenchimento da barra de saldo" - verbete em `CONTEXT.md` já atualizado; quem lê `colorHex` hoje é só a amostra em `web/src/app/(app)/materials/`, que não muda |
| component | `StockMeter` ganha a prop opcional `fill`; os chamadores que não a passam (`/inventory/alerts`, "Abaixo do mínimo" no Início, `/inventory/items`, `/inventory/items/[id]`) ficam idênticos |
| stored data | nothing to migrate - nenhuma mudança na API nem no banco |

## Relations

None - no stored-data shape change. `materials.color_hex` já existe (feature `material-brand-tone`).

## Surface

None - nothing consumed outside. Nenhuma rota é criada ou muda de assinatura; o `web/` só passa a
ler um campo que `GET /materials` já devolve.

## Landing

None - nada aqui é difícil de reverter: é uma prop opcional num componente interno, uma função pura
e uma classe CSS, sem schema, sem contrato de rota e sem dependência nova.

- Nothing else in this change is hard to reverse

## Criteria

### S1: decisão do preenchimento (P1)

A função pura decide cor e contorno a partir do Tom, com o limite de contraste nos dois lados.

**Acceptance Criteria**

1. IF o Tom do material é `null` THEN `meterFillFor` SHALL devolver `null`
2. IF o material não foi encontrado na lista carregada (Tom `undefined`) THEN `meterFillFor` SHALL devolver `null`
3. WHEN o Tom é `#1e88e5` THEN `meterFillFor` SHALL devolver `{ color: "#1e88e5", outlined: false }`
4. WHEN o Tom é `#ffffff` THEN `meterFillFor` SHALL devolver `{ color: "#ffffff", outlined: true }`
5. WHEN o Tom é `#FFFFFF` THEN `meterFillFor` SHALL devolver `outlined: true`
6. WHEN o Tom é `#c7c7c7` (contraste 1,4967 contra `#F1F1F1`) THEN `meterFillFor` SHALL devolver `outlined: true`
7. WHEN o Tom é `#c6c6c6` (contraste 1,5123 contra `#F1F1F1`) THEN `meterFillFor` SHALL devolver `outlined: false`
8. WHEN o Tom é `#ffd400` (contraste 1,267) THEN `meterFillFor` SHALL devolver `outlined: true`

**Independent test:** `npm --prefix web run test -- meter-tone`

### S2: barra por material em `/inventory` (P1)

A linha de cada material (B1) pinta a barra com o Tom, e o alerta de mínimo vence o Tom.

**Acceptance Criteria**

9. WHEN `/inventory` mostra um material com Tom `#1e88e5` sem mínimo ou com saldo `>=` mínimo THEN o `.bf-meter__fill` da linha SHALL ter `background` inline `#1e88e5` e não ter a classe `bf-meter__fill--outlined`
10. WHEN `/inventory` mostra um material sem Tom THEN o `.bf-meter__fill` da linha SHALL não ter `background` inline
11. WHILE o saldo de um material com Tom `#1e88e5` está abaixo do mínimo e `>=` metade do mínimo, `/inventory` SHALL mostrar a barra com a classe `bf-meter--warning`, sem `background` inline no `.bf-meter__fill`, e o badge "Abaixo do mínimo"
12. WHILE o saldo de um material com Tom `#1e88e5` está abaixo da metade do mínimo, `/inventory` SHALL mostrar a barra com a classe `bf-meter--danger`, sem `background` inline no `.bf-meter__fill`, e o badge "Abaixo do mínimo"
13. WHEN `/inventory` mostra um material com Tom `#ffffff` THEN o `.bf-meter__fill` da linha SHALL ter `background` inline `#ffffff` e a classe `bf-meter__fill--outlined`
14. IF o `materialId` de uma linha não está entre os materiais carregados THEN `/inventory` SHALL mostrar o `.bf-meter__fill` dessa linha sem `background` inline
15. The `.bf-meter__fill--outlined` em `forge.css` SHALL desenhar `box-shadow: inset 0 0 0 1px var(--ink-300)`

**Independent test:** `npm --prefix web run test -- "inventory/page"`, e abrir `/inventory` com materiais de Tom escuro, branco, sem Tom e abaixo do mínimo.

### S3: rolos expandidos e detalhe do rolo (P1)

As barras de rolo (B2 e B3) usam o Tom do material do rolo.

**Acceptance Criteria**

16. WHEN o usuário expande "Ver rolos" de um material com Tom `#1e88e5` em `/inventory` THEN o `.bf-meter__fill` de cada rolo SHALL ter `background` inline `#1e88e5`
17. WHEN o usuário expande "Ver rolos" de um material sem Tom em `/inventory` THEN o `.bf-meter__fill` de cada rolo SHALL não ter `background` inline
18. WHEN `/inventory/[id]` mostra um rolo de material com Tom `#1e88e5` THEN o `.bf-meter__fill` do rolo SHALL ter `background` inline `#1e88e5`
19. WHEN `/inventory/[id]` mostra um rolo de material sem Tom THEN o `.bf-meter__fill` do rolo SHALL não ter `background` inline

**Independent test:** `npm --prefix web run test -- "inventory/page" "inventory/\[id\]/page"`

### S4: Início (P2)

"Filamento por material" (B4) usa o Tom; "Abaixo do mínimo" não muda.

**Acceptance Criteria**

20. WHEN `/` mostra "Filamento por material" com um material de Tom `#1e88e5` THEN o `.bf-meter__fill` desse item SHALL ter `background` inline `#1e88e5`
21. WHEN `/` mostra "Filamento por material" com um material sem Tom THEN o `.bf-meter__fill` desse item SHALL não ter `background` inline
22. WHEN `/` mostra "Abaixo do mínimo" com um alerta de material com Tom `#1e88e5` THEN o `.bf-meter__fill` desse alerta SHALL não ter `background` inline

**Independent test:** `npm --prefix web run test -- "(app)/page"`

### S5: o que não muda (P2)

**Acceptance Criteria**

23. The `StockMeter` SHALL desenhar a barra sem `background` inline e sem `bf-meter__fill--outlined` quando chamado sem `fill`, como em `/inventory/alerts`, `/inventory/items` e `/inventory/items/[id]`
24. The system SHALL manter os estados carregando, erro, vazio e a visão por papel de `/inventory`, `/inventory/[id]` e `/` como estão, com os testes de estado existentes passando sem alteração

**Independent test:** a suíte existente de `web/` passa sem editar nenhum teste de estado.

## Out of scope

| Excluded | Why |
| --- | --- |
| Tom nas barras de `/inventory/alerts` e "Abaixo do mínimo" do Início | ali a cor da barra é o alerta (PRD §3.2, Q1) |
| Tom nas barras de insumos | insumo não tem Tom |
| Mudança na API, em `/inventory/materials-summary` ou no cadastro de materiais | o `colorHex` já vem em `GET /materials` |
| Caso especial para branco (trocar por `#eaeaea`) | `#eaeaea` tem contraste 1,065 e sumiria no trilho (Q6) |
| Dark mode | o app não tem tema escuro |

## Assumptions

| Assumption | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Caixa da cor devolvida | `meterFillFor` devolve `color` exatamente como recebeu; só o cálculo de contraste ignora a caixa | a API já grava em minúsculas; o navegador aceita as duas | n |
| Tom fora do formato `#rrggbb` | tratado como sem Tom (`null`, laranja) | a API valida o formato, então só chega por dado corrompido; laranja é o lado seguro | n |
| Cor do trilho na função | constante `#F1F1F1` em `meter-tone.ts` com comentário apontando `--ink-100` em `forge.css` | ler o CSS em runtime acopla a função ao DOM e quebra o teste puro | y |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface | Decision | Landing |
| --- | --- | --- |
| screens `/inventory`, `/inventory/[id]`, `/` | loading, error, empty states | existing - não mudam, AC 24 |
| screens `/inventory`, `/inventory/[id]`, `/` | unauthorised / o que cada papel vê | existing - a barra é igual para todo papel que já vê a tela, AC 24 |
| screens `/inventory`, `/inventory/[id]`, `/` | density and ordering | n/a - só muda a cor do preenchimento; ordem e layout ficam iguais |
| screens `/inventory`, `/inventory/[id]`, `/` | destructive action confirms | n/a - a mudança não adiciona ação |
| screen `/inventory` | material ausente da lista carregada | AC 14 |
| screen `/inventory` | alerta de mínimo vs. Tom | AC 11, AC 12 |
| `StockMeter` | acessibilidade | n/a - a barra já é `aria-hidden`; saldo e badge seguem em texto |

## Sources

- `.specs/features/filament-meter-tone/prd.md` - escopo B1–B4, regras R1–R5, tabela de contraste e decisões Q1–Q8 da sessão de 2026-10-04
- `CONTEXT.md`, verbete **Tom** - já atualizado nesta sessão
