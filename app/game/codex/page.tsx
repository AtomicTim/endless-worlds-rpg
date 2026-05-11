"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CodexContent } from "@/components/game/CodexContent";

/**
 * Day 20.4.2 TASK 4 — /game/codex route.
 *
 * The body has moved to components/game/CodexContent so the same
 * renderer can power both this full-page route AND the new CodexModal
 * overlay (which opens on top of /game without unmounting CombatMode).
 * This page now only wraps CodexContent in the route's "back to game"
 * chrome — direct URL access still works, deep links still resolve.
 */
export default function CodexPage() {
  const [characterName, setCharacterName] = useState<string>("");

  return (
    <div
      className="flex min-h-screen flex-col font-mono"
      style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">📖</span>
          <h1
            className="text-lg font-bold tracking-wide"
            style={{ color: "var(--color-primary)" }}
          >
            Codex {characterName ? `— ${characterName}'s World` : ""}
          </h1>
        </div>
        <Link href="/game">
          <Button
            variant="outline"
            size="sm"
            className="font-mono"
            style={{
              borderColor: "color-mix(in srgb, var(--color-primary) 40%, transparent)",
              color:       "var(--color-primary)",
            }}
          >
            ← Back to Game
          </Button>
        </Link>
      </header>

      <CodexContent onCharacterNameLoaded={setCharacterName} />
    </div>
  );
}
