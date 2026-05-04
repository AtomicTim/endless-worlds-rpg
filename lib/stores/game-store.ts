import { create } from "zustand";
import type { MasterState, WorldAsset } from "@/types/game";

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
}

export const useGameStore = create<GameStore>((set) => ({
  masterState:       null,
  messages:          [],
  isProcessing:      false,
  processingStep:    null,
  currentAsciiArt:   null,
  lastNarrativeText: null,
  artCache:          {},
  locationAssets:    [],

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
}));
