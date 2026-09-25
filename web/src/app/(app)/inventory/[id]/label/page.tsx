"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { FilamentRoll } from "@/lib/inventory";
import type { Material, MaterialsPage } from "@/lib/materials";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Loading } from "@/components/ui/feedback";

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
    return <Loading />;
  }

  // Rolo inexistente não rende meia etiqueta: nenhum QR é gerado.
  if (status.kind === "error") {
    return (
      <Alert tone="danger" role="alert">
        {status.message}
      </Alert>
    );
  }

  const { roll, materials } = status;
  // A origem só existe no navegador (door 2): a API não sabe por qual host o web é acessado.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const qrValue = `${origin}/inventory/${roll.id}`;

  return (
    <section className="bf-card flex flex-col gap-4 print:p-0 print:shadow-none">
      <nav aria-label="Trilha" className="bf-breadcrumb print:hidden">
        <Link href="/inventory">Filamento</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/inventory/${roll.id}`} className="bf-mono">
          {roll.id.slice(0, 8)}
        </Link>
        <span aria-hidden="true">/</span>
        <span>Etiqueta</span>
      </nav>
      <h2 className="bf-card__title print:hidden">Etiqueta do rolo</h2>
      <p className="bf-muted print:hidden" style={{ margin: 0, fontWeight: 600 }}>
        70 × 40 mm. Escolha A4 ou impressora térmica no diálogo de impressão.
      </p>
      <div className="flex gap-2 print:hidden">
        <Button variant="accent" icon={Printer} onClick={() => window.print()}>
          Imprimir
        </Button>
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
