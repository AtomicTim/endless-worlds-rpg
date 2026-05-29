"use client";

import { useEffect, useMemo, useState } from "react";
import { useGameStore, makeMessage } from "@/lib/stores/game-store";
import { Genre } from "@/types/game";
import type {
  AbilityId, AbilityTemplate, Attributes, Perk, PerkId,
} from "@/types/game";
import { resolveLevelUp, applyLevelUp } from "@/lib/game/level-resolver";
import {
  ABILITY_LIBRARY,
  getSlotCandidatesForLevelUp,
} from "@/lib/game/abilities";
import {
  applyPerkEffects,
  drawPerkOptions,
  isPerkLevel,
} from "@/lib/game/perks";
import { STAT_CAP } from "@/lib/game/constants";
import { toast } from "@/lib/game/toasts";

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

const STAT_SHORT: Record<keyof Attributes, string> = {
  strength:     "STR",
  agility:      "AGI",
  intelligence: "INT",
  perception:   "PER",
  charisma:     "CHA",
};

/**
 * PR-10v — Per-genre level-up background plates. Matches CodexModal
 * (GENRE_CODEX_BG) and JournalModal so the three "long-dwell" modals
 * share the same per-genre near-black surface system. All five hex
 * values are registered under "Codex genre backgrounds (PR-8v)" in
 * lib/__tests__/ui-foundation.test.ts ALLOWED_HEX_CODES.
 */
const GENRE_LEVELUP_BG: Record<Genre, string> = {
  [Genre.FANTASY]:             "#141008",
  [Genre.CYBERPUNK]:           "#0a1414",
  [Genre.HORROR_LOVECRAFTIAN]: "#100808",
  [Genre.SPACE_OPERA]:         "#08080f",
  [Genre.POST_APOCALYPTIC]:    "#161008",
};

interface LevelUpModalProps {
  /** HF-levelup-timing — true while the combat hook is still draining
   *  the victory feed. Gates the modal so it doesn't open mid-drain
   *  (combat.active goes false inside applyCombatResult before
   *  projectCombatEventsToFeed finishes the victory banner + prose). */
  isResolving?: boolean;
}

