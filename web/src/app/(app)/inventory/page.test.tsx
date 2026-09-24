import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MaterialsSummary } from "@/lib/inventory";
import type { Material } from "@/lib/materials";
import InventoryPage from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ADMIN_ME = { id: "u1", name: "Admin", email: "admin@test.local", role: "admin" };
const PRODUCTION_ME = { id: "u2", name: "Produção", email: "production@test.local", role: "production" };
const SALES_ME = { id: "u3", name: "Vendas", email: "sales@test.local", role: "sales" };

const MATERIAL_1: Material = {
  id: "m1",
  type: "PLA",
  brand: "Marca A",
  color: "Natural",
  densityGCm3: 1.24,
  nozzleTempC: 210,
  bedTempC: 60,
  needsDrying: false,
  dryingTemperatureC: null,
  dryingHours: null,
  active: true,
  minimumStockGrams: null,
};

const materialsPage = (items: Material[]) => ({ items, total: items.length, page: 1, pageSize: 100 });
const summary = (items: MaterialsSummary["items"]) => ({ items });

type Route = (init?: RequestInit) => Promise<Response>;

function stubApi(routes: Record<string, Route>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const path = url.replace("http://api.test:3001", "");
    const route = routes[path];
    if (!route) throw new Error(`rota inesperada: ${path}`);
    return route(init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const callsTo = (fetchMock: ReturnType<typeof stubApi>, path: string) =>
  fetchMock.mock.calls.filter(([url]) => (url as string).endsWith(path));

describe("Inventory page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows loading", async () => {
    let resolveSummary: (value: Response) => void = () => undefined;
    const summaryPromise = new Promise<Response>((resolve) => {
      resolveSummary = resolve;
    });
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/inventory/materials-summary": () => summaryPromise,
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([]))),
    });
    render(<InventoryPage />);
    expect(screen.getByText("Carregando…")).toBeTruthy();
    resolveSummary(jsonResponse(200, summary([])));
    await screen.findByText("Nenhum rolo em estoque.");
  });

  it("shows the error and retries", async () => {
    let summaryRoute: Route = () => Promise.reject(new TypeError("Failed to fetch"));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/inventory/materials-summary": () => summaryRoute(),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([]))),
    });
    render(<InventoryPage />);
    expect(await screen.findByText("Não foi possível conectar à API")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Tentar novamente" });

    summaryRoute = () => Promise.resolve(jsonResponse(200, summary([])));
    fireEvent.click(retry);
    await screen.findByText("Nenhum rolo em estoque.");
    expect(callsTo(fetchMock, "/inventory/materials-summary")).toHaveLength(2);
  });

  it("shows an empty state with the create action only for admin", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/inventory/materials-summary": () => Promise.resolve(jsonResponse(200, summary([]))),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([]))),
    });
    render(<InventoryPage />);
    expect(await screen.findByText("Nenhum rolo em estoque.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cadastrar rolo" })).toBeTruthy();
  });

  it("production and sales do not see the create roll action", async () => {
    for (const me of [PRODUCTION_ME, SALES_ME]) {
      stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, me)),
        "/inventory/materials-summary": () =>
          Promise.resolve(jsonResponse(200, summary([{ materialId: "m1", totalBalanceGrams: 500, avgCostCentsPerGram: 10, rollCount: 1 }]))),
        "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([MATERIAL_1]))),
      });
      render(<InventoryPage />);
      await screen.findByText("PLA · Marca A · Natural");
      expect(screen.queryByRole("button", { name: "Cadastrar rolo" })).toBeNull();
      cleanup();
    }
  });
});
