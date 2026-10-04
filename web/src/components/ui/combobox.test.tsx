import { describe, expect, it } from "vitest";
import { matchOptions } from "./combobox";

// Uma linha por decisão do filtro (door 5, AD-032).
describe("matchOptions", () => {
  it("matchOptions matches the text anywhere in the option", () => {
    expect(matchOptions(["3D Fila", "Bambu Lab", "Voolt"], "a", 8)).toEqual(["3D Fila", "Bambu Lab"]);
  });

  it("matchOptions ignores case and accents", () => {
    expect(matchOptions(["Ação 3D", "Voolt"], "ACAO", 8)).toEqual(["Ação 3D"]);
    expect(matchOptions(["Ação 3D", "Voolt"], "açã", 8)).toEqual(["Ação 3D"]);
  });

  it("matchOptions caps the result keeping the input order", () => {
    const ten = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9", "A10"];
    expect(matchOptions(ten, "a", 8)).toEqual(["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]);
    const eight = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"];
    expect(matchOptions(eight, "a", 8)).toEqual(["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]);
  });

  it("matchOptions returns nothing for blank text", () => {
    expect(matchOptions(["Voolt", "Bambu Lab"], "", 8)).toEqual([]);
    expect(matchOptions(["Voolt", "Bambu Lab"], "   ", 8)).toEqual([]);
  });

  it("matchOptions returns nothing when no option matches", () => {
    expect(matchOptions(["Voolt"], "xyz", 8)).toEqual([]);
  });
});