export function LevelUpModal({ isResolving }: LevelUpModalProps = {}) {
  const masterState  = useGameStore((s) => s.masterState);
  const setMasterState = useGameStore((s) => s.setMasterState);
  const addMessage   = useGameStore((s) => s.addMessage);
  const genre = useGameStore(
    (s) => s.masterState?.metadata.genre ?? Genre.FANTASY,
  );
  const levelUpBg = GENRE_LEVELUP_BG[genre] ?? GENRE_LEVELUP_BG[Genre.FANTASY];

  const player        = masterState?.player_state;
  const combatActive  = masterState?.combat?.active === true;
  const pending       = player?.pending_level_up === true;

  // Modal only opens when a level-up is queued AND combat has dismissed
  // AND the combat hook is no longer resolving. HF-levelup-timing — the
  // !isResolving gate prevents the modal from popping while
  // projectCombatEventsToFeed is still draining the victory banner +
  // "X is defeated." line + Search the remains prompt. P7 — stays open
  // while the slot-unlock step is in progress (handleConfirm clears
  // `pending` but transitions to the slot picker).
  const isStatStepOpen = !!player && pending && !combatActive && !isResolving;

  // resolveLevelUp gives us the auto gains based on archetype +
  // pre-levelup level. `player.level` here is still the OLD level
  // because applyLevelUp hasn't fired yet.
  const result = useMemo(() => {
    if (!isStatStepOpen || !player) return null;
    return resolveLevelUp(player.background, player.level);
  }, [isStatStepOpen, player]);

  const [freeStat, setFreeStat] = useState<keyof Attributes | null>(null);

  // P7 — slot unlock follow-up step. Set non-null when the level-up
  // crosses a slot threshold (5 / 10 / 15). Carries the slot number +
  // the candidate ability ids the player picks from. After the stat
  // step's Confirm has fired and stats have committed, this state
  // transitions the modal to the slot picker; closing the picker
  // commits the chosen slot ability into equipped_ability_slots.
  const [slotStep, setSlotStep] = useState<{
    slotNum:        2 | 3 | 4;
    candidates:     AbilityTemplate[];
    autoAssigned?:  AbilityId | null;  // slot 2: filled by Continue
  } | null>(null);
  const [slotPick, setSlotPick] = useState<AbilityId | null>(null);

  // P8 — perk picker step. Set non-null at levels 4 / 8 / 12 / 16 / 20.
  // Sequenced AFTER any slot-unlock step so disjoint trigger sets
  // (perks 4/8/12/16/20 vs slots 5/10/15) don't collide today, and a
  // future overlap (test #7 hypothetical) cleanly serialises stat →
  // slot → perk.
  const [perkStep, setPerkStep] = useState<{ options: Perk[] } | null>(null);
  const [perkPick, setPerkPick] = useState<PerkId | null>(null);

  // Reset the picker every time a fresh level-up modal opens so chained
  // level-ups (defensive — current pacing never crosses two thresholds
  // at once) get their own confirmation flow.
  useEffect(() => {
    if (isStatStepOpen) {
      setFreeStat(null);
      setSlotStep(null);
      setSlotPick(null);
      setPerkStep(null);
      setPerkPick(null);
    }
  }, [isStatStepOpen, player?.level]);

  const isOpen =
    (isStatStepOpen || slotStep !== null || perkStep !== null) && !combatActive;
  if (!isOpen || !player) return null;

  const stats = player.attributes;

  const handleConfirm = () => {
    if (!freeStat || !result || !player || !masterState) return;
    const slice = applyLevelUp(player, { ...result, free_stat: freeStat });
    setMasterState({
      ...masterState,
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
    // UI-11 — fire the level-up toast alongside the story-feed beat.
    toast({ type: "level_up", message: `Level ${result.new_level}` });

    // P7 — slot unlock follow-up step. After stats commit, advance the
    // modal to the slot-N picker when the new level crosses 5 / 10 / 15.
    const slotNum: 2 | 3 | 4 | null =
      result.new_level === 5  ? 2
      : result.new_level === 10 ? 3
      : result.new_level === 15 ? 4
      : null;
    // P8 — perk picker fires at 4 / 8 / 12 / 16 / 20. Disjoint from slot
    // levels (5/10/15) today, so the two never collide, but `openPerkStep`
    // is invoked AFTER slot resolution to serialise cleanly if the
    // schedules ever overlap.
    if (!slotNum) {
      if (isPerkLevel(result.new_level)) openPerkStep();
      return;
    }

    if (slotNum === 2) {
      // Slot 2 auto-assigns from the learned pool. v1 = exactly 1 slot-2
      // ability per class lives in the pool from game start; with v2
      // variant pools (multiple slot-2 options) this picks one randomly.
      const slot2InPool = player.learned_abilities
        .map((id) => ABILITY_LIBRARY[id])
        .filter((t) => !!t && !t.is_passive && t.slot_position === 2);
      const chosen = slot2InPool.length === 1
        ? slot2InPool[0]
        : slot2InPool.length > 1
          ? slot2InPool[Math.floor(Math.random() * slot2InPool.length)]
          : null;
      setSlotStep({ slotNum: 2, candidates: chosen ? [chosen] : [], autoAssigned: chosen?.id ?? null });
      setSlotPick(chosen?.id ?? null);
      return;
    }

    // Slots 3 and 4 — show the candidates from the library.
    const candidates = getSlotCandidatesForLevelUp(player.background, slotNum);
    setSlotStep({ slotNum, candidates });
    // Pre-select if there is only one — UI degrades to single-card
    // auto-confirm when v1 ships 1 candidate per slot.
    if (candidates.length === 1) setSlotPick(candidates[0].id);
  };

  /** Commit the slot picker's chosen ability into equipped_ability_slots
   *  and add any unchosen candidates to learned_abilities (P7 spec). */
  const handleSlotConfirm = () => {
    if (!slotStep || !slotPick || !masterState) return;

    // Re-read player state — handleConfirm already committed level-up
    // stats, so the working snapshot is in masterState now (not the
    // stale `player` const captured at modal open).
    const currentPlayer = masterState.player_state;
    const idx = (slotStep.slotNum - 1) as 0 | 1 | 2 | 3;

    const nextSlots: [AbilityId | null, AbilityId | null, AbilityId | null, AbilityId | null] = [
      currentPlayer.equipped_ability_slots[0] ?? null,
      currentPlayer.equipped_ability_slots[1] ?? null,
      currentPlayer.equipped_ability_slots[2] ?? null,
      currentPlayer.equipped_ability_slots[3] ?? null,
    ];
    nextSlots[idx] = slotPick;

    // Any unchosen candidate (slot 3/4 only) joins the learned pool if
    // it isn't already there.
    const nextLearned = [...currentPlayer.learned_abilities];
    for (const c of slotStep.candidates) {
      if (c.id !== slotPick && !nextLearned.includes(c.id)) {
        nextLearned.push(c.id);
      }
    }
    if (slotPick && !nextLearned.includes(slotPick)) {
      nextLearned.push(slotPick);
    }

    setMasterState({
      ...masterState,
      player_state: {
        ...currentPlayer,
        equipped_ability_slots: nextSlots,
        learned_abilities:      nextLearned,
      },
    });

    const chosen = ABILITY_LIBRARY[slotPick];
    addMessage(
      makeMessage(
        "SYSTEM",
        `[SLOT ${slotStep.slotNum} UNLOCKED] ${chosen?.base_name ?? slotPick}.`,
        { level_up: true, slot_unlocked: slotStep.slotNum }
      )
    );

    setSlotStep(null);
    setSlotPick(null);

    // P8 — chain into the perk step when this level also unlocked a perk.
    // Today's schedules don't overlap (perks 4/8/12/16/20, slots 5/10/15)
    // but the chain is here so a future redesign doesn't lose the perk.
    if (currentPlayer.level && isPerkLevel(currentPlayer.level)) openPerkStep();
  };

  /** Draw 3 perk options and enter the picker. Pulled from the player's
   *  CURRENT perks list (read from masterState — not the stale `player`
   *  capture — so consecutive level-ups in one session don't show
   *  already-owned perks). */
  const openPerkStep = () => {
    const live = useGameStore.getState().masterState?.player_state;
    const owned = live?.perks ?? [];
    const options = drawPerkOptions(owned, 3);
    setPerkStep({ options });
    setPerkPick(null);
  };

  /** Commit the chosen perk: apply mechanical effect via applyPerkEffects
   *  (no-op for passive perks), then append the perk id to player.perks.
   *  Done as a single setMasterState so React renders consistently. */
  const handlePerkConfirm = () => {
    if (!perkPick) return;
    const live = useGameStore.getState().masterState;
    if (!live) return;
    const withEffect = applyPerkEffects(live, perkPick);
    const nextPerks  = [...withEffect.player_state.perks, perkPick];
    setMasterState({
      ...withEffect,
      player_state: { ...withEffect.player_state, perks: nextPerks },
    });

    const chosen = perkStep?.options.find((p) => p.id === perkPick);
    addMessage(
      makeMessage(
        "SYSTEM",
        `[PERK] ${chosen?.name ?? perkPick}.`,
        { level_up: true, perk_id: perkPick }
      )
    );

    setPerkStep(null);
    setPerkPick(null);
  };

  // ── P8 — perk step (renders after stat + any slot step) ────────────────
  if (perkStep) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose a perk"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 modal-backdrop-in"
      >
        <div
          // UI-fix-A — was font-mono; the modal is mostly UI chrome
          // + serif title, so inherit from body sans (Inter Tight)
          // and let inner ew-serif/ew-mono override per element.
          className="ew-sans w-full max-w-md rounded-sm shadow-2xl modal-card-in"
          style={{
            backgroundColor: levelUpBg,
            border:          "1px solid var(--genre-accent)",
            color:           "var(--ui-text-1)",
          }}
        >
          <header
            className="px-6 pt-5 pb-3 text-center"
            style={{ borderBottom: "1px solid var(--ui-border-default)" }}
          >
            <div
              className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: "var(--genre-accent)" }}
            >
              Perk Unlocked
            </div>
            <div
              className="mt-1 text-2xl font-bold ew-serif"
              style={{
                color:     "var(--genre-accent)",
                fontStyle: "italic",
              }}
            >
              Choose a perk
            </div>
          </header>

          <section className="px-6 pt-4 pb-4 flex flex-col gap-2">
            {perkStep.options.length === 0 ? (
              <div
                className="text-xs italic"
                style={{ color: "var(--ui-text-muted)" }}
              >
                No perks available — your pool is exhausted.
              </div>
            ) : (
              perkStep.options.map((p) => {
                const isSelected = perkPick === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPerkPick(p.id)}
                    className="text-left p-3 rounded-sm transition-colors"
                    style={{
                      background: isSelected
                        ? "color-mix(in srgb, var(--genre-accent) 18%, transparent)"
                        : "color-mix(in srgb, var(--genre-accent) 8%, transparent)",
                      border:     `1px solid ${
                        isSelected ? "var(--genre-accent)" : "var(--ui-border-default)"
                      }`,
                      cursor:     "pointer",
                    }}
                  >
                    <div
                      className="ew-serif"
                      style={{
                        fontSize:  13,
                        fontStyle: "italic",
                        color:     isSelected
                          ? "var(--genre-accent)"
                          : "#e2cda0",
                      }}
                    >
                      {p.name}
                      <span
                        className="ml-2 text-[7px] tracking-widest uppercase"
                        style={{
                          background:   "color-mix(in srgb, var(--genre-accent) 18%, transparent)",
                          color:        "var(--genre-accent)",
                          padding:      "1px 6px",
                          borderRadius: 9999,
                          fontFamily:   "Inter Tight, var(--mono), monospace",
                          fontStyle:    "normal",
                        }}
                      >
                        {p.category}
                      </span>
                    </div>
                    <div
                      className="ew-serif mt-1"
                      style={{
                        fontSize:  11,
                        fontStyle: "italic",
                        color:     "#9a7e52",
                        lineHeight: 1.35,
                      }}
                    >
                      {p.description}
                    </div>
                  </button>
                );
              })
            )}
          </section>

          <footer
            className="px-6 py-3 text-center"
            style={{ borderTop: "1px solid var(--ui-border-default)" }}
          >
            <button
              type="button"
              onClick={handlePerkConfirm}
              disabled={!perkPick}
              className="rounded-sm px-6 py-2 text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                backgroundColor: "var(--genre-accent)",
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

  // ── P7 — slot unlock step (renders instead of the stat picker) ────────
  if (slotStep) {
    const isAuto = slotStep.slotNum === 2;
    const chosenTmpl = slotPick ? ABILITY_LIBRARY[slotPick] : null;
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Slot ${slotStep.slotNum} unlocked`}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 modal-backdrop-in"
      >
        <div
          // UI-fix-A — was font-mono; the modal is mostly UI chrome
          // + serif title, so inherit from body sans (Inter Tight)
          // and let inner ew-serif/ew-mono override per element.
          className="ew-sans w-full max-w-md rounded-sm shadow-2xl modal-card-in"
          style={{
            backgroundColor: levelUpBg,
            border:          "1px solid var(--genre-accent)",
            color:           "var(--ui-text-1)",
          }}
        >
          <header
            className="px-6 pt-5 pb-3 text-center"
            style={{ borderBottom: "1px solid var(--ui-border-default)" }}
          >
            <div
              className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: "var(--genre-accent)" }}
            >
              Ability Slot Unlocked
            </div>
            <div
              className="mt-1 text-2xl font-bold ew-serif"
              style={{ color: "var(--genre-accent)", fontStyle: "italic" }}
            >
              Slot {slotStep.slotNum}
            </div>
          </header>

          <section className="px-6 pt-4 pb-4">
            {isAuto ? (
              chosenTmpl ? (
                <>
                  <div className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--ui-text-muted)" }}>
                    A new ability slot has opened. Slot 2 is filled from the abilities you already know.
                  </div>
                  <div
                    className="mt-3 p-3 rounded-sm"
                    style={{
                      background: "color-mix(in srgb, var(--genre-accent) 12%, transparent)",
                      border:     "1px solid var(--genre-accent)",
                    }}
                  >
                    <div className="ew-serif text-base" style={{ fontStyle: "italic", color: "var(--genre-accent)" }}>
                      {chosenTmpl.base_name}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: "var(--ui-text-1)" }}>
                      {chosenTmpl.description}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-xs italic" style={{ color: "var(--ui-text-muted)" }}>
                  No slot-2 candidate found in your learned pool. Visit Attunement to slot one manually.
                </div>
              )
            ) : (
              <>
                <div className="mb-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--ui-text-muted)" }}>
                  A new ability slot has opened. Choose one to equip — the others join your learned pool.
                </div>
                <div className="flex flex-col gap-2">
                  {slotStep.candidates.map((c) => {
                    const isSelected = slotPick === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSlotPick(c.id)}
                        className="text-left p-3 rounded-sm transition-colors"
                        style={{
                          background: isSelected
                            ? "color-mix(in srgb, var(--genre-accent) 18%, transparent)"
                            : "color-mix(in srgb, var(--genre-accent) 8%, transparent)",
                          border: `1px solid ${isSelected ? "var(--genre-accent)" : "var(--ui-border-default)"}`,
                          color:  "var(--ui-text-1)",
                          cursor: "pointer",
                        }}
                      >
                        <div className="ew-serif text-sm" style={{ fontStyle: "italic", color: isSelected ? "var(--genre-accent)" : "var(--ui-text-1)" }}>
                          {c.base_name}
                          <span className="ml-2 text-[10px] uppercase tracking-wider" style={{ color: "var(--ui-text-muted)" }}>
                            {c.category}
                          </span>
                        </div>
                        <div className="mt-1 text-xs" style={{ color: "var(--ui-text-muted)" }}>
                          {c.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <footer
            className="px-6 py-3 text-center"
            style={{ borderTop: "1px solid var(--ui-border-default)" }}
          >
            <button
              type="button"
              onClick={handleSlotConfirm}
              disabled={!slotPick}
              className="rounded-sm px-6 py-2 text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                backgroundColor: "var(--genre-accent)",
                color:           "#0a0a0a",
              }}
            >
              {isAuto ? "Continue" : "Equip"}
            </button>
          </footer>
        </div>
      </div>
    );
  }

  // Stat step — original level-up flow. Bails when result hasn't resolved
  // (shouldn't normally happen but defensive).
  if (!result) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Level up to ${result.new_level}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 modal-backdrop-in"
      // No backdrop dismiss — modal is gameplay state, not chrome.
    >
      {/* PR-10v — pulsing glow keyframe scoped to this modal instance. */}
      <style>{`
        @keyframes lu-pulse {
          0%, 100% { opacity: 0.15; transform: translate(-50%, -50%) scale(1); }
          50%       { opacity: 0.35; transform: translate(-50%, -50%) scale(1.15); }
        }
      `}</style>
      <div
        className="ew-sans w-full max-w-md rounded-sm shadow-2xl modal-card-in"
        style={{
          backgroundColor: levelUpBg,
          border:          "1px solid var(--genre-accent)",
          color:           "var(--ui-text-1)",
        }}
      >
        {/* Header */}
        <header
          className="px-6 pt-5 pb-3 text-center relative overflow-hidden"
          style={{ borderBottom: "1px solid var(--ui-border-default)" }}
        >
          {/* PR-10v — pulsing radial glow behind the Level Up title. */}
          <div
            aria-hidden="true"
            style={{
              position:      "absolute",
              top:           "50%",
              left:          "50%",
              width:         200,
              height:        80,
              borderRadius:  "50%",
              background:    "var(--genre-accent)",
              filter:        "blur(24px)",
              animation:     "lu-pulse 2s ease-in-out infinite",
              pointerEvents: "none",
              zIndex:        0,
            }}
          />
          <div
            className="text-[10px] font-bold tracking-widest uppercase relative"
            style={{ color: "var(--genre-accent)", zIndex: 1 }}
          >
            Level Up
          </div>
          <div
            className="mt-1 text-3xl font-bold font-mono relative"
            style={{ color: "var(--genre-accent)", zIndex: 1 }}
          >
            Level {result.new_level}
          </div>
        </header>

        {/* Auto gains — PR-10v HF1. Side-by-side OLD → NEW cards.
            Primary + secondary share the top row (or one card alone
            if they collapse to the same stat); HP centred below. */}
        <section className="px-6 pt-4 pb-3">
          <div
            className="mb-2 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--ui-text-muted)" }}
          >
            Auto Gains
          </div>
          {(() => {
            const statGains: Array<{
              key:   keyof Attributes;
              label: string;
              from:  number;
              to:    number;
            }> = [];
            const primaryFrom = stats[result.primary_stat];
            statGains.push({
              key:   result.primary_stat,
              label: STAT_SHORT[result.primary_stat],
              from:  primaryFrom,
              to:    primaryFrom + 1,
            });
            if (result.secondary_stat !== result.primary_stat) {
              const secFrom = stats[result.secondary_stat];
              statGains.push({
                key:   result.secondary_stat,
                label: STAT_SHORT[result.secondary_stat],
                from:  secFrom,
                to:    secFrom + 1,
              });
            }

            const cardStyle: React.CSSProperties = {
              background:   "color-mix(in srgb, var(--genre-accent) 8%, transparent)",
              border:       "1px solid color-mix(in srgb, var(--genre-accent) 30%, transparent)",
              borderRadius: 8,
            };

            const renderCard = (
              label: string,
              from: number | string,
              to:   number | string,
              key?: string,
            ) => (
              <div
                key={key}
                className="py-2 px-4 text-center"
                style={cardStyle}
              >
                <div
                  className="text-[10px] font-bold tracking-wide uppercase"
                  style={{ color: "var(--ui-text-muted)" }}
                >
                  {label}
                </div>
                <div className="mt-0.5 text-sm font-mono">
                  <span style={{ color: "var(--ui-text-1)" }}>{from}</span>
                  <span
                    className="mx-1.5"
                    style={{ color: "var(--genre-accent)" }}
                  >
                    →
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: "var(--genre-accent)" }}
                  >
                    {to}
                  </span>
                </div>
              </div>
            );

            return (
              <>
                <div
                  className={`grid gap-2 ${statGains.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}
                >
                  {statGains.map((g) => renderCard(g.label, g.from, g.to, g.key))}
                </div>
                <div className="mt-2 grid grid-cols-1">
                  {renderCard("HP", player.max_health, player.max_health + result.hp_gained, "hp")}
                </div>
              </>
            );
          })()}
        </section>

        {/* Free point picker */}
        <section
          className="px-6 pt-3 pb-4"
          style={{ borderTop: "1px solid var(--ui-border-default)" }}
        >
          <div
            className="mb-2 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--ui-text-muted)" }}
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
                      ? "color-mix(in srgb, var(--genre-accent) 25%, transparent)"
                      : "color-mix(in srgb, var(--genre-accent) 8%, transparent)",
                    border: `1px solid ${
                      isSelected
                        ? "var(--genre-accent)"
                        : "color-mix(in srgb, var(--genre-accent) 30%, transparent)"
                    }`,
                    color: isSelected ? "var(--genre-accent)" : "var(--ui-text-1)",
                  }}
                >
                  <span className="text-[10px] font-bold tracking-wide">
                    {STAT_SHORT[s]}
                  </span>
                  <span className="mt-0.5 text-sm font-bold font-mono">
                    {isSelected ? postAuto + 1 : postAuto}
                  </span>
                  {isCapped && (
                    <span
                      className="mt-0.5 text-[9px] italic"
                      style={{ color: "var(--ui-text-muted)" }}
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
          style={{ borderTop: "1px solid var(--ui-border-default)" }}
        >
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!freeStat}
            className="rounded-sm px-6 py-2 text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              backgroundColor: "var(--genre-accent)",
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
