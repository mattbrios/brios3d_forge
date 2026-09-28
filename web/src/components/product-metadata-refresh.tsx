"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import type { ModelMetadataPreview, Product } from "@/lib/products";
import { Button } from "./ui/button";
import { Alert, Loading } from "./ui/feedback";

type Status =
  | { kind: "closed" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; preview: ModelMetadataPreview };

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

function dash(value: string | null): string {
  return value ?? "—";
}

function commercialUseLabel(value: boolean | null): string {
  return value === true ? "Permitido" : value === false ? "Não permitido" : "Não informado";
}

// S5 (AC 21-25): busca o preview e mostra lado a lado o valor gravado e o valor buscado, antes
// de gravar. Nada é sobrescrito até "Confirmar atualização" (AC 21, 23). Sem botão para produtos
// do Thingiverse (AC 24, sem busca automática nesta plataforma).
export function ProductMetadataRefresh({
  product,
  onUpdated,
}: {
  product: Product;
  onUpdated: (product: Product) => void;
}) {
  const [status, setStatus] = useState<Status>({ kind: "closed" });
  const [confirming, setConfirming] = useState(false);

  if (product.modelPlatform === "thingiverse") {
    return null;
  }

  async function open() {
    setStatus({ kind: "loading" });
    try {
      const preview = await apiFetch<ModelMetadataPreview>("/products/model-metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelUrl: product.modelUrl }),
      });
      setStatus({ kind: "ready", preview });
    } catch (cause) {
      // AC 25: o produto não é alterado - nada foi gravado até aqui.
      setStatus({ kind: "error", message: messageOf(cause) });
    }
  }

  function close() {
    setStatus({ kind: "closed" });
  }

  async function confirm() {
    setConfirming(true);
    try {
      const updated = await apiFetch<Product>(`/products/${product.id}/model-metadata/refresh`, {
        method: "POST",
      });
      onUpdated(updated);
      close();
    } catch (cause) {
      setStatus({ kind: "error", message: messageOf(cause) });
    } finally {
      setConfirming(false);
    }
  }

  const rows: { label: string; saved: string; fetched: string }[] =
    status.kind === "ready"
      ? [
          { label: "Título", saved: dash(product.modelTitle), fetched: dash(status.preview.title) },
          { label: "Designer", saved: dash(product.modelDesigner), fetched: dash(status.preview.designer) },
          { label: "Licença", saved: dash(product.modelLicense), fetched: dash(status.preview.license) },
          {
            label: "Uso comercial",
            saved: commercialUseLabel(product.commercialUseAllowed),
            fetched: commercialUseLabel(status.preview.commercialUseAllowed),
          },
          { label: "URL da imagem", saved: dash(product.modelImageUrl), fetched: dash(status.preview.imageUrl) },
        ]
      : [];

  return (
    <>
      <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => void open()}>
        Atualizar metadados
      </Button>
      {status.kind !== "closed" && (
        <div
          className="bf-scrim"
          onClick={(event) => {
            if (event.target === event.currentTarget && !confirming) close();
          }}
        >
          <div role="dialog" aria-modal="true" aria-label="Atualizar metadados" className="bf-dialog" style={{ width: "min(560px,100%)" }}>
            <h2 className="bf-dialog__title">Atualizar metadados</h2>
            {status.kind === "loading" && <Loading>Buscando metadados atuais…</Loading>}
            {status.kind === "error" && (
              <Alert tone="danger" role="alert">
                {status.message}
              </Alert>
            )}
            {status.kind === "ready" && (
              <div className="bf-table-wrap">
                <table className="bf-table">
                  <thead>
                    <tr>
                      <th>Campo</th>
                      <th>Gravado</th>
                      <th>Buscado agora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.label}>
                        <td data-label="Campo">{row.label}</td>
                        <td data-label="Gravado">{row.saved}</td>
                        <td data-label="Buscado agora">{row.fetched}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="bf-dialog__actions">
              <Button variant="secondary" onClick={close} disabled={confirming}>
                Cancelar
              </Button>
              {status.kind === "ready" && (
                <Button variant="primary" loading={confirming} onClick={() => void confirm()}>
                  Confirmar atualização
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
