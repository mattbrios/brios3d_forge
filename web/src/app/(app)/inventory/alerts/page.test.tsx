import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/components/auth-gate";
import type { StockAlert } from "@/lib/alerts";
import StockAlertsPage from "./page";

const navigation = vi.hoisted(() => {
  const replace = vi.fn();
  return { replace, router: { replace }, pathname: "/inventory/alerts" };
});

vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  usePathname: () => navigation.pathname,
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SALES_ME = { id: "u3", name: "Vendas", email: "sales@test.local", role: "sales" };

const MATERIAL_ALERT: StockAlert = {
  kind: "material",
  id: "mat-1",
  label: "PLA · Voolt · Preto",
  balance: 800,
  minimum: 1000,
  unit: "g",
};

const ITEM_ALERT: StockAlert = {
  kind: "stock_item",
  id: "item-1",
  label: "Ímã 6x3",
  balance: 4,
  minimum: 10,
  unit: "un",
};

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

const rowOf = (label: string) => screen.getByText(label).closest("tr") as HTMLTableRowElement;

describe("Stock alerts page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
    navigation.replace.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows loading while fetching", () => {
    stubApi({ "/inventory/alerts": () => new Promise(() => undefined) });
    render(<StockAlertsPage />);

    expect(screen.getByText("Carregando…")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("lists material and item alerts with links to the matching stock screen", async () => {
    stubApi({
      "/inventory/alerts": () =>
        Promise.resolve(jsonResponse(200, { items: [ITEM_ALERT, MATERIAL_ALERT] })),
    });
    render(<StockAlertsPage />);

    const itemRow = await waitFor(() => rowOf("Ímã 6x3"));
    expect(within(itemRow).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Ímã 6x3",
      "4",
      "10",
      "un",
    ]);
    expect(within(itemRow).getByRole("link").getAttribute("href")).toBe("/inventory/items/item-1");

    const materialRow = rowOf("PLA · Voolt · Preto");
    expect(within(materialRow).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "PLA · Voolt · Preto",
      "800",
      "1000",
      "g",
    ]);
    expect(within(materialRow).getByRole("link").getAttribute("href")).toBe("/inventory");
  });

  it("shows the error and retries without a partial table", async () => {
    let alerts: Route = () => Promise.reject(new TypeError("Failed to fetch"));
    const fetchMock = stubApi({ "/inventory/alerts": (init) => alerts(init) });
    render(<StockAlertsPage />);

    expect((await screen.findByRole("alert")).textContent).toBe("Não foi possível conectar à API");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("row")).toBeNull();

    alerts = () => Promise.resolve(jsonResponse(200, { items: [ITEM_ALERT] }));
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Ímã 6x3")).toBeTruthy();
    expect(fetchMock.mock.calls).toHaveLength(2);
  });

  it("shows the empty state when nothing is below the minimum", async () => {
    stubApi({ "/inventory/alerts": () => Promise.resolve(jsonResponse(200, { items: [] })) });
    render(<StockAlertsPage />);

    expect(await screen.findByText("Nenhum item está abaixo do mínimo.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("sales sees the indicator and the read-only alert list", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, SALES_ME)),
      "/inventory/alerts": () =>
        Promise.resolve(jsonResponse(200, { items: [ITEM_ALERT, MATERIAL_ALERT] })),
    });
    render(
      <AuthGate>
        <StockAlertsPage />
      </AuthGate>,
    );

    const itemRow = await waitFor(() => rowOf("Ímã 6x3"));
    expect(itemRow).toBeTruthy();
    expect(rowOf("PLA · Voolt · Preto")).toBeTruthy();

    const header = screen.getByRole("banner");
    const indicator = within(header).getByText("2");
    expect(indicator.getAttribute("href")).toBe("/inventory/alerts");

    // Tela só de leitura: nenhuma ação de edição, para nenhum papel.
    const content = screen.getByRole("main");
    expect(within(content).queryAllByRole("button")).toEqual([]);
    expect(within(content).queryByRole("textbox")).toBeNull();
    expect(within(content).queryByRole("spinbutton")).toBeNull();
  });
});
