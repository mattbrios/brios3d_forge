import { normalizeLicense } from './license-normalization.js';

// C9-C12: um caso por ramo da tabela de decisão (prioridade fixa, AC 8-11).
describe('normalizeLicense', () => {
  it.each([
    ['Creative Commons — Attribution-NonCommercial', 'noncommercial'],
    ['non-commercial use only', 'non-commercial com hífen'],
    ['NONCOMMERCIAL', 'maiúsculas'],
  ])('license C9: %s (%s) -> commercialUseAllowed false, preserving text', (license) => {
    expect(normalizeLicense(license)).toEqual({ license, commercialUseAllowed: false });
  });

  it('license C10: exactly "Standard Digital File License" -> false', () => {
    expect(normalizeLicense('Standard Digital File License')).toEqual({
      license: 'Standard Digital File License',
      commercialUseAllowed: false,
    });
  });

  it('license C10: case-insensitive match still returns false', () => {
    expect(normalizeLicense('standard digital file license')).toEqual({
      license: 'standard digital file license',
      commercialUseAllowed: false,
    });
  });

  it.each([
    ['Creative Commons — Attribution 4.0', 'creative commons sem noncommercial'],
    ['CC0 1.0 Universal', 'CC0'],
    ['Public Domain', 'domínio público'],
    ['MIT License', 'MIT'],
    ['BSD 3-Clause', 'BSD'],
    ['GPL-3.0', 'GPL'],
  ])('license C11: %s (%s) -> commercialUseAllowed true', (license) => {
    expect(normalizeLicense(license)).toEqual({ license, commercialUseAllowed: true });
  });

  it.each<[string | null, string]>([
    [null, 'ausente'],
    ['', 'vazio'],
    ['   ', 'só espaço'],
    ['Todos os direitos reservados', 'texto não reconhecido'],
  ])('license C12: %s (%s) -> commercialUseAllowed null', (license) => {
    const result = normalizeLicense(license);
    expect(result.commercialUseAllowed).toBeNull();
  });

  it('license C12: preserves the original text when unrecognized (not empty/null)', () => {
    expect(normalizeLicense('Todos os direitos reservados')).toEqual({
      license: 'Todos os direitos reservados',
      commercialUseAllowed: null,
    });
  });

  it('license C12: null or empty text normalizes license to null', () => {
    expect(normalizeLicense(null)).toEqual({ license: null, commercialUseAllowed: null });
    expect(normalizeLicense('')).toEqual({ license: null, commercialUseAllowed: null });
  });

  // Prioridade fixa: noncommercial vence mesmo dentro de um texto Creative Commons permissivo.
  it('priority: noncommercial keyword wins over a Creative Commons match', () => {
    expect(normalizeLicense('Creative Commons Attribution-NonCommercial 4.0').commercialUseAllowed).toBe(false);
  });
});
