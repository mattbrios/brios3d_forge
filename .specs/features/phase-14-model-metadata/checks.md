# Fase 14 — Metadados do modelo por URL (Printables e MakerWorld) checks

Profile: light
Plan: `.specs/features/phase-14-model-metadata/plan.md`

25 checks in 5 slices · 2 one-way doors · 0 open

## Checks

### S1 - Preview de metadados por URL · api/src/modules/products/ (model-metadata*), api/src/modules/print-profiles/ (exports) · ~14 KB · ~4k

**C1** - `POST /products/model-metadata` com a URL de um modelo do Printables responde 200 com `title`, `imageUrl`, `designer` e a licença normalizada (AC 1)
Proof: `npm --prefix api run test:e2e -- -t "printables preview"`

**C2** - `POST /products/model-metadata` com a URL de um modelo do MakerWorld responde 200 reaproveitando `title`/`coverUrl`/`license`/`designCreator.name` já mapeados pela Fase 2 (AC 2)
Proof: `npm --prefix api run test:e2e -- -t "makerworld preview"`

**C3** - Uma URL fora das três plataformas responde 400 com `INVALID_MODEL_URL` (AC 3)
Proof: `npm --prefix api run test:e2e -- -t "unsupported domain returns 400"`

**C4** - Uma URL do Thingiverse responde 400 com a mensagem "busca automática não disponível" (AC 4)
Proof: `npm --prefix api run test:e2e -- -t "thingiverse url returns 400"`

**C5** - Modelo inexistente na plataforma de origem responde 404 (AC 5)
Proof: `npm --prefix api run test:e2e -- -t "model not found returns 404"`

**C6** - Plataforma de origem fora do ar ou com formato irreconhecível responde 502 sem vazar o detalhe da falha upstream (AC 6)
Proof: `npm --prefix api run test:e2e -- -t "upstream failure returns 502"`

**C7** - `POST /products/model-metadata` não grava nenhuma linha em `products` em nenhum dos casos acima (AC 7)
Proof: `npm --prefix api run test:e2e -- -t "does not write to products table"`

**C8** - `HttpPrintablesClient` usa `node:https`, não segue redirecionamento, aplica `AbortSignal.timeout` e limite de bytes do corpo, e envia o User-Agent `Brios3DForge/<version>` — mesmo padrão do `HttpMakerWorldClient` (Landing: adaptador HTTP por plataforma)
Proof: `npm --prefix api run test -- printables.client.spec.ts -t "does not follow redirects"`
Proof: `npm --prefix api run test -- printables.client.spec.ts -t "aborts after timeout"`
Proof: `npm --prefix api run test -- printables.client.spec.ts -t "rejects a body over the byte limit"`
Proof: `npm --prefix api run test -- printables.client.spec.ts -t "sends the honest user-agent"`

### S2 - Normalização da licença · api/src/modules/products/license-normalization.ts · ~2 KB · ~1k

**C9** - Licença contendo `noncommercial`/`non-commercial` (qualquer capitalização) normaliza para `commercialUseAllowed = false` (AC 8)
Proof: `npm --prefix api run test -- license-normalization.spec.ts -t "noncommercial"`

**C10** - Licença exatamente `Standard Digital File License` normaliza para `commercialUseAllowed = false` (AC 9)
Proof: `npm --prefix api run test -- license-normalization.spec.ts -t "Standard Digital File License"`

**C11** - Licença permissiva conhecida (Creative Commons sem `noncommercial`, `CC0`, domínio público, MIT, BSD, GPL) normaliza para `commercialUseAllowed = true` (AC 10)
Proof: `npm --prefix api run test -- license-normalization.spec.ts -t "permissive"`

**C12** - Licença vazia, ausente ou não reconhecida normaliza para `commercialUseAllowed = null`, preservando o texto original em `license` (AC 11)
Proof: `npm --prefix api run test -- license-normalization.spec.ts -t "unknown or empty"`

