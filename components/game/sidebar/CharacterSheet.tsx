"use client";

import { User } from "lucide-react";
import { Genre } from "@/types/game";
import { SidebarPanel } from "./SidebarPanel";

/* ── Placeholder data (wired to live state in Day 11) ──────────── */
const PLACEHOLDER = {
  name: "Aria Stormveil",
  hp: 75,
  maxHp: 100,
  sanity: 60,
  maxSanity: 100,
  level: 3,
  xp: 340,
  maxXp: 500,
  currency: 250,
};

const ATTRIBUTES = [
  { key: "str", label: "STR", value: 14 },
  { key: "agi", label: "AGI", value: 11 },
  { key: "cha", label: "CHA", value: 16 },
  { key: "int", label: "INT", value: 12 },
  { key: "per", label: "PER", value: 13 },
] as const;

const CURRENCY_LABELS: Partial<Record<Genre, string>> & { default: string } = {
  [Genre.FANTASY]:     "Gold",
  [Genre.CYBERPUNK]:   "Credits",
  [Genre.SPACE_OPERA]: "Stellars",
  default:             "Currency",
};

/* ── Helper components ─────────────────────────────────────────── */
function StatBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full"
      style={{ backgroundColor: "var(--color-border)" }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

function hpColor(pct: number): string {
  if (pct > 60) return "#22c55e";
  if (pct > 30) return "#eab308";
  return "#ef4444";
}

function AttributeRow({ label, value }: { label: string; value: number }) {
  const pips = Math.min(5, Math.round(value / 4));
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-7 text-[10px] font-bold"
        style={{ color: "var(--color-muted)" }}
      >
        {label}
      </span>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-[1px]"
            style={{
              backgroundColor:
                i < pips ? "var(--color-primary)" : "var(--color-border)",
              opacity: i < pips ? 1 : 0.5,
            }}
          />
        ))}
      </div>
      <span
        className="ml-auto text-[10px]"
        style={{ color: "var(--color-muted)" }}
      >
        {value}
      </span>
    </div>
  );
}

/* ── CharacterSheet ────────────────────────────────────────────── */
interface CharacterSheetProps {
  genre?: Genre;
}

export function CharacterSheet({ genre = Genre.FANTASY }: CharacterSheetProps) {
  const { name, hp, maxHp, sanity, maxSanity, level, xp, maxXp, currency } =
    PLACEHOLDER;

  const isHorror = (genre as string) === "horror";
  const currencyLabel = CURRENCY_LABELS[genre] ?? CURRENCY_LABELS.default;
  const hpPct = (hp / maxHp) * 100;

  return (
    <SidebarPanel
      id="character-sheet"
      title="Character"
      icon={<User className="size-3" />}
    >
      {/* Name + genre badge */}
      <div className="mb-3 space-y-1.5">
        <p
          className="text-sm font-bold tracking-wide"
          style={{ color: "var(--color-text)" }}
        >
          {name}
        </p>
        <span
          className="inline-block rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
          style={{
            border: "1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)",
            color: "var(--color-primary)",
          }}
        >
          {genre}
        </span>
      </div>

      {/* Level + XP */}
      <div className="mb-3 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span style={{ color: "var(--color-muted)" }}>Level {level}</span>
          <span style={{ color: "var(--color-muted)" }}>
            {xp}/{maxXp} XP
          </span>
        </div>
        <StatBar value={xp} max={maxXp} color="var(--color-accent)" />
      </div>

      {/* HP */}
      <div className="mb-2 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span style={{ color: "var(--color-muted)" }}>HP</span>
          <span style={{ color: "var(--color-text)" }}>
            {hp}/{maxHp}
          </span>
        </div>
        <StatBar value={hp} max={maxHp} color={hpColor(hpPct)} />
      </div>

      {/* Sanity — horror genre only */}
      {isHorror && (
        <div className="mb-2 space-y-1">
          <div className="flex justify-between text-[10px]">
            <span style={{ color: "var(--color-muted)" }}>Sanity</span>
            <span style={{ color: "var(--color-text)" }}>
              {sanity}/{maxSanity}
            </span>
          </div>
          <StatBar
            value={sanity}
            max={maxSanity}
            color={(sanity / maxSanity) > 0.5 ? "#a855f7" : "#7c3aed"}
          />
        </div>
      )}

      {/* Attributes */}
      <div className="mt-3 space-y-1.5">
        {ATTRIBUTES.map((attr) => (
          <AttributeRow key={attr.key} label={attr.label} value={attr.value} />
        ))}
      </div>

      {/* Currency */}
      <div
        className="mt-3 flex justify-between pt-2 text-[10px]"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <span style={{ color: "var(--color-muted)" }}>{currencyLabel}</span>
        <span className="font-bold" style={{ color: "var(--color-text)" }}>
          {currency.toLocaleString()}
        </span>
      </div>
    </SidebarPanel>
  );
}
