"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

  // Appearance generation — fires when appearance step shown and no options yet.
  useEffect(() => {
    if (stage !== "appearance") return;
    if (!selectedGenre || !selectedBackground) return;
    if (appearanceOptions.length > 0 || appearanceLoading) return;

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
        const opts = data.options ?? [];
        setAppearanceOptions(opts.length > 0 ? opts : GENERIC_APPEARANCE_FALLBACKS);
        setAppearanceLoading(false);
      })
      .catch(() => {
        setAppearanceOptions(GENERIC_APPEARANCE_FALLBACKS);
        setAppearanceLoading(false);
      });
  }, [stage, selectedGenre, selectedBackground, selectedSpeciesId, gender, appearanceOptions.length, appearanceLoading]);

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
      setSelectedAppearance(null);
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
    // Force appearance regen on next visit if we'd already loaded options.
    if (appearanceOptions.length > 0) {
      setAppearanceOptions([]);
      setSelectedAppearance(null);
    }
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
      const res = await fetch("/api/game/generate-random-name", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre:      selectedGenre,
          species_id: selectedSpeciesId ?? "human",
          gender,
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
      setLoadingMessage("Crafting your world...");
      let bible: WorldBible | undefined;
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
        className="min-h-screen font-mono"
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

  // ── Card styling helper ────────────────────────────────────────────────────
  function cardStyle(isSelected: boolean): React.CSSProperties {
    return {
      borderColor: isSelected ? "var(--color-primary)" : "var(--color-border)",
      backgroundColor: isSelected
        ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
        : "color-mix(in srgb, var(--color-border) 40%, transparent)",
      boxShadow: isSelected
        ? "0 0 12px color-mix(in srgb, var(--color-primary) 30%, transparent)"
        : "none",
    };
  }

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
                return (
                  <button
                    key={g.id}
                    onClick={() => handleGenreSelect(g.id)}
                    className="text-left p-4 rounded border transition-all duration-150 hover:scale-[1.02] active:scale-[0.99]"
                    style={cardStyle(isSelected)}
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
                  const stat = Object.entries(sp.stat_modifiers ?? {})
                    .filter(([, v]) => typeof v === "number" && v !== 0)
                    .map(([k, v]) => {
                      const sign = (v as number) > 0 ? "+" : "−";
                      return `${sign}${Math.abs(v as number)} ${STAT_LABEL[k] ?? k}`;
                    });
                  const trait = sp.passive_traits?.[0]?.label ?? "";
                  const seed  = sp.npc_disposition_seed ?? 0;
                  const disposition =
                    seed > 5  ? "Trusted among locals"
                    : seed < -5 ? "Regarded with suspicion"
                    : "";
                  return (
                    <button
                      key={sp.id}
                      onClick={() => setSelectedSpeciesId(sp.id)}
                      className="text-left p-5 rounded border transition-all duration-150 hover:scale-[1.02] active:scale-[0.99] flex flex-col"
                      style={cardStyle(isSelected)}
                    >
                      <div
                        className="text-base font-bold mb-2 tracking-wide"
                        style={{ color: isSelected ? "var(--color-primary)" : "var(--color-text)" }}
                      >
                        {sp.name}
                      </div>
                      <p className="text-xs leading-relaxed mb-4 flex-1" style={{ color: "var(--color-muted)" }}>
                        {sp.description}
                      </p>
                      <div className="space-y-1 border-t pt-3 mt-auto"
                        style={{ borderColor: "var(--color-border)" }}>
                        {stat.length > 0 && (
                          <div className="text-xs font-bold" style={{ color: "var(--color-accent)" }}>
                            {stat.join(" · ")}
                          </div>
                        )}
                        {trait && (
                          <div className="text-xs" style={{ color: "var(--color-accent)" }}>
                            {trait}
                          </div>
                        )}
                        {disposition && (
                          <div className="text-xs italic" style={{ color: "var(--color-muted)" }}>
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
                const isSelected = selectedBackground === bgId;
                const arch       = ARCHETYPE_MAP[bgId];
                const flavor     = CLASS_FLAVOR[bgId];
                const primaryStat = arch ? STAT_LABEL[arch.primary] ?? arch.primary : "—";
                const bonusLine  = arch ? `+2 ${primaryStat}` : "";
                const description = flavor?.description
                  ?? "A path with its own quiet weight.";
                const itemHint    = flavor?.startingItem ?? "Class kit";
                return (
                  <button
                    key={bgId}
                    onClick={() => {
                      // Reset origin selections on class change.
                      if (selectedBackground !== bgId) {
                        setOriginOptions([]);
                        setSelectedOrigin(null);
                      }
                      setSelectedBackground(bgId);
                    }}
                    className="text-left p-5 rounded border transition-all duration-150 hover:scale-[1.02] active:scale-[0.99] flex flex-col"
                    style={cardStyle(isSelected)}
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
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setSelectedOrigin(opt)}
                      className="text-left p-5 rounded border transition-all duration-150 hover:scale-[1.02] active:scale-[0.99] flex flex-col"
                      style={cardStyle(isSelected)}
                    >
                      <div
                        className="text-base font-bold mb-2 tracking-wide"
                        style={{ color: isSelected ? "var(--color-primary)" : "var(--color-text)" }}
                      >
                        {opt.label}
                      </div>
                      <p className="text-xs leading-relaxed mb-4 flex-1" style={{ color: "var(--color-muted)" }}>
                        {opt.description}
                      </p>
                      <div className="border-t pt-3 mt-auto" style={{ borderColor: "var(--color-border)" }}>
                        {bonus.type === "gold" ? (
                          <div className="text-xs font-bold" style={{ color: "var(--color-accent)" }}>
                            +{bonus.gold_amount} Gold
                          </div>
                        ) : (
                          <div className="text-xs" style={{ color: "var(--color-muted)" }}>
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
                      className="text-left p-5 rounded border transition-all duration-150 hover:scale-[1.02] active:scale-[0.99] flex flex-col"
                      style={cardStyle(isSelected)}
                    >
                      <div className="flex flex-wrap gap-1 mb-3">
                        {opt.descriptors.map((d, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded text-[0.65rem] uppercase tracking-wider"
                            style={{
                              backgroundColor: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
                              color: "var(--color-primary)",
                            }}
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs italic leading-relaxed flex-1" style={{ color: "var(--color-muted)" }}>
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
              {/* Gender toggle */}
              <div className="flex items-center justify-center gap-2 mb-6">
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
                      {g === "male" ? "♂ Male" : "♀ Female"}
                    </button>
                  );
                })}
              </div>

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
                  className="flex-1 px-4 py-3 rounded border bg-transparent text-base outline-none transition-colors"
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
                  className="mt-8 text-center text-sm italic"
                  style={{ color: "var(--color-primary)" }}
                >
                  &ldquo;{characterName.trim()}&rdquo; — your name echoes through {wcdWorldName ?? worldNameFallback}...
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Motivation step ──────────────────────────────────────── */}
        {stage === "motivation" && (
          <div>
            <h1 className="text-2xl font-bold mb-2 text-center tracking-wide text-glow"
              style={{ color: "var(--color-primary)" }}>
              What Drives You?
            </h1>
            <p className="text-center text-sm mb-8" style={{ color: "var(--color-muted)" }}>
              Why are you in {wcdWorldName ?? worldNameFallback}? What do you want?
            </p>

            <div className="max-w-md mx-auto">
              <textarea
                value={motivation}
                onChange={(e) => setMotivation(e.target.value.slice(0, 120))}
                rows={3}
                maxLength={120}
                placeholder="In one sentence, who were you before this adventure..."
                className="w-full px-4 py-3 rounded border bg-transparent text-sm outline-none"
                style={{
                  borderColor: "var(--color-border)",
                  color:       "var(--color-text)",
                }}
              />
              <div className="flex items-center justify-between mt-1">
                <button
                  onClick={() => { setMotivation(""); handleSubmit(); }}
                  className="text-xs underline"
                  style={{ color: "var(--color-muted)" }}
                  disabled={isLoading}
                >
                  Skip
                </button>
                <span
                  className="text-xs"
                  style={{ color: motivation.length >= 100 ? "#ef4444" : "var(--color-muted)" }}
                >
                  {motivation.length}/120
                </span>
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
        {stage !== "forging" && (
          <div className="flex items-center justify-between mt-10 max-w-3xl mx-auto">
            <button
              onClick={handleBack}
              disabled={stage === "genre"}
              className="px-5 py-2 rounded border text-sm font-bold transition-all"
              style={{
                borderColor: stage === "genre" ? "transparent" : "var(--color-border)",
                color:       stage === "genre" ? "transparent" : "var(--color-muted)",
                cursor:      stage === "genre" ? "default" : "pointer",
              }}
            >
              ← Back
            </button>

            {stage === "motivation" ? (
              <button
                onClick={handleSubmit}
                disabled={!canAdvance() || isLoading}
                className="px-6 py-2 rounded border text-sm font-bold transition-all"
                style={{
                  borderColor: canAdvance() && !isLoading ? "var(--color-primary)" : "var(--color-border)",
                  color:       canAdvance() && !isLoading ? "var(--color-primary)" : "var(--color-muted)",
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
                className="px-6 py-2 rounded border text-sm font-bold transition-all"
                style={{
                  borderColor: canAdvance() ? "var(--color-primary)" : "var(--color-border)",
                  color:       canAdvance() ? "var(--color-primary)" : "var(--color-muted)",
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
