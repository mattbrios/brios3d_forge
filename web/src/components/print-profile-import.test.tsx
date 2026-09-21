import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import seaAnimals from "./fixtures/print-profile-import.json";
import { PrintProfileImport } from "./print-profile-import";

const SEA_STAR_URL =
  "https://makerworld.com/pt/models/3007827-sea-animals-set?from=recommend#profileId-3387944";
const UNAVAILABLE = "Não foi possível consultar o MakerWorld agora. Preencha os dados manualmente";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function importUrl(url = SEA_STAR_URL) {
  fireEvent.change(screen.getByLabelText("URL do MakerWorld"), { target: { value: url } });
  fireEvent.click(screen.getByRole("button", { name: "Importar" }));
}

function valueOf(label: string, row?: number): string {
  const element =
    row === undefined ? screen.getByLabelText(label) : screen.getAllByLabelText(label)[row];
  return (element as HTMLInputElement).value;
}

function filamentRows(): HTMLElement[] {
  return screen.queryAllByRole("group", { name: /^Filamento/ });
}

function expectBlankForm() {
  expect(valueOf("Horas")).toBe("");
  expect(valueOf("Minutos")).toBe("");
  expect((screen.getByLabelText("Precisa de AMS") as HTMLInputElement).checked).toBe(false);
  expect(valueOf("Impressora")).toBe("");
  expect(valueOf("Bico (mm)")).toBe("");
  expect(filamentRows()).toHaveLength(0);
}

