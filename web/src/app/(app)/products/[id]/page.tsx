"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Package, Pencil, Plus, Power, Receipt } from "lucide-react";
import { CostBreakdown } from "@/components/cost-breakdown";
import { ConfirmDialog } from "@/components/crud/confirm-dialog";
import { LicenseNotice } from "@/components/license-notice";
import { ProductForm } from "@/components/product-form";
import { ProductVariantEditor } from "@/components/product-variant-editor";
import { ActiveBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, Loading, PageError } from "@/components/ui/feedback";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import { PLATFORM_LABELS, type Product, type ProductPricing, type ProductVariant } from "@/lib/products";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; role: AuthUser["role"]; product: Product };

type PricingStatus = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; pricing: ProductPricing };

// Editor aberto: nova variação, ou a variação sendo editada.
type Editor = { kind: "closed" } | { kind: "new" } | { kind: "edit"; variant: ProductVariant };

type ConfirmTarget = { kind: "product" } | { kind: "variant"; variant: ProductVariant };

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

function hours(value: number): string {
  return `${String(value).replace(".", ",")} h`;
}

// `params` é uma Promise nesta versão do Next.js: resolvida num efeito, como no detalhe do insumo.
export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
    return <Loading />;
  }
  return <ProductDetailContent id={id} />;
}

