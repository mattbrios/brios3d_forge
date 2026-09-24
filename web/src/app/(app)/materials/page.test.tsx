import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Material } from "@/lib/materials";
import MaterialsPage from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ADMIN_ME = { id: "u1", name: "Admin Um", email: "admin@test.local", role: "admin" };
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
  minimumStockGrams: null,
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
const page = (items: Material[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

describe("Materials page", () => {
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
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([]))),
    });
    render(<MaterialsPage />);
    expect(screen.getByText("Carregando…")).toBeTruthy();
    resolveMe(jsonResponse(200, ADMIN_ME));
    await screen.findByText("Nenhum material encontrado.");
  });

  it("shows the error and retries", async () => {
    let materialsRoute: Route = () => Promise.reject(new TypeError("Failed to fetch"));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/materials?pageSize=100": () => materialsRoute(),
    });
    render(<MaterialsPage />);
    expect(await screen.findByText("Não foi possível conectar à API")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Tentar novamente" });

    materialsRoute = () => Promise.resolve(jsonResponse(200, page([MATERIAL_1])));
    fireEvent.click(retry);
    await screen.findByText("PLA");
    expect(callsTo(fetchMock, "/materials?pageSize=100")).toHaveLength(2);
  });

  it("shows an empty state when there are no materials", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([]))),
    });
    render(<MaterialsPage />);
    expect(await screen.findByText("Nenhum material encontrado.")).toBeTruthy();
    expect(screen.queryByText("Não foi possível conectar à API")).toBeNull();
  });

  it("non-admin sees the list without edit controls", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, PRODUCTION_ME)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([MATERIAL_1]))),
    });
    render(<MaterialsPage />);
    await screen.findByText("PLA");
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desativar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("confirms before deactivating", async () => {
    const patched: Route = () => Promise.resolve(jsonResponse(200, { ...MATERIAL_1, active: false }));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([MATERIAL_1]))),
      "/materials/m1": () => patched(),
    });
    render(<MaterialsPage />);
    const row = (await screen.findByText("PLA")).closest("tr")!;

    fireEvent.click(within(row).getByRole("button", { name: "Desativar" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(callsTo(fetchMock, "/materials/m1")).toHaveLength(0);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(within(row).getByRole("button", { name: "Desativar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desativar" }));
    await within(row).findByText("Inativo");
    expect(callsTo(fetchMock, "/materials/m1")).toHaveLength(1);
    expect(bodyOf(callsTo(fetchMock, "/materials/m1")[0][1])).toEqual({ active: false });
  });

  it("shows the create error without reloading the list", async () => {
    const failed: Route = () => Promise.resolve(jsonResponse(400, { error: "densityGCm3 must not be greater than 10" }));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([MATERIAL_1]))),
      "/materials": (init) => (init?.method === "POST" ? failed() : Promise.reject(new Error("rota inesperada"))),
    });
    render(<MaterialsPage />);
    await screen.findByText("PLA");

    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "ABS" } });
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Marca X" } });
    fireEvent.change(screen.getByLabelText("Cor"), { target: { value: "Preto" } });
    fireEvent.change(screen.getByLabelText("Densidade (g/cm³)"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Temperatura do bico (°C)"), { target: { value: "240" } });
    fireEvent.change(screen.getByLabelText("Temperatura da mesa (°C)"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("densityGCm3 must not be greater than 10")).toBeTruthy();
    expect(screen.getByText("PLA")).toBeTruthy();
    expect(screen.queryByText("ABS")).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => (url as string).endsWith("/materials?pageSize=100"))).toBe(true);
    expect(callsTo(fetchMock, "/materials?pageSize=100")).toHaveLength(1);
  });

  it("admin creates a material without reloading", async () => {
    const created: Route = () =>
      Promise.resolve(
        jsonResponse(201, {
          id: "m3",
          type: "ABS",
          brand: "Marca X",
          color: "Preto",
          densityGCm3: 1.05,
          nozzleTempC: 240,
          bedTempC: 90,
          needsDrying: false,
          dryingTemperatureC: null,
          dryingHours: null,
          active: true,
          minimumStockGrams: null,
        }),
      );
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([MATERIAL_1]))),
      "/materials": (init) => (init?.method === "POST" ? created() : Promise.reject(new Error("rota inesperada"))),
    });
    render(<MaterialsPage />);
    await screen.findByText("PLA");

    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "ABS" } });
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Marca X" } });
    fireEvent.change(screen.getByLabelText("Cor"), { target: { value: "Preto" } });
    fireEvent.change(screen.getByLabelText("Densidade (g/cm³)"), { target: { value: "1.05" } });
    fireEvent.change(screen.getByLabelText("Temperatura do bico (°C)"), { target: { value: "240" } });
    fireEvent.change(screen.getByLabelText("Temperatura da mesa (°C)"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await screen.findByText("ABS");
    const postCalls = callsTo(fetchMock, "/materials").filter(([, init]) => init?.method === "POST");
    expect(postCalls).toHaveLength(1);
    expect(bodyOf(postCalls[0][1])).toEqual({
      type: "ABS",
      brand: "Marca X",
      color: "Preto",
      densityGCm3: 1.05,
      nozzleTempC: 240,
      bedTempC: 90,
      needsDrying: false,
      // Fase 11: campo vazio vira `null` explícito, que é o que limpa a política no PATCH.
      minimumStockGrams: null,
    });
  });

  it("admin edits a material without reloading", async () => {
    const patched: Route = () => Promise.resolve(jsonResponse(200, { ...MATERIAL_1, color: "Vermelho" }));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([MATERIAL_1]))),
      "/materials/m1": () => patched(),
    });
    render(<MaterialsPage />);
    const row = (await screen.findByText("PLA")).closest("tr")!;

    fireEvent.click(within(row).getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Cor"), { target: { value: "Vermelho" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await within(row).findByText("Vermelho");
    expect(callsTo(fetchMock, "/materials/m1")).toHaveLength(1);
  });
});
