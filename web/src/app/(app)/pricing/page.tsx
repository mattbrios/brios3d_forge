"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { type ImportedFilament, PrintProfileImport } from "@/components/print-profile-import";
import { ApiError, apiFetch } from "@/lib/api";
import type { Material, MaterialsPage } from "@/lib/materials";
import type { Printer, PrintersPage } from "@/lib/printers";
import type { QuotePreviewRequest, QuotePreviewResult } from "@/lib/pricing";
import type { SalesChannel } from "@/lib/sales-channels";
import type { StockItem, StockItemsPage } from "@/lib/stock-items";
import {
  Boxes,
  Calculator,
  Clock,
  Layers,
  Plus,
  Printer as PrinterIcon,
  Receipt,
  Store,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, Loading, PageError } from "@/components/ui/feedback";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { formatCents } from "@/lib/format";

interface Registries {
  materials: Material[];
  printers: Printer[];
  stockItems: StockItem[];
  channels: SalesChannel[];
}

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; registries: Registries };

interface MaterialLine {
  key: number;
  materialId: string;
  grams: string;
}

interface SupplyLine {
  key: number;
  stockItemId: string;
  quantity: string;
}

type CalcStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; result: QuotePreviewResult };

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

function materialLabel(material: Material): string {
  return `${material.type} · ${material.brand} · ${material.color}`;
}

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

