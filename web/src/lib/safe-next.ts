// Destino depois do login: só caminhos deste site. Qualquer outra coisa volta para "/".
// "//host" e "/\host" viram outro host no navegador; caracteres de controle são descartados por ele.
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  if (next.includes("\\") || /[\u0000-\u001f\u007f]/.test(next)) {
    return "/";
  }
  return next;
}
