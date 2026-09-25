import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuotePreviewResult } from "@/lib/pricing";
import type { Product, ProductPricing, ProductVariant } from "@/lib/products";
import ProductDetailPage from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const ADMIN_ME = { id: "u1", name: "Admin", email: "admin@test.local", role: "admin" };
const PRODUCTION_ME = { id: "u2", name: "Produção", email: "production@test.local", role: "production" };
const SALES_ME = { id: "u3", name: "Vendas", email: "sales@test.local", role: "sales" };

function variant(overrides: Partial<ProductVariant>): ProductVariant {
  return {
    id: "v-laranja",
    productId: "p1",
    name: "Laranja",
    printer: { id: "pr1", name: "Bambu X1C" },
    printHours: 0.47,
    prepHours: 0.25,
    slicingHours: 0.1,
    postProcessingHours: 0,
    active: true,
    materials: [{ materialId: "m1", name: "PLA · Bambu · Laranja", grams: 8 }],
    supplies: [],
    ...overrides,
  };
}

const LARANJA = variant({});
const PRETO = variant({
  id: "v-preto",
  name: "Preto",
  materials: [{ materialId: "m2", name: "PLA · Bambu · Preto", grams: 1 }],
});

function product(variants: ProductVariant[]): Product {
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
    commercialUseAllowed: false,
    modelMetadataFetchedAt: null,
    active: true,
    variants,
  };
}

const LARANJA_PRICING: QuotePreviewResult = {
  quantity: 1,
  costs: {
    materialCents: 550,
    energyCents: 0,
    depreciationCents: 0,
    maintenanceCents: 0,
    laborCents: 3000,
    suppliesCents: 0,
    fixedCostsCents: 0,
    directCostCents: 3550,
    costWithRiskCents: 3905,
  },
  channels: [{ id: "c1", name: "Balcão", unitPriceCents: 5579, totalPriceCents: 5579, minimumPriceApplied: false }],
  printer: { id: "pr1", name: "Bambu X1C" },
  materials: [],
  supplies: [],
};

const BLACK_ERROR = "Material sem custo médio disponível: PLA · Bambu · Preto";

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

const pending = () => new Promise<Response>(() => undefined);
const ok = (body: unknown) => () => Promise.resolve(jsonResponse(200, body));

function renderPage() {
  render(<ProductDetailPage params={Promise.resolve({ id: "p1" })} />);
}

const variantCard = (name: string) =>
  screen.getByRole("heading", { name, level: 3 }).closest("section") as HTMLElement;

