// Erro de domínio, sem HTTP: os módulos que chamam o cálculo fora de uma requisição
// (catálogo, relatórios) não devem depender do Nest para tratá-lo.
export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingError';
  }
}
