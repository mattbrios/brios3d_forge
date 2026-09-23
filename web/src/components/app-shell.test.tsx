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
      "Materiais",
      "Impressoras",
      "Clientes",
      "Fornecedores",
      "Usuários",
      "Configurações",
      "Canais de venda",
      "Minha conta",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/print-profiles",
      "/materials",
      "/printers",
      "/customers",
      "/suppliers",
      "/users",
      "/settings",
      "/sales-channels",
      "/account",
    ]);
  });

  it("production and sales do not see settings or sales channels", () => {
    for (const role of ["production", "sales"] as const) {
      render(
        <AppShell role={role}>
          <p>conteúdo</p>
        </AppShell>,
      );
      const nav = screen.getByRole("navigation");
      expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual([
        "Importar do MakerWorld",
        "Materiais",
        "Impressoras",
        "Clientes",
        "Fornecedores",
        "Minha conta",
      ]);
      expect(within(nav).queryByRole("link", { name: "Usuários" })).toBeNull();
      expect(within(nav).queryByRole("link", { name: "Configurações" })).toBeNull();
      expect(within(nav).queryByRole("link", { name: "Canais de venda" })).toBeNull();
      cleanup();
    }
  });

  it("materials appears for every role", () => {
    for (const role of ["admin", "production", "sales"] as const) {
      render(
        <AppShell role={role}>
          <p>conteúdo</p>
        </AppShell>,
      );
      const nav = screen.getByRole("navigation");
      const link = within(nav).getByRole("link", { name: "Materiais" });
      expect(link.getAttribute("href")).toBe("/materials");
      cleanup();
    }
  });

  it("printers appears for every role", () => {
    for (const role of ["admin", "production", "sales"] as const) {
      render(
        <AppShell role={role}>
          <p>conteúdo</p>
        </AppShell>,
      );
      const nav = screen.getByRole("navigation");
      const link = within(nav).getByRole("link", { name: "Impressoras" });
      expect(link.getAttribute("href")).toBe("/printers");
      cleanup();
    }
  });

  it("customers and suppliers appear for every role", () => {
    for (const role of ["admin", "production", "sales"] as const) {
      render(
        <AppShell role={role}>
          <p>conteúdo</p>
        </AppShell>,
      );
      const nav = screen.getByRole("navigation");
      const customersLink = within(nav).getByRole("link", { name: "Clientes" });
      expect(customersLink.getAttribute("href")).toBe("/customers");
      const suppliersLink = within(nav).getByRole("link", { name: "Fornecedores" });
      expect(suppliersLink.getAttribute("href")).toBe("/suppliers");
      cleanup();
    }
  });
});
