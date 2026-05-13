"use client";

import { useEffect, useRef, useState } from "react";
import { Genre } from "@/types/game";

/**
 * Day 23.5B — WorldForgingScreen.
 *
 * Shown between the genre step and the species step in the character
 * creation wizard. The WCD fires in the background; this screen makes
 * the wait feel like watching the world come into existence.
 *
 * Stage progression:
 *   1. mount → fade in stage 1 message
 *   2. +8s   → cross-fade to stage 2 message
 *   3. when worldName arrives (status === "complete"):
 *        cross-fade to stage 3, 1200ms pause, typewriter
 *        types the world name 80ms/char, blink cursor, pause,
 *        then fade in stage 4 and call onComplete() after 800ms.
 *
 * All animation is CSS transitions + setTimeout. All timeouts are
 * tracked and cleared on unmount.
 */

interface Props {
  genre:     Genre;
  status:    "generating" | "complete";
  worldName: string | null;
  onComplete: () => void;
}

type Stage = 1 | 2 | 3 | 4;

const MESSAGES: Record<Genre, [string, string, string, string]> = {
  [Genre.FANTASY]: [
    "A world stirs beyond the veil...",
    "Ancient forces weave the land...",
    "A name forms from nothing...",
    "Your fate awaits.",
  ],
  [Genre.CYBERPUNK]: [
    "Initializing simulation...",
    "Compiling reality matrix...",
    "World designation incoming...",
    "Jack in.",
  ],
  [Genre.HORROR_LOVECRAFTIAN]: [
    "Something stirs in the dark...",
    "The voices grow louder...",
    "A name forms from the whispers...",
    "You shouldn't be here.",
  ],
  [Genre.SPACE_OPERA]: [
    "Scanning star charts...",
    "Calculating jump coordinates...",
    "World designation confirmed...",
    "Prepare for entry.",
  ],
  [Genre.POST_APOCALYPTIC]: [
    "Surveying the ruins...",
    "Mapping the wasteland...",
    "Designation acquired...",
    "Survivor, your world awaits.",
  ],
};

const STAGE_1_TO_2_DELAY  = 8000;
const STAGE_2_TO_3_PAUSE  = 1200;
const TYPEWRITER_INTERVAL = 80;
const POST_TYPE_PAUSE     = 1500;
const STAGE_4_TO_DONE     = 800;

export default function WorldForgingScreen({
  genre,
  status,
  worldName,
  onComplete,
}: Props) {
  const [stage, setStage] = useState<Stage>(1);
  const [typed, setTyped] = useState("");
  const [showCursor, setShowCursor] = useState(false);

  const messages = MESSAGES[genre] ?? MESSAGES[Genre.FANTASY];

  // Track every timeout/interval so we can clean up on unmount.
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  // Latch the "we've already started the worldName sequence" so a
  // worldName change can't restart the typewriter mid-way.
  const startedRef = useRef(false);

  function addTimeout(fn: () => void, ms: number) {
    const id = setTimeout(fn, ms);
    timeoutsRef.current.push(id);
    return id;
  }
  function addInterval(fn: () => void, ms: number) {
    const id = setInterval(fn, ms);
    intervalsRef.current.push(id);
    return id;
  }

  // Stage 1 → 2 (after 8s).
  useEffect(() => {
    addTimeout(() => setStage((prev) => (prev < 2 ? 2 : prev)), STAGE_1_TO_2_DELAY);
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      intervalsRef.current.forEach(clearInterval);
      timeoutsRef.current = [];
      intervalsRef.current = [];
    };
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stage 3 + typewriter + stage 4 + onComplete — fires once when
  // worldName arrives.
  useEffect(() => {
    if (status !== "complete" || !worldName || startedRef.current) return;
    startedRef.current = true;

    setStage(3);
    // Show blinking cursor for 500ms before letters begin.
    addTimeout(() => {
      setShowCursor(true);
    }, STAGE_2_TO_3_PAUSE - 500);

    addTimeout(() => {
      // Typewriter: 80ms per char.
      let i = 0;
      const id = addInterval(() => {
        i += 1;
        setTyped(worldName.slice(0, i));
        if (i >= worldName.length) {
          clearInterval(id);
          // Cursor blinks briefly after last char, then fades.
          addTimeout(() => setShowCursor(false), 700);
          // After a pause, swap to stage 4 and call onComplete.
          addTimeout(() => setStage(4), POST_TYPE_PAUSE);
          addTimeout(() => onComplete(), POST_TYPE_PAUSE + STAGE_4_TO_DONE);
        }
      }, TYPEWRITER_INTERVAL);
    }, STAGE_2_TO_3_PAUSE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, worldName]);

  // Current stage message. Stage 3 hides the message text (we show
  // the world name itself); stage 4 shows the transition message.
  const stageMessage =
    stage === 1 ? messages[0]
    : stage === 2 ? messages[1]
    : stage === 3 ? messages[2]
    : messages[3];

  // The world name + cursor block is only visible during stages 3-4.
  const showWorldName = stage >= 3 && (typed.length > 0 || showCursor);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
    >
      <div className="w-full max-w-2xl text-center flex flex-col items-center gap-12">
        {/* Stage message — crossfades via key change. */}
        <div
          key={`msg-${stage}`}
          className="font-mono text-sm tracking-widest uppercase"
          style={{
            color:      "var(--color-primary)",
            opacity:    1,
            animation:  "ew-forging-fade-in 800ms ease-out forwards",
          }}
        >
          {stageMessage}
        </div>

        {/* World name reveal — types in letter by letter. */}
        {showWorldName && (
          <div
            className="text-4xl sm:text-5xl font-bold text-glow tracking-wide flex items-end justify-center"
            style={{
              color:     "var(--color-primary)",
              minHeight: "3.5rem",
            }}
          >
            <span>{typed}</span>
            {showCursor && (
              <span
                className="inline-block w-0.5 h-10 ml-1 animate-pulse"
                style={{ backgroundColor: "var(--color-primary)" }}
              />
            )}
          </div>
        )}
      </div>

      {/* Keyframes — scoped via <style jsx>. */}
      <style jsx>{`
        @keyframes ew-forging-fade-in {
          0%   { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
