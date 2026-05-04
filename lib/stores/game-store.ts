import { create } from "zustand";
import type { MasterState, WorldAsset, LogEntry, DialogueOption } from "@/types/game";

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
  currentAsciiArt:   string | null;
  lastNarrativeText: string | null;
  artCache:          Record<string, string>;
  locationAssets:    WorldAsset[];

  // ── Dialogue Modal ─────────────────────────────────────────────────────────
  currentDialogueOptions: DialogueOption[];
  currentDialogueNpc:     string | null;
  currentNpcPortrait:     string | null;

  setMasterState:          (state: MasterState) => void;
  addMessage:              (message: StoryMessage) => void;
  setProcessing:           (isProcessing: boolean, step?: string) => void;
  setAsciiArt:             (art: string | null) => void;
  clearMessages:           () => void;
  setLastNarrativeText:    (text: string) => void;
  setArtCache:             (locationId: string, svg: string) => void;
  setLocationAssets:       (assets: WorldAsset[]) => void;
  /** Update the npcName metadata on any DIALOGUE messages that still carry an old placeholder name. */
  updateMessagesNpcName:   (oldName: string, newName: string) => void;
  /** Append a single log entry; keeps the newest 100. */
  addPersistedLogEntry:    (entry: LogEntry) => void;
  /** Merge DB-loaded entries into the in-memory log without overwriting existing ones. */
  mergePersistedLogEntries:(entries: LogEntry[]) => void;
  /** Show the Dialogue Modal with the given options, NPC name, and portrait (if ready). */
  setDialogueOptions:      (options: DialogueOption[], npcName: string | null, portrait: string | null) => void;
  /** Hide the Dialogue Modal and clear all dialogue state. */
  clearDialogueOptions:    () => void;

  persistedLogEntries: LogEntry[];
}

export const useGameStore = create<GameStore>((set) => ({
  masterState:            null,
  messages:               [],
  isProcessing:           false,
  processingStep:         null,
  currentAsciiArt:        null,
  lastNarrativeText:      null,
  artCache:               {},
  locationAssets:         [],
  persistedLogEntries:    [],
  currentDialogueOptions: [],
  currentDialogueNpc:     null,
  currentNpcPortrait:     null,

  setMasterState:       (state) => set({ masterState: state }),
  addMessage:           (message) => set((s) => ({ messages: [...s.messages, message] })),
  setProcessing:        (isProcessing, step) =>
    set({ isProcessing, processingStep: isProcessing ? step ?? null : null }),
  setAsciiArt:          (art) => set({ currentAsciiArt: art }),
  clearMessages:        () => set({ messages: [] }),
  setLastNarrativeText: (text) => set({ lastNarrativeText: text }),
  setArtCache:          (locationId, svg) =>
    set((s) => ({ artCache: { ...s.artCache, [locationId]: svg } })),
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
  setDialogueOptions: (options, npcName, portrait) =>
    set({ currentDialogueOptions: options, currentDialogueNpc: npcName, currentNpcPortrait: portrait }),
  clearDialogueOptions: () =>
    set({ currentDialogueOptions: [], currentDialogueNpc: null, currentNpcPortrait: null }),
}));
