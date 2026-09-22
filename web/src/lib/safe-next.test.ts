import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("only same-site paths", () => {
    expect(safeNext("/print-profiles")).toBe("/print-profiles");
    expect(safeNext("/print-profiles?x=1")).toBe("/print-profiles?x=1");
    expect(safeNext(null)).toBe("/");
    expect(safeNext("https://evil.test")).toBe("/");
    expect(safeNext("//evil.test")).toBe("/");
    expect(safeNext("/\\evil.test")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
    expect(safeNext("/\t/evil.test")).toBe("/");
  });
});
