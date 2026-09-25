import { BadRequestException } from '@nestjs/common';
import { parseModelUrl } from './model-url.js';

const INVALID = 'URL do modelo inválida: use um link de modelo do Printables, do MakerWorld ou do Thingiverse';

// C4: um caso por ramo da tabela de decisão de `parseModelUrl`.
describe('parseModelUrl', () => {
  it.each([
    [
      'MakerWorld com /pt/, slug, query e #profileId',
      'https://makerworld.com/pt/models/3007827-sea-animals-set?from=recommend#profileId-3387944',
      { platform: 'makerworld', externalId: '3007827' },
    ],
    [
      'Printables com slug, ?lang=en e /files',
      'https://www.printables.com/model/123456-some-slug/files?lang=en',
      { platform: 'printables', externalId: '123456' },
    ],
    [
      'Printables com prefixo /pl/',
      'https://www.printables.com/pl/model/123456-some-slug',
      { platform: 'printables', externalId: '123456' },
    ],
    [
      'Thingiverse com /files',
      'https://www.thingiverse.com/thing:4567890/files',
      { platform: 'thingiverse', externalId: '4567890' },
    ],
  ])('accepts %s', (_label, input, expected) => {
    expect(parseModelUrl(input)).toEqual(expected);
  });

  it.each([
    ['host evil-printables.com', 'https://evil-printables.com/model/123456'],
    ['http:', 'http://www.printables.com/model/123456'],
    ['caminho sem id', 'https://www.thingiverse.com/about'],
    ['porta', 'https://www.printables.com:8443/model/123456'],
    ['credencial', 'https://user:pass@makerworld.com/models/3007827'],
  ])('rejects %s with the AC 5 message', (_label, input) => {
    let thrown: unknown;
    try {
      parseModelUrl(input);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(BadRequestException);
    expect((thrown as BadRequestException).message).toBe(INVALID);
  });
});
