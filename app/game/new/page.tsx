"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Genre } from "@/types/game";
import type { WorldBible, WorldConsistencyDocument } from "@/types/game";
import { BACKGROUND_CONFIGS } from "@/lib/game/starting-equipment";
import { ARCHETYPE_MAP } from "@/lib/game/archetypes";

// ─── Genre data ──────────────────────────────────────────────────────────────

interface GenreDef {
  id: Genre;
  name: string;
  description: string;
  asciiArt: string;
  dataAttr: string;
  worldName: string;
}

const GENRES: GenreDef[] = [
  {
    id: Genre.FANTASY,
    name: "Fantasy",
    description: "Swords, sorcery, and ancient prophecies await in a world of magic.",
    asciiArt:
      "    ██ ██ ██\n   █████████\n   █ █████ █\n   █       █\n  ███████████\n  █         █\n █████████████",
    dataAttr: "",
    worldName: "Realm",
  },
  {
    id: Genre.CYBERPUNK,
    name: "Cyberpunk",
    description: "Hack the grid, dodge the corps, survive the neon-soaked sprawl.",
    asciiArt:
      " █  ▓█▓  █  ███\n █  ███  ██  ███\n▓█  ███  ██   █\n████████████████\n░░░░░░░░░░░░░░░░\n ▒ ▒ ▒ ▒ ▒ ▒ ▒",
    dataAttr: "cyberpunk",
    worldName: "Grid",
  },
  {
    id: Genre.HORROR_LOVECRAFTIAN,
    name: "Horror / Lovecraftian",
    description: "Reality frays at the edges. What you find may shatter your mind.",
    asciiArt:
      "    ░ ▒▓███▓▒ ░\n  ▒▓░  ●   ●  ░▓▒\n  ░█▓▓▓▓▓▓▓▓▓█░\n  ▒░\\‾‾‾‾‾‾‾/░▒\n ░\\\\  |||||  //░\n   \\\\  |||  //\n     \\\\ | //",
    dataAttr: "horror",
    worldName: "Void",
  },
  {
    id: Genre.SPACE_OPERA,
    name: "Space Opera",
    description: "Galaxies burn and empires fall. Your destiny spans the stars.",
    asciiArt:
      "       ▲\n     █████\n    ███████\n   █████████\n  ══╪═════╪══\n  ░░░  ║  ░░░\n    ╲╲ ║ ╱╱",
    dataAttr: "space-opera",
    worldName: "Galaxy",
  },
  {
    id: Genre.POST_APOCALYPTIC,
    name: "Post-Apocalyptic",
    description: "The world ended. You didn't. Now what?",
    asciiArt:
      "▓░  ░▓▓░  ░░▓░\n▓░  ░▓▓░  ░░▓░\n▓░░░░▓▓░░░░░▓░\n▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n░░░░░░░░░░░░░░\n  ░  ░  ░  ░",
    dataAttr: "post-apocalyptic",
    worldName: "Wasteland",
  },
];

