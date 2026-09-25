import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { cx } from "./cx";

type AlertTone = "danger" | "success" | "warning" | "info" | "neutral";

const ALERT_ICONS: Record<AlertTone, LucideIcon> = {
  danger: CircleAlert,
  success: CircleCheck,
  warning: TriangleAlert,
  info: Info,
  neutral: Info,
};

// Faixa de mensagem. O papel acessível fica com quem chama (`role="alert"` nos erros), para
// não mudar o que cada tela anuncia.
export function Alert({
  tone = "danger",
  title,
  action,
  role,
  className,
  children,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  action?: ReactNode;
  role?: "alert" | "status";
  className?: string;
  children?: ReactNode;
}) {
  const IconCmp = ALERT_ICONS[tone];
  return (
    <div className={cx("bf-alert", `bf-alert--${tone}`, className)}>
      <IconCmp size={18} style={{ marginTop: 1, flex: "none" }} aria-hidden="true" />
      <div className="bf-alert__body">
        {title ? <span className="bf-alert__title">{title}</span> : null}
        {children ? <span role={role}>{children}</span> : null}
      </div>
      {action ? <div className="bf-alert__action">{action}</div> : null}
    </div>
  );
}

export function Loading({ children = "Carregando…" }: { children?: string }) {
  return (
    <p className="bf-loading">
      <span className="bf-btn__spin" aria-hidden="true" />
      {children}
    </p>
  );
}

// Estado de erro de página: a mensagem da API e o "Tentar novamente".
export function PageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bf-page-state">
      <Alert tone="danger" role="alert">
        {message}
      </Alert>
      <Button variant="secondary" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="bf-table-empty">{children}</p>;
}
