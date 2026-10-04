# PRD: Barra de saldo de filamento na cor do Tom

- **Status:** aprovado na sessão de perguntas de 2026-10-04, ainda não implementado
- **Área:** `web/` apenas. A API não muda.
- **Glossário:** a definição de **Tom** em `CONTEXT.md` já foi atualizada (veja §9).

## 1. Problema

As barras de saldo de filamento (`StockMeter`) preenchem sempre com o laranja de destaque (`--accent`, `#FE6F02`). Quando há vários materiais na lista, a barra não ajuda a identificar o filamento: um PLA preto e um PETG azul aparecem iguais. O material já tem um **Tom** (`colorHex`, hex `#rrggbb` opcional), usado hoje só na amostra do cadastro de materiais.

## 2. Objetivo

Nas telas de filamento, a barra de saldo deve ser preenchida com o Tom do material, para que a cor do filamento seja reconhecível sem ler o rótulo. Isso não pode esconder um alerta de estoque mínimo e a barra não pode sumir contra o trilho.

## 3. Escopo

### 3.1 Barras que mudam

| # | Tela | Barra | Onde está | `minimum` hoje |
| --- | --- | --- | --- | --- |
| B1 | `/inventory` | saldo por material (linha da lista) | `web/src/app/(app)/inventory/page.tsx`, `<StockMeter value={item.totalBalanceGrams} …>` | o mínimo do material, ou `null` |
| B2 | `/inventory` | saldo de cada rolo no card expandido ("Ver rolos") | mesmo arquivo, `<StockMeter value={roll.balanceGrams} …>` | `null` |
| B3 | `/inventory/[id]` | saldo do rolo no detalhe | `web/src/app/(app)/inventory/[id]/page.tsx` | `null` |
| B4 | `/` (Início) | seção "Filamento por material" | `web/src/app/(app)/page.tsx`, `<StockMeter value={item.totalBalanceGrams} max={largest} minimum={null} />` | `null` |

As quatro telas já buscam `GET /materials?pageSize=100`, e `Material.colorHex` vem nessa resposta. Nenhuma chamada nova é necessária.

### 3.2 Fora de escopo

- `/inventory/alerts` e a seção "Abaixo do mínimo" do Início. Ali a cor da barra **é** o alerta, então ela continua amarela ou vermelha.
- Barras de **insumos** (`/inventory/items` e `/inventory/items/[id]`). Insumo não tem Tom.
- Qualquer mudança na API, no contrato de `/inventory/materials-summary` ou no cadastro de materiais.
- Dark mode. O app não tem tema escuro hoje.

## 4. Regras

A cor do preenchimento é decidida nesta ordem. A primeira regra que se aplica vence.

| # | Condição | Preenchimento | Contorno |
| --- | --- | --- | --- |
| R1 | `minimum !== null` e `value < minimum / 2` (crítico) | vermelho (`--red-500`, comportamento atual) | não |
| R2 | `minimum !== null` e `value < minimum` (baixo) | amarelo (`--yellow-500`, comportamento atual) | não |
| R3 | material sem Tom (`colorHex === null`) **ou** material não encontrado na lista carregada | laranja padrão (`--accent`) | não |
| R4 | Tom com contraste WCAG contra o trilho (`#F1F1F1`, `--ink-100`) **menor que 1,5:1** | o próprio Tom | sim, contorno interno de 1px em `--ink-300` (`#D1D1D1`) |
| R5 | qualquer outro Tom | o próprio Tom | não |

Observações:

- **O alerta vence o Tom (R1 e R2).** Na prática isso só ocorre em B1, a única barra com `minimum` diferente de `null`. O badge "Abaixo do mínimo" continua igual.
- **O branco não tem caso especial.** `#ffffff` é desenhado branco e ganha contorno por R4. A ideia inicial de trocar o branco por `#eaeaea` foi descartada: `#eaeaea` tem contraste 1,065:1 contra o trilho e ficaria invisível.
- **"Material não encontrado"** acontece quando `materialId` não está nos 100 materiais carregados (por exemplo, um material inativo fora da página). Nesse caso o rótulo já mostra o `materialId` cru e a barra fica laranja.
- **Hex sem diferenciar maiúsculas.** A API normaliza o Tom, mas a função deve aceitar `#FFFFFF` e `#ffffff` igualmente.
- **Limite estrito.** Contraste `< 1,5` recebe contorno e contraste `>= 1,5` não recebe.

