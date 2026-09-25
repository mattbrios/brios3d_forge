import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import seaAnimals from "./fixtures/print-profile-import.json";
import { ProductVariantEditor } from "./product-variant-editor";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const MATERIAL = {
  id: "m1",
  type: "PLA",
  brand: "Bambu",
  color: "Laranja",
  densityGCm3: 1.24,
  nozzleTempC: 210,
  bedTempC: 60,
  needsDrying: false,
  dryingTemperatureC: null,
  dryingHours: null,
  active: true,
  minimumStockGrams: null,
};
const PRINTER = {
  id: "p1",
  name: "Bambu X1C",
  acquisitionCostCents: 500000,
  lifespanHours: 10000,
  powerWatts: 250,
  hourmeterHours: 0,
  nozzles: [],
  hasAms: true,
  amsSlots: 4,
  active: true,
};
const STOCK_ITEM = {
  id: "s1",
  category: "insumo",
  name: "Argola de chaveiro",
  sku: null,
  unitOfMeasure: "un",
  location: null,
  preferredSupplierId: null,
  balanceQuantity: 10,
  minimumQuantity: null,
  avgCostCents: 50,
  compatiblePrinterIds: [],
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const MAKERWORLD_PRODUCT = { id: "prod1", modelUrl: "https://makerworld.com/models/3007827", modelPlatform: "makerworld" as const };
const PRINTABLES_PRODUCT = { id: "prod2", modelUrl: "https://www.printables.com/model/123456", modelPlatform: "printables" as const };

const pageOf = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

type Route = (init?: RequestInit) => Promise<Response>;

function stubApi(extra: Record<string, Route> = {}) {
  const routes: Record<string, Route> = {
    "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, pageOf([MATERIAL]))),
    "/printers?pageSize=100": () => Promise.resolve(jsonResponse(200, pageOf([PRINTER]))),
    "/inventory/items?pageSize=100": () => Promise.resolve(jsonResponse(200, pageOf([STOCK_ITEM]))),
    ...extra,
  };
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const path = url.replace("http://api.test:3001", "");
    const route = routes[path];
    if (!route) throw new Error(`rota inesperada: ${path}`);
    return route(init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const valueOf = (label: string) => (screen.getByLabelText(label) as HTMLInputElement | HTMLSelectElement).value;

function fillSheet() {
  fireEvent.change(screen.getByLabelText("Nome da variação"), { target: { value: "Laranja" } });
  fireEvent.change(screen.getByLabelText("Impressora de referência"), { target: { value: "p1" } });
  fireEvent.change(screen.getByLabelText("Horas de impressão"), { target: { value: "0.47" } });
  fireEvent.change(screen.getByLabelText("Preparo (h)"), { target: { value: "0.25" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar material" }));
  fireEvent.change(screen.getByLabelText("Material 1"), { target: { value: "m1" } });
  fireEvent.change(screen.getByLabelText("Gramas do material 1"), { target: { value: "8" } });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar insumo" }));
  fireEvent.change(screen.getByLabelText("Insumo 1"), { target: { value: "s1" } });
  fireEvent.change(screen.getByLabelText("Quantidade do insumo 1"), { target: { value: "2" } });
}

describe("ProductVariantEditor", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("prefills the tech sheet from the product's MakerWorld profile", async () => {
    const fetchMock = stubApi({
      "/print-profiles/import": () => Promise.resolve(jsonResponse(200, seaAnimals)),
    });
    render(<ProductVariantEditor product={MAKERWORLD_PRODUCT} onSaved={() => undefined} onCancel={() => undefined} />);
    await screen.findByLabelText("Nome da variação");

    expect(valueOf("URL do MakerWorld")).toBe("https://makerworld.com/models/3007827");
    fireEvent.click(screen.getByRole("button", { name: "Importar" }));
    await screen.findByRole("combobox", { name: "Perfil" });

    const importCall = fetchMock.mock.calls.find(([url]) => (url as string).endsWith("/print-profiles/import"));
    expect(JSON.parse((importCall?.[1] as RequestInit).body as string)).toEqual({
      url: "https://makerworld.com/models/3007827",
    });
    await waitFor(() => expect(valueOf("Horas de impressão")).toBe("0.47"));
    expect(valueOf("Gramas do material 1")).toBe("8");
    expect(valueOf("Gramas do material 2")).toBe("1");
    expect(valueOf("Material 1")).toBe("");
    expect(valueOf("Material 2")).toBe("");
    expect(screen.queryByLabelText("Material 3")).toBeNull();
  });

  it("offers only manual entry for non-MakerWorld products", async () => {
    stubApi();
    render(<ProductVariantEditor product={PRINTABLES_PRODUCT} onSaved={() => undefined} onCancel={() => undefined} />);
    await screen.findByLabelText("Nome da variação");

    expect(screen.queryByLabelText("URL do MakerWorld")).toBeNull();
    expect(screen.queryByRole("button", { name: "Importar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar material" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar insumo" }));
    expect(screen.getByLabelText("Material 1")).toBeTruthy();
    expect(screen.getByLabelText("Insumo 1")).toBeTruthy();
  });

  it("uses registry selectors and never a cost field", async () => {
    let sent: Record<string, unknown> | null = null;
    const onSaved = vi.fn();
    stubApi({
      "/products/prod2/variants": (init) => {
        sent = JSON.parse(init?.body as string) as Record<string, unknown>;
        return Promise.resolve(jsonResponse(201, { id: "v1" }));
      },
    });
    render(<ProductVariantEditor product={PRINTABLES_PRODUCT} onSaved={onSaved} onCancel={() => undefined} />);
    await screen.findByLabelText("Nome da variação");
    fillSheet();

    for (const label of ["Impressora de referência", "Material 1", "Insumo 1"]) {
      expect(screen.getByLabelText(label).tagName).toBe("SELECT");
    }
    expect(screen.getByRole("option", { name: "PLA · Bambu · Laranja" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Bambu X1C" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Argola de chaveiro" })).toBeTruthy();
    expect(screen.queryByLabelText(/custo/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Salvar variação" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(sent).toEqual({
      name: "Laranja",
      printerId: "p1",
      printHours: 0.47,
      prepHours: 0.25,
      slicingHours: 0,
      postProcessingHours: 0,
      materials: [{ materialId: "m1", grams: 8 }],
      supplies: [{ stockItemId: "s1", quantity: 2 }],
    });
  });

  it("keeps the sheet and shows the api error on save failure", async () => {
    stubApi({
      "/products/prod2/variants": () =>
        Promise.resolve(jsonResponse(409, { error: "Já existe uma variação com este nome neste produto" })),
    });
    const onSaved = vi.fn();
    render(<ProductVariantEditor product={PRINTABLES_PRODUCT} onSaved={onSaved} onCancel={() => undefined} />);
    await screen.findByLabelText("Nome da variação");
    fillSheet();
    fireEvent.click(screen.getByRole("button", { name: "Salvar variação" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Já existe uma variação com este nome neste produto");
    expect(onSaved).not.toHaveBeenCalled();
    expect(valueOf("Nome da variação")).toBe("Laranja");
    expect(valueOf("Horas de impressão")).toBe("0.47");
    expect(valueOf("Material 1")).toBe("m1");
    expect(valueOf("Gramas do material 1")).toBe("8");
    expect(valueOf("Insumo 1")).toBe("s1");
  });
});
