"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Icon as TablerIcon } from "@tabler/icons-react";
import {
  IconShield, IconEyeOff, IconWand, IconCrosshair, IconMessage,
  IconCpu, IconBriefcase, IconSword, IconHammer, IconGhost,
  IconSearch, IconMoon, IconHeart, IconMask, IconEye,
  IconBadge, IconRocket, IconTool, IconAnchor, IconRadar,
  IconAxe, IconFirstAidKit, IconRun, IconSpeakerphone,
} from "@tabler/icons-react";
import { Genre } from "@/types/game";
import type {
  AppearanceProfile,
  OriginChoice,
  PlayerCharacterProfile,
  Species,
  WorldBible,
  WorldConsistencyDocument,
} from "@/types/game";
import { BACKGROUND_CONFIGS } from "@/lib/game/starting-equipment";
import { ARCHETYPE_MAP } from "@/lib/game/archetypes";
import { pregenerateRegionalBible } from "@/lib/game/regional-bible-cache";
import WorldForgingScreen from "@/components/WorldForgingScreen";

// ─── UI-12 — Class icons + stat colour system ────────────────────────────────
//
// Tabler icon per class (design ref §9). The spec calls for ti-ship on
// Marine; @tabler/icons-react v3 doesn't export IconShip, so Marine uses
// IconAnchor as the nearest naval analogue. Scavenger shares IconSearch
// with Investigator per the spec.
const CLASS_ICON: Record<string, TablerIcon> = {
  // Fantasy
  knight:         IconShield,
  rogue:          IconEyeOff,
  mage:           IconWand,
  ranger:         IconCrosshair,
  herald:         IconMessage,
  // Cyberpunk
  netrunner:      IconCpu,
  fixer:          IconBriefcase,
  street_samurai: IconSword,
  enforcer:       IconHammer,
  ghost:          IconGhost,
  // Horror
  investigator:   IconSearch,
  cultist:        IconMoon,
  survivor:       IconHeart,
  phantom:        IconMask,
  medium:         IconEye,
  // Space Opera
  commander:      IconBadge,
  pilot:          IconRocket,
  engineer:       IconTool,
  marine:         IconAnchor,
  recon:          IconRadar,
  // Post-Apoc
  scavenger:      IconSearch,
  raider:         IconAxe,
  medic:          IconFirstAidKit,
  runner:         IconRun,
  demagogue:      IconSpeakerphone,
};

/** Semantic stat colour (NOT genre-specific — hardcoded per spec). */
const STAT_COLOR: Record<string, string> = {
  strength:     "#c87040",  // STR
  agility:      "#60a850",  // AGI
  intelligence: "#5880d0",  // INT
  perception:   "#409888",  // PER
  charisma:     "#9060d0",  // CHA
};

/** Short stat abbrev for the role-badge pill. */
const STAT_SHORT: Record<string, string> = {
  strength:     "STR",
  agility:      "AGI",
  intelligence: "INT",
  perception:   "PER",
  charisma:     "CHA",
};

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

// ─── Class flavor ────────────────────────────────────────────────────────────
//
// V8.51 — class cards are built dynamically from BACKGROUND_CONFIGS[genre]. This
// map supplies display strings only; class display names derive from the id via
// formatClassName below.
const CLASS_FLAVOR: Record<string, { description: string; startingItem: string }> = {
  // Fantasy
  knight:         { description: "A sworn defender of the realm. Your oath is your armor.",                                  startingItem: "Iron Sword" },
  rogue:          { description: "Shadows are your home. You've never met a lock that could hold you.",                       startingItem: "Lockpicks" },
  mage:           { description: "Power flows through your blood. The arcane whispers in your dreams.",                       startingItem: "Spell Tome" },
  ranger:         { description: "The wilds are your domain. You read the land like others read faces.",                      startingItem: "Hunting Bow" },
  herald:         { description: "Words are your weapon. You've talked your way in and out of places steel couldn't touch.",  startingItem: "Letter of Introduction" },
  // Cyberpunk
  netrunner:      { description: "You live in the data streams. Meat-space is just where you park your body.",                startingItem: "Neural Deck" },
  fixer:          { description: "Connections are currency. You know people who know people.",                                startingItem: "Burner Phone" },
  street_samurai: { description: "Steel and reflex. You solve problems the old-fashioned way.",                               startingItem: "Katana" },
  enforcer:       { description: "Muscle and momentum. You solve problems the direct way.",                                   startingItem: "Heavy Baton" },
  ghost:          { description: "You were never here. The best operatives leave no trace.",                                  startingItem: "Signal Scanner" },
  // Horror
  investigator:   { description: "You sought the truth. Now you wish you hadn't. Some questions have no safe answers.",       startingItem: "Case Notes" },
  cultist:        { description: "You've seen beyond the veil. What waited on the other side looked back.",                   startingItem: "Forbidden Text" },
  survivor:       { description: "You don't know why you're still alive. You stopped asking.",                                startingItem: "Makeshift Club" },
  phantom:        { description: "Between one blink and the next, you're gone. Or you were never there at all.",              startingItem: "Straight Razor" },
  medium:         { description: "The dead speak to you. So do the living — whether they want to or not.",                    startingItem: "Ritual Focus" },
  // Space Opera
  commander:      { description: "Born to lead fleets. Ships and crews bend to your will.",                                   startingItem: "Command Badge" },
  pilot:          { description: "The void is your ocean. You've flown through nebulae that have no name.",                   startingItem: "Nav Charts" },
  engineer:       { description: "You keep the ship flying through sheer stubborn competence.",                               startingItem: "Engineer's Toolkit" },
  marine:         { description: "The corps forged you. Front lines, breach points, and whatever comes after.",               startingItem: "Assault Rifle" },
  recon:          { description: "You see everything before it sees you. Intel is survival.",                                 startingItem: "Tactical Scanner" },
  // Post-Apoc
  scavenger:      { description: "Junk is treasure if you know what you're looking at. You always know.",                     startingItem: "Scrap Tool" },
  raider:         { description: "Take what you need. Leave nothing. The wasteland respects strength.",                       startingItem: "Pipe Wrench" },
  medic:          { description: "People need you alive. That's the only reason you're still breathing.",                     startingItem: "First Aid Kit" },
  runner:         { description: "Fast is alive. Everything worth having out here is worth running for.",                     startingItem: "Carbon-Fibre Blade" },
  demagogue:      { description: "Hope and fear in equal measure. People follow you and they're not sure why.",               startingItem: "Rallying Manifesto" },
};

const STAT_LABEL: Record<string, string> = {
  strength:     "Strength",
  agility:      "Agility",
  intelligence: "Intelligence",
  perception:   "Perception",
  charisma:     "Charisma",
};

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

// UI-fix-B — truncate a description to its first N sentences by character
// scan. The brief says "do not rewrite — truncate", so this only walks the
// existing text and slices at the Nth sentence-ending punctuation. Falls
// through to the full string when fewer sentences exist.
function trimToSentences(text: string | undefined, maxSentences = 2): string {
  if (!text) return "";
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "." || ch === "!" || ch === "?") {
      count += 1;
      if (count >= maxSentences) {
        // Include the punctuation; eat trailing whitespace for clean wrap.
        let end = i + 1;
        while (end < text.length && text[end] === " ") end += 1;
        return text.slice(0, end).trim();
      }
    }
  }
  return text;
}

// UI-fix-B — selected-state ✓ overlay. Positioned absolute against the
// card's relative wrapper (cardStyle / classCardStyle adds position:
// relative on selected). Inter Tight, 10px, accent colour by default;
// class cards pass the stat colour explicitly.
interface CheckMarkProps { color?: string; }
function CheckMark({ color = "var(--genre-accent)" }: CheckMarkProps) {
  return (
    <span
      aria-hidden
      className="ew-sans"
      style={{
        position:   "absolute",
        top:        8,
        right:      10,
        fontSize:   10,
        fontWeight: 700,
        lineHeight: 1,
        color,
      }}
    >
      ✓
    </span>
  );
}

