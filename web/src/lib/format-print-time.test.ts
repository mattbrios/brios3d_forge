import { describe, expect, it } from "vitest";
import { formatPrintTime } from "./format-print-time";

describe("formatPrintTime", () => {
  it("rounds to the nearest minute", () => {
    expect(formatPrintTime(1707)).toBe("0 h 28 min");
    expect(formatPrintTime(77054)).toBe("21 h 24 min");
    expect(formatPrintTime(89)).toBe("0 h 1 min");
    expect(formatPrintTime(29)).toBe("0 h 0 min");
  });
});