### S3 - Atualizar metadados de um produto existente · api/src/modules/products/products.service.ts, products.controller.ts · ~6 KB · ~2k

**C13** - Admin chama `.../refresh` num produto do Printables ou do MakerWorld: sobrescreve `modelTitle`, `modelImageUrl`, `modelDesigner`, `modelLicense`, `commercialUseAllowed`, grava `modelMetadataFetchedAt` e responde 200 com o produto atualizado (AC 12)
Proof: `npm --prefix api run test:e2e -- -t "refresh overwrites metadata fields"`

**C14** - Produto inexistente responde 404 com `PRODUCT_NOT_FOUND` (AC 13)
Proof: `npm --prefix api run test:e2e -- -t "refresh unknown product returns 404"`

**C15** - Produto do Thingiverse responde 400 com a mesma mensagem do AC 4, sem alterar nenhum campo (AC 14)
Proof: `npm --prefix api run test:e2e -- -t "refresh thingiverse product returns 400"`

**C16** - Falha upstream (404/502) na busca propaga o mesmo código, sem alterar nenhum campo do produto (AC 15)
Proof: `npm --prefix api run test:e2e -- -t "refresh upstream failure leaves product unchanged"`

**C17** - Quem chama sem ser admin recebe 403 (AC 16)
Proof: `npm --prefix api run test:e2e -- -t "refresh forbidden for non-admin"`

**C18** - Chamar `.../refresh` duas vezes sobre o mesmo produto sobrescreve os mesmos campos e avança `modelMetadataFetchedAt` na segunda chamada (AC 17)
Proof: `npm --prefix api run test:e2e -- -t "refresh is repeatable"`

### S4 - Web: formulário de produto usa o preview antes de salvar · web/src/components/product-form.tsx · ~3 KB · ~1k

**C19** - Colar uma URL válida e acionar "Buscar metadados" preenche título, designer, licença, uso comercial e mostra a imagem, sem chamar `POST`/`PATCH /products` (AC 18)
Proof: `npm --prefix web run test -- product-form.test.tsx -t "fills fields from metadata preview"`

**C20** - Durante a busca a tela mostra o estado de carregamento (AC 19)
Proof: `npm --prefix web run test -- product-form.test.tsx -t "shows loading state while fetching metadata"`

**C21** - Busca com falha (URL inválida, Thingiverse, 404, 502) mostra a mensagem de erro devolvida pela API e mantém os campos editáveis (AC 20)
Proof: `npm --prefix web run test -- product-form.test.tsx -t "shows error and keeps fields editable"`

### S5 - Web: "Atualizar metadados" no detalhe do produto · web/src/app/(app)/products/[id]/page.tsx (ou componente extraído) · ~4 KB · ~1k

**C22** - Admin abre "Atualizar metadados" num produto do Printables ou do MakerWorld: a tela busca o preview e mostra, lado a lado, valor gravado e valor buscado para título, designer, licença, uso comercial e imagem, sem gravar nada ainda (AC 21)
Proof: `npm --prefix web run test -- product-metadata-refresh.test.tsx -t "shows diff between saved and fetched values"`

**C23** - Confirmar a atualização chama `.../refresh` e reflete o produto atualizado, incluindo a data da última busca (AC 22)
Proof: `npm --prefix web run test -- product-metadata-refresh.test.tsx -t "confirm calls refresh and reflects updated product"`

**C24** - Cancelar antes de confirmar não persiste nada (AC 23)
Proof: `npm --prefix web run test -- product-metadata-refresh.test.tsx -t "cancel persists nothing"`

**C25** - Produto do Thingiverse não exibe o botão "Atualizar metadados" (AC 24)
Proof: `npm --prefix web run test -- "[id]/page.test.tsx" -t "hides refresh button for thingiverse product"`

