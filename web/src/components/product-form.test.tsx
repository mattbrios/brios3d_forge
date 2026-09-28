import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductSummary } from "@/lib/products";
import { ProductForm } from "./product-form";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const PREVIEW = {
  title: "Vaso espiral",
  imageUrl: "https://media.printables.com/model/abc/design/def.jpeg",
  designer: "designer_x",
  license: "Creative Commons — Attribution",
  commercialUseAllowed: true,
};

function fillUrlAndFetch(url = "https://www.printables.com/model/123456-vaso") {
  fireEvent.change(screen.getByLabelText("URL do modelo"), { target: { value: url } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar metadados" }));
}

describe("ProductForm metadata preview", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // C19: fills fields from metadata preview, sem chamar POST/PATCH /products.
  it("fills fields from metadata preview", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, PREVIEW));
    vi.stubGlobal("fetch", fetchMock);
    render(<ProductForm onSaved={vi.fn()} />);

    fillUrlAndFetch();
    await waitFor(() => expect((screen.getByLabelText("Título do modelo") as HTMLInputElement).value).toBe("Vaso espiral"));

    expect((screen.getByLabelText("Designer") as HTMLInputElement).value).toBe("designer_x");
    expect((screen.getByLabelText("Licença") as HTMLInputElement).value).toBe("Creative Commons — Attribution");
    expect((screen.getByLabelText("Uso comercial") as HTMLSelectElement).value).toBe("true");
    expect((screen.getByLabelText("URL da imagem") as HTMLInputElement).value).toBe(PREVIEW.imageUrl);
    const image = document.querySelector("img");
    expect(image?.getAttribute("src")).toBe(PREVIEW.imageUrl);

    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("http://api.test:3001/products/model-metadata");
    expect(init.method).toBe("POST");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // C20: shows loading state while fetching metadata.
  it("shows loading state while fetching metadata", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));
    render(<ProductForm onSaved={vi.fn()} />);
    fillUrlAndFetch();
    expect(screen.getByText("Buscando metadados…")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Buscar metadados" }) as HTMLButtonElement).disabled).toBe(true);
  });

  // C21: shows error and keeps fields editable.
  it("shows error and keeps fields editable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(400, { error: "URL do modelo inválida" })),
    );
    render(<ProductForm onSaved={vi.fn()} />);
    fillUrlAndFetch();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("URL do modelo inválida");

    const titleInput = screen.getByLabelText("Título do modelo") as HTMLInputElement;
    expect(titleInput.value).toBe("");
    fireEvent.change(titleInput, { target: { value: "Digitado à mão" } });
    expect(titleInput.value).toBe("Digitado à mão");
  });

  it("blank form has no metadata fetch until the button is clicked", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ProductForm onSaved={vi.fn()} />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Buscar metadados" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("prefills from an existing product and lets metadata overwrite it", async () => {
    const product: ProductSummary = {
      id: "p1",
      name: "Estrela do mar",
      description: null,
      modelUrl: "https://www.printables.com/model/123456-vaso",
      modelPlatform: "printables",
      modelExternalId: "123456",
      modelTitle: "Título antigo",
      modelImageUrl: null,
      modelDesigner: null,
      modelLicense: null,
      commercialUseAllowed: null,
      modelMetadataFetchedAt: null,
      active: true,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, PREVIEW)));
    render(<ProductForm product={product} onSaved={vi.fn()} />);
    expect((screen.getByLabelText("Título do modelo") as HTMLInputElement).value).toBe("Título antigo");

    fireEvent.click(screen.getByRole("button", { name: "Buscar metadados" }));
    await waitFor(() => expect((screen.getByLabelText("Título do modelo") as HTMLInputElement).value).toBe("Vaso espiral"));
  });
});