### 4.1 Contraste calculado (referência para os testes)

Fórmula: luminância relativa WCAG 2.x, `(L_maior + 0,05) / (L_menor + 0,05)`, contra `#F1F1F1`.

| Tom | Contraste | Contorno? |
| --- | --- | --- |
| `#ffffff` | 1,129 | sim |
| `#fafafa` | 1,082 | sim |
| `#fff8e0` (natural/marfim) | 1,063 | sim |
| `#ffeb3b` (amarelo claro) | 1,081 | sim |
| `#ffd400` (amarelo vivo) | 1,267 | sim |
| `#cccccc` | 1,422 | sim |
| **`#c7c7c7`** | **1,4967** | **sim, o último antes do limite** |
| **`#c6c6c6`** | **1,5123** | **não, o primeiro depois do limite** |
| `#ff8800` | 2,119 | não |
| `#fe6f02` | 2,483 | não |
| `#000000` | 18,592 | não |

Os amarelos vivos (`#ffd400`) também ganham contorno, porque contrastam pouco com o trilho cinza claro. Isso é desejado.

## 5. Desenho da solução

### 5.1 Função pura: decisão do preenchimento

Novo arquivo `web/src/lib/meter-tone.ts` (nome sugerido). Ele concentra toda a decisão de R3 a R5, e é ali que mora o limite.

```ts
// Esboço da forma; os nomes podem mudar na implementação.
export interface MeterFill {
  color: string;      // hex do Tom
  outlined: boolean;  // true quando o contraste contra o trilho é < 1,5
}

/** null = sem Tom: o StockMeter mantém o laranja padrão. */
export function meterFillFor(colorHex: string | null | undefined): MeterFill | null;
```

- Recebe `colorHex` do material, ou `undefined` quando o material não foi encontrado.
- Devolve `null` para R3. Para R4 e R5, devolve `{ color, outlined }`.
- A cor do trilho (`#F1F1F1`) e o limite (`1.5`) são constantes no arquivo, com um comentário apontando que o trilho espelha `--ink-100` em `forge.css`.

### 5.2 `StockMeter`

`web/src/components/ui/data.tsx`. Adicionar uma prop opcional, por exemplo `fill?: MeterFill | null`:

- Com tom `ok` e `fill` presente: aplica `background: fill.color` no `.bf-meter__fill` e, se `fill.outlined`, a classe `bf-meter__fill--outlined`.
- Com tom `warning` ou `danger` (R1/R2): ignora `fill`, e o CSS atual decide a cor. A precedência fica no componente, que já calcula `tone`. **Ordem importa:** um `style={{ background }}` inline venceria a classe `.bf-meter--warning`, então o componente **não** deve passar o estilo inline quando `tone !== "ok"`.
- Sem `fill`: comportamento atual (laranja). Os chamadores fora de escopo (alertas, insumos) não mudam.

CSS em `web/src/app/forge.css`, junto do bloco `/* StockMeter */`:

```css
.bf-meter__fill--outlined{box-shadow:inset 0 0 0 1px var(--ink-300)}
```

### 5.3 Chamadores

Em B1–B4, buscar o material (as telas já têm `materials` e um helper `materialLabel` que faz o `find`) e passar `fill={meterFillFor(material?.colorHex)}`. Vale considerar um helper `materialById` para não repetir o `find`, mas sem abstrair além disso.

## 6. Critérios de aceitação

1. Em `/inventory`, um material com Tom `#1e88e5` e saldo acima do mínimo, ou sem mínimo, mostra a barra azul `#1e88e5`, sem contorno.
2. Em `/inventory`, um material com Tom `#1e88e5` e saldo abaixo do mínimo mostra a barra amarela. Abaixo da metade do mínimo, mostra a barra vermelha. O badge "Abaixo do mínimo" continua aparecendo.
3. Em `/inventory`, um material sem Tom mostra a barra laranja (comportamento atual).
4. Em `/inventory`, um material com Tom `#ffffff` mostra a barra branca com contorno `--ink-300`.
5. Em `/inventory`, ao expandir "Ver rolos", as barras de cada rolo usam o Tom do material, com as mesmas regras R3–R5.
6. Em `/inventory/[id]`, a barra do rolo usa o Tom do material, com as regras R3–R5.
7. Em `/`, a seção "Filamento por material" usa o Tom de cada material, com as regras R3–R5.
8. Em `/inventory/alerts`, em "Abaixo do mínimo" no Início e em todas as barras de insumo, nada muda.
9. Um material que não está na lista carregada mostra a barra laranja.
10. A API não muda, e nenhum contrato de rota é alterado.

