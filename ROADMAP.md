# ROADMAP — Brios3D Forge

## 1. Visão geral

O Brios3D Forge é um sistema de gestão para uma empresa de impressão 3D personalizada em FDM. Ele cobre cadastros, estoque de filamento por rolo, calculadora de preço, catálogo, orçamentos, produção, compras, financeiro, fiscal e relatórios.

As fases seguem os quatro marcos do `CONTEXT.md` (MVP → Operação diária → Lucro real → Automação), com uma diferença: as partes mais arriscadas vêm primeiro. O motor de preço é um serviço puro e fica logo depois do setup. A importação dos dados de impressão pela URL do MakerWorld vem em seguida, já dentro do MVP. Cada fase entrega uma fatia vertical (API + tela, quando fizer sentido) e deixa o projeto estável.

> **Nomenclatura:** o CONTEXT usa "Fase 2/3/4" para os blocos macro. Aqui eles se chamam **Marcos**, e **Fase N** é a unidade de trabalho numerada de 0 a 29.

## 2. Decisões técnicas

### Vindas do CONTEXT.md e do AGENTS.md
- **Monorepo TypeScript `strict`, sem `any`.** `api/` (NestJS, Vitest, oxlint, porta 3001) e `web/` (Next.js App Router, porta 3000) são independentes e se falam só por HTTP/JSON.
- **Banco:** PostgreSQL 17 via `docker-compose.yml`. O ORM é TypeORM, que já está no scaffold.
- **API:** toda entrada externa é validada. Os erros saem como `{ "error": "mensagem" }`, sem stack trace.
- **Web:** a URL da API vem de `NEXT_PUBLIC_API_URL`.
- **Módulos da API** ficam em `api/src/modules/`: `auth`, `users`, `settings`, `materials`, `printers`, `customers`, `suppliers`, `inventory`, `purchasing`, `products`, `pricing`, `quotes`, `orders`, `production`, `maintenance`, `finance`, `reports`.
- **`pricing` é um serviço puro e sem estado.** Ele recebe parâmetros e devolve o custo detalhado por componente. Orçamentos, catálogo e relatórios reutilizam o mesmo cálculo. Precisa de alta cobertura de testes.
- **Markup divisor:** `Preço = Custo c/ risco / (1 − %margem − %impostos − %taxa canal)`.
- **Filamento é rastreado por rolo individual**, com saldo em gramas e tara do carretel.
- **Custo de material por custo médio ponderado.**
- **% de falha** começa como valor configurável e depois passa a vir das falhas registradas.
- **Integrações externas** (NF, marketplaces, impressoras) ficam para o fim e entram por **adaptadores**.
- **Escopo só FDM.** Nada de resina.

### Convenções propostas neste roadmap (confirmar na Fase 0)
- **Schema por migrations do TypeORM**, com `synchronize` desligado desde a Fase 0. Isso evita perda de dados silenciosa.
- **Dinheiro** em `numeric` no banco e em centavos inteiros no cálculo. **Pesos** em gramas e **tempos** em horas decimais ou segundos. **Percentuais** como fração (0.15). O arredondamento acontece só na apresentação e no preço final.
- **Validação na API** com `ValidationPipe` global + `class-validator`/`class-transformer`, o padrão do Nest.
- **Movimentações de estoque imutáveis** (ledger). O saldo do rolo é derivado ou conciliado a partir delas, e cada movimento guarda o usuário (log de auditoria).
- **Testes:** unitários com Vitest em cada módulo. Os e2e usam um banco Postgres de teste separado.

## 3. Tabela-resumo das fases

| # | Fase | Objetivo | Status |
|---|---|---|---|
| **Marco MVP** | | *Precifica corretamente e controla filamento* | |
| 0 | Setup e fundações | Tooling, erros/validação padrão, migrations, health check, CI | ✅ |
| 1 | Motor de preço (`pricing`) | Serviço puro com custo detalhado e preço por canal, bem testado | ✅ |
| 2 | Dados de impressão pela URL do MakerWorld | Obter tempo, gramas por filamento, cores, AMS e impressora a partir da URL do perfil, sem processar arquivos | ✅ |
| 3 | Autenticação | Login, sessão, proteção de rotas na API e no web | ✅ |
| 4 | Usuários e papéis | CRUD de usuários e autorização por papel (admin, produção, vendas) | ✅ |
| 5 | Configurações globais e canais | Tarifas, hora de trabalho, margens, % falha/purga, custos fixos, taxas por canal | ✅ |
| 6 | Materiais | Cadastro de materiais e padrão de CRUD reutilizável (API + web) | ✅ |
| 7 | Impressoras | Cadastro de impressoras com dados de custo, horímetro e AMS | ✅ |
| 8 | Clientes e fornecedores | Cadastros de clientes e fornecedores | ✅ |
| 9 | Estoque de filamento por rolo | Rolos, movimentações, pesagem com tara, custo médio ponderado | ✅ |
| 10 | Insumos e peças de reposição | Itens controlados por quantidade, com movimentações e custo médio | ⬜ |
| 11 | Estoque mínimo, alertas e etiqueta QR | Alertas de reposição e etiqueta com QR code para o rolo | ⬜ |
| 12 | Calculadora integrada | Tela de precificação usando cadastros, estoque e os dados importados pela URL do MakerWorld | ⬜ |
| **Marco 2** | | *Operação diária no sistema* | |
| 13 | Catálogo e ficha técnica | Produtos com URL do modelo, variações, ficha técnica, licença e custo sempre atualizado | ⬜ |
| 14 | Metadados do modelo por URL | Buscar imagem, título e licença no Printables, MakerWorld ou Thingiverse | ⬜ |
| 15 | Estoque de produtos acabados | Saldo de pronta-entrega por produto/variação | ⬜ |
| 16 | Orçamentos | Criar orçamento com itens, canal, desconto por quantidade e preço mínimo | ⬜ |
| 17 | Orçamento em link/PDF e aprovação | Link público com validade, PDF e conversão em pedido | ⬜ |
| 18 | Pedidos e kanban | Pedidos com fluxo de status em kanban e arquivos do cliente | ⬜ |
| 19 | Trabalhos de impressão e fila | Jobs por pedido, fila por impressora, previsão e conclusão com baixa automática | ⬜ |
| 20 | Registro de falhas | Falhas, perda de material, reimpressão e % de falha real na calculadora | ⬜ |
| **Marco 3** | | *Visão de lucro real* | |
| 21 | Compras | Pedido de compra → recebimento → estoque com custo real rateado | ⬜ |
| 22 | Manutenção de impressoras | Planos preventivos por horas, alertas, uso de peças, métricas por máquina | ⬜ |
| 23 | Vendas por canal | Registro de vendas por canal a partir de pedidos ou pronta-entrega | ⬜ |
| 24 | Contas a pagar e a receber | Títulos, baixas e fluxo de caixa | ⬜ |
| 25 | Margem real e DRE | Margem real por pedido e DRE simplificada mensal | ⬜ |
| 26 | Relatórios comerciais | Faturamento, lucro e margem por período, produto e canal; ranking de produtos | ⬜ |
| 27 | Relatórios de produção e dashboard | Consumo de filamento, projeção de compra, horas, ocupação, falhas; dashboard | ⬜ |
| **Marco 4** | | *Automação* | |
| 28 | Fiscal (NF-e/NFS-e) | Emissão por API de terceiro via adaptador; imposto do enquadramento na calculadora | ⬜ |
| 29 | Integrações externas | Adaptadores para importar pedidos de marketplaces e ler o status das impressoras | ⬜ |

> A Fase 29 pode ser dividida (29a marketplaces, 29b impressoras) quando for detalhada perto da execução. Veja "Questões em aberto".

## 4. Detalhamento das fases

### Fase 0 — Setup e fundações

**Objetivo:** deixar o monorepo pronto para receber módulos, com padrões de erro e validação, migrations, testes que rodam contra o banco e CI.

**Dependências:** nenhuma.

