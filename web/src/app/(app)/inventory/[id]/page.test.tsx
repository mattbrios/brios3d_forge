import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RollDetail } from "@/lib/inventory";
import type { Material } from "@/lib/materials";
import RollDetailPage from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SALES_ME = { id: "u3", name: "Vendas", email: "sales@test.local", role: "sales" };
const PRODUCTION_ME = { id: "u2", name: "Produção", email: "production@test.local", role: "production" };

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
};

const ROLL: RollDetail = {
  id: "r1",
  materialId: "m1",
  supplierId: null,
  nominalWeightGrams: 1000,
  initialWeightGrams: 1000,
  balanceGrams: 800,
  spoolTareGrams: 250,
  batch: null,
  purchaseDate: null,
  openedAt: null,
  lastDriedAt: null,
  discardedAt: null,
  location: null,
  acquisitionCostCents: 12000,
  status: "fechado",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  movements: [
    {
      id: "mv1",
      type: "entrada",
      quantityGrams: 1000,
      unitCostCentsPerGram: 12,
      reason: null,
      userId: "u1",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

const materialsPage = (items: Material[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

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

describe("Roll detail page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sales sees only the read-only history", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, SALES_ME)),
      "/inventory/rolls/r1": () => Promise.resolve(jsonResponse(200, ROLL)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([MATERIAL_1]))),
    });
    render(<RollDetailPage params={Promise.resolve({ id: "r1" })} />);

    await screen.findByText("entrada");
    expect(screen.queryByRole("button", { name: "Pesar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Dar baixa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Abrir rolo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar secagem" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Descartar" })).toBeNull();
  });

  it("confirms before discarding", async () => {
    let discardCalled = false;
    let currentRoll = ROLL;
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, PRODUCTION_ME)),
      "/inventory/rolls/r1": () => Promise.resolve(jsonResponse(200, currentRoll)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([MATERIAL_1]))),
      "/inventory/rolls/r1/discard": () => {
        discardCalled = true;
        currentRoll = { ...ROLL, balanceGrams: 0, status: "descartado", discardedAt: "2026-01-02T00:00:00.000Z" };
        return Promise.resolve(jsonResponse(200, currentRoll));
      },
    });
    render(<RollDetailPage params={Promise.resolve({ id: "r1" })} />);

    await screen.findByText("entrada");
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(discardCalled).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Descartar" }));
    expect(await screen.findByText("descartado")).toBeTruthy();
    expect(discardCalled).toBe(true);
    expect(callsTo(fetchMock, "/inventory/rolls/r1/discard")).toHaveLength(1);
  });
});
