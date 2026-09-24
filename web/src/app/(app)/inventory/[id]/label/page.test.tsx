import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FilamentRoll } from "@/lib/inventory";
import type { Material } from "@/lib/materials";
import RollLabelPage from "./page";

// O QR não é decodificado opticamente aqui: o que estes testes provam é a string que entra no
// gerador e o tamanho do bloco impresso. Ler o código impresso é passo de navegador/celular.
const qr = vi.hoisted(() => ({ props: [] as Array<Record<string, unknown>> }));

vi.mock("qrcode.react", () => ({
  QRCodeSVG: (props: Record<string, unknown>) => {
    qr.props.push(props);
    return <svg data-testid="qr-code" />;
  },
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ROLL_ID = "8f3c1e2a-0000-4000-8000-000000000001";

const MATERIAL: Material = {
  id: "m1",
  type: "PLA",
  brand: "Voolt",
  color: "Preto",
  densityGCm3: 1.24,
  nozzleTempC: 210,
  bedTempC: 60,
  needsDrying: false,
  dryingTemperatureC: null,
  dryingHours: null,
  active: true,
  minimumStockGrams: null,
};

const ROLL: FilamentRoll = {
  id: ROLL_ID,
  materialId: "m1",
  supplierId: null,
  nominalWeightGrams: 1000,
  initialWeightGrams: 1000,
  balanceGrams: 800,
  spoolTareGrams: 250,
  batch: "L-2026-07",
  purchaseDate: "2026-07-14",
  openedAt: null,
  lastDriedAt: null,
  discardedAt: null,
  location: null,
  acquisitionCostCents: 12000,
  status: "fechado",
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
};

const materialsPage = (items: Material[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

type Route = () => Promise<Response>;

function stubApi(routes: Record<string, Route>) {
  const fetchMock = vi.fn((url: string) => {
    const path = url.replace("http://api.test:3001", "");
    const route = routes[path];
    if (!route) throw new Error(`rota inesperada: ${path}`);
    return route();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function stubRoll(roll: FilamentRoll | null) {
  return stubApi({
    [`/inventory/rolls/${ROLL_ID}`]: () =>
      roll === null
        ? Promise.resolve(jsonResponse(404, { error: "Rolo não encontrado" }))
        : Promise.resolve(jsonResponse(200, roll)),
    "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([MATERIAL]))),
  });
}

describe("Roll label page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
    qr.props.length = 0;
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("prints the material, nominal weight, batch, purchase date and short id", async () => {
    stubRoll(ROLL);
    render(<RollLabelPage params={Promise.resolve({ id: ROLL_ID })} />);

    const label = await screen.findByTestId("roll-label");
    expect(label.textContent).toContain("PLA · Voolt · Preto");
    expect(label.textContent).toContain("1000 g");
    expect(label.textContent).toContain("L-2026-07");
    expect(label.textContent).toContain("2026-07-14");
    expect(label.textContent).toContain("8f3c1e2a");
  });

  it("renders an em dash for a missing batch or purchase date", async () => {
    stubRoll({ ...ROLL, batch: null, purchaseDate: null });
    render(<RollLabelPage params={Promise.resolve({ id: ROLL_ID })} />);

    const label = await screen.findByTestId("roll-label");
    // Os dois rótulos continuam na etiqueta, com "—" no lugar do valor.
    expect(label.textContent).toContain("Lote");
    expect(label.textContent).toContain("Compra");
    expect(label.textContent).not.toContain("L-2026-07");
    expect(label.textContent).not.toContain("2026-07-14");
    expect(label.querySelectorAll("dd")).toHaveLength(5);
    const values = [...label.querySelectorAll("dd")].map((node) => node.textContent);
    expect(values).toEqual(["PLA · Voolt · Preto", "1000 g", "—", "—", "8f3c1e2a"]);
  });

  it("encodes exactly the origin plus the roll path", async () => {
    stubRoll(ROLL);
    render(<RollLabelPage params={Promise.resolve({ id: ROLL_ID })} />);

    await screen.findByTestId("qr-code");
    expect(qr.props.at(-1)?.value).toBe(
      "http://localhost:3000/inventory/8f3c1e2a-0000-4000-8000-000000000001",
    );
  });

  it("renders a 30mm level M code inside a 70x40mm label", async () => {
    stubRoll(ROLL);
    render(<RollLabelPage params={Promise.resolve({ id: ROLL_ID })} />);

    await screen.findByTestId("qr-code");
    const props = qr.props.at(-1);
    expect(props?.level).toBe("M");
    expect(props?.style).toEqual({ width: "30mm", height: "30mm" });

    const label = await screen.findByTestId("roll-label");
    expect(label.style.width).toBe("70mm");
    expect(label.style.height).toBe("40mm");
  });

  it("puts the code inside the label block and before the fields", async () => {
    // C40 mede o QR e o bloco separadamente: sem isto, o QR podia estar fora do bloco ou depois dos
    // campos e a suíte ficava verde. A composição aprovada é "QR de 30 mm à esquerda, campos à
    // direita".
    stubRoll(ROLL);
    render(<RollLabelPage params={Promise.resolve({ id: ROLL_ID })} />);

    const code = await screen.findByTestId("qr-code");
    const label = screen.getByTestId("roll-label");
    const fields = label.querySelector("dl") as HTMLElement;

    expect(label.contains(code)).toBe(true);
    expect(label.contains(fields)).toBe(true);
    // Node.DOCUMENT_POSITION_FOLLOWING (4): `fields` vem depois de `code` na ordem do documento.
    expect(code.compareDocumentPosition(fields) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(4);
  });

  it("lays the code beside the fields and keeps the screen chrome out of the print", async () => {
    // C56 prova a ordem do documento, que `flex-col` não muda: o eixo é decidido pela classe do
    // bloco. E o `print:hidden` desta tela é o do título e do botão "Imprimir" - o do `AppShell`
    // é outro arquivo (C41).
    stubRoll(ROLL);
    render(<RollLabelPage params={Promise.resolve({ id: ROLL_ID })} />);

    const label = await screen.findByTestId("roll-label");
    expect(label.className).toContain("flex");
    expect(label.className).not.toContain("flex-col");

    expect(screen.getByRole("heading", { name: "Etiqueta do rolo" }).className).toContain("print:hidden");
    const printButton = screen.getByRole("button", { name: "Imprimir" });
    expect((printButton.parentElement as HTMLElement).className).toContain("print:hidden");
    expect(label.className).not.toContain("print:hidden");
  });

  it("shows loading before the roll resolves", async () => {
    stubApi({
      [`/inventory/rolls/${ROLL_ID}`]: () => new Promise(() => undefined),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, materialsPage([MATERIAL]))),
    });
    render(<RollLabelPage params={Promise.resolve({ id: ROLL_ID })} />);

    expect(await screen.findByText("Carregando…")).toBeTruthy();
    expect(screen.queryByTestId("roll-label")).toBeNull();
    expect(screen.queryByTestId("qr-code")).toBeNull();
  });

  it("shows the error state and no code for an unknown roll", async () => {
    stubRoll(null);
    render(<RollLabelPage params={Promise.resolve({ id: ROLL_ID })} />);

    expect((await screen.findByRole("alert")).textContent).toBe("Rolo não encontrado");
    await waitFor(() => expect(screen.queryByTestId("qr-code")).toBeNull());
    expect(screen.queryByTestId("roll-label")).toBeNull();
    expect(qr.props).toHaveLength(0);
  });
});