**Tarefas:**
- [x] Corrigir a porta padrão da API em `api/src/main.ts` para `3001`
- [x] Adicionar ao `.env.example` as variáveis já usadas no código: `DB_HOST`, `DB_PORT`, `PORT`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`
- [x] Adicionar `*.tsbuildinfo` ao `.gitignore`
- [x] Criar `api/src/modules/` e a convenção de pastas por módulo (controller, service, entity, dto, spec)
- [x] Ativar o `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) com `class-validator` e `class-transformer`
- [x] Criar um filtro global de exceções que responde `{ "error": "mensagem" }` com o status correto e nunca vaza stack trace; testar com Vitest
- [x] Trocar o `synchronize` por migrations do TypeORM: data source para a CLI, scripts `migration:generate`, `migration:run` e `migration:revert`
- [x] Trocar o `GET /` "Hello World" por `GET /health`, que confere a conexão com o banco
- [x] Configurar o e2e contra um banco de teste (ex.: `forge_test`), com migrations aplicadas antes da suíte
- [x] Web: layout base (cabeçalho, navegação lateral vazia, área de conteúdo) no lugar da página do template
- [x] Web: cliente HTTP único que lê `NEXT_PUBLIC_API_URL` e trata o formato `{ error }`
- [x] Web: página inicial que mostra o status do `/health` com estados de carregamento e erro
- [x] CI no GitHub Actions: `lint`, `test` e `build` de `api/` e `web/`, e `test:e2e` com um serviço Postgres 17

**Critérios de aceite:**
- `docker compose up` sobe `db`, `api` (3001) e `web` (3000) sem erro
- `GET http://localhost:3001/health` retorna 200 com o banco no ar e um erro `{ "error" }` com o banco fora
- Uma rota inexistente retorna 404 com `{ "error": "..." }`
- `npm --prefix api run lint|test|test:e2e|build` e `npm --prefix web run lint|build` passam
- `npm --prefix api run migration:run` roda sem erro com o banco limpo
- A CI passa em um push
- A home do web mostra "API ok", e mostra o estado de erro quando a API está fora (verificado com Playwright)

**Riscos ou observações:** NestJS 12, TypeORM 1.x e Next 16 são versões recentes, então as APIs podem ser diferentes do conhecido. Consulte a documentação local (`web/node_modules/next/dist/docs/`) antes de escrever código.

---

### Fase 1 — Motor de preço (`pricing`)

**Objetivo:** implementar a calculadora como serviço puro, sem estado e sem acesso ao banco, que devolve o custo detalhado por componente e o preço por canal.

**Dependências:** Fase 0.

**Tarefas:**
- [x] Definir os tipos de entrada: materiais (gramas, custo/g), horas de impressão, dados da impressora (potência W, custo, vida útil h), tarifa kWh, manutenção R$/h, horas de mão de obra (preparo, fatiamento, pós-processamento) e R$/h, insumos (qtd × custo), custos fixos mensais e horas produtivas/mês, % purga, % falha, % margem, % impostos, % taxa do canal, quantidade e preço mínimo
- [x] Implementar cada componente conforme a fórmula do CONTEXT: material (com purga), energia, depreciação, manutenção, mão de obra, insumos e custos fixos
- [x] Calcular o custo direto, o custo com risco (`× (1 + %falha)`) e o preço de venda com markup divisor
- [x] Desconto por quantidade: diluir preparo e fatiamento no lote (custo fixo do lote ÷ quantidade)
- [x] Aplicar o preço mínimo por pedido (sinalizar quando o piso for aplicado)
- [x] Calcular vários canais de uma vez, com preço por canal a partir do mesmo custo
- [x] Validar: soma de margem + impostos + taxa ≥ 100% gera erro de domínio; valores negativos são rejeitados
- [x] Definir a política de arredondamento em um único lugar
- [x] Testes Vitest: cada componente isolado, casos da fórmula calculados à mão, multimaterial, lote, preço mínimo, limites e erros. Meta: ≥ 95% de cobertura de linhas no módulo
- [x] Endpoint `POST /pricing/calculate` sem estado (todos os parâmetros no corpo, DTO validado), útil para testes e para as próximas fases

**Critérios de aceite:**
- `npm --prefix api run test:cov` mostra ≥ 95% no módulo `pricing`
- Um caso de referência documentado no teste (ex.: 100 g de PLA, 5 h, impressora de 250 W) bate com o cálculo manual centavo a centavo
- `POST /pricing/calculate` devolve cada componente, o custo direto, o custo com risco e o preço por canal. Com margem + impostos + taxa ≥ 100%, responde 400 `{ error }`

**Riscos ou observações:** este é o diferencial do produto. Um erro aqui contamina orçamentos, catálogo e margens. Se possível, valide o caso de referência com uma planilha que a empresa já usa.

---

### Fase 2 — Dados de impressão pela URL do MakerWorld

**Objetivo:** a partir da URL de um modelo do MakerWorld, obter automaticamente os dados do perfil de impressão escolhido: tempo estimado, gramas e metros por filamento (tipo e cor), necessidade de AMS, impressora e bico do perfil e placas. O que não puder ser obtido volta vazio, para o usuário preencher à mão. **Nenhum arquivo G-code/3MF é baixado, enviado ou processado**, porque eles podem passar de 200 MB (veja "Fora de escopo").

**Dependências:** Fase 0.

**Fonte dos dados (verificado em 2026-09-21):**
- A página HTML do MakerWorld responde `403` (desafio do Cloudflare) para requisições do servidor. **Não use scraping de HTML.**
- A API pública `GET https://makerworld.com/api/v1/design-service/design/<designId>` responde `200` em JSON, sem login. Ela não é documentada, então pode mudar sem aviso.
- Na URL `https://makerworld.com/pt/models/3007827-sea-animals-set?from=recommend#profileId-3387944`, o `designId` é `3007827` (o número antes do slug) e o `profileId-3387944` do fragmento é o `id` de um item de `instances[]`, **não** o campo `profileId` do item.
- Campos usados, por item de `instances[]`: `title`, `prediction` (segundos), `weight` (g), `needAms`, `materialCnt`, `materialColorCnt`, `extention.modelInfo.compatibility` (`devProductName`, ex.: "X2D", e `nozzleDiameter`), `extention.modelInfo.otherCompatibility[]` (outras impressoras compatíveis), `extention.modelInfo.projectSettings` (`layerHeight`, `wallLoops`, `sparseInfillDensity`) e `extention.modelInfo.plates[]`, cada uma com `index`, `prediction`, `weight` e `filaments[]` (`id` do slot, `type`, `color`, `usedG`, `usedM`).
- No nível do modelo: `title`, `coverUrl`, `license` e `designCreator`. A Fase 14 reaproveita esses campos.

**Tarefas:**
- [x] Validar e normalizar a URL: só HTTPS, só o host `makerworld.com` (com ou sem prefixo de idioma, como `/pt/`); extrair o `designId` do caminho e o `profileId` do fragmento `#profileId-N`, quando houver. Outra URL retorna 400 `{ error }`
- [x] Criar um adaptador `MakerWorldClient` atrás de uma interface, para trocar a fonte se a API mudar. Ele deve usar timeout, limite de tamanho da resposta e não seguir redirecionamentos para outro host
- [x] Criar um mapeador puro (sem rede) do JSON da API para o `PrintProfileData`: modelo (título, capa, licença, designer) e a lista de perfis, cada um com `id`, título, tempo em segundos, gramas totais, `needsAms`, impressora e bico, configurações de fatiamento, lista de filamentos (slot, tipo, cor, gramas, metros) e placas (índice, tempo, gramas e filamentos)
- [x] Todo campo ausente ou em formato inesperado vira `null` em vez de erro. Um modelo sem perfis volta com a lista vazia. O mapeador só falha quando a resposta não é um modelo reconhecível. Os números que vêm como texto (`"8"`, `"2.66"`) são convertidos e validados
- [x] Com `profileId` na URL, destacar esse perfil. Sem ele, usar o `defaultInstanceId` do modelo. Se o `profileId` não existir no modelo, retornar 400 `{ error }` explicando como ver os perfis disponíveis
- [x] Somar os filamentos de todas as placas do perfil pelo slot (um perfil do exemplo tem 11 placas) e manter também o detalhe por placa, que a Fase 19 usa para gerar os jobs
- [x] Endpoint `POST /print-profiles/import` com `{ "url": string }` que devolve o `PrintProfileData` sem gravar nada
- [x] Erros claros: URL inválida (400), modelo inexistente ou privado (404), e MakerWorld fora do ar, bloqueado ou com formato irreconhecível (502). Em todos os casos a resposta segue o formato `{ error }`, e o web oferece o preenchimento manual
- [x] Salvar a resposta real do modelo de exemplo como fixture em `api/test/fixtures/makerworld/design-3007827.json` (reduzida aos campos usados e a três perfis)
- [x] Os testes do mapeador e do endpoint usam o fixture e rodam sem acesso à internet (o cliente HTTP é substituído por um falso)
- [x] Web: campo "URL do MakerWorld" com botão de importar, seletor de perfil (quando o modelo tem vários) e um formulário com tempo, AMS, impressora e a lista de filamentos (tipo, cor, gramas). O que vier da API chega preenchido, e o que faltar fica em branco e editável. Mostrar os estados de carregamento, erro (com o formulário vazio para preencher à mão) e modelo sem perfis. Esta tela é a base da calculadora da Fase 12

