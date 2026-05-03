import { create } from "zustand";
import type { MasterState } from "@/types/game";

// ── Message types ─────────────────────────────────────────────────────────────

export type MessageType =
  | "NARRATIVE"
  | "SYSTEM"
  | "COMBAT"
  | "DIALOGUE"
  | "ASCII_ART";

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
  masterState:     MasterState | null;
  messages:        StoryMessage[];
  isProcessing:    boolean;
  processingStep:  string | null;
  currentAsciiArt: string | null;

  setMasterState:  (state: MasterState) => void;
  addMessage:      (message: StoryMessage) => void;
  setProcessing:   (isProcessing: boolean, step?: string) => void;
  setAsciiArt:     (art: string | null) => void;
  clearMessages:   () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  masterState:     null,
  messages:        [],
  isProcessing:    false,
  processingStep:  null,
  currentAsciiArt: null,

  setMasterState: (state) => set({ masterState: state }),
  addMessage:     (message) => set((s) => ({ messages: [...s.messages, message] })),
  setProcessing:  (isProcessing, step) =>
    set({ isProcessing, processingStep: isProcessing ? step ?? null : null }),
  setAsciiArt:    (art) => set({ currentAsciiArt: art }),
  clearMessages:  () => set({ messages: [] }),
}));
