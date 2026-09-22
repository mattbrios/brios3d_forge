import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "./api";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  const error: unknown = await promise.catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("prefixes the base url", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { status: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/health")).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test:3001/health");
  });

  it("decodes the error body", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(503, { error: "Database unavailable" })),
    );

    const error = await caught(apiFetch("/health"));
    expect(error.status).toBe(503);
    expect(error.message).toBe("Database unavailable");
  });

  it("network failure", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await caught(apiFetch("/health"));
    expect(error.status).toBe(0);
    expect(error.message).toBe("Não foi possível conectar à API");
  });

  it("missing base url", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const error = await caught(apiFetch("/health"));
    expect(error.message).toBe("NEXT_PUBLIC_API_URL não configurada");
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("non error body", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html>Bad Gateway</html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    const error = await caught(apiFetch("/health"));
    expect(error.status).toBe(502);
    expect(error.message).toBe("Erro 502 da API");
  });
  it("sends credentials", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/health");
    await apiFetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    await apiFetch("/health", { credentials: "omit" });

    const inits = fetchMock.mock.calls.map((call) => call[1] as RequestInit);
    expect(inits.map((init) => init.credentials)).toEqual(["include", "include", "include"]);
    expect(inits[1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  });
});
