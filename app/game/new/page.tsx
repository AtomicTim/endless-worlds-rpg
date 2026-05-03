"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Genre } from "@/types/game";
import type { Attributes } from "@/types/game";

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_POINTS = 20;
const ATTR_MIN = 1;
const ATTR_MAX = 8;

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

// ─── Attribute data ───────────────────────────────────────────────────────────

const ATTR_DEFS: { key: keyof Attributes; label: string; description: string }[] = [
  { key: "strength",     label: "Strength",     description: "Physical power and melee combat effectiveness." },
  { key: "agility",      label: "Agility",       description: "Speed, stealth, and ranged combat precision." },
  { key: "charisma",     label: "Charisma",      description: "Persuasion, deception, and social influence." },
  { key: "intelligence", label: "Intelligence",  description: "Knowledge, hacking, and puzzle-solving ability." },
  { key: "perception",   label: "Perception",    description: "Awareness, investigation, and noticing hidden details." },
];

// ─── Background data ──────────────────────────────────────────────────────────

interface BackgroundDef {
  id: string;
  name: string;
  description: string;
  bonus: string;
  startingItem: string;
}

const BACKGROUNDS: Record<Genre, BackgroundDef[]> = {
  [Genre.FANTASY]: [
    {
      id: "knight",
      name: "Knight",
      description: "A sworn defender of the realm. Your oath is your armor.",
      bonus: "+2 Strength",
      startingItem: "Iron Sword",
    },
    {
      id: "rogue",
      name: "Rogue",
      description: "Shadows are your home. You've never met a lock that could hold you.",
      bonus: "+2 Agility",
      startingItem: "Lockpicks",
    },
    {
      id: "mage",
      name: "Mage",
      description: "Power flows through your blood. The arcane whispers in your dreams.",
      bonus: "+2 Intelligence",
      startingItem: "Spell Tome",
    },
  ],
  [Genre.CYBERPUNK]: [
    {
      id: "netrunner",
      name: "Netrunner",
      description: "You live in the data streams. Meat-space is just where you park your body.",
      bonus: "+2 Intelligence",
      startingItem: "Neural Deck",
    },
    {
      id: "fixer",
      name: "Fixer",
      description: "Connections are currency. You know people who know people.",
      bonus: "+2 Charisma",
      startingItem: "Burner Phone",
    },
    {
      id: "street_samurai",
      name: "Street Samurai",
      description: "Steel and reflex. You solve problems the old-fashioned way.",
      bonus: "+2 Agility",
      startingItem: "Katana",
    },
  ],
  [Genre.HORROR_LOVECRAFTIAN]: [
    {
      id: "investigator",
      name: "Investigator",
      description: "You sought the truth. Now you wish you hadn't. Some questions have no safe answers.",
      bonus: "+2 Intelligence",
      startingItem: "Case Notes",
    },
    {
      id: "cultist",
      name: "Cultist",
      description: "You've seen beyond the veil. What waited on the other side looked back.",
      bonus: "+2 Perception",
      startingItem: "Forbidden Text",
    },
    {
      id: "survivor",
      name: "Survivor",
      description: "You don't know why you're still alive. You stopped asking.",
      bonus: "+2 Strength",
      startingItem: "Makeshift Club",
    },
  ],
  [Genre.SPACE_OPERA]: [
    {
      id: "commander",
      name: "Commander",
      description: "Born to lead fleets. Ships and crews bend to your will.",
      bonus: "+2 Charisma",
      startingItem: "Command Badge",
    },
    {
      id: "pilot",
      name: "Pilot",
      description: "The void is your ocean. You've flown through nebulae that have no name.",
      bonus: "+2 Agility",
      startingItem: "Nav Charts",
    },
    {
      id: "engineer",
      name: "Engineer",
      description: "You keep the ship flying through sheer stubborn competence.",
      bonus: "+2 Intelligence",
      startingItem: "Engineer's Toolkit",
    },
  ],
  [Genre.POST_APOCALYPTIC]: [
    {
      id: "scavenger",
      name: "Scavenger",
      description: "Junk is treasure if you know what you're looking at. You always know.",
      bonus: "+2 Perception",
      startingItem: "Scrap Tool",
    },
    {
      id: "raider",
      name: "Raider",
      description: "Take what you need. Leave nothing. The wasteland respects strength.",
      bonus: "+2 Strength",
      startingItem: "Pipe Wrench",
    },
    {
      id: "medic",
      name: "Medic",
      description: "People need you alive. That's the only reason you're still breathing.",
      bonus: "+2 Intelligence",
      startingItem: "First Aid Kit",
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDefaultAttributes(): Attributes {
  return { strength: 4, agility: 4, charisma: 4, intelligence: 4, perception: 4 };
}

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

export default function NewGamePage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedGenre, setSelectedGenre]         = useState<Genre | null>(null);
  const [characterName, setCharacterName]         = useState("");
  const [nameError, setNameError]                 = useState("");
  const [attributes, setAttributes]               = useState<Attributes>(makeDefaultAttributes());
  const [hoveredAttr, setHoveredAttr]             = useState<keyof Attributes | null>(null);
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [isLoading, setIsLoading]                 = useState(false);
  const [submitError, setSubmitError]             = useState("");

  const genre      = GENRES.find((g) => g.id === selectedGenre) ?? null;
  const worldName  = genre?.worldName ?? "World";
  const dataAttr   = genre?.dataAttr ?? "";

  const usedPoints      = Object.values(attributes).reduce((s, v) => s + v, 0);
  const remainingPoints = TOTAL_POINTS - usedPoints;

  // ── Navigation ──────────────────────────────────────────────────────────────

  function canAdvance(): boolean {
    if (step === 1) return selectedGenre !== null;
    if (step === 2) return validateName(characterName) === "";
    if (step === 3) return remainingPoints === 0;
    if (step === 4) return selectedBackground !== null;
    return false;
  }

  function handleNext() {
    if (step === 2) {
      const err = validateName(characterName);
      if (err) { setNameError(err); return; }
    }
    if (canAdvance() && step < 4) setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
  }

  function handleBack() {
    if (step > 1) setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
  }

  // ── Genre selection ─────────────────────────────────────────────────────────

  function handleGenreSelect(g: Genre) {
    setSelectedGenre(g);
    setSelectedBackground(null);
  }

  // ── Attribute distribution ──────────────────────────────────────────────────

  function handleAttrChange(key: keyof Attributes, delta: 1 | -1) {
    setAttributes((prev) => {
      const next = prev[key] + delta;
      if (next < ATTR_MIN || next > ATTR_MAX) return prev;
      const newRemaining = TOTAL_POINTS - (usedPoints + delta);
      if (newRemaining < 0) return prev;
      return { ...prev, [key]: next };
    });
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!selectedGenre || !selectedBackground || remainingPoints !== 0) return;
    setIsLoading(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/game/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre: selectedGenre,
          characterName: characterName.trim(),
          background: selectedBackground,
          attributes,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setSubmitError(data.error ?? "Failed to create game. Please try again.");
        return;
      }

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
        <StepIndicator current={step} total={4} />

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

        {/* ── Step 3: Attributes ────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h1 className="text-2xl font-bold mb-2 text-center tracking-wide text-glow"
              style={{ color: "var(--color-primary)" }}>
              Distribute Attributes
            </h1>
            <p className="text-center text-sm mb-2" style={{ color: "var(--color-muted)" }}>
              You have <strong>20 points</strong> to distribute. Each attribute: min 1, max 8.
            </p>

            {/* Remaining counter */}
            <div className="flex justify-center mb-8">
              <div
                className="px-4 py-1 rounded border text-sm font-bold font-mono transition-colors"
                style={{
                  borderColor: remainingPoints === 0 ? "var(--color-primary)" : remainingPoints < 0 ? "#ef4444" : "var(--color-border)",
                  color: remainingPoints === 0 ? "var(--color-primary)" : remainingPoints < 0 ? "#ef4444" : "var(--color-text)",
                  backgroundColor: remainingPoints === 0
                    ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                    : "transparent",
                }}
              >
                {remainingPoints > 0
                  ? `${remainingPoints} point${remainingPoints === 1 ? "" : "s"} remaining`
                  : remainingPoints === 0
                  ? "✓ Points fully allocated"
                  : "Over budget!"}
              </div>
            </div>

            <div className="max-w-lg mx-auto space-y-3">
              {ATTR_DEFS.map(({ key, label, description }) => {
                const val = attributes[key];
                const canInc = val < ATTR_MAX && remainingPoints > 0;
                const canDec = val > ATTR_MIN;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-4 px-4 py-3 rounded border transition-colors"
                    style={{
                      borderColor: hoveredAttr === key ? "var(--color-primary)" : "var(--color-border)",
                      backgroundColor: hoveredAttr === key
                        ? "color-mix(in srgb, var(--color-primary) 5%, transparent)"
                        : "transparent",
                    }}
                    onMouseEnter={() => setHoveredAttr(key)}
                    onMouseLeave={() => setHoveredAttr(null)}
                  >
                    {/* Label + description (always rendered; opacity hides when not hovered) */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold" style={{ color: "var(--color-text)" }}>
                        {label}
                      </div>
                      <div
                        className="text-xs mt-0.5 transition-opacity duration-150"
                        style={{
                          color: "var(--color-muted)",
                          opacity: hoveredAttr === key ? 1 : 0,
                        }}
                      >
                        {description}
                      </div>
                    </div>

                    {/* Pip bar */}
                    <div className="flex gap-1">
                      {Array.from({ length: ATTR_MAX }, (_, i) => (
                        <div
                          key={i}
                          className="w-3 h-3 rounded-sm transition-colors"
                          style={{
                            backgroundColor: i < val ? "var(--color-primary)" : "var(--color-border)",
                          }}
                        />
                      ))}
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        onClick={() => handleAttrChange(key, -1)}
                        disabled={!canDec}
                        className="w-7 h-7 rounded border text-sm font-bold transition-opacity"
                        style={{
                          borderColor: "var(--color-border)",
                          color: canDec ? "var(--color-primary)" : "var(--color-muted)",
                          opacity: canDec ? 1 : 0.4,
                        }}
                      >
                        −
                      </button>
                      <span
                        className="w-6 text-center text-sm font-bold"
                        style={{ color: "var(--color-text)" }}
                      >
                        {val}
                      </span>
                      <button
                        onClick={() => handleAttrChange(key, 1)}
                        disabled={!canInc}
                        className="w-7 h-7 rounded border text-sm font-bold transition-opacity"
                        style={{
                          borderColor: "var(--color-border)",
                          color: canInc ? "var(--color-primary)" : "var(--color-muted)",
                          opacity: canInc ? 1 : 0.4,
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 4: Background ───────────────────────────────────────── */}
        {step === 4 && selectedGenre && (
          <div>
            <h1 className="text-2xl font-bold mb-2 text-center tracking-wide text-glow"
              style={{ color: "var(--color-primary)" }}>
              Choose Your Background
            </h1>
            <p className="text-center text-sm mb-8" style={{ color: "var(--color-muted)" }}>
              Your history shapes who you are — and what you begin with.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {BACKGROUNDS[selectedGenre].map((bg) => {
                const isSelected = selectedBackground === bg.id;
                return (
                  <button
                    key={bg.id}
                    onClick={() => setSelectedBackground(bg.id)}
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
                      {bg.name}
                    </div>
                    <p className="text-xs leading-relaxed mb-4 flex-1" style={{ color: "var(--color-muted)" }}>
                      {bg.description}
                    </p>
                    <div className="space-y-1 border-t pt-3 mt-auto"
                      style={{ borderColor: "var(--color-border)" }}>
                      <div className="text-xs font-bold" style={{ color: "var(--color-accent)" }}>
                        {bg.bonus}
                      </div>
                      <div className="text-xs" style={{ color: "var(--color-muted)" }}>
                        Starts with: {bg.startingItem}
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
                Entering the {worldName}
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
          {step < 4 ? (
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
