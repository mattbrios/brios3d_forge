"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Boxes, Clock, Layers, Plus, Trash2 } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import type { Material, MaterialsPage } from "@/lib/materials";
import type { Printer, PrintersPage } from "@/lib/printers";
import type { ModelPlatform, ProductVariant, VariantBody } from "@/lib/products";
import type { StockItem, StockItemsPage } from "@/lib/stock-items";
import { decimalToInput, readNumbers } from "@/lib/number-input";
import { type ImportedFilament, PrintProfileImport } from "./print-profile-import";
import { Button, IconButton } from "./ui/button";
import { Card } from "./ui/card";
import { Alert, Loading, PageError } from "./ui/feedback";
import { Field, Input, Select } from "./ui/form";

interface Registries {
  materials: Material[];
  printers: Printer[];
  stockItems: StockItem[];
}

type Status = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; registries: Registries };

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

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

function materialLabel(material: Material): string {
  const name = `${material.type} · ${material.brand} · ${material.color}`;
  return material.active ? name : `${name} (inativo)`;
}

// Editor da ficha técnica de uma variação (Fase 13). Material, insumo e impressora só vêm do
// cadastro (AC 21); o custo nunca é digitado aqui, é calculado pela API.
export function ProductVariantEditor({
  product,
  variant,
  onSaved,
  onCancel,
}: {
  product: { id: string; modelUrl: string; modelPlatform: ModelPlatform };
  // Sem `variant`, cria uma nova; com ela, edita.
  variant?: ProductVariant;
  onSaved: (variant: ProductVariant) => void;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  // Chaves das linhas da ficha: as iniciais usam o índice, e as novas continuam depois delas.
  const nextKey = useRef(Math.max(variant?.materials.length ?? 0, variant?.supplies.length ?? 0));
  const importedKeys = useRef<Set<number>>(new Set());

  const [name, setName] = useState(variant?.name ?? "");
  const [printerId, setPrinterId] = useState(variant?.printer.id ?? "");
  const [printHours, setPrintHours] = useState(variant ? decimalToInput(variant.printHours) : "");
  const [prepHours, setPrepHours] = useState(variant ? decimalToInput(variant.prepHours) : "");
  const [slicingHours, setSlicingHours] = useState(variant ? decimalToInput(variant.slicingHours) : "");
  const [postProcessingHours, setPostProcessingHours] = useState(variant ? decimalToInput(variant.postProcessingHours) : "");
  const [materialLines, setMaterialLines] = useState<MaterialLine[]>(() =>
    (variant?.materials ?? []).map((line, index) => ({
      key: index,
      materialId: line.materialId,
      grams: decimalToInput(line.grams),
    })),
  );
  const [supplyLines, setSupplyLines] = useState<SupplyLine[]>(() =>
    (variant?.supplies ?? []).map((line, index) => ({
      key: index,
      stockItemId: line.stockItemId,
      quantity: decimalToInput(line.quantity),
    })),
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus({ kind: "loading" });
    Promise.all([
      apiFetch<MaterialsPage>("/materials?pageSize=100"),
      apiFetch<PrintersPage>("/printers?pageSize=100"),
      apiFetch<StockItemsPage>("/inventory/items?pageSize=100"),
    ])
      .then(([materialsPage, printersPage, itemsPage]) => {
        if (!active) return;
        setStatus({
          kind: "ready",
          registries: { materials: materialsPage.items, printers: printersPage.items, stockItems: itemsPage.items },
        });
      })
      .catch((cause: unknown) => {
        if (active) setStatus({ kind: "error", message: messageOf(cause) });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  // AC 19: o perfil importado preenche as horas e uma linha por filamento, com o material vazio
  // para o usuário escolher do cadastro (mesma regra da calculadora, Fase 12).
  function handleFilamentsChange(filaments: ImportedFilament[], importedPrintHours: number | null) {
    if (importedPrintHours !== null) {
      setPrintHours(decimalToInput(Math.round(importedPrintHours * 100) / 100));
    }
    setMaterialLines((current) => {
      const kept = current.filter((line) => !importedKeys.current.has(line.key));
      const imported = filaments.map((filament) => {
        const key = nextKey.current++;
        importedKeys.current.add(key);
        return { key, materialId: "", grams: filament.grams === null ? "" : decimalToInput(filament.grams) };
      });
      return [...kept, ...imported];
    });
  }

  function updateMaterial(key: number, field: "materialId" | "grams", value: string) {
    setMaterialLines((current) => current.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
  }

  function removeMaterial(key: number) {
    importedKeys.current.delete(key);
    setMaterialLines((current) => current.filter((line) => line.key !== key));
  }

  function updateSupply(key: number, field: "stockItemId" | "quantity", value: string) {
    setSupplyLines((current) => current.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const hours = readNumbers({
      printHours: { label: "Horas de impressão", text: printHours, required: true },
      prepHours: { label: "Preparo", text: prepHours },
      slicingHours: { label: "Fatiamento", text: slicingHours },
      postProcessingHours: { label: "Pós-processamento", text: postProcessingHours },
    });
    const lines = readNumbers({
      ...Object.fromEntries(
        materialLines.map((line) => [`m${line.key}`, { label: "Gramas", text: line.grams, required: true }]),
      ),
      ...Object.fromEntries(
        supplyLines.map((line) => [`s${line.key}`, { label: "Quantidade", text: line.quantity, required: true }]),
      ),
    });
    if (!hours.ok) {
      setError(hours.message);
      return;
    }
    if (!lines.ok) {
      setError(lines.message);
      return;
    }
    setSubmitting(true);
    setError(null);
    const body: VariantBody = {
      name,
      printerId,
      printHours: hours.values.printHours,
      prepHours: hours.values.prepHours ?? 0,
      slicingHours: hours.values.slicingHours ?? 0,
      postProcessingHours: hours.values.postProcessingHours ?? 0,
      materials: materialLines.map((line) => ({ materialId: line.materialId, grams: lines.values[`m${line.key}`] ?? 0 })),
      supplies: supplyLines.map((line) => ({ stockItemId: line.stockItemId, quantity: lines.values[`s${line.key}`] ?? 0 })),
    };
    try {
      const saved = await apiFetch<ProductVariant>(
        variant ? `/products/${product.id}/variants/${variant.id}` : `/products/${product.id}/variants`,
        {
          method: variant ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      onSaved(saved);
    } catch (cause) {
      // O formulário fica como está para o usuário corrigir e reenviar.
      setError(messageOf(cause));
    } finally {
      setSubmitting(false);
    }
  }

  if (status.kind === "loading") {
    return <Loading />;
  }

  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={() => setAttempt((current) => current + 1)} />;
  }

  const { registries } = status;

  return (
    <div className="flex flex-col gap-4">
      {product.modelPlatform === "makerworld" && (
        <div className="flex flex-col gap-2">
          <h3 className="bf-section-title">Importar perfil do MakerWorld (opcional)</h3>
          <PrintProfileImport initialUrl={product.modelUrl} onFilamentsChange={handleFilamentsChange} />
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4" aria-label="Ficha técnica">
        <Card title="Ficha técnica" icon={Clock}>
          <div className="bf-form-grid">
            <Field label="Nome da variação">
              <Input value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Impressora de referência">
              <Select value={printerId} onChange={(event) => setPrinterId(event.target.value)} required>
                <option value="">Selecione…</option>
                {registries.printers.map((printer) => (
                  <option key={printer.id} value={printer.id}>
                    {printer.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Horas de impressão">
              <Input inputMode="decimal" value={printHours} onChange={(event) => setPrintHours(event.target.value)} required />
            </Field>
            <Field label="Preparo (h)">
              <Input inputMode="decimal" value={prepHours} onChange={(event) => setPrepHours(event.target.value)} />
            </Field>
            <Field label="Fatiamento (h)">
              <Input inputMode="decimal" value={slicingHours} onChange={(event) => setSlicingHours(event.target.value)} />
            </Field>
            <Field label="Pós-processamento (h)">
              <Input
                inputMode="decimal"
                value={postProcessingHours}
                onChange={(event) => setPostProcessingHours(event.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card
          title="Materiais"
          icon={Layers}
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={Plus}
              onClick={() =>
                setMaterialLines((current) => [...current, { key: nextKey.current++, materialId: "", grams: "" }])
              }
            >
              Adicionar material
            </Button>
          }
        >
          {materialLines.map((line, index) => (
            <div key={line.key} className="flex flex-wrap items-end gap-2">
              <Field label={`Material ${index + 1}`} style={{ flex: "1 1 200px" }}>
                <Select value={line.materialId} onChange={(event) => updateMaterial(line.key, "materialId", event.target.value)}>
                  <option value="">Selecione…</option>
                  {registries.materials.map((material) => (
                    <option key={material.id} value={material.id}>
                      {materialLabel(material)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={`Gramas do material ${index + 1}`} style={{ width: 150 }}>
                <Input inputMode="decimal" value={line.grams} onChange={(event) => updateMaterial(line.key, "grams", event.target.value)} />
              </Field>
              <IconButton icon={Trash2} label={`Remover material ${index + 1}`} variant="outline" onClick={() => removeMaterial(line.key)} />
            </div>
          ))}
        </Card>

        <Card
          title="Insumos (opcional)"
          icon={Boxes}
          action={
            <Button
              size="sm"
              variant="secondary"
              icon={Plus}
              onClick={() =>
                setSupplyLines((current) => [...current, { key: nextKey.current++, stockItemId: "", quantity: "" }])
              }
            >
              Adicionar insumo
            </Button>
          }
        >
          {supplyLines.map((line, index) => (
            <div key={line.key} className="flex flex-wrap items-end gap-2">
              <Field label={`Insumo ${index + 1}`} style={{ flex: "1 1 200px" }}>
                <Select value={line.stockItemId} onChange={(event) => updateSupply(line.key, "stockItemId", event.target.value)}>
                  <option value="">Selecione…</option>
                  {registries.stockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.active ? item.name : `${item.name} (inativo)`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={`Quantidade do insumo ${index + 1}`} style={{ width: 170 }}>
                <Input inputMode="decimal" value={line.quantity} onChange={(event) => updateSupply(line.key, "quantity", event.target.value)} />
              </Field>
              <IconButton
                icon={Trash2}
                label={`Remover insumo ${index + 1}`}
                variant="outline"
                onClick={() => setSupplyLines((current) => current.filter((item) => item.key !== line.key))}
              />
            </div>
          ))}
        </Card>

        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? "Salvando…" : "Salvar variação"}
          </Button>
        </div>
      </form>
    </div>
  );
}
