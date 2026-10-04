import { cleanup, fireEvent, getDefaultNormalizer, render, screen, within } from "@testing-library/react";
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
  active: true,
  minimumStockGrams: null,
  colorHex: null,
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

  describe("meter in the material tone", () => {
    const LABEL = "PLA · Marca A · Natural";
    const ROLL_BASE = {
      materialId: "m1",
      supplierId: null,
      nominalWeightGrams: 1000,
      initialWeightGrams: 1000,
      spoolTareGrams: 250,
      batch: null,
      purchaseDate: null,
      openedAt: null,
      discardedAt: null,
      location: null,
      acquisitionCostCents: 12000,
      status: "fechado",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const ROLLS = [
      { ...ROLL_BASE, id: "r1", balanceGrams: 800 },
      { ...ROLL_BASE, id: "r2", balanceGrams: 300 },
    ];

    function renderWith(material: Partial<Material>, balance = 500, materialId = "m1") {
      stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
        "/inventory/materials-summary": () =>
          Promise.resolve(
            jsonResponse(200, summary([{ materialId, totalBalanceGrams: balance, avgCostCentsPerGram: 10, rollCount: 2 }])),
          ),
        "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([{ ...MATERIAL_1, ...material }]))),
        [`/inventory/rolls?materialId=${materialId}&pageSize=100`]: () =>
          Promise.resolve(jsonResponse(200, { items: ROLLS, total: 2, page: 1, pageSize: 100 })),
      });
      render(<InventoryPage />);
    }

    async function rowOf(label: string) {
      return (await screen.findByText(label)).closest("li") as HTMLElement;
    }

    const rowMeter = (row: HTMLElement) => row.querySelector(".bf-meter") as HTMLElement;
    const rowFill = (row: HTMLElement) => row.querySelector(".bf-meter__fill") as HTMLElement;

    async function expandedRollFills() {
      fireEvent.click(await screen.findByRole("button", { name: "Ver rolos" }));
      await screen.findByText("r1");
      return Array.from(document.querySelectorAll<HTMLElement>(".bf-roll-card .bf-meter__fill"));
    }

    it("material row meter uses the material tone", async () => {
      renderWith({ colorHex: "#1e88e5", minimumStockGrams: null });
      const fill = rowFill(await rowOf(LABEL));
      expect(fill.style.background).toBe("rgb(30, 136, 229)");
      expect(fill.classList.contains("bf-meter__fill--outlined")).toBe(false);
    });

    it("material row without tone keeps the default fill", async () => {
      renderWith({ colorHex: null });
      expect(rowFill(await rowOf(LABEL)).style.background).toBe("");
    });

    it("low balance shows warning instead of the tone", async () => {
      renderWith({ colorHex: "#1e88e5", minimumStockGrams: 100 }, 60);
      const row = await rowOf(LABEL);
      expect(rowMeter(row).classList.contains("bf-meter--warning")).toBe(true);
      expect(rowFill(row).style.background).toBe("");
      expect(within(row).getByText("Abaixo do mínimo")).toBeTruthy();
    });

    it("critical balance shows danger instead of the tone", async () => {
      renderWith({ colorHex: "#1e88e5", minimumStockGrams: 100 }, 40);
      const row = await rowOf(LABEL);
      expect(rowMeter(row).classList.contains("bf-meter--danger")).toBe(true);
      expect(rowFill(row).style.background).toBe("");
      expect(within(row).getByText("Abaixo do mínimo")).toBeTruthy();
    });

    it("white tone row meter is outlined", async () => {
      renderWith({ colorHex: "#ffffff" });
      const fill = rowFill(await rowOf(LABEL));
      expect(fill.style.background).toBe("rgb(255, 255, 255)");
      expect(fill.classList.contains("bf-meter__fill--outlined")).toBe(true);
    });

    it("material missing from the list keeps the default fill", async () => {
      // O resumo traz m9, mas a lista carregada só tem m1 (com tom): o rótulo cai no id cru.
      renderWith({ colorHex: "#1e88e5" }, 500, "m9");
      expect(rowFill(await rowOf("m9")).style.background).toBe("");
    });

    it("expanded rolls use the material tone", async () => {
      renderWith({ colorHex: "#1e88e5" });
      const fills = await expandedRollFills();
      expect(fills).toHaveLength(2);
      expect(fills.map((fill) => fill.style.background)).toEqual(["rgb(30, 136, 229)", "rgb(30, 136, 229)"]);
    });

    it("expanded rolls without tone keep the default fill", async () => {
      renderWith({ colorHex: null });
      const fills = await expandedRollFills();
      expect(fills).toHaveLength(2);
      expect(fills.map((fill) => fill.style.background)).toEqual(["", ""]);
    });
  });

  describe("numbers in pt-BR (issue #9)", () => {
    const EXACT = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };
    const bodyOf = (init?: RequestInit) => JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const postCalls = (fetchMock: ReturnType<typeof stubApi>) =>
      callsTo(fetchMock, "/inventory/rolls").filter(([, init]) => init?.method === "POST");

    function renderAdmin(items: MaterialsSummary["items"] = [], minimumStockGrams: number | null = null) {
      const fetchMock = stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
        "/inventory/materials-summary": () => Promise.resolve(jsonResponse(200, summary(items))),
        "/materials?pageSize=100": () =>
          Promise.resolve(jsonResponse(200, materialsPage([{ ...MATERIAL_1, minimumStockGrams }]))),
        "/inventory/rolls": () => Promise.resolve(jsonResponse(201, { id: "r1" })),
      });
      render(<InventoryPage />);
      return fetchMock;
    }

    async function openCreate() {
      fireEvent.click(await screen.findByRole("button", { name: "Cadastrar rolo" }));
      fireEvent.change(screen.getByLabelText("Material"), { target: { value: "m1" } });
    }

    async function submitRoll(values: Record<string, string>) {
      await openCreate();
      const all = { "Peso inicial (g)": "1000", "Tara do carretel (g)": "200", "Custo de aquisição": "89,90", ...values };
      for (const [label, value] of Object.entries(all)) {
        fireEvent.change(screen.getByLabelText(label), { target: { value } });
      }
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    }

    it("acquisition cost is labelled in reais", async () => {
      renderAdmin();
      await openCreate();
      const input = screen.getByLabelText("Custo de aquisição") as HTMLInputElement;
      expect(input.parentElement?.textContent).toBe("R$");
      expect(screen.queryByText(/centavos/)).toBeNull();
    });

    it("sends the acquisition cost in cents", async () => {
      const fetchMock = renderAdmin();
      await submitRoll({ "Custo de aquisição": "89,90" });
      await vi.waitFor(() => expect(postCalls(fetchMock)).toHaveLength(1));
      expect(bodyOf(postCalls(fetchMock)[0][1] as RequestInit)).toMatchObject({ acquisitionCostCents: 8990 });
    });

    it("accepts a comma decimal weight", async () => {
      const fetchMock = renderAdmin();
      await submitRoll({ "Peso inicial (g)": "1,5" });
      await vi.waitFor(() => expect(postCalls(fetchMock)).toHaveLength(1));
      expect(bodyOf(postCalls(fetchMock)[0][1] as RequestInit)).toMatchObject({ initialWeightGrams: 1.5 });
    });

    it("rejects a malformed number without calling the API", async () => {
      const fetchMock = renderAdmin();
      await submitRoll({ "Peso inicial (g)": "1.800,90" });
      expect((await screen.findByRole("alert")).textContent).toBe(
        "Valor inválido em Peso inicial: use ponto ou vírgula apenas como separador decimal",
      );
      expect(postCalls(fetchMock)).toHaveLength(0);
    });

    it("rejects a blank required number without calling the API", async () => {
      const fetchMock = renderAdmin();
      await submitRoll({ "Peso inicial (g)": "" });
      expect((await screen.findByRole("alert")).textContent).toBe("Preencha Peso inicial");
      expect(postCalls(fetchMock)).toHaveLength(0);
    });

    it("reports the first invalid field", async () => {
      const fetchMock = renderAdmin();
      await submitRoll({ "Peso inicial (g)": "1.2.3", "Tara do carretel (g)": "abc" });
      expect((await screen.findByRole("alert")).textContent).toBe(
        "Valor inválido em Peso inicial: use ponto ou vírgula apenas como separador decimal",
      );
      expect(postCalls(fetchMock)).toHaveLength(0);
    });

    it("average cost per gram with 4 decimals", async () => {
      renderAdmin([{ materialId: "m1", totalBalanceGrams: 500, avgCostCentsPerGram: 12.34, rollCount: 1 }]);
      expect(await screen.findByText("1 rolo(s) · R$\u00A00,1234/g", EXACT)).toBeTruthy();
    });

    it("balance in pt-BR", async () => {
      renderAdmin([{ materialId: "m1", totalBalanceGrams: 1800, avgCostCentsPerGram: 10, rollCount: 2 }]);
      expect(await screen.findByText("1.800 g")).toBeTruthy();
    });
  });
});
