# Barra de saldo de filamento na cor do Tom verification

**Verdict**: PASS
**Profile**: light
**Diff range**: c2acc1c..working-tree
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

All 32 checks proven at the current working tree with a located assertion each. The full `web/`
suite is green (40 files, 327 tests). No contradictions, no unproven members, no gaps.

## Binding sources

Step 1 runs only under `ui`; this feature was approved under `light`. The binding source
(`prd.md`) was read as an input: the checks' values (`#c7c7c7` 1,4967 / `#c6c6c6` 1,5123, R1–R5
precedence, B1–B4 in scope, alerts and insumos out of scope, glossary text in §9) match it. The
`CONTEXT.md` entry **Tom** in the diff matches PRD §9 word for word.

## Checks

Proof run for every `T` check: one invocation,
`cd web && npx vitest run src/lib/meter-tone.test.ts src/components/ui/data.test.tsx "src/app/(app)/inventory/page.test.tsx" "src/app/(app)/inventory/[id]/page.test.tsx" "src/app/(app)/page.test.tsx" --reporter=verbose`
exit 0, 5 files / 58 tests passed. Each `-t` name below was grepped in the verbose output and
appears with a `✓` (no `✗`). "white is drawn with outline" also matches the uppercase test, and
"shows loading" also matches the Home "shows loading while fetching"; both resolve to their own
file's test at the cited line. Paths below are relative to `web/`.

