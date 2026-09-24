import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StockAlert } from "@/lib/alerts";
import { AlertsIndicator } from "./alerts-indicator";
import { AppShell } from "./app-shell";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const alert = (id: string, label: string): StockAlert => ({
  kind: "stock_item",
  id,
  label,
  balance: 4,
  minimum: 10,
  unit: "un",
});

function renderHeader() {
  render(
    <AppShell alerts={<AlertsIndicator />}>
      <p>conteúdo da página</p>
    </AppShell>,
  );
}

describe("AlertsIndicator", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows the count 3 linking to the alerts screen", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(200, { items: [alert("i1", "Ímã"), alert("i2", "Parafuso"), alert("i3", "Cola")] }),
        ),
      ),
    );
    renderHeader();

    const header = screen.getByRole("banner");
    const indicator = await within(header).findByText("3");
    expect(indicator.getAttribute("href")).toBe("/inventory/alerts");
  });

  it("renders nothing when there is no alert", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(jsonResponse(200, { items: [] }))));
    renderHeader();

    await screen.findByText("conteúdo da página");
    const header = screen.getByRole("banner");
    await waitFor(() =>
      expect(within(header).queryByRole("link", { name: /abaixo do mínimo/ })).toBeNull(),
    );
    expect(within(header).queryByText("0")).toBeNull();
  });

  it("degrades to no indicator and no error message when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));
    renderHeader();

    await screen.findByText("conteúdo da página");
    const header = screen.getByRole("banner");
    await waitFor(() =>
      expect(within(header).queryByRole("link", { name: /abaixo do mínimo/ })).toBeNull(),
    );
    // Um erro no cabeçalho apareceria em toda tela do sistema: ele degrada calado.
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("conteúdo da página")).toBeTruthy();
  });
});
