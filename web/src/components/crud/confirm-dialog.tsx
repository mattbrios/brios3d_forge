// Contrato reutilizável de confirmação (door 3, Fase 6): as Fases 7-10 copiam este componente.
export function ConfirmDialog({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  pending,
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <div role="dialog" aria-modal="true" className="flex flex-col gap-3 rounded border border-zinc-300 p-4 dark:border-zinc-700">
      <p>{message}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onConfirm} disabled={pending}>
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={pending}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
