import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Material } from "@/lib/materials";
import MaterialsPage from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ADMIN_ME = { id: "u1", name: "Admin Um", email: "admin@test.local", role: "admin" };
const PRODUCTION_ME = { id: "u2", name: "Produção", email: "production@test.local", role: "production" };

const MATERIAL_1: Material = {
  id: "m1",
  type: "PLA",
  brand: "Marca A",
  color: "Natural",
  densityGCm3: 1.24,
  nozzleTempC: 210,
  bedTempC: 60,
  active: true,
  minimumStockGrams: null,
  colorHex: null,
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
const page = (items: Material[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

describe("Materials page", () => {
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
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([]))),
    });
    render(<MaterialsPage />);
    expect(screen.getByText("Carregando…")).toBeTruthy();
    resolveMe(jsonResponse(200, ADMIN_ME));
    await screen.findByText("Nenhum material encontrado.");
  });

  it("shows the error and retries", async () => {
    let materialsRoute: Route = () => Promise.reject(new TypeError("Failed to fetch"));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/materials?pageSize=100": () => materialsRoute(),
    });
    render(<MaterialsPage />);
    expect(await screen.findByText("Não foi possível conectar à API")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Tentar novamente" });

    materialsRoute = () => Promise.resolve(jsonResponse(200, page([MATERIAL_1])));
    fireEvent.click(retry);
    await screen.findByText("PLA");
    expect(callsTo(fetchMock, "/materials?pageSize=100")).toHaveLength(2);
  });

  it("shows an empty state when there are no materials", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([]))),
    });
    render(<MaterialsPage />);
    expect(await screen.findByText("Nenhum material encontrado.")).toBeTruthy();
    expect(screen.queryByText("Não foi possível conectar à API")).toBeNull();
  });

  it("non-admin sees the list without edit controls", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, PRODUCTION_ME)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([MATERIAL_1]))),
    });
    render(<MaterialsPage />);
    await screen.findByText("PLA");
    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desativar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("confirms before deactivating", async () => {
    const patched: Route = () => Promise.resolve(jsonResponse(200, { ...MATERIAL_1, active: false }));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([MATERIAL_1]))),
      "/materials/m1": () => patched(),
    });
    render(<MaterialsPage />);
    const row = (await screen.findByText("PLA")).closest("tr")!;

    fireEvent.click(within(row).getByRole("button", { name: "Desativar" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(callsTo(fetchMock, "/materials/m1")).toHaveLength(0);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(within(row).getByRole("button", { name: "Desativar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desativar" }));
    await within(row).findByText("Inativo");
    expect(callsTo(fetchMock, "/materials/m1")).toHaveLength(1);
    expect(bodyOf(callsTo(fetchMock, "/materials/m1")[0][1])).toEqual({ active: false });
  });

  it("shows the create error without reloading the list", async () => {
    const failed: Route = () => Promise.resolve(jsonResponse(400, { error: "densityGCm3 must not be greater than 10" }));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([MATERIAL_1]))),
      "/materials": (init) => (init?.method === "POST" ? failed() : Promise.reject(new Error("rota inesperada"))),
    });
    render(<MaterialsPage />);
    await screen.findByText("PLA");

    // A secagem saiu do material: o formulário não tem mais os três campos.
    expect(screen.queryByLabelText("Precisa secar")).toBeNull();
    expect(screen.queryByLabelText("Temperatura de secagem (°C)")).toBeNull();
    expect(screen.queryByLabelText("Horas de secagem")).toBeNull();

    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "ABS" } });
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Marca X" } });
    fireEvent.change(screen.getByLabelText("Cor"), { target: { value: "Preto" } });
    fireEvent.change(screen.getByLabelText("Densidade (g/cm³)"), { target: { value: "15" } });
    fireEvent.change(screen.getByLabelText("Temperatura do bico (°C)"), { target: { value: "240" } });
    fireEvent.change(screen.getByLabelText("Temperatura da mesa (°C)"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("densityGCm3 must not be greater than 10")).toBeTruthy();
    expect(screen.getByText("PLA")).toBeTruthy();
    expect(screen.queryByText("ABS")).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => (url as string).endsWith("/materials?pageSize=100"))).toBe(true);
    expect(callsTo(fetchMock, "/materials?pageSize=100")).toHaveLength(1);
  });

  it("admin creates a material without reloading", async () => {
    const created: Route = () =>
      Promise.resolve(
        jsonResponse(201, {
          id: "m3",
          type: "ABS",
          brand: "Marca X",
          color: "Preto",
          densityGCm3: 1.05,
          nozzleTempC: 240,
          bedTempC: 90,
          active: true,
          minimumStockGrams: null,
          colorHex: null,
        }),
      );
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([MATERIAL_1]))),
      "/materials": (init) => (init?.method === "POST" ? created() : Promise.reject(new Error("rota inesperada"))),
    });
    render(<MaterialsPage />);
    await screen.findByText("PLA");

    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "ABS" } });
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Marca X" } });
    fireEvent.change(screen.getByLabelText("Cor"), { target: { value: "Preto" } });
    fireEvent.change(screen.getByLabelText("Densidade (g/cm³)"), { target: { value: "1.05" } });
    fireEvent.change(screen.getByLabelText("Temperatura do bico (°C)"), { target: { value: "240" } });
    fireEvent.change(screen.getByLabelText("Temperatura da mesa (°C)"), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await screen.findByText("ABS");
    const postCalls = callsTo(fetchMock, "/materials").filter(([, init]) => init?.method === "POST");
    expect(postCalls).toHaveLength(1);
    expect(bodyOf(postCalls[0][1])).toEqual({
      type: "ABS",
      brand: "Marca X",
      color: "Preto",
      densityGCm3: 1.05,
      nozzleTempC: 240,
      bedTempC: 90,
      // O mínimo não foi tocado: vai o padrão do formulário novo (material-brand-tone, AC 2).
      minimumStockGrams: 100,
      colorHex: null,
    });
  });

  it("shows the minimum column as grams or an em dash", async () => {
    // Fase 11: a coluna existia sem nenhuma asserção, então trocar o nulo por "0 g" - que é uma
    // política diferente de "sem mínimo" - passava a suíte inteira.
    const withMinimum: Material = { ...MATERIAL_1, id: "m9", type: "ABS", minimumStockGrams: 500 };
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([withMinimum, MATERIAL_1]))),
    });
    render(<MaterialsPage />);
    const withRow = (await screen.findByText("ABS")).closest("tr") as HTMLTableRowElement;
    const withoutRow = screen.getByText("PLA").closest("tr") as HTMLTableRowElement;
    // A coluna "Mínimo" é a 7a, entre "Mesa °C" e "Situação".
    expect(within(withRow).getAllByRole("cell")[6].textContent).toBe("500 g");
    expect(within(withoutRow).getAllByRole("cell")[6].textContent).toBe("—");
  });
  it("prefills the minimum field from the row, empty when there is no minimum", async () => {
    // O galho de `formFromMaterial`. Se o nulo prefilasse "0", abrir o formulário de um material sem
    // piso e salvar sem tocar no campo gravaria mínimo 0 - "política de zero" onde o door 1 decidiu
    // "sem política" - e aquele material nunca mais alertaria, em silêncio. Os dois lados, porque só
    // o vazio não distingue "" de String(null).
    const withMinimum: Material = { ...MATERIAL_1, id: "m9", type: "ABS", minimumStockGrams: 500 };
    const cases: Array<[Material, string, string]> = [
      [MATERIAL_1, "PLA", ""],
      [withMinimum, "ABS", "500"],
    ];
    for (const [material, type, prefilled] of cases) {
      stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
        "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([material]))),
      });
      render(<MaterialsPage />);
      await screen.findByText(type);
      fireEvent.click(screen.getByRole("button", { name: "Editar" }));
      const field = screen.getByLabelText("Estoque mínimo (g, opcional)") as HTMLInputElement;
      expect(field.value, `material ${type}`).toBe(prefilled);
      cleanup();
      vi.unstubAllGlobals();
    }
  });
  it("sends the typed minimum as a number and the empty field as null", async () => {
    // Os dois galhos de buildBody. Sem o primeiro, definir 500 g pela tela - o AC 1 visto pelo
    // usuario - nao tinha prova em nenhum nivel de tela.
    const cases: Array<[string, number | null]> = [
      ["500", 500],
      ["", null],
    ];
    for (const [typed, expected] of cases) {
      const fetchMock = stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
        "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([MATERIAL_1]))),
        "/materials/m1": () => Promise.resolve(jsonResponse(200, { ...MATERIAL_1, minimumStockGrams: expected })),
      });
      render(<MaterialsPage />);
      await screen.findByText("PLA");
      fireEvent.click(screen.getByRole("button", { name: "Editar" }));
      fireEvent.change(screen.getByLabelText("Estoque mínimo (g, opcional)"), { target: { value: typed } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
      await vi.waitFor(() => expect(callsTo(fetchMock, "/materials/m1")).toHaveLength(1));
      expect(bodyOf(callsTo(fetchMock, "/materials/m1")[0][1]).minimumStockGrams, `digitado "${typed}"`).toBe(
        expected,
      );
      cleanup();
      vi.unstubAllGlobals();
    }
  });
  it("admin edits a material without reloading", async () => {
    const patched: Route = () => Promise.resolve(jsonResponse(200, { ...MATERIAL_1, color: "Vermelho" }));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([MATERIAL_1]))),
      "/materials/m1": () => patched(),
    });
    render(<MaterialsPage />);
    const row = (await screen.findByText("PLA")).closest("tr")!;

    fireEvent.click(within(row).getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Cor"), { target: { value: "Vermelho" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await within(row).findByText("Vermelho");
    expect(callsTo(fetchMock, "/materials/m1")).toHaveLength(1);
  });

  describe("numbers in pt-BR (issue #9)", () => {
    it("blank optional minimum is sent as null", async () => {
      const fetchMock = stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
        "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page([MATERIAL_1]))),
        "/materials": (init) => Promise.resolve(jsonResponse(201, { ...MATERIAL_1, id: "m3", type: "ABS", ...bodyOf(init) })),
      });
      render(<MaterialsPage />);
      await screen.findByText("PLA");
      fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "ABS" } });
      fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Marca X" } });
      fireEvent.change(screen.getByLabelText("Cor"), { target: { value: "Preto" } });
      fireEvent.change(screen.getByLabelText("Densidade (g/cm³)"), { target: { value: "1,05" } });
      fireEvent.change(screen.getByLabelText("Temperatura do bico (°C)"), { target: { value: "240" } });
      fireEvent.change(screen.getByLabelText("Temperatura da mesa (°C)"), { target: { value: "90" } });
      fireEvent.change(screen.getByLabelText("Estoque mínimo (g, opcional)"), { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

      await screen.findByText("ABS");
      const body = bodyOf(callsTo(fetchMock, "/materials").filter(([, init]) => init?.method === "POST")[0][1]);
      expect(body.minimumStockGrams).toBe(null);
      expect(body.densityGCm3).toBe(1.05);
    });

    it("minimum in pt-BR", async () => {
      stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
        "/materials?pageSize=100": () =>
          Promise.resolve(jsonResponse(200, page([{ ...MATERIAL_1, minimumStockGrams: 1000 }]))),
      });
      render(<MaterialsPage />);
      const row = (await screen.findByText("PLA")).closest("tr") as HTMLTableRowElement;
      expect(within(row).getAllByRole("cell")[6].textContent).toBe("1.000 g");
    });
  });

  describe("defaults, brand suggestions and tone (material-brand-tone)", () => {
    const BRANDS = ["3D Fila", "Bambu Lab", "Voolt"];

    // Admin com a lista de materiais e as marcas; `extra` acrescenta ou troca rotas.
    function adminApi(extra: Record<string, Route> = {}, brands: string[] = BRANDS, materials: Material[] = [MATERIAL_1]) {
      return stubApi({
        "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
        "/materials?pageSize=100": () => Promise.resolve(jsonResponse(200, page(materials))),
        "/materials/brands": () => Promise.resolve(jsonResponse(200, brands)),
        ...extra,
      });
    }

    const echoCreate: Route = (init) =>
      Promise.resolve(jsonResponse(201, { ...MATERIAL_1, id: "m3", ...bodyOf(init) }));
    const postsOf = (fetchMock: ReturnType<typeof stubApi>) =>
      callsTo(fetchMock, "/materials").filter(([, init]) => init?.method === "POST");
    const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
    const brandBox = () => screen.getByRole("combobox", { name: "Marca" }) as HTMLInputElement;
    const swatch = () => screen.getByTitle("Escolher tom");
    const optionNames = () => screen.getAllByRole("option").map((option) => option.textContent);

    async function renderAdmin(fetchMock?: ReturnType<typeof stubApi>) {
      const mock = fetchMock ?? adminApi();
      render(<MaterialsPage />);
      await screen.findByText("PLA");
      await vi.waitFor(() => expect(callsTo(mock, "/materials/brands")).toHaveLength(1));
      return mock;
    }

    function fillRequired() {
      fireEvent.change(input("Tipo"), { target: { value: "PETG" } });
      fireEvent.change(brandBox(), { target: { value: "Voolt" } });
      fireEvent.change(input("Cor"), { target: { value: "Laranja" } });
    }

    // S1 - padrões do formulário novo

    it("new material form starts with the usual defaults", async () => {
      await renderAdmin();

      expect(input("Tipo").value).toBe("");
      expect(brandBox().value).toBe("");
      expect(input("Cor").value).toBe("");
      expect(input("Densidade (g/cm³)").value).toBe("1,24");
      expect(input("Temperatura do bico (°C)").value).toBe("220");
      expect(input("Temperatura da mesa (°C)").value).toBe("65");
      expect(input("Estoque mínimo (g, opcional)").value).toBe("100");
      expect(swatch().className).toContain("bf-swatch--none");
      expect(screen.queryByRole("button", { name: "Remover" })).toBeNull();
    });

    it("sends the defaults as numbers", async () => {
      const fetchMock = await renderAdmin(adminApi({ "/materials": echoCreate }));

      fillRequired();
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

      await vi.waitFor(() => expect(postsOf(fetchMock)).toHaveLength(1));
      expect(bodyOf(postsOf(fetchMock)[0][1])).toEqual({
        type: "PETG",
        brand: "Voolt",
        color: "Laranja",
        colorHex: null,
        densityGCm3: 1.24,
        nozzleTempC: 220,
        bedTempC: 65,
        minimumStockGrams: 100,
      });
    });

    it("cleared default minimum is sent as null", async () => {
      const fetchMock = await renderAdmin(adminApi({ "/materials": echoCreate }));

      fillRequired();
      fireEvent.change(input("Estoque mínimo (g, opcional)"), { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

      await vi.waitFor(() => expect(postsOf(fetchMock)).toHaveLength(1));
      expect(bodyOf(postsOf(fetchMock)[0][1]).minimumStockGrams).toBeNull();
    });

    it("resets the new form to the defaults after saving", async () => {
      const fetchMock = await renderAdmin(adminApi({ "/materials": echoCreate }));

      fillRequired();
      fireEvent.change(input("Tom"), { target: { value: "#ff8800" } });
      fireEvent.change(input("Densidade (g/cm³)"), { target: { value: "1,3" } });
      fireEvent.change(input("Temperatura do bico (°C)"), { target: { value: "240" } });
      fireEvent.change(input("Temperatura da mesa (°C)"), { target: { value: "80" } });
      fireEvent.change(input("Estoque mínimo (g, opcional)"), { target: { value: "500" } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

      await screen.findByText("PETG");
      expect(postsOf(fetchMock)).toHaveLength(1);
      expect(input("Tipo").value).toBe("");
      expect(brandBox().value).toBe("");
      expect(input("Cor").value).toBe("");
      expect(input("Densidade (g/cm³)").value).toBe("1,24");
      expect(input("Temperatura do bico (°C)").value).toBe("220");
      expect(input("Temperatura da mesa (°C)").value).toBe("65");
      expect(input("Estoque mínimo (g, opcional)").value).toBe("100");
      expect(swatch().className).toContain("bf-swatch--none");
      expect(screen.queryByRole("button", { name: "Remover" })).toBeNull();
    });

    it("keeps the typed values when the create fails", async () => {
      await renderAdmin(
        adminApi({ "/materials": () => Promise.resolve(jsonResponse(400, { error: "type must be shorter" })) }),
      );

      fillRequired();
      fireEvent.change(input("Tom"), { target: { value: "#ff8800" } });
      fireEvent.change(input("Densidade (g/cm³)"), { target: { value: "1,3" } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

      expect(await screen.findByText("type must be shorter")).toBeTruthy();
      expect(input("Tipo").value).toBe("PETG");
      expect(brandBox().value).toBe("Voolt");
      expect(input("Cor").value).toBe("Laranja");
      expect(input("Tom").value).toBe("#ff8800");
      expect(input("Densidade (g/cm³)").value).toBe("1,3");
      expect(screen.getByRole("button", { name: "Remover" })).toBeTruthy();
    });

    it("edit form uses the material values, never the defaults", async () => {
      const material: Material = { ...MATERIAL_1, densityGCm3: 1.1, nozzleTempC: 200, bedTempC: 50, minimumStockGrams: null };
      await renderAdmin(adminApi({}, BRANDS, [material]));

      fireEvent.click(screen.getByRole("button", { name: "Editar" }));

      expect(input("Densidade (g/cm³)").value).toBe("1,1");
      expect(input("Temperatura do bico (°C)").value).toBe("200");
      expect(input("Temperatura da mesa (°C)").value).toBe("50");
      expect(input("Estoque mínimo (g, opcional)").value).toBe("");
    });

    // S3 - sugestão de marca

    it("suggests brands containing the typed letter", async () => {
      await renderAdmin();

      fireEvent.change(brandBox(), { target: { value: "a" } });

      expect(brandBox().getAttribute("aria-expanded")).toBe("true");
      expect(optionNames()).toEqual(["3D Fila", "Bambu Lab"]);
    });

    it("brand list stays closed while the field is empty", async () => {
      await renderAdmin();

      expect(brandBox().getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByRole("listbox")).toBeNull();

      fireEvent.change(brandBox(), { target: { value: "a" } });
      fireEvent.change(brandBox(), { target: { value: "" } });

      expect(brandBox().getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("suggests brands ignoring case and accents", async () => {
      await renderAdmin(adminApi({}, ["Ação 3D", "Voolt"]));

      fireEvent.change(brandBox(), { target: { value: "ACAO" } });

      expect(optionNames()).toEqual(["Ação 3D"]);
    });

    it("shows at most 8 brand suggestions", async () => {
      const ten = ["Marca 01", "Marca 02", "Marca 03", "Marca 04", "Marca 05", "Marca 06", "Marca 07", "Marca 08", "Marca 09", "Marca 10"];
      await renderAdmin(adminApi({}, ten));

      fireEvent.change(brandBox(), { target: { value: "a" } });

      expect(optionNames()).toEqual(["Marca 01", "Marca 02", "Marca 03", "Marca 04", "Marca 05", "Marca 06", "Marca 07", "Marca 08"]);
    });

    it("brand list stays closed when nothing matches", async () => {
      await renderAdmin();

      fireEvent.change(brandBox(), { target: { value: "xyz" } });

      expect(brandBox().getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(screen.queryByText(/nenhuma/i)).toBeNull();
    });

    it("clicking a suggestion fills the brand", async () => {
      await renderAdmin();

      fireEvent.change(brandBox(), { target: { value: "a" } });
      fireEvent.click(screen.getByRole("option", { name: "Bambu Lab" }));

      expect(brandBox().value).toBe("Bambu Lab");
      expect(brandBox().getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    it("ArrowDown and Enter pick a suggestion without submitting", async () => {
      const fetchMock = await renderAdmin(adminApi({ "/materials": echoCreate }));

      fireEvent.change(brandBox(), { target: { value: "a" } });
      fireEvent.keyDown(brandBox(), { key: "ArrowDown" });
      // `false` = o Enter teve o padrão cancelado, então o navegador não envia o formulário.
      expect(fireEvent.keyDown(brandBox(), { key: "Enter" })).toBe(false);

      expect(brandBox().value).toBe("3D Fila");
      expect(brandBox().getAttribute("aria-expanded")).toBe("false");
      expect(postsOf(fetchMock)).toHaveLength(0);
    });

    it("Escape closes the brand list and keeps the text", async () => {
      await renderAdmin();

      fireEvent.change(brandBox(), { target: { value: "Bam" } });
      expect(brandBox().getAttribute("aria-expanded")).toBe("true");
      fireEvent.keyDown(brandBox(), { key: "Escape" });

      expect(brandBox().getAttribute("aria-expanded")).toBe("false");
      expect(brandBox().value).toBe("Bam");
    });

    it("brand combobox exposes the ARIA combobox pattern", async () => {
      await renderAdmin();

      fireEvent.change(brandBox(), { target: { value: "a" } });
      const listbox = screen.getByRole("listbox");
      const options = within(listbox).getAllByRole("option");

      expect(brandBox().getAttribute("aria-controls")).toBe(listbox.id);
      expect(options).toHaveLength(2);
      expect(brandBox().getAttribute("aria-activedescendant")).toBeNull();

      fireEvent.keyDown(brandBox(), { key: "ArrowDown" });

      expect(brandBox().getAttribute("aria-activedescendant")).toBe(options[0].id);
      expect(options[0].getAttribute("aria-selected")).toBe("true");
    });

    it("accepts a new brand typed freely", async () => {
      const fetchMock = await renderAdmin(adminApi({ "/materials": echoCreate }));

      fillRequired();
      fireEvent.change(brandBox(), { target: { value: "Marca Nova" } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

      await vi.waitFor(() => expect(postsOf(fetchMock)).toHaveLength(1));
      expect(bodyOf(postsOf(fetchMock)[0][1]).brand).toBe("Marca Nova");
    });

    it("edit form offers the same brand suggestions", async () => {
      await renderAdmin();

      fireEvent.click(screen.getByRole("button", { name: "Editar" }));
      fireEvent.change(brandBox(), { target: { value: "" } });
      fireEvent.change(brandBox(), { target: { value: "a" } });

      expect(optionNames()).toEqual(["3D Fila", "Bambu Lab"]);
    });

    it("a saved new brand joins the suggestions", async () => {
      const fetchMock = await renderAdmin(adminApi({ "/materials": echoCreate }));

      fillRequired();
      fireEvent.change(brandBox(), { target: { value: "Marca Nova" } });
      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
      await screen.findByText("PETG");

      fireEvent.change(brandBox(), { target: { value: "Nova" } });

      expect(optionNames()).toEqual(["Marca Nova"]);
      expect(callsTo(fetchMock, "/materials/brands")).toHaveLength(1);
    });

    it("brands failure keeps the page working without suggestions", async () => {
      await renderAdmin(
        adminApi({ "/materials/brands": () => Promise.resolve(jsonResponse(500, { error: "Internal server error" })) }),
      );

      expect(screen.getByText("PLA")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Salvar" })).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();

      fireEvent.change(brandBox(), { target: { value: "a" } });

      expect(brandBox().getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByRole("listbox")).toBeNull();
    });

    // S6 - tom no formulário e na tabela

    it("new form starts without a tone", async () => {
      await renderAdmin();

      expect(swatch().className).toContain("bf-swatch--none");
      expect(swatch().style.background).toBe("");
      expect(screen.queryByRole("button", { name: "Remover" })).toBeNull();
    });

    it("the swatch labels a color input named Tom", async () => {
      await renderAdmin();

      const tone = input("Tom");
      expect(tone.type).toBe("color");
      expect(swatch().tagName).toBe("LABEL");
      expect((swatch() as HTMLLabelElement).htmlFor).toBe(tone.id);
    });

    it("picking a tone paints the swatch and sends it", async () => {
      const fetchMock = await renderAdmin(adminApi({ "/materials": echoCreate }));

      fillRequired();
      fireEvent.change(input("Tom"), { target: { value: "#ff8800" } });

      expect(swatch().style.background).toBe("rgb(255, 136, 0)");
      expect(swatch().className).not.toContain("bf-swatch--none");
      expect(screen.getByRole("button", { name: "Remover" })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
      await vi.waitFor(() => expect(postsOf(fetchMock)).toHaveLength(1));
      expect(bodyOf(postsOf(fetchMock)[0][1]).colorHex).toBe("#ff8800");
    });

    it("Remover returns to no tone and sends null", async () => {
      const fetchMock = await renderAdmin(adminApi({ "/materials": echoCreate }));

      fillRequired();
      fireEvent.change(input("Tom"), { target: { value: "#ff8800" } });
      fireEvent.click(screen.getByRole("button", { name: "Remover" }));

      expect(swatch().className).toContain("bf-swatch--none");
      expect(swatch().style.background).toBe("");
      expect(screen.queryByRole("button", { name: "Remover" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
      await vi.waitFor(() => expect(postsOf(fetchMock)).toHaveLength(1));
      expect(bodyOf(postsOf(fetchMock)[0][1]).colorHex).toBeNull();
    });

    it("edit form shows the stored tone", async () => {
      const cases: Array<[Material, boolean]> = [
        [{ ...MATERIAL_1, colorHex: "#ff8800" }, true],
        [MATERIAL_1, false],
      ];
      for (const [material, toned] of cases) {
        await renderAdmin(adminApi({}, BRANDS, [material]));
        fireEvent.click(screen.getByRole("button", { name: "Editar" }));

        if (toned) {
          expect(swatch().style.background, "com tom").toBe("rgb(255, 136, 0)");
          expect(input("Tom").value).toBe("#ff8800");
          expect(screen.getByRole("button", { name: "Remover" })).toBeTruthy();
        } else {
          expect(swatch().className, "sem tom").toContain("bf-swatch--none");
          expect(screen.queryByRole("button", { name: "Remover" })).toBeNull();
        }
        cleanup();
        vi.unstubAllGlobals();
      }
    });

    it("table shows the tone swatch beside the color name", async () => {
      await renderAdmin(adminApi({}, BRANDS, [{ ...MATERIAL_1, color: "Laranja", colorHex: "#ff8800" }]));

      const row = screen.getByText("PLA").closest("tr") as HTMLTableRowElement;
      const colorCell = within(row).getAllByRole("cell")[2];

      expect(colorCell.textContent).toBe("Laranja");
      expect(within(colorCell).getByRole("img", { name: "Tom #ff8800" })).toBeTruthy();
    });

    it("table shows only the color name without a tone", async () => {
      await renderAdmin();

      const row = screen.getByText("PLA").closest("tr") as HTMLTableRowElement;
      const colorCell = within(row).getAllByRole("cell")[2];

      expect(colorCell.textContent).toBe("Natural");
      expect(within(colorCell).queryByRole("img")).toBeNull();
    });
  });
});
