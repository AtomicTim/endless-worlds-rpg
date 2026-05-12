"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { DungeonRoom } from "@/types/game";

/**
 * Day 23A part 2 — locked-room interaction popover.
 *
 * Renders when the player clicks a locked nav card inside a dungeon.
 * Shows the lock hint + up to three actions:
 *   • USE {key_item_name}  — visible when the player holds the key
 *   • TRY TO FORCE IT (STR N) — visible when the player meets the
 *     STR threshold; bypasses the key
 *   • CLOSE — dismisses the popover without action
 *
 * Pattern mirrors InteractionPopover (poi click): backdrop click +
 * ESC close, fixed centred card, deliberately blocks the underlying
 * nav bar so a stray click during decision-making doesn't dismiss.
 *
 * Pure presentation. Game-state mutation lives in useDungeonRuntime's
 * useKeyOnRoom / forceUnlockRoom callbacks — the parent passes them
 * in via onUseKey / onForce so the popover stays testable in isolation.
 */
interface Props {
  /** Locked room being interacted with. */
  room:           DungeonRoom;
  /** Key item display name when the player holds the key, else null. */
  keyItemName:    string | null;
  /** True when the player meets the STR bypass threshold. */
  canForce:       boolean;
  /** Threshold value, shown on the button label ("TRY TO FORCE IT — STR 6"). */
  strThreshold:   number;
  onUseKey:       () => void;
  onForce:        () => void;
  onClose:        () => void;
}

export function DungeonLockPopover({
  room, keyItemName, canForce, strThreshold,
  onUseKey, onForce, onClose,
}: Props) {
  // ESC closes the popover. Use document-level listener so the
  // backdrop click handler doesn't have to fight focus management.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Dark backdrop — click to dismiss. */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.55)" }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={`${room.name} — locked`}
        className="fixed left-1/2 top-1/2 z-50 w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-md border p-4 shadow-2xl"
        style={{
          backgroundColor: "var(--color-bg)",
          borderColor:     "var(--hl-dungeon)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-2 rounded-sm p-1 transition-colors hover:bg-white/10"
          style={{ color: "var(--color-muted)" }}
        >
          <X className="size-3" />
        </button>

        {/* Header — room name + locked tag */}
        <div className="pr-5">
          <div
            className="mb-0.5 text-[9px] font-bold uppercase tracking-widest"
            style={{ color: "var(--hl-dungeon)" }}
          >
            Locked
          </div>
          <div
            className="text-sm font-bold"
            style={{ color: "var(--hl-dungeon)" }}
          >
            {room.name}
          </div>
        </div>

        {/* Lock hint — the AI-authored description of the sealed door */}
        {room.lock?.hint && (
          <p
            className="mt-2 text-[12px] italic leading-snug"
            style={{ color: "var(--color-text)" }}
          >
            {room.lock.hint}
          </p>
        )}

        {/* Actions */}
        <div className="mt-3 flex flex-col gap-1.5">
          {keyItemName && (
            <button
              type="button"
              onClick={() => { onUseKey(); onClose(); }}
              className="rounded-sm px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "color-mix(in srgb, var(--hl-dungeon) 22%, transparent)",
                border:          "1px solid var(--hl-dungeon)",
                color:           "var(--hl-dungeon)",
              }}
            >
              Use {keyItemName}
            </button>
          )}
          {canForce && (
            <button
              type="button"
              onClick={() => { onForce(); onClose(); }}
              className="rounded-sm px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "color-mix(in srgb, var(--hl-dungeon) 12%, transparent)",
                border:          "1px solid color-mix(in srgb, var(--hl-dungeon) 50%, transparent)",
                color:           "var(--hl-dungeon)",
              }}
            >
              Try to Force It — STR {strThreshold}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-opacity hover:opacity-80"
            style={{
              border: "1px solid var(--color-muted)",
              color:  "var(--color-muted)",
            }}
          >
            Close
          </button>
        </div>

        {/* Divider + help text */}
        <div
          className="mt-3 border-t pt-2 text-center text-[10px] italic"
          style={{ borderColor: "var(--color-border)", color: "var(--color-muted)" }}
        >
          {keyItemName
            ? "The key matches this lock."
            : canForce
              ? "Strength may suffice — at a cost."
              : "Find the key. Or grow stronger."}
        </div>
      </div>
    </>
  );
}
