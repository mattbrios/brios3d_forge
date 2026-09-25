# Fase 11 — Estoque mínimo, alertas e etiqueta QR verification

**Verdict**: PASS
**Profile**: standard
**Diff range**: 7d51f03^..48458e1
**Round**: 6 - scoped fix on top of round 5 (independent)
**Verifier**: round 5 (below, `## Histórico — rodada 5`) was dispatched as an independent
sub-agent (author != verifier) and found one real gap. Round 6, in this section, is the author
closing that gap — not a fresh independent pass. The current verdict for this feature is the one
in this section (`## Rodada 6`).

Histórico completo das rodadas 1-5 movido para
`.specs/features/phase-11-stock-alerts-qr/verification-history.md`, sem edição de conteúdo. Ficou
fora deste arquivo porque `validate_verification.py` lê toda tabela do arquivo pelo nome da coluna
(`Uncovered`, `Unproven`, `Result`, `Killed`, `Expectation met`), sem distinguir seção vigente de
histórico — mantendo os relatórios FAIL das rodadas 4 e 5 aqui dentro, o gate reprovaria
permanentemente um veredito já corrigido pela rodada 6. Nenhuma célula do histórico conta para o
veredito atual.

## Rodada 6 — fix do gap 1 achado pela rodada 5, escopada

**Verdict**: PASS
**Autor do fix**: o mesmo agente que orquestrou o despacho da rodada 5 (não é uma nova rodada de
Verifier independente — é o fechamento do gap que a rodada 5 encontrou). Uma futura re-verificação
independente pode reabrir isto se quiser conferir por si mesma; o que segue é o que foi de fato
executado nesta sessão.

Escopo: só o gap 1 da rodada 5 (`production` nunca confrontado com o gate `role === "admin"` do
formulário "Estoque mínimo" em `/inventory/items/[id]`). Nada em `Coverage`, `Faults` ou `Binding
sources` fora deste ponto foi reaberto — o resto da feature (C1-C63, os 15 mutantes das rodadas
1-3, o mutante do prefill reconfirmado pela rodada 5) segue `carried` de `verification-history.md`.

**Fix**: adicionadas duas asserções ao teste já existente `production registers a consumo and an
inventory count` (`web/src/app/(app)/inventory/items/[id]/page.test.tsx`, não um teste novo, porque
é o único ponto que já renderiza a tela sob sessão `production`):
`expect(screen.queryByRole("button", { name: "Salvar mínimo" })).toBeNull()` e
`expect(screen.queryByText("Estoque mínimo", { selector: "h2" })).toBeNull()`. Nenhuma linha de
`web/src/app/(app)/inventory/items/[id]/page.tsx` mudou — o comportamento já estava correto, só
faltava a prova.

**Fault reinjetado e morto, verificado por execução própria**: `role === "admin"` →
`role === "admin" || role === "production"` em `page.tsx:241` (a mesma condição de `operational`,
`:197` — o erro de copiar-e-colar que a rodada 5 apontou como plausível). Rodado direto no working
tree (mudança revertida antes do commit, `git diff --stat` vazio no arquivo de produção depois):
`npm --prefix web run test -- --run "src/app/(app)/inventory/items/[id]/page.test.tsx"` foi de
**7 passed** para **1 failed, 6 passed**, com a falha exatamente na asserção nova
(`AssertionError: expected <button ...>Salvar mínimo</button> to be null`, `page.test.tsx:288`).
Mutante morto.

## Binding sources

| Source | Opened | Contradiction | Uncovered |
| --- | --- | --- | --- |
| `plan.md` `## Papéis` (Assumptions) — "Definir o piso é admin; ler alertas é para os três papéis" | yes - reread nesta rodada | none | - |
| `AGENTS.md` "Política de testes", linha "Tela" — "carregando, erro, vazio, e o que cada papel vê" | yes - reread nesta rodada | none | - |
| `checks.md` C58, claim literal ("... e `sales` não vê a ação 'Salvar mínimo' ...") | yes - reread nesta rodada | none | - |

As três linhas acima estavam com `Uncovered`/`Contradiction` preenchidos no relatório da rodada 5
(preservado em `verification-history.md`), porque `production` ainda não tinha prova contra o ramo
`role === "admin"` de `page.tsx:241`. Ficam vazias aqui porque o fix desta rodada fechou exatamente
essa lacuna.

## Coverage

| Set (size) | Recomputed from | Member -> proof | Unproven |
| --- | --- | --- | --- |
| papéis vs. controle "Salvar mínimo" em `/inventory/items/<id>` (3) | `page.tsx:241` (`role === "admin"`), único ponto de decisão deste controle | `admin` liberado -> `admin sets and clears the item minimum` (`:181-208`) · `sales` barrado -> `sales sees only the read-only item detail` (`:117`) · `production` barrado -> `production registers a consumo and an inventory count` (asserção nova) | - |
| prefill do campo do piso, os dois lados em cada formulário de edição (2, carried da rodada 5) | `materials/page.tsx:105`, `items/[id]/page.tsx:80` | `/materials` C62 · `/inventory/items/<id>` C63 | - |

## Test policy rows

| Row | Files it classifies | Required proof | Expectation met |
| --- | --- | --- | --- |
| Tela — "carregando, erro, vazio, e o que cada papel vê" (`AGENTS.md`) | `web/src/app/(app)/inventory/items/[id]/page.tsx` | um teste por estado, e o que **cada** papel vê, para **cada** controle decidido por papel | yes - `production` agora tem prova contra o ramo `role === "admin"` (`:241`) na mesma sessão que já provava `operational` |
| telas de cadastro que ganharam o campo do piso (`checks.md`, mesma linha das rodadas 2-3) | `materials/page.tsx`, `inventory/items/page.tsx`, `inventory/items/[id]/page.tsx` | render, submit, prefill e **o que cada papel vê**, nas telas que o campo toca | yes, mesmo ponto |

## Faults injected

| Mutation | Location | Killed |
| --- | --- | --- |
| `role === "admin"` → `role === "admin" \|\| role === "production"` no gate do formulário "Estoque mínimo" | `web/src/app/(app)/inventory/items/[id]/page.tsx:241` | yes - `page.test.tsx:288` falhou como esperado; revertido, `git diff --stat` do arquivo de produção ficou vazio |
| prefill do campo do piso (carried da rodada 5, não reinjetado nesta rodada porque nada em `materials/page.tsx` ou `items/[id]/page.tsx:80` mudou) | `materials/page.tsx:105`, `items/[id]/page.tsx:80` | yes - carried da rodada 5 |

## Gate

Rodado do zero após o fix:

- `npm --prefix web run test -- --run` — **148 passed**, 0 failed (mesmo total de antes: a correção
  ampliou um teste existente, não criou um novo)
- `npm --prefix web run lint` — exit 0
- `npm --prefix web run build` — exit 0 (18 rotas geradas, sem erro de tipo)
- `npm --prefix api run test:e2e`, `npm --prefix api run test`, `npm --prefix api run lint`,
  `npm --prefix api run build` — carried da rodada 5 (nada em `api/` mudou nesta rodada)

**Veredito vigente da feature: PASS.** A rodada 5 (independente) não achou nenhum outro problema
além do gap 1, e esse gap está fechado com prova localizada e mutante morto, verificado por
execução nesta mesma sessão.


Ver `.specs/features/phase-11-stock-alerts-qr/verification-history.md` para o histórico completo das rodadas 1-5 (achados, provas e o FAIL da rodada 5 que a rodada 6 acima fechou).