**Critérios de aceite:**
- Com o fixture do modelo 3007827, a URL `https://makerworld.com/pt/models/3007827-sea-animals-set?from=recommend#profileId-3387944` retorna o perfil "Sea star":
  - 1707 s, 9 g, precisa de AMS, impressora X2D com bico de 0,4 mm, camada de 0,2 mm, 1 placa
  - slot 1 PLA #FD8008 = 8 g (2,66 m) e slot 4 PLA #000000 = 1 g (0,08 m)
- O perfil "0.2mm layer, 2 walls, 15% infill" (id 3377800) retorna 11 placas, 77054 s e 408 g, com os gramas somados por slot iguais à soma das placas
- Um fixture com campos removidos devolve esses campos como `null`, e o web os mostra em branco para preencher
- Uma URL de outro domínio ou sem `designId` retorna 400 `{ error }`; uma falha do MakerWorld retorna 502 `{ error }` sem derrubar a API
- A tela foi validada com Playwright: importação com sucesso, seletor de perfil, erro com formulário manual e campos vazios editáveis

**Riscos ou observações:**
- Este continua sendo o **maior risco técnico**, agora por outro motivo: a API do MakerWorld não é pública nem estável. O Cloudflare pode passar a bloqueá-la, ela pode exigir login ou mudar de formato. Por isso o adaptador fica isolado, o mapeador tolera campos ausentes e o preenchimento manual precisa funcionar sempre.
- **Precisão dos gramas:** o `usedG` vem arredondado para gramas inteiros (ex.: `"1"` para o preto do Sea star), enquanto o `usedM` tem duas casas decimais. Em cores com pouco uso o erro relativo é grande. Uma alternativa é calcular os gramas pelos metros × densidade do material (Fase 6) × área do filamento de 1,75 mm. Veja "Questões em aberto".
- Os dados refletem o perfil **como foi publicado**. Se o usuário alterar o projeto no slicer (escala, preenchimento, cores), os números da URL deixam de valer, e ele precisa ajustar à mão.
- Chamar a API sob demanda, só quando o usuário importar. Sem varredura nem chamadas em massa, para não ser bloqueado.
- Só o MakerWorld traz dados de fatiamento estruturados. URLs do Printables e do Thingiverse não entram nesta fase: nelas o preenchimento é manual.

---

### Fase 3 — Autenticação

**Objetivo:** proteger a API e o web com login.

**Dependências:** Fase 0.

**Tarefas:**
- [x] Entidade `User` (nome, e-mail único, hash de senha, papel, ativo) com migration
- [x] Hash de senha com um algoritmo forte (argon2 ou bcrypt)
- [x] `POST /auth/login`, `POST /auth/logout` e `GET /auth/me`
- [x] Emitir a sessão ou token conforme a estratégia decidida (veja "Questões em aberto")
- [x] Guard global de autenticação com decorator `@Public()` para as exceções (`/health`, login)
- [x] Seed idempotente do primeiro admin a partir de variáveis de ambiente (adicionar ao `.env.example`)
- [x] Proteger `/pricing/calculate` e `/print-profiles/import`
- [x] Web: página de login, redirecionamento de quem não está logado, logout e usuário atual no cabeçalho
- [x] Testes: unitários do serviço de auth e e2e do login e de rota protegida (401 sem credencial)

**Critérios de aceite:**
- Credenciais inválidas retornam 401 `{ error }` com mensagem genérica
- Uma rota protegida sem sessão retorna 401; com sessão, 200
- O fluxo de login e logout funciona no web (Playwright), com mensagem de erro na tela para senha errada

**Riscos ou observações:** API e web rodam em origens diferentes (portas 3000 e 3001), o que afeta cookies e CORS. Resolva isso na escolha da estratégia.

---

### Fase 4 — Usuários e papéis

**Objetivo:** gerenciar usuários e restringir ações por papel: administrador, operador de produção e vendas.

**Dependências:** Fase 3.

**Tarefas:**
- [x] Decorator `@Roles()` + guard de autorização
- [x] CRUD de usuários só para admin: listar, criar, editar papel e ativar/desativar (sem apagar fisicamente)
- [x] Trocar a própria senha
- [x] Documentar no ROADMAP a matriz de permissões por módulo, que será preenchida fase a fase
- [x] Web: tela de usuários (admin) com estados de carregamento, erro e lista vazia; menu escondendo o que o papel não pode acessar
- [x] Testes e2e: vendas e produção recebem 403 nas rotas de admin

**Critérios de aceite:**
- Um admin cria um usuário "vendas", que consegue logar e recebe 403 em `/users`
- Um usuário desativado não consegue logar
- As telas foram validadas com Playwright

#### Matriz de permissões

Uma linha por módulo, preenchida fase a fase conforme cada um nasce. "x" = o papel chama toda
rota do módulo. Um módulo sem preenchimento nasce fechado ao admin até a fase dele decidir os
outros papéis (door 1, Fase 4: uma rota sem `@Roles()` é só de admin).

| Módulo | admin | production | sales |
| --- | --- | --- | --- |
| `auth` | x | x | x |
| `users` | x | - | - |
| `settings` | x | leitura | leitura |
| `materials` | x | leitura | leitura |
| `printers` | x | leitura + `PATCH /printers/:id/hourmeter` | leitura |
| `customers` | x | leitura | x |
| `suppliers` | x | leitura | leitura |
| `inventory` | x | leitura + pesagem/baixa/descarte/abertura/secagem | leitura |
| `purchasing` | a definir na Fase 21 | a definir na Fase 21 | a definir na Fase 21 |
| `products` | a definir na Fase 13 | a definir na Fase 13 | a definir na Fase 13 |
| `pricing` | x | x | x |
| `quotes` | a definir na Fase 16 | a definir na Fase 16 | a definir na Fase 16 |
| `orders` | a definir na Fase 18 | a definir na Fase 18 | a definir na Fase 18 |
| `production` | a definir na Fase 19 | a definir na Fase 19 | a definir na Fase 19 |
| `maintenance` | a definir na Fase 22 | a definir na Fase 22 | a definir na Fase 22 |
| `finance` | a definir na Fase 24 | a definir na Fase 24 | a definir na Fase 24 |
| `reports` | a definir na Fase 26 | a definir na Fase 26 | a definir na Fase 26 |

`health` e `print-profiles` não são um dos 17 módulos da lista da seção 2 (o primeiro é infra, o
segundo entra no catálogo/calculadora das Fases 12-14), mas seguem a mesma regra: `GET /health` é
público, e `POST /print-profiles/import` está aberto aos três papéis desde esta fase.

---

### Fase 5 — Configurações globais e canais de venda

**Objetivo:** guardar os parâmetros da calculadora e as taxas por canal.

**Dependências:** Fase 4.

