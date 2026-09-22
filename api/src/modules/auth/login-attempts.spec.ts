import { LoginAttempts } from './login-attempts.js';

const MINUTE = 60 * 1000;

function limiter() {
  const clock = { now: 1_000_000 };
  return { clock, attempts: new LoginAttempts(() => clock.now) };
}

function fail(attempts: LoginAttempts, email: string, times: number) {
  for (let i = 0; i < times; i++) {
    attempts.recordFailure(email);
  }
}

describe('LoginAttempts', () => {
  it('blocks after five failures', () => {
    const { clock, attempts } = limiter();
    fail(attempts, 'a@test.local', 4);
    expect(attempts.isBlocked('a@test.local')).toBe(false);
    clock.now += 14 * MINUTE;
    fail(attempts, 'a@test.local', 1);
    expect(attempts.isBlocked('a@test.local')).toBe(true);
  });

  it('unblocks fifteen minutes after the fifth failure', () => {
    const { clock, attempts } = limiter();
    fail(attempts, 'a@test.local', 4);
    clock.now += 5 * MINUTE;
    fail(attempts, 'a@test.local', 1);
    const fifth = clock.now;
    clock.now = fifth + 14 * MINUTE + 59 * 1000;
    expect(attempts.isBlocked('a@test.local')).toBe(true);
    clock.now = fifth + 15 * MINUTE;
    expect(attempts.isBlocked('a@test.local')).toBe(false);
  });

  it('success resets the count', () => {
    const { attempts } = limiter();
    fail(attempts, 'a@test.local', 4);
    attempts.recordSuccess('a@test.local');
    fail(attempts, 'a@test.local', 4);
    expect(attempts.isBlocked('a@test.local')).toBe(false);
  });

  it('only failures within fifteen minutes count', () => {
    const { clock, attempts } = limiter();
    fail(attempts, 'a@test.local', 4);
    clock.now += 15 * MINUTE + 1000;
    fail(attempts, 'a@test.local', 1);
    expect(attempts.isBlocked('a@test.local')).toBe(false);
  });

  it('emails are counted independently', () => {
    const { attempts } = limiter();
    fail(attempts, 'a@test.local', 5);
    expect(attempts.isBlocked('a@test.local')).toBe(true);
    expect(attempts.isBlocked('b@test.local')).toBe(false);
  });
  it('prunes stale entries and keeps blocks', () => {
    const { clock, attempts } = limiter();
    for (let i = 0; i <= 10_000; i++) {
      attempts.recordFailure(`velho-${i}@test.local`);
    }
    clock.now += MINUTE;
    fail(attempts, 'alvo@test.local', 5);
    clock.now += 14 * MINUTE + 30 * 1000;
    attempts.recordFailure('novo@test.local');
    expect(attempts.isBlocked('alvo@test.local')).toBe(true);
    expect(attempts.tracked().sort()).toEqual(['alvo@test.local', 'novo@test.local']);
  });

  it('window edge is exactly fifteen minutes', () => {
    const inside = limiter();
    fail(inside.attempts, 'a@test.local', 4);
    inside.clock.now += 15 * MINUTE - 1;
    fail(inside.attempts, 'a@test.local', 1);
    expect(inside.attempts.isBlocked('a@test.local')).toBe(true);

    const edge = limiter();
    fail(edge.attempts, 'a@test.local', 4);
    edge.clock.now += 15 * MINUTE;
    fail(edge.attempts, 'a@test.local', 1);
    expect(edge.attempts.isBlocked('a@test.local')).toBe(false);
  });
});
