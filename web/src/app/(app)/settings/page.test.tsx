import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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
    await screen.findByLabelText("Tarifa de energia (centavos/kWh)");
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
    const input = await screen.findByLabelText("Tarifa de energia (centavos/kWh)");
    expect((input as HTMLInputElement).value).toBe("80");

    fireEvent.change(input, { target: { value: "150" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await screen.findByDisplayValue("150");
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
    expect(await screen.findByText("80")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });
});