**C26** - Falha do preview (400/404/502) mostra a mensagem de erro e mantém os dados atuais do produto sem alteração (AC 25)
Proof: `npm --prefix web run test -- product-metadata-refresh.test.tsx -t "preview failure keeps product unchanged"`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| `POST /products/model-metadata` statuses (4) | 200 C1,C2 · 400 C3,C4 · 404 C5 · 502 C6 | - |
| `POST /products/:id/model-metadata/refresh` statuses (5) | 200 C13,C18 · 400 C15 · 403 C17 · 404 C14 · 502 C16 | - |
| license normalization branches (4) | noncommercial keyword C9 · exact SDFL string C10 · known permissive C11 · unknown/empty C12 | - |
| Landing: adaptador HTTP do Printables segue AD-011 (4 propriedades) | sem redirect C8 · timeout C8 · limite de bytes C8 · User-Agent honesto C8 | - |
| Landing: regra de normalização por prioridade fixa (4 ramos) | noncommercial keyword C9 · exact SDFL string C10 · known permissive C11 · unknown/empty C12 | - |
| web: formulário de produto, preview de metadados (3 estados) | preenchido C19 · carregando C20 · erro C21 | - |
| web: "Atualizar metadados" no detalhe (5) | diff mostrado C22 · confirmar grava C23 · cancelar não grava C24 · botão ausente p/ Thingiverse C25 · erro do preview C26 | - |
| plataformas com busca automática nesta fase (2) | Printables C1 · MakerWorld C2 | - |

- Claims naming a status code or route: C1-C6, C13-C18 - cada um tem prova de e2e cruzando o `AppModule` real
- Nenhum outro check afirma mais do que o caso único que sua prova exercita

## Swept

- validation: C3, C4 (URL fora das plataformas suportadas ou do Thingiverse)
- failure modes: C6, C16 (falha upstream não altera estado gravado)
- idempotency: C18 (repetir `.../refresh` é seguro, cada chamada sobrescreve os mesmos campos)
- authorization: C17 (só admin chama `.../refresh`; `POST /products/model-metadata` segue a mesma regra de `POST /products` - AD-018, sem `@Roles()` adicional)
- concurrency: n/a - nenhuma escrita concorrente nova; `.../refresh` sobrescreve colunas simples do próprio produto, sem contador nem saldo (AD-023 não se aplica aqui)
- data lifecycle: n/a - nenhum dado tem TTL, arquivamento ou expurgo nesta fase
- dependency failure: C6, C16 (Printables/MakerWorld fora do ar responde 502 sem vazar detalhe)
- state transitions: n/a - `Product` não tem máquina de estados; metadado é sobrescrita simples
- observability: n/a - nenhum requisito de log ou métrica nesta fase (o padrão de `Logger.warn` do `HttpMakerWorldClient` é reaproveitado pelo `HttpPrintablesClient`, mas nenhum AC pede a existência do log)

## Out of scope

- Busca automática de metadados no Thingiverse - API oficial exige App Token estático gerado manualmente num app registrado (sem OAuth de usuário final); ver `plan.md`
- Cópia local da imagem do modelo - decisão já tomada na Fase 13 de exibir por hotlink
- Atualização automática/agendada dos metadados - só a ação manual `.../refresh` está no escopo

## Handoff

- S1 (14 KB) + S2 (2 KB) + S3 (6 KB) + S4 (3 KB) + S5 (4 KB) = 29 KB de arquivos novos/alterados, ~8k tokens; somado ao contexto de leitura dos arquivos existentes que o builder precisa abrir para seguir os padrões (`makerworld.client.ts` 4,5 KB, `makerworld-design.mapper.ts` 7 KB, `products.service.ts` 11,5 KB, `product-form.tsx` 5 KB, `[id]/page.tsx` 13 KB, `products.types.ts` 4 KB, `license-notice.tsx` 0,7 KB) = ~46 KB adicionais, ~12k tokens. Total ~75 KB, ~19k tokens, bem abaixo do orçamento de 150k - **um builder só, sem pergunta de mecanismo**.
