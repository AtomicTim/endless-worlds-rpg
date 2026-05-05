"use client";

import { useState, useEffect, useRef } from "react";
import { User } from "lucide-react";
import { Genre } from "@/types/game";
import { getAttributeModifier } from "@/lib/game/dice";
import { useGameStore } from "@/lib/stores/game-store";
import { SidebarPanel } from "./SidebarPanel";
import { getGenreColors } from "@/components/game/genre-ui";

const ATTR_KEYS = [
  "strength",
  "agility",
  "charisma",
  "intelligence",
  "perception",
] as const;

const ATTR_LABELS: Record<string, string> = {
  strength:     "STR",
  agility:      "AGI",
  charisma:     "CHA",
  intelligence: "INT",
  perception:   "PER",
};

// ── Helper components ─────────────────────────────────────────────────────────

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

function HPBar({ hp, maxHp, label }: { hp: number; maxHp: number; label: string }) {
  const [flashing, setFlashing] = useState(false);
  const prevRef = useRef(hp);
  useEffect(() => {
    if (prevRef.current !== hp) {
      prevRef.current = hp;
      setFlashing(true);
      const t = setTimeout(() => setFlashing(false), 1200);
      return () => clearTimeout(t);
    }
  }, [hp]);

  const pct = (hp / maxHp) * 100;
  return (
    <div className="mb-2 space-y-1">
      <div className="flex justify-between text-[10px]">
        <span style={{ color: "var(--color-muted)" }}>{label}</span>
        <span
          className="font-mono transition-colors duration-300"
          style={{ color: flashing ? hpColor(pct) : "var(--color-text)" }}
        >
          {hp}/{maxHp}
        </span>
      </div>
      <StatBar value={hp} max={maxHp} color={hpColor(pct)} />
    </div>
  );
}

function SanityBar({ sanity, maxSanity }: { sanity: number; maxSanity: number }) {
  const [flashing, setFlashing] = useState(false);
  const prevRef = useRef(sanity);
  useEffect(() => {
    if (prevRef.current !== sanity) {
      prevRef.current = sanity;
      setFlashing(true);
      const t = setTimeout(() => setFlashing(false), 1200);
      return () => clearTimeout(t);
    }
  }, [sanity]);

  const pct    = sanity / maxSanity;
  const color  = pct > 0.5 ? "#a855f7" : "#7c3aed";
  return (
    <div className="mb-2 space-y-1">
      <div className="flex justify-between text-[10px]">
        <span style={{ color: "var(--color-muted)" }}>Sanity</span>
        <span
          className="font-mono transition-colors duration-300"
          style={{ color: flashing ? color : "var(--color-text)" }}
        >
          {sanity}/{maxSanity}
        </span>
      </div>
      <StatBar value={sanity} max={maxSanity} color={color} />
    </div>
  );
}

function AttributeRow({ label, value }: { label: string; value: number }) {
  const [flashing, setFlashing] = useState(false);
  const prevRef = useRef(value);
  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setFlashing(true);
      const t = setTimeout(() => setFlashing(false), 1200);
      return () => clearTimeout(t);
    }
  }, [value]);

  const mod    = getAttributeModifier(value);
  const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
  const pips   = Math.min(5, Math.round(value / 4));

  return (
    <div
      className="flex items-center gap-2 rounded-sm px-0.5 transition-colors duration-300"
      style={
        flashing
          ? { backgroundColor: "color-mix(in srgb, var(--color-primary) 15%, transparent)" }
          : undefined
      }
    >
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
        className="text-[10px]"
        style={{ color: "var(--color-muted)" }}
      >
        {value}
      </span>
      <span
        className="ml-auto font-mono text-[10px]"
        style={{ color: "var(--color-accent)" }}
      >
        {modStr}
      </span>
    </div>
  );
}

// ── CharacterSheet ─────────────────────────────────────────────────────────────

export function CharacterSheet() {
  const masterState = useGameStore((s) => s.masterState);

  if (!masterState) {
    return (
      <SidebarPanel
        id="character-sheet"
        title="Character"
        icon={<User className="size-3" />}
      >
        <p
          className="text-center text-[10px] italic"
          style={{ color: "var(--color-muted)" }}
        >
          No character loaded
        </p>
      </SidebarPanel>
    );
  }

  const { player_state, metadata } = masterState;
  const genre = metadata.genre;
  const { name, health, max_health, sanity, max_sanity, attributes, resources, level, xp } =
    player_state;

  // Day 18 — read everything genre-themed from the central helper.
  const colors        = getGenreColors(genre);
  const isHorror      = genre === Genre.HORROR_LOVECRAFTIAN;
  const currencyLabel = colors.currency;       // string | null (null = no currency)
  const currencyKey   = colors.currencyKey;    // string | null
  const hpLabel       = colors.hp;
  const primaryCurrency =
    currencyKey ? resources[currencyKey] ?? 0 : null;
  const maxXp           = level * 500;

  const extraResources = Object.entries(resources).filter(
    ([k, v]) => k !== currencyKey && typeof v === "number" && (v as number) > 0
  );

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

      {/* HP — label comes from genre vocabulary (HP/Integrity/Hull Integrity/etc.) */}
      <HPBar hp={health} maxHp={max_health} label={hpLabel} />

      {/* Sanity — horror only */}
      {isHorror && sanity !== undefined && max_sanity !== undefined && (
        <SanityBar sanity={sanity} maxSanity={max_sanity} />
      )}

      {/* Attributes */}
      <div className="mt-3 space-y-1.5">
        {ATTR_KEYS.map((key) => (
          <AttributeRow
            key={key}
            label={ATTR_LABELS[key]}
            value={attributes[key]}
          />
        ))}
      </div>

      {/* Primary currency — hidden entirely when the genre has no currency
          (e.g. Horror/Lovecraftian, where currencyName is null). */}
      {primaryCurrency !== null && currencyLabel !== null && (
        <div
          className="mt-3 flex justify-between pt-2 text-[10px]"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <span style={{ color: "var(--color-muted)" }}>{currencyLabel}</span>
          <span className="font-bold" style={{ color: "var(--color-text)" }}>
            {primaryCurrency.toLocaleString()}
          </span>
        </div>
      )}

      {/* Extra resources (e.g. Post-Apoc ammo/food/water) */}
      {extraResources.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {extraResources.map(([key, val]) => (
            <div key={key} className="flex justify-between text-[10px]">
              <span className="capitalize" style={{ color: "var(--color-muted)" }}>
                {key}
              </span>
              <span style={{ color: "var(--color-text)" }}>{val as number}</span>
            </div>
          ))}
        </div>
      )}
    </SidebarPanel>
  );
}
