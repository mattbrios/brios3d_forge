import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Supplier } from "@/lib/suppliers";
import SuppliersPage from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ADMIN_ME = { id: "u1", name: "Admin Um", email: "admin@test.local", role: "admin" };
const SALES_ME = { id: "u2", name: "Vendas", email: "sales@test.local", role: "sales" };
const PRODUCTION_ME = { id: "u3", name: "Produção", email: "production@test.local", role: "production" };

const SUPPLIER_1: Supplier = {
  id: "s1",
  name: "Filamentos ABC",
  document: null,
  phone: null,
  email: null,
  address: null,
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
const page = (items: Supplier[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

describe("Suppliers page", () => {
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
      "/suppliers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([]))),
    });
    render(<SuppliersPage />);
    expect(screen.getByText("Carregando…")).toBeTruthy();
    resolveMe(jsonResponse(200, ADMIN_ME));
    await screen.findByText("Nenhum fornecedor encontrado.");
  });

  it("shows the error and retries", async () => {
    let suppliersRoute: Route = () => Promise.reject(new TypeError("Failed to fetch"));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/suppliers?pageSize=100": () => suppliersRoute(),
    });
    render(<SuppliersPage />);
    expect(await screen.findByText("Não foi possível conectar à API")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Tentar novamente" });

    suppliersRoute = () => Promise.resolve(jsonResponse(200, page([SUPPLIER_1])));
    fireEvent.click(retry);
    await screen.findByText("Filamentos ABC");
    expect(callsTo(fetchMock, "/suppliers?pageSize=100")).toHaveLength(2);
  });

  it("shows an empty state when there are no suppliers", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/suppliers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([]))),
    });
    render(<SuppliersPage />);
    expect(await screen.findByText("Nenhum fornecedor encontrado.")).toBeTruthy();
    expect(screen.queryByText("Não foi possível conectar à API")).toBeNull();
  });

  it("production and sales see only the read-only list", async () => {
    for (const me of [PRODUCTION_ME, SALES_ME]) {
      stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, me)),
        "/suppliers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([SUPPLIER_1]))),
      });
      render(<SuppliersPage />);
      await screen.findByText("Filamentos ABC");
      expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Desativar" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
      cleanup();
    }
  });

  it("confirms before deactivating", async () => {
    const patched: Route = () => Promise.resolve(jsonResponse(200, { ...SUPPLIER_1, active: false }));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/suppliers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([SUPPLIER_1]))),
      "/suppliers/s1": () => patched(),
    });
    render(<SuppliersPage />);
    const row = (await screen.findByText("Filamentos ABC")).closest("tr")!;

    fireEvent.click(within(row).getByRole("button", { name: "Desativar" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(callsTo(fetchMock, "/suppliers/s1")).toHaveLength(0);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(within(row).getByRole("button", { name: "Desativar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desativar" }));
    await within(row).findByText("Inativo");
    expect(callsTo(fetchMock, "/suppliers/s1")).toHaveLength(1);
    expect(bodyOf(callsTo(fetchMock, "/suppliers/s1")[0][1])).toEqual({ active: false });
  });

  it("updates the row without reloading", async () => {
    const created: Route = () =>
      Promise.resolve(
        jsonResponse(201, {
          id: "s2",
          name: "Novo Fornecedor",
          document: null,
          phone: null,
          email: null,
          address: null,
          active: true,
        }),
      );
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/suppliers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([SUPPLIER_1]))),
      "/suppliers": (init) => (init?.method === "POST" ? created() : Promise.reject(new Error("rota inesperada"))),
    });
    render(<SuppliersPage />);
    await screen.findByText("Filamentos ABC");

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Novo Fornecedor" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await screen.findByText("Novo Fornecedor");
    expect(callsTo(fetchMock, "/suppliers").filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(screen.queryByText("Não foi possível conectar à API")).toBeNull();
  });
});
