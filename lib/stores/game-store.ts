import { create } from "zustand";
import type { MasterState, WorldAsset, LogEntry, DialogueOption, Item } from "@/types/game";

// ── Message types ─────────────────────────────────────────────────────────────

export type MessageType =
  | "NARRATIVE"
  | "SYSTEM"
  | "COMBAT"
  | "DIALOGUE"
  | "ASCII_ART"
  | "LORE";

export interface StoryMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export function makeMessage(
  type: MessageType,
  content: string,
  metadata?: Record<string, unknown>
): StoryMessage {
  return {
    id:        crypto.randomUUID(),
    type,
    content,
    timestamp: new Date(),
    metadata,
  };
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface GameStore {
  masterState:       MasterState | null;
  messages:          StoryMessage[];
  isProcessing:      boolean;
  processingStep:    string | null;
  lastNarrativeText: string | null;
  locationAssets:    WorldAsset[];

  // ── Dialogue Modal ─────────────────────────────────────────────────────────
  currentDialogueOptions: DialogueOption[];
  currentDialogueNpc:     string | null;
  /** npc_registry key for the active NPC — authoritative source for trust/disposition. */
  currentDialogueNpcKey:  string | null;
  currentNpcPortrait:     string | null;
  dialogueModalCollapsed: boolean;

  // ── Trade Modal ────────────────────────────────────────────────────────────
  /** Items the current merchant has on offer. Set by step 7 of useGameLoop
   *  whenever the narrator emits items_for_sale. The TradeModal renders only
   *  while this array is non-empty. */
  currentTradeItems:      Item[];

  // ── Day 18 — Verbosity ─────────────────────────────────────────────────────
  /** Narrator response-length preference. Hydrated from localStorage on
   *  store initialisation; setVerbosity() persists it back. */
  verbosity:              "terse" | "standard" | "rich";

  setMasterState:          (state: MasterState) => void;
  addMessage:              (message: StoryMessage) => void;
  setProcessing:           (isProcessing: boolean, step?: string) => void;
  clearMessages:           () => void;
  setLastNarrativeText:    (text: string) => void;
  setLocationAssets:       (assets: WorldAsset[]) => void;
  /** Update the npcName metadata on any DIALOGUE messages that still carry an old placeholder name. */
  updateMessagesNpcName:   (oldName: string, newName: string) => void;
  /** Append a single log entry; keeps the newest 100. */
  addPersistedLogEntry:    (entry: LogEntry) => void;
  /** Merge DB-loaded entries into the in-memory log without overwriting existing ones. */
  mergePersistedLogEntries:(entries: LogEntry[]) => void;
  /** Show the Dialogue Modal with the given options, NPC name, portrait, and npc_registry key. */
  setDialogueOptions:      (options: DialogueOption[], npcName: string | null, portrait: string | null, npcKey?: string | null) => void;
  /** Hide the Dialogue Modal and clear all dialogue state. */
  clearDialogueOptions:    () => void;
  /** Toggle the modal between full and collapsed views without clearing options. */
  setDialogueModalCollapsed: (collapsed: boolean) => void;
  /** Replace the merchant's items_for_sale list. Pass [] to close the
   *  Trade Modal entirely. */
  setTradeItems:           (items: Item[]) => void;
  /** Narrator response-length toggle. Persists to localStorage. */
  setVerbosity:            (v: "terse" | "standard" | "rich") => void;
  /** Wipe all per-session state so a fresh session loads with a clean slate.
   *  Does NOT clear masterState — that is replaced by the caller right after.
   *  Use ONLY when switching to a different save slot. */
  clearSessionState:       () => void;
  /** Lightweight reset for SPA navigation back to the same session. Clears
   *  lastNarrativeText only — PRESERVES dialogue modal state, log entries,
   *  location assets, and messages so navigating back doesn't wipe them. */
  clearTransientState:     () => void;

  persistedLogEntries: LogEntry[];
}

// ── Day 18 — verbosity persistence (SSR-safe: typeof window check) ───────────
const VERBOSITY_KEY = "rpg-verbosity";
function loadVerbosity(): "terse" | "standard" | "rich" {
  if (typeof window === "undefined") return "standard";
  const raw = window.localStorage.getItem(VERBOSITY_KEY);
  return raw === "terse" || raw === "rich" ? raw : "standard";
}
function saveVerbosity(v: "terse" | "standard" | "rich"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VERBOSITY_KEY, v);
  } catch {
    // localStorage may be disabled — silently fall back to in-memory only.
  }
}

