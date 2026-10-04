import { cleanup, fireEvent, getDefaultNormalizer, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Printer } from "@/lib/printers";
import PrintersPage from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ADMIN_ME = { id: "u1", name: "Admin Um", email: "admin@test.local", role: "admin" };
const PRODUCTION_ME = { id: "u2", name: "Produção", email: "production@test.local", role: "production" };
const SALES_ME = { id: "u3", name: "Vendas", email: "sales@test.local", role: "sales" };

const PRINTER_1: Printer = {
  id: "p1",
  name: "X2D",
  acquisitionCostCents: 500000,
  lifespanHours: 10000,
  powerWatts: 250,
  hourmeterHours: 0,
  nozzles: [{ diameterMm: 0.4, type: "Hardened Steel" }],
  hasAms: false,
  amsSlots: null,
  active: true,
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

const bodyOf = (init?: RequestInit) => JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
const callsTo = (fetchMock: ReturnType<typeof stubApi>, path: string) =>
  fetchMock.mock.calls.filter(([url]) => (url as string).endsWith(path));
const page = (items: Printer[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

describe("Printers page", () => {
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
      "/printers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([]))),
    });
    render(<PrintersPage />);
    expect(screen.getByText("Carregando…")).toBeTruthy();
    resolveMe(jsonResponse(200, ADMIN_ME));
    await screen.findByText("Nenhuma impressora encontrada.");
  });

  it("shows the error and retries", async () => {
    let printersRoute: Route = () => Promise.reject(new TypeError("Failed to fetch"));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/printers?pageSize=100": () => printersRoute(),
    });
    render(<PrintersPage />);
    expect(await screen.findByText("Não foi possível conectar à API")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Tentar novamente" });

    printersRoute = () => Promise.resolve(jsonResponse(200, page([PRINTER_1])));
    fireEvent.click(retry);
    await screen.findByText("X2D");
    expect(callsTo(fetchMock, "/printers?pageSize=100")).toHaveLength(2);
  });

  it("shows an empty state when there are no printers", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/printers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([]))),
    });
    render(<PrintersPage />);
    expect(await screen.findByText("Nenhuma impressora encontrada.")).toBeTruthy();
    expect(screen.queryByText("Não foi possível conectar à API")).toBeNull();
  });

  it("sales sees only the read-only list", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, SALES_ME)),
      "/printers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([PRINTER_1]))),
    });
    render(<PrintersPage />);
    await screen.findByText("X2D");
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desativar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ajustar horímetro" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("production sees only the hourmeter control", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, PRODUCTION_ME)),
      "/printers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([PRINTER_1]))),
    });
    render(<PrintersPage />);
    await screen.findByText("X2D");
    expect(screen.getByRole("button", { name: "Ajustar horímetro" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desativar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("confirms before deactivating", async () => {
    const patched: Route = () => Promise.resolve(jsonResponse(200, { ...PRINTER_1, active: false }));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/printers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([PRINTER_1]))),
      "/printers/p1": () => patched(),
    });
    render(<PrintersPage />);
    const row = (await screen.findByText("X2D")).closest("tr")!;

    fireEvent.click(within(row).getByRole("button", { name: "Desativar" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(callsTo(fetchMock, "/printers/p1")).toHaveLength(0);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(within(row).getByRole("button", { name: "Desativar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desativar" }));
    await within(row).findByText("Inativo");
    expect(callsTo(fetchMock, "/printers/p1")).toHaveLength(1);
    expect(bodyOf(callsTo(fetchMock, "/printers/p1")[0][1])).toEqual({ active: false });
  });

  it("admin and production adjust the hourmeter without reloading", async () => {
    for (const me of [ADMIN_ME, PRODUCTION_ME]) {
      const patched: Route = () => Promise.resolve(jsonResponse(200, { ...PRINTER_1, hourmeterHours: 120.5 }));
      const fetchMock = stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, me)),
        "/printers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([PRINTER_1]))),
        "/printers/p1/hourmeter": () => patched(),
      });
      render(<PrintersPage />);
      const row = (await screen.findByText("X2D")).closest("tr")!;

      fireEvent.change(within(row).getByLabelText("Horímetro (h)"), { target: { value: "120.5" } });
      fireEvent.click(within(row).getByRole("button", { name: "Ajustar horímetro" }));

      await within(row).findByText("120,5");
      expect(callsTo(fetchMock, "/printers/p1/hourmeter")).toHaveLength(1);
      expect(bodyOf(callsTo(fetchMock, "/printers/p1/hourmeter")[0][1])).toEqual({ hourmeterHours: 120.5 });
      expect(callsTo(fetchMock, "/printers?pageSize=100")).toHaveLength(1);
      cleanup();
    }
  });

  describe("numbers in pt-BR (issue #9)", () => {
    const EXACT = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };
    const postCalls = (fetchMock: ReturnType<typeof stubApi>) =>
      callsTo(fetchMock, "/printers").filter(([, init]) => init?.method === "POST");

    function renderAdmin(printers: Printer[], post?: Route) {
      const fetchMock = stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
        "/printers?pageSize=100": () => Promise.resolve(jsonResponse(200, page(printers))),
        "/printers": post ?? ((init) => Promise.resolve(jsonResponse(201, { ...PRINTER_1, id: "p9", ...bodyOf(init) }))),
      });
      render(<PrintersPage />);
      return fetchMock;
    }

    async function fillCreate(values: Record<string, string>) {
      await screen.findByLabelText("Nome");
      const all = { Nome: "P1S", "Custo de aquisição": "5000", "Vida útil (h)": "10000", "Potência (W)": "250", ...values };
      for (const [label, value] of Object.entries(all)) {
        fireEvent.change(screen.getByLabelText(label), { target: { value } });
      }
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    }

    it("acquisition cost is labelled in reais", async () => {
      renderAdmin([]);
      const input = (await screen.findByLabelText("Custo de aquisição")) as HTMLInputElement;
      expect(input.parentElement?.textContent).toBe("R$");
      expect(screen.queryByText(/centavos/)).toBeNull();
    });

    it("dot is always the decimal separator", async () => {
      const fetchMock = renderAdmin([]);
      await fillCreate({ "Custo de aquisição": "1.50" });
      await screen.findByText("P1S");
      expect(bodyOf(postCalls(fetchMock)[0][1] as RequestInit)).toMatchObject({ acquisitionCostCents: 150 });
    });

    it("rejects more than 2 decimals without calling the API", async () => {
      const fetchMock = renderAdmin([]);
      await fillCreate({ "Custo de aquisição": "10,123" });
      expect((await screen.findByRole("alert")).textContent).toBe(
        "Valor inválido em Custo de aquisição: use no máximo 2 casas decimais",
      );
      expect(postCalls(fetchMock)).toHaveLength(0);
    });

    it("integer fields send decimals and show the API error", async () => {
      const fetchMock = renderAdmin([], () =>
        Promise.resolve(jsonResponse(400, { error: "powerWatts must be an integer number" })),
      );
      await fillCreate({ "Potência (W)": "1,5" });
      expect((await screen.findByRole("alert")).textContent).toBe("powerWatts must be an integer number");
      expect(bodyOf(postCalls(fetchMock)[0][1] as RequestInit)).toMatchObject({ powerWatts: 1.5 });
    });

    it("edit form shows the cost in reais", async () => {
      renderAdmin([{ ...PRINTER_1, acquisitionCostCents: 8990 }]);
      const row = (await screen.findByText("X2D")).closest("tr")!;
      fireEvent.click(within(row).getByRole("button", { name: "Editar" }));
      expect(screen.getAllByLabelText("Custo de aquisição").map((input) => (input as HTMLInputElement).value)).toContain(
        "89,90",
      );
    });

    it("cost column in reais", async () => {
      renderAdmin([{ ...PRINTER_1, acquisitionCostCents: 899000 }]);
      const row = (await screen.findByText("X2D")).closest("tr")!;
      expect(within(row).getByText("R$\u00A08.990,00", EXACT)).toBeTruthy();
    });

    it("quantities in pt-BR", async () => {
      renderAdmin([{ ...PRINTER_1, lifespanHours: 20000 }]);
      const row = (await screen.findByText("X2D")).closest("tr")!;
      expect(within(row).getByText("20.000")).toBeTruthy();
    });

    it("ams slots are not grouped", async () => {
      renderAdmin([{ ...PRINTER_1, hasAms: true, amsSlots: 1000 }]);
      const row = (await screen.findByText("X2D")).closest("tr")!;
      expect(within(row).getByText("Sim (1000)")).toBeTruthy();
    });
  });
});