// UI-fix-B — single stat-modifier pill (Species step). Number rendered in
// JetBrains Mono (tabular-nums), label in Inter Tight 9px uppercase, both
// in the STAT_COLOR for that stat key. Falls back to var(--genre-accent)
// for unknown stats (defensive — should never trip).
interface StatModPillProps { statKey: string; value: number; }
function StatModPill({ statKey, value }: StatModPillProps) {
  const color = STAT_COLOR[statKey] ?? "var(--genre-accent)";
  const label = STAT_SHORT[statKey] ?? statKey.slice(0, 3).toUpperCase();
  const sign  = value > 0 ? "+" : "−";
  return (
    <span
      style={{
        display:      "inline-flex",
        alignItems:   "center",
        gap:          4,
        padding:      "2px 8px",
        borderRadius: 20,
        border:       `1px solid color-mix(in srgb, ${color} 36%, transparent)`,
        background:   `color-mix(in srgb, ${color} 12%, transparent)`,
        color,
      }}
    >
      <span
        style={{
          fontFamily:         "var(--mono)",
          fontVariantNumeric: "tabular-nums",
          fontSize:           11,
          fontWeight:         600,
        }}
      >
        {sign}{Math.abs(value)}
      </span>
      <span
        className="ew-sans"
        style={{
          fontSize:      9,
          letterSpacing: "0.10em",
          fontWeight:    600,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </span>
  );
}

// ─── Step indicator (UI-12 CHANGE 8 — dot-style only) ───────────────────────
//
// Filled = genre accent for completed steps. Active = larger accent dot.
// Remaining = #2d2618 dim. No labels. World Forging is NOT a user step
// (the dot total stays at 6 across species/class/origin/appearance/name/
// motivation).
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done   = n < current;
        const active = n === current;
        const filled = done || active;
        const size   = active ? 9 : 6;
        return (
          <span
            key={n}
            aria-hidden
            style={{
              display:      "inline-block",
              width:        size,
              height:       size,
              borderRadius: "50%",
              background:   filled ? "var(--genre-accent)" : "#2d2618",
              opacity:      done && !active ? 0.7 : 1,
              transition:   "background 200ms ease, width 200ms ease, height 200ms ease",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Wizard stages ────────────────────────────────────────────────────────────

type WizardStage =
  | "genre"
  | "forging"
  | "species"
  | "class"
  | "origin"
  | "appearance"
  | "name"
  | "motivation";

const STAGE_TO_STEP: Partial<Record<WizardStage, number>> = {
  species:    1,
  class:      2,
  origin:     3,
  appearance: 4,
  name:       5,
  motivation: 6,
};

type CreationMode = "guided" | "random" | "custom";

// Default human fallback for when WCD species generation returns empty.
const DEFAULT_HUMAN_SPECIES: Species = {
  id:                   "human",
  name:                 "Human",
  description:          "Adaptable, ambitious, ubiquitous.",
  lore_notes:           "",
  is_anchor:            true,
  stat_modifiers:       {},
  skill_affinities:     [],
  resistances:          {},
  vulnerabilities:      {},
  passive_traits:       [],
  environmental_flags:  [],
  npc_disposition_seed: 0,
};

// Generic origin fallbacks when the LLM-generated options fail. One per slot.
function genericOriginFallbacks(classId: string): OriginChoice[] {
  return [
    {
      id:          `${classId}_drifter`,
      label:       "Drifter",
      description: "You arrived with nothing but a name and a story you don't tell.",
      starting_bonus: { type: "gold", gold_amount: 20 },
    },
    {
      id:          `${classId}_townsfolk`,
      label:       "Local",
      description: "You know these streets. They know you back.",
      starting_bonus: {
        type:             "item",
        item_name:        "Worn Knife",
        item_description: "A small blade you've carried since you were a kid.",
      },
    },
    {
      id:          `${classId}_outsider`,
      label:       "Outsider",
      description: "You're not from around here. People notice.",
      starting_bonus: {
        type:             "item",
        item_name:        "Traveler's Pack",
        item_description: "Rations, water, and a few small comforts from home.",
      },
    },
  ];
}

const GENERIC_APPEARANCE_FALLBACKS: AppearanceProfile[] = [
  {
    descriptors: ["lean build", "watchful eyes", "weathered hands"],
    summary:     "Wiry and quiet, the kind of person who moves through a room without being noticed.",
  },
  {
    descriptors: ["broad shoulders", "set jaw", "calloused hands"],
    summary:     "Built solid, with the bearing of someone who's done physical work for years.",
  },
  {
    descriptors: ["sharp features", "alert posture", "quick smile"],
    summary:     "Quick-eyed and easy-mannered, hard to read unless they want to be read.",
  },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewGamePage() {
  const router = useRouter();

  // Wizard stage + existing primitives.
  const [stage, setStage]                         = useState<WizardStage>("genre");
  const [selectedGenre, setSelectedGenre]         = useState<Genre | null>(null);
  const [characterName, setCharacterName]         = useState("");
  const [nameError, setNameError]                 = useState("");
  const [selectedBackground, setSelectedBackground] = useState<string | null>(null);
  const [isLoading, setIsLoading]                 = useState(false);
  const [loadingMessage, setLoadingMessage]       = useState("Creating character...");
  const [submitError, setSubmitError]             = useState("");

  // Day 23.5B — WCD + species state.
  const [wcd, setWcd]                             = useState<WorldConsistencyDocument | null>(null);
  const [wcdWorldName, setWcdWorldName]           = useState<string | null>(null);
  const [wcdStatus, setWcdStatus]                 = useState<"idle" | "generating" | "complete">("idle");
  const [speciesOptions, setSpeciesOptions]       = useState<Species[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);

  // Origin + appearance options + selection.
  const [originOptions, setOriginOptions]         = useState<OriginChoice[]>([]);
  const [selectedOrigin, setSelectedOrigin]       = useState<OriginChoice | null>(null);
  const [originLoading, setOriginLoading]         = useState(false);
  const [appearanceOptions, setAppearanceOptions] = useState<AppearanceProfile[]>([]);
  const [selectedAppearance, setSelectedAppearance] = useState<AppearanceProfile | null>(null);
  const [appearanceLoading, setAppearanceLoading] = useState(false);

  // Gender, motivation, mode, random char loading, random name loading.
  const [gender, setGender]                       = useState<"male" | "female">("male");
  const [motivation, setMotivation]               = useState("");
  const [creationMode, setCreationMode]           = useState<CreationMode>("guided");
  const [randomCharLoading, setRandomCharLoading] = useState(false);
  const [randomNameLoading, setRandomNameLoading] = useState(false);
  // Day 23.5B hotfix — motivation randomize loading.
  const [randomMotivationLoading, setRandomMotivationLoading] = useState(false);

  // Day 23.5B hotfix (FIX 3B) — cache appearance options per gender so
  // toggling male/female on the appearance step never re-generates an
  // already-loaded gender. Burns one haiku call per gender, max.
  const [appearanceByGender, setAppearanceByGender] = useState<
    Record<"male" | "female", AppearanceProfile[]>
  >({ male: [], female: [] });

  // Day 23.5B hotfix (FIX 5) — fire WorldBible in the background as
  // soon as WCD completes. handleSubmit reads the cached result.
  // worldBiblePromiseRef: the in-flight fetch promise so handleSubmit
  //   can await it when the player clicks Begin Adventure before
  //   generation finishes.
  // worldBibleResultRef: filled in by the background fetch's .then()
  //   once the bible JSON parses successfully. Null on failure → the
  //   submit chain falls back to re-firing generate-world-bible.
  const worldBibleResultRef  = useRef<{ bible: WorldBible } | null>(null);
  const worldBiblePromiseRef = useRef<Promise<void> | null>(null);

  const genre      = GENRES.find((g) => g.id === selectedGenre) ?? null;
  const worldNameFallback = genre?.worldName ?? "this world";
  const dataAttr   = genre?.dataAttr ?? "";

  // Dynamically build the class list for the selected genre.
  const backgroundIds = selectedGenre
    ? Object.keys(BACKGROUND_CONFIGS[selectedGenre] ?? {})
    : [];

  // Effective species list — falls back to default human when WCD didn't ship any.
  const effectiveSpecies: Species[] =
    speciesOptions.length > 0 ? speciesOptions : [DEFAULT_HUMAN_SPECIES];

  // ── Effects ────────────────────────────────────────────────────────────────

  // Origin generation — fires once when class is picked.
  useEffect(() => {
    if (!selectedBackground || !selectedGenre) return;
    if (originOptions.length > 0 || originLoading) return;
    if (stage !== "class" && stage !== "origin") return;

    setOriginLoading(true);
    fetch("/api/game/generate-origin-options", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        genre:           selectedGenre,
        class_id:        selectedBackground,
        wcd_world_name:  wcdWorldName ?? "",
      }),
    })
      .then((res) => res.json())
      .then((data: { options?: OriginChoice[]; error?: string }) => {
        const opts = data.options ?? [];
        setOriginOptions(opts.length > 0 ? opts : genericOriginFallbacks(selectedBackground));
        setOriginLoading(false);
      })
      .catch(() => {
        setOriginOptions(genericOriginFallbacks(selectedBackground));
        setOriginLoading(false);
      });
  }, [selectedBackground, selectedGenre, stage, wcdWorldName, originOptions.length, originLoading]);

  // Day 23.5B hotfix (FIX 3B) — Appearance generation with per-gender
  // cache. Fires when:
  //   1. appearance step is shown OR
  //   2. gender toggles on the appearance step
  // and there are no cached options for the current gender. If the
  // current gender already has cached options, swap them in without
  // a network call.
  useEffect(() => {
    if (stage !== "appearance") return;
    if (!selectedGenre || !selectedBackground) return;

    // Cache hit → swap immediately.
    const cached = appearanceByGender[gender];
    if (cached.length > 0) {
      setAppearanceOptions(cached);
      return;
    }
    if (appearanceLoading) return;

    setAppearanceLoading(true);
    fetch("/api/game/generate-appearance-options", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        genre:      selectedGenre,
        class_id:   selectedBackground,
        species_id: selectedSpeciesId ?? "human",
        gender,
      }),
    })
      .then((res) => res.json())
      .then((data: { options?: AppearanceProfile[]; error?: string }) => {
        const raw = data.options ?? [];
        const opts = raw.length > 0 ? raw : GENERIC_APPEARANCE_FALLBACKS;
        setAppearanceOptions(opts);
        setAppearanceByGender((prev) => ({ ...prev, [gender]: opts }));
        setAppearanceLoading(false);
      })
      .catch(() => {
        setAppearanceOptions(GENERIC_APPEARANCE_FALLBACKS);
        setAppearanceByGender((prev) => ({
          ...prev,
          [gender]: GENERIC_APPEARANCE_FALLBACKS,
        }));
        setAppearanceLoading(false);
      });
  }, [stage, selectedGenre, selectedBackground, selectedSpeciesId, gender, appearanceByGender, appearanceLoading]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  function canAdvance(): boolean {
    switch (stage) {
      case "genre":      return selectedGenre !== null;
      case "forging":    return false;
      case "species":    return creationMode === "random" || selectedSpeciesId !== null;
      case "class":      return selectedBackground !== null;
      case "origin":     return selectedOrigin !== null;
      case "appearance": return selectedAppearance !== null;
      case "name":       return validateName(characterName) === "";
      case "motivation": return true;
      default:           return false;
    }
  }

  function fireWcd(g: Genre) {
    setWcdStatus("generating");
    setWcd(null);
    setWcdWorldName(null);
    setSpeciesOptions([]);
    // Day 23.5B hotfix (FIX 5) — clear any prior background WorldBible
    // result; a new genre means a new world.
    worldBibleResultRef.current  = null;
    worldBiblePromiseRef.current = null;

    fetch("/api/game/generate-wcd", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ genre: g }),
    })
      .then((res) => res.json())
      .then((data: { wcd?: WorldConsistencyDocument; error?: string }) => {
        if (data.wcd) {
          setWcd(data.wcd);
          setWcdWorldName(data.wcd.world_name ?? null);
          setSpeciesOptions(data.wcd.species ?? []);
          setWcdStatus("complete");

          // Day 23.5B hotfix (FIX 5) — kick off WorldBible generation in
          // the background while the player walks through species →
          // class → origin → appearance → name → motivation. Empty
          // character_name / character_class are fine: the WB prompt
          // omits the Character line when both are blank, and
          // world_intro_template {name}/{class} resolution happens in
          // apply-world-bible from master_state.player_state. Cached
          // result is consumed by handleSubmit; failures fall through
          // to a synchronous re-run there.
          const wcdSnapshot = data.wcd;
          worldBiblePromiseRef.current = fetch(
            "/api/game/generate-world-bible",
            {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({
                genre:           g,
                character_name:  "",
                character_class: "",
                wcd:             wcdSnapshot,
              }),
            },
          )
            .then((res) => res.json())
            .then((bibleData: { bible?: WorldBible; error?: string }) => {
              if (bibleData.bible) {
                worldBibleResultRef.current = { bible: bibleData.bible };
                console.log("[wizard] Background WorldBible ready.");
              } else {
                console.warn(
                  "[wizard] Background WorldBible returned no bible:",
                  bibleData.error,
                );
              }
            })
            .catch((err) => {
              console.warn("[wizard] Background WorldBible threw:", err);
            });
        } else {
          setSubmitError("World generation failed. Please try again.");
          setStage("genre");
          setWcdStatus("idle");
        }
      })
      .catch(() => {
        setSubmitError("World generation failed. Please try again.");
        setStage("genre");
        setWcdStatus("idle");
      });
  }

  function handleNext() {
    if (stage === "name") {
      const err = validateName(characterName);
      if (err) { setNameError(err); return; }
    }
    if (!canAdvance()) return;

    if (stage === "genre" && selectedGenre) {
      setStage("forging");
      fireWcd(selectedGenre);
      return;
    }
    if (stage === "species")    { setStage("class"); return; }
    if (stage === "class")      { setStage("origin"); return; }
    if (stage === "origin")     { setStage("appearance"); return; }
    if (stage === "appearance") { setStage("name"); return; }
    if (stage === "name")       { setStage("motivation"); return; }
  }

  function handleBack() {
    if (stage === "forging") return; // no back during forging
    if (stage === "motivation") { setStage("name"); return; }
    if (stage === "name")       { setStage("appearance"); return; }
    if (stage === "appearance") { setStage("origin"); return; }
    if (stage === "origin")     { setStage("class"); return; }
    if (stage === "class")      { setStage("species"); return; }
    if (stage === "species") {
      // Reset WCD-derived state on the way back to genre.
      setStage("genre");
      setWcd(null);
      setWcdWorldName(null);
      setWcdStatus("idle");
      setSpeciesOptions([]);
      setSelectedSpeciesId(null);
      setOriginOptions([]);
      setSelectedOrigin(null);
      setAppearanceOptions([]);
      setAppearanceByGender({ male: [], female: [] });
      setSelectedAppearance(null);
      // Day 23.5B hotfix (FIX 5) — drop the background WorldBible so
      // the next genre choice doesn't pull in a stale bible.
      worldBibleResultRef.current  = null;
      worldBiblePromiseRef.current = null;
      return;
    }
  }

  // ── Genre selection ────────────────────────────────────────────────────────

  function handleGenreSelect(g: Genre) {
    setSelectedGenre(g);
    // Reset downstream selections since genre defines the class set.
    setSelectedBackground(null);
    setSelectedSpeciesId(null);
    setOriginOptions([]);
    setSelectedOrigin(null);
    setAppearanceOptions([]);
    setSelectedAppearance(null);
  }

  // ── Gender select (rerun appearance generation if already populated) ───────

  function handleGenderSelect(g: "male" | "female") {
    if (g === gender) return;
    setGender(g);
    // Day 23.5B hotfix (FIX 3B) — selection clears (it was gender-specific)
    // but cached options for both genders are preserved. The appearance
    // useEffect picks up the new gender; cache hits avoid the LLM call.
    setSelectedAppearance(null);
  }

  // ── Random character (RANDOM mode) ─────────────────────────────────────────

  async function handleRandomCharacter() {
    if (!selectedGenre) return;
    setRandomCharLoading(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/game/generate-random-character", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre:           selectedGenre,
          wcd_world_name:  wcdWorldName ?? "",
          species_options: effectiveSpecies,
        }),
      });
      const data = (await res.json()) as {
        character?: {
          name:       string;
          gender:     "male" | "female";
          species_id: string;
          class_id:   string;
          origin:     OriginChoice;
          appearance: AppearanceProfile;
          motivation: string;
        };
        error?: string;
      };
      if (!res.ok || !data.character) {
        setSubmitError(data.error ?? "Random character generation failed.");
        return;
      }
      const c = data.character;
      setSelectedSpeciesId(c.species_id);
      setSelectedBackground(c.class_id);
      setSelectedOrigin(c.origin);
      setSelectedAppearance(c.appearance);
      setCharacterName(c.name);
      setGender(c.gender);
      setMotivation(c.motivation);
      // Skip ahead to the name step so the player can confirm/edit.
      setStage("name");
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setRandomCharLoading(false);
    }
  }

  // ── Random name ────────────────────────────────────────────────────────────

  async function handleRandomName() {
    if (!selectedGenre) return;
    setRandomNameLoading(true);
    try {
      // UI-fix-B B6 — two changes vs. the original handler to defeat
      // the "regenerate stops working" symptom:
      //
      //   1. cache: 'no-store' on the fetch. Belt for the suspenders
      //      below: instructs the browser HTTP cache (and any
      //      intermediate proxy) never to serve a stored response for
      //      this URL+body combo.
      //
      //   2. _nonce: Date.now() in the body. Even when no-store is
      //      respected, an LLM endpoint with no temperature parameter
      //      can land on the same most-likely name token for identical
      //      input. Adding a per-call nonce makes every request body
      //      unique — the server ignores the field (the API route
      //      destructures only genre/species_id/gender), and the
      //      uniqueness propagates as input entropy that defeats any
      //      Anthropic-side response repetition through prompt
      //      identity.
      //
      // The handler was already correct on the React side: no latch,
      // setRandomNameLoading reset in finally, button re-enables. The
      // perceived "stops working" was the same name re-appearing.
      const res = await fetch("/api/game/generate-random-name", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        cache:   "no-store",
        body: JSON.stringify({
          genre:      selectedGenre,
          species_id: selectedSpeciesId ?? "human",
          gender,
          _nonce:     Date.now(),
        }),
      });
      const data = (await res.json()) as { name?: string; error?: string };
      if (data.name) {
        setCharacterName(data.name);
        setNameError("");
      }
    } catch {
      // silent — leave name as-is
    } finally {
      setRandomNameLoading(false);
    }
  }

  // ── Random motivation ──────────────────────────────────────────────────────
  // Day 23.5B hotfix (FIX 4B) — Randomize button on the motivation step.

  async function handleRandomMotivation() {
    if (!selectedGenre || !selectedBackground || !selectedSpeciesId) return;
    setRandomMotivationLoading(true);
    try {
      const res = await fetch("/api/game/generate-random-motivation", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre:          selectedGenre,
          wcd_world_name: wcdWorldName ?? "",
          species_id:     selectedSpeciesId,
          class_id:       selectedBackground,
          origin_label:   selectedOrigin?.label ?? "",
        }),
      });
      const data = (await res.json()) as { motivation?: string; error?: string };
      if (data.motivation) {
        setMotivation(data.motivation.slice(0, 120));
      }
    } catch {
      // silent — leave motivation as-is
    } finally {
      setRandomMotivationLoading(false);
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!selectedGenre || !selectedBackground || !selectedSpeciesId) return;
    if (validateName(characterName) !== "") return;

    setIsLoading(true);
    setLoadingMessage("Creating your character...");
    setSubmitError("");

    // Build the character profile from selections (with safe fallbacks).
    const profile: PlayerCharacterProfile = {
      species_id: selectedSpeciesId,
      gender,
      origin: selectedOrigin ?? {
        id:          `${selectedBackground}_default`,
        label:       "Adventurer",
        description: "",
        starting_bonus: {
          type:             "item",
          item_name:        "class default",
          item_description: "",
        },
      },
      appearance: selectedAppearance ?? { descriptors: [], summary: "" },
      motivation: motivation.trim(),
    };

    try {
      // ── Create session ──
      const res = await fetch("/api/game/new", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre:         selectedGenre,
          characterName: characterName.trim(),
          background:    selectedBackground,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setSubmitError(data.error ?? "Failed to create game. Please try again.");
        return;
      }
      const { sessionId } = (await res.json()) as { sessionId: string };

      // ── WCD (may already be in state) ──
      setLoadingMessage("Establishing world laws...");
      let wcdLocal: WorldConsistencyDocument | undefined = wcd ?? undefined;
      if (!wcdLocal) {
        try {
          const wcdRes = await fetch("/api/game/generate-wcd", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              genre:           selectedGenre,
              character_name:  characterName.trim(),
              character_class: selectedBackground,
            }),
          });
          if (wcdRes.ok) {
            const data = (await wcdRes.json()) as { wcd?: WorldConsistencyDocument };
            wcdLocal = data.wcd;
          }
        } catch (err) {
          console.warn("[wizard] generate-wcd retry threw:", err);
        }
        if (!wcdLocal) {
          setSubmitError("World generation failed (WCD). Please try again.");
          return;
        }
      }

      // ── WorldBible ──
      // Day 23.5B hotfix (FIX 5) — three paths:
      //   1. background fetch already finished → instant.
      //   2. background fetch still in flight   → await it.
      //   3. background fetch never ran or failed → synchronous retry.
      // {name}/{class} resolution happens in apply-world-bible from
      // master_state.player_state, so the background fetch's empty
      // character_name/class values don't matter here.
      setLoadingMessage("Crafting your world...");
      let bible: WorldBible | undefined;

      if (worldBibleResultRef.current?.bible) {
        bible = worldBibleResultRef.current.bible;
        console.log("[wizard] Using background WorldBible result.");
      } else if (worldBiblePromiseRef.current) {
        setLoadingMessage("Almost there — finishing your world...");
        try {
          await worldBiblePromiseRef.current;
        } catch {
          // promise itself never rejects (handled in fireWcd), but be safe
        }
        bible = worldBibleResultRef.current?.bible;
        if (bible) {
          console.log("[wizard] Background WorldBible resolved during wait.");
        }
      }

      if (!bible) {
        // Fallback — background fetch never started or failed.
        setLoadingMessage("Crafting your world...");
        try {
          const bibleRes = await fetch("/api/game/generate-world-bible", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({
              genre:           selectedGenre,
              character_name:  characterName.trim(),
              character_class: selectedBackground,
              wcd:             wcdLocal,
            }),
          });
          if (bibleRes.ok) {
            const data = (await bibleRes.json()) as { bible?: WorldBible };
            bible = data.bible;
          } else {
            const data = (await bibleRes.json()) as { error?: string };
            console.warn("[wizard] generate-world-bible failed:", data.error);
          }
        } catch (err) {
          console.warn("[wizard] generate-world-bible threw:", err);
        }
      }

      if (!bible) {
        setSubmitError("World generation failed (bible). Please try again.");
        return;
      }

      // ── Apply WorldBible ──
      setLoadingMessage("Building your world...");
      const applyRes = await fetch("/api/game/apply-world-bible", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          session_id: sessionId,
          bible,
          wcd: wcdLocal,
        }),
      });
      if (!applyRes.ok) {
        const data = (await applyRes.json()) as { error?: string };
        setSubmitError(data.error ?? "Failed to apply world. Please try again.");
        return;
      }

      // ── Save character profile ──
      try {
        const saveRes = await fetch("/api/game/save-character-profile", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ session_id: sessionId, profile }),
        });
        if (!saveRes.ok) {
          const data = (await saveRes.json()) as { error?: string };
          console.warn("[wizard] save-character-profile failed:", data.error);
        }
      } catch (err) {
        console.warn("[wizard] save-character-profile threw:", err);
      }

      // ── Fire RegionBible burst (copied verbatim from previous version) ──
      const adjacentRegions = bible.adjacent_regions ?? [];
      const existingRegionNames = adjacentRegions.map((r) => r.name);
      adjacentRegions.forEach((outline) => {
        pregenerateRegionalBible({
          sessionId,
          outline,
          originRegionName:    bible.starting_region.name,
          directionFromOrigin: outline.direction_from_start,
          genre:               selectedGenre,
          wcd:                 wcdLocal,
          existingRegionNames: existingRegionNames.filter((n) => n !== outline.name),
        });
      });
      if (adjacentRegions.length > 0) {
        console.log(
          `[wizard] Fired background pre-generation for ${adjacentRegions.length} adjacent region(s).`
        );
        console.log(
          `[GEN_TIMING] RegionBible burst — ${adjacentRegions.length} regions, firing in parallel (already parallel via fire-and-forget; no change needed)`
        );
      }

      setLoadingMessage("Entering the world...");
      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push("/game");
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Forging screen takes over the whole viewport — no wizard chrome.
  if (stage === "forging" && selectedGenre) {
    return (
      <div
        // UI-fix-A — was font-mono. Forging screen is a cinematic
        // surface; let the WorldForgingScreen child set its own
        // typography per element.
        className="min-h-screen ew-sans"
        data-genre={dataAttr || undefined}
        style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
      >
        <WorldForgingScreen
          genre={selectedGenre}
          status={wcdStatus === "complete" ? "complete" : "generating"}
          worldName={wcdWorldName}
          onComplete={() => setStage("species")}
        />
      </div>
    );
  }

  const stepNum = STAGE_TO_STEP[stage];
  const showStepIndicator = typeof stepNum === "number";

  // ── Card styling helpers (UI-fix-B — standard template) ────────────────
  //
  // Both helpers follow the brief's "standard template":
  //   bg var(--card-bg) · border var(--card-border) · radius var(--card-radius)
  //   shadow var(--card-shadow) · cursor pointer
  // Selected state adds 1.5px accent border, .08 accent tint over the
  // card bg, and a relative position so the ✓ CheckMark sits top-right.
  //
  // cardStyle() — uses the active genre accent. Right for species,
  // origin, appearance (genre is committed by that point).
  // genreCardStyle() — neutral amber #c4943a hardcoded for selection,
  // because the genre class is not yet active on the root (B1 rule).
  function cardStyle(isSelected: boolean): React.CSSProperties {
    return {
      background:   isSelected
        ? "linear-gradient(rgba(var(--genre-accent-rgb), 0.08), rgba(var(--genre-accent-rgb), 0.08)), var(--card-bg)"
        : "var(--card-bg)",
      border:       isSelected
        ? "1.5px solid rgba(var(--genre-accent-rgb), 0.70)"
        : "1px solid var(--card-border)",
      borderRadius: "var(--card-radius, 7px)",
      boxShadow:    isSelected
        ? "0 0 12px rgba(var(--genre-accent-rgb), 0.30)"
        : "var(--card-shadow)",
      cursor:       "pointer",
      position:     "relative",
    };
  }
  function genreCardStyle(isSelected: boolean): React.CSSProperties {
    return {
      background:   isSelected
        ? "linear-gradient(rgba(196,148,58,0.08), rgba(196,148,58,0.08)), var(--card-bg)"
        : "var(--card-bg)",
      border:       isSelected
        ? "1.5px solid rgba(196,148,58,0.70)"
        : "1px solid var(--card-border)",
      borderRadius: "var(--card-radius, 7px)",
      boxShadow:    isSelected
        ? "0 0 12px rgba(196,148,58,0.30)"
        : "var(--card-shadow)",
      cursor:       "pointer",
      position:     "relative",
    };
  }

  return (
    <div
      // UI-fix-A — wizard shell drops font-mono (Courier→Inter Tight)
      // and adopts ew-sans so per-step labels read as proper UI
      // chrome; ew-serif overrides cascade for prose.
      className="min-h-screen ew-sans"
      data-genre={dataAttr || undefined}
      style={{
        // UI-fix-B — Group B1 carves out the genre step: that screen
        // happens before any genre is selected, so the brief specifies
        // the darker pre-game background (#08060a, matching Main Menu).
        // Every other step uses #0f0d0a (design ref §A3) so the wizard
        // reads as "inside the game" rather than menu chrome.
        backgroundColor: stage === "genre" ? "#08060a" : "#0f0d0a",
        color:           "var(--color-text)",
      }}
    >
      {/* Header — UI-fix-B B1: logo is Cormorant Garamond italic in
          neutral amber #c4943a (not uppercase, not monospace). The
          "New Character" right-side hint stays as muted UI chrome. */}
      <header className="border-b px-6 py-4" style={{ borderColor: "var(--color-border)" }}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span
            className="ew-serif"
            style={{
              fontWeight:    500,
              fontSize:      16,
              color:         "#c4943a",
              letterSpacing: "0.01em",
            }}
          >
            ✦ Endless Worlds
          </span>
          <span
            className="ew-sans uppercase"
            style={{
              fontSize:      9,
              letterSpacing: "0.18em",
              color:         "var(--color-muted)",
            }}
          >
            New Character
          </span>
        </div>
      </header>

      {/* Wizard container */}
      <main className="max-w-4xl mx-auto px-4 py-10">
        {showStepIndicator && <StepIndicator current={stepNum!} total={6} />}

        {/* ── Genre step ─────────────────────────────────────────────── */}
        {stage === "genre" && (
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
                // UI-fix-B B1 — genre cards still tag their own
                // data-genre so each card's ASCII tracer reads in its
                // own accent. Selected state uses neutral amber
                // (genreCardStyle), since the page-level genre class
                // is not active until the player advances past the
                // genre step.
                return (
                  <button
                    key={g.id}
                    onClick={() => handleGenreSelect(g.id)}
                    data-genre={g.dataAttr || "fantasy"}
                    className="text-left transition-all duration-150 hover:scale-[1.02] active:scale-[0.99]"
                    style={{ ...genreCardStyle(isSelected), padding: "10px 12px" }}
                  >
                    {/* Selected ✓ — top-right of card. Neutral amber
                        per B1 rule (genre class not active yet). */}
                    {isSelected && <CheckMark color="#c4943a" />}

                    {/* Artwork placeholder — Section 9 reserves this
                        slot for genre art. ASCII tracer is a low-
                        intensity stand-in until art lands. */}
                    <div
                      style={{
                        height:         54,
                        marginBottom:   10,
                        display:        "flex",
                        alignItems:     "center",
                        justifyContent: "center",
                      }}
                    >
                      <pre
                        className="ascii-art leading-tight"
                        style={{
                          color:    "rgba(var(--genre-accent-rgb), 0.35)",
                          fontSize: "0.55rem",
                          margin:   0,
                        }}
                      >
                        {g.asciiArt}
                      </pre>
                    </div>

                    {/* Genre name — UI-fix-B B1: Inter Tight uppercase
                        13px #e2cda0. The accent pill is gone (replaced
                        by the selected-state border + ✓). */}
                    <div
                      className="ew-sans uppercase"
                      style={{
                        fontSize:      13,
                        letterSpacing: "0.10em",
                        fontWeight:    600,
                        color:         "#e2cda0",
                        marginBottom:  4,
                      }}
                    >
                      {g.name}
                    </div>

                    {/* Tagline — Cormorant Garamond italic 12px #6a5530
                        per B1 spec. */}
                    <div
                      className="ew-serif"
                      style={{
                        fontSize:   12,
                        lineHeight: 1.45,
                        color:      "#6a5530",
                      }}
                    >
                      {g.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Species step ──────────────────────────────────────────── */}
        {stage === "species" && (
          <div>
            <h1 className="text-2xl font-bold mb-2 text-center tracking-wide text-glow"
              style={{ color: "var(--color-primary)" }}>
              Choose Your Species
            </h1>
            <p className="text-center text-sm mb-6" style={{ color: "var(--color-muted)" }}>
              Each species shapes who you are in {wcdWorldName ?? worldNameFallback}.
            </p>

            {/* Mode picker */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {(["random", "guided", "custom"] as CreationMode[]).map((m) => {
                const isSelected = creationMode === m;
                const label =
                  m === "random" ? "⚡ RANDOM" : m === "guided" ? "◈ GUIDED" : "✦ CUSTOM";
                return (
                  <button
                    key={m}
                    onClick={() => setCreationMode(m)}
                    className="px-3 py-1.5 rounded border text-xs font-bold tracking-widest transition-all"
                    style={{
                      borderColor: isSelected ? "var(--color-primary)" : "var(--color-border)",
                      color:       isSelected ? "var(--color-primary)" : "var(--color-muted)",
                      backgroundColor: isSelected
                        ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
                        : "transparent",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {creationMode === "random" ? (
              <div className="text-center">
                <p className="text-sm mb-6" style={{ color: "var(--color-muted)" }}>
                  We&apos;ll forge a complete character for you in this world.
                  You can edit the name before beginning.
                </p>
                <button
                  onClick={handleRandomCharacter}
                  disabled={randomCharLoading}
                  className="px-6 py-3 rounded border text-sm font-bold transition-all"
                  style={{
                    borderColor: "var(--color-primary)",
                    color:       "var(--color-primary)",
                    backgroundColor: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                    opacity:     randomCharLoading ? 0.5 : 1,
                    cursor:      randomCharLoading ? "wait" : "pointer",
                  }}
                >
                  {randomCharLoading ? "Forging..." : "Forge Character →"}
                </button>
                {submitError && (
                  <p className="mt-6 text-center text-sm" style={{ color: "#ef4444" }}>
                    {submitError}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {effectiveSpecies.map((sp) => {
                  const isSelected = selectedSpeciesId === sp.id;
                  // UI-fix-B B3 — keep raw entries so the renderer can
                  // emit per-stat pills (was a joined "+1 STR · -1 AGI"
                  // string before).
                  const statEntries = Object.entries(sp.stat_modifiers ?? {})
                    .filter(([, v]) => typeof v === "number" && v !== 0)
                    .map(([k, v]) => [k, v as number] as const);
                  const trait = sp.passive_traits?.[0]?.label ?? "";
                  const seed  = sp.npc_disposition_seed ?? 0;
                  const disposition =
                    seed > 5  ? "Trusted among locals"
                    : seed < -5 ? "Regarded with suspicion"
                    : "";
                  // UI-fix-B B3 — truncate description to 2 sentences
                  // max. Brief says "do not rewrite — truncate".
                  const shortDesc = trimToSentences(sp.description, 2);
                  return (
                    <button
                      key={sp.id}
                      onClick={() => {
                        // Day 23.5B hotfix (FIX 3B) — species change
                        // invalidates per-gender appearance cache.
                        if (selectedSpeciesId !== sp.id) {
                          setAppearanceByGender({ male: [], female: [] });
                          setAppearanceOptions([]);
                          setSelectedAppearance(null);
                        }
                        setSelectedSpeciesId(sp.id);
                      }}
                      className="text-left p-5 transition-all duration-150 hover:scale-[1.02] active:scale-[0.99] flex flex-col"
                      style={cardStyle(isSelected)}
                    >
                      {isSelected && <CheckMark />}
                      <div
                        className="ew-serif mb-2"
                        style={{
                          fontSize:   14,
                          color:      "#e2cda0",
                          lineHeight: 1.25,
                        }}
                      >
                        {sp.name}
                      </div>
                      <p
                        className="ew-serif mb-4 flex-1"
                        style={{
                          fontSize:   12,
                          lineHeight: 1.5,
                          color:      "#9a7e52",
                        }}
                      >
                        {shortDesc}
                      </p>
                      <div
                        className="border-t pt-3 mt-auto flex flex-col gap-2"
                        style={{ borderColor: "var(--card-border)" }}
                      >
                        {statEntries.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {statEntries.map(([k, v]) => (
                              <StatModPill key={k} statKey={k} value={v} />
                            ))}
                          </div>
                        )}
                        {trait && (
                          <div
                            className="ew-sans uppercase"
                            style={{
                              fontSize:      9,
                              letterSpacing: "0.12em",
                              color:         "var(--genre-accent)",
                            }}
                          >
                            {trait}
                          </div>
                        )}
                        {disposition && (
                          <div
                            className="ew-serif"
                            style={{
                              fontSize:  11,
                              color:     "#6a5530",
                            }}
                          >
                            {disposition}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Class step ────────────────────────────────────────────── */}
        {stage === "class" && selectedGenre && (
          <div>
            <h1 className="text-2xl font-bold mb-2 text-center tracking-wide text-glow"
              style={{ color: "var(--color-primary)" }}>
              Choose Your Class
            </h1>
            <p className="text-center text-sm mb-8" style={{ color: "var(--color-muted)" }}>
              Your class defines your strengths and starting gear.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {backgroundIds.map((bgId) => {
                const isSelected   = selectedBackground === bgId;
                const arch         = ARCHETYPE_MAP[bgId];
                const flavor       = CLASS_FLAVOR[bgId];
                const primaryKey   = arch?.primary as string | undefined;
                const primaryShort = primaryKey ? STAT_SHORT[primaryKey] ?? primaryKey : "—";
                const primaryLong  = primaryKey ? STAT_LABEL[primaryKey] ?? primaryKey : "—";
                const statColor    = primaryKey ? STAT_COLOR[primaryKey] ?? "var(--genre-accent)" : "var(--genre-accent)";
                const description  = flavor?.description ?? "A path with its own quiet weight.";
                const itemHint     = flavor?.startingItem ?? "Class kit";
                const Icon         = CLASS_ICON[bgId];
                // UI-fix-B B2 — selected cards use the STAT colour
                // (not genre accent) so each class's identity reads at
                // a glance. position relative anchors the ✓ overlay;
                // overflow hidden clips the bottom-edge stat strip
                // against the card's rounded corners.
                const cardSx: React.CSSProperties = {
                  background:   isSelected
                    ? `linear-gradient(color-mix(in srgb, ${statColor} 8%, transparent), color-mix(in srgb, ${statColor} 8%, transparent)), var(--card-bg)`
                    : "var(--card-bg)",
                  border:       isSelected
                    ? `2px solid ${statColor}`
                    : "1px solid var(--card-border)",
                  borderRadius: "var(--card-radius, 7px)",
                  boxShadow:    isSelected
                    ? `0 0 12px color-mix(in srgb, ${statColor} 30%, transparent)`
                    : "var(--card-shadow)",
                  cursor:       "pointer",
                  position:     "relative",
                  overflow:     "hidden",
                };
                return (
                  <button
                    key={bgId}
                    onClick={() => {
                      if (selectedBackground !== bgId) {
                        setOriginOptions([]);
                        setSelectedOrigin(null);
                        setAppearanceByGender({ male: [], female: [] });
                        setAppearanceOptions([]);
                        setSelectedAppearance(null);
                      }
                      setSelectedBackground(bgId);
                    }}
                    className="text-left p-5 transition-all duration-150 hover:scale-[1.02] active:scale-[0.99] flex flex-col"
                    style={cardSx}
                  >
                    {isSelected && <CheckMark color={statColor} />}

                    {/* Icon + class name + role badge row */}
                    <div className="flex items-start gap-3 mb-2">
                      <span
                        aria-hidden
                        style={{
                          color:      statColor,
                          display:    "inline-flex",
                          flexShrink: 0,
                          marginTop:  2,
                        }}
                      >
                        {/* UI-fix-B B2 — icon at 20px (was 24). */}
                        {Icon ? <Icon size={20} stroke={1.75} /> : null}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          className="ew-serif"
                          style={{
                            fontSize:   14,
                            color:      "#e2cda0",
                            lineHeight: 1.2,
                          }}
                        >
                          {formatClassName(bgId)}
                        </div>
                        <span
                          className="ew-sans uppercase"
                          style={{
                            display:       "inline-block",
                            fontSize:      9,
                            letterSpacing: "0.12em",
                            color:         statColor,
                            background:    `color-mix(in srgb, ${statColor} 14%, transparent)`,
                            border:        `1px solid color-mix(in srgb, ${statColor} 36%, transparent)`,
                            borderRadius:  20,
                            padding:       "1px 8px",
                            marginTop:     4,
                            fontWeight:    600,
                          }}
                        >
                          {primaryShort}
                        </span>
                      </div>
                    </div>

                    <p
                      className="ew-serif"
                      style={{
                        fontSize:     12,
                        lineHeight:   1.5,
                        color:        "#9a7e52",
                        flex:         1,
                        marginBottom: 12,
                      }}
                    >
                      {description}
                    </p>

                    {/* Bottom block + 3px stat-color strip per B2.
                        Strip bleeds through the p-5 padding via
                        negative margins; card's overflow:hidden clips
                        it to the radius. */}
                    <div
                      style={{
                        borderTop:     `1px solid color-mix(in srgb, ${statColor} 20%, transparent)`,
                        paddingTop:    8,
                        display:       "flex",
                        flexDirection: "column",
                        gap:           2,
                      }}
                    >
                      <span
                        className="ew-sans uppercase"
                        style={{
                          fontSize:      8,
                          letterSpacing: "0.18em",
                          color:         "#6a5530",
                        }}
                      >
                        Primary: {primaryLong}
                      </span>
                      <span
                        className="ew-sans"
                        style={{
                          fontSize: 9,
                          color:    "#6a5530",
                        }}
                      >
                        Starts with: {itemHint}
                      </span>
                    </div>
                    <div
                      aria-hidden
                      style={{
                        height:       3,
                        background:   statColor,
                        marginLeft:   -20,
                        marginRight:  -20,
                        marginBottom: -20,
                        marginTop:    10,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Origin step ───────────────────────────────────────────── */}
        {stage === "origin" && (
          <div>
            <h1 className="text-2xl font-bold mb-2 text-center tracking-wide text-glow"
              style={{ color: "var(--color-primary)" }}>
              Choose Your Origin
            </h1>
            <p className="text-center text-sm mb-8" style={{ color: "var(--color-muted)" }}>
              Your past shapes your starting kit.
            </p>

            {originLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="p-5 rounded border animate-pulse"
                    style={{
                      borderColor: "var(--color-border)",
                      backgroundColor: "color-mix(in srgb, var(--color-border) 40%, transparent)",
                      minHeight: "180px",
                    }}
                  />
                ))}
              </div>
            ) : creationMode === "custom" ? (
              <div className="max-w-2xl mx-auto">
                <textarea
                  value={selectedOrigin?.description ?? originOptions[0]?.description ?? ""}
                  onChange={(e) => {
                    const text = e.target.value;
                    const base = originOptions[0] ?? genericOriginFallbacks(selectedBackground ?? "")[0];
                    setSelectedOrigin({
                      ...base,
                      label: base.label,
                      description: text,
                    });
                  }}
                  rows={4}
                  className="w-full px-4 py-3 rounded border bg-transparent text-sm outline-none"
                  style={{
                    borderColor: "var(--color-border)",
                    color:       "var(--color-text)",
                  }}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {originOptions.map((opt) => {
                  const isSelected = selectedOrigin?.id === opt.id;
                  const bonus = opt.starting_bonus;
                  const shortDesc = trimToSentences(opt.description, 2);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedOrigin(opt)}
                      className="text-left p-5 transition-all duration-150 hover:scale-[1.02] active:scale-[0.99] flex flex-col"
                      style={cardStyle(isSelected)}
                    >
                      {isSelected && <CheckMark />}
                      <div
                        className="ew-serif mb-2"
                        style={{
                          fontSize:   14,
                          color:      "#e2cda0",
                          lineHeight: 1.25,
                        }}
                      >
                        {opt.label}
                      </div>
                      <p
                        className="ew-serif mb-4 flex-1"
                        style={{
                          fontSize:   12,
                          lineHeight: 1.5,
                          color:      "#9a7e52",
                        }}
                      >
                        {shortDesc}
                      </p>
                      <div
                        className="border-t pt-3 mt-auto"
                        style={{ borderColor: "var(--card-border)" }}
                      >
                        {bonus.type === "gold" ? (
                          // Currency value — JetBrains Mono tabular for
                          // the number, Inter Tight for the label.
                          <div
                            className="flex items-baseline gap-1.5"
                            style={{ color: "var(--genre-accent)" }}
                          >
                            <span
                              style={{
                                fontFamily:         "var(--mono)",
                                fontVariantNumeric: "tabular-nums",
                                fontSize:           13,
                                fontWeight:         600,
                              }}
                            >
                              +{bonus.gold_amount}
                            </span>
                            <span
                              className="ew-sans uppercase"
                              style={{
                                fontSize:      9,
                                letterSpacing: "0.12em",
                              }}
                            >
                              Gold
                            </span>
                          </div>
                        ) : (
                          <div
                            className="ew-sans"
                            style={{ fontSize: 9, color: "#6a5530" }}
                          >
                            Starts with: {bonus.item_name}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Appearance step ──────────────────────────────────────── */}
        {stage === "appearance" && (
          <div>
            <h1 className="text-2xl font-bold mb-2 text-center tracking-wide text-glow"
              style={{ color: "var(--color-primary)" }}>
              Choose Your Appearance
            </h1>
            <p className="text-center text-sm mb-8" style={{ color: "var(--color-muted)" }}>
              How does the world see you?
            </p>

            {/* Gender toggle — also lives on the name step but offered here too
                so players can resolve the gendered descriptors before they
                see them. */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {(["male", "female"] as const).map((g) => {
                const isSelected = gender === g;
                return (
                  <button
                    key={g}
                    onClick={() => handleGenderSelect(g)}
                    className="px-3 py-1.5 rounded border text-xs font-bold tracking-widest transition-all"
                    style={{
                      borderColor: isSelected ? "var(--color-primary)" : "var(--color-border)",
                      color:       isSelected ? "var(--color-primary)" : "var(--color-muted)",
                      backgroundColor: isSelected
                        ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
                        : "transparent",
                    }}
                  >
                    {g === "male" ? "♂ MALE" : "♀ FEMALE"}
                  </button>
                );
              })}
            </div>

            {appearanceLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="p-5 rounded border animate-pulse"
                    style={{
                      borderColor: "var(--color-border)",
                      backgroundColor: "color-mix(in srgb, var(--color-border) 40%, transparent)",
                      minHeight: "180px",
                    }}
                  />
                ))}
              </div>
            ) : creationMode === "custom" ? (
              <div className="max-w-2xl mx-auto">
                <textarea
                  value={selectedAppearance?.summary ?? ""}
                  onChange={(e) => {
                    setSelectedAppearance({
                      descriptors: selectedAppearance?.descriptors ?? [],
                      summary:     e.target.value,
                    });
                  }}
                  rows={4}
                  placeholder="Describe your character's physical presence..."
                  className="w-full px-4 py-3 rounded border bg-transparent text-sm outline-none"
                  style={{
                    borderColor: "var(--color-border)",
                    color:       "var(--color-text)",
                  }}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {appearanceOptions.map((opt, idx) => {
                  const isSelected = selectedAppearance?.summary === opt.summary;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedAppearance(opt)}
                      className="text-left p-5 transition-all duration-150 hover:scale-[1.02] active:scale-[0.99] flex flex-col"
                      style={cardStyle(isSelected)}
                    >
                      {isSelected && <CheckMark />}
                      {/* UI-fix-B B5 — trait pills render in two states.
                          At rest (unselected card): muted dark chrome
                          (#181410 bg, #2d2618 border, #6a5530 text).
                          Selected (card is chosen): warm amber tint
                          (rgba(196,148,58,.10) bg, .55 border, #c4943a
                          text). The state mirrors the card selection —
                          per-trait toggling isn't part of this surface;
                          the player picks one complete appearance and
                          its pills brighten together. */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {opt.descriptors.map((d, i) => (
                          <span
                            key={i}
                            className="ew-sans uppercase"
                            style={{
                              padding:       "4px 12px",
                              borderRadius:  20,
                              fontSize:      9,
                              letterSpacing: "0.10em",
                              fontWeight:    600,
                              border:        isSelected
                                ? "1.5px solid rgba(196,148,58,0.55)"
                                : "1px solid #2d2618",
                              background:    isSelected
                                ? "rgba(196,148,58,0.10)"
                                : "#181410",
                              color:         isSelected ? "#c4943a" : "#6a5530",
                            }}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                      <p
                        className="ew-serif flex-1"
                        style={{
                          fontSize:   12,
                          lineHeight: 1.5,
                          color:      "#9a7e52",
                        }}
                      >
                        {opt.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Name + Gender step ────────────────────────────────────── */}
        {stage === "name" && (
          <div>
            <h1 className="text-2xl font-bold mb-2 text-center tracking-wide text-glow"
              style={{ color: "var(--color-primary)" }}>
              Name Your Character
            </h1>
            <p className="text-center text-sm mb-10" style={{ color: "var(--color-muted)" }}>
              Your name will echo through {wcdWorldName ?? worldNameFallback}.
            </p>

            <div className="max-w-md mx-auto">
              {/* Day 23.5B hotfix (FIX 3A) — gender toggle removed from
                  the name step. Gender lives on the appearance step only. */}
              <label
                htmlFor="char-name"
                className="block text-xs uppercase tracking-widest mb-2"
                style={{ color: "var(--color-muted)" }}
              >
                Character Name
              </label>
              <div className="flex items-stretch gap-2">
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
                  className="flex-1 px-4 py-3 outline-none transition-colors ew-serif"
                  style={{
                    // UI-12 CHANGE 7 — dark input bg, Cormorant Garamond
                    // italic 15px, caret in the genre accent colour.
                    background:   "#141210",
                    border:       nameError
                      ? "1px solid #c44040"
                      : "1px solid var(--card-border)",
                    borderRadius: 6,
                    color:        "#e2cda0",
                    caretColor:   "var(--genre-accent)",
                    fontSize:     15,
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = nameError ? "#c44040" : "var(--genre-accent)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = nameError ? "#c44040" : "var(--card-border)";
                  }}
                />
                <button
                  onClick={handleRandomName}
                  disabled={randomNameLoading}
                  className="px-3 py-2 rounded border text-xs font-bold tracking-widest transition-all"
                  style={{
                    borderColor: "var(--color-border)",
                    color:       "var(--color-muted)",
                    opacity:     randomNameLoading ? 0.5 : 1,
                    cursor:      randomNameLoading ? "wait" : "pointer",
                  }}
                  title="Generate a random name"
                >
                  {randomNameLoading ? "..." : "🎲"}
                </button>
              </div>

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

              {characterName.trim().length >= 2 && !nameError && (
                <p
                  className="mt-8 text-center text-sm"
                  style={{ color: "var(--color-primary)" }}
                >
                  &ldquo;{characterName.trim()}&rdquo; — your name echoes through {wcdWorldName ?? worldNameFallback}...
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Motivation step (UI-fix-B B7) ────────────────────────── */}
        {stage === "motivation" && (
          <div>
            {/* Step header — Inter Tight 9px uppercase #6a5530.
                Replaces the previous big h1 "What Drives You?". */}
            <div
              className="ew-sans uppercase text-center mb-6"
              style={{
                fontSize:      9,
                letterSpacing: "0.12em",
                color:         "#6a5530",
              }}
            >
              Your Motivation
            </div>

            {/* Character summary card — preserved from prior UX so the
                player sees who they've built before they commit. */}
            <div
              className="max-w-md mx-auto mb-6 p-3 rounded border text-xs leading-relaxed"
              style={{
                borderColor:     "var(--color-border)",
                backgroundColor: "color-mix(in srgb, var(--color-border) 25%, transparent)",
                color:           "var(--color-muted)",
              }}
            >
              <div className="font-bold" style={{ color: "var(--color-text)" }}>
                {(() => {
                  const speciesName =
                    effectiveSpecies.find((s) => s.id === selectedSpeciesId)?.name
                    ?? "Unknown";
                  const className = selectedBackground
                    ? formatClassName(selectedBackground)
                    : "Adventurer";
                  return `${speciesName} ${className}`;
                })()}
                {selectedOrigin && (
                  <span style={{ color: "var(--color-muted)" }}>
                    {"  ·  "}{selectedOrigin.label}
                  </span>
                )}
              </div>
              {selectedAppearance?.summary && (
                <div className="mt-1">
                  &ldquo;{selectedAppearance.summary.length > 60
                    ? `${selectedAppearance.summary.slice(0, 57).trim()}...`
                    : selectedAppearance.summary}&rdquo;
                </div>
              )}
              {characterName.trim() && (
                <div className="mt-1" style={{ color: "var(--color-primary)" }}>
                  {characterName.trim()}
                </div>
              )}
            </div>

            <div className="max-w-md mx-auto">
              {/* Prompt line — Cormorant Garamond italic 14px #9a7e52
                  per B7 spec, sits ABOVE the textarea (the textarea's
                  own placeholder is now the example instead). */}
              <div
                className="ew-serif mb-2"
                style={{
                  fontSize:  14,
                  color:     "#9a7e52",
                }}
              >
                I came to this world to…
              </div>

              <textarea
                value={motivation}
                onChange={(e) => setMotivation(e.target.value.slice(0, 120))}
                maxLength={120}
                placeholder="e.g. seek the truth behind my village's destruction"
                className="w-full ew-serif outline-none"
                style={{
                  background:    "rgba(196,148,58,0.04)",
                  border:        "1px solid rgba(196,148,58,0.20)",
                  borderRadius:  "var(--card-radius, 7px)",
                  padding:       "12px 14px",
                  color:         "#e2cda0",
                  caretColor:    "var(--genre-accent)",
                  fontSize:      14,
                  minHeight:     80,
                  resize:        "vertical",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--genre-accent)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(196,148,58,0.20)"; }}
              />

              {/* Counter row — Inter Tight 8px #4a3828 right-aligned
                  per B7 spec. Randomize button keeps its accent
                  treatment so it stays scannable. */}
              <div className="flex items-center mt-2 gap-3">
                <button
                  onClick={handleRandomMotivation}
                  disabled={randomMotivationLoading || isLoading}
                  className="ew-sans uppercase"
                  style={{
                    fontSize:      9,
                    letterSpacing: "0.12em",
                    fontWeight:    600,
                    color:         "var(--color-accent)",
                    cursor:        randomMotivationLoading ? "wait" : "pointer",
                    opacity:       randomMotivationLoading ? 0.5 : 1,
                  }}
                >
                  {randomMotivationLoading ? "..." : "✦ Randomize →"}
                </button>
                <span
                  className="ew-sans ml-auto"
                  style={{
                    fontSize: 8,
                    color:    motivation.length >= 100 ? "#ef4444" : "#4a3828",
                  }}
                >
                  {motivation.length} / 120
                </span>
              </div>

              {/* Skip link — Cormorant Garamond italic 10px #4a3828,
                  underline on hover. Sits below the counter row so it
                  reads as an escape hatch rather than a default. */}
              <div className="mt-4 text-center">
                <button
                  onClick={() => { setMotivation(""); handleSubmit(); }}
                  className="ew-serif transition-colors"
                  style={{
                    fontSize:       10,
                    color:          "#4a3828",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.textDecoration = "underline"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.textDecoration = "none"; }}
                  disabled={isLoading}
                >
                  Play as a blank slate
                </button>
              </div>
            </div>

            {submitError && (
              <p className="mt-6 text-center text-sm" style={{ color: "#ef4444" }}>
                {submitError}
              </p>
            )}

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

        {/* ── Navigation buttons ─────────────────────────────────────── */}
        {/* UI-fix-B — shared typography rule for wizard buttons:
            var(--sans) uppercase 9px letter-spacing 0.12em. The Back
            button is reduced to muted chrome on every step except the
            genre step where it's invisibly disabled. */}
        {stage !== "forging" && (
          <div className="flex items-center justify-between mt-10 max-w-3xl mx-auto">
            <button
              onClick={handleBack}
              disabled={stage === "genre"}
              className="ew-sans uppercase px-5 py-3 rounded border transition-all"
              style={{
                fontSize:      9,
                letterSpacing: "0.12em",
                fontWeight:    600,
                borderColor:   stage === "genre" ? "transparent" : "var(--color-border)",
                color:         stage === "genre" ? "transparent" : "var(--color-muted)",
                cursor:        stage === "genre" ? "default" : "pointer",
              }}
            >
              ← Back
            </button>

            {stage === "motivation" ? (
              <button
                onClick={handleSubmit}
                disabled={!canAdvance() || isLoading}
                className="ew-sans uppercase px-6 py-3 rounded border transition-all"
                style={{
                  fontSize:      9,
                  letterSpacing: "0.12em",
                  fontWeight:    600,
                  borderColor:   canAdvance() && !isLoading ? "var(--color-primary)" : "var(--color-border)",
                  color:         canAdvance() && !isLoading ? "var(--color-primary)" : "var(--color-muted)",
                  backgroundColor:
                    canAdvance() && !isLoading
                      ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                      : "transparent",
                  opacity: canAdvance() && !isLoading ? 1 : 0.5,
                  cursor:  canAdvance() && !isLoading ? "pointer" : "not-allowed",
                }}
              >
                {isLoading ? "Creating..." : "Begin Adventure →"}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!canAdvance()}
                className="ew-sans uppercase px-6 py-3 rounded border transition-all"
                style={{
                  fontSize:      9,
                  letterSpacing: "0.12em",
                  fontWeight:    600,
                  borderColor:   canAdvance() ? "var(--color-primary)" : "var(--color-border)",
                  color:         canAdvance() ? "var(--color-primary)" : "var(--color-muted)",
                  backgroundColor: canAdvance()
                    ? "color-mix(in srgb, var(--color-primary) 10%, transparent)"
                    : "transparent",
                  opacity: canAdvance() ? 1 : 0.5,
                  cursor:  canAdvance() ? "pointer" : "not-allowed",
                }}
              >
                Next →
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