export const useGameStore = create<GameStore>((set) => ({
  masterState:            null,
  messages:               [],
  isProcessing:           false,
  processingStep:         null,
  lastNarrativeText:      null,
  locationAssets:         [],
  persistedLogEntries:    [],
  currentDialogueOptions: [],
  currentDialogueNpc:     null,
  currentDialogueNpcKey:  null,
  currentNpcPortrait:     null,
  dialogueModalCollapsed: false,
  currentTradeItems:      [],
  verbosity:              loadVerbosity(),

  setMasterState:       (state) => set({ masterState: state }),
  addMessage:           (message) => set((s) => ({ messages: [...s.messages, message] })),
  setProcessing:        (isProcessing, step) =>
    set({ isProcessing, processingStep: isProcessing ? step ?? null : null }),
  clearMessages:        () => set({ messages: [] }),
  setLastNarrativeText: (text) => set({ lastNarrativeText: text }),
  setLocationAssets:    (assets) => set({ locationAssets: assets }),
  updateMessagesNpcName: (oldName, newName) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.type === "DIALOGUE" &&
        typeof m.metadata?.npcName === "string" &&
        m.metadata.npcName.toLowerCase() === oldName.toLowerCase()
          ? { ...m, metadata: { ...m.metadata, npcName: newName } }
          : m
      ),
    })),
  addPersistedLogEntry: (entry) =>
    set((s) => ({
      persistedLogEntries: [...s.persistedLogEntries, entry].slice(-100),
    })),
  mergePersistedLogEntries: (entries) =>
    set((s) => {
      const existingIds = new Set(s.persistedLogEntries.map((e) => e.id));
      const newOnes     = entries.filter((e) => !existingIds.has(e.id));
      if (newOnes.length === 0) return s;
      // DB entries arrive newest-first (addLogEntry prepends). Reverse so
      // persistedLogEntries stays oldest-first (same order addPersistedLogEntry uses).
      const chronological = [...newOnes].reverse();
      return {
        persistedLogEntries: [...chronological, ...s.persistedLogEntries].slice(-100),
      };
    }),
  setDialogueOptions: (options, npcName, portrait, npcKey) =>
    set({
      currentDialogueOptions: options,
      currentDialogueNpc:     npcName,
      currentDialogueNpcKey:  npcKey ?? null,
      currentNpcPortrait:     portrait,
      // New options always re-expand the modal so the player sees them.
      dialogueModalCollapsed: false,
    }),
  clearDialogueOptions: () =>
    set({
      currentDialogueOptions: [],
      currentDialogueNpc:     null,
      currentDialogueNpcKey:  null,
      currentNpcPortrait:     null,
      dialogueModalCollapsed: false,
    }),
  setDialogueModalCollapsed: (collapsed) =>
    set({ dialogueModalCollapsed: collapsed }),
  setTradeItems: (items) => set({ currentTradeItems: items }),
  setVerbosity: (v) => {
    saveVerbosity(v);
    set({ verbosity: v });
  },
  clearSessionState: () => {
    // Day 19D — drop any cached regional bibles so a switch between save
    // slots never serves stale region data to a fresh campaign.
    void import("@/lib/game/regional-bible-cache").then(
      (m) => m.invalidateRegionalBibleCache()
    );
    set({
      persistedLogEntries:    [],
      currentDialogueOptions: [],
      currentDialogueNpc:     null,
      currentDialogueNpcKey:  null,
      currentNpcPortrait:     null,
      dialogueModalCollapsed: false,
      currentTradeItems:      [],
      locationAssets:         [],
      lastNarrativeText:      null,
    });
  },
  clearTransientState: () =>
    set({
      lastNarrativeText: null,
    }),
}));
