"use client";

import type { LucideIcon } from "lucide-react";
import {
  createContext,
  useContext,
  useId,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { cx } from "./cx";

// O Field entrega o id ao controle de dentro, e o <label htmlFor> fica só com o nome do campo:
// dica, erro e sufixo não entram no nome acessível.
const FieldIdContext = createContext<string | undefined>(undefined);

export function Field({
  label,
  hint,
  error,
  className,
  style,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className={cx("bf-field", className)} style={style}>
      {label ? (
        <label className="bf-field__label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <FieldIdContext.Provider value={id}>{children}</FieldIdContext.Provider>
      {error ? (
        <span className="bf-field__error" role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="bf-field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function Input({
  icon: IconCmp,
  suffix,
  invalid = false,
  inputSize = "md",
  className,
  id,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  icon?: LucideIcon;
  suffix?: string;
  invalid?: boolean;
  inputSize?: "sm" | "md";
}) {
  const fieldId = useContext(FieldIdContext);
  const input = (
    <input
      id={id ?? fieldId}
      className={cx("bf-input", invalid && "bf-input--invalid", inputSize === "sm" && "bf-input--sm", className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
  if (!IconCmp && !suffix) return input;
  return (
    <span className={cx("bf-input-wrap", suffix && !IconCmp && "bf-input-wrap--suffix")}>
      {IconCmp ? <IconCmp size={16} className="bf-input-wrap__icon" aria-hidden="true" /> : null}
      {input}
      {suffix ? (
        <span className="bf-input-wrap__suffix" aria-hidden="true">
          {suffix}
        </span>
      ) : null}
    </span>
  );
}

export function Select({
  selectSize = "md",
  className,
  id,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { selectSize?: "sm" | "md" }) {
  const fieldId = useContext(FieldIdContext);
  return (
    <select id={id ?? fieldId} className={cx("bf-select", selectSize === "sm" && "bf-select--sm", className)} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode }) {
  return (
    <label className={cx("bf-check", className)}>
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  tone = "dark",
  ariaLabel,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
  tone?: "dark" | "light";
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cx("bf-seg", tone === "light" && "bf-seg--light")}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className="bf-seg__opt"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
