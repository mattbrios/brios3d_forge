import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppShell } from "./app-shell";

describe("AppShell", () => {
  afterEach(cleanup);

  it("renders header, empty nav and content", () => {
    render(
      <AppShell>
        <p>conteúdo da página</p>
      </AppShell>,
    );

    const header = screen.getByRole("banner");
    expect(within(header).getByText("Brios3D Forge")).toBeTruthy();

    const nav = screen.getByRole("navigation");
    expect(within(nav).queryAllByRole("link")).toHaveLength(0);

    const main = screen.getByRole("main");
    expect(within(main).getByText("conteúdo da página")).toBeTruthy();
  });
});
