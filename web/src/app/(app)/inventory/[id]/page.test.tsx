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
const ADMIN_ME = { id: "u1", name: "Ana", email: "admin@test.local", role: "admin" };

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
      quantity: 1000,
      unitCostCents: 12,
      reason: null,
      userId: "u1",
      createdAt: "2026-01-01T00:00:00.000Z",
      rollId: "r1",
      stockItemId: null,
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
    expect(screen.queryByRole("button", { name: "Descartar" })).toBeNull();
  });

  it("renders the movement history from the renamed keys", async () => {
    // Fase 10, door 4: a tela do rolo lê `quantity`/`unitCostCents`. Sem esta prova, a renomeação
    // deixaria as duas colunas vazias com a suíte verde.
    const withTwoMovements = {
      ...ROLL,
      movements: [
        ...ROLL.movements,
        {
          id: "mv2",
          type: "consumo" as const,
          quantity: -200,
          unitCostCents: null,
          reason: null,
          userId: "u2",
          createdAt: "2026-01-02T00:00:00.000Z",
          rollId: "r1",
          stockItemId: null,
        },
      ],
    };
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, PRODUCTION_ME)),
      "/inventory/rolls/r1": () => Promise.resolve(jsonResponse(200, withTwoMovements)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([MATERIAL_1]))),
    });
    render(<RollDetailPage params={Promise.resolve({ id: "r1" })} />);

    const entryRow = (await screen.findByText("entrada")).closest("tr") as HTMLTableRowElement;
    const entryCells = within(entryRow).getAllByRole("cell").map((cell) => cell.textContent);
    expect(entryCells).toEqual([
      "entrada",
      "1.000",
      "R$\u00A00,12",
      new Date("2026-01-01T00:00:00.000Z").toLocaleString("pt-BR"),
    ]);

    const consumoRow = screen.getByText("consumo").closest("tr") as HTMLTableRowElement;
    const consumoCells = within(consumoRow).getAllByRole("cell").map((cell) => cell.textContent);
    expect(consumoCells[1]).toBe("-200");
    expect(consumoCells[2]).toBe("—");
  });

  it("offers a link to print the roll label", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, PRODUCTION_ME)),
      "/inventory/rolls/r1": () => Promise.resolve(jsonResponse(200, ROLL)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([MATERIAL_1]))),
    });
    render(<RollDetailPage params={Promise.resolve({ id: "r1" })} />);

    const link = await screen.findByRole("link", { name: "Imprimir etiqueta" });
    expect(link.getAttribute("href")).toBe("/inventory/r1/label");
  });

  it("admin and production see the weigh and movement forms on the roll page", async () => {
    // O QR aterriza aqui (AC 38): pesar e dar baixa têm de estar na própria página, sem uma
    // navegação a mais no celular.
    for (const me of [ADMIN_ME, PRODUCTION_ME]) {
      stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, me)),
        "/inventory/rolls/r1": () => Promise.resolve(jsonResponse(200, ROLL)),
        "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([MATERIAL_1]))),
      });
      render(<RollDetailPage params={Promise.resolve({ id: "r1" })} />);

      expect(await screen.findByRole("button", { name: "Pesar" }), me.role).toBeTruthy();
      expect(screen.getByLabelText("Peso bruto na balança (g)"), me.role).toBeTruthy();
      expect(screen.getByRole("button", { name: "Dar baixa" }), me.role).toBeTruthy();
      expect(screen.getByLabelText("Gramas"), me.role).toBeTruthy();
      cleanup();
    }
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

  it("offers editing only to admin and production on a roll that is not discarded", async () => {
    const cases = [
      { me: ADMIN_ME, roll: ROLL, visible: true },
      { me: PRODUCTION_ME, roll: ROLL, visible: true },
      { me: SALES_ME, roll: ROLL, visible: false },
      {
        me: ADMIN_ME,
        roll: { ...ROLL, balanceGrams: 0, status: "descartado" as const, discardedAt: "2026-01-02T00:00:00.000Z" },
        visible: false,
      },
    ];
    for (const { me, roll, visible } of cases) {
      stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, me)),
        "/inventory/rolls/r1": () => Promise.resolve(jsonResponse(200, roll)),
        "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([MATERIAL_1]))),
      });
      render(<RollDetailPage params={Promise.resolve({ id: "r1" })} />);

      await screen.findByText("entrada");
      const label = `${me.role} ${roll.status}`;
      expect(screen.queryByRole("button", { name: "Editar" }) !== null, label).toBe(visible);
      cleanup();
    }
  });

  it("edits the roll, sending blank text fields as null, and reloads it", async () => {
    let patchBody: unknown = null;
    let currentRoll: RollDetail = { ...ROLL, batch: "L-01", location: "Prateleira A", purchaseDate: "2026-09-01" };
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, PRODUCTION_ME)),
      "/inventory/rolls/r1": (init) => {
        if (init?.method === "PATCH") {
          patchBody = JSON.parse(init.body as string);
          currentRoll = { ...currentRoll, spoolTareGrams: 180, batch: null, location: "Prateleira B" };
        }
        return Promise.resolve(jsonResponse(200, currentRoll));
      },
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([MATERIAL_1]))),
    });
    render(<RollDetailPage params={Promise.resolve({ id: "r1" })} />);

    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    expect((screen.getByLabelText("Tara do carretel (g)") as HTMLInputElement).value).toBe("250");
    expect((screen.getByLabelText("Lote") as HTMLInputElement).value).toBe("L-01");

    fireEvent.change(screen.getByLabelText("Tara do carretel (g)"), { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText("Lote"), { target: { value: "  " } });
    fireEvent.change(screen.getByLabelText("Localização"), { target: { value: "Prateleira B" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("180 g")).toBeTruthy();
    expect(patchBody).toEqual({
      spoolTareGrams: 180,
      nominalWeightGrams: 1000,
      batch: null,
      location: "Prateleira B",
      purchaseDate: "2026-09-01",
    });
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
    expect(callsTo(fetchMock, "/inventory/rolls/r1").filter(([, init]) => init?.method === "PATCH")).toHaveLength(1);
  });

  it("keeps the edit form open with the API error message", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/inventory/rolls/r1": (init) =>
        Promise.resolve(
          init?.method === "PATCH"
            ? jsonResponse(409, { error: "Rolo já descartado" })
            : jsonResponse(200, ROLL),
        ),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([MATERIAL_1]))),
    });
    render(<RollDetailPage params={Promise.resolve({ id: "r1" })} />);

    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Rolo já descartado");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeTruthy();
  });

  it("cancelling the edit closes the form without calling the API", async () => {
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/inventory/rolls/r1": () => Promise.resolve(jsonResponse(200, ROLL)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([MATERIAL_1]))),
    });
    render(<RollDetailPage params={Promise.resolve({ id: "r1" })} />);

    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
    expect(callsTo(fetchMock, "/inventory/rolls/r1").filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
  });

  describe("numbers in pt-BR (issue #9)", () => {
    function renderRoll(roll: RollDetail) {
      stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, PRODUCTION_ME)),
        "/inventory/rolls/r1": () => Promise.resolve(jsonResponse(200, roll)),
        "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([MATERIAL_1]))),
      });
      render(<RollDetailPage params={Promise.resolve({ id: "r1" })} />);
    }
    const consumo = { ...ROLL.movements[0], id: "mv2", type: "consumo" as const, quantity: -1200, unitCostCents: null };

    it("edit form shows the tare without grouping", async () => {
      renderRoll({ ...ROLL, spoolTareGrams: 1800 });
      fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
      expect((screen.getByLabelText("Tara do carretel (g)") as HTMLInputElement).value).toBe("1800");
    });

    it("movement cost in reais", async () => {
      renderRoll({ ...ROLL, movements: [{ ...ROLL.movements[0], unitCostCents: 12.34 }] });
      const row = (await screen.findByText("entrada")).closest("tr") as HTMLTableRowElement;
      expect(within(row).getAllByRole("cell")[2].textContent).toBe("R$\u00A00,1234");
    });

    it("quantities in pt-BR", async () => {
      renderRoll({ ...ROLL, balanceGrams: 1800, movements: [consumo] });
      expect(await screen.findByText("1.800 g")).toBeTruthy();
      const row = screen.getByText("consumo").closest("tr") as HTMLTableRowElement;
      expect(within(row).getAllByRole("cell")[1].textContent).toBe("-1.200");
    });
  });
});
