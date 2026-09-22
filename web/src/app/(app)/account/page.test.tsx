import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/components/auth-gate";
import AccountPage from "./page";

const navigation = vi.hoisted(() => {
  const replace = vi.fn();
  return { replace, router: { replace } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  usePathname: () => "/account",
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ANA = { id: "u1", name: "Ana Souza", email: "ana@brios3d.com", role: "sales" };

type Route = (init?: RequestInit) => Promise<Response>;

function stubApi(routes: Record<string, Route>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const path = url.replace("http://api.test:3001", "");
    const route = routes[path];
    if (!route) throw new Error(`rota inesperada: ${path}`);
    return route(init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fill(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText("Senha atual"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("Nova senha"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirmar nova senha"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Trocar senha" }));
}

describe("Account page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
    navigation.replace.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows the password change form", () => {
    render(<AccountPage />);
    expect(screen.getByLabelText("Senha atual").getAttribute("type")).toBe("password");
    expect(screen.getByLabelText("Nova senha").getAttribute("type")).toBe("password");
    expect(screen.getByLabelText("Confirmar nova senha").getAttribute("type")).toBe("password");
    expect(screen.getByRole("button", { name: "Trocar senha" })).toBeTruthy();
  });

  it("mismatched passwords are not sent", async () => {
    const fetchMock = stubApi({});
    render(<AccountPage />);
    await fill("senha-atual-123", "senha-nova-111", "senha-nova-222");
    expect(await screen.findByText("As senhas não conferem")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows saving", async () => {
    stubApi({ "/auth/password": () => new Promise(() => undefined) });
    render(<AccountPage />);
    await fill("senha-atual-123", "senha-nova-1234", "senha-nova-1234");
    const button = await screen.findByRole("button", { name: "Salvando…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows success and clears the form", async () => {
    stubApi({ "/auth/password": () => Promise.resolve(new Response(null, { status: 204 })) });
    render(<AccountPage />);
    await fill("senha-atual-123", "senha-nova-1234", "senha-nova-1234");
    expect(await screen.findByText("Senha alterada")).toBeTruthy();
    expect((screen.getByLabelText("Senha atual") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Nova senha") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Confirmar nova senha") as HTMLInputElement).value).toBe("");
  });

  it("shows api and network errors, stays on the page", async () => {
    stubApi({
      "/auth/password": () =>
        Promise.resolve(jsonResponse(400, { error: "Senha atual incorreta" })),
    });
    render(<AccountPage />);
    await fill("senha-errada-123", "senha-nova-1234", "senha-nova-1234");
    expect(await screen.findByText("Senha atual incorreta")).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();

    cleanup();
    stubApi({ "/auth/password": () => Promise.reject(new TypeError("Failed to fetch")) });
    render(<AccountPage />);
    await fill("senha-atual-123", "senha-nova-1234", "senha-nova-1234");
    expect(await screen.findByText("Não foi possível conectar à API")).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("a 401 redirects like any other protected page", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ANA)),
      "/auth/password": () =>
        Promise.resolve(
          jsonResponse(401, { error: "Sessão expirada ou inexistente. Entre novamente" }),
        ),
    });
    render(
      <AuthGate>
        <AccountPage />
      </AuthGate>,
    );
    await screen.findByLabelText("Senha atual");
    await fill("senha-atual-123", "senha-nova-1234", "senha-nova-1234");
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/login?next=%2Faccount"),
    );
    expect(screen.queryByText("Senha atual incorreta")).toBeNull();
  });
});
