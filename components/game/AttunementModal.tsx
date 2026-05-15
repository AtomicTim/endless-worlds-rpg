"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/lib/stores/game-store";
import {
  ABILITY_LIBRARY,
  getUnlockedSlotCount,
  isSlotUnlocked,
} from "@/lib/game/abilities";
import type { AbilityId } from "@/types/game";

/**
 * P7 — Attunement modal.
 *
 * Opens when:
 *   • restCompleteSignal increments (Inn Rest completes; rule 156).
 *   • The settlement-arrival Attune button is tapped.
 *
 * Locked during combat (rule 166) — guarded with combat?.active.
 *
 * Layout: 4 equipped slot rows above the learned-pool list. Slot 1 is
 * the class ability and is read-only ("Class ability — cannot be
 * changed"). Slots 2-4 expose a "Swap" affordance when unlocked;
 * tapping Swap arms a pool ability tap to slot into that position.
 * Passive sits below as read-only ("Passive: <name>"). Changes commit
 * on Done (or backdrop tap — same semantics).
 */

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function AttunementModal({ open, onClose }: Props) {
  const masterState  = useGameStore((s) => s.masterState);
  const setMasterState = useGameStore((s) => s.setMasterState);
  const player       = masterState?.player_state;
  const combatActive = masterState?.combat?.active === true;

  // Locked during combat — bail without ever rendering an overlay.
  const isOpen = open && !!player && !combatActive;

  // Draft loadout — committed on Done. Reset every time the modal opens
  // so closing without Done is a no-op (Done and backdrop both commit;
  // the only "discard" path is ESC, which is intentionally not bound).
  const [draftSlots, setDraftSlots] = useState<Array<AbilityId | null>>(
    player?.equipped_ability_slots
      ? [...player.equipped_ability_slots]
      : [null, null, null, null]
  );
  const [armedSlotIdx, setArmedSlotIdx] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && player?.equipped_ability_slots) {
      setDraftSlots([...player.equipped_ability_slots]);
      setArmedSlotIdx(null);
    }
  }, [isOpen, player?.equipped_ability_slots]);

  // Pool: learned_abilities that are not the passive and not currently
  // in the DRAFT loadout (so the same ability isn't shown as available
  // for two slots at once during the swap dance).
  const pool = useMemo(() => {
    if (!player) return [];
    const exclude = new Set<AbilityId>([
      ...(player.passive_ability ? [player.passive_ability] : []),
      ...draftSlots.filter((s): s is AbilityId => !!s),
    ]);
    return player.learned_abilities
      .filter((id) => !exclude.has(id))
      .map((id) => ABILITY_LIBRARY[id])
      .filter((t) => !!t);
  }, [player, draftSlots]);

  if (!isOpen || !player) return null;

  const unlockedCount = getUnlockedSlotCount(player.level);
  const passiveTmpl   = player.passive_ability ? ABILITY_LIBRARY[player.passive_ability] : null;

  const handleSlotSwapClick = (slotIdx: 1 | 2 | 3) => {
    setArmedSlotIdx((current) => (current === slotIdx ? null : slotIdx));
  };

  const handlePoolTap = (abilityId: AbilityId) => {
    if (armedSlotIdx === null) return;
    const next = [...draftSlots] as Array<AbilityId | null>;
    next[armedSlotIdx] = abilityId;
    setDraftSlots(next);
    setArmedSlotIdx(null);
  };

  const handleClearSlot = (slotIdx: 1 | 2 | 3) => {
    const next = [...draftSlots] as Array<AbilityId | null>;
    next[slotIdx] = null;
    setDraftSlots(next);
    setArmedSlotIdx(null);
  };

  const commitAndClose = () => {
    if (!masterState) { onClose(); return; }
    // Length-4 tuple type contract is preserved by clamping the draft
    // before commit.
    const finalSlots: [AbilityId | null, AbilityId | null, AbilityId | null, AbilityId | null] = [
      draftSlots[0] ?? null,
      draftSlots[1] ?? null,
      draftSlots[2] ?? null,
      draftSlots[3] ?? null,
    ];
    setMasterState({
      ...masterState,
      player_state: {
        ...player,
        equipped_ability_slots: finalSlots,
      },
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Attunement"
      onClick={commitAndClose}
      // UI-11 — shared modal entry animation (design ref §14).
      className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop-in"
      style={{ background: "rgba(0,0,0,0.82)", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card-in"
        style={{
          width:           "100%",
          maxWidth:        540,
          maxHeight:       "85vh",
          overflow:        "auto",
          background:      "var(--color-bg, var(--bg-1))",
          color:           "var(--color-text, var(--ink-1))",
          border:          "1px solid var(--accent)",
          borderRadius:    4,
          padding:         "18px 18px 14px",
          fontFamily:      "var(--mono)",
        }}
      >
        <header style={{ textAlign: "center", marginBottom: 12 }}>
          <div
            className="ew-serif"
            style={{
              fontSize:  20,
              fontStyle: "italic",
              color:     "var(--accent)",
            }}
          >
            Attunement
          </div>
          <div
            style={{
              fontSize:      9,
              letterSpacing: "0.24em",
              color:         "var(--ink-3)",
              textTransform: "uppercase",
              marginTop:     2,
            }}
          >
            Re-slot your abilities
          </div>
        </header>

        {/* ── Equipped slots ───────────────────────────────────────────── */}
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {([0, 1, 2, 3] as const).map((slotIdx) => {
            const slotNum  = (slotIdx + 1) as 1 | 2 | 3 | 4;
            const isSlot1  = slotIdx === 0;
            const ability  = draftSlots[slotIdx] ? ABILITY_LIBRARY[draftSlots[slotIdx]!] : null;
            const unlocked = isSlotUnlocked(slotNum, player.level);
            const armed    = armedSlotIdx === slotIdx;

            return (
              <div
                key={slotIdx}
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  gap:            10,
                  padding:        "8px 10px",
                  background:     armed
                    ? "color-mix(in srgb, var(--accent) 18%, var(--bg-2))"
                    : "var(--bg-2)",
                  border:         armed
                    ? "1px solid var(--accent)"
                    : "1px solid var(--line-2)",
                  borderRadius:   3,
                  opacity:        unlocked ? 1 : 0.55,
                }}
              >
                <span
                  style={{
                    fontSize:      9,
                    letterSpacing: "0.18em",
                    color:         "var(--ink-3)",
                    textTransform: "uppercase",
                    minWidth:      48,
                  }}
                >
                  Slot {slotNum}
                </span>
                <span
                  className="ew-serif"
                  style={{
                    flex:      1,
                    fontSize:  13,
                    fontStyle: "italic",
                    color:     ability ? "var(--ink-1)" : "var(--ink-4)",
                  }}
                >
                  {!unlocked
                    ? `— Unlocks at level ${slotNum === 2 ? 5 : slotNum === 3 ? 10 : 15}`
                    : ability
                      ? ability.base_name
                      : "— empty"}
                </span>
                {isSlot1 ? (
                  <span
                    style={{
                      fontSize: 10,
                      color:    "var(--ink-4)",
                      fontStyle: "italic",
                    }}
                  >
                    Class ability
                  </span>
                ) : unlocked ? (
                  <>
                    {ability && (
                      <button
                        type="button"
                        onClick={() => handleClearSlot(slotIdx as 1 | 2 | 3)}
                        style={{
                          padding:      "3px 8px",
                          fontSize:     9,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          background:    "transparent",
                          border:        "1px solid var(--line-2)",
                          color:         "var(--ink-3)",
                          borderRadius:  3,
                          cursor:        "pointer",
                        }}
                      >
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSlotSwapClick(slotIdx as 1 | 2 | 3)}
                      style={{
                        padding:       "3px 10px",
                        fontSize:      9,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        background:    armed ? "var(--accent)" : "transparent",
                        border:        "1px solid var(--accent)",
                        color:         armed ? "var(--bg-1)" : "var(--accent)",
                        borderRadius:  3,
                        cursor:        "pointer",
                      }}
                    >
                      {armed ? "Pick…" : "Swap"}
                    </button>
                  </>
                ) : null}
              </div>
            );
          })}
        </section>

        {/* ── Pool ─────────────────────────────────────────────────────── */}
        <section style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize:      9,
              letterSpacing: "0.24em",
              color:         "var(--ink-3)",
              textTransform: "uppercase",
              marginBottom:  6,
            }}
          >
            Learned pool {armedSlotIdx !== null && <span style={{ color: "var(--accent)" }}>— pick one</span>}
          </div>
          {pool.length === 0 ? (
            <div
              style={{
                fontSize:  11,
                fontStyle: "italic",
                color:     "var(--ink-4)",
                padding:   "8px 4px",
              }}
            >
              No unequipped abilities — every learned ability is currently in a slot.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {pool.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handlePoolTap(t.id)}
                  disabled={armedSlotIdx === null}
                  style={{
                    textAlign:     "left",
                    padding:       "8px 10px",
                    background:    "var(--bg-2)",
                    border:        armedSlotIdx === null
                      ? "1px solid var(--line-2)"
                      : "1px solid var(--accent)",
                    borderRadius:  3,
                    color:         "var(--ink-1)",
                    cursor:        armedSlotIdx === null ? "default" : "pointer",
                    opacity:       armedSlotIdx === null ? 0.7 : 1,
                  }}
                >
                  <div
                    className="ew-serif"
                    style={{ fontSize: 13, fontStyle: "italic" }}
                  >
                    {t.base_name}
                    <span
                      style={{
                        marginLeft:    8,
                        fontSize:      9,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color:         "var(--ink-4)",
                      }}
                    >
                      {t.category}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
                    {t.description}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── Passive (read-only) ──────────────────────────────────────── */}
        {passiveTmpl && (
          <section
            style={{
              marginTop:   16,
              padding:     "8px 10px",
              background:  "transparent",
              border:      "1px dashed var(--line-2)",
              borderRadius: 3,
            }}
          >
            <span
              style={{
                fontSize:      9,
                letterSpacing: "0.18em",
                color:         "var(--ink-3)",
                textTransform: "uppercase",
                marginRight:   6,
              }}
            >
              Passive
            </span>
            <span
              className="ew-serif"
              style={{ fontSize: 12, fontStyle: "italic", color: "var(--ink-1)" }}
            >
              {passiveTmpl.base_name}
            </span>
            <span
              style={{
                fontSize:  10,
                color:     "var(--ink-4)",
                marginLeft: 8,
              }}
            >
              — always active
            </span>
          </section>
        )}

        {/* ── Done ─────────────────────────────────────────────────────── */}
        <footer
          style={{
            marginTop:  16,
            textAlign:  "right",
            borderTop:  "1px solid var(--line)",
            paddingTop: 10,
            fontSize:   10,
            color:      "var(--ink-3)",
          }}
        >
          <span style={{ marginRight: 12 }}>
            Unlocked: {unlockedCount} / 4 slots
          </span>
          <button
            type="button"
            onClick={commitAndClose}
            style={{
              padding:       "6px 16px",
              fontSize:      11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              background:    "var(--accent)",
              border:        "1px solid var(--accent)",
              color:         "#0a0a0a",
              borderRadius:  3,
              cursor:        "pointer",
              fontWeight:    700,
            }}
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
