import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent" | "violet";

export function Badge({
  tone = "neutral",
  solid = false,
  dot = false,
  icon: IconCmp,
  size = "md",
  className,
  children,
}: {
  tone?: BadgeTone;
  solid?: boolean;
  dot?: boolean;
  icon?: LucideIcon;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cx("bf-badge", `bf-badge--${tone}`, solid && "bf-badge--solid", size === "sm" && "bf-badge--sm", className)}>
      {dot ? <span className="bf-badge__dot" /> : null}
      {IconCmp ? <IconCmp size={12} strokeWidth={2.25} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

// Ativo / Inativo, o par de situação de todo cadastro.
export function ActiveBadge({ active, size }: { active: boolean; size?: "sm" | "md" }) {
  return (
    <Badge tone={active ? "success" : "neutral"} dot size={size}>
      {active ? "Ativo" : "Inativo"}
    </Badge>
  );
}
