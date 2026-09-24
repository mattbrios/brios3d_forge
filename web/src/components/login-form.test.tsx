import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/login/page";

const navigation = vi.hoisted(() => {
  const replace = vi.fn();
  return { replace, router: { replace }, search: "" };
});

vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ANA = { id: "u1", name: "Ana", email: "ana@brios3d.com", role: "admin" };
const NO_SESSION = { error: "Sessão expirada ou inexistente. Entre novamente" };

// GET /auth/me responde 401; o login responde o que o teste mandar.
function stubApi(login: () => Promise<Response>) {
  const fetchMock = vi.fn((url: string) =>
    url.endsWith("/auth/me") ? Promise.resolve(jsonResponse(401, NO_SESSION)) : login(),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fillAndSubmit() {
  fireEvent.change(await screen.findByLabelText("E-mail"), {
    target: { value: "ana@brios3d.com" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-correta-12" } });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}

describe("Login page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
    navigation.replace.mockReset();
    navigation.search = "";
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows the login form without navigation", async () => {
    stubApi(() => new Promise(() => undefined));
    render(<LoginPage />);
    const email = await screen.findByLabelText("E-mail");
    expect(email.tagName).toBe("INPUT");
    expect(screen.getByLabelText("Senha").getAttribute("type")).toBe("password");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("shows signing in", async () => {
    stubApi(() => new Promise(() => undefined));
    render(<LoginPage />);
    await fillAndSubmit();
    const button = await screen.findByRole("button", { name: "Entrando…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the api error and keeps the email", async () => {
    const errors: Array<[number, string]> = [
      [401, "E-mail ou senha inválidos"],
      [429, "Muitas tentativas de login. Tente novamente em 15 minutos"],
      [400, "email must be an email"],
    ];
    for (const [status, message] of errors) {
      stubApi(() => Promise.resolve(jsonResponse(status, { error: message })));
      render(<LoginPage />);
      await fillAndSubmit();
      expect((await screen.findByRole("alert")).textContent).toBe(message);
      expect((screen.getByLabelText("E-mail") as HTMLInputElement).value).toBe("ana@brios3d.com");
      expect(navigation.replace).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it("shows the network error", async () => {
    stubApi(() => Promise.reject(new TypeError("Failed to fetch")));
    render(<LoginPage />);
    await fillAndSubmit();
    expect((await screen.findByRole("alert")).textContent).toBe("Não foi possível conectar à API");
  });

  it("goes to next after login", async () => {
    const cases: Array<[string, string]> = [
      ["?next=%2Fprint-profiles", "/print-profiles"],
      ["?next=%2Fprint-profiles%3Fx%3D1", "/print-profiles?x=1"],
      ["", "/"],
      ["?next=https%3A%2F%2Fevil.test", "/"],
      ["?next=%2F%2Fevil.test", "/"],
      ["?next=%2F%5Cevil.test", "/"],
    ];
    for (const [search, destination] of cases) {
      navigation.search = search;
      navigation.replace.mockReset();
      const fetchMock = stubApi(() => Promise.resolve(jsonResponse(200, ANA)));
      render(<LoginPage />);
      await fillAndSubmit();
      await waitFor(() => expect(navigation.replace).toHaveBeenCalledTimes(1));
      expect(navigation.replace).toHaveBeenCalledWith(destination);
      const loginCall = fetchMock.mock.calls.find(([url]) => url.endsWith("/auth/login"));
      expect(loginCall?.[0]).toBe("http://api.test:3001/auth/login");
      cleanup();
    }
  });

  it("returns to the roll page given in next", async () => {
    // Fase 11 (AC 37): fecha o caminho do QR - ler no celular, cair no login, e aterrizar no rolo.
    navigation.search = "?next=%2Finventory%2F8f3c1e2a-0000-4000-8000-000000000001";
    stubApi(() => Promise.resolve(jsonResponse(200, ANA)));
    render(<LoginPage />);
    await fillAndSubmit();
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith(
        "/inventory/8f3c1e2a-0000-4000-8000-000000000001",
      ),
    );
  });

  it("redirects a signed in user", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, ANA)));
    render(<LoginPage />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByLabelText("E-mail")).toBeNull();
    expect(screen.queryByRole("button", { name: "Entrar" })).toBeNull();
  });
});
