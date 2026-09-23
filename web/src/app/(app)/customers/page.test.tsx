import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Customer } from "@/lib/customers";
import CustomersPage from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ADMIN_ME = { id: "u1", name: "Admin Um", email: "admin@test.local", role: "admin" };
const SALES_ME = { id: "u2", name: "Vendas", email: "sales@test.local", role: "sales" };
const PRODUCTION_ME = { id: "u3", name: "Produção", email: "production@test.local", role: "production" };

const CUSTOMER_1: Customer = {
  id: "c1",
  name: "Ana Silva",
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
const page = (items: Customer[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

describe("Customers page", () => {
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
      "/customers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([]))),
    });
    render(<CustomersPage />);
    expect(screen.getByText("Carregando…")).toBeTruthy();
    resolveMe(jsonResponse(200, ADMIN_ME));
    await screen.findByText("Nenhum cliente encontrado.");
  });

  it("shows the error and retries", async () => {
    let customersRoute: Route = () => Promise.reject(new TypeError("Failed to fetch"));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/customers?pageSize=100": () => customersRoute(),
    });
    render(<CustomersPage />);
    expect(await screen.findByText("Não foi possível conectar à API")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Tentar novamente" });

    customersRoute = () => Promise.resolve(jsonResponse(200, page([CUSTOMER_1])));
    fireEvent.click(retry);
    await screen.findByText("Ana Silva");
    expect(callsTo(fetchMock, "/customers?pageSize=100")).toHaveLength(2);
  });

  it("shows an empty state when there are no customers", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/customers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([]))),
    });
    render(<CustomersPage />);
    expect(await screen.findByText("Nenhum cliente encontrado.")).toBeTruthy();
    expect(screen.queryByText("Não foi possível conectar à API")).toBeNull();
  });

  it("production sees only the read-only list", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, PRODUCTION_ME)),
      "/customers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([CUSTOMER_1]))),
    });
    render(<CustomersPage />);
    await screen.findByText("Ana Silva");
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desativar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("confirms before deactivating", async () => {
    for (const me of [ADMIN_ME, SALES_ME]) {
      const patched: Route = () => Promise.resolve(jsonResponse(200, { ...CUSTOMER_1, active: false }));
      const fetchMock = stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, me)),
        "/customers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([CUSTOMER_1]))),
        "/customers/c1": () => patched(),
      });
      render(<CustomersPage />);
      const row = (await screen.findByText("Ana Silva")).closest("tr")!;

      fireEvent.click(within(row).getByRole("button", { name: "Desativar" }));
      const dialog = screen.getByRole("dialog");
      fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
      expect(callsTo(fetchMock, "/customers/c1")).toHaveLength(0);
      expect(screen.queryByRole("dialog")).toBeNull();

      fireEvent.click(within(row).getByRole("button", { name: "Desativar" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desativar" }));
      await within(row).findByText("Inativo");
      expect(callsTo(fetchMock, "/customers/c1")).toHaveLength(1);
      expect(bodyOf(callsTo(fetchMock, "/customers/c1")[0][1])).toEqual({ active: false });
      cleanup();
    }
  });

  it("updates the row without reloading", async () => {
    const created: Route = () =>
      Promise.resolve(
        jsonResponse(201, {
          id: "c2",
          name: "Novo Cliente",
          document: null,
          phone: null,
          email: null,
          address: null,
          active: true,
        }),
      );
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/customers?pageSize=100": () => Promise.resolve(jsonResponse(200, page([CUSTOMER_1]))),
      "/customers": (init) => (init?.method === "POST" ? created() : Promise.reject(new Error("rota inesperada"))),
    });
    render(<CustomersPage />);
    await screen.findByText("Ana Silva");

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Novo Cliente" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await screen.findByText("Novo Cliente");
    expect(callsTo(fetchMock, "/customers").filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    expect(screen.queryByText("Não foi possível conectar à API")).toBeNull();
  });
});
