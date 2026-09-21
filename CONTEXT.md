# CONTEXT — Brios3D Forge

Sistema de gestão para uma empresa de **impressões 3D personalizadas em FDM (filamento)**. Este arquivo reúne o contexto de negócio e as decisões de escopo levantadas até agora.

> **Escopo:** apenas impressão **FDM/filamento**. Impressão por resina (SLA/DLP/MSLA) está **fora do escopo**. Não modelar materiais, insumos, cálculos ou fluxos de resina.

---

## Stack atual

- **API (`api/`):** NestJS (TypeScript), testes com Vitest, lint com oxlint, porta `3001`
- **Web (`web/`):** Next.js (App Router, TypeScript), porta `3000`, consome `NEXT_PUBLIC_API_URL`
- **Banco:** PostgreSQL 17
- **Infra local:** `docker-compose.yml` (serviços `db`, `api`, `web`), variáveis em `.env` (ver `.env.example`)
- **Estado:** apenas o scaffold, sem módulos de domínio implementados

---

## Módulos do sistema

### 1. Cadastros base (fundação)
- **Materiais:** tipo (PLA, PETG, ABS, ASA, TPU, Nylon…), marca, cor, densidade (g/cm³), temperaturas, necessidade de secagem
- **Impressoras:** modelo, custo de aquisição, vida útil estimada (horas), potência média (W), horímetro, bicos instalados, AMS/multicor
- **Clientes e fornecedores**
- **Configurações globais:** tarifa de energia (R$/kWh), valor da hora de trabalho, margem padrão, % de falha, % de purga/perda, impostos e taxas por canal de venda

### 2. Estoque
Tipos de item:

| Tipo | Exemplos | Particularidade |
|---|---|---|
| **Filamentos** | rolos de 1 kg, 250 g, 3 kg | Controle **por rolo**, não só por SKU |
| **Insumos e componentes** | ímãs, insertos roscados, parafusos, tinta, primer, cola, lixa, embalagem | Controle por unidade ou quantidade |
| **Peças de reposição** | bicos, placas PEI, correias, tubo PTFE, hotend | Ligadas ao módulo de manutenção |
| **Produtos acabados** | peças de catálogo prontas | Estoque de pronta-entrega |

Funcionalidades:
- **Rastreio por rolo:** peso inicial, peso restante, **tara do carretel** (ajuste de saldo pesando na balança), lote, data de abertura, última secagem, localização. Etiqueta com QR code no rolo.
- **Baixa automática** ao concluir a impressão, usando os gramas do G-code, **mais** baixa por falha ou descarte
- **Custo médio ponderado** por material
- **Estoque mínimo com alertas**
- **Histórico de movimentações:** entrada, consumo, perda, ajuste de inventário

### 3. Compras
- Pedido de compra → recebimento → entrada no estoque, com custo real (produto, frete e impostos rateados)
- Histórico de preço por fornecedor

### 4. Calculadora de preço e orçamentos (diferencial)

```
Custo material   = Σ(gramas por material × custo/g) × (1 + % purga/perda)
Custo energia    = (potência W / 1000) × horas de impressão × tarifa kWh
Depreciação      = (custo impressora / vida útil em horas) × horas de impressão
Manutenção       = R$/hora de máquina × horas  (bicos, PEI, correias)
Mão de obra      = (preparo + fatiamento + pós-processamento em horas) × R$/hora
Insumos          = Σ itens extras (ímãs, tinta, embalagem…)
Custos fixos     = (aluguel + software + internet…) / horas produtivas no mês × horas

Custo direto     = soma de tudo acima
Custo c/ risco   = Custo direto × (1 + % taxa de falha)

Preço de venda   = Custo c/ risco / (1 − % margem − % impostos − % taxa do canal)
```

Regras e requisitos:
- **Usar markup divisor, não multiplicador.** Imposto e taxa de marketplace incidem sobre o preço final.
- **Importar arquivo fatiado** (G-code/3MF do Bambu Studio, OrcaSlicer ou PrusaSlicer). Tempo estimado e gramas por filamento vêm dos comentários/metadados. Suportar multicor (AMS), com peso separado por cor ou material.
- **Preço por canal:** balcão, Mercado Livre, Shopee etc. têm taxas diferentes
- **Desconto por quantidade:** o preparo e o fatiamento se diluem em lotes
- **Preço mínimo** por pedido
- **Orçamento em PDF ou link** com validade, que vira pedido quando aprovado
- Retornar o **custo detalhado por componente**, não só o total

