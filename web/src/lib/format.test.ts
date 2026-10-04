import { describe, expect, it } from "vitest";
import { formatCents, formatCentsPerUnit, formatQuantity } from "./format";

describe("formatCents", () => {
  it("formatCents groups thousands", () => {
    expect(formatCents(180050)).toBe("R$ 1.800,50");
  });

  it("formatCents uses comma decimals", () => {
    expect(formatCents(1050)).toBe("R$ 10,50");
  });
});

describe("formatCentsPerUnit", () => {
  it("formatCentsPerUnit keeps 4 decimals", () => {
    expect(formatCentsPerUnit(12.34, "g")).toBe("R$ 0,1234/g");
  });

  it("formatCentsPerUnit keeps at least 2 decimals", () => {
    expect(formatCentsPerUnit(50, "un")).toBe("R$ 0,50/un");
  });

  it("formatCentsPerUnit rounds at the 4th decimal", () => {
    expect(formatCentsPerUnit(12.345, "g")).toBe("R$ 0,1235/g");
  });
});

describe("formatQuantity", () => {
  it("formatQuantity groups thousands", () => {
    expect(formatQuantity(1800)).toBe("1.800");
  });

  it("formatQuantity uses comma decimals", () => {
    expect(formatQuantity(1234.5)).toBe("1.234,5");
  });

  it("formatQuantity keeps up to 2 decimals without trailing zeros", () => {
    expect(formatQuantity(1.256)).toBe("1,26");
    expect(formatQuantity(2)).toBe("2");
  });
});
