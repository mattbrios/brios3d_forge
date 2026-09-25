import { CircleHelp, TriangleAlert } from "lucide-react";
import { Badge } from "./ui/badge";

// Fase 13 (AC 11, 12): o mesmo aviso na lista e no detalhe do produto. `true` não mostra nada.
export function LicenseNotice({ commercialUseAllowed }: { commercialUseAllowed: boolean | null }) {
  if (commercialUseAllowed === false) {
    return (
      <Badge tone="warning" icon={TriangleAlert} size="sm">
        Licença não permite uso comercial
      </Badge>
    );
  }
  if (commercialUseAllowed === null) {
    return (
      <Badge tone="neutral" icon={CircleHelp} size="sm">
        Licença não informada
      </Badge>
    );
  }
  return null;
}