**Tarefas:**
- [x] Módulo `settings` com: tarifa de energia (R$/kWh), hora de trabalho (R$/h), margem padrão, % falha, % purga/perda, custo de manutenção R$/h (veja "Questões em aberto"), custos fixos mensais (itens como aluguel, software e internet) e horas produtivas/mês
- [x] Entidade `SalesChannel`: nome (balcão, Instagram/WhatsApp, Mercado Livre, Shopee, loja própria), % imposto, % taxa, ativo
- [x] Seed dos canais citados no CONTEXT
- [x] Endpoints de leitura para todos os papéis autenticados e edição só para admin
- [x] Validar faixas (percentuais entre 0 e 1; margem + imposto + taxa < 100% por canal)
- [x] Web: tela de configurações e tela de canais com os estados de carregamento, erro e vazio

**Critérios de aceite:**
- Um admin altera a tarifa kWh e o valor persiste
- Um canal com margem padrão + imposto + taxa ≥ 100% é rejeitado com 400
- Um não-admin recebe 403 ao editar
- Os testes e2e cobrem leitura e edição

---

### Fase 6 — Materiais

**Objetivo:** cadastrar materiais e estabelecer o padrão de CRUD (API + tabela/formulário no web) que as próximas fases vão copiar.

**Dependências:** Fase 4.

**Tarefas:**
- [x] Entidade `Material`: tipo (PLA, PETG, ABS, ASA, TPU, Nylon…), marca, cor, densidade (g/cm³), temperatura de bico e de mesa, precisa de secagem (e parâmetros de secagem, se houver), ativo
- [x] CRUD com paginação, busca e filtro por tipo; desativar em vez de apagar quando houver referências
- [x] Web: componentes reutilizáveis de listagem, formulário e confirmação; tela de materiais
- [x] Testes unitários e e2e do CRUD, incluindo a validação dos campos

**Critérios de aceite:**
- Criar, editar, listar, buscar e desativar um material funciona na API e no web
- Os estados de carregamento, erro e lista vazia foram validados com Playwright
- Uma densidade ou temperatura inválida retorna 400 `{ error }`

---

### Fase 7 — Impressoras

**Objetivo:** cadastrar as impressoras com os dados que a calculadora e a manutenção usam.

**Dependências:** Fase 6 (padrão de CRUD).

**Tarefas:**
- [x] Entidade `Printer`: nome/modelo, custo de aquisição, vida útil estimada (h), potência média (W), horímetro (h), bicos instalados (diâmetro e tipo), AMS/multicor (sim/não, nº de slots), ativa
- [x] CRUD e tela no padrão da Fase 6
- [x] Endpoint de ajuste manual do horímetro (a atualização automática vem na Fase 19)
- [x] Testes unitários e e2e

**Critérios de aceite:**
- CRUD completo na API e no web (Playwright)
- Os dados da impressora alimentam o `POST /pricing/calculate` sem conversão manual, com um teste de integração cobrindo isso

---

### Fase 8 — Clientes e fornecedores

**Objetivo:** cadastrar clientes (para orçamentos e pedidos) e fornecedores (para estoque e compras).

**Dependências:** Fase 6.

**Tarefas:**
- [x] Entidade `Customer` com campos mínimos a confirmar (veja "Questões em aberto")
- [x] Entidade `Supplier` com campos mínimos a confirmar
- [x] CRUD e telas no padrão da Fase 6
- [x] Testes unitários e e2e

**Critérios de aceite:**
- CRUD completo dos dois cadastros na API e no web (Playwright, com os três estados)
- Documento fiscal duplicado, se for exigido, é rejeitado com 409 `{ error }`

---

### Fase 9 — Estoque de filamento por rolo

**Objetivo:** controlar cada rolo individualmente, com saldo em gramas, pesagem com tara e custo médio ponderado por material.

**Dependências:** Fases 6 e 8.

**Tarefas:**
- [x] Entidade `FilamentRoll`: material, fornecedor, peso nominal (1 kg, 250 g, 3 kg…), peso inicial, tara do carretel, lote, data de compra, data de abertura, última secagem, localização, custo de aquisição, status (fechado, aberto, vazio, descartado)
- [x] Entidade `InventoryMovement` (ledger imutável): tipo (entrada, consumo, perda, ajuste de inventário), gramas ou quantidade, custo unitário, referência de origem (job, falha, compra, manual), usuário e data
- [x] Entrada manual de rolo (a entrada por compra vem na Fase 21)
- [x] Pesagem: informar o peso bruto na balança, calcular `saldo = bruto − tara` e gerar um movimento de ajuste com a diferença
- [x] Baixa manual de consumo, perda e descarte
- [x] Registrar abertura e secagem do rolo
- [x] Custo médio ponderado por material, recalculado a cada entrada e exposto em R$/g
- [x] Impedir saldo negativo
- [x] Web: lista de rolos por material (com saldo e filtros), detalhe do rolo com histórico, formulários de entrada, pesagem e baixa
- [x] Testes: custo médio (várias entradas com preços diferentes), pesagem, ledger, auditoria (usuário gravado)

**Critérios de aceite:**
- [x] Entrar 2 rolos com custos diferentes resulta no custo médio correto (teste)
- [x] Pesar um rolo com 812 g brutos e tara de 250 g deixa o saldo em 562 g, com um movimento de ajuste no histórico
- [x] Todo movimento mostra quem fez e quando
- [x] As telas foram validadas com Playwright, com os três estados

**Riscos ou observações:** a definição de "material" para o custo médio (tipo + marca + cor, ou só tipo) afeta o cálculo. Veja "Questões em aberto".

---

### Fase 10 — Insumos e peças de reposição

**Objetivo:** controlar itens por unidade ou quantidade: insumos e componentes (ímãs, insertos, parafusos, tinta, primer, cola, lixa, embalagem) e peças de reposição (bicos, PEI, correias, PTFE, hotend).

**Dependências:** Fase 9 (reaproveita o ledger).

**Tarefas:**
- [ ] Entidade `StockItem`: categoria (insumo, peça de reposição), nome/SKU, unidade de medida, fornecedor preferencial, localização, saldo e custo médio ponderado
- [ ] Movimentações de entrada, consumo, perda e ajuste, no mesmo ledger da Fase 9
- [ ] Marcar a peça de reposição como compatível com impressoras (vínculo usado na Fase 22)
- [ ] Web: lista por categoria, detalhe com histórico e formulários de movimentação
- [ ] Testes de custo médio e saldo para itens por quantidade

**Critérios de aceite:**
- Entrada e consumo de um insumo atualizam o saldo e o custo médio corretamente
- O histórico de movimentações aparece unificado com os rolos
- As telas foram validadas com Playwright

---

### Fase 11 — Estoque mínimo, alertas e etiqueta QR

**Objetivo:** avisar quando for preciso repor e identificar os rolos fisicamente.

**Dependências:** Fases 9 e 10.

**Tarefas:**
- [ ] Estoque mínimo por material (em gramas, somando os rolos) e por item
- [ ] Endpoint e painel de alertas com os itens abaixo do mínimo
- [ ] Indicador de alertas no layout do web
- [ ] Gerar uma etiqueta imprimível com QR code por rolo, apontando para a página do rolo no web
- [ ] Ao ler o QR, abrir a página do rolo com ações rápidas (pesar, dar baixa)
- [ ] Testes do cálculo de alertas

**Critérios de aceite:**
- Baixar um material abaixo do mínimo faz ele aparecer nos alertas; repor faz ele sumir
- A etiqueta é impressa com um QR legível que abre o rolo certo (verificado lendo o QR da tela no Playwright ou manualmente)

**Riscos ou observações:** o formato da etiqueta (tamanho, impressora térmica ou A4) não está definido.

---

### Fase 12 — Calculadora integrada

**Objetivo:** fechar o MVP com uma tela de precificação que usa os dados reais do sistema.

**Dependências:** Fases 1, 2, 5, 7, 9 e 10.

