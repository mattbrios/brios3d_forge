"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Pencil, Plus, Power, Search } from "lucide-react";
import { ConfirmDialog } from "@/components/crud/confirm-dialog";
import { DataTable, type Column } from "@/components/crud/data-table";
import { LicenseNotice } from "@/components/license-notice";
import { ProductForm } from "@/components/product-form";
import { ActiveBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, Loading, PageError } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { PLATFORM_LABELS, type Product, type ProductSummary, type ProductsPage } from "@/lib/products";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; role: AuthUser["role"]; products: ProductSummary[] };

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

const COLUMNS: Column<ProductSummary>[] = [
  {
    key: "name",
    label: "Produto",
    render: (row) => (
      <Link href={`/products/${row.id}`} style={{ fontWeight: 800 }}>
        {row.name}
      </Link>
    ),
  },
  { key: "modelPlatform", label: "Plataforma", render: (row) => PLATFORM_LABELS[row.modelPlatform] },
  { key: "modelTitle", label: "Modelo", render: (row) => row.modelTitle ?? <span className="bf-muted">—</span> },
  {
    key: "commercialUseAllowed",
    label: "Licença",
    render: (row) => <LicenseNotice commercialUseAllowed={row.commercialUseAllowed} />,
  },
  { key: "active", label: "Situação", render: (row) => <ActiveBadge active={row.active} /> },
];

export default function ProductsPage() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProductSummary | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ProductSummary | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    setStatus({ kind: "loading" });
    const trimmed = search.trim();
    const query = trimmed ? `?pageSize=100&search=${encodeURIComponent(trimmed)}` : "?pageSize=100";
    Promise.all([apiFetch<AuthUser>("/auth/me"), apiFetch<ProductsPage>(`/products${query}`)])
      .then(([me, page]) => {
        if (active) setStatus({ kind: "ready", role: me.role, products: page.items });
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, [attempt, search]);

  function upsert(summary: ProductSummary) {
    setStatus((current) => {
      if (current.kind !== "ready") return current;
      const exists = current.products.some((product) => product.id === summary.id);
      return {
        ...current,
        products: exists
          ? current.products.map((product) => (product.id === summary.id ? summary : product))
          : [...current.products, summary],
      };
    });
  }

  async function confirmToggle() {
    if (!confirmTarget) return;
    const target = confirmTarget;
    setConfirming(true);
    try {
      const updated = await apiFetch<Product>(`/products/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !target.active }),
      });
      upsert(updated);
    } catch (error) {
      setRowError((current) => ({ ...current, [target.id]: messageOf(error) }));
    } finally {
      setConfirmTarget(null);
      setConfirming(false);
    }
  }

  if (status.kind === "loading") {
    return <Loading />;
  }

  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={() => setAttempt((current) => current + 1)} />;
  }

  const { role, products } = status;
  const editable = role === "admin";

  return (
    <>
      <div className="bf-page-head">
        <div style={{ flex: "1 1 220px", maxWidth: 360 }}>
          <Field label="Buscar">
            <Input
              icon={Search}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="nome ou título do modelo"
            />
          </Field>
        </div>
        {editable && !creating && (
          <Button icon={Plus} variant="accent" onClick={() => setCreating(true)}>
            Novo produto
          </Button>
        )}
      </div>

      {editable && creating && (
        <Card title="Novo produto" icon={Plus}>
          <ProductForm
            onSaved={(saved) => {
              upsert(saved);
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        </Card>
      )}

      {editable && editing && (
        <Card title="Editar produto" icon={Package}>
          <ProductForm
            key={editing.id}
            product={editing}
            onSaved={(saved) => {
              upsert(saved);
              setEditing(null);
            }}
            onCancel={() => setEditing(null)}
          />
        </Card>
      )}

      <Card title={`${products.length} ${products.length === 1 ? "produto" : "produtos"}`} icon={Package}>
        {products.length === 0 ? (
          <EmptyState>{search.trim() ? "Nenhum produto encontrado." : "Nenhum produto cadastrado"}</EmptyState>
        ) : (
          <DataTable
            columns={COLUMNS}
            rows={products}
            getRowId={(product) => product.id}
            isInactive={(product) => !product.active}
            renderActions={
              editable
                ? (product) => (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex gap-1">
                        <IconButton icon={Pencil} label="Editar" size="sm" onClick={() => setEditing(product)} />
                        <IconButton
                          icon={Power}
                          label={product.active ? "Desativar" : "Reativar"}
                          size="sm"
                          onClick={() => setConfirmTarget(product)}
                        />
                      </div>
                      {rowError[product.id] && (
                        <p role="alert" className="bf-field__error" style={{ margin: 0 }}>
                          {rowError[product.id]}
                        </p>
                      )}
                    </div>
                  )
                : undefined
            }
          />
        )}
      </Card>

      {confirmTarget && (
        <ConfirmDialog
          title={confirmTarget.active ? "Desativar produto" : "Reativar produto"}
          tone={confirmTarget.active ? "danger" : "neutral"}
          message={`${confirmTarget.active ? "Desativar" : "Reativar"} "${confirmTarget.name}"? As variações continuam gravadas.`}
          confirmLabel={confirmTarget.active ? "Desativar" : "Reativar"}
          onConfirm={() => void confirmToggle()}
          onCancel={() => setConfirmTarget(null)}
          pending={confirming}
        />
      )}
    </>
  );
}