describe("Product detail page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows loading", async () => {
    let resolveProduct: (value: Response) => void = () => undefined;
    const fetchMock = stubApi({
      "/auth/me": ok(ADMIN_ME),
      "/products/p1": () =>
        new Promise<Response>((resolve) => {
          resolveProduct = resolve;
        }),
      "/products/p1/pricing": pending,
    });
    renderPage();
    // Espera a busca do produto sair: antes dela, o "Carregando…" é o da resolução de `params`.
    await waitFor(() => expect(callsTo(fetchMock, "/products/p1")).toHaveLength(1));
    expect(screen.getByText("Carregando…")).toBeTruthy();
    expect(screen.queryByText("Estrela do mar")).toBeNull();
    resolveProduct(jsonResponse(200, product([])));
    await screen.findByText("Estrela do mar");
  });

  it("shows a loading indicator per variant while pricing is pending", async () => {
    stubApi({
      "/auth/me": ok(SALES_ME),
      "/products/p1": ok(product([LARANJA, PRETO])),
      "/products/p1/pricing": pending,
    });
    renderPage();
    await screen.findByText("Estrela do mar");
    expect(screen.getByText("https://makerworld.com/models/3007827")).toBeTruthy();
    expect(within(variantCard("Laranja")).getByText("Calculando custo…")).toBeTruthy();
    expect(within(variantCard("Preto")).getByText("Calculando custo…")).toBeTruthy();
  });

  it("keeps the product visible when pricing fails and retries pricing", async () => {
    let pricingRoute: Route = () => Promise.resolve(jsonResponse(500, { error: "Internal server error" }));
    const fetchMock = stubApi({
      "/auth/me": ok(SALES_ME),
      "/products/p1": ok(product([LARANJA])),
      "/products/p1/pricing": () => pricingRoute(),
    });
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Internal server error");
    expect(screen.getByText("Estrela do mar")).toBeTruthy();
    expect(screen.getByText("https://makerworld.com/models/3007827")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Laranja", level: 3 })).toBeTruthy();

    pricingRoute = ok({ variants: [{ variantId: "v-laranja", name: "Laranja", pricing: LARANJA_PRICING, error: null }] });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await within(variantCard("Laranja")).findByText("R$ 55.79");
    expect(callsTo(fetchMock, "/products/p1/pricing")).toHaveLength(2);
    expect(callsTo(fetchMock, "/products/p1")).toHaveLength(1);
  });

  it("shows a per-variant error beside the other variants' prices", async () => {
    const pricing: ProductPricing = {
      variants: [
        { variantId: "v-laranja", name: "Laranja", pricing: LARANJA_PRICING, error: null },
        { variantId: "v-preto", name: "Preto", pricing: null, error: BLACK_ERROR },
      ],
    };
    stubApi({
      "/auth/me": ok(SALES_ME),
      "/products/p1": ok(product([LARANJA, PRETO])),
      "/products/p1/pricing": ok(pricing),
    });
    renderPage();
    await screen.findByText(BLACK_ERROR);
    const black = variantCard("Preto");
    expect(within(black).getByText(BLACK_ERROR)).toBeTruthy();
    expect(within(black).queryByText("Custo com risco")).toBeNull();

    const orange = variantCard("Laranja");
    expect(within(orange).getByText("R$ 39.05")).toBeTruthy();
    expect(within(orange).getByText("Balcão")).toBeTruthy();
    expect(within(orange).getByText("R$ 55.79")).toBeTruthy();
    expect(within(orange).queryByText(BLACK_ERROR)).toBeNull();
  });

  it("shows the empty variants state", async () => {
    stubApi({
      "/auth/me": ok(ADMIN_ME),
      "/products/p1": ok(product([])),
      "/products/p1/pricing": ok({ variants: [] }),
    });
    renderPage();
    expect(await screen.findByText("Nenhuma variação cadastrada")).toBeTruthy();
  });

  it("shows the not found error", async () => {
    stubApi({
      "/auth/me": ok(ADMIN_ME),
      "/products/p1": () => Promise.resolve(jsonResponse(404, { error: "Produto não encontrado" })),
      "/products/p1/pricing": () => Promise.resolve(jsonResponse(404, { error: "Produto não encontrado" })),
    });
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Produto não encontrado");
  });

  it("shows the license notice in the detail", async () => {
    stubApi({
      "/auth/me": ok(SALES_ME),
      "/products/p1": ok(product([])),
      "/products/p1/pricing": ok({ variants: [] }),
    });
    renderPage();
    expect(await screen.findByText("Licença não permite uso comercial")).toBeTruthy();
  });

  it("only admin sees variant actions and deactivation confirms", async () => {
    for (const me of [PRODUCTION_ME, SALES_ME]) {
      stubApi({
        "/auth/me": ok(me),
        "/products/p1": ok(product([LARANJA])),
        "/products/p1/pricing": ok({ variants: [{ variantId: "v-laranja", name: "Laranja", pricing: LARANJA_PRICING, error: null }] }),
      });
      renderPage();
      await within(await waitFor(() => variantCard("Laranja"))).findByText("R$ 55.79");
      expect(screen.queryByRole("button", { name: "Nova variação" }), me.role).toBeNull();
      expect(screen.queryByRole("button", { name: "Editar" }), me.role).toBeNull();
      expect(screen.queryByRole("button", { name: "Desativar" }), me.role).toBeNull();
      cleanup();
      vi.unstubAllGlobals();
    }

    let patched: unknown = null;
    const fetchMock = stubApi({
      "/auth/me": ok(ADMIN_ME),
      "/products/p1": ok(product([LARANJA])),
      "/products/p1/pricing": ok({ variants: [] }),
      "/products/p1/variants/v-laranja": (init) => {
        patched = JSON.parse(init?.body as string);
        return Promise.resolve(jsonResponse(200, { ...LARANJA, active: false }));
      },
    });
    renderPage();
    await screen.findByRole("button", { name: "Nova variação" });
    const card = variantCard("Laranja");
    expect(within(card).getByRole("button", { name: "Editar" })).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Desativar" }));

    const dialog = screen.getByRole("dialog");
    expect(callsTo(fetchMock, "/products/p1/variants/v-laranja")).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(patched).toEqual({ active: false }));
  });
});
