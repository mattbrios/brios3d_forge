import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SalesChannelsPage from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ADMIN_ME = { id: "u1", name: "Admin Um", email: "admin@test.local", role: "admin" };
const PRODUCTION_ME = { id: "u2", name: "Produção", email: "production@test.local", role: "production" };
const CHANNELS = [
  { id: "c1", name: "Balcão", taxRate: 0.1, feeRate: 0, active: true },
  { id: "c2", name: "Shopee", taxRate: 0.1, feeRate: 0.12, active: false },
];

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

describe("Sales channels page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("lists channels with name, rates and status", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/sales-channels": () => Promise.resolve(jsonResponse(200, CHANNELS)),
    });
    render(<SalesChannelsPage />);
    const rows = await screen.findAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText("Balcão")).toBeTruthy();
    expect(within(rows[1]).getByText("Ativo")).toBeTruthy();
    expect(within(rows[2]).getByText("Shopee")).toBeTruthy();
    expect(within(rows[2]).getByText("Inativo")).toBeTruthy();
    expect(within(rows[2]).getByText("0.12")).toBeTruthy();
  });

  it("shows the error and retries", async () => {
    let channels: Route = () => Promise.reject(new TypeError("Failed to fetch"));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/sales-channels": () => channels(),
    });
    render(<SalesChannelsPage />);
    expect(await screen.findByText("Não foi possível conectar à API")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Tentar novamente" });

    channels = () => Promise.resolve(jsonResponse(200, CHANNELS));
    fireEvent.click(retry);
    await screen.findByText("Balcão");
    expect(callsTo(fetchMock, "/sales-channels")).toHaveLength(2);
  });

  it("admin creates and toggles a channel without reloading", async () => {
    const created: Route = () =>
      Promise.resolve(
        jsonResponse(201, { id: "c3", name: "Loja física", taxRate: 0.05, feeRate: 0.01, active: true }),
      );
    const patched: Route = () => Promise.resolve(jsonResponse(200, { ...CHANNELS[0], active: false }));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/sales-channels": (init) =>
        init?.method === "POST" ? created() : Promise.resolve(jsonResponse(200, CHANNELS)),
      "/sales-channels/c1": () => patched(),
    });
    render(<SalesChannelsPage />);
    await screen.findByText("Balcão");

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Loja física" } });
    fireEvent.change(screen.getByLabelText("% imposto"), { target: { value: "0.05" } });
    fireEvent.change(screen.getByLabelText("% taxa"), { target: { value: "0.01" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar canal" }));
    await screen.findByText("Loja física");
    expect(bodyOf(callsTo(fetchMock, "/sales-channels").filter(([, i]) => i?.method === "POST")[0][1])).toEqual({
      name: "Loja física",
      taxRate: 0.05,
      feeRate: 0.01,
    });

    const row = (await screen.findByText("Balcão")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Desativar" }));
    await within(row).findByText("Inativo");
    expect(callsTo(fetchMock, "/sales-channels/c1")).toHaveLength(1);
  });

  it("non-admin sees the list without edit controls", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, PRODUCTION_ME)),
      "/sales-channels": () => Promise.resolve(jsonResponse(200, CHANNELS)),
    });
    render(<SalesChannelsPage />);
    await screen.findByText("Balcão");
    expect(screen.queryByRole("button", { name: "Criar canal" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desativar" })).toBeNull();
  });
});
