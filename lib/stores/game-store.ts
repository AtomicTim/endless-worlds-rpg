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
  /** FIX 6 — last dialogue options + npc key, kept around so the
   *  Dialogue Modal can be restored after the Trade Modal closes.
   *  setDialogueOptions writes these whenever it stores fresh options;
   *  setTradeItems([]) reads them to put the dialogue back if the
   *  player walked into trade mid-conversation. */
  lastDialogueOptions:    DialogueOption[];
  lastDialogueNpc:        string | null;
  lastDialogueNpcKey:     string | null;
  lastDialoguePortrait:   string | null;

  // ── Trade Modal ────────────────────────────────────────────────────────────
  /** Items the current merchant has on offer. Set by step 7 of useGameLoop
   *  whenever the narrator emits items_for_sale. The TradeModal renders only
   *  while this array is non-empty. */
  currentTradeItems:      Item[];

  // ── Day 18 — Verbosity ─────────────────────────────────────────────────────
  /** Narrator response-length preference. Hydrated from localStorage on
   *  store initialisation; setVerbosity() persists it back. */
  verbosity:              "terse" | "standard" | "rich";

  // ── Day 19F — Map panel ────────────────────────────────────────────────────
  /** Whether the three-tier WorldMap sidebar panel is currently open. */
  mapPanelOpen:           boolean;

  // ── FIX (UX Round 4) — Trade panel ─────────────────────────────────────────
  /** True when the player has explicitly requested the trade panel via
   *  the merchant trade button. Independent of currentTradeItems so the
   *  merchant button can be rendered "active" even before the narrator's
   *  items_for_sale arrives. Cleared whenever setTradeItems([]) runs OR
   *  the player switches to a different NPC. */
  tradeOpen:              boolean;

  // ── FIX 7 — Examined objects cache ─────────────────────────────────────────
  /** Set of object keys (canonical landmark name lowercased) the player
   *  has already examined this session. Repeat examines short-circuit
   *  to a canned "nothing new" response so the narrator isn't paid to
   *  re-describe the same Tier 1 object turn after turn. Cleared on
   *  session switch via clearSessionState. */
  examinedObjects:        string[];

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
  /** Replace the merchant's items_for_sale list. Pass [] to close the
   *  Trade Modal entirely. */
  setTradeItems:           (items: Item[]) => void;
  /** FIX (UX 4) — open the trade panel without going through the
   *  narrator. The merchant trade button uses this so the click never
   *  pays for an AI call or fires a stat check. */
  openTradePanel:          () => void;
  /** Narrator response-length toggle. Persists to localStorage. */
  setVerbosity:            (v: "terse" | "standard" | "rich") => void;
  /** Toggle the WorldMap sidebar panel open/closed. */
  toggleMapPanel:          () => void;
  /** Imperatively set the map panel state — used by the layout's mobile
   *  backdrop and ESC handler. */
  setMapPanelOpen:         (open: boolean) => void;
  /** FIX 7 — record that the player examined a Tier 1 object so the
   *  next EXAMINE on the same target short-circuits to a canned
   *  response. Key should be the canonical landmark name (lowercased). */
  markObjectExamined:      (objectKey: string) => void;
  /** FIX 7 — has the player already examined this object this session? */
  hasExaminedObject:       (objectKey: string) => boolean;
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

export const useGameStore = create<GameStore>((set, get) => ({
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
  lastDialogueOptions:    [],
  lastDialogueNpc:        null,
  lastDialogueNpcKey:     null,
  lastDialoguePortrait:   null,
  currentTradeItems:      [],
  verbosity:              loadVerbosity(),
  mapPanelOpen:           false,
  tradeOpen:              false,
  examinedObjects:        [],

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
      // FIX 6 — keep a snapshot so the modal can be restored after the
      // Trade Modal closes. Mirrors the active fields exactly.
      lastDialogueOptions:    options,
      lastDialogueNpc:        npcName,
      lastDialogueNpcKey:     npcKey ?? null,
      lastDialoguePortrait:   portrait,
    }),
  clearDialogueOptions: () =>
    set({
      currentDialogueOptions: [],
      currentDialogueNpc:     null,
      currentDialogueNpcKey:  null,
      currentNpcPortrait:     null,
      // FIX 6 — also clear the cached snapshot. clearDialogueOptions is
      // called when the player walks away or the active NPC leaves the
      // node — both cases where the dialogue is genuinely over and we
      // shouldn't restore it after a trade closes.
      lastDialogueOptions:    [],
      lastDialogueNpc:        null,
      lastDialogueNpcKey:     null,
      lastDialoguePortrait:   null,
    }),
  // FIX 6 — opening the Trade Modal hides the Dialogue Modal so the two
  // never overlap. Closing the Trade Modal restores the cached dialogue
  // for the same NPC, so the player goes back to the conversation they
  // were in mid-merchant interaction without losing context.
  // FIX (UX 4) — every items=[] path also clears tradeOpen so the
  // merchant trade button reverts to inactive once the panel closes;
  // every items.length>0 path sets tradeOpen=true so a narrator-driven
  // items_for_sale opens the panel by the same flag the button uses.
  setTradeItems: (items) =>
    set((s) => {
      if (items.length > 0) {
        return {
          currentTradeItems:      items,
          tradeOpen:              true,
          currentDialogueOptions: [],
          currentDialogueNpc:     null,
          currentDialogueNpcKey:  null,
          currentNpcPortrait:     null,
        };
      }
      // items === [] → trade closed. Restore dialogue if we cached one.
      if (s.lastDialogueNpc && s.lastDialogueOptions.length > 0) {
        return {
          currentTradeItems:      [],
          tradeOpen:              false,
          currentDialogueOptions: s.lastDialogueOptions,
          currentDialogueNpc:     s.lastDialogueNpc,
          currentDialogueNpcKey:  s.lastDialogueNpcKey,
          currentNpcPortrait:     s.lastDialoguePortrait,
        };
      }
      return { currentTradeItems: [], tradeOpen: false };
    }),
  // FIX (UX 4) — open the trade panel without an AI call. The merchant
  // trade button calls this directly. Trade is always available for
  // merchants — trust affects price (buy/sell math), never access.
  openTradePanel: () => set({ tradeOpen: true }),
  setVerbosity: (v) => {
    saveVerbosity(v);
    set({ verbosity: v });
  },
  toggleMapPanel:  () => set((s) => ({ mapPanelOpen: !s.mapPanelOpen })),
  setMapPanelOpen: (open) => set({ mapPanelOpen: open }),
  markObjectExamined: (objectKey) =>
    set((s) => {
      const key = objectKey.trim().toLowerCase();
      if (!key || s.examinedObjects.includes(key)) return s;
      return { examinedObjects: [...s.examinedObjects, key] };
    }),
  hasExaminedObject: (objectKey) => {
    const key = objectKey.trim().toLowerCase();
    return get().examinedObjects.includes(key);
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
      lastDialogueOptions:    [],
      lastDialogueNpc:        null,
      lastDialogueNpcKey:     null,
      lastDialoguePortrait:   null,
      currentTradeItems:      [],
      tradeOpen:              false,
      locationAssets:         [],
      lastNarrativeText:      null,
      mapPanelOpen:           false,
      examinedObjects:        [],
    });
  },
  clearTransientState: () =>
    set({
      lastNarrativeText: null,
    }),
}));
