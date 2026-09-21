import { resolvePort } from './app.setup.js';

describe('app setup', () => {
  it('resolves the port', () => {
    expect(resolvePort({})).toBe(3001);
    expect(resolvePort({ PORT: '' })).toBe(3001);
    expect(resolvePort({ PORT: '4000' })).toBe(4000);
  });
});
