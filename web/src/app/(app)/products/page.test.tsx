import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductSummary } from "@/lib/products";
import ProductsPage from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const ADMIN_ME = { id: "u1", name: "Admin", email: "admin@test.local", role: "admin" };
const PRODUCTION_ME = { id: "u2", name: "Produção", email: "production@test.local", role: "production" };
const SALES_ME = { id: "u3", name: "Vendas", email: "sales@test.local", role: "sales" };

const INVALID_URL = "URL do modelo inválida: use um link de modelo do Printables, do MakerWorld ou do Thingiverse";

function product(overrides: Partial<ProductSummary>): ProductSummary {
  return {
    id: "p1",
    name: "Estrela do mar",
    description: null,
    modelUrl: "https://makerworld.com/models/3007827",
    modelPlatform: "makerworld",
    modelExternalId: "3007827",
    modelTitle: "Sea animals set",
    modelImageUrl: null,
    modelDesigner: null,
    modelLicense: null,
    commercialUseAllowed: null,
    modelMetadataFetchedAt: null,
    active: true,
    ...overrides,
  };
}

const pageOf = (items: ProductSummary[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

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

describe("Products page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows loading", async () => {
    let resolveProducts: (value: Response) => void = () => undefined;
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/products?pageSize=100": () =>
        new Promise<Response>((resolve) => {
          resolveProducts = resolve;
        }),
    });
    render(<ProductsPage />);
    expect(screen.getByText("Carregando…")).toBeTruthy();
    resolveProducts(jsonResponse(200, pageOf([])));
    await screen.findByText("Nenhum produto cadastrado");
    expect(screen.queryByText("Carregando…")).toBeNull();
  });

  it("shows the empty state", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, SALES_ME)),
      "/products?pageSize=100": () => Promise.resolve(jsonResponse(200, pageOf([]))),
    });
    render(<ProductsPage />);
    expect(await screen.findByText("Nenhum produto cadastrado")).toBeTruthy();
  });

  it("shows the error with retry", async () => {
    let productsRoute: Route = () => Promise.reject(new TypeError("Failed to fetch"));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/products?pageSize=100": () => productsRoute(),
    });
    render(<ProductsPage />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Não foi possível conectar à API");
    productsRoute = () => Promise.resolve(jsonResponse(200, pageOf([product({})])));
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("link", { name: "Estrela do mar" });
    expect(callsTo(fetchMock, "/products?pageSize=100")).toHaveLength(2);
  });

  it("shows the license notice for each commercial-use state", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, SALES_ME)),
      "/products?pageSize=100": () =>
        Promise.resolve(
          jsonResponse(
            200,
            pageOf([
              product({ id: "a", name: "Proibido", modelExternalId: "1", commercialUseAllowed: false }),
              product({ id: "b", name: "Sem licença", modelExternalId: "2", commercialUseAllowed: null }),
              product({ id: "c", name: "Liberado", modelExternalId: "3", commercialUseAllowed: true }),
            ]),
          ),
        ),
    });
    render(<ProductsPage />);
    const rowOf = async (name: string) => (await screen.findByRole("link", { name })).closest("tr") as HTMLElement;

    const forbidden = await rowOf("Proibido");
    expect(within(forbidden).getByText("Licença não permite uso comercial")).toBeTruthy();
    expect(within(forbidden).queryByText("Licença não informada")).toBeNull();

    const unknown = await rowOf("Sem licença");
    expect(within(unknown).getByText("Licença não informada")).toBeTruthy();
    expect(within(unknown).queryByText("Licença não permite uso comercial")).toBeNull();

    const allowed = await rowOf("Liberado");
    expect(within(allowed).queryByText("Licença não permite uso comercial")).toBeNull();
    expect(within(allowed).queryByText("Licença não informada")).toBeNull();
  });

  it("only admin sees create and edit actions", async () => {
    for (const me of [ADMIN_ME, PRODUCTION_ME, SALES_ME]) {
      stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, me)),
        "/products?pageSize=100": () => Promise.resolve(jsonResponse(200, pageOf([product({})]))),
      });
      render(<ProductsPage />);
      await screen.findByRole("link", { name: "Estrela do mar" });
      const isAdmin = me.role === "admin";
      expect(Boolean(screen.queryByRole("button", { name: "Novo produto" })), me.role).toBe(isAdmin);
      expect(Boolean(screen.queryByRole("button", { name: "Editar" })), me.role).toBe(isAdmin);
      expect(Boolean(screen.queryByRole("button", { name: "Desativar" })), me.role).toBe(isAdmin);
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it("product form keeps values and shows the api error", async () => {
    let productsCall: Route = () => Promise.resolve(jsonResponse(400, { error: INVALID_URL }));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/products?pageSize=100": () => Promise.resolve(jsonResponse(200, pageOf([]))),
      "/products": (init) => productsCall(init),
    });
    render(<ProductsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Novo produto" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Estrela do mar" } });
    fireEvent.change(screen.getByLabelText("URL do modelo"), { target: { value: "https://example.com/model/1" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(INVALID_URL);
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Estrela do mar");
    expect((screen.getByLabelText("URL do modelo") as HTMLInputElement).value).toBe("https://example.com/model/1");

    productsCall = () =>
      Promise.resolve(jsonResponse(201, { ...product({ id: "novo", name: "Estrela do mar" }), variants: [] }));
    fireEvent.change(screen.getByLabelText("URL do modelo"), {
      target: { value: "https://makerworld.com/models/3007827" },
    });
    fireEvent.change(screen.getByLabelText("Uso comercial"), { target: { value: "false" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await screen.findByRole("link", { name: "Estrela do mar" });

    const posts = callsTo(fetchMock, "/products").filter(([, init]) => (init as RequestInit)?.method === "POST");
    const body = JSON.parse((posts[1][1] as RequestInit).body as string) as Record<string, unknown>;
    expect(body).toEqual({
      name: "Estrela do mar",
      modelUrl: "https://makerworld.com/models/3007827",
      description: null,
      modelTitle: null,
      modelImageUrl: null,
      modelDesigner: null,
      modelLicense: null,
      commercialUseAllowed: false,
    });
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
