import { cleanup, fireEvent, getDefaultNormalizer, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Mantém o espaço não separável do `Intl` ("R$\u00A010,50") na comparação.
const EXACT = { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) };

const ADMIN_ME = { id: "u1", name: "Admin Um", email: "admin@test.local", role: "admin" };
const SALES_ME = { id: "u2", name: "Vendas", email: "sales@test.local", role: "sales" };
const SETTINGS = {
  energyTariffCentsPerKwh: 80,
  laborCentsPerHour: 2000,
  defaultMarginRate: 0.3,
  failureRate: 0.05,
  purgeRate: 0.02,
  maintenanceCentsPerHour: 100,
  productiveHoursPerMonth: 160,
  fixedCostItems: [],
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

describe("Settings page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows loading", () => {
    stubApi({
      "/auth/me": () => new Promise(() => undefined),
      "/settings": () => Promise.resolve(jsonResponse(200, SETTINGS)),
    });
    render(<SettingsPage />);
    expect(screen.getByText("Carregando…")).toBeTruthy();
  });

  it("shows the error and retries", async () => {
    let settings: Route = () => Promise.reject(new TypeError("Failed to fetch"));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/settings": () => settings(),
    });
    render(<SettingsPage />);
    expect(await screen.findByText("Não foi possível conectar à API")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Tentar novamente" });

    settings = () => Promise.resolve(jsonResponse(200, SETTINGS));
    fireEvent.click(retry);
    await screen.findByLabelText("Tarifa de energia (por kWh)");
    expect(callsTo(fetchMock, "/settings")).toHaveLength(2);
  });

  it("admin edits and saves without reloading", async () => {
    const updated = { ...SETTINGS, energyTariffCentsPerKwh: 150 };
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/settings": (init) =>
        init?.method === "PATCH"
          ? Promise.resolve(jsonResponse(200, updated))
          : Promise.resolve(jsonResponse(200, SETTINGS)),
    });
    render(<SettingsPage />);
    const input = await screen.findByLabelText("Tarifa de energia (por kWh)");
    expect((input as HTMLInputElement).value).toBe("0,80");

    fireEvent.change(input, { target: { value: "1,50" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await screen.findByDisplayValue("1,50");
    expect(callsTo(fetchMock, "/settings").filter(([, init]) => init?.method === "PATCH")).toHaveLength(1);
    const [, init] = callsTo(fetchMock, "/settings").filter(([, i]) => i?.method === "PATCH")[0];
    expect(bodyOf(init as RequestInit)).toMatchObject({ energyTariffCentsPerKwh: 150 });
  });

  it("non-admin sees read-only values", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, SALES_ME)),
      "/settings": () => Promise.resolve(jsonResponse(200, SETTINGS)),
    });
    render(<SettingsPage />);
    expect(await screen.findByText("R$\u00A00,80/kWh", EXACT)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  describe("values in reais (issue #9)", () => {
    const patchCalls = (fetchMock: ReturnType<typeof stubApi>) =>
      callsTo(fetchMock, "/settings").filter(([, init]) => init?.method === "PATCH");

    function renderAs(me: typeof ADMIN_ME, settings: unknown = SETTINGS) {
      const fetchMock = stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, me)),
        "/settings": (init) =>
          init?.method === "PATCH"
            ? Promise.resolve(jsonResponse(200, { ...SETTINGS, ...bodyOf(init) }))
            : Promise.resolve(jsonResponse(200, settings)),
      });
      render(<SettingsPage />);
      return fetchMock;
    }

    it("money fields are labelled in reais", async () => {
      renderAs(ADMIN_ME);
      for (const label of ["Tarifa de energia (por kWh)", "Hora de trabalho", "Manutenção (por hora)"]) {
        const input = (await screen.findByLabelText(label)) as HTMLInputElement;
        expect(input.parentElement?.textContent).toBe("R$");
      }
      expect(screen.queryByText(/centavos/)).toBeNull();
    });

    it("sends the energy tariff in cents with 4 decimals", async () => {
      const fetchMock = renderAs(ADMIN_ME);
      fireEvent.change(await screen.findByLabelText("Tarifa de energia (por kWh)"), { target: { value: "0,8732" } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
      await screen.findByDisplayValue("0,8732");
      expect(bodyOf(patchCalls(fetchMock)[0][1] as RequestInit)).toMatchObject({ energyTariffCentsPerKwh: 87.32 });
    });

    it("rejects more than 4 decimals in the tariff without calling the API", async () => {
      const fetchMock = renderAs(ADMIN_ME);
      fireEvent.change(await screen.findByLabelText("Tarifa de energia (por kWh)"), { target: { value: "0,87321" } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
      expect((await screen.findByRole("alert")).textContent).toBe(
        "Valor inválido em Tarifa de energia: use no máximo 4 casas decimais",
      );
      expect(patchCalls(fetchMock)).toHaveLength(0);
    });

    it("prefills the tariff in reais with 4 decimals", async () => {
      renderAs(ADMIN_ME, { ...SETTINGS, energyTariffCentsPerKwh: 87.32 });
      const input = (await screen.findByLabelText("Tarifa de energia (por kWh)")) as HTMLInputElement;
      expect(input.value).toBe("0,8732");
    });

    it("fixed cost total in pt-BR", async () => {
      renderAs(ADMIN_ME, {
        ...SETTINGS,
        fixedCostItems: [
          { id: "f1", name: "Aluguel", monthlyCents: 150000 },
          { id: "f2", name: "Internet", monthlyCents: 30050 },
        ],
      });
      expect(await screen.findByText("R$\u00A01.800,50", EXACT)).toBeTruthy();
    });

    it("read only view formats money", async () => {
      renderAs(SALES_ME, { ...SETTINGS, laborCentsPerHour: 4500, energyTariffCentsPerKwh: 87.32 });
      expect(await screen.findByText("R$\u00A045,00", EXACT)).toBeTruthy();
      expect(screen.getByText("R$\u00A00,8732/kWh", EXACT)).toBeTruthy();
    });
  });
});
