"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { StockAlertsResponse } from "@/lib/alerts";

// Três estados, e um deles é uma falha silenciosa: o indicador aparece no cabeçalho de TODA tela
// autenticada, então um erro aqui apareceria no sistema inteiro por causa de um dado acessório.
// Sem alerta e com a busca falhando renderizam a mesma coisa: nada (AC 27, AC 28).
export function AlertsIndicator() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<StockAlertsResponse>("/inventory/alerts")
      .then((response) => {
        if (active) setCount(response.items.length);
      })
      .catch(() => {
        if (active) setCount(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (count === null || count === 0) {
    return null;
  }

  return (
    <Link
      href="/inventory/alerts"
      aria-label={`${count} ${count === 1 ? "item" : "itens"} abaixo do mínimo`}
      className="rounded border border-amber-500 px-2 py-0.5 text-amber-700 dark:text-amber-400"
    >
      {count}
    </Link>
  );
}
