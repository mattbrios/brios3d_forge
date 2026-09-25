"use client";

import { ChartColumn, ChevronRight, Disc3, Download, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HealthStatus } from "@/components/health-status";
import { ButtonLink } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { StockMeter } from "@/components/ui/data";
import { EmptyState, Loading, PageError } from "@/components/ui/feedback";
import { stockHrefOf, type StockAlert, type StockAlertsResponse } from "@/lib/alerts";
import { ApiError, apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import type { MaterialsSummary } from "@/lib/inventory";
import type { Material, MaterialsPage } from "@/lib/materials";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; me: AuthUser; summary: MaterialsSummary; materials: Material[]; alerts: StockAlert[] };

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Não foi possível conectar à API";
}

const KG = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const GRAMS = new Intl.NumberFormat("pt-BR");

function materialLabel(materials: Material[], materialId: string): string {
  const material = materials.find((candidate) => candidate.id === materialId);
  return material ? `${material.type} · ${material.brand} · ${material.color}` : materialId;
}

// Início (CONTEXT.md §11) só com o que a API já entrega: saldo de filamento, rolos e alertas.
export default function Home() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<AuthUser>("/auth/me"),
      apiFetch<MaterialsSummary>("/inventory/materials-summary"),
      apiFetch<MaterialsPage>("/materials?pageSize=100"),
      apiFetch<StockAlertsResponse>("/inventory/alerts"),
    ])
      .then(([me, summary, materialsPage, alerts]) => {
        if (active) {
          setStatus({ kind: "ready", me, summary, materials: materialsPage.items, alerts: alerts.items });
        }
      })
      .catch((error: unknown) => {
        if (active) setStatus({ kind: "error", message: messageOf(error) });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  function retry() {
    setStatus({ kind: "loading" });
    setAttempt((current) => current + 1);
  }

  if (status.kind === "loading") {
    return <Loading />;
  }

  if (status.kind === "error") {
    return <PageError message={status.message} onRetry={retry} />;
  }

  const { me, summary, materials, alerts } = status;
  const totalGrams = summary.items.reduce((sum, item) => sum + item.totalBalanceGrams, 0);
  const rollCount = summary.items.reduce((sum, item) => sum + item.rollCount, 0);
  const byBalance = [...summary.items].sort((a, b) => b.totalBalanceGrams - a.totalBalanceGrams);
  const largest = byBalance[0]?.totalBalanceGrams ?? 0;
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <div className="bf-page-head">
        <div>
          <p className="bf-muted" style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
            {today.charAt(0).toUpperCase() + today.slice(1)}
          </p>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Olá, {me.name.split(" ")[0]}</p>
        </div>
        <HealthStatus />
      </div>

      <Card
        variant="inverse"
        title="Visão geral"
        icon={ChartColumn}
        action={
          <ButtonLink href="/print-profiles" variant="accent" size="sm" icon={Download}>
            Importar modelo
          </ButtonLink>
        }
      >
        <div className="bf-stat-grid">
          <StatCard tone="orange" value={KG.format(totalGrams / 1000)} unit="kg" label="Filamento em estoque" />
          <StatCard tone="violet" value={rollCount} label="Rolos em estoque" />
          <StatCard tone="blue" value={summary.items.length} label="Materiais com rolos" />
          <StatCard tone="green" value={alerts.length} label="Itens abaixo do mínimo" />
        </div>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))",
          gap: "var(--layout-gutter)",
          alignItems: "start",
        }}
      >
        <Card
          title="Filamento por material"
          icon={Disc3}
          subtitle="Saldo somando todos os rolos"
          action={
            <ButtonLink href="/inventory" variant="ghost" size="sm">
              Ver estoque
              <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
            </ButtonLink>
          }
        >
          {byBalance.length === 0 ? (
            <EmptyState>Nenhum rolo em estoque.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-3.5" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {byBalance.map((item) => (
                <li key={item.materialId} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-2">
                    <span style={{ fontWeight: 700 }}>{materialLabel(materials, item.materialId)}</span>
                    <span className="bf-meter__text">
                      {GRAMS.format(item.totalBalanceGrams)} g<span> · {item.rollCount} rolo(s)</span>
                    </span>
                  </div>
                  <StockMeter value={item.totalBalanceGrams} max={largest} minimum={null} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Abaixo do mínimo"
          icon={TriangleAlert}
          subtitle="Filamento e insumos"
          action={
            <ButtonLink href="/inventory/alerts" variant="ghost" size="sm">
              Ver todos
              <ChevronRight size={14} strokeWidth={2} aria-hidden="true" />
            </ButtonLink>
          }
        >
          {alerts.length === 0 ? (
            <EmptyState>Nenhum item está abaixo do mínimo.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-3.5" style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {alerts.map((alert) => (
                <li key={`${alert.kind}-${alert.id}`} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-2">
                    <Link href={stockHrefOf(alert)}>{alert.label}</Link>
                    <span className="bf-meter__text">
                      {alert.balance} {alert.unit}
                      <span>
                        {" "}
                        / {alert.minimum} {alert.unit}
                      </span>
                    </span>
                  </div>
                  <StockMeter value={alert.balance} max={alert.minimum} minimum={alert.minimum} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
