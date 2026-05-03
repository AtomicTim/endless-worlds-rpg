import type { CodexEntry } from "@/types/game";

/**
 * Persists a codex entry. Currently a stub — logs to the console so the
 * data flow can be verified end-to-end. The real Supabase-backed codex
 * table lands in Day 13.5.
 */
export function saveCodexEntry(entry: CodexEntry): void {
  if (typeof console !== "undefined") {
    console.log("[CODEX]", entry);
  }
}