export default function PricingPage() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  const [printerId, setPrinterId] = useState("");
  const [materialLines, setMaterialLines] = useState<MaterialLine[]>([]);
  const [supplyLines, setSupplyLines] = useState<SupplyLine[]>([]);
  const [printHours, setPrintHours] = useState("");
  const [prepHours, setPrepHours] = useState("");
  const [slicingHours, setSlicingHours] = useState("");
  const [postProcessingHours, setPostProcessingHours] = useState("");
  const [laborCentsPerHour, setLaborCentsPerHour] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [channelIds, setChannelIds] = useState<string[]>([]);

  const [calc, setCalc] = useState<CalcStatus>({ kind: "idle" });

  const nextMaterialKey = useRef(0);
  const nextSupplyKey = useRef(0);
  const importedKeys = useRef<Set<number>>(new Set());

  useEffect(() => {
    let active = true;
    // Mesmo padrão de fetch-em-efeito das telas anteriores (volta para "loading" ao refazer a
    // busca por retry).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus({ kind: "loading" });
    Promise.all([
      apiFetch<MaterialsPage>("/materials?pageSize=100"),
      apiFetch<PrintersPage>("/printers?pageSize=100"),
      apiFetch<StockItemsPage>("/inventory/items?pageSize=100"),
      apiFetch<SalesChannel[]>("/sales-channels"),
    ])
      .then(([materialsPage, printersPage, itemsPage, channels]) => {
        if (!active) return;
        setStatus({
          kind: "ready",
          registries: {
            materials: materialsPage.items.filter((material) => material.active),
            printers: printersPage.items.filter((printer) => printer.active),
            stockItems: itemsPage.items.filter((item) => item.active),
            channels: channels.filter((channel) => channel.active),
          },
        });
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  function retry() {
    setAttempt((current) => current + 1);
  }

  // Fase 12 (AC 8): o import da URL preenche o tempo de impressão e adiciona uma linha de
  // material por filamento (sem mapear automaticamente para um Material cadastrado - AC 8/9,
  // fora de escopo a correspondência automática).
  function handleFilamentsChange(filaments: ImportedFilament[], importedPrintHours: number | null) {
    if (importedPrintHours !== null) {
      setPrintHours(String(importedPrintHours));
    }
    setMaterialLines((current) => {
      const withoutStaleImports = current.filter((line) => !importedKeys.current.has(line.key));
      const imported = filaments.map((filament) => {
        const key = nextMaterialKey.current++;
        importedKeys.current.add(key);
        return { key, materialId: "", grams: filament.grams === null ? "" : String(filament.grams) };
      });
      return [...withoutStaleImports, ...imported];
    });
  }

  function addMaterialLine() {
    setMaterialLines((current) => [...current, { key: nextMaterialKey.current++, materialId: "", grams: "" }]);
  }

  function removeMaterialLine(key: number) {
    importedKeys.current.delete(key);
    setMaterialLines((current) => current.filter((line) => line.key !== key));
  }

  function updateMaterialLine(key: number, field: "materialId" | "grams", value: string) {
    setMaterialLines((current) => current.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
  }

  function addSupplyLine() {
    setSupplyLines((current) => [...current, { key: nextSupplyKey.current++, stockItemId: "", quantity: "" }]);
  }

  function removeSupplyLine(key: number) {
    setSupplyLines((current) => current.filter((line) => line.key !== key));
  }

  function updateSupplyLine(key: number, field: "stockItemId" | "quantity", value: string) {
    setSupplyLines((current) => current.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
  }

  function toggleChannel(channelId: string, checked: boolean) {
    setChannelIds((current) =>
      checked ? [...current, channelId] : current.filter((id) => id !== channelId),
    );
  }

  async function submitCalculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCalc({ kind: "loading" });
    try {
      const body: QuotePreviewRequest = {
        printerId,
        materials: materialLines
          .filter((line) => line.materialId !== "")
          .map((line) => ({ materialId: line.materialId, grams: Number(line.grams) })),
        supplies: supplyLines
          .filter((line) => line.stockItemId !== "")
          .map((line) => ({ stockItemId: line.stockItemId, quantity: Number(line.quantity) })),
        printHours: Number(printHours),
        labor: {
          prepHours: Number(prepHours || 0),
          slicingHours: Number(slicingHours || 0),
          postProcessingHours: Number(postProcessingHours || 0),
          centsPerHour: Number(laborCentsPerHour || 0),
        },
        quantity: Number(quantity),
        channelIds,
      };
      const result = await apiFetch<QuotePreviewResult>("/pricing/quote-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setCalc({ kind: "done", result });
    } catch (error) {
      setCalc({ kind: "error", message: messageOf(error) });
    }
  }

  if (status.kind === "loading") {
    return <Loading />;
  }

  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={retry} />;
  }

  const { registries } = status;
  const calculating = calc.kind === "loading";
  const grid = { gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))", gap: "var(--layout-gutter)" };

  return (
    <>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="bf-section-title">Importar do MakerWorld (opcional)</h2>
          <p className="bf-muted" style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 500 }}>
            Preenche horas e linhas de material
          </p>
        </div>
        <PrintProfileImport onFilamentsChange={handleFilamentsChange} />
      </div>

      <form onSubmit={submitCalculate} className="flex flex-col" style={{ gap: "var(--layout-gutter)" }}>
        <div className="grid items-start" style={grid}>
          <Card title="Impressão" icon={PrinterIcon}>
            <div className="bf-form-grid">
              <Field label="Impressora cadastrada" style={{ gridColumn: "1 / -1" }}>
                {registries.printers.length === 0 ? (
                  <p className="bf-muted" style={{ margin: 0 }}>
                    Nenhuma impressora cadastrada. Cadastre uma impressora antes de calcular.
                  </p>
                ) : (
                  <Select value={printerId} onChange={(event) => setPrinterId(event.target.value)} required>
                    <option value="">Selecione…</option>
                    {registries.printers.map((printer) => (
                      <option key={printer.id} value={printer.id}>
                        {printer.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Horas de impressão">
                <Input
                  inputMode="decimal"
                  value={printHours}
                  onChange={(event) => setPrintHours(event.target.value)}
                  required
                />
              </Field>
              <Field label="Quantidade">
                <Input inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
              </Field>
            </div>
          </Card>

          <Card title="Mão de obra" icon={Clock}>
            <div className="bf-form-grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,140px),1fr))" }}>
              <Field label="Preparo (h)">
                <Input inputMode="decimal" value={prepHours} onChange={(event) => setPrepHours(event.target.value)} />
              </Field>
              <Field label="Fatiamento (h)">
                <Input
                  inputMode="decimal"
                  value={slicingHours}
                  onChange={(event) => setSlicingHours(event.target.value)}
                />
              </Field>
              <Field label="Pós-processamento (h)">
                <Input
                  inputMode="decimal"
                  value={postProcessingHours}
                  onChange={(event) => setPostProcessingHours(event.target.value)}
                />
              </Field>
              <Field label="Custo da hora de mão de obra (centavos)" style={{ gridColumn: "1 / -1" }}>
                <Input
                  inputMode="decimal"
                  value={laborCentsPerHour}
                  onChange={(event) => setLaborCentsPerHour(event.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card
            title="Materiais"
            icon={Layers}
            action={
              registries.materials.length > 0 && (
                <Button size="sm" variant="secondary" icon={Plus} onClick={addMaterialLine}>
                  Adicionar material
                </Button>
              )
            }
          >
            {registries.materials.length === 0 ? (
              <p className="bf-muted" style={{ margin: 0 }}>
                Nenhum material cadastrado. Cadastre um material antes de calcular.
              </p>
            ) : (
              materialLines.map((line, index) => (
                <div key={line.key} className="flex flex-wrap items-end gap-2">
                  <Field label={`Material ${index + 1}`} style={{ flex: "1 1 200px" }}>
                    <Select
                      value={line.materialId}
                      onChange={(event) => updateMaterialLine(line.key, "materialId", event.target.value)}
                    >
                      <option value="">Selecione…</option>
                      {registries.materials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {materialLabel(material)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Gramas" style={{ width: 110 }}>
                    <Input
                      inputMode="decimal"
                      value={line.grams}
                      onChange={(event) => updateMaterialLine(line.key, "grams", event.target.value)}
                    />
                  </Field>
                  <IconButton
                    icon={Trash2}
                    label="Remover"
                    variant="outline"
                    onClick={() => removeMaterialLine(line.key)}
                  />
                </div>
              ))
            )}
          </Card>

          <Card
            title="Insumos (opcional)"
            icon={Boxes}
            action={
              registries.stockItems.length > 0 && (
                <Button size="sm" variant="secondary" icon={Plus} onClick={addSupplyLine}>
                  Adicionar insumo
                </Button>
              )
            }
          >
            {registries.stockItems.length === 0 ? (
              <p className="bf-muted" style={{ margin: 0 }}>
                Nenhum insumo cadastrado.
              </p>
            ) : (
              supplyLines.map((line, index) => (
                <div key={line.key} className="flex flex-wrap items-end gap-2">
                  <Field label={`Insumo ${index + 1}`} style={{ flex: "1 1 200px" }}>
                    <Select
                      value={line.stockItemId}
                      onChange={(event) => updateSupplyLine(line.key, "stockItemId", event.target.value)}
                    >
                      <option value="">Selecione…</option>
                      {registries.stockItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Quantidade" style={{ width: 110 }}>
                    <Input
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(event) => updateSupplyLine(line.key, "quantity", event.target.value)}
                    />
                  </Field>
                  <IconButton
                    icon={Trash2}
                    label="Remover"
                    variant="outline"
                    onClick={() => removeSupplyLine(line.key)}
                  />
                </div>
              ))
            )}
          </Card>
        </div>

        <Card title="Canais" icon={Store}>
          <fieldset className="flex flex-wrap gap-x-6 gap-y-3" style={{ margin: 0, padding: 0, border: 0 }}>
            <legend className="bf-sr">Canais</legend>
            {registries.channels.length === 0 ? (
              <p className="bf-muted" style={{ margin: 0 }}>
                Nenhum canal de venda cadastrado. Cadastre um canal antes de calcular.
              </p>
            ) : (
              registries.channels.map((channel) => (
                <Checkbox
                  key={channel.id}
                  label={channel.name}
                  checked={channelIds.includes(channel.id)}
                  onChange={(event) => toggleChannel(channel.id, event.target.checked)}
                />
              ))
            )}
          </fieldset>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {calculating && (
            <span role="status" className="bf-loading">
              Calculando…
            </span>
          )}
          <Button type="submit" variant="accent" size="lg" icon={Calculator} disabled={calculating}>
            Calcular
          </Button>
        </div>
      </form>

      {calc.kind === "error" && (
        <Alert tone="danger" role="alert">
          {calc.message}
        </Alert>
      )}

      {calc.kind === "done" && (
        <Card
          title="Resultado"
          icon={Receipt}
          subtitle={`${calc.result.printer.name} · ${calc.result.quantity} un.`}
        >
          <div className="bf-cost">
            <div className="bf-cost__bar" aria-hidden="true">
              {COST_ROWS.map((row) =>
                calc.result.costs[row.key] > 0 ? (
                  <span key={row.key} style={{ flex: calc.result.costs[row.key], background: row.color }} />
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
                    {formatCents(calc.result.costs[row.key])}
                    <span aria-hidden="true">
                      {calc.result.costs.directCostCents > 0
                        ? `${Math.round((calc.result.costs[row.key] / calc.result.costs.directCostCents) * 100)}%`
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
                  <b>{formatCents(calc.result.costs.directCostCents)}</b>
                </dd>
              </div>
              <div className="is-strong">
                <dt>
                  <span>Custo com risco</span>
                </dt>
                <dd style={{ margin: 0 }}>
                  <b>{formatCents(calc.result.costs.costWithRiskCents)}</b>
                </dd>
              </div>
            </dl>
            <ul className="bf-cost__channels" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {calc.result.channels.map((channel) => (
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
                    {calc.result.quantity > 1 ? `${calc.result.quantity} un. · ` : ""}Total{" "}
                    {formatCents(channel.totalPriceCents)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}
    </>
  );
}