## 7. Testes exigidos (política do `AGENTS.md`)

### 7.1 `web/src/lib/meter-tone.test.ts` (função pura que decide)

Um caso asserido por linha da tabela de decisão, com o esperado escrito literalmente:

| Caso | Entrada | Esperado |
| --- | --- | --- |
| sem Tom | `null` | `null` |
| material não encontrado | `undefined` | `null` |
| Tom escuro | `"#1e88e5"` | `{ color: "#1e88e5", outlined: false }` |
| branco | `"#ffffff"` | `{ color: "#ffffff", outlined: true }` |
| branco em maiúsculas | `"#FFFFFF"` | `outlined: true` |
| limite, lado que dispara | `"#c7c7c7"` (1,4967) | `outlined: true` |
| limite, lado que não dispara | `"#c6c6c6"` (1,5123) | `outlined: false` |
| amarelo vivo | `"#ffd400"` | `outlined: true` |

### 7.2 Telas (`*.test.tsx`)

O `StockMeter` é `aria-hidden`, então os testes leem o `style.background` e a classe de `.bf-meter__fill` dentro da linha ou card do material.

- `web/src/app/(app)/inventory/page.test.tsx`
  - material com Tom: o preenchimento usa o Tom;
  - material sem Tom: o preenchimento fica sem `background` inline (laranja vem do CSS);
  - material com Tom e saldo abaixo do mínimo: não há `background` inline e a barra tem `bf-meter--warning`. Fazer o mesmo para `bf-meter--danger`;
  - material com Tom `#ffffff`: tem `bf-meter__fill--outlined`;
  - rolos expandidos: o preenchimento usa o Tom do material.
- `web/src/app/(app)/inventory/[id]/page.test.tsx`: com Tom e sem Tom.
- `web/src/app/(app)/page.test.tsx` (Início, já existe): "Filamento por material" com Tom e sem Tom, e "Abaixo do mínimo" sem Tom aplicado.
- Os testes de estado já existentes (carregando, erro, vazio, papéis) continuam passando sem alteração.

### 7.3 O que não precisa de teste próprio

- O CSS `.bf-meter__fill--outlined` e a prop repassada nos chamadores são instrumentação, cobertos pelos testes acima.
- Não há e2e de API, porque a API não muda.

## 8. Validação final

1. `npm --prefix web run lint`, `npm --prefix web run test` e `npm --prefix web run build`.
2. Playwright MCP no app rodando:
   - um material com Tom escuro, um com `#ffffff`, um sem Tom e um abaixo do mínimo;
   - conferir B1–B4 e os estados de carregamento, erro e vazio das telas afetadas;
   - conferir que `/inventory/alerts` e as barras de insumos continuam iguais.

## 9. Glossário

`CONTEXT.md`, verbete **Tom**, atualizado nesta sessão:

> **Tom:** a aparência da cor, um único hex `#rrggbb` usado para representar a cor do filamento na interface: a amostra e o preenchimento da barra de saldo. É opcional: um material pode não ter tom

## 10. Decisões tomadas na sessão de perguntas

| # | Pergunta | Decisão |
| --- | --- | --- |
| Q1 | Quais barras mudam | B1–B4. Alertas e insumos ficam de fora |
| Q2 | Alerta de mínimo vs. Tom | O alerta vence |
| Q3 | Tratamento de tons claros | Mantém a cor real e acrescenta contorno |
| Q4 | Tons escuros | Sem tratamento especial |
| Q5 | Critério de "claro" | Contraste WCAG contra o trilho `< 1,5:1` |
| Q6 | Branco `#ffffff` | Sem caso especial; segue Q3 e Q5 |
| Q7 | Material não encontrado | Laranja padrão |
| Q8 | Glossário | Atualizar o verbete Tom |

Sem ADR: todas as decisões são fáceis de reverter.
