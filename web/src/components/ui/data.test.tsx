import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StockMeter } from "./data";

const BLUE = { color: "#1e88e5", outlined: false };
const BLUE_OUTLINED = { color: "#1e88e5", outlined: true };

function renderMeter(props: Parameters<typeof StockMeter>[0]) {
  const { container } = render(<StockMeter {...props} />);
  const meter = container.querySelector(".bf-meter") as HTMLElement;
  const fill = container.querySelector(".bf-meter__fill") as HTMLElement;
  return { meter, fill };
}

describe("StockMeter", () => {
  afterEach(cleanup);

  it("ok tone paints the fill with the tone", () => {
    const { fill } = renderMeter({ value: 500, max: 1000, minimum: null, fill: BLUE });
    expect(fill.style.background).toBe("rgb(30, 136, 229)");
    expect(fill.classList.contains("bf-meter__fill--outlined")).toBe(false);
  });

  it("outlined fill gets the outline class", () => {
    const { fill } = renderMeter({ value: 500, max: 1000, minimum: null, fill: { color: "#ffffff", outlined: true } });
    expect(fill.style.background).toBe("rgb(255, 255, 255)");
    expect(fill.classList.contains("bf-meter__fill--outlined")).toBe(true);
  });

  it("warning ignores the fill", () => {
    const { meter, fill } = renderMeter({ value: 60, max: 200, minimum: 100, fill: BLUE_OUTLINED });
    expect(meter.classList.contains("bf-meter--warning")).toBe(true);
    expect(fill.style.background).toBe("");
    expect(fill.classList.contains("bf-meter__fill--outlined")).toBe(false);
  });

  it("danger ignores the fill", () => {
    const { meter, fill } = renderMeter({ value: 40, max: 200, minimum: 100, fill: BLUE_OUTLINED });
    expect(meter.classList.contains("bf-meter--danger")).toBe(true);
    expect(fill.style.background).toBe("");
    expect(fill.classList.contains("bf-meter__fill--outlined")).toBe(false);
  });

  it("without fill keeps the default fill", () => {
    const { fill } = renderMeter({ value: 500, max: 1000, minimum: null });
    expect(fill.style.background).toBe("");
    expect(fill.classList.contains("bf-meter__fill--outlined")).toBe(false);
  });

  it("balance equal to the minimum keeps the tone", () => {
    const { meter, fill } = renderMeter({ value: 100, max: 200, minimum: 100, fill: BLUE });
    expect(meter.classList.contains("bf-meter--ok")).toBe(true);
    expect(fill.style.background).toBe("rgb(30, 136, 229)");
  });

  it("balance at half the minimum is warning, not danger", () => {
    const { meter } = renderMeter({ value: 50, max: 200, minimum: 100, fill: BLUE });
    expect(meter.classList.contains("bf-meter--warning")).toBe(true);
    expect(meter.classList.contains("bf-meter--danger")).toBe(false);
  });
});
