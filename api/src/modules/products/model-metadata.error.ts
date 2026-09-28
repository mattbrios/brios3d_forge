export type ModelMetadataErrorStatus = 400 | 404 | 502;

// AC 4/14: Thingiverse não tem busca automática nesta fase.
export const THINGIVERSE_NOT_SUPPORTED =
  'Busca automática não disponível para o Thingiverse. Preencha os dados manualmente';

export function unavailableMessage(platformLabel: string): string {
  return `Não foi possível consultar o ${platformLabel} agora. Preencha os dados manualmente`;
}

// Erro de domínio, sem HTTP (mesmo desenho do PrintProfileError, AD-008). O status diz ao
// controller qual HttpException lançar.
export class ModelMetadataError extends Error {
  constructor(
    readonly status: ModelMetadataErrorStatus,
    message: string,
  ) {
    super(message);
    this.name = 'ModelMetadataError';
  }
}
