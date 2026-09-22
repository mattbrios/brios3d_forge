import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppShell } from "./app-shell";

describe("AppShell", () => {
  afterEach(cleanup);

  it("renders header, nav and content", () => {
    render(
      <AppShell>
        <p>conteúdo da página</p>
      </AppShell>,
    );

    const header = screen.getByRole("banner");
    expect(within(header).getByText("Brios3D Forge")).toBeTruthy();

    expect(screen.getByRole("navigation")).toBeTruthy();

    const main = screen.getByRole("main");
    expect(within(main).getByText("conteúdo da página")).toBeTruthy();
  });

  it("links to print profiles", () => {
    render(
      <AppShell>
        <p>conteúdo</p>
      </AppShell>,
    );
    const nav = screen.getByRole("navigation");
    const link = within(nav).getByRole("link", { name: "Importar do MakerWorld" });
    expect(link.getAttribute("href")).toBe("/print-profiles");
  });

  it("admin sees every menu item in order", () => {
    render(
      <AppShell role="admin">
        <p>conteúdo</p>
      </AppShell>,
    );
    const nav = screen.getByRole("navigation");
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Importar do MakerWorld",
      "Usuários",
      "Minha conta",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/print-profiles",
      "/users",
      "/account",
    ]);
  });

  it("production and sales do not see users", () => {
    for (const role of ["production", "sales"] as const) {
      render(
        <AppShell role={role}>
          <p>conteúdo</p>
        </AppShell>,
      );
      const nav = screen.getByRole("navigation");
      expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual([
        "Importar do MakerWorld",
        "Minha conta",
      ]);
      expect(within(nav).queryByRole("link", { name: "Usuários" })).toBeNull();
      cleanup();
    }
  });
});
