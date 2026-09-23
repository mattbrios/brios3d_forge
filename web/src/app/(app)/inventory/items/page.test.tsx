import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StockItem } from "@/lib/stock-items";
import StockItemsPageScreen from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ADMIN_ME = { id: "u1", name: "Admin", email: "admin@test.local", role: "admin" };
const PRODUCTION_ME = { id: "u2", name: "Produção", email: "production@test.local", role: "production" };
const SALES_ME = { id: "u3", name: "Vendas", email: "sales@test.local", role: "sales" };

const CONSUMABLE: StockItem = {
  id: "i1",
  category: "insumo",
  name: "Parafuso M3x8",
  sku: "PAR-M3",
  unitOfMeasure: "un",
  location: "gaveta 1",
  preferredSupplierId: null,
  balanceQuantity: 200,
  avgCostCents: 60,
  compatiblePrinterIds: [],
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const SPARE_PART: StockItem = {
  ...CONSUMABLE,
  id: "i2",
  category: "peca_reposicao",
  name: "Bico 0.4 hardened",
  sku: "BICO-04",
  balanceQuantity: 3,
  avgCostCents: null,
  compatiblePrinterIds: ["p1"],
};

const itemsPage = (items: StockItem[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

const ALL_ITEMS_PATH = "/inventory/items?pageSize=100";
const PARTS_PATH = "/inventory/items?pageSize=100&category=peca_reposicao";

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

const bodyOf = (init?: RequestInit) => JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
const callsTo = (fetchMock: ReturnType<typeof stubApi>, path: string) =>
  fetchMock.mock.calls.filter(([url]) => (url as string).endsWith(path));
const rowOf = (name: string) => screen.getByText(name).closest("tr") as HTMLTableRowElement;

describe("Stock items page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows loading", async () => {
    let resolveMe: (value: Response) => void = () => undefined;
    const mePromise = new Promise<Response>((resolve) => {
      resolveMe = resolve;
    });
    stubApi({
      "/auth/me": () => mePromise,
      [ALL_ITEMS_PATH]: () => Promise.resolve(jsonResponse(200, itemsPage([]))),
    });
    render(<StockItemsPageScreen />);

    expect(screen.getByText("Carregando…")).toBeTruthy();
    resolveMe(jsonResponse(200, ADMIN_ME));
    await screen.findByText("Nenhum item cadastrado.");
  });

  it("lists items with balance and average cost and filters by category", async () => {
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      [ALL_ITEMS_PATH]: () => Promise.resolve(jsonResponse(200, itemsPage([CONSUMABLE, SPARE_PART]))),
      [PARTS_PATH]: () => Promise.resolve(jsonResponse(200, itemsPage([SPARE_PART]))),
    });
    render(<StockItemsPageScreen />);

    await screen.findByText("Parafuso M3x8");
    const consumableCells = within(rowOf("Parafuso M3x8"))
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
    expect(consumableCells.slice(0, 5)).toEqual([
      "Parafuso M3x8",
      "Insumo",
      "un",
      "200 un",
      "R$ 0.60/un",
    ]);
    // Saldo zero não inventa custo médio: a coluna mostra o traço.
    expect(
      within(rowOf("Bico 0.4 hardened"))
        .getAllByRole("cell")
        .map((cell) => cell.textContent)[4],
    ).toBe("—");

    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "peca_reposicao" } });

    await screen.findByText("Bico 0.4 hardened");
    expect(callsTo(fetchMock, PARTS_PATH)).toHaveLength(1);
    expect(screen.queryByText("Parafuso M3x8")).toBeNull();
  });

  it("shows the error and retries", async () => {
    let itemsRoute: Route = () => Promise.reject(new TypeError("Failed to fetch"));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      [ALL_ITEMS_PATH]: () => itemsRoute(),
    });
    render(<StockItemsPageScreen />);

    await screen.findByRole("alert");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("Parafuso M3x8")).toBeNull();

    itemsRoute = () => Promise.resolve(jsonResponse(200, itemsPage([CONSUMABLE])));
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await screen.findByText("Parafuso M3x8");
    expect(callsTo(fetchMock, ALL_ITEMS_PATH)).toHaveLength(2);
  });

  it("shows an empty state with the create action only for admin", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      [ALL_ITEMS_PATH]: () => Promise.resolve(jsonResponse(200, itemsPage([]))),
    });
    render(<StockItemsPageScreen />);

    await screen.findByText("Nenhum item cadastrado.");
    expect(screen.getByRole("button", { name: "Cadastrar item" })).toBeTruthy();
    cleanup();

    for (const me of [PRODUCTION_ME, SALES_ME]) {
      stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, me)),
        [ALL_ITEMS_PATH]: () => Promise.resolve(jsonResponse(200, itemsPage([]))),
      });
      render(<StockItemsPageScreen />);

      await screen.findByText("Nenhum item cadastrado.");
      expect(screen.queryByRole("button", { name: "Cadastrar item" })).toBeNull();
      cleanup();
    }
  });

  it("production and sales do not see the create or entry actions", async () => {
    for (const me of [PRODUCTION_ME, SALES_ME]) {
      stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, me)),
        [ALL_ITEMS_PATH]: () => Promise.resolve(jsonResponse(200, itemsPage([CONSUMABLE]))),
      });
      render(<StockItemsPageScreen />);

      await screen.findByText("Parafuso M3x8");
      expect(screen.queryByRole("button", { name: "Cadastrar item" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Registrar entrada" })).toBeNull();
      cleanup();
    }

    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      [ALL_ITEMS_PATH]: () => Promise.resolve(jsonResponse(200, itemsPage([CONSUMABLE]))),
    });
    render(<StockItemsPageScreen />);

    // O lado positivo: sem ele, esconder as ações para todo mundo também passaria.
    await screen.findByText("Parafuso M3x8");
    expect(screen.getByRole("button", { name: "Cadastrar item" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Registrar entrada" })).toBeTruthy();
  });

  it("admin registers an entry from the list", async () => {
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      [ALL_ITEMS_PATH]: () => Promise.resolve(jsonResponse(200, itemsPage([CONSUMABLE]))),
      "/inventory/items/i1/entries": () => Promise.resolve(jsonResponse(201, CONSUMABLE)),
    });
    render(<StockItemsPageScreen />);

    await screen.findByText("Parafuso M3x8");
    fireEvent.click(screen.getByRole("button", { name: "Registrar entrada" }));
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("Custo unitário (centavos)"), { target: { value: "70" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => expect(callsTo(fetchMock, "/inventory/items/i1/entries")).toHaveLength(1));
    expect(bodyOf(callsTo(fetchMock, "/inventory/items/i1/entries")[0][1] as RequestInit)).toEqual({
      quantity: 100,
      unitCostCents: 70,
    });
  });
});
