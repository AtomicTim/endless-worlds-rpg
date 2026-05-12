"use client";

import { useEffect, useMemo, useState } from "react";
import { useGameStore, makeMessage } from "@/lib/stores/game-store";
import type { Attributes } from "@/types/game";
import { resolveLevelUp, applyLevelUp } from "@/lib/game/level-resolver";
import { STAT_CAP } from "@/lib/game/constants";

/**
 * Day 22 — Level-up modal.
 *
 * Opens when `master_state.player_state.pending_level_up === true` AND
 * combat is no longer active. That sequencing keeps the level-up beat
 * AFTER the victory banner — handleVictory flags pending, the combat
 * slice clears, then this modal mounts.
 *
 * The player sees auto gains (primary +1, secondary +1, HP +N) and is
 * forced to pick one free attribute point before confirming. There is
 * no ESC or backdrop dismiss — the modal is gameplay state, not chrome.
 *
 * Apply path:
 *   resolveLevelUp(background, currentLevel) → LevelUpResult
 *   modal collects free_stat
 *   applyLevelUp(player, {...result, free_stat}) → Partial<PlayerState>
 *   game store merge → done
 *
 * Stats already at STAT_CAP are disabled in the picker with "(Max)".
 * If every stat is capped the modal still confirms (the free point is
 * silently dropped — applyLevelUp's cap check is idempotent).
 */

const STAT_KEYS: Array<keyof Attributes> = [
  "strength", "agility", "intelligence", "perception", "charisma",
];

const STAT_LABELS: Record<keyof Attributes, string> = {
  strength:     "Strength",
  agility:      "Agility",
  intelligence: "Intelligence",
  perception:   "Perception",
  charisma:     "Charisma",
};

const STAT_SHORT: Record<keyof Attributes, string> = {
  strength:     "STR",
  agility:      "AGI",
  intelligence: "INT",
  perception:   "PER",
  charisma:     "CHA",
};