// ─── Class flavor (display data per class id) ────────────────────────────────
//
// V8.51 — class cards are built dynamically from BACKGROUND_CONFIGS[genre]
// so every class shipped in starting-equipment.ts appears in the picker
// (15 originals + 10 new Day 22 archetypes = 5 per genre). This map
// supplies the display strings: a short flavor line and the most
// identity-defining starting item name (the one that "feels like" the
// class, not necessarily the weapon — e.g. Herald's Letter of Introduction
// over the Fine Rapier). Class display names are derived from the id via
// formatClassName below.
const CLASS_FLAVOR: Record<string, { description: string; startingItem: string }> = {
  // ── Fantasy ───────────────────────────────────────────────────────────────
  knight:         { description: "A sworn defender of the realm. Your oath is your armor.",                                  startingItem: "Iron Sword" },
  rogue:          { description: "Shadows are your home. You've never met a lock that could hold you.",                       startingItem: "Lockpicks" },
  mage:           { description: "Power flows through your blood. The arcane whispers in your dreams.",                       startingItem: "Spell Tome" },
  // Day 22 — new Fantasy classes.
  ranger:         { description: "The wilds are your domain. You read the land like others read faces.",                      startingItem: "Hunting Bow" },
  herald:         { description: "Words are your weapon. You've talked your way in and out of places steel couldn't touch.",  startingItem: "Letter of Introduction" },

  // ── Cyberpunk ─────────────────────────────────────────────────────────────
  netrunner:      { description: "You live in the data streams. Meat-space is just where you park your body.",                startingItem: "Neural Deck" },
  fixer:          { description: "Connections are currency. You know people who know people.",                                startingItem: "Burner Phone" },
  street_samurai: { description: "Steel and reflex. You solve problems the old-fashioned way.",                               startingItem: "Katana" },
  // Day 22 — new Cyberpunk classes.
  enforcer:       { description: "Muscle and momentum. You solve problems the direct way.",                                   startingItem: "Heavy Baton" },
  ghost:          { description: "You were never here. The best operatives leave no trace.",                                  startingItem: "Signal Scanner" },

  // ── Horror / Lovecraftian ─────────────────────────────────────────────────
  investigator:   { description: "You sought the truth. Now you wish you hadn't. Some questions have no safe answers.",       startingItem: "Case Notes" },
  cultist:        { description: "You've seen beyond the veil. What waited on the other side looked back.",                   startingItem: "Forbidden Text" },
  survivor:       { description: "You don't know why you're still alive. You stopped asking.",                                startingItem: "Makeshift Club" },
  // Day 22 — new Horror classes.
  phantom:        { description: "Between one blink and the next, you're gone. Or you were never there at all.",              startingItem: "Straight Razor" },
  medium:         { description: "The dead speak to you. So do the living — whether they want to or not.",                    startingItem: "Ritual Focus" },

  // ── Space Opera ───────────────────────────────────────────────────────────
  commander:      { description: "Born to lead fleets. Ships and crews bend to your will.",                                   startingItem: "Command Badge" },
  pilot:          { description: "The void is your ocean. You've flown through nebulae that have no name.",                   startingItem: "Nav Charts" },
  engineer:       { description: "You keep the ship flying through sheer stubborn competence.",                               startingItem: "Engineer's Toolkit" },
  // Day 22 — new Space Opera classes.
  marine:         { description: "The corps forged you. Front lines, breach points, and whatever comes after.",               startingItem: "Assault Rifle" },
  recon:          { description: "You see everything before it sees you. Intel is survival.",                                 startingItem: "Tactical Scanner" },

  // ── Post-Apocalyptic ──────────────────────────────────────────────────────
  scavenger:      { description: "Junk is treasure if you know what you're looking at. You always know.",                     startingItem: "Scrap Tool" },
  raider:         { description: "Take what you need. Leave nothing. The wasteland respects strength.",                       startingItem: "Pipe Wrench" },
  medic:          { description: "People need you alive. That's the only reason you're still breathing.",                     startingItem: "First Aid Kit" },
  // Day 22 — new Post-Apoc classes.
  runner:         { description: "Fast is alive. Everything worth having out here is worth running for.",                     startingItem: "Carbon-Fibre Blade" },
  demagogue:      { description: "Hope and fear in equal measure. People follow you and they're not sure why.",               startingItem: "Rallying Manifesto" },
};

// Stat ids → display names (used on class cards for the +2 bonus line).
const STAT_LABEL: Record<string, string> = {
  strength:     "Strength",
  agility:      "Agility",
  intelligence: "Intelligence",
  perception:   "Perception",
  charisma:     "Charisma",
};

