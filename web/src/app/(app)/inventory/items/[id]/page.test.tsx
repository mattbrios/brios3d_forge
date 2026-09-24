import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Printer } from "@/lib/printers";
import type { StockItemDetail } from "@/lib/stock-items";
import StockItemDetailPage from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ADMIN_ME = { id: "u1", name: "Admin", email: "admin@test.local", role: "admin" };
const SALES_ME = { id: "u3", name: "Vendas", email: "sales@test.local", role: "sales" };

const PRINTER_1: Printer = {
  id: "p1",
  name: "Bambu X1C",
  acquisitionCostCents: 500000,
  lifespanHours: 10000,
  powerWatts: 250,
  hourmeterHours: 120,
  nozzles: [{ diameterMm: 0.4, type: "Hardened Steel" }],
  hasAms: true,
  amsSlots: 4,
  active: true,
};

const SPARE_PART: StockItemDetail = {
  id: "i2",
  category: "peca_reposicao",
  name: "Bico 0.4 hardened",
  sku: "BICO-04",
  unitOfMeasure: "un",
  location: "gaveta 2",
  preferredSupplierId: null,
  balanceQuantity: 5,
  minimumQuantity: 2,
  avgCostCents: 4500,
  compatiblePrinterIds: ["p1"],
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  movements: [
    {
      id: "mv1",
      type: "entrada",
      quantity: 6,
      unitCostCents: 4500,
      reason: null,
      userId: "u1",
      createdAt: "2026-01-01T00:00:00.000Z",
      rollId: null,
      stockItemId: "i2",
    },
    {
      id: "mv2",
      type: "consumo",
      quantity: -1,
      unitCostCents: null,
      reason: "troca na X1C",
      userId: "u2",
      createdAt: "2026-01-02T00:00:00.000Z",
      rollId: null,
      stockItemId: "i2",
    },
  ],
};

const printersPage = (items: Printer[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

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

describe("Stock item detail page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sales sees only the read-only item detail", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, SALES_ME)),
      "/inventory/items/i2": () => Promise.resolve(jsonResponse(200, SPARE_PART)),
      "/printers?pageSize=100": () => Promise.resolve(jsonResponse(200, printersPage([PRINTER_1]))),
    });
    render(<StockItemDetailPage params={Promise.resolve({ id: "i2" })} />);

    // O histórico continua visível: vendas lê tudo, só não movimenta.
    await screen.findByText("entrada");
    expect(screen.queryByRole("button", { name: "Dar baixa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Registrar contagem" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desativar" })).toBeNull();
    expect(screen.queryByText("Baixa")).toBeNull();
    expect(screen.queryByText("Contagem de inventário")).toBeNull();
  });

  it("shows balance, average cost, compatible printers and the history", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/inventory/items/i2": () => Promise.resolve(jsonResponse(200, SPARE_PART)),
      "/printers?pageSize=100": () => Promise.resolve(jsonResponse(200, printersPage([PRINTER_1]))),
    });
    render(<StockItemDetailPage params={Promise.resolve({ id: "i2" })} />);

    expect(await screen.findByText("5 un")).toBeTruthy();
    expect(screen.getByText("R$ 45.00/un")).toBeTruthy();
    // Peça de reposição mostra a impressora pelo nome, não pelo id.
    expect(screen.getByText("Bambu X1C")).toBeTruthy();

    const consumoRow = screen.getByText("consumo").closest("tr") as HTMLTableRowElement;
    const cells = within(consumoRow).getAllByRole("cell").map((cell) => cell.textContent);
    expect(cells).toEqual([
      "consumo",
      "-1",
      "—",
      "troca na X1C",
      "u2",
      new Date("2026-01-02T00:00:00.000Z").toLocaleString("pt-BR"),
    ]);
  });

  it("confirms before deactivating the item", async () => {
    let patched = false;
    let current = SPARE_PART;
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/inventory/items/i2": (init) => {
        if (init?.method === "PATCH") {
          patched = true;
          current = { ...SPARE_PART, active: false };
          return Promise.resolve(jsonResponse(200, current));
        }
        return Promise.resolve(jsonResponse(200, current));
      },
      "/printers?pageSize=100": () => Promise.resolve(jsonResponse(200, printersPage([PRINTER_1]))),
    });
    render(<StockItemDetailPage params={Promise.resolve({ id: "i2" })} />);

    await screen.findByText("entrada");
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(patched).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desativar" }));

    expect(await screen.findByText("Inativo")).toBeTruthy();
    expect(patched).toBe(true);
    const patchCalls = callsTo(fetchMock, "/inventory/items/i2").filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
    );
    expect(patchCalls).toHaveLength(1);
    expect(bodyOf(patchCalls[0][1] as RequestInit)).toEqual({ active: false });
  });

  it("production registers a consumo and an inventory count", async () => {
    const fetchMock = stubApi({
      "/auth/me": () =>
        Promise.resolve(
          jsonResponse(200, { id: "u2", name: "Produção", email: "production@test.local", role: "production" }),
        ),
      "/inventory/items/i2": () => Promise.resolve(jsonResponse(200, SPARE_PART)),
      "/inventory/items/i2/movements": () => Promise.resolve(jsonResponse(201, SPARE_PART)),
      "/inventory/items/i2/count": () => Promise.resolve(jsonResponse(200, SPARE_PART)),
      "/printers?pageSize=100": () => Promise.resolve(jsonResponse(200, printersPage([PRINTER_1]))),
    });
    render(<StockItemDetailPage params={Promise.resolve({ id: "i2" })} />);

    await screen.findByText("entrada");
    fireEvent.change(screen.getByLabelText("Quantidade (un)"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Dar baixa" }));
    await vi.waitFor(() => expect(callsTo(fetchMock, "/inventory/items/i2/movements")).toHaveLength(1));
    expect(bodyOf(callsTo(fetchMock, "/inventory/items/i2/movements")[0][1] as RequestInit)).toEqual({
      type: "consumo",
      quantity: 2,
    });

    fireEvent.change(screen.getByLabelText("Quantidade contada (un)"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar contagem" }));
    await vi.waitFor(() => expect(callsTo(fetchMock, "/inventory/items/i2/count")).toHaveLength(1));
    expect(bodyOf(callsTo(fetchMock, "/inventory/items/i2/count")[0][1] as RequestInit)).toEqual({
      countedQuantity: 4,
    });
  });
});
