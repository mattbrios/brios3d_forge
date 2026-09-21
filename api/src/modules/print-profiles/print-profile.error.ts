export type PrintProfileErrorStatus = 400 | 404 | 502;

export const INVALID_URL_MESSAGE =
  'URL inválida: cole o link de um modelo do MakerWorld (https://makerworld.com/models/…)';
export const UNAVAILABLE_MESSAGE =
  'Não foi possível consultar o MakerWorld agora. Preencha os dados manualmente';

// Erro de domínio, sem HTTP (mesmo desenho do PricingError, AD-008). O status diz ao
// controller qual HttpException lançar.
export class PrintProfileError extends Error {
  constructor(
    readonly status: PrintProfileErrorStatus,
    message: string,
  ) {
    super(message);
    this.name = 'PrintProfileError';
  }
}
