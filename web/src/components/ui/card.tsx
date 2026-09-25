import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "./cx";

export function Card({
  title,
  subtitle,
  icon: IconCmp,
  action,
  variant = "default",
  tight = false,
  titleAs: TitleTag = "h2",
  className,
  style,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  variant?: "default" | "flat" | "sunken" | "inverse";
  tight?: boolean;
  titleAs?: "h2" | "h3";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const hasHead = title || action || IconCmp;
  return (
    <section className={cx("bf-card", variant !== "default" && `bf-card--${variant}`, tight && "bf-card--tight", className)} style={style}>
      {hasHead ? (
        <header className="bf-card__head">
          {IconCmp ? (
            <span className="bf-card__icon">
              <IconCmp size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
          ) : null}
          <div style={{ flex: 1, minWidth: 0 }}>
            {title ? <TitleTag className="bf-card__title">{title}</TitleTag> : null}
            {subtitle ? <p className="bf-card__sub">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export type StatTone = "ink" | "orange" | "violet" | "blue" | "green" | "yellow" | "magenta";

export function StatCard({
  value,
  unit,
  label,
  tone = "ink",
  icon: IconCmp,
  flat = false,
}: {
  value: ReactNode;
  unit?: string;
  label: ReactNode;
  tone?: StatTone;
  icon?: LucideIcon;
  flat?: boolean;
}) {
  return (
    <div className={cx("bf-stat", `bf-stat--${tone}`, flat && "bf-stat--flat")}>
      <div className="bf-stat__top">
        <span className="bf-stat__value">
          {value}
          {unit ? <span className="bf-stat__unit">{unit}</span> : null}
        </span>
        {IconCmp ? <IconCmp size={18} style={{ color: "var(--ink-400)" }} aria-hidden="true" /> : null}
      </div>
      <span className="bf-stat__label">{label}</span>
    </div>
  );
}