| Check | Claim | Proof run | Evidence | Result |
| --- | --- | --- | --- | --- |
| C1 | `null` -> `null` | vitest batch, "no tone returns null" ✓ | `src/lib/meter-tone.test.ts:6` - `expect(meterFillFor(null)).toBeNull()` | PASS |
| C2 | `undefined` -> `null` | "material not found returns null" ✓ | `src/lib/meter-tone.test.ts:10` - `expect(meterFillFor(undefined)).toBeNull()` | PASS |
| C3 | `#1e88e5` -> not outlined | "dark tone is drawn without outline" ✓ | `src/lib/meter-tone.test.ts:14` - `toEqual({ color: "#1e88e5", outlined: false })` | PASS |
| C4 | `#ffffff` -> outlined | "white is drawn with outline" ✓ | `src/lib/meter-tone.test.ts:18` - `toEqual({ color: "#ffffff", outlined: true })` | PASS |
| C5 | `#FFFFFF` -> outlined, case kept | "uppercase white is drawn with outline" ✓ | `src/lib/meter-tone.test.ts:22` - `toEqual({ color: "#FFFFFF", outlined: true })` | PASS |
| C6 | `#c7c7c7` (1,4967) -> outlined | "last tone below the 1.5 contrast gets outline" ✓ | `src/lib/meter-tone.test.ts:27` - `toEqual({ color: "#c7c7c7", outlined: true })` | PASS |
| C7 | `#c6c6c6` (1,5123) -> not outlined | "first tone at or above the 1.5 contrast has no outline" ✓ | `src/lib/meter-tone.test.ts:31` - `toEqual({ color: "#c6c6c6", outlined: false })` | PASS |
| C8 | `#ffd400` -> outlined | "vivid yellow gets outline" ✓ | `src/lib/meter-tone.test.ts:35` - `toEqual({ color: "#ffd400", outlined: true })` | PASS |
| C9 | `#fff` -> `null` | "malformed tone returns null" ✓ | `src/lib/meter-tone.test.ts:39` - `expect(meterFillFor("#fff")).toBeNull()` | PASS |
| C10 | ok + fill paints tone, no outline | "ok tone paints the fill with the tone" ✓ | `src/components/ui/data.test.tsx:20` - `expect(fill.style.background).toBe("rgb(30, 136, 229)")`; `:21` - `classList.contains("bf-meter__fill--outlined")).toBe(false)` | PASS |
| C11 | ok + outlined fill gets class | "outlined fill gets the outline class" ✓ | `src/components/ui/data.test.tsx:26` - `toBe("rgb(255, 255, 255)")`; `:27` - `contains("bf-meter__fill--outlined")).toBe(true)` | PASS |
| C12 | warning (60/100) ignores fill | "warning ignores the fill" ✓ | `src/components/ui/data.test.tsx:32` - `contains("bf-meter--warning")).toBe(true)`; `:33` - `style.background).toBe("")`; `:34` - outlined `toBe(false)` | PASS |
| C13 | danger (40/100) ignores fill | "danger ignores the fill" ✓ | `src/components/ui/data.test.tsx:39` - `contains("bf-meter--danger")).toBe(true)`; `:40` - `style.background).toBe("")`; `:41` - outlined `toBe(false)` | PASS |
| C14 | no fill keeps default | "without fill keeps the default fill" ✓ | `src/components/ui/data.test.tsx:46` - `style.background).toBe("")`; `:47` - outlined `toBe(false)` | PASS |
| C15 | balance = minimum stays ok with tone | "balance equal to the minimum keeps the tone" ✓ | `src/components/ui/data.test.tsx:52` - `contains("bf-meter--ok")).toBe(true)`; `:53` - `toBe("rgb(30, 136, 229)")` | PASS |
| C16 | balance = minimum/2 is warning, not danger | "balance at half the minimum is warning, not danger" ✓ | `src/components/ui/data.test.tsx:58` - `contains("bf-meter--warning")).toBe(true)`; `:59` - `contains("bf-meter--danger")).toBe(false)` | PASS |
| C17 | B1 row uses tone | "material row meter uses the material tone" ✓ | `src/app/(app)/inventory/page.test.tsx:173` - `expect(fill.style.background).toBe("rgb(30, 136, 229)")`; `:174` - outlined `toBe(false)` | PASS |
| C18 | B1 row without tone | "material row without tone keeps the default fill" ✓ | `src/app/(app)/inventory/page.test.tsx:179` - `rowFill(...).style.background).toBe("")` | PASS |
| C19 | B1 low balance: warning, no inline bg, badge | "low balance shows warning instead of the tone" ✓ | `src/app/(app)/inventory/page.test.tsx:185` - `contains("bf-meter--warning")).toBe(true)`; `:186` - `style.background).toBe("")`; `:187` - `within(row).getByText("Abaixo do mínimo")` | PASS |
| C20 | B1 critical: danger, no inline bg, badge | "critical balance shows danger instead of the tone" ✓ | `src/app/(app)/inventory/page.test.tsx:193` - `contains("bf-meter--danger")).toBe(true)`; `:194` - `toBe("")`; `:195` - `getByText("Abaixo do mínimo")` | PASS |
| C21 | B1 white tone outlined | "white tone row meter is outlined" ✓ | `src/app/(app)/inventory/page.test.tsx:201` - `toBe("rgb(255, 255, 255)")`; `:202` - `contains("bf-meter__fill--outlined")).toBe(true)` | PASS |
| C22 | B1 material missing from list | "material missing from the list keeps the default fill" ✓ | `src/app/(app)/inventory/page.test.tsx:208` - `rowFill(await rowOf("m9")).style.background).toBe("")` | PASS |
| C23 | CSS rule literal in `forge.css` | `grep -F '.bf-meter__fill--outlined{box-shadow:inset 0 0 0 1px var(--ink-300)}' web/src/app/forge.css` exit 0 | `src/app/forge.css:367` - `.bf-meter__fill--outlined{box-shadow:inset 0 0 0 1px var(--ink-300)}` | PASS |
| C24 | B2 expanded rolls use tone | "expanded rolls use the material tone" ✓ | `src/app/(app)/inventory/page.test.tsx:214` - `expect(fills).toHaveLength(2)`; `:215` - `toEqual(["rgb(30, 136, 229)", "rgb(30, 136, 229)"])` | PASS |
| C25 | B2 expanded rolls without tone | "expanded rolls without tone keep the default fill" ✓ | `src/app/(app)/inventory/page.test.tsx:221` - `toHaveLength(2)`; `:222` - `toEqual(["", ""])` | PASS |
| C26 | B3 roll detail uses tone | "roll meter uses the material tone" ✓ | `src/app/(app)/inventory/[id]/page.test.tsx:321` - `expect((await rollFill("#1e88e5")).style.background).toBe("rgb(30, 136, 229)")` | PASS |
| C27 | B3 roll detail without tone | "roll meter without tone keeps the default fill" ✓ | `src/app/(app)/inventory/[id]/page.test.tsx:325` - `expect((await rollFill(null)).style.background).toBe("")` | PASS |
| C28 | B4 Home uses tone | "filament by material meter uses the material tone" ✓ | `src/app/(app)/page.test.tsx:153` - `expect((await filamentFill()).style.background).toBe("rgb(30, 136, 229)")` | PASS |
| C29 | B4 Home without tone | "filament by material without tone keeps the default fill" ✓ | `src/app/(app)/page.test.tsx:158` - `expect((await filamentFill()).style.background).toBe("")` | PASS |
| C30 | Home "Abaixo do mínimo" ignores tone | "below minimum meter ignores the material tone" ✓ | `src/app/(app)/page.test.tsx:168` - `(alert.querySelector(".bf-meter__fill")).style.background).toBe("")` (alert at balance = minimum, so the bar is in `ok` and a stray `fill` would show) | PASS |
| C31 | alerts / items / items/[id] pass no `fill` | `! grep -n "fill=" <3 files>` exit 0 (no matches) | `src/app/(app)/inventory/alerts/page.tsx:86` - `<StockMeter value={alert.balance} max={alert.minimum * 1.5} minimum={alert.minimum} />`; `items/page.tsx:95-99` and `items/[id]/page.tsx:228-232` close with `minimum={item.minimumQuantity} />`, no `fill` | PASS |
| C32 | existing state tests green, unedited | 9 names ✓ in the batch; `git diff c2acc1c` of the three test files has only `+` hunks after the state tests (plus `within` added to the import line) | INV `page.test.tsx:72` - `getByText("Carregando…")`; `:85` - `findByText("Não foi possível conectar à API")`; `:101-102` - empty text + "Cadastrar rolo" for admin; `:115` - "Cadastrar rolo" `toBeNull()` for production/sales. ROLL `[id]/page.test.tsx:101-104` - sales sees no "Pesar"/"Dar baixa"/"Abrir rolo"/"Descartar"; `:172-175` - admin/production see the forms. HOME `page.test.tsx:79` - `getByText("Carregando…")`; `:110-111` - both empty texts; `:128` - `textContent).toBe("Internal server error")`, `:131` - recovers after retry | PASS |