**Tarefas:**
- [ ] Serviço de aplicação que monta a entrada do `pricing` a partir dos cadastros: impressora, materiais com custo médio R$/g, insumos com custo médio, configurações e canais
- [ ] `POST /pricing/quote-preview` recebendo IDs e quantidades (impressora, materiais + gramas, insumos, horas, quantidade, canais)
- [ ] Web: tela da calculadora com
  - [ ] URL do MakerWorld que preenche o tempo e os gramas por filamento (via Fase 2)
  - [ ] mapeamento de cada filamento do perfil (tipo e cor) para um material cadastrado
  - [ ] preenchimento manual como alternativa
  - [ ] quadro com o custo detalhado por componente e o preço por canal lado a lado
  - [ ] simulação de quantidade (desconto por diluição)
- [ ] Testes de integração: os valores da tela batem com o `pricing` puro para os mesmos dados

**Critérios de aceite:**
- Importar um perfil multicor pela URL (fixture), mapear os materiais e ver o preço por canal com o detalhamento
- Mudar o custo médio de um material (nova entrada de rolo) muda o resultado
- A tela foi validada com Playwright nos estados de carregamento, erro (URL inválida ou MakerWorld indisponível, com o preenchimento manual) e vazio
- **Critério do marco MVP:** o sistema precifica corretamente e controla filamento

---

### Fase 13 — Catálogo e ficha técnica

**Objetivo:** cadastrar os produtos de catálogo com ficha técnica e custo que se atualiza sozinho.

**Dependências:** Fase 12.

**Tarefas:**
- [ ] Entidade `Product`: nome, descrição, URL do modelo (obrigatória), plataforma de origem detectada pelo domínio (Printables, MakerWorld, Thingiverse), metadados do modelo (título, URL da imagem, designer, licença), flag "permite uso comercial", data da última busca de metadados, ativo
- [ ] Validar a URL: aceitar só os domínios do Printables, do MakerWorld e do Thingiverse, e normalizar para o endereço canônico do modelo (sem parâmetros de rastreio). Outros domínios retornam 400 `{ error }`
- [ ] Não há upload de STL/3MF no catálogo. Nesta fase, os metadados podem ser preenchidos à mão; a busca automática vem na Fase 14
- [ ] Variações (cor, tamanho), cada uma com a própria ficha técnica
- [ ] Ficha técnica: materiais + gramas, tempo de impressão, impressora de referência, horas de mão de obra, insumos + quantidades. Para modelos do MakerWorld, ela pode ser pré-preenchida com o perfil escolhido (Fase 2)
- [ ] Custo e preço sugerido calculados sob demanda pelo `pricing`, para refletir sempre o custo médio atual do filamento
- [ ] Aviso visível para produto cuja licença não permite uso comercial
- [ ] Web: lista e detalhe do produto, editor de variações e ficha técnica, custo detalhado por variação
- [ ] Testes: recálculo depois de mudar o custo do filamento; validação da ficha

**Critérios de aceite:**
- Uma entrada de rolo mais cara aumenta o custo exibido do produto sem nenhuma ação manual
- Produto com licença não comercial mostra o aviso
- Uma URL fora do Printables, do MakerWorld e do Thingiverse é rejeitada com 400 `{ error }`
- As telas foram validadas com Playwright

---

### Fase 14 — Metadados do modelo por URL

**Objetivo:** a partir da URL do modelo no Printables, no MakerWorld ou no Thingiverse, buscar a imagem, o título e a licença para exibir no produto. O catálogo não recebe upload de STL/3MF.

**Dependências:** Fase 13.

**Tarefas:**
- [ ] Interface `ModelMetadataProvider` (adaptador) com uma implementação por plataforma: Printables, MakerWorld e Thingiverse. Cada uma devolve título, URL da imagem principal, designer, licença e se a licença permite uso comercial. A do MakerWorld reaproveita o `MakerWorldClient` da Fase 2
- [ ] Buscar os metadados pela API pública da plataforma quando houver, ou pelas tags Open Graph/JSON-LD da página. Timeout, limite de tamanho da resposta e só HTTPS para os domínios permitidos (nada de seguir redirecionamento para outro host)
- [ ] Mapear as licenças de cada plataforma (Creative Commons, "Standard Digital File License" do MakerWorld etc.) para um valor normalizado e para a flag "permite uso comercial"
- [ ] `POST /products/model-metadata` recebendo a URL e devolvendo os metadados sem gravar nada, para pré-visualizar no formulário
- [ ] Gravar os metadados no produto ao salvar, com a data da busca. A exibição usa os dados gravados, sem buscar de novo a cada acesso
- [ ] Ação "atualizar metadados" no produto, mostrando o que mudou (principalmente a licença) antes de gravar
- [ ] Quando a busca falhar (página fora do ar, bloqueio, formato mudou), retornar `{ error }` claro e permitir o preenchimento manual
- [ ] Web: campo de URL no formulário do produto com pré-visualização de imagem, título e licença; imagem e licença na lista e no detalhe do produto
- [ ] Testes: parsers de cada plataforma com respostas HTML/JSON salvas como fixture (sem acesso à rede na CI), validação de domínio, mapeamento de licenças e falha da busca

**Critérios de aceite:**
- Colar uma URL de cada plataforma preenche imagem, título e licença no formulário
- Um modelo com licença não comercial ativa o aviso da Fase 13 automaticamente
- Uma falha na busca mostra a mensagem de erro e deixa preencher à mão (Playwright, com os estados de carregamento, erro e vazio)
- Os testes rodam sem acesso à internet

**Riscos ou observações:** as plataformas não têm um contrato estável para isso. A página do MakerWorld fica atrás do Cloudflare, mas a API JSON usada na Fase 2 respondia sem bloqueio em 2026-09-21. A API do Thingiverse exige token (se for usada, a variável vai para o `.env.example`). A imagem é exibida pela URL da plataforma; se o hotlink for bloqueado, será preciso guardar uma cópia (veja "Questões em aberto").

---

### Fase 15 — Estoque de produtos acabados

**Objetivo:** controlar o estoque de pronta-entrega das peças de catálogo.

**Dependências:** Fases 10 e 13.

**Tarefas:**
- [ ] Item de estoque de produto acabado ligado a produto/variação, no mesmo ledger
- [ ] Entrada manual (a entrada pela produção vem na Fase 19), saída e ajuste
- [ ] Custo do produto acabado pela ficha técnica no momento da entrada
- [ ] Estoque mínimo e alerta (reusando a Fase 11)
- [ ] Web: saldo de pronta-entrega por produto/variação

**Critérios de aceite:**
- Entrada e saída atualizam o saldo, e o histórico aparece no produto
- O alerta de mínimo funciona para produtos acabados

---

### Fase 16 — Orçamentos

**Objetivo:** montar orçamentos para clientes com o custo e o preço de cada item.

**Dependências:** Fases 8, 12 e 13.

**Tarefas:**
- [ ] Entidades `Quote` e `QuoteItem`: cliente, canal, validade, status (rascunho, enviado, aprovado, recusado, expirado)
- [ ] Item de catálogo (produto/variação) ou item personalizado (dados importados pela URL do MakerWorld ou manuais)
- [ ] Desconto por quantidade (diluição) e preço mínimo por pedido aplicados no total
- [ ] Guardar um **snapshot** do custo detalhado e dos parâmetros usados, para o orçamento não mudar depois de enviado
- [ ] Recalcular enquanto o orçamento está em rascunho
- [ ] Web: lista de orçamentos, editor com totais ao vivo e visualização do detalhamento
- [ ] Testes: snapshot congelado, piso aplicado, expiração pela validade

**Critérios de aceite:**
- Um orçamento enviado mantém os valores mesmo que o custo do filamento mude depois
- Um orçamento abaixo do preço mínimo é elevado ao piso, e isso fica visível
- As telas foram validadas com Playwright

---

### Fase 17 — Orçamento em link/PDF e aprovação

**Objetivo:** mandar o orçamento ao cliente e transformar a aprovação em pedido.

**Dependências:** Fase 16.

**Tarefas:**
- [ ] Link público com token não adivinhável e respeito à validade (expirado mostra o aviso)
- [ ] Página pública do orçamento no web, sem login, mostrando só o preço (não o custo)
- [ ] Gerar o PDF do orçamento
- [ ] Aprovar (pelo link ou internamente) cria o pedido (Fase 18) com os itens e valores do snapshot
- [ ] Testes: token inválido ou expirado retorna 404/410 `{ error }`; a aprovação cria exatamente um pedido (idempotente)

