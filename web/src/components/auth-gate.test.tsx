import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { AuthGate } from "./auth-gate";

const navigation = vi.hoisted(() => {
  const replace = vi.fn();
  return { replace, router: { replace } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => navigation.router,
  usePathname: () => "/print-profiles",
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ANA = { id: "u1", name: "Ana Souza", email: "ana@brios3d.com", role: "admin" };
const NO_SESSION = { error: "Sessão expirada ou inexistente. Entre novamente" };

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

function Page() {
  return <p>conteúdo da página</p>;
}

// Filho que chama a API por conta própria, como a importação do MakerWorld.
function CallingChild() {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        apiFetch("/print-profiles/import", { method: "POST" }).catch(() => setDone(true));
      }}
    >
      {done ? "falhou" : "chamar"}
    </button>
  );
}

const callsTo = (fetchMock: ReturnType<typeof stubApi>, path: string) =>
  fetchMock.mock.calls.filter(([url]) => url.endsWith(path));

describe("AuthGate", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
    navigation.replace.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("redirects without a session", async () => {
    stubApi({ "/auth/me": () => Promise.resolve(jsonResponse(401, NO_SESSION)) });
    render(
      <AuthGate>
        <Page />
      </AuthGate>,
    );
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/login?next=%2Fprint-profiles"),
    );
    expect(screen.queryByText("conteúdo da página")).toBeNull();
  });

  it("shows loading while checking", () => {
    stubApi({ "/auth/me": () => new Promise(() => undefined) });
    render(
      <AuthGate>
        <Page />
      </AuthGate>,
    );
    expect(screen.getByText("Carregando…")).toBeTruthy();
    expect(screen.queryByText("conteúdo da página")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("shows the error and retries", async () => {
    let me: Route = () => Promise.reject(new TypeError("Failed to fetch"));
    const fetchMock = stubApi({ "/auth/me": () => me() });
    render(
      <AuthGate>
        <Page />
      </AuthGate>,
    );
    expect(await screen.findByText("Não foi possível conectar à API")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
    cleanup();
    fetchMock.mockClear();

    me = () => Promise.resolve(jsonResponse(500, { error: "Internal server error" }));
    render(
      <AuthGate>
        <Page />
      </AuthGate>,
    );
    expect(await screen.findByText("Internal server error")).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();

    me = () => Promise.resolve(jsonResponse(200, ANA));
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("conteúdo da página")).toBeTruthy();
    expect(callsTo(fetchMock, "/auth/me")).toHaveLength(2);
  });

  it("shows the page with the user", async () => {
    stubApi({ "/auth/me": () => Promise.resolve(jsonResponse(200, ANA)) });
    render(
      <AuthGate>
        <Page />
      </AuthGate>,
    );
    expect(await screen.findByText("conteúdo da página")).toBeTruthy();
    const nav = screen.getByRole("navigation");
    const link = within(nav).getByRole("link", { name: "Importar do MakerWorld" });
    expect(link.getAttribute("href")).toBe("/print-profiles");
    const header = screen.getByRole("banner");
    expect(within(header).getByText("Ana Souza")).toBeTruthy();
    expect(within(header).getByRole("button", { name: "Sair" })).toBeTruthy();
  });

  it("signs out", async () => {
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ANA)),
      "/auth/logout": () => Promise.resolve(new Response(null, { status: 204 })),
    });
    render(
      <AuthGate>
        <Page />
      </AuthGate>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Sair" }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/login"));
    const [logout] = callsTo(fetchMock, "/auth/logout");
    expect(logout[0]).toBe("http://api.test:3001/auth/logout");
    expect((logout[1] as RequestInit).method).toBe("POST");
  });

  it("sign out failure keeps the page", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ANA)),
      "/auth/logout": () => Promise.reject(new TypeError("Failed to fetch")),
    });
    render(
      <AuthGate>
        <Page />
      </AuthGate>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Sair" }));
    expect(await screen.findByText("Não foi possível sair. Tente novamente")).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.getByText("conteúdo da página")).toBeTruthy();
    expect(within(screen.getByRole("banner")).getByText("Ana Souza")).toBeTruthy();
  });

  it("a 401 inside the page redirects to login", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ANA)),
      "/print-profiles/import": () => Promise.resolve(jsonResponse(401, NO_SESSION)),
    });
    render(
      <AuthGate>
        <CallingChild />
      </AuthGate>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "chamar" }));
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/login?next=%2Fprint-profiles"),
    );
  });
});
