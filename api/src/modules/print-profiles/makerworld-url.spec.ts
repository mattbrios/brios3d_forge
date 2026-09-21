import { parseMakerWorldUrl } from './makerworld-url.js';
import { PrintProfileError } from './print-profile.error.js';

const INVALID_URL =
  'URL inválida: cole o link de um modelo do MakerWorld (https://makerworld.com/models/…)';

function errorOf(fn: () => unknown): PrintProfileError {
  try {
    fn();
  } catch (error) {
    if (error instanceof PrintProfileError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected PrintProfileError');
}

describe('parseMakerWorldUrl', () => {
  it('accepts makerworld model urls', () => {
    expect(
      parseMakerWorldUrl(
        'https://makerworld.com/pt/models/3007827-sea-animals-set?from=recommend#profileId-3387944',
      ),
    ).toEqual({ designId: 3007827, profileId: 3387944 });

    const withoutFragment = [
      'https://makerworld.com/en/models/3007827-sea-animals-set',
      'https://www.makerworld.com/models/3007827',
      'https://makerworld.com/models/3007827',
      'https://makerworld.com/models/3007827-sea-animals-set?from=recommend',
      'https://makerworld.com/models/3007827/',
      'https://makerworld.com/pt/models/3007827',
    ];
    for (const url of withoutFragment) {
      expect(parseMakerWorldUrl(url), url).toEqual({ designId: 3007827, profileId: null });
    }
  });

  it('rejects non makerworld urls', () => {
    const invalid = [
      'http://makerworld.com/models/3007827',
      'https://www.printables.com/model/1',
      'https://makerworld.com.evil.com/models/3007827',
      'https://evil.makerworld.com/models/3007827',
      'https://makerworld.com:8443/models/3007827',
      'https://makerworld.com/models/abc',
      'https://makerworld.com/collections/3007827',
      'não é url',
    ];
    for (const url of invalid) {
      const error = errorOf(() => parseMakerWorldUrl(url));
      expect(error.status, url).toBe(400);
      expect(error.message, url).toBe(INVALID_URL);
    }
  });

  it('ignores malformed profile fragment', () => {
    for (const fragment of ['#profileId-abc', '#profileId-', '#outro']) {
      expect(parseMakerWorldUrl(`https://makerworld.com/models/3007827${fragment}`)).toEqual({
        designId: 3007827,
        profileId: null,
      });
    }
  });

  it('rejects userinfo and non positive design ids', () => {
    for (const url of [
      'https://user@makerworld.com/models/3007827',
      'https://user:pass@makerworld.com/models/3007827',
      'https://makerworld.com/models/0',
    ]) {
      const error = errorOf(() => parseMakerWorldUrl(url));
      expect(error.status, url).toBe(400);
      expect(error.message, url).toBe(INVALID_URL);
    }
  });

  it('rejects password only userinfo and unsafe design ids', () => {
    for (const url of [
      'https://:pass@makerworld.com/models/3007827',
      'https://makerworld.com/models/99999999999999999999',
    ]) {
      const error = errorOf(() => parseMakerWorldUrl(url));
      expect(error.status, url).toBe(400);
      expect(error.message, url).toBe(INVALID_URL);
    }
  });
});