**Critérios de aceite:**
- O link abre sem login e não expõe custos nem margens
- O PDF é baixado com os mesmos valores da tela
- Aprovar gera o pedido; aprovar de novo não duplica

**Riscos ou observações:** a Fase 18 precisa pelo menos da entidade `Order`. Se preferir, inverta a ordem das duas.

---

### Fase 18 — Pedidos e kanban

**Objetivo:** acompanhar os pedidos pelo fluxo Orçamento → Aprovado → Na fila → Imprimindo → Pós-processamento → Controle de qualidade → Pronto → Entregue.

**Dependências:** Fase 17.

**Tarefas:**
- [ ] Entidades `Order` e `OrderItem`, com origem no orçamento e cliente
- [ ] Máquina de estados com as transições permitidas e histórico de mudanças (quem e quando)
- [ ] Definir e implementar o armazenamento de arquivos atrás de uma interface (veja "Questões em aberto")
- [ ] Anexar arquivos personalizados do cliente (nome gravado, litofania, logo) ao item do pedido, com limites de tamanho e tipo
- [ ] Web: kanban com arrastar e soltar respeitando as transições válidas, e o detalhe do pedido
- [ ] Permissões: vendas cria e entrega; produção move as etapas de produção (confirmar a matriz)
- [ ] Testes: transições inválidas dão 400 `{ error }`; o histórico é gravado

**Critérios de aceite:**
- Um pedido percorre todo o fluxo no kanban (Playwright)
- Uma transição inválida é rejeitada na API e bloqueada no web

---

### Fase 19 — Trabalhos de impressão e fila por impressora

**Objetivo:** quebrar os pedidos em trabalhos (placas), alocar em impressoras, prever a conclusão e, ao concluir, dar baixa no filamento e atualizar o horímetro.

**Dependências:** Fases 7, 9 e 18.

**Tarefas:**
- [ ] Entidade `PrintJob`: pedido/item, placa (referência ao perfil do MakerWorld, quando houver), tempo estimado, gramas por filamento, impressora, posição na fila, status (na fila, imprimindo, concluído, falhou, cancelado), início e fim reais
- [ ] Gerar os jobs a partir das placas de um perfil do MakerWorld (Fase 2), ou criar manualmente
- [ ] Fila por impressora: alocar, reordenar e mover entre impressoras
- [ ] Previsão de conclusão por job e por pedido a partir da fila (veja "Questões em aberto" sobre horário de operação)
- [ ] Ao concluir: escolher o rolo usado para cada filamento, gerar o movimento de consumo com os gramas do job e somar as horas ao horímetro da impressora
- [ ] Concluir job de pedido de pronta-entrega gera entrada no estoque de produtos acabados (Fase 15)
- [ ] Web: fila por impressora (colunas), ações iniciar/concluir e o seletor de rolos na conclusão
- [ ] Testes: baixa correta por rolo, horímetro atualizado, previsão calculada

**Critérios de aceite:**
- Concluir um job multicor baixa os gramas de cada rolo e soma as horas ao horímetro
- A previsão de conclusão do pedido muda quando a fila é reordenada
- As telas foram validadas com Playwright

**Riscos ou observações:** a regra de qual rolo recebe a baixa, e o que fazer quando o saldo do rolo não é suficiente (dividir entre rolos), precisa de decisão.

---

### Fase 20 — Registro de falhas

**Objetivo:** registrar as falhas, o material perdido e a reimpressão, e usar a taxa de falha real na calculadora.

**Dependências:** Fase 19.

**Tarefas:**
- [ ] Entidade `PrintFailure`: job, motivo (warping, entupimento, descolamento, falta de energia, spaghetti, outro), gramas perdidos por filamento, horas perdidas, observação
- [ ] Marcar o job como falho gera o movimento de **perda** no rolo e as horas no horímetro
- [ ] Criar o job de reimpressão com um clique
- [ ] Calcular a % de falha real (global e por impressora) em uma janela configurável
- [ ] Configuração para a calculadora usar a % real ou a manual, com piso de amostra mínima
- [ ] Web: formulário de falha na conclusão do job, histórico de falhas e % real mostrada em configurações
- [ ] Testes: cálculo da taxa, perda no estoque, reimpressão

**Critérios de aceite:**
- Registrar uma falha baixa o material como perda e cria a reimpressão
- Com a opção "usar % real" ativa, a calculadora usa a taxa calculada (teste de integração)
- **Critério do Marco 2:** a operação diária (orçamento → pedido → produção → entrega) acontece dentro do sistema

---

### Fase 21 — Compras

**Objetivo:** registrar a compra desde o pedido até a entrada no estoque com o custo real.

**Dependências:** Fases 8, 9 e 10.

**Tarefas:**
- [ ] Entidades `PurchaseOrder` e `PurchaseOrderItem`: fornecedor, itens (material/rolo, insumo, peça), quantidade, preço unitário, frete, impostos, status (rascunho, enviado, recebido parcial, recebido, cancelado)
- [ ] Recebimento: para filamento, cria os rolos individuais; para os outros itens, gera as entradas
- [ ] Ratear frete e impostos entre os itens (critério a definir) para chegar ao custo real unitário, que alimenta o custo médio ponderado
- [ ] Histórico de preço por fornecedor e item
- [ ] Web: lista e editor de pedidos de compra, tela de recebimento e histórico de preços
- [ ] Testes: rateio, criação dos rolos no recebimento, atualização do custo médio

**Critérios de aceite:**
- Receber 3 rolos com frete gera 3 rolos com o custo rateado, e o custo médio do material é atualizado
- O histórico de preço mostra as compras anteriores do mesmo item com cada fornecedor

---

### Fase 22 — Manutenção de impressoras

**Objetivo:** fazer manutenção preventiva por horas, com alertas, consumo de peças e métricas por máquina.

**Dependências:** Fases 10, 19 e 20.

**Tarefas:**
- [ ] Planos de manutenção por impressora: tarefa (lubrificação, troca de bico, correias, limpeza…) e intervalo em horas
- [ ] Alerta quando o horímetro passa do intervalo desde a última execução
- [ ] Registrar a execução, com baixa das peças de reposição usadas
- [ ] Métricas por máquina: taxa de utilização (horas impressas ÷ horas disponíveis no período) e taxa de falha
- [ ] (Se decidido) Calcular o R$/h de manutenção a partir dos custos reais, para a calculadora
- [ ] Web: painel de manutenção por impressora, alertas e histórico
- [ ] Testes: disparo do alerta, baixa de peça, cálculo das métricas

**Critérios de aceite:**
- Concluir jobs até passar do intervalo gera o alerta; registrar a manutenção limpa o alerta e baixa a peça
- As métricas de utilização e falha batem com os jobs e falhas do período (teste)

---

### Fase 23 — Vendas por canal

**Objetivo:** registrar as vendas por canal (balcão, Instagram/WhatsApp, Mercado Livre, Shopee, loja própria).

**Dependências:** Fases 5, 15 e 18.

**Tarefas:**
- [ ] Entidade `Sale`: canal, cliente, itens, valor bruto, taxas e impostos do canal, valor líquido, data
- [ ] Criar a venda ao entregar um pedido, ou lançar uma venda direta de pronta-entrega (com baixa no estoque de acabados)
- [ ] Web: lista de vendas com filtros por canal e período, e lançamento de venda direta
- [ ] Testes: cálculo do líquido por canal e baixa de pronta-entrega

**Critérios de aceite:**
- Entregar um pedido gera a venda com as taxas do canal
- Uma venda direta baixa o estoque de acabados

**Riscos ou observações:** o CONTEXT não coloca o módulo de Vendas em nenhum marco. Ele entrou aqui porque a margem real e os relatórios dependem dele.

---

### Fase 24 — Contas a pagar e a receber

**Objetivo:** controlar os títulos financeiros e o fluxo de caixa.

**Dependências:** Fases 21 e 23.

