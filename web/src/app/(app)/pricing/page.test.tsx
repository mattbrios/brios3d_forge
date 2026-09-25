import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import seaAnimals from "@/components/fixtures/print-profile-import.json";
import type { Material } from "@/lib/materials";
import type { Printer } from "@/lib/printers";
import type { QuotePreviewResult } from "@/lib/pricing";
import type { SalesChannel } from "@/lib/sales-channels";
import type { StockItem } from "@/lib/stock-items";
import PricingPage from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

const PRINTER_1: Printer = {
  id: "p1",
  name: "Bambu X1C",
  acquisitionCostCents: 400000,
  lifespanHours: 5000,
  powerWatts: 250,
  hourmeterHours: 0,
  nozzles: [],
  hasAms: false,
  amsSlots: null,
  active: true,
};

const STOCK_ITEM_1: StockItem = {
  id: "s1",
  category: "insumo",
  name: "Parafuso M3x8",
  sku: null,
  unitOfMeasure: "un",
  location: null,
  preferredSupplierId: null,
  balanceQuantity: 100,
  minimumQuantity: null,
  avgCostCents: 500,
  compatiblePrinterIds: [],
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const CHANNEL_1: SalesChannel = { id: "c1", name: "Balcão", taxRate: 0, feeRate: 0, active: true };

const QUOTE_RESULT: QuotePreviewResult = {
  quantity: 1,
  costs: {
    materialCents: 1050,
    energyCents: 100,
    depreciationCents: 400,
    maintenanceCents: 250,
    laborCents: 3000,
    suppliesCents: 300,
    fixedCostsCents: 1000,
    directCostCents: 6100,
    costWithRiskCents: 6710,
  },
  channels: [{ id: "c1", name: "Balcão", unitPriceCents: 10485, totalPriceCents: 10485, minimumPriceApplied: false }],
  printer: { id: "p1", name: "Bambu X1C" },
  materials: [{ materialId: "m1", name: "PLA · Marca A · Natural", avgCostCentsPerGram: 10 }],
  supplies: [],
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

function defaultRegistries(overrides: {
  materials?: Material[];
  printers?: Printer[];
  stockItems?: StockItem[];
  channels?: SalesChannel[];
}) {
  return {
    "/materials?pageSize=100": () =>
      Promise.resolve(
        jsonResponse(200, {
          items: overrides.materials ?? [MATERIAL_1],
          total: (overrides.materials ?? [MATERIAL_1]).length,
          page: 1,
          pageSize: 100,
        }),
      ),
    "/printers?pageSize=100": () =>
      Promise.resolve(
        jsonResponse(200, {
          items: overrides.printers ?? [PRINTER_1],
          total: (overrides.printers ?? [PRINTER_1]).length,
          page: 1,
          pageSize: 100,
        }),
      ),
    "/inventory/items?pageSize=100": () =>
      Promise.resolve(
        jsonResponse(200, {
          items: overrides.stockItems ?? [STOCK_ITEM_1],
          total: (overrides.stockItems ?? [STOCK_ITEM_1]).length,
          page: 1,
          pageSize: 100,
        }),
      ),
    "/sales-channels": () => Promise.resolve(jsonResponse(200, overrides.channels ?? [CHANNEL_1])),
  };
}

describe("Pricing page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // C13 (AC 12): mostra "Carregando…" antes das quatro rotas de cadastro resolverem.
  it("shows loading", async () => {
    let resolveMaterials: (value: Response) => void = () => undefined;
    const materialsPromise = new Promise<Response>((resolve) => {
      resolveMaterials = resolve;
    });
    stubApi({ ...defaultRegistries({}), "/materials?pageSize=100": () => materialsPromise });
    render(<PricingPage />);
    expect(screen.getByText("Carregando…")).toBeTruthy();
    resolveMaterials(jsonResponse(200, { items: [MATERIAL_1], total: 1, page: 1, pageSize: 100 }));
    await screen.findByRole("heading", { name: "Impressão" });
  });

  // C14 (AC 15): seletor de material com estado vazio quando nenhum material cadastrado (ativo).
  it("shows an empty state on the material selector when none are registered", async () => {
    stubApi(defaultRegistries({ materials: [] }));
    render(<PricingPage />);
    await screen.findByRole("heading", { name: "Impressão" });
    expect(
      screen.getByText("Nenhum material cadastrado. Cadastre um material antes de calcular."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Adicionar material" })).toBeNull();
  });

  // C15 (AC 8): colar a URL de exemplo preenche tempo e filamentos e cada linha ganha um
  // seletor de Material cadastrado ao lado.
  it("imports filaments from a MakerWorld URL and adds a material selector per filament", async () => {
    const fetchMock = stubApi({
      ...defaultRegistries({}),
      "/print-profiles/import": () => Promise.resolve(jsonResponse(200, seaAnimals)),
    });
    render(<PricingPage />);
    await screen.findByRole("heading", { name: "Impressão" });

    fireEvent.change(screen.getByLabelText("URL do MakerWorld"), {
      target: { value: "https://makerworld.com/models/3007827" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));

    await screen.findByRole("combobox", { name: "Perfil" });
    expect((screen.getByLabelText("Horas de impressão") as HTMLInputElement).value).toBe(
      String(28 / 60),
    );
    const materialSelectors = screen.getAllByLabelText(/^Material \d+$/);
    expect(materialSelectors).toHaveLength(2);
    expect(callsTo(fetchMock, "/print-profiles/import")).toHaveLength(1);
  });

  // C16 (AC 9): sem URL, permite montar linha de material e de insumo manualmente, cada uma
  // com um seletor do cadastro, nunca um campo de custo digitável.
  it("adds a material or supply line manually with a registry selector, never a free-text cost field", async () => {
    stubApi(defaultRegistries({}));
    render(<PricingPage />);
    await screen.findByRole("heading", { name: "Impressão" });

    fireEvent.click(screen.getByRole("button", { name: "Adicionar material" }));
    const materialSelect = screen.getByLabelText("Material 1");
    expect(materialSelect.tagName).toBe("SELECT");
    expect(within(materialSelect as HTMLElement).getByText("PLA · Marca A · Natural")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar insumo" }));
    const supplySelect = screen.getByLabelText("Insumo 1");
    expect(supplySelect.tagName).toBe("SELECT");
    expect(within(supplySelect as HTMLElement).getByText("Parafuso M3x8")).toBeTruthy();

    // Nem a linha de material nem a de insumo têm campo de custo digitável: o único campo de
    // custo da tela é a mão de obra, que não é atributo de um material ou insumo específico.
    expect(screen.queryByLabelText(/custo.*material|custo.*insumo/i)).toBeNull();
  });

  // C17 (AC 10): a impressora selecionada envia o id, nunca um nome digitado.
  it("sends the selected printer's id, never a typed name", async () => {
    const fetchMock = stubApi({
      ...defaultRegistries({}),
      "/pricing/quote-preview": () => Promise.resolve(jsonResponse(200, QUOTE_RESULT)),
    });
    render(<PricingPage />);
    await screen.findByRole("heading", { name: "Impressão" });

    fireEvent.change(screen.getByLabelText("Impressora cadastrada"), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText("Horas de impressão"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar material" }));
    fireEvent.change(screen.getByLabelText("Material 1"), { target: { value: "m1" } });
    fireEvent.change(screen.getByLabelText("Gramas"), { target: { value: "100" } });
    fireEvent.click(screen.getByLabelText("Balcão"));
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));

    await screen.findByText("Resultado");
    const call = callsTo(fetchMock, "/pricing/quote-preview")[0];
    expect(bodyOf(call[1]).printerId).toBe("p1");
  });

  // C18 (AC 11, AC 12): calcular chama a rota e exibe o detalhamento; enquanto pendente, o
  // botão fica desabilitado e um indicador aparece.
  it("calculates and shows the breakdown, disabling the button while pending", async () => {
    let resolveQuote: (value: Response) => void = () => undefined;
    const quotePromise = new Promise<Response>((resolve) => {
      resolveQuote = resolve;
    });
    stubApi({ ...defaultRegistries({}), "/pricing/quote-preview": () => quotePromise });
    render(<PricingPage />);
    await screen.findByRole("heading", { name: "Impressão" });

    fireEvent.change(screen.getByLabelText("Impressora cadastrada"), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText("Horas de impressão"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar material" }));
    fireEvent.change(screen.getByLabelText("Material 1"), { target: { value: "m1" } });
    fireEvent.change(screen.getByLabelText("Gramas"), { target: { value: "100" } });
    fireEvent.click(screen.getByLabelText("Balcão"));
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));

    expect(screen.getByText("Calculando…")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Calcular" }) as HTMLButtonElement).disabled).toBe(true);

    resolveQuote(jsonResponse(200, QUOTE_RESULT));
    await screen.findByText("Resultado");
    expect(screen.getByText("R$ 10.50")).toBeTruthy();
    expect(screen.getAllByText("Balcão")).toHaveLength(2); // checkbox do formulário + linha do resultado
    expect((screen.getByRole("button", { name: "Calcular" }) as HTMLButtonElement).disabled).toBe(false);
  });

  // C19 (AC 13, AC 14): 400 mostra o erro (role=alert) sem apagar o formulário; recalcular
  // depois de mudar a quantidade refaz a chamada sem perder o resto do formulário.
  it("shows the error without clearing the form and allows recalculating after changing quantity", async () => {
    let quoteRoute: Route = () =>
      Promise.resolve(jsonResponse(400, { error: "Material sem custo médio disponível: PLA · Marca A · Natural" }));
    const fetchMock = stubApi({ ...defaultRegistries({}), "/pricing/quote-preview": () => quoteRoute() });
    render(<PricingPage />);
    await screen.findByRole("heading", { name: "Impressão" });

    fireEvent.change(screen.getByLabelText("Impressora cadastrada"), { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText("Horas de impressão"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar material" }));
    fireEvent.change(screen.getByLabelText("Material 1"), { target: { value: "m1" } });
    fireEvent.change(screen.getByLabelText("Gramas"), { target: { value: "100" } });
    fireEvent.click(screen.getByLabelText("Balcão"));
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Material sem custo médio disponível: PLA · Marca A · Natural",
    );
    expect((screen.getByLabelText("Impressora cadastrada") as HTMLSelectElement).value).toBe("p1");
    expect((screen.getByLabelText("Gramas") as HTMLInputElement).value).toBe("100");

    quoteRoute = () => Promise.resolve(jsonResponse(200, QUOTE_RESULT));
    fireEvent.change(screen.getByLabelText("Quantidade"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Calcular" }));
    await screen.findByText("Resultado");
    expect(callsTo(fetchMock, "/pricing/quote-preview")).toHaveLength(2);
    expect((screen.getByLabelText("Quantidade") as HTMLInputElement).value).toBe("2");
  });
});
