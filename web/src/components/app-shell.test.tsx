import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";

const navigation = vi.hoisted(() => ({ pathname: null as string | null }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

describe("AppShell", () => {
  afterEach(() => {
    cleanup();
    navigation.pathname = null;
  });

  it("renders header, nav and content", () => {
    render(
      <AppShell>
        <p>conteúdo da página</p>
      </AppShell>,
    );

    const header = screen.getByRole("banner");
    expect(within(header).getByText("Brios3D Forge")).toBeTruthy();

    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeTruthy();

    const main = screen.getByRole("main");
    expect(within(main).getByText("conteúdo da página")).toBeTruthy();
  });

  it("hides the header and the nav when printing", () => {
    // Fase 11 (AC 34): a etiqueta do rolo é impressa de dentro desta árvore, então o chrome do
    // app não pode sair no papel - e o conteúdo tem de sair.
    render(
      <AppShell role="admin">
        <p>conteúdo da página</p>
      </AppShell>,
    );

    expect(screen.getByRole("banner").className).toContain("print:hidden");
    expect(screen.getByRole("navigation", { name: "Navegação principal" }).className).toContain("print:hidden");
    expect(screen.getByRole("main").className).not.toContain("print:hidden");
  });

  it("links to print profiles", () => {
    render(
      <AppShell>
        <p>conteúdo</p>
      </AppShell>,
    );
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    const link = within(nav).getByRole("link", { name: "Importar do MakerWorld" });
    expect(link.getAttribute("href")).toBe("/print-profiles");
  });

  it("admin sees every menu item in order", () => {
    render(
      <AppShell role="admin">
        <p>conteúdo</p>
      </AppShell>,
    );
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Início",
      "Importar do MakerWorld",
      "Calculadora",
      "Materiais",
      "Impressoras",
      "Clientes",
      "Fornecedores",
      "Filamento",
      "Insumos e peças",
      "Movimentações",
      "Usuários",
      "Configurações",
      "Canais de venda",
      "Minha conta",
    ]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/print-profiles",
      "/pricing",
      "/materials",
      "/printers",
      "/customers",
      "/suppliers",
      "/inventory",
      "/inventory/items",
      "/inventory/movements",
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
      const nav = screen.getByRole("navigation", { name: "Navegação principal" });
      expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual([
        "Início",
        "Importar do MakerWorld",
        "Calculadora",
        "Materiais",
        "Impressoras",
        "Clientes",
        "Fornecedores",
        "Filamento",
        "Insumos e peças",
        "Movimentações",
        "Minha conta",
      ]);
      expect(within(nav).queryByRole("link", { name: "Usuários" })).toBeNull();
      expect(within(nav).queryByRole("link", { name: "Configurações" })).toBeNull();
      expect(within(nav).queryByRole("link", { name: "Canais de venda" })).toBeNull();
      cleanup();
    }
  });

  it("calculator appears for every role", () => {
    for (const role of ["admin", "production", "sales"] as const) {
      render(
        <AppShell role={role}>
          <p>conteúdo</p>
        </AppShell>,
      );
      const nav = screen.getByRole("navigation", { name: "Navegação principal" });
      const link = within(nav).getByRole("link", { name: "Calculadora" });
      expect(link.getAttribute("href")).toBe("/pricing");
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
      const nav = screen.getByRole("navigation", { name: "Navegação principal" });
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
      const nav = screen.getByRole("navigation", { name: "Navegação principal" });
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
      const nav = screen.getByRole("navigation", { name: "Navegação principal" });
      const customersLink = within(nav).getByRole("link", { name: "Clientes" });
      expect(customersLink.getAttribute("href")).toBe("/customers");
      const suppliersLink = within(nav).getByRole("link", { name: "Fornecedores" });
      expect(suppliersLink.getAttribute("href")).toBe("/suppliers");
      cleanup();
    }
  });

  it("the three inventory entries appear for every role", () => {
    for (const role of ["admin", "production", "sales"] as const) {
      render(
        <AppShell role={role}>
          <p>conteúdo</p>
        </AppShell>,
      );
      const nav = screen.getByRole("navigation", { name: "Navegação principal" });
      // Fase 10: "Estoque" virou "Filamento", e entraram os itens e o ledger unificado.
      expect(within(nav).getByRole("link", { name: "Filamento" }).getAttribute("href")).toBe("/inventory");
      expect(within(nav).getByRole("link", { name: "Insumos e peças" }).getAttribute("href")).toBe(
        "/inventory/items",
      );
      expect(within(nav).getByRole("link", { name: "Movimentações" }).getAttribute("href")).toBe(
        "/inventory/movements",
      );
      expect(within(nav).queryByRole("link", { name: "Estoque" })).toBeNull();
      cleanup();
    }
  });

  it("titles the top bar after the route, the most specific first", () => {
    const cases: [string, string][] = [
      ["/", "Início"],
      ["/materials", "Materiais"],
      ["/inventory", "Estoque de filamento"],
      ["/inventory/r1", "Rolo"],
      ["/inventory/r1/label", "Rolo"],
      ["/inventory/items", "Insumos e peças"],
      ["/inventory/items/i1", "Insumo"],
      ["/inventory/movements", "Movimentações"],
      ["/inventory/alerts", "Abaixo do mínimo"],
      ["/rota-desconhecida", "Brios3D Forge"],
    ];
    for (const [pathname, title] of cases) {
      navigation.pathname = pathname;
      render(
        <AppShell role="admin">
          <p>conteúdo</p>
        </AppShell>,
      );
      expect(within(screen.getByRole("banner")).getByRole("heading", { level: 1 }).textContent).toBe(title);
      cleanup();
    }
  });

  it("marks the longest matching menu item as the current page", () => {
    navigation.pathname = "/inventory/items/i1";
    render(
      <AppShell role="admin">
        <p>conteúdo</p>
      </AppShell>,
    );
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    const current = within(nav)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["Insumos e peças"]);
  });

  it("marks Início only on the root route", () => {
    navigation.pathname = "/materials";
    render(
      <AppShell role="admin">
        <p>conteúdo</p>
      </AppShell>,
    );
    const nav = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(within(nav).getByRole("link", { name: "Início" }).getAttribute("aria-current")).toBeNull();
    expect(within(nav).getByRole("link", { name: "Materiais" }).getAttribute("aria-current")).toBe("page");
  });

  it("offers the mobile quick links the role can open, plus the full menu", () => {
    render(
      <AppShell role="sales">
        <p>conteúdo</p>
      </AppShell>,
    );
    const quick = screen.getByRole("navigation", { name: "Navegação rápida" });
    expect(within(quick).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/pricing",
      "/inventory",
    ]);
    expect(within(quick).getByRole("button", { name: "Mais" })).toBeTruthy();
    cleanup();

    // Sem papel, só o que todo papel vê.
    render(
      <AppShell>
        <p>conteúdo</p>
      </AppShell>,
    );
    const quickNoRole = screen.getByRole("navigation", { name: "Navegação rápida" });
    expect(within(quickNoRole).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/"]);
  });
});