**Tarefas:**
- [ ] Entidade `FinancialEntry`: tipo (pagar/receber), descrição, categoria, vencimento, valor, status, data e valor de pagamento, origem (compra, venda, manual)
- [ ] Gerar contas a pagar a partir das compras e contas a receber a partir das vendas/pedidos
- [ ] Lançamentos manuais (aluguel, software, internet… ligados aos custos fixos)
- [ ] Baixa (total; parcial se decidido)
- [ ] Fluxo de caixa realizado e previsto por período
- [ ] Web: listas de a pagar e a receber, baixa e tela de fluxo de caixa
- [ ] Testes: geração automática e saldo do fluxo

**Critérios de aceite:**
- Uma compra recebida aparece em contas a pagar e uma venda em contas a receber
- O fluxo de caixa do mês fecha com a soma dos lançamentos (teste)

---

### Fase 25 — Margem real e DRE simplificada

**Objetivo:** mostrar o lucro real por pedido e o resultado mensal.

**Dependências:** Fases 20 e 24.

**Tarefas:**
- [ ] Custo real do pedido: material realmente consumido (incluindo falhas e reimpressões), horas reais de máquina, insumos baixados e mão de obra, avaliados pelo `pricing`
- [ ] Margem real = preço de venda − custo real (valor e %), comparada com a margem orçada
- [ ] DRE simplificada mensal: receita bruta, deduções (impostos e taxas de canal), custos, despesas e resultado (estrutura a confirmar)
- [ ] Web: margem na tela do pedido e relatório de DRE por mês
- [ ] Testes: um pedido com falha tem margem real menor que a orçada; DRE de um mês de exemplo

**Critérios de aceite:**
- Um pedido com reimpressão mostra o custo real maior e a margem menor que no orçamento
- A DRE de um mês de dados semeados bate com o cálculo manual
- **Critério do Marco 3 (parcial):** a visão de lucro real está disponível

---

### Fase 26 — Relatórios comerciais

**Objetivo:** mostrar faturamento, lucro e margem por período, produto e canal, e os produtos mais vendidos e mais lucrativos.

**Dependências:** Fase 25.

**Tarefas:**
- [ ] Módulo `reports` com consultas agregadas e filtros de período, produto e canal
- [ ] Ranking de produtos mais vendidos (quantidade) e mais lucrativos (margem total)
- [ ] Web: telas com tabelas e gráficos, filtros e estados de vazio (período sem dados)
- [ ] Testes das agregações com dados semeados

**Critérios de aceite:**
- Os valores dos relatórios batem com as vendas e margens semeadas
- Um período sem dados mostra o estado vazio (Playwright)

---

### Fase 27 — Relatórios de produção e dashboard

**Objetivo:** mostrar consumo de filamento, projeção de compra, métricas de máquina e um dashboard com os indicadores principais.

**Dependências:** Fases 22 e 26.

**Tarefas:**
- [ ] Consumo de filamento por material e cor, por período
- [ ] Projeção de compra a partir do consumo médio e do saldo atual (método a confirmar)
- [ ] Horas de máquina, ocupação e taxa de falha por impressora e período
- [ ] Dashboard inicial: faturamento e margem do mês, alertas de estoque e manutenção, fila de produção e taxa de falha
- [ ] Web: telas e dashboard como página inicial depois do login
- [ ] Testes das agregações e da projeção

**Critérios de aceite:**
- O consumo exibido bate com os movimentos de consumo e perda do período
- O dashboard carrega com dados reais e trata o estado vazio (Playwright)
- **Critério do Marco 3:** há visão de lucro real completa

---

### Fase 28 — Fiscal (NF-e/NFS-e)

**Objetivo:** emitir nota fiscal por um provedor terceiro e usar o imposto do enquadramento na calculadora.

**Dependências:** Fases 23 e 25.

**Tarefas:**
- [ ] Interface `FiscalProvider` (adaptador) e implementação para o provedor escolhido (Focus NFe, NFE.io ou eNotas)
- [ ] Configuração do enquadramento (produto ou serviço sob encomenda, CNAE, anexo do Simples), definida com o contador
- [ ] A alíquota do enquadramento passa a alimentar o % de impostos da calculadora e dos canais
- [ ] Emitir a nota a partir de uma venda/pedido, consultar o status, cancelar e guardar o XML/PDF
- [ ] Credenciais do provedor por variáveis de ambiente (`.env.example`), só em sandbox até a validação
- [ ] Testes com provedor falso (mock do adaptador) e teste manual em sandbox
- [ ] Web: botão de emitir nota no pedido/venda, status e download

**Critérios de aceite:**
- Uma nota é emitida em sandbox a partir de uma venda, e o status e os arquivos ficam disponíveis
- Um erro do provedor aparece como `{ error }` legível, sem travar a venda

**Riscos ou observações:** depende do contador para o enquadramento e de uma conta no provedor. Não integrar direto com a SEFAZ.

---

### Fase 29 — Integrações com marketplaces e impressoras

**Objetivo:** automatizar a entrada de pedidos dos marketplaces e o status das impressoras em tempo real, sempre via adaptadores.

**Dependências:** Fases 19 e 23.

**Tarefas:**
- [ ] Interface `MarketplaceAdapter` e implementação para o primeiro marketplace escolhido (Mercado Livre ou Shopee): autenticação, importação de pedidos e mapeamento para `Order`/`Sale`
- [ ] Deduplicar pedidos importados (ID externo)
- [ ] Interface `PrinterConnector` e implementação para o primeiro protocolo escolhido (Moonraker/Klipper, OctoPrint ou Bambu MQTT): status, progresso e fim do job
- [ ] Atualizar o `PrintJob` a partir dos eventos da impressora (início e fim), com confirmação humana na baixa de estoque
- [ ] Web: tela de integrações (conectar e ver o status) e status ao vivo na fila de impressão
- [ ] Testes com adaptadores falsos; teste manual contra o ambiente real/sandbox

**Critérios de aceite:**
- Um pedido criado no marketplace (sandbox) aparece no sistema uma única vez
- Uma impressora conectada mostra o status e o progresso na fila
- **Critério do Marco 4:** automação das integrações prioritárias

**Riscos ou observações:** esta é a fase mais aberta. Divida em 29a e 29b (e uma subfase por integração) quando for detalhá-la. Depende de credenciais e das APIs de terceiros.

---

## 5. Questões em aberto

**Infra e convenções**
1. **Convenções de dinheiro e unidades** (centavos, `numeric`, percentuais como fração) e fuso horário (America/Sao_Paulo?). Confirmar.
2. **Deploy e produção:** o CONTEXT não descreve o ambiente de produção nem de backup. O roadmap cobre só o local e a CI. *Parcialmente respondida (2026-09-21):* o domínio de produção é `brios3d.com.br`, com o web em `forge.brios3d.com.br` e a API em `api.brios3d.com.br` (mesmo site, o que permite o cookie `SameSite=Lax` da Fase 3). Seguem abertos o provedor, o banco gerenciado e o backup.

**Autenticação e permissões**
3. **Estratégia de sessão:** JWT em cookie httpOnly, bearer token ou sessão no servidor? *Respondida (2026-09-21):* sessão no servidor, com token opaco em cookie httpOnly `SameSite=Lax` e o hash do token numa tabela `sessions`. O login tem limite de tentativas por e-mail. Detalhes em `.specs/features/phase-3-auth/plan.md`.
4. **Matriz de permissões:** o CONTEXT só lista os papéis (admin, produção, vendas). Quem vê custos e margens? Quem mexe no estoque? *Parcialmente respondida (Fase 4):* o mecanismo está pronto (`@Roles()`, rota sem decorator é só de admin) e a tabela em "Matriz de permissões" está preenchida para `auth`, `users` e `pricing` - os três papéis chegam à calculadora, então vendas e produção veem o preço calculado desde já. Falta decidir, módulo a módulo, quem vê custo e margem versus só o preço final, e quem mexe no estoque (Fases 5-27).

