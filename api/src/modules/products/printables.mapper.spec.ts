import { mapPrintablesMetadata } from './printables.mapper.js';
import { ModelMetadataError } from './model-metadata.error.js';

function print(overrides: Record<string, unknown> = {}) {
  return {
    id: '123456',
    name: 'Vaso espiral',
    license: { id: 'cc-by', name: 'Creative Commons — Attribution' },
    user: { publicUsername: 'designer_x' },
    image: { filePath: 'model/abc/design/def.jpeg' },
    ...overrides,
  };
}

describe('mapPrintablesMetadata', () => {
  it('maps title, image, designer and a normalized permissive license', () => {
    const result = mapPrintablesMetadata(print());
    expect(result).toEqual({
      title: 'Vaso espiral',
      imageUrl: 'https://media.printables.com/model/abc/design/def.jpeg',
      designer: 'designer_x',
      license: 'Creative Commons — Attribution',
      commercialUseAllowed: true,
    });
  });

  it('normalizes a noncommercial license to commercialUseAllowed false', () => {
    const result = mapPrintablesMetadata(
      print({ license: { id: 'cc-by-nc', name: 'Creative Commons — Attribution-NonCommercial' } }),
    );
    expect(result.commercialUseAllowed).toBe(false);
  });

  it.each([
    ['title', 'name'],
    ['designer', 'user'],
    ['imageUrl', 'image'],
    ['license', 'license'],
  ])('missing %s becomes null', (field, rawKey) => {
    const raw = print();
    delete (raw as Record<string, unknown>)[rawKey];
    const result = mapPrintablesMetadata(raw);
    expect(result[field as keyof typeof result]).toBeNull();
  });

  it('missing license also makes commercialUseAllowed null', () => {
    const raw = print();
    delete (raw as Record<string, unknown>).license;
    expect(mapPrintablesMetadata(raw).commercialUseAllowed).toBeNull();
  });

  it('unrecognized (502) when the print has no id', () => {
    for (const raw of [null, [], 'texto', {}, { name: 'sem id' }]) {
      expect(() => mapPrintablesMetadata(raw)).toThrow(ModelMetadataError);
      try {
        mapPrintablesMetadata(raw);
      } catch (error) {
        expect((error as ModelMetadataError).status).toBe(502);
      }
    }
  });
});