// "street_samurai" → "Street Samurai" for the class card title.
function formatClassName(id: string): string {
  return id
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 2) return "Name must be at least 2 characters.";
  if (trimmed.length > 24) return "Name must be 24 characters or fewer.";
  if (!/^[a-zA-Z0-9\-' ]+$/.test(trimmed))
    return "Only letters, numbers, hyphens, and apostrophes are allowed.";
  return "";
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full border text-xs font-bold font-mono transition-colors"
              style={{
                borderColor: active || done ? "var(--color-primary)" : "var(--color-muted)",
                backgroundColor: done ? "var(--color-primary)" : "transparent",
                color: done ? "var(--color-bg)" : active ? "var(--color-primary)" : "var(--color-muted)",
              }}
            >
              {done ? "✓" : n}
            </div>
            {i < total - 1 && (
              <div
                className="w-8 h-px"
                style={{ backgroundColor: done ? "var(--color-primary)" : "var(--color-muted)" }}
              />
            )}
          </div>
        );
      })}
      <span className="ml-2 text-xs font-mono" style={{ color: "var(--color-muted)" }}>
        Step {current} of {total}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
//
// V8.51 — 3-step flow (was 4-step pre-Day-22). The point-buy "Distribute
// Attributes" step is gone: per rule 89 the archetype map deterministically
// computes starting stats from `background` (base 2, primary +2, secondary
// +1, others stay at 2). The /api/game/new route ignores any `attributes`
// payload; we no longer send one.
//
//   Step 1 → Genre
//   Step 2 → Character name
//   Step 3 → Background (class) → Begin Journey

