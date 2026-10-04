import { cx } from "./cx";
import type { MeterFill } from "@/lib/meter-tone";

const HEX = /^#[0-9a-f]{6}$/i;

export function FilamentSwatch({
  color,
  label,
  size = "md",
}: {
  color: string | null | undefined;
  label?: string;
  size?: "md" | "lg";
}) {
  const valid = HEX.test(color ?? "");
  return (
    <span className={cx("bf-swatch", size === "lg" && "bf-swatch--lg")}>
      <span
        className="bf-swatch__chip"
        aria-hidden="true"
        style={{
          background: valid
            ? (color as string)
            : "repeating-linear-gradient(45deg,var(--ink-100) 0 4px,var(--ink-200) 4px 8px)",
        }}
      />
      {label ? <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span> : null}
    </span>
  );
}

// Barra de saldo contra o mínimo. Só visual: o texto do saldo continua com a tela.
// Com `fill`, o tom "ok" usa a cor do material; amarelo e vermelho do mínimo vencem o Tom.
export function StockMeter({
  value,
  max,
  minimum,
  fill,
}: {
  value: number;
  max: number;
  minimum: number | null;
  fill?: MeterFill | null;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const low = minimum !== null && value < minimum;
  const critical = minimum !== null && value < minimum / 2;
  const tone = critical ? "danger" : low ? "warning" : "ok";
  // Estilo inline venceria `.bf-meter--warning`, então o Tom só entra no tom "ok".
  const toned = tone === "ok" && fill ? fill : null;
  return (
    <div className={cx("bf-meter", `bf-meter--${tone}`)} aria-hidden="true">
      <div className="bf-meter__track">
        <div
          className={cx("bf-meter__fill", toned?.outlined && "bf-meter__fill--outlined")}
          style={{ width: `${pct}%`, background: toned?.color }}
        />
        {minimum !== null && max > 0 ? (
          <span className="bf-meter__min" style={{ left: `${Math.min(100, (minimum / max) * 100)}%` }} />
        ) : null}
      </div>
    </div>
  );
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="bf-avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
