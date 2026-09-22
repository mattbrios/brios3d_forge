import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UsersPage from "./page";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ADMIN_ME = { id: "u1", name: "Admin Um", email: "admin@test.local", role: "admin" };
const USERS = [
  { id: "u1", name: "Admin Um", email: "admin@test.local", role: "admin", active: true },
  { id: "u2", name: "Bia", email: "bia@test.local", role: "sales", active: true },
  { id: "u3", name: "Zeca", email: "zeca@test.local", role: "production", active: false },
];

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

const bodyOf = (init?: RequestInit) => JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
const callsTo = (fetchMock: ReturnType<typeof stubApi>, path: string) =>
  fetchMock.mock.calls.filter(([url]) => (url as string).endsWith(path));

describe("Users page", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("renders the user table in order", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/users": () => Promise.resolve(jsonResponse(200, USERS)),
    });
    render(<UsersPage />);
    const rows = await screen.findAllByRole("row");
    expect(rows).toHaveLength(4);
    const headers = within(rows[0])
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent);
    expect(headers.slice(0, 4)).toEqual(["Nome", "E-mail", "Papel", "Situação"]);
    expect(within(rows[1]).getByText("Admin Um")).toBeTruthy();
    expect(within(rows[2]).getByText("Bia")).toBeTruthy();
    expect(within(rows[3]).getByText("Zeca")).toBeTruthy();
    expect(within(rows[2]).getByText("Vendas")).toBeTruthy();
    expect(within(rows[3]).getByText("Produção")).toBeTruthy();
    expect(within(rows[3]).getByText("Inativo")).toBeTruthy();
    expect(within(rows[1]).getByText("Ativo")).toBeTruthy();
  });

  it("shows loading", () => {
    stubApi({
      "/auth/me": () => new Promise(() => undefined),
    });
    render(<UsersPage />);
    expect(screen.getByText("Carregando usuários…")).toBeTruthy();
  });

  it("shows the error and retries", async () => {
    let users: Route = () => Promise.reject(new TypeError("Failed to fetch"));
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/users": () => users(),
    });
    render(<UsersPage />);
    expect(await screen.findByText("Não foi possível conectar à API")).toBeTruthy();
    const retry = screen.getByRole("button", { name: "Tentar novamente" });

    users = () => Promise.resolve(jsonResponse(200, USERS));
    fireEvent.click(retry);
    await screen.findByText("Bia");
    expect(callsTo(fetchMock, "/users")).toHaveLength(2);
  });

  it("shows the empty state", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/users": () => Promise.resolve(jsonResponse(200, [])),
    });
    render(<UsersPage />);
    expect(await screen.findByText("Nenhum usuário cadastrado")).toBeTruthy();
  });

  it("creates a user and clears the form", async () => {
    let resolveCreate: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveCreate = resolve;
    });
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/users": (init) => (init?.method === "POST" ? pending : Promise.resolve(jsonResponse(200, USERS))),
    });
    render(<UsersPage />);
    await screen.findByText("Bia");

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Carla" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "carla@test.local" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-da-carla-1" } });
    fireEvent.change(screen.getByLabelText("Papel"), { target: { value: "production" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));
    expect(await screen.findByRole("button", { name: "Criando…" })).toHaveProperty("disabled", true);

    resolveCreate!(
      jsonResponse(201, {
        id: "u4",
        name: "Carla",
        email: "carla@test.local",
        role: "production",
        active: true,
      }),
    );
    await screen.findAllByText("Carla");
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("E-mail") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Senha") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Papel") as HTMLSelectElement).value).toBe("sales");
  });

  it("shows the create error and keeps the form", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/users": (init) =>
        init?.method === "POST"
          ? Promise.resolve(jsonResponse(409, { error: "Já existe um usuário com este e-mail" }))
          : Promise.resolve(jsonResponse(200, USERS)),
    });
    render(<UsersPage />);
    await screen.findByText("Bia");

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Carla" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "bia@test.local" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "senha-qualquer-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar usuário" }));

    expect(await screen.findByText("Já existe um usuário com este e-mail")).toBeTruthy();
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Carla");
    expect((screen.getByLabelText("E-mail") as HTMLInputElement).value).toBe("bia@test.local");
  });

  it("edit form sends only changed fields", async () => {
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/users": () => Promise.resolve(jsonResponse(200, USERS)),
      "/users/u2": () =>
        Promise.resolve(jsonResponse(200, { id: "u2", name: "Bia Nova", email: "bia@test.local", role: "sales", active: true })),
    });
    render(<UsersPage />);
    const row = (await screen.findByText("Bia")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Editar" }));
    fireEvent.change(within(row).getByLabelText("Nome"), { target: { value: "Bia Nova" } });
    fireEvent.click(within(row).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(callsTo(fetchMock, "/users/u2")).toHaveLength(1));
    const [, init] = callsTo(fetchMock, "/users/u2")[0];
    expect(bodyOf(init as RequestInit)).toEqual({ name: "Bia Nova" });
  });

  it("saving closes the edit, cancel discards it", async () => {
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/users": () => Promise.resolve(jsonResponse(200, USERS)),
      "/users/u2": () =>
        Promise.resolve(jsonResponse(200, { id: "u2", name: "Bia Nova", email: "bia@test.local", role: "sales", active: true })),
    });
    render(<UsersPage />);
    const row = (await screen.findByText("Bia")).closest("tr")!;

    fireEvent.click(within(row).getByRole("button", { name: "Editar" }));
    fireEvent.change(within(row).getByLabelText("Nome"), { target: { value: "Descartado" } });
    fireEvent.click(within(row).getByRole("button", { name: "Cancelar" }));
    expect(within(row).queryByRole("button", { name: "Salvar" })).toBeNull();
    expect(within(row).getByText("Bia")).toBeTruthy();
    expect(callsTo(fetchMock, "/users/u2")).toHaveLength(0);

    fireEvent.click(within(row).getByRole("button", { name: "Editar" }));
    fireEvent.change(within(row).getByLabelText("Nome"), { target: { value: "Bia Nova" } });
    fireEvent.click(within(row).getByRole("button", { name: "Salvar" }));
    await within(row).findByText("Bia Nova");
    expect(within(row).queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("edit error keeps the row open with typed values", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/users": () => Promise.resolve(jsonResponse(200, USERS)),
      "/users/u2": () =>
        Promise.resolve(jsonResponse(409, { error: "Já existe um usuário com este e-mail" })),
    });
    render(<UsersPage />);
    const row = (await screen.findByText("Bia")).closest("tr")!;

    fireEvent.click(within(row).getByRole("button", { name: "Editar" }));
    fireEvent.change(within(row).getByLabelText("E-mail"), { target: { value: "conflito@test.local" } });
    fireEvent.click(within(row).getByRole("button", { name: "Salvar" }));

    expect(await within(row).findByText("Já existe um usuário com este e-mail")).toBeTruthy();
    expect((within(row).getByLabelText("E-mail") as HTMLInputElement).value).toBe("conflito@test.local");
  });

  it("toggling active sends the patch and reflects errors", async () => {
    let patch: Route = () =>
      Promise.resolve(
        jsonResponse(200, { id: "u2", name: "Bia", email: "bia@test.local", role: "sales", active: false }),
      );
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/users": () => Promise.resolve(jsonResponse(200, USERS)),
      "/users/u2": () => patch(),
    });
    render(<UsersPage />);
    const row = (await screen.findByText("Bia")).closest("tr")!;

    fireEvent.click(within(row).getByRole("button", { name: "Desativar" }));
    await within(row).findByText("Inativo");
    expect(within(row).getByRole("button", { name: "Ativar" })).toBeTruthy();
    const [, init] = callsTo(fetchMock, "/users/u2")[0];
    expect(bodyOf(init as RequestInit)).toEqual({ active: false });

    patch = () => Promise.resolve(jsonResponse(500, { error: "Internal server error" }));
    fireEvent.click(within(row).getByRole("button", { name: "Ativar" }));
    expect(await within(row).findByText("Internal server error")).toBeTruthy();
    expect(within(row).getByText("Inativo")).toBeTruthy();
  });

  it("the logged-in admin's own row hides deactivate and role", async () => {
    stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, ADMIN_ME)),
      "/users": () => Promise.resolve(jsonResponse(200, USERS)),
    });
    render(<UsersPage />);
    const row = (await screen.findByText("Admin Um")).closest("tr")!;
    expect(within(row).queryByRole("button", { name: "Desativar" })).toBeNull();

    fireEvent.click(within(row).getByRole("button", { name: "Editar" }));
    expect(within(row).queryByLabelText("Papel")).toBeNull();
  });

  it("non-admin sees the permission message without calling the api", async () => {
    const fetchMock = stubApi({
      "/auth/me": () => Promise.resolve(jsonResponse(200, { ...ADMIN_ME, role: "sales" })),
    });
    render(<UsersPage />);
    expect(await screen.findByText("Você não tem permissão para acessar esta página")).toBeTruthy();
    expect(callsTo(fetchMock, "/users")).toHaveLength(0);
  });
});
