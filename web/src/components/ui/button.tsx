import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

function buttonClass(variant: ButtonVariant, size: Size, block: boolean, className?: string): string {
  return cx("bf-btn", `bf-btn--${variant}`, size !== "md" && `bf-btn--${size}`, block && "bf-btn--block", className);
}

export function Button({
  variant = "primary",
  size = "md",
  icon: IconCmp,
  loading = false,
  block = false,
  type = "button",
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
  block?: boolean;
}) {
  const iconSize = size === "sm" ? 14 : 16;
  return (
    <button
      type={type}
      className={buttonClass(variant, size, block, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="bf-btn__spin" aria-hidden="true" />
      ) : IconCmp ? (
        <IconCmp size={iconSize} strokeWidth={2} aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}

// Link com a aparência de botão (navegação, não ação).
export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  icon: IconCmp,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: Size;
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, false, className)}>
      {IconCmp ? <IconCmp size={size === "sm" ? 14 : 16} strokeWidth={2} aria-hidden="true" /> : null}
      {children}
    </Link>
  );
}

export function IconButton({
  icon: IconCmp,
  label,
  variant = "ghost",
  size = "md",
  className,
  type = "button",
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: LucideIcon;
  label: string;
  variant?: "ghost" | "outline" | "inverse";
  size?: "sm" | "md";
}) {
  return (
    <button
      type={type}
      className={cx("bf-iconbtn", variant !== "ghost" && `bf-iconbtn--${variant}`, size === "sm" && "bf-iconbtn--sm", className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      <IconCmp size={size === "sm" ? 16 : 20} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
