import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StockAlert } from "@/lib/alerts";
import type { MaterialSummaryItem } from "@/lib/inventory";
import Home from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ME = { id: "u1", name: "Ana Souza", email: "ana@test.local", role: "production" };

const MATERIAL = {
  id: "mat-1",
  type: "PLA",
  brand: "Voolt",
  color: "Preto",
  densityGCm3: 1.24,
  nozzleTempC: 215,
  bedTempC: 60,
  needsDrying: false,
  dryingTemperatureC: null,
  dryingHours: null,
  active: true,
  minimumStockGrams: 1000,
};

const SUMMARY: MaterialSummaryItem[] = [
  { materialId: "mat-1", totalBalanceGrams: 1500, avgCostCentsPerGram: 12, rollCount: 2 },
  { materialId: "mat-2", totalBalanceGrams: 250, avgCostCentsPerGram: null, rollCount: 1 },
];

const ALERT: StockAlert = { kind: "stock_item", id: "item-1", label: "Ímã 6x3", balance: 4, minimum: 10, unit: "un" };

type Route = () => Promise<Response>;

function stubApi(routes: Record<string, Route>) {
  const fetchMock = vi.fn((url: string) => {
    const path = url.replace("http://api.test:3001", "");
    const route = routes[path];
    if (!route) throw new Error(`rota inesperada: ${path}`);
    return route();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function readyRoutes(overrides: Partial<Record<string, Route>> = {}): Record<string, Route> {
  return {
    "/auth/me": () => Promise.resolve(jsonResponse(200, ME)),
    "/health": () => Promise.resolve(jsonResponse(200, { status: "ok" })),
    "/inventory/materials-summary": () => Promise.resolve(jsonResponse(200, { items: SUMMARY })),
    "/materials?pageSize=100": () =>
      Promise.resolve(jsonResponse(200, { items: [MATERIAL], total: 1, page: 1, pageSize: 100 })),
    "/inventory/alerts": () => Promise.resolve(jsonResponse(200, { items: [ALERT] })),
    ...overrides,
  } as Record<string, Route>;
}

describe("Home page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows loading while fetching", () => {
    stubApi({
      "/auth/me": () => new Promise(() => undefined),
      "/inventory/materials-summary": () => new Promise(() => undefined),
      "/materials?pageSize=100": () => new Promise(() => undefined),
      "/inventory/alerts": () => new Promise(() => undefined),
    });
    render(<Home />);
    expect(screen.getByText("Carregando…")).toBeTruthy();
  });

  it("totals the filament stock and lists materials and alerts", async () => {
    stubApi(readyRoutes());
    render(<Home />);

    expect(await screen.findByText("Olá, Ana")).toBeTruthy();
    // 1500 g + 250 g = 1,75 kg, arredondado a uma casa.
    expect(screen.getByText("Filamento em estoque").parentElement?.textContent).toContain("1,8kg");
    expect(screen.getByText("Rolos em estoque").parentElement?.textContent).toContain("3");
    expect(screen.getByText("Materiais com rolos").parentElement?.textContent).toContain("2");
    expect(screen.getByText("Itens abaixo do mínimo").parentElement?.textContent).toContain("1");

    // Maior saldo primeiro; material sem cadastro cai no id.
    const materials = screen.getByText("Filamento por material").closest("section") as HTMLElement;
    const rows = within(materials).getAllByRole("listitem").map((item) => item.textContent);
    expect(rows).toEqual(["PLA · Voolt · Preto1.500 g · 2 rolo(s)", "mat-2250 g · 1 rolo(s)"]);

    expect(screen.getByRole("link", { name: "Ímã 6x3" }).getAttribute("href")).toBe("/inventory/items/item-1");
  });

  it("shows the empty states when there is no roll and no alert", async () => {
    stubApi(
      readyRoutes({
        "/inventory/materials-summary": () => Promise.resolve(jsonResponse(200, { items: [] })),
        "/inventory/alerts": () => Promise.resolve(jsonResponse(200, { items: [] })),
      }),
    );
    render(<Home />);

    expect(await screen.findByText("Nenhum rolo em estoque.")).toBeTruthy();
    expect(screen.getByText("Nenhum item está abaixo do mínimo.")).toBeTruthy();
  });

  it("shows the api error and retries", async () => {
    let fail = true;
    stubApi(
      readyRoutes({
        "/inventory/materials-summary": () =>
          Promise.resolve(
            fail
              ? jsonResponse(500, { error: "Internal server error" })
              : jsonResponse(200, { items: SUMMARY }),
          ),
      }),
    );
    render(<Home />);

    expect((await screen.findByRole("alert")).textContent).toBe("Internal server error");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Olá, Ana")).toBeTruthy();
  });
});
