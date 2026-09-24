"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { FilamentRoll } from "@/lib/inventory";
import type { Material, MaterialsPage } from "@/lib/materials";

// Door 3: a etiqueta é física e sobrevive a qualquer refactor, então o QR carrega a rota que já
// existe com o uuid do rolo - nada de um segundo identificador.
const LABEL_WIDTH = "70mm";
const LABEL_HEIGHT = "40mm";
const QR_SIDE = "30mm";
// Nível M (~15% de correção) e quiet zone de 4 módulos: o mínimo que a especificação pede para um
// código lido de papel arranhado na prateleira.
const QR_LEVEL = "M";
const QR_MARGIN_MODULES = 4;

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; roll: FilamentRoll; materials: Material[] };

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

function materialLabel(materials: Material[], materialId: string): string {
  const material = materials.find((candidate) => candidate.id === materialId);
  return material ? `${material.type} · ${material.brand} · ${material.color}` : materialId;
}

// `params` é uma Promise nesta versão do Next.js (breaking change): resolvida num efeito, como na
// página do rolo.
export default function RollLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    params.then((resolved) => {
      if (active) setId(resolved.id);
    });
    return () => {
      active = false;
    };
  }, [params]);

  if (id === null) {
    return <p>Carregando…</p>;
  }
  return <RollLabelContent id={id} />;
}

function RollLabelContent({ id }: { id: string }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<FilamentRoll>(`/inventory/rolls/${id}`),
      apiFetch<MaterialsPage>("/materials?pageSize=100"),
    ])
      .then(([roll, materials]) => {
        if (active) setStatus({ kind: "ready", roll, materials: materials.items });
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (status.kind === "loading") {
    return <p>Carregando…</p>;
  }

  // Rolo inexistente não rende meia etiqueta: nenhum QR é gerado.
  if (status.kind === "error") {
    return <p role="alert">{status.message}</p>;
  }

  const { roll, materials } = status;
  // A origem só existe no navegador (door 2): a API não sabe por qual host o web é acessado.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const qrValue = `${origin}/inventory/${roll.id}`;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold print:hidden">Etiqueta do rolo</h1>
      <div className="flex gap-2 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
        >
          Imprimir
        </button>
      </div>

      {/* Bloco de 70 × 40 mm, sem @page size fixo: o usuário escolhe A4 ou térmica no diálogo de
          impressão do navegador. */}
      <div
        data-testid="roll-label"
        style={{ width: LABEL_WIDTH, height: LABEL_HEIGHT }}
        className="flex items-center gap-2 overflow-hidden border border-zinc-400 bg-white p-2 text-black"
      >
        <QRCodeSVG
          value={qrValue}
          level={QR_LEVEL}
          marginSize={QR_MARGIN_MODULES}
          style={{ width: QR_SIDE, height: QR_SIDE }}
        />
        <dl className="flex flex-col gap-0.5 text-[7pt] leading-tight">
          <div>
            <dt className="sr-only">Material</dt>
            <dd className="font-semibold">{materialLabel(materials, roll.materialId)}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Peso</dt>
            <dd>{roll.nominalWeightGrams} g</dd>
          </div>
          <div className="flex gap-1">
            <dt>Lote</dt>
            <dd>{roll.batch ?? "—"}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Compra</dt>
            <dd>{roll.purchaseDate ?? "—"}</dd>
          </div>
          <div className="flex gap-1">
            <dt>Id</dt>
            <dd>{roll.id.slice(0, 8)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
