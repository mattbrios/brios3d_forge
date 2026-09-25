import type { QuotePreviewResult } from "@/lib/pricing";
import { formatCents } from "@/lib/format";
import { Badge } from "./ui/badge";

// Parcelas do custo direto, na ordem e nas cores do resultado (CostBreakdown do Design System).
const COST_ROWS: { key: keyof QuotePreviewResult["costs"]; label: string; color: string }[] = [
  { key: "materialCents", label: "Material", color: "var(--cost-1)" },
  { key: "energyCents", label: "Energia", color: "var(--cost-2)" },
  { key: "depreciationCents", label: "Depreciação", color: "var(--cost-3)" },
  { key: "maintenanceCents", label: "Manutenção", color: "var(--cost-4)" },
  { key: "laborCents", label: "Mão de obra", color: "var(--cost-5)" },
  { key: "suppliesCents", label: "Insumos", color: "var(--cost-6)" },
  { key: "fixedCostsCents", label: "Custos fixos", color: "var(--cost-7)" },
];

// Quadro de custo e preço por canal da calculadora (Fase 12), compartilhado com o detalhe do
// produto (Fase 13).
export function CostBreakdown({ result }: { result: QuotePreviewResult }) {
  return (
    <div className="bf-cost">
      <div className="bf-cost__bar" aria-hidden="true">
        {COST_ROWS.map((row) =>
          result.costs[row.key] > 0 ? (
            <span key={row.key} style={{ flex: result.costs[row.key], background: row.color }} />
          ) : null,
        )}
      </div>
      <dl className="bf-cost__list">
        {COST_ROWS.map((row) => (
          <div key={row.key}>
            <dt>
              <i style={{ background: row.color }} />
              {row.label}
            </dt>
            <dd>
              {formatCents(result.costs[row.key])}
              <span aria-hidden="true">
                {result.costs.directCostCents > 0
                  ? `${Math.round((result.costs[row.key] / result.costs.directCostCents) * 100)}%`
                  : ""}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <dl className="bf-cost__totals" style={{ margin: 0 }}>
        <div>
          <dt>
            <span>Custo direto</span>
          </dt>
          <dd style={{ margin: 0 }}>
            <b>{formatCents(result.costs.directCostCents)}</b>
          </dd>
        </div>
        <div className="is-strong">
          <dt>
            <span>Custo com risco</span>
          </dt>
          <dd style={{ margin: 0 }}>
            <b>{formatCents(result.costs.costWithRiskCents)}</b>
          </dd>
        </div>
      </dl>
      <ul className="bf-cost__channels" style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {result.channels.map((channel) => (
          <li key={channel.id} className="bf-cost__channel">
            <div className="bf-cost__channel-name">
              {channel.name}
              {channel.minimumPriceApplied && (
                <Badge tone="warning" size="sm">
                  mínimo aplicado
                </Badge>
              )}
            </div>
            <div className="bf-cost__price">
              {formatCents(channel.unitPriceCents)}
              <small>/un.</small>
            </div>
            <div className="bf-cost__total">
              {result.quantity > 1 ? `${result.quantity} un. · ` : ""}Total {formatCents(channel.totalPriceCents)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