## Level and sampling

- `web/src/lib/meter-tone.ts` decides (contrast bound, format guard) and is not a route: a
  `*.spec`-equivalent beside it (`meter-tone.test.ts`) with one literal case per decision row and
  both sides of the `1.5` bound (C6/C7). Met.
- `StockMeter` (`data.tsx`) decides precedence (tone vs. fill) and is reached by screens: asserted
  at its own level in `data.test.tsx` (C10–C16, both sides of both thresholds: C12/C15 and
  C13/C16) and at the screens (C17–C30). Met.
- Callers (B1–B4) only forward `meterFillFor(material?.colorHex)`: instrumentation, covered by the
  screen tests. Screens: existing loading / error / empty / per-role tests kept (C32).
- Expected values are written literally in every assertion; none is derived from the code under
  test.
- Sampling: each claim asserted on the exact inputs the check names; no claim about N cases is
  proven on fewer.

## Swept existing

- authorization: `existing` - confirmed. `StockMeter` and `meterFillFor` take no user/role input;
  the `fill` passed in `inventory/page.tsx`, `inventory/[id]/page.tsx` and `page.tsx` depends only
  on `materials`. Per-role visibility remains asserted at `inventory/page.test.tsx:101-102,115` and
  `inventory/[id]/page.test.tsx:101-104,172-175`, all unedited.
- Plan `Observable` rows marked `existing` (loading / error / empty / per-role on the three
  screens): the cited tests exist at the lines above and the diff touches none of them.

## Gate

`npm --prefix web run test` - 40 files, 327 passed, 0 failed (exit 0)

## Notes (non-gating)

- Profile `light`: no fault injection and no coverage recompute were run. Reading the code, the
  strict `<` at `src/lib/meter-tone.ts:31` and the `tone === "ok"` guard at
  `src/components/ui/data.tsx:50` are each pinned by a two-sided assertion pair (C6/C7, C12/C15),
  so the likely mutants would be killed, but that was not executed.
- PRD §8 asks for a Playwright MCP walk of B1–B4; it is not a check in `checks.md` and was not run
  here.
