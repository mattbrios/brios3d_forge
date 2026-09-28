import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/products";
import { ProductMetadataRefresh } from "./product-metadata-refresh";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Vaso espiral",
    description: null,
    modelUrl: "https://www.printables.com/model/123456-vaso",
    modelPlatform: "printables",
    modelExternalId: "123456",
    modelTitle: "Título antigo",
    modelImageUrl: null,
    modelDesigner: "Designer antigo",
    modelLicense: "Licença antiga",
    commercialUseAllowed: null,
    modelMetadataFetchedAt: null,
    active: true,
    variants: [],
    ...overrides,
  };
}

const PREVIEW = {
  title: "Vaso espiral v2",
  imageUrl: "https://media.printables.com/model/abc/design/def.jpeg",
  designer: "Designer novo",
  license: "CC0",
  commercialUseAllowed: true,
};

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Atualizar metadados" }));
}

describe("ProductMetadataRefresh", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // C22: shows diff between saved and fetched values, sem gravar nada ainda.
  it("shows diff between saved and fetched values", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, PREVIEW));
    vi.stubGlobal("fetch", fetchMock);
    render(<ProductMetadataRefresh product={product()} onUpdated={vi.fn()} />);
    openDialog();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Título antigo")).toBeTruthy();
    expect(within(dialog).getByText("Vaso espiral v2")).toBeTruthy();
    expect(within(dialog).getByText("Designer antigo")).toBeTruthy();
    expect(within(dialog).getByText("Designer novo")).toBeTruthy();
    expect(within(dialog).getByText("Licença antiga")).toBeTruthy();
    expect(within(dialog).getByText("CC0")).toBeTruthy();
    expect(within(dialog).getByText("Não informado")).toBeTruthy();
    expect(within(dialog).getByText("Permitido")).toBeTruthy();

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("http://api.test:3001/products/model-metadata");
    expect(init.method).toBe("POST");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // C23: confirm calls refresh and reflects updated product.
  it("confirm calls refresh and reflects updated product", async () => {
    const updated = product({ modelTitle: PREVIEW.title, modelMetadataFetchedAt: "2026-09-28T10:00:00.000Z" });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/model-metadata")) return Promise.resolve(jsonResponse(200, PREVIEW));
      if (url.endsWith("/model-metadata/refresh")) return Promise.resolve(jsonResponse(200, updated));
      throw new Error(`rota inesperada: ${url} ${JSON.stringify(init)}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const onUpdated = vi.fn();
    render(<ProductMetadataRefresh product={product()} onUpdated={onUpdated} />);
    openDialog();
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: "Confirmar atualização" }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));

    const [refreshUrl, refreshInit] = fetchMock.mock.calls[1];
    expect(refreshUrl).toBe("http://api.test:3001/products/p1/model-metadata/refresh");
    expect(refreshInit?.method).toBe("POST");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // C24: cancel persists nothing.
  it("cancel persists nothing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, PREVIEW));
    vi.stubGlobal("fetch", fetchMock);
    render(<ProductMetadataRefresh product={product()} onUpdated={vi.fn()} />);
    openDialog();
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/refresh"))).toBe(false);
  });

  // C26: preview failure keeps product unchanged.
  it("preview failure keeps product unchanged", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(502, { error: "Não foi possível consultar" })));
    const onUpdated = vi.fn();
    render(<ProductMetadataRefresh product={product()} onUpdated={onUpdated} />);
    openDialog();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("alert").textContent).toBe("Não foi possível consultar");
    expect(onUpdated).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Confirmar atualização" })).toBeNull();
  });
});
