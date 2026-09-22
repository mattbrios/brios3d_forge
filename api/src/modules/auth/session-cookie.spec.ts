import { sessionCookieOptions } from './session-cookie.js';

describe('session cookie', () => {
  it('secure unless disabled', () => {
    const cases: Array<[Record<string, string>, boolean]> = [
      [{}, true],
      [{ SESSION_COOKIE_SECURE: 'true' }, true],
      [{ SESSION_COOKIE_SECURE: 'false' }, false],
    ];
    for (const [env, secure] of cases) {
      expect(sessionCookieOptions((key) => env[key])).toEqual({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 604800 * 1000,
        secure,
      });
    }
  });
});