**Calculadora**
5. **Manutenção R$/hora:** é global ou por impressora? É um valor manual ou derivado dos custos reais de manutenção (Fase 22)? *Parcialmente respondida (Fase 5):* `Settings.maintenanceCentsPerHour` é um valor único global e manual - por impressora só quando `printers` nascer (Fase 7); derivado de custos reais só na Fase 22.
6. **Custos fixos:** quais itens entram e como se definem as "horas produtivas no mês" (valor manual ou calculado pelas impressoras)? *Parcialmente respondida (Fase 5):* `fixedCostItems` aceita qualquer item nomeado (nome + valor mensal), sem lista fechada; `productiveHoursPerMonth` é manual até as impressoras (posterior à Fase 7) permitirem calculá-lo.
7. **Desconto por quantidade:** é só a diluição de preparo e fatiamento, ou também há faixas de desconto percentual?
8. **Preço mínimo por pedido:** é um valor global ou por canal?
9. **Taxa do canal:** é só percentual? Marketplaces como o Mercado Livre também cobram uma tarifa fixa por venda, que a fórmula não contempla.
10. **Impostos por canal × enquadramento fiscal:** até a Fase 28, o % de impostos é configurado por canal. Depois, ele vem do enquadramento, substituindo ou somando?
11. **% de falha real:** qual a janela de cálculo, a amostra mínima e se vale a taxa global ou por impressora/material?

**Estoque**
12. **"Material" no custo médio:** a chave é tipo + marca + cor (cada cor é um material) ou só tipo + marca?
    *Respondida (Fase 9):* agrupa por `materialId` - o FK de `FilamentRoll` aponta para uma
    linha específica de `Material`, e essa linha já é a combinação tipo+marca+cor da Fase 6; não
    há como um rolo "ser" só o tipo sem já carregar marca e cor da linha referenciada.
13. **Baixa no fim do job:** o operador escolhe o rolo, ou o sistema sugere (rolo aberto primeiro / FIFO)? E quando um rolo acaba no meio da impressão?
14. **Etiqueta QR:** qual o formato (impressora térmica ou A4) e quais dados vão impressos?
15. **Estoque mínimo de filamento:** vale por material (soma dos rolos) ou por número de rolos fechados?

**Catálogo, orçamento e produção**
16. **Arquivos:** o catálogo não guarda STL/3MF nem fotos (usa a URL do modelo). Onde guardar os arquivos personalizados dos clientes (Fase 18)? Volume local no Docker ou storage S3-compatível?
17. **Arredondamento dos gramas do MakerWorld:** usar o `usedG` (inteiro) como vem, ou calcular os gramas pelo `usedM` × densidade do material cadastrado × área do filamento de 1,75 mm? No Sea star, 2,66 m de PLA dão cerca de 7,9 g contra os 8 g informados.
18. **Orçamento:** qual a validade padrão, o conteúdo e a identidade visual do PDF? O cliente aprova pelo link, ou a aprovação é só interna?
19. **Kanban × jobs:** o status do pedido muda sozinho conforme os jobs (ex.: primeiro job iniciado → "Imprimindo"), ou só manualmente?
20. **Previsão da fila:** considera operação 24/7 ou um horário de trabalho (para troca de placa)?
21. **Clientes e fornecedores:** quais campos são obrigatórios (CPF/CNPJ, endereço, contato)?
    *Respondida (Fase 8):* só `name` é obrigatório (até 150 caracteres); `document` (CPF/CNPJ,
    com dígito verificador validado), `phone`, `email` e `address` (texto livre) ficam opcionais.
    `document` é único quando informado, mas vários registros sem `document` convivem. Decisão do
    usuário ao revisar o plano da Fase 8: cliente de balcão/Instagram raramente tem CPF à mão no
    primeiro contato, e exigi-lo bloquearia o cadastro rápido.
22. **Modelos próprios:** o catálogo aceita só URLs do Printables, do MakerWorld e do Thingiverse. Um modelo criado pela própria empresa precisa ser publicado numa dessas plataformas para entrar no catálogo, ou deve haver uma exceção?
23. **Imagem do produto:** exibir direto da URL da plataforma ou guardar uma cópia (a imagem some se o modelo for removido)? A ficha técnica pode ser pré-preenchida pela URL do MakerWorld (Fase 2); falta decidir se ela deve ser atualizada quando o autor mudar o perfil publicado.
24. **Dados do job de impressão:** o `PrintJob` da Fase 19 guarda só os dados da placa (tempo e gramas por filamento), sem arquivo. Ele deve guardar também uma cópia dos dados do perfil do MakerWorld no momento da importação, para não mudar se o autor atualizar o perfil?

**Compras e financeiro**
25. **Rateio de frete e impostos:** por valor, por peso ou por quantidade?
26. **Recebimento parcial** de pedidos de compra e **baixa parcial** de títulos são necessários?
27. **DRE simplificada:** qual a estrutura de linhas esperada (validar com o contador)?
28. **Projeção de compra:** qual o método (média móvel de consumo? horizonte em dias?)

**Escopo por marco**
29. **Vendas e canais (módulo 8)** não aparece no roadmap do CONTEXT. Ela entrou no Marco 3 (Fase 23). Confirmar.
30. **Integrações da Fase 4 do CONTEXT:** qual marketplace e qual protocolo de impressora vêm primeiro? O CONTEXT marca as integrações de impressoras e marketplaces como "Futuro". Elas devem mesmo entrar neste roadmap ou ficar de fora?
31. **Provedor fiscal:** Focus NFe, NFE.io ou eNotas?

**Dados do MakerWorld (Fase 2)**
32. **Purga × `usedG`:** os gramas informados pelo MakerWorld vêm do slicer do autor. Eles provavelmente já incluem a purga de troca de cor e a torre de purga. Se incluírem, aplicar o "% purga/perda" da fórmula por cima conta a purga duas vezes. É preciso decidir se o % purga vale só para a entrada manual.
33. **Fixture no git:** o JSON salvo do MakerWorld é de um modelo de terceiro. Ele pode ser commitado no repositório (privado?) ou deve ser reduzido aos campos usados nos testes?
34. **Termos de uso do MakerWorld:** a API não é pública. Confirmar se o uso pontual (uma chamada por importação feita pelo usuário) é aceitável, e o que fazer se ela passar a exigir login.

## 6. Fora de escopo

- **Impressão por resina** (SLA/DLP/MSLA): materiais, insumos, cálculos e fluxos.
- **Integração direta com a SEFAZ.** A emissão fiscal é só por API de terceiros.
- **Integrações sem adaptador.** Qualquer integração externa entra por uma interface isolada.
- **Upload e armazenamento de STL/3MF no catálogo.** O produto aponta para a URL do modelo no Printables, no MakerWorld ou no Thingiverse.
- **Leitura de arquivos G-code/3MF.** Eles podem passar de 200 MB. Os dados de impressão vêm da URL do MakerWorld (Fase 2) ou do preenchimento manual.
- **Não descritos no CONTEXT e não planejados:** deploy/infra de produção, app mobile, multiempresa. Veja a questão 2.

## 7. Como executar

**Regras**
- Implementar **uma fase por vez, na ordem**.
- Ao concluir, marcar as tarefas como `- [x]` e atualizar o status na tabela-resumo (⬜ → 🟨 → ✅).
- Só avançar para a próxima fase quando **todos os critérios de aceite** da atual forem atendidos.
- Se surgir algo novo durante a implementação (requisito, risco, decisão), **registrar no ROADMAP.md** (em "Questões em aberto" ou na fase certa) em vez de mudar o escopo silenciosamente.

**Definição de pronto (vale para todas as fases, conforme o `AGENTS.md`)**
- `lint`, `test` e `build` passam nas pastas alteradas (e `test:e2e` na API quando houver rota nova)
- Há testes novos para todo comportamento alterado
- Toda entrada externa é validada, e os erros saem como `{ "error": "mensagem" }`
- Mudanças de contrato na API vêm com a atualização do `web/` na mesma mudança
- Variáveis de ambiente novas estão no `.env.example`
- As telas alteradas foram validadas com o Playwright MCP no app rodando, incluindo os estados de carregamento, erro e vazio
- Commit e push só quando o usuário pedir
