import { describe, expect, it } from "vitest";
import { meterFillFor } from "./meter-tone";

describe("meterFillFor", () => {
  it("no tone returns null", () => {
    expect(meterFillFor(null)).toBeNull();
  });

  it("material not found returns null", () => {
    expect(meterFillFor(undefined)).toBeNull();
  });

  it("dark tone is drawn without outline", () => {
    expect(meterFillFor("#1e88e5")).toEqual({ color: "#1e88e5", outlined: false });
  });

  it("white is drawn with outline", () => {
    expect(meterFillFor("#ffffff")).toEqual({ color: "#ffffff", outlined: true });
  });

  it("uppercase white is drawn with outline", () => {
    expect(meterFillFor("#FFFFFF")).toEqual({ color: "#FFFFFF", outlined: true });
  });

  // Contraste contra o trilho #F1F1F1: #c7c7c7 = 1,4967 e #c6c6c6 = 1,5123.
  it("last tone below the 1.5 contrast gets outline", () => {
    expect(meterFillFor("#c7c7c7")).toEqual({ color: "#c7c7c7", outlined: true });
  });

  it("first tone at or above the 1.5 contrast has no outline", () => {
    expect(meterFillFor("#c6c6c6")).toEqual({ color: "#c6c6c6", outlined: false });
  });

  it("vivid yellow gets outline", () => {
    expect(meterFillFor("#ffd400")).toEqual({ color: "#ffd400", outlined: true });
  });

  it("malformed tone returns null", () => {
    expect(meterFillFor("#fff")).toBeNull();
  });
});
