import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InventoryMovement } from "@/lib/inventory";
import MovementsPageScreen from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ROLL_MOVEMENT: InventoryMovement = {
  id: "mv1",
  type: "consumo",
  quantity: -50,
  unitCostCents: null,
  reason: null,
  userId: "u2",
  createdAt: "2026-01-02T00:00:00.000Z",
  rollId: "r1",
  stockItemId: null,
};

const ITEM_MOVEMENT: InventoryMovement = {
  id: "mv2",
  type: "entrada",
  quantity: 20,
  unitCostCents: 30,
  reason: null,
  userId: "u1",
  createdAt: "2026-01-01T00:00:00.000Z",
  rollId: null,
  stockItemId: "i1",
};

const MOVEMENTS_PATH = "/inventory/movements?pageSize=100";
const movementsPage = (items: InventoryMovement[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

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

describe("Movements page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("lists roll and item movements with the owner, and covers loading, error and empty", async () => {
    // Carregando
    let resolveList: (value: Response) => void = () => undefined;
    const listPromise = new Promise<Response>((resolve) => {
      resolveList = resolve;
    });
    stubApi({ [MOVEMENTS_PATH]: () => listPromise });
    render(<MovementsPageScreen />);
    expect(screen.getByText("Carregando…")).toBeTruthy();

    // Lista unificada: uma linha de rolo e uma de item, cada uma identificando o dono.
    resolveList(jsonResponse(200, movementsPage([ROLL_MOVEMENT, ITEM_MOVEMENT])));
    await screen.findByText("consumo");

    const rollRow = screen.getByText("consumo").closest("tr") as HTMLTableRowElement;
    expect(within(rollRow).getByRole("link", { name: "Rolo" }).getAttribute("href")).toBe("/inventory/r1");
    expect(within(rollRow).getAllByRole("cell").map((cell) => cell.textContent)[2]).toBe("-50");

    const itemRow = screen.getByText("entrada").closest("tr") as HTMLTableRowElement;
    expect(within(itemRow).getByRole("link", { name: "Item" }).getAttribute("href")).toBe(
      "/inventory/items/i1",
    );
    const itemCells = within(itemRow).getAllByRole("cell").map((cell) => cell.textContent);
    expect(itemCells[2]).toBe("20");
    expect(itemCells[3]).toBe("0.30");
    expect(itemCells[4]).toBe("u1");
    cleanup();

    // Erro, com a ação de tentar novamente refazendo a chamada
    let listRoute: Route = () => Promise.reject(new TypeError("Failed to fetch"));
    const fetchMock = stubApi({ [MOVEMENTS_PATH]: () => listRoute() });
    render(<MovementsPageScreen />);
    await screen.findByRole("alert");
    expect(screen.queryByRole("table")).toBeNull();

    listRoute = () => Promise.resolve(jsonResponse(200, movementsPage([ROLL_MOVEMENT])));
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("consumo");
    expect(callsTo(fetchMock, MOVEMENTS_PATH)).toHaveLength(2);
    cleanup();

    // Vazio
    stubApi({ [MOVEMENTS_PATH]: () => Promise.resolve(jsonResponse(200, movementsPage([]))) });
    render(<MovementsPageScreen />);
    await screen.findByText("Nenhuma movimentação registrada.");
    expect(screen.queryByRole("table")).toBeNull();
  });
});