function ProductDetailContent({ id }: { id: string }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [pricing, setPricing] = useState<PricingStatus>({ kind: "loading" });
  const [pricingAttempt, setPricingAttempt] = useState(0);

  const [editingProduct, setEditingProduct] = useState(false);
  const [editor, setEditor] = useState<Editor>({ kind: "closed" });
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus({ kind: "loading" });
    Promise.all([apiFetch<AuthUser>("/auth/me"), apiFetch<Product>(`/products/${id}`)])
      .then(([me, product]) => {
        if (active) setStatus({ kind: "ready", role: me.role, product });
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);

  // Custo e preço buscados à parte (AD-024): uma falha aqui não esconde o produto (AC 27).
  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPricing({ kind: "loading" });
    apiFetch<ProductPricing>(`/products/${id}/pricing`)
      .then((result) => {
        if (active) setPricing({ kind: "ready", pricing: result });
      })
      .catch((error: unknown) => {
        if (active) setPricing({ kind: "error", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, [id, pricingAttempt]);

  // Depois de gravar, produto e custo são relidos: o custo nunca é montado no web.
  function reload() {
    setAttempt((current) => current + 1);
    setPricingAttempt((current) => current + 1);
  }

  async function confirmToggle() {
    if (!confirmTarget || status.kind !== "ready") return;
    const target = confirmTarget;
    setConfirming(true);
    setActionError(null);
    try {
      if (target.kind === "product") {
        await apiFetch<Product>(`/products/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !status.product.active }),
        });
      } else {
        await apiFetch<ProductVariant>(`/products/${id}/variants/${target.variant.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: !target.variant.active }),
        });
      }
      reload();
    } catch (error) {
      setActionError(messageOf(error));
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

  const { role, product } = status;
  const editable = role === "admin";

  function costArea(variant: ProductVariant) {
    if (!variant.active) {
      return <p className="bf-muted" style={{ margin: 0 }}>Variação inativa: sem custo calculado.</p>;
    }
    if (pricing.kind === "loading") {
      return <Loading>Calculando custo…</Loading>;
    }
    if (pricing.kind === "error") {
      return null;
    }
    const entry = pricing.pricing.variants.find((item) => item.variantId === variant.id);
    if (!entry) {
      return null;
    }
    if (entry.error !== null || entry.pricing === null) {
      return (
        <Alert tone="warning" role="alert">
          {entry.error ?? "Custo indisponível"}
        </Alert>
      );
    }
    return <CostBreakdown result={entry.pricing} />;
  }

  return (
    <>
      <Card
        title={product.name}
        icon={Package}
        subtitle={product.modelTitle ?? undefined}
        action={
          editable && (
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditingProduct(true)}>
                Editar
              </Button>
              <Button size="sm" variant="secondary" icon={Power} onClick={() => setConfirmTarget({ kind: "product" })}>
                {product.active ? "Desativar" : "Reativar"}
              </Button>
            </div>
          )
        }
      >
        <div className="flex flex-wrap items-start gap-4">
          {product.modelImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- imagem remota do modelo, exibida pela URL (questão 23)
            <img
              src={product.modelImageUrl}
              alt=""
              style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 10 }}
            />
          )}
          <div className="flex min-w-0 flex-col gap-2" style={{ flex: "1 1 240px" }}>
            <div className="flex flex-wrap items-center gap-2">
              <ActiveBadge active={product.active} />
              <Badge tone="info" size="sm">
                {PLATFORM_LABELS[product.modelPlatform]}
              </Badge>
              <LicenseNotice commercialUseAllowed={product.commercialUseAllowed} />
            </div>
            <a href={product.modelUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1">
              <ExternalLink size={14} aria-hidden="true" />
              {product.modelUrl}
            </a>
            {(product.modelDesigner || product.modelLicense) && (
              <p className="bf-muted" style={{ margin: 0 }}>
                {product.modelDesigner && `por ${product.modelDesigner}`}
                {product.modelDesigner && product.modelLicense && " · "}
                {product.modelLicense}
              </p>
            )}
            {product.description && <p style={{ margin: 0 }}>{product.description}</p>}
          </div>
        </div>
      </Card>

      {editable && editingProduct && (
        <Card title="Editar produto" icon={Pencil}>
          <ProductForm
            product={product}
            onSaved={() => {
              setEditingProduct(false);
              reload();
            }}
            onCancel={() => setEditingProduct(false)}
          />
        </Card>
      )}

      {actionError && (
        <Alert tone="danger" role="alert">
          {actionError}
        </Alert>
      )}

      {pricing.kind === "error" && (
        <Alert
          tone="danger"
          action={
            <Button size="sm" variant="secondary" onClick={() => setPricingAttempt((current) => current + 1)}>
              Tentar novamente
            </Button>
          }
        >
          <span role="alert">{pricing.message}</span>
        </Alert>
      )}

      <Card
        title="Variações"
        icon={Receipt}
        subtitle="Custo e preço por unidade, com o custo médio atual do estoque"
        action={
          editable &&
          editor.kind === "closed" && (
            <Button size="sm" variant="accent" icon={Plus} onClick={() => setEditor({ kind: "new" })}>
              Nova variação
            </Button>
          )
        }
      >
        {editable && editor.kind !== "closed" && (
          <ProductVariantEditor
            key={editor.kind === "edit" ? editor.variant.id : "new"}
            product={product}
            variant={editor.kind === "edit" ? editor.variant : undefined}
            onSaved={() => {
              setEditor({ kind: "closed" });
              reload();
            }}
            onCancel={() => setEditor({ kind: "closed" })}
          />
        )}

        {product.variants.length === 0 ? (
          <EmptyState>Nenhuma variação cadastrada</EmptyState>
        ) : (
          product.variants.map((variant) => (
            <Card
              key={variant.id}
              variant="flat"
              titleAs="h3"
              title={variant.name}
              subtitle={`${variant.printer.name} · impressão ${hours(variant.printHours)}`}
              className={variant.active ? undefined : "is-inactive"}
              action={
                <div className="flex items-center gap-2">
                  <ActiveBadge active={variant.active} size="sm" />
                  {editable && (
                    <>
                      <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditor({ kind: "edit", variant })}>
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Power}
                        onClick={() => setConfirmTarget({ kind: "variant", variant })}
                      >
                        {variant.active ? "Desativar" : "Reativar"}
                      </Button>
                    </>
                  )}
                </div>
              }
            >
              <ul className="bf-muted" style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {variant.materials.map((line, index) => (
                  <li key={`m-${index}`}>
                    {line.name} · {String(line.grams).replace(".", ",")} g
                  </li>
                ))}
                {variant.supplies.map((line, index) => (
                  <li key={`s-${index}`}>
                    {line.name} × {String(line.quantity).replace(".", ",")}
                  </li>
                ))}
                <li>
                  Mão de obra: preparo {hours(variant.prepHours)} · fatiamento {hours(variant.slicingHours)} ·
                  pós-processamento {hours(variant.postProcessingHours)}
                </li>
              </ul>
              {costArea(variant)}
            </Card>
          ))
        )}
      </Card>

      {confirmTarget && (
        <ConfirmDialog
          title={
            confirmTarget.kind === "product"
              ? product.active
                ? "Desativar produto"
                : "Reativar produto"
              : confirmTarget.variant.active
                ? "Desativar variação"
                : "Reativar variação"
          }
          tone={(confirmTarget.kind === "product" ? product.active : confirmTarget.variant.active) ? "danger" : "neutral"}
          message={
            confirmTarget.kind === "product"
              ? `${product.active ? "Desativar" : "Reativar"} "${product.name}"? As variações continuam gravadas.`
              : `${confirmTarget.variant.active ? "Desativar" : "Reativar"} a variação "${confirmTarget.variant.name}"?`
          }
          confirmLabel={
            (confirmTarget.kind === "product" ? product.active : confirmTarget.variant.active) ? "Desativar" : "Reativar"
          }
          onConfirm={() => void confirmToggle()}
          onCancel={() => setConfirmTarget(null)}
          pending={confirming}
        />
      )}
    </>
  );
}
