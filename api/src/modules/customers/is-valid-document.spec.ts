import { digitsOfDocument, isValidDocument } from './is-valid-document.js';

describe('isValidDocument', () => {
  it('accepts a valid CPF, formatted or not', () => {
    expect(isValidDocument('123.456.789-09')).toBe(true);
    expect(isValidDocument('12345678909')).toBe(true);
  });

  it('accepts a valid CNPJ, formatted or not', () => {
    expect(isValidDocument('11.222.333/0001-81')).toBe(true);
    expect(isValidDocument('11222333000181')).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isValidDocument('1234567890')).toBe(false);
    expect(isValidDocument('123456789012345')).toBe(false);
  });

  it('rejects an invalid CPF check digit', () => {
    expect(isValidDocument('123.456.789-00')).toBe(false);
  });

  it('rejects an invalid CNPJ check digit', () => {
    expect(isValidDocument('11.222.333/0001-00')).toBe(false);
  });

  it('rejects a repeated-digit CPF even though it satisfies the checksum', () => {
    expect(isValidDocument('111.111.111-11')).toBe(false);
  });

  it('rejects a repeated-digit CNPJ even though it satisfies the checksum', () => {
    expect(isValidDocument('11.111.111/1111-11')).toBe(false);
  });
});

describe('digitsOfDocument', () => {
  it('strips formatting down to digits only', () => {
    expect(digitsOfDocument('123.456.789-09')).toBe('12345678909');
    expect(digitsOfDocument('11.222.333/0001-81')).toBe('11222333000181');
  });
});
