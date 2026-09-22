// Limite de tentativas de login por e-mail normalizado, em memória (uma instância só).
// 5 falhas dentro de 15 min bloqueiam o e-mail até 15 min depois da 5ª falha.
export const MAX_FAILURES = 5;
export const WINDOW_MS = 15 * 60 * 1000;
// Acima disso, entradas que já não bloqueiam nem contam são descartadas.
const PRUNE_ABOVE = 10_000;

interface Attempts {
  failures: number[];
  blockedUntil: number | null;
}

export class LoginAttempts {
  private readonly byEmail = new Map<string, Attempts>();

  constructor(private readonly now: () => number = Date.now) {}

  isBlocked(email: string): boolean {
    const attempts = this.byEmail.get(email);
    if (!attempts?.blockedUntil) {
      return false;
    }
    if (this.now() < attempts.blockedUntil) {
      return true;
    }
    this.byEmail.delete(email);
    return false;
  }

  recordFailure(email: string): void {
    const now = this.now();
    const attempts = this.byEmail.get(email) ?? { failures: [], blockedUntil: null };
    attempts.failures = attempts.failures.filter((at) => now - at < WINDOW_MS);
    attempts.failures.push(now);
    if (attempts.failures.length >= MAX_FAILURES) {
      attempts.blockedUntil = now + WINDOW_MS;
    }
    this.byEmail.set(email, attempts);
    if (this.byEmail.size > PRUNE_ABOVE) {
      this.prune(now);
    }
  }

  recordSuccess(email: string): void {
    this.byEmail.delete(email);
  }

  tracked(): string[] {
    return [...this.byEmail.keys()];
  }

  private prune(now: number): void {
    for (const [email, attempts] of this.byEmail) {
      const blocked = attempts.blockedUntil !== null && now < attempts.blockedUntil;
      const recent = attempts.failures.some((at) => now - at < WINDOW_MS);
      if (!blocked && !recent) {
        this.byEmail.delete(email);
      }
    }
  }
}