### 5. Catálogo de produtos
- Produto com variações (cor, tamanho) e **ficha técnica** (materiais, gramas, tempo, insumos). O custo é recalculado quando o preço do filamento muda.
- **Sem upload de arquivos de modelo:** o catálogo não armazena STL nem 3MF. Cada produto aponta para a **URL do modelo** no Printables, no MakerWorld ou no Thingiverse. URLs de outros domínios são rejeitadas.
- **Metadados pela URL:** o sistema busca os metadados da página do modelo para exibir a **imagem**, o **título** e a **licença** do produto. Os dados ficam gravados no produto (não são buscados a cada exibição) e podem ser atualizados sob demanda ou corrigidos manualmente quando a busca falhar.
- **Licença do modelo:** muitos modelos proíbem uso comercial. O sistema deve deixar isso visível no produto.

### 6. Pedidos e produção
- Fluxo em kanban: **Orçamento → Aprovado → Na fila → Imprimindo → Pós-processamento → Controle de qualidade → Pronto → Entregue**
- **Fila de impressão por impressora**, com alocação de trabalhos e previsão de conclusão
- Um pedido pode gerar **vários trabalhos de impressão** (várias placas)
- **Registro de falhas:** motivo (warping, entupimento, descolamento, falta de energia, spaghetti…), material perdido, reimpressão. Esses dados alimentam a % de falha real da calculadora.
- Arquivos personalizados do cliente (nome gravado, litofania, logo)

### 7. Impressoras e manutenção
- Horímetro atualizado automaticamente pelos trabalhos concluídos
- Manutenção preventiva por horas (lubrificação, troca de bico, correias, limpeza) com alertas
- Taxa de utilização e de falha por máquina
- *Futuro:* integração com Moonraker/Klipper, OctoPrint ou Bambu (MQTT) para status em tempo real

### 8. Vendas e canais
- Registro de vendas por canal: balcão, Instagram/WhatsApp, Mercado Livre, Shopee, loja própria
- *Futuro:* integração via API com marketplaces para importar pedidos

### 9. Financeiro
- Contas a pagar e a receber, fluxo de caixa
- **Margem real por pedido** (preço de venda menos custo real, incluindo falhas)
- DRE simplificada mensal

### 10. Fiscal
- Emissão de NF-e/NFS-e por API de terceiros (Focus NFe, NFE.io, eNotas). Não integrar direto com a SEFAZ.
- O enquadramento (produto ou serviço sob encomenda, CNAE, anexo do Simples) define o imposto usado na calculadora. Confirmar com o contador.

### 11. Relatórios e dashboard
- Faturamento, lucro e margem por período, produto e canal
- Consumo de filamento por material e cor, e projeção de compra
- Horas de máquina, ocupação, taxa de falha
- Produtos mais vendidos e mais lucrativos

### 12. Usuários e permissões
- Autenticação e papéis: administrador, operador de produção, vendas
- Log de auditoria das movimentações de estoque

---

## Roadmap

| Fase | Módulos | Resultado |
|---|---|---|
| **MVP** | Auth, Cadastros, Estoque (rolos e insumos), Calculadora | Precifica corretamente e controla filamento |
| **Fase 2** | Catálogo com ficha técnica, Orçamentos, Pedidos e produção, importação de G-code/3MF | Operação diária no sistema |
| **Fase 3** | Compras, Financeiro, Manutenção, Dashboard | Visão de lucro real |
| **Fase 4** | Fiscal, integrações com marketplaces e impressoras | Automação |

---

## Estrutura planejada da API

```
api/src/modules/
  auth/  users/  settings/
  materials/  printers/  customers/  suppliers/
  inventory/        # itens, rolos, movimentações
  purchasing/
  products/         # catálogo + ficha técnica
  pricing/          # serviço puro de cálculo
  quotes/  orders/  production/   # jobs de impressão, falhas
  maintenance/  finance/  reports/
```

## Decisões de arquitetura

- **`pricing` é um serviço puro e sem estado:** recebe parâmetros e devolve o custo detalhado. Orçamentos, catálogo e relatórios de margem reutilizam o mesmo cálculo. Deve ter boa cobertura de testes (Vitest).
- **Estoque de filamento é rastreado por rolo individual**, com o saldo em gramas e a tara do carretel
- **Custo de material usa custo médio ponderado**
- **A % de falha usada na calculadora deve vir dos dados reais** de falhas registradas na produção (inicialmente, um valor configurável)
- **Integrações externas (NF, marketplaces, impressoras) ficam para o fim** e entram por adaptadores
