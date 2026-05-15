/**
 * UI-11 — Toast helper.
 *
 * Non-React entry point for firing toasts. Components that already
 * hold useGameStore can call enqueueToast directly; engine code +
 * server-side modules use this thin wrapper so they don't need a
 * React hook just to fire a notification.
 *
 * The ToastManager component owns rendering + auto-dismiss timing;
 * this helper is purely a queue push.
 */

import { useGameStore } from "@/lib/stores/game-store";
import type { ToastEntry, ToastType } from "@/lib/stores/game-store";

export type { ToastEntry, ToastType };

/** Enqueue a toast. Safe to call from any module (browser or SSR);
 *  the underlying store action is a no-op outside the React tree. */
export function toast(input: { type: ToastType; message: string }): void {
  // Guard against being imported by a server-only context where the
  // Zustand store hasn't been initialized.
  try {
    useGameStore.getState().enqueueToast(input);
  } catch {
    // Best-effort — if the store isn't reachable (e.g. server route
    // calling a shared module), drop the toast silently. The story
    // feed continues to emit its own SYSTEM message in parallel.
  }
}
