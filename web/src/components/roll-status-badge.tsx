import type { RollStatus } from "@/lib/inventory";
import { Badge, type BadgeTone } from "./ui/badge";

const TONES: Record<RollStatus, BadgeTone> = {
  fechado: "info",
  aberto: "success",
  vazio: "neutral",
  descartado: "danger",
};

// O texto continua o valor do contrato ("aberto"); a caixa alta inicial é só visual.
export function RollStatusBadge({ status, size }: { status: RollStatus; size?: "sm" | "md" }) {
  return (
    <Badge tone={TONES[status]} size={size} dot className="capitalize">
      {status}
    </Badge>
  );
}
