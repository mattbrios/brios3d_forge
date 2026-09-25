import type { MovementType } from "@/lib/inventory";
import { Badge, type BadgeTone } from "./ui/badge";

const TONES: Record<MovementType, BadgeTone> = {
  entrada: "success",
  consumo: "info",
  perda: "danger",
  ajuste: "violet",
};

// O texto continua o valor do contrato ("consumo"); a caixa alta inicial é só visual.
export function MovementBadge({ type }: { type: MovementType }) {
  return (
    <Badge tone={TONES[type]} size="sm" className="capitalize">
      {type}
    </Badge>
  );
}
