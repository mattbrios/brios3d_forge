import { describe, expect, it } from "vitest";
import { centsToReaisInput, decimalToInput, parseDecimal, parseReaisToCents, readNumbers } from "./number-input";

describe("parseDecimal", () => {
  it("parseDecimal reads 1,8 as 1.8", () => {
    expect(parseDecimal("1,8")).toEqual({ ok: true, value: 1.8 });
  });

  it("parseDecimal reads 1.9 as 1.9", () => {
    expect(parseDecimal("1.9")).toEqual({ ok: true, value: 1.9 });
  });

  it("parseDecimal reads 1.800 as 1.8", () => {
    expect(parseDecimal("1.800")).toEqual({ ok: true, value: 1.8 });
  });

  it("parseDecimal rejects more than one separator", () => {
    expect(parseDecimal("1.800,90")).toEqual({ ok: false, reason: "format" });
    expect(parseDecimal("1.2.3")).toEqual({ ok: false, reason: "format" });
    expect(parseDecimal("1,2,3")).toEqual({ ok: false, reason: "format" });
  });

  it("parseDecimal rejects non numeric text", () => {
    expect(parseDecimal("abc")).toEqual({ ok: false, reason: "format" });
    expect(parseDecimal("1a")).toEqual({ ok: false, reason: "format" });
  });

  it("parseDecimal reads blank as null", () => {
    expect(parseDecimal("")).toEqual({ ok: true, value: null });
    expect(parseDecimal("   ")).toEqual({ ok: true, value: null });
  });

  it("parseDecimal edge formats", () => {
    expect(parseDecimal("-5")).toEqual({ ok: true, value: -5 });
    expect(parseDecimal("  2,5  ")).toEqual({ ok: true, value: 2.5 });
    expect(parseDecimal(",5")).toEqual({ ok: false, reason: "format" });
    expect(parseDecimal("5,")).toEqual({ ok: false, reason: "format" });
    expect(parseDecimal("1 800")).toEqual({ ok: false, reason: "format" });
  });
});

describe("parseReaisToCents", () => {
  it("parseReaisToCents converts 10,10 to exactly 1010", () => {
    expect(parseReaisToCents("10,10")).toEqual({ ok: true, value: 1010 });
  });

  it("parseReaisToCents accepts 2 decimals by default", () => {
    expect(parseReaisToCents("10,12")).toEqual({ ok: true, value: 1012 });
  });

  it("parseReaisToCents rejects 3 decimals by default", () => {
    expect(parseReaisToCents("10,123")).toEqual({ ok: false, reason: "decimals" });
  });

  it("parseReaisToCents accepts 4 decimals when allowed", () => {
    expect(parseReaisToCents("0,8732", 4)).toEqual({ ok: true, value: 87.32 });
  });

  it("parseReaisToCents rejects 5 decimals when 4 are allowed", () => {
    expect(parseReaisToCents("0,87321", 4)).toEqual({ ok: false, reason: "decimals" });
  });

  it("parseReaisToCents converts whole reais", () => {
    expect(parseReaisToCents("89")).toEqual({ ok: true, value: 8900 });
  });
});

describe("input prefill", () => {
  it("centsToReaisInput writes 2 decimals without grouping", () => {
    expect(centsToReaisInput(8990)).toBe("89,90");
    expect(centsToReaisInput(180000)).toBe("1800,00");
  });

  it("centsToReaisInput writes up to 4 decimals", () => {
    expect(centsToReaisInput(87.32, 4)).toBe("0,8732");
  });

  it("decimalToInput writes comma without grouping", () => {
    expect(decimalToInput(1800)).toBe("1800");
    expect(decimalToInput(1.5)).toBe("1,5");
  });
});

describe("readNumbers", () => {
  it("readNumbers converts decimals and money in reais", () => {
    expect(
      readNumbers({
        weight: { label: "Peso", text: "1,5" },
        cost: { label: "Custo", text: "89,90", money: true },
        tariff: { label: "Tarifa", text: "0,8732", money: true, maxDecimals: 4 },
        optional: { label: "Mínimo", text: "" },
      }),
    ).toEqual({ ok: true, values: { weight: 1.5, cost: 8990, tariff: 87.32, optional: null } });
  });

  it("readNumbers reports the first invalid field in declaration order", () => {
    expect(
      readNumbers({
        first: { label: "Peso inicial", text: "1.2.3" },
        second: { label: "Custo", text: "10,123", money: true },
      }),
    ).toEqual({ ok: false, message: "Valor inválido em Peso inicial: use ponto ou vírgula apenas como separador decimal" });
    expect(readNumbers({ cost: { label: "Custo", text: "10,123", money: true } })).toEqual({
      ok: false,
      message: "Valor inválido em Custo: use no máximo 2 casas decimais",
    });
    expect(readNumbers({ tariff: { label: "Tarifa", text: "0,87321", money: true, maxDecimals: 4 } })).toEqual({
      ok: false,
      message: "Valor inválido em Tarifa: use no máximo 4 casas decimais",
    });
  });

  it("readNumbers rejects a blank required field only", () => {
    expect(readNumbers({ weight: { label: "Peso inicial", text: " ", required: true } })).toEqual({
      ok: false,
      message: "Preencha Peso inicial",
    });
    expect(readNumbers({ weight: { label: "Peso inicial", text: " " } })).toEqual({ ok: true, values: { weight: null } });
  });
});
