export interface NormalizedLicense {
  license: string | null;
  commercialUseAllowed: boolean | null;
}

const NONCOMMERCIAL = /non-?commercial/i;
const STANDARD_DIGITAL_FILE_LICENSE = /^standard digital file license$/i;
// Creative Commons sem "noncommercial" (checado antes), CC0, domínio público, MIT, BSD, GPL.
const PERMISSIVE = /creative commons|\bcc0\b|public domain|domínio público|\bmit\b|\bbsd\b|\bgpl\b/i;

// Landing: prioridade fixa por palavra-chave (Fase 14). Uma tabela de strings exatas por
// plataforma ficaria obsoleta a cada variação de redação; o door 5 da Fase 13 exige que `null`
// nunca vire "permitido" por engano, então qualquer texto não reconhecido degrada para null.
export function normalizeLicense(rawLicense: string | null): NormalizedLicense {
  const license = rawLicense && rawLicense.trim() !== '' ? rawLicense : null;
  if (license === null) {
    return { license: null, commercialUseAllowed: null };
  }
  if (NONCOMMERCIAL.test(license)) {
    return { license, commercialUseAllowed: false };
  }
  if (STANDARD_DIGITAL_FILE_LICENSE.test(license.trim())) {
    return { license, commercialUseAllowed: false };
  }
  if (PERMISSIVE.test(license)) {
    return { license, commercialUseAllowed: true };
  }
  return { license, commercialUseAllowed: null };
}
