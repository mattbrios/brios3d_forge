// Segundos -> "H h M min", arredondando para o minuto mais próximo.
export function formatPrintTime(seconds: number): string {
  const { hours, minutes } = splitPrintTime(seconds);
  return `${hours} h ${minutes} min`;
}

export function splitPrintTime(seconds: number): { hours: number; minutes: number } {
  const totalMinutes = Math.round(seconds / 60);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
