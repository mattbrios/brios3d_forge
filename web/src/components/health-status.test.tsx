import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HealthStatus } from "./health-status";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("HealthStatus", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.test:3001");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows loading", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));
    render(<HealthStatus />);
    expect(screen.getByText("Verificando a API…")).toBeTruthy();
  });

  it("shows API ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { status: "ok" })));
    render(<HealthStatus />);
    expect(await screen.findByText("API ok")).toBeTruthy();
    expect(screen.queryByText("Verificando a API…")).toBeNull();
  });

  it("shows the api error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(503, { error: "Database unavailable" })),
    );
    render(<HealthStatus />);
    expect(await screen.findByText("API indisponível")).toBeTruthy();
    expect(screen.getByText("Database unavailable")).toBeTruthy();
  });

  it("shows the network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<HealthStatus />);
    expect(await screen.findByText("API indisponível")).toBeTruthy();
    expect(screen.getByText("Não foi possível conectar à API")).toBeTruthy();
  });
});