export default function NewGamePage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedGenre, setSelectedGenre]         = useState<Genre | null>(null);
  const [characterName, setCharacterName]         = useState("");
  const [nameError, setNameError]                 = useState("");
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [isLoading, setIsLoading]                 = useState(false);
  const [loadingMessage, setLoadingMessage]       = useState("Creating character...");
  const [submitError, setSubmitError]             = useState("");

  const genre      = GENRES.find((g) => g.id === selectedGenre) ?? null;
  const worldName  = genre?.worldName ?? "World";
  const dataAttr   = genre?.dataAttr ?? "";

  // Dynamically build the class list for the selected genre. Reads
  // straight from BACKGROUND_CONFIGS so any class added to
  // starting-equipment.ts is automatically picker-eligible. Each entry
  // pulls description + key item from CLASS_FLAVOR and primary stat
  // from ARCHETYPE_MAP — no per-class data lives in this file.
  const backgroundIds = selectedGenre
    ? Object.keys(BACKGROUND_CONFIGS[selectedGenre] ?? {})
    : [];

  // ── Navigation ──────────────────────────────────────────────────────────────

  function canAdvance(): boolean {
    if (step === 1) return selectedGenre !== null;
    if (step === 2) return validateName(characterName) === "";
    if (step === 3) return selectedBackground !== null;
    return false;
  }

  function handleNext() {
    if (step === 2) {
      const err = validateName(characterName);
      if (err) { setNameError(err); return; }
    }
    if (canAdvance() && step < 3) setStep((prev) => (prev + 1) as 1 | 2 | 3);
  }

  function handleBack() {
    if (step > 1) setStep((prev) => (prev - 1) as 1 | 2 | 3);
  }

  // ── Genre selection ─────────────────────────────────────────────────────────

  function handleGenreSelect(g: Genre) {
    setSelectedGenre(g);
    // Reset background — a class valid in one genre is meaningless in
    // another, and the genre switch may shrink the available list.
    setSelectedBackground(null);
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!selectedGenre || !selectedBackground) return;
    setIsLoading(true);
    setLoadingMessage("Creating your character...");
    setSubmitError("");

    try {
      // ── Step 1: create the session (default starting location, empty world). ──
      // V8.51 — `attributes` payload removed. /api/game/new computes
      // them deterministically from `background` via buildStartingAttributes.
      const res = await fetch("/api/game/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: selectedGenre,
          characterName: characterName.trim(),
          background: selectedBackground,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setSubmitError(data.error ?? "Failed to create game. Please try again.");
        return;
      }

      const { sessionId } = await res.json() as { sessionId: string };

      // ── Step 2 (Day 19A): generate the World Consistency Document. ─────────
      // Layer 0 of the generation architecture. WCD is the absolute facts
      // of this world (landmarks, factions, rules, atmosphere) — every
      // later AI call is constrained by it. Required for the bible flow.
      setLoadingMessage("Establishing world laws...");
      let wcd: WorldConsistencyDocument | undefined;
      try {
        const wcdRes = await fetch("/api/game/generate-wcd", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            genre:            selectedGenre,
            character_name:   characterName.trim(),
            character_class:  selectedBackground,
          }),
        });
        if (wcdRes.ok) {
          const data = await wcdRes.json() as { wcd?: WorldConsistencyDocument };
          wcd = data.wcd;
        } else {
          const data = await wcdRes.json() as { error?: string };
          console.warn("[wizard] generate-wcd failed:", data.error);
        }
      } catch (err) {
        console.warn("[wizard] generate-wcd threw:", err);
      }

      if (!wcd) {
        setSubmitError("World generation failed (WCD). Please try again.");
        return;
      }

      // ── Step 3 (Day 19B): generate the World Bible (Layer 1). ──────────────
      // Single Claude call seeded with the WCD. Produces the fully-detailed
      // starting region — named locations, real-name NPCs, Tier 1 objects,
      // adjacent region outlines, and the main quest with five breadcrumbs.
      setLoadingMessage("Crafting your world...");
      let bible: WorldBible | undefined;
      try {
        const bibleRes = await fetch("/api/game/generate-world-bible", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            genre:            selectedGenre,
            character_name:   characterName.trim(),
            character_class:  selectedBackground,
            wcd,
          }),
        });
        if (bibleRes.ok) {
          const data = await bibleRes.json() as { bible?: WorldBible };
          bible = data.bible;
        } else {
          const data = await bibleRes.json() as { error?: string };
          console.warn("[wizard] generate-world-bible failed:", data.error);
        }
      } catch (err) {
        console.warn("[wizard] generate-world-bible threw:", err);
      }

      if (!bible) {
        setSubmitError("World generation failed (bible). Please try again.");
        return;
      }

      // ── Step 4 (Day 19B): persist bible + WCD + pre-populate world_assets. ─
      // apply-world-bible builds the WorldGraph, writes every asset, and
      // patches master_state with the starting location and main quest.
      setLoadingMessage("Building your world...");
      const applyRes = await fetch("/api/game/apply-world-bible", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          session_id: sessionId,
          bible,
          wcd,
        }),
      });
      if (!applyRes.ok) {
        const data = await applyRes.json() as { error?: string };
        console.warn("[wizard] apply-world-bible failed:", data.error);
        setSubmitError(data.error ?? "Failed to apply world. Please try again.");
        return;
      }

      // ── Step 5: brief beat before the player drops into the game. ──────────
      setLoadingMessage("Entering the world...");
      await new Promise((resolve) => setTimeout(resolve, 500));

      router.push("/game");
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen font-mono"
      data-genre={dataAttr || undefined}
      style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
    >
      {/* Header */}
      <header className="border-b px-6 py-4" style={{ borderColor: "var(--color-border)" }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="text-sm font-bold tracking-widest uppercase text-glow"
            style={{ color: "var(--color-primary)" }}>
            ⬡ ENDLESS WORLDS
          </span>
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
            New Character
          </span>
        </div>
      </header>

      {/* Wizard container */}
      <main className="max-w-4xl mx-auto px-4 py-10">
        <StepIndicator current={step} total={3} />

        {/* ── Step 1: Genre ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold mb-2 text-center tracking-wide text-glow"
              style={{ color: "var(--color-primary)" }}>
              Choose Your Genre
            </h1>
            <p className="text-center text-sm mb-8" style={{ color: "var(--color-muted)" }}>
              Select the world you wish to inhabit.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {GENRES.map((g) => {
                const isSelected = selectedGenre === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => handleGenreSelect(g.id)}
                    className="text-left p-4 rounded border transition-all duration-150 hover:scale-[1.02] active:scale-[0.99]"
                    style={{
                      borderColor: isSelected ? "var(--color-primary)" : "var(--color-border)",
                      backgroundColor: isSelected
                        ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
                        : "color-mix(in srgb, var(--color-border) 40%, transparent)",
                      boxShadow: isSelected
                        ? "0 0 12px color-mix(in srgb, var(--color-primary) 30%, transparent)"
                        : "none",
                    }}
                  >
                    <pre
                      className="ascii-art mb-3 leading-tight"
                      style={{
                        color: isSelected ? "var(--color-primary)" : "var(--color-muted)",
                        fontSize: "0.6rem",
                      }}
                    >
                      {g.asciiArt}
                    </pre>
                    <div
                      className="text-sm font-bold mb-1 tracking-wide"
                      style={{ color: isSelected ? "var(--color-primary)" : "var(--color-text)" }}
                    >
                      {g.name}
                    </div>
                    <div className="text-xs leading-relaxed" style={{ color: "var(--color-muted)" }}>
                      {g.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 2: Name ──────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold mb-2 text-center tracking-wide text-glow"
              style={{ color: "var(--color-primary)" }}>
              Name Your Character
            </h1>
            <p className="text-center text-sm mb-10" style={{ color: "var(--color-muted)" }}>
              Your name will echo through the {worldName}.
            </p>

            <div className="max-w-md mx-auto">
              <label
                htmlFor="char-name"
                className="block text-xs uppercase tracking-widest mb-2"
                style={{ color: "var(--color-muted)" }}
              >
                Character Name
              </label>
              <input
                id="char-name"
                type="text"
                value={characterName}
                onChange={(e) => {
                  setCharacterName(e.target.value);
                  if (nameError) setNameError(validateName(e.target.value));
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleNext(); }}
                maxLength={24}
                placeholder="Enter your name..."
                autoFocus
                className="w-full px-4 py-3 rounded border bg-transparent text-base outline-none transition-colors"
                style={{
                  borderColor: nameError ? "#ef4444" : "var(--color-border)",
                  color: "var(--color-text)",
                  caretColor: "var(--color-primary)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = nameError ? "#ef4444" : "var(--color-primary)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = nameError ? "#ef4444" : "var(--color-border)";
                }}
              />

              {/* Char counter */}
              <div className="flex items-start justify-between mt-1">
                <span className="text-xs" style={{ color: "#ef4444", minHeight: "1rem" }}>
                  {nameError}
                </span>
                <span
                  className="text-xs ml-2 shrink-0"
                  style={{ color: characterName.length >= 20 ? "#ef4444" : "var(--color-muted)" }}
                >
                  {characterName.length}/24
                </span>
              </div>

              {/* Live preview */}
              {characterName.trim().length >= 2 && !nameError && (
                <p
                  className="mt-8 text-center text-sm italic animate-pulse"
                  style={{ color: "var(--color-primary)" }}
                >
                  &ldquo;{characterName.trim()}&rdquo; — your name echoes through the {worldName}...
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Background ───────────────────────────────────────── */}
        {/* V8.51 — was Step 4 pre-Day-22. Cards dynamically render every
            class in BACKGROUND_CONFIGS[selectedGenre] (5 per genre after
            Day 22). Stat bonus reads from ARCHETYPE_MAP — replaces the
            old hardcoded "+2 X" strings so the picker can't drift from
            the actual archetype distribution. */}
        {step === 3 && selectedGenre && (
          <div>
            <h1 className="text-2xl font-bold mb-2 text-center tracking-wide text-glow"
              style={{ color: "var(--color-primary)" }}>
              Choose Your Background
            </h1>
            <p className="text-center text-sm mb-8" style={{ color: "var(--color-muted)" }}>
              Your history shapes who you are — and what you begin with.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {backgroundIds.map((bgId) => {
                const isSelected = selectedBackground === bgId;
                const arch       = ARCHETYPE_MAP[bgId];
                const flavor     = CLASS_FLAVOR[bgId];
                const primaryStat = arch ? STAT_LABEL[arch.primary] ?? arch.primary : "—";
                const bonusLine  = arch ? `+2 ${primaryStat}` : "";
                // Fall back to a generic description when a class is
                // present in BACKGROUND_CONFIGS but missing from
                // CLASS_FLAVOR (defensive — every shipped class has an
                // entry, but newly-added classes lacking flavor should
                // still appear in the picker rather than crash render).
                const description = flavor?.description
                  ?? "A path with its own quiet weight.";
                const itemHint    = flavor?.startingItem ?? "Class kit";
                return (
                  <button
                    key={bgId}
                    onClick={() => setSelectedBackground(bgId)}
                    className="text-left p-5 rounded border transition-all duration-150 hover:scale-[1.02] active:scale-[0.99] flex flex-col"
                    style={{
                      borderColor: isSelected ? "var(--color-primary)" : "var(--color-border)",
                      backgroundColor: isSelected
                        ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
                        : "color-mix(in srgb, var(--color-border) 40%, transparent)",
                      boxShadow: isSelected
                        ? "0 0 12px color-mix(in srgb, var(--color-primary) 30%, transparent)"
                        : "none",
                    }}
                  >
                    <div
                      className="text-base font-bold mb-2 tracking-wide"
                      style={{ color: isSelected ? "var(--color-primary)" : "var(--color-text)" }}
                    >
                      {formatClassName(bgId)}
                    </div>
                    <p className="text-xs leading-relaxed mb-4 flex-1" style={{ color: "var(--color-muted)" }}>
                      {description}
                    </p>
                    <div className="space-y-1 border-t pt-3 mt-auto"
                      style={{ borderColor: "var(--color-border)" }}>
                      <div className="text-xs font-bold" style={{ color: "var(--color-accent)" }}>
                        {bonusLine}
                      </div>
                      <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                        Starts with: {itemHint}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Submit error */}
            {submitError && (
              <p className="mt-6 text-center text-sm" style={{ color: "#ef4444" }}>
                {submitError}
              </p>
            )}

            {/* Loading state */}
            {isLoading && (
              <p
                className="mt-6 text-center text-sm font-bold tracking-widest"
                style={{ color: "var(--color-primary)" }}
              >
                {loadingMessage}
                <span className="cursor-blink">▋</span>
              </p>
            )}
          </div>
        )}

        {/* ── Navigation buttons ────────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-10 max-w-3xl mx-auto">
          {/* Back button */}
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="px-5 py-2 rounded border text-sm font-bold transition-all"
            style={{
              borderColor: step === 1 ? "transparent" : "var(--color-border)",
              color: step === 1 ? "transparent" : "var(--color-muted)",
              cursor: step === 1 ? "default" : "pointer",
            }}
          >
            ← Back
          </button>

          {/* Next / Begin button */}
          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              className="px-6 py-2 rounded border text-sm font-bold transition-all"
              style={{
                borderColor: canAdvance() ? "var(--color-primary)" : "var(--color-border)",
                color: canAdvance() ? "var(--color-primary)" : "var(--color-muted)",
                backgroundColor: canAdvance()
                  ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                  : "transparent",
                opacity: canAdvance() ? 1 : 0.5,
                cursor: canAdvance() ? "pointer" : "not-allowed",
              }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canAdvance() || isLoading}
              className="px-6 py-2 rounded border text-sm font-bold transition-all"
              style={{
                borderColor: canAdvance() && !isLoading ? "var(--color-primary)" : "var(--color-border)",
                color: canAdvance() && !isLoading ? "var(--color-primary)" : "var(--color-muted)",
                backgroundColor:
                  canAdvance() && !isLoading
                    ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                    : "transparent",
                opacity: canAdvance() && !isLoading ? 1 : 0.5,
                cursor: canAdvance() && !isLoading ? "pointer" : "not-allowed",
              }}
            >
              {isLoading ? "Creating..." : "Begin Journey →"}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
