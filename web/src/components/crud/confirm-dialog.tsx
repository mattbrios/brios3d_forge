"use client";

import { Info, TriangleAlert } from "lucide-react";
import { Button } from "../ui/button";

// Contrato reutilizável de confirmação (door 3, Fase 6): as Fases 7-10 copiam este componente.
export function ConfirmDialog({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  pending,
  title,
  tone = "danger",
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
  title?: string;
  // "danger" para desativar/descartar; "neutral" para reativar.
  tone?: "danger" | "neutral";
}) {
  const Icon = tone === "danger" ? TriangleAlert : Info;
  return (
    <div
      className="bf-scrim"
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={title ?? message} className="bf-dialog">
        <span className={tone === "danger" ? "bf-dialog__icon" : "bf-dialog__icon bf-dialog__icon--neutral"}>
          <Icon size={22} aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1.5">
          {title && <h2 className="bf-dialog__title">{title}</h2>}
          <p className="bf-dialog__msg">{message}</p>
        </div>
        <div className="bf-dialog__actions">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
