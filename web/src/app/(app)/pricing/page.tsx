"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { type ImportedFilament, PrintProfileImport } from "@/components/print-profile-import";
import { ApiError, apiFetch } from "@/lib/api";
import type { Material, MaterialsPage } from "@/lib/materials";
import type { Printer, PrintersPage } from "@/lib/printers";
import type { QuotePreviewRequest, QuotePreviewResult } from "@/lib/pricing";
import type { SalesChannel } from "@/lib/sales-channels";
import type { StockItem, StockItemsPage } from "@/lib/stock-items";

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

const INPUT_CLASS = "rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900";

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

function materialLabel(material: Material): string {
  return `${material.type} · ${material.brand} · ${material.color}`;
}

function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2)}`;
}

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
    return <p>Carregando…</p>;
  }

  if (status.kind === "error") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert">{status.message}</p>
        <button
          type="button"
          onClick={retry}
          className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const { registries } = status;
  const calculating = calc.kind === "loading";

  return (
    <section className="flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Calculadora</h1>

      <div className="flex flex-col gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Importar do MakerWorld (opcional)</h2>
        <PrintProfileImport onFilamentsChange={handleFilamentsChange} />
      </div>

      <form onSubmit={submitCalculate} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Impressora cadastrada
          {registries.printers.length === 0 ? (
            <p>Nenhuma impressora cadastrada. Cadastre uma impressora antes de calcular.</p>
          ) : (
            <select
              value={printerId}
              onChange={(event) => setPrinterId(event.target.value)}
              className={INPUT_CLASS}
              required
            >
              <option value="">Selecione…</option>
              {registries.printers.map((printer) => (
                <option key={printer.id} value={printer.id}>
                  {printer.name}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Horas de impressão
          <input
            inputMode="decimal"
            value={printHours}
            onChange={(event) => setPrintHours(event.target.value)}
            className={`${INPUT_CLASS} w-32`}
            required
          />
        </label>

        <div className="flex flex-col gap-2">
          <h2 className="font-medium">Materiais</h2>
          {registries.materials.length === 0 ? (
            <p>Nenhum material cadastrado. Cadastre um material antes de calcular.</p>
          ) : (
            <>
              {materialLines.map((line, index) => (
                <div key={line.key} className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-sm">
                    {`Material ${index + 1}`}
                    <select
                      value={line.materialId}
                      onChange={(event) => updateMaterialLine(line.key, "materialId", event.target.value)}
                      className={INPUT_CLASS}
                    >
                      <option value="">Selecione…</option>
                      {registries.materials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {materialLabel(material)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Gramas
                    <input
                      inputMode="decimal"
                      value={line.grams}
                      onChange={(event) => updateMaterialLine(line.key, "grams", event.target.value)}
                      className={`${INPUT_CLASS} w-24`}
                    />
                  </label>
                  <button type="button" onClick={() => removeMaterialLine(line.key)}>
                    Remover
                  </button>
                </div>
              ))}
              <button type="button" onClick={addMaterialLine} className="self-start">
                Adicionar material
              </button>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="font-medium">Insumos (opcional)</h2>
          {registries.stockItems.length === 0 ? (
            <p>Nenhum insumo cadastrado.</p>
          ) : (
            <>
              {supplyLines.map((line, index) => (
                <div key={line.key} className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-sm">
                    {`Insumo ${index + 1}`}
                    <select
                      value={line.stockItemId}
                      onChange={(event) => updateSupplyLine(line.key, "stockItemId", event.target.value)}
                      className={INPUT_CLASS}
                    >
                      <option value="">Selecione…</option>
                      {registries.stockItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Quantidade
                    <input
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(event) => updateSupplyLine(line.key, "quantity", event.target.value)}
                      className={`${INPUT_CLASS} w-24`}
                    />
                  </label>
                  <button type="button" onClick={() => removeSupplyLine(line.key)}>
                    Remover
                  </button>
                </div>
              ))}
              <button type="button" onClick={addSupplyLine} className="self-start">
                Adicionar insumo
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Preparo (h)
            <input
              inputMode="decimal"
              value={prepHours}
              onChange={(event) => setPrepHours(event.target.value)}
              className={`${INPUT_CLASS} w-24`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Fatiamento (h)
            <input
              inputMode="decimal"
              value={slicingHours}
              onChange={(event) => setSlicingHours(event.target.value)}
              className={`${INPUT_CLASS} w-24`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Pós-processamento (h)
            <input
              inputMode="decimal"
              value={postProcessingHours}
              onChange={(event) => setPostProcessingHours(event.target.value)}
              className={`${INPUT_CLASS} w-24`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Custo da hora de mão de obra (centavos)
            <input
              inputMode="decimal"
              value={laborCentsPerHour}
              onChange={(event) => setLaborCentsPerHour(event.target.value)}
              className={`${INPUT_CLASS} w-32`}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Quantidade
            <input
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className={`${INPUT_CLASS} w-20`}
              required
            />
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">Canais</legend>
          {registries.channels.length === 0 ? (
            <p>Nenhum canal de venda cadastrado. Cadastre um canal antes de calcular.</p>
          ) : (
            registries.channels.map((channel) => (
              <label key={channel.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={channelIds.includes(channel.id)}
                  onChange={(event) => toggleChannel(channel.id, event.target.checked)}
                />
                {channel.name}
              </label>
            ))
          )}
        </fieldset>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={calculating}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Calcular
          </button>
          {calculating && <span role="status">Calculando…</span>}
        </div>
      </form>

      {calc.kind === "error" && <p role="alert">{calc.message}</p>}

      {calc.kind === "done" && (
        <div className="flex flex-col gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Resultado</h2>
          <dl className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-3">
            <dt>Material</dt>
            <dd>{formatCents(calc.result.costs.materialCents)}</dd>
            <dt>Energia</dt>
            <dd>{formatCents(calc.result.costs.energyCents)}</dd>
            <dt>Depreciação</dt>
            <dd>{formatCents(calc.result.costs.depreciationCents)}</dd>
            <dt>Manutenção</dt>
            <dd>{formatCents(calc.result.costs.maintenanceCents)}</dd>
            <dt>Mão de obra</dt>
            <dd>{formatCents(calc.result.costs.laborCents)}</dd>
            <dt>Insumos</dt>
            <dd>{formatCents(calc.result.costs.suppliesCents)}</dd>
            <dt>Custos fixos</dt>
            <dd>{formatCents(calc.result.costs.fixedCostsCents)}</dd>
            <dt>Custo direto</dt>
            <dd>{formatCents(calc.result.costs.directCostCents)}</dd>
            <dt>Custo com risco</dt>
            <dd>{formatCents(calc.result.costs.costWithRiskCents)}</dd>
          </dl>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th>Canal</th>
                <th>Preço unitário</th>
                <th>Preço total</th>
              </tr>
            </thead>
            <tbody>
              {calc.result.channels.map((channel) => (
                <tr key={channel.id}>
                  <td>{channel.name}</td>
                  <td>
                    {formatCents(channel.unitPriceCents)}
                    {channel.minimumPriceApplied ? " (mínimo aplicado)" : ""}
                  </td>
                  <td>{formatCents(channel.totalPriceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