export function LevelUpModal() {
  const masterState  = useGameStore((s) => s.masterState);
  const setMasterState = useGameStore((s) => s.setMasterState);
  const addMessage   = useGameStore((s) => s.addMessage);

  const player        = masterState?.player_state;
  const combatActive  = masterState?.combat?.active === true;
  const pending       = player?.pending_level_up === true;

  // Modal only opens when a level-up is queued AND combat has dismissed.
  // While combat is active, the flag stays set on player state and the
  // victory banner / resolution prose render first — V8.37 pacing.
  const isOpen = !!player && pending && !combatActive;

  // resolveLevelUp gives us the auto gains based on archetype +
  // pre-levelup level. `player.level` here is still the OLD level
  // because applyLevelUp hasn't fired yet.
  const result = useMemo(() => {
    if (!isOpen || !player) return null;
    return resolveLevelUp(player.background, player.level);
  }, [isOpen, player]);

  const [freeStat, setFreeStat] = useState<keyof Attributes | null>(null);

  // Reset the picker every time a fresh level-up modal opens so chained
  // level-ups (defensive — current pacing never crosses two thresholds
  // at once) get their own confirmation flow.
  useEffect(() => {
    if (isOpen) setFreeStat(null);
  }, [isOpen, player?.level]);

  if (!isOpen || !player || !result) return null;

  const stats = player.attributes;

  const handleConfirm = () => {
    if (!freeStat) return;
    const slice = applyLevelUp(player, { ...result, free_stat: freeStat });
    setMasterState({
      ...masterState!,
      player_state: { ...player, ...slice },
    });
    // Templated story-feed beat. No LLM call — V8.47 rule 84 pattern.
    addMessage(
      makeMessage(
        "SYSTEM",
        `[LEVEL UP] You have reached level ${result.new_level}.`,
        { level_up: true, new_level: result.new_level }
      )
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Level up to ${result.new_level}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      // No backdrop dismiss — modal is gameplay state, not chrome.
    >
      <div
        className="w-full max-w-md rounded-sm font-mono shadow-2xl"
        style={{
          backgroundColor: "var(--color-bg)",
          border:          "1px solid var(--hl-pass)",
          color:           "var(--color-text)",
        }}
      >
        {/* Header */}
        <header
          className="px-6 pt-5 pb-3 text-center"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div
            className="text-[10px] font-bold tracking-widest uppercase"
            style={{ color: "var(--hl-pass)" }}
          >
            Level Up
          </div>
          <div
            className="mt-1 text-3xl font-bold"
            style={{ color: "var(--hl-pass)" }}
          >
            Level {result.new_level}
          </div>
        </header>

        {/* Auto gains */}
        <section className="px-6 pt-4 pb-3">
          <div
            className="mb-2 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--color-muted)" }}
          >
            Auto Gains
          </div>
          <ul className="space-y-1 text-sm">
            <li>
              <span style={{ color: "var(--color-text)" }}>
                {STAT_LABELS[result.primary_stat]}
              </span>
              <span
                className="ml-2 font-bold"
                style={{ color: "var(--hl-pass)" }}
              >
                +1
              </span>
              <span
                className="ml-2 text-[10px]"
                style={{ color: "var(--color-muted)" }}
              >
                (primary)
              </span>
            </li>
            <li>
              <span style={{ color: "var(--color-text)" }}>
                {STAT_LABELS[result.secondary_stat]}
              </span>
              <span
                className="ml-2 font-bold"
                style={{ color: "var(--hl-pass)" }}
              >
                +1
              </span>
              <span
                className="ml-2 text-[10px]"
                style={{ color: "var(--color-muted)" }}
              >
                (secondary)
              </span>
            </li>
            <li>
              <span style={{ color: "var(--color-text)" }}>HP</span>
              <span
                className="ml-2 font-bold"
                style={{ color: "var(--hl-pass)" }}
              >
                +{result.hp_gained}
              </span>
            </li>
          </ul>
        </section>

        {/* Free point picker */}
        <section
          className="px-6 pt-3 pb-4"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div
            className="mb-2 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--color-muted)" }}
          >
            Choose your bonus point
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {STAT_KEYS.map((s) => {
              const currentValue = stats[s];
              // Account for auto gains so the "(Max)" check reflects
              // POST-levelup values, not pre. The free point can still
              // be placed on the primary/secondary even if they hit
              // STAT_CAP from the auto gain — applyLevelUp will silently
              // clamp.
              const autoGain =
                (s === result.primary_stat ? 1 : 0) +
                (s === result.secondary_stat ? 1 : 0);
              const postAuto = currentValue + autoGain;
              const isCapped = postAuto >= STAT_CAP;
              const isSelected = freeStat === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => { if (!isCapped) setFreeStat(s); }}
                  disabled={isCapped}
                  className="flex flex-col items-center rounded-sm px-1 py-2 text-[10px] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    backgroundColor: isSelected
                      ? "color-mix(in srgb, var(--hl-pass) 25%, transparent)"
                      : "color-mix(in srgb, var(--color-primary) 8%, transparent)",
                    border: `1px solid ${
                      isSelected
                        ? "var(--hl-pass)"
                        : "color-mix(in srgb, var(--color-primary) 30%, transparent)"
                    }`,
                    color: isSelected ? "var(--hl-pass)" : "var(--color-text)",
                  }}
                >
                  <span className="text-[10px] font-bold tracking-wide">
                    {STAT_SHORT[s]}
                  </span>
                  <span className="mt-0.5 text-sm font-bold">
                    {isSelected ? postAuto + 1 : postAuto}
                  </span>
                  {isCapped && (
                    <span
                      className="mt-0.5 text-[9px] italic"
                      style={{ color: "var(--color-muted)" }}
                    >
                      Max
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Confirm */}
        <footer
          className="px-6 py-3 text-center"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!freeStat}
            className="rounded-sm px-6 py-2 text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              backgroundColor: "var(--hl-pass)",
              color:           "#0a0a0a",
            }}
          >
            Confirm
          </button>
        </footer>
      </div>
    </div>
  );
}
