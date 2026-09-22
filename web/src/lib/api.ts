// Único ponto de acesso do web à API: lê NEXT_PUBLIC_API_URL e converte
// o formato de erro { error } em ApiError.

// Disparado a cada 401; o shell protegido escuta e manda para o login.
export const UNAUTHORIZED_EVENT = "forge:unauthorized";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isErrorBody(body: unknown): body is { error: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { error?: unknown }).error === "string"
  );
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new ApiError(0, "NEXT_PUBLIC_API_URL não configurada");
  }

  let response: Response;
  try {
    // O cookie de sessão mora no host da API (AD-016).
    response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar à API");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(
      response.status,
      isErrorBody(body) ? body.error : `Erro ${response.status} da API`,
    );
  }
  return body as T;
}