describe("PrintProfileImport", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fills the form from the import", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, seaAnimals));
    vi.stubGlobal("fetch", fetchMock);
    render(<PrintProfileImport />);
    importUrl();

    await screen.findByRole("combobox", { name: "Perfil" });
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe("http://api.test:3001/print-profiles/import");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ url: SEA_STAR_URL });

    expect(valueOf("Horas")).toBe("0");
    expect(valueOf("Minutos")).toBe("28");
    expect((screen.getByLabelText("Precisa de AMS") as HTMLInputElement).checked).toBe(true);
    expect(valueOf("Impressora")).toBe("X2D");
    expect(valueOf("Bico (mm)")).toBe("0,4");

    const rows = filamentRows();
    expect(rows).toHaveLength(2);
    const expected = [
      { slot: "1", type: "PLA", color: "#FD8008", grams: "8", rgb: "rgb(253, 128, 8)" },
      { slot: "4", type: "PLA", color: "#000000", grams: "1", rgb: "rgb(0, 0, 0)" },
    ];
    expected.forEach((filament, i) => {
      const row = within(rows[i]);
      expect((row.getByLabelText("Slot") as HTMLInputElement).value).toBe(filament.slot);
      expect((row.getByLabelText("Tipo") as HTMLInputElement).value).toBe(filament.type);
      expect((row.getByLabelText("Cor") as HTMLInputElement).value).toBe(filament.color);
      expect((row.getByLabelText("Gramas") as HTMLInputElement).value).toBe(filament.grams);
      expect(row.getByTestId("color-swatch").style.backgroundColor).toBe(filament.rgb);
    });
  });

  it("shows importing", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));
    render(<PrintProfileImport />);
    importUrl();
    expect(screen.getByText("Importando…")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Importar" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("switches profile without refetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, seaAnimals));
    vi.stubGlobal("fetch", fetchMock);
    render(<PrintProfileImport />);
    importUrl();

    const select = (await screen.findByRole("combobox", { name: "Perfil" })) as HTMLSelectElement;
    const options = within(select).getAllByRole("option") as HTMLOptionElement[];
    expect(options).toHaveLength(3);
    expect(options[0].textContent).toBe("Sea star · 0 h 28 min · 9 g");
    expect(options.map((option) => option.textContent)).toEqual([
      "Sea star · 0 h 28 min · 9 g",
      "Sea shell · 0 h 33 min · 9 g",
      "0.2mm layer, 2 walls, 15% infill · 21 h 24 min · 408 g",
    ]);
    expect(select.value).toBe("3387944");

    fireEvent.change(select, { target: { value: "3377800" } });
    expect(valueOf("Horas")).toBe("21");
    expect(valueOf("Minutos")).toBe("24");
    expect(filamentRows()).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("null fields are blank and editable", async () => {
    const response = structuredClone(seaAnimals);
    const seaStar = response.profiles.find((profile) => profile.id === 3387944);
    if (!seaStar) throw new Error("fixture sem o Sea star");
    (seaStar.printer as { name: string | null }).name = null;
    (seaStar.filaments[0] as { grams: number | null }).grams = null;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, response)));
    render(<PrintProfileImport />);
    importUrl();

    await screen.findByRole("combobox", { name: "Perfil" });
    expect(valueOf("Impressora")).toBe("");
    const grams = within(filamentRows()[0]).getByLabelText("Gramas") as HTMLInputElement;
    expect(grams.value).toBe("");

    fireEvent.change(screen.getByLabelText("Impressora"), { target: { value: "A1 mini" } });
    fireEvent.change(grams, { target: { value: "7,5" } });
    expect(valueOf("Impressora")).toBe("A1 mini");
    expect(grams.value).toBe("7,5");
  });

  it("error shows message and blank form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(502, { error: UNAVAILABLE })));
    render(<PrintProfileImport />);
    importUrl();
    expect(await screen.findByText(UNAVAILABLE)).toBeTruthy();
    expectBlankForm();
    fireEvent.change(screen.getByLabelText("Impressora"), { target: { value: "X1C" } });
    expect(valueOf("Impressora")).toBe("X1C");

    cleanup();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<PrintProfileImport />);
    importUrl();
    expect(await screen.findByText("Não foi possível conectar à API")).toBeTruthy();
    expectBlankForm();
  });

  it("model without profiles", async () => {
    const response = { ...structuredClone(seaAnimals), profiles: [], selectedProfileId: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, response)));
    render(<PrintProfileImport />);
    importUrl();
    expect(
      await screen.findByText(
        "Este modelo não tem perfis de impressão no MakerWorld. Preencha os dados manualmente",
      ),
    ).toBeTruthy();
    expectBlankForm();
  });

  it("blank form and filament rows", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<PrintProfileImport />);

    expect(screen.getByLabelText("URL do MakerWorld")).toBeTruthy();
    expectBlankForm();
    expect(fetchMock).not.toHaveBeenCalled();

    const add = screen.getByRole("button", { name: "Adicionar filamento" });
    fireEvent.click(add);
    fireEvent.click(add);
    expect(filamentRows()).toHaveLength(2);
    filamentRows().forEach((row) => {
      expect((within(row).getByLabelText("Tipo") as HTMLInputElement).value).toBe("");
    });

    fireEvent.change(within(filamentRows()[1]).getByLabelText("Tipo"), {
      target: { value: "PETG" },
    });
    fireEvent.click(within(filamentRows()[0]).getByRole("button", { name: "Remover" }));
    expect(filamentRows()).toHaveLength(1);
    expect((within(filamentRows()[0]).getByLabelText("Tipo") as HTMLInputElement).value).toBe(
      "PETG",
    );
  });

  it("a failed or empty import after a success clears the form", async () => {
    const empty = { ...structuredClone(seaAnimals), profiles: [], selectedProfileId: null };
    const outcomes = [
      {
        second: jsonResponse(502, { error: UNAVAILABLE }),
        message: UNAVAILABLE,
      },
      {
        second: jsonResponse(200, empty),
        message:
          "Este modelo não tem perfis de impressão no MakerWorld. Preencha os dados manualmente",
      },
    ];
    for (const { second, message } of outcomes) {
      cleanup();
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(jsonResponse(200, seaAnimals))
          .mockResolvedValueOnce(second),
      );
      render(<PrintProfileImport />);
      importUrl();
      await screen.findByRole("combobox", { name: "Perfil" });
      expect(filamentRows()).toHaveLength(2);

      importUrl();
      expect(await screen.findByText(message)).toBeTruthy();
      expect(screen.queryByRole("combobox", { name: "Perfil" })).toBeNull();
      expectBlankForm();
    }
  });

  it("opens on the selected profile, not the first one", async () => {
    const response = { ...structuredClone(seaAnimals), selectedProfileId: 3377800 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, response)));
    render(<PrintProfileImport />);
    importUrl("https://makerworld.com/models/3007827");

    const select = (await screen.findByRole("combobox", { name: "Perfil" })) as HTMLSelectElement;
    expect(select.value).toBe("3377800");
    expect(valueOf("Horas")).toBe("21");
    expect(valueOf("Minutos")).toBe("24");
    expect(filamentRows()).toHaveLength(4);
  });

  it("every null field of the form is blank and editable", async () => {
    type Nullable = {
      printSeconds: number | null;
      needsAms: boolean | null;
      printer: { name: string | null; nozzleDiameterMm: number | null };
      filaments: { type: string | null; color: string | null; meters: number | null }[];
    };
    const response = structuredClone(seaAnimals);
    const seaStar = response.profiles.find((profile) => profile.id === 3387944) as unknown as
      | Nullable
      | undefined;
    if (!seaStar) throw new Error("fixture sem o Sea star");
    seaStar.printSeconds = null;
    seaStar.needsAms = null;
    seaStar.printer.nozzleDiameterMm = null;
    seaStar.filaments[0].type = null;
    seaStar.filaments[0].color = null;
    seaStar.filaments[0].meters = null;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, response)));
    render(<PrintProfileImport />);
    importUrl();
    await screen.findByRole("combobox", { name: "Perfil" });

    // AMS desconhecido abre desmarcado: "vazio" para uma caixa de seleção.
    const ams = screen.getByLabelText("Precisa de AMS") as HTMLInputElement;
    expect(ams.checked).toBe(false);
    fireEvent.click(ams);
    expect(ams.checked).toBe(true);

    const row = within(filamentRows()[0]);
    const fields: [HTMLInputElement, string][] = [
      [screen.getByLabelText("Horas") as HTMLInputElement, "1"],
      [screen.getByLabelText("Minutos") as HTMLInputElement, "5"],
      [screen.getByLabelText("Bico (mm)") as HTMLInputElement, "0,6"],
      [row.getByLabelText("Tipo") as HTMLInputElement, "PETG"],
      [row.getByLabelText("Cor") as HTMLInputElement, "#00FF00"],
      [row.getByLabelText("Metros") as HTMLInputElement, "3,1"],
    ];
    for (const [input, typed] of fields) {
      expect(input.value).toBe("");
      fireEvent.change(input, { target: { value: typed } });
      expect(input.value).toBe(typed);
    }
  });
});
