# Endless Worlds RPG — Quest System Specification

**Version:** 1.0
**Status:** Design complete, implementation pending (Day 23A-D)
**Authority:** This document is the definitive design reference for the quest system. All implementation must match this spec. Divergences require design discussion first.

---

## Philosophy

The quest system follows the Skyrim/Fallout/Morrowind architecture — not a mobile checklist. The world has a problem that predates the player. It's baked into the atmosphere, the NPC dialogue, the dungeon themes, the lore. The player can ignore the main quest for hours but it's always there, looming.

Side quests emerge from genuine world content: NPCs with lives, dungeons with histories, environments that remember what happened in them. They reward exploration, not completion.

**The governing principle:** The player discovers the quest — they're never pushed. Journal entries read like the player's own notes, not mission briefs. The world doesn't say "go to X." It says "something happened, and here's what I know about it."

---

## Main Quest Architecture

### The A+C Hybrid Model

Every world's main quest is two things simultaneously:

**A — World-theme inseparable:** The quest IS the world's defining crisis, woven into the WCD from generation time. In a volcanic world, the quest is about the volcano (or whatever cosmic thing the volcano represents). In a trade world, it's about the trade system's collapse. The theme and the threat are the same story.

**C — Structural archetype:** The bones of the narrative follow one of six archetypes. The WCD selects the archetype that fits the theme most naturally, then writes the world AS IF that archetype has always been true. The player should never be able to identify the template — it should feel like this world's unique crisis.

### The Six Archetypes

| Archetype | Core dramatic tension | Natural finales |
|---|---|---|
| **Ancient Awakening** | Something dormant has woken. Destroy it, contain it, or understand it. | Confrontation or Choice |
| **Power Vacuum** | The old order collapsed. Factions compete to fill it. The player tips the balance. | Choice (always) |
| **Corruption** | Something pure is rotting from within. Find the source — cut it out or accept it. | Confrontation or Discovery |
| **Forbidden Knowledge** | A truth has been uncovered. Some want it spread; others want it buried forever. | Discovery (always) |
| **Sacrifice** | The world's survival requires a price. Who pays — and can it be refused? | Choice (always) |
| **The Return** | Something that left is coming back. Everything built in its absence will unmake. | Confrontation or Discovery |

The WCD selects an archetype. It does NOT label it in any output — it simply writes the world and quest as that archetype, naturally. The archetype is an internal generation tool, not a visible tag.

### Genre tone note
Archetypes are dramatic structure, not emotional register. The same archetype reads completely differently by genre:
- Light Fantasy + Ancient Awakening: a sleeping forest deity stirring, wonder-filled stakes, Zelda energy
- Cyberpunk + Power Vacuum: mega-corp collapse, three factions racing to inherit weapons and infrastructure
- Horror + Corruption: the town water connects to something underneath, people are changing

---

## The Faction Web

Every main quest generates **2-3 factions** with different relationships to the threat:

- **The Defenders** — they know about the threat and are actively trying to stop it "the right way"
- **The Exploiters** — they see the threat as an opportunity for power
- **The Deniers** — they refuse to acknowledge the threat or actively suppress knowledge of it (not always villains — sometimes just afraid)

Factions are not labeled. They express through NPC dialogue, dungeon content, and lore. A settlement blacksmith might quietly funnel resources to the Defenders. An innkeeper might be on the Exploiters' payroll. A cult in a dungeon might be the Deniers' militant arm.

Player faction alignment is tracked via world_state flags (not a visible meter). The two endings map naturally to: Defenders path vs. something more complicated.

---

## Finale Types

The WCD selects the finale type based on archetype affinity:

**Confrontation** — Find the source of the threat, face it directly, end it with force or negotiation. Satisfying for action players. Boss fight is the climax.

**Choice** — At the climax, the player has built enough understanding (through exploration and lore) to choose between two fundamentally different resolutions. Both are "winning" but mean different things for the world. Boss fight may precede or be replaced by the choice moment.

**Discovery** — The finale requires the player to understand something true about the world before they can end the quest. The boss fight is the test of whether they paid attention. High-INT and high-PER players are rewarded most.

### Two Endings Per World

Every world has exactly two possible resolutions, both generated by the WCD at world creation:
- Both are satisfying — neither is secretly "wrong"
- One is typically darker than the other
- They map to different faction alignments
- Both are discoverable across multiple playthroughs

The two endings are stored in the WCD/WorldBible schema as `resolution_a` and `resolution_b` with: narrative text, world-state consequences, NPC reaction changes, and which finale type triggers each.

---

## The Floating Breadcrumb Model

The main quest has a **fixed spine** and **flexible discovery points.**

### Fixed (generated at world creation, anchored to specific locations):
- **Act 1 breadcrumb** — always in the starting region. Triggered by first major NPC conversation OR first dungeon completion, whichever happens first. This always gives the player a direction.
- **Climax location** — the designated boss room of the world's main dungeon, OR a world-unique location generated for the quest. Always exists. Always anchored.

### Floating (content defined at world creation, location attached at generation time):
- **Act 2 breadcrumb** — attaches to the first eligible new region the player expands into
- **Act 3 breadcrumb** — attaches to a later eligible region OR a wandering NPC the player discovers

Eligibility: when a new region generates (RegionBible), the prompt receives active quest context and seeds a breadcrumb if the region contains a plausible anchor (an NPC who would know, a dungeon with relevant history, a lore site). If not eligible, the breadcrumb floats to the next generation.

### What this means in play:
- Players who explore slowly find clues concentrated nearby
- Players who rush to new regions find clues scattered across the world
- Journal entries always feel native to where they were found — they read as if the dungeon, NPC, or lore item always contained this
- No breadcrumb is ever *missing* — if the player reaches the climax without all of them, the climax still works (Discovery finales are less satisfying without the context, which is appropriate)

### Side quest breadcrumbs follow the same model:
- NPC-sourced quests: fixed to that NPC
- Environment-sourced quests: float to newly generated content when eligible

---

## Quest Journal — Morrowind Model

### Structure
```
JOURNAL
├── Main Quest: [World Quest Name]
│   ├── Current Objective (pinned at top — directional but not a GPS pin)
│   └── Discovered entries (newest first, diary format)
├── Side Quests
│   ├── [Active Quest 1]
│   │   ├── Current Objective
│   │   └── Discovered entries
│   └── ...
├── Completed
│   └── [Quest name] — [one-line summary]
└── Failed
    └── [Quest name] — [why it ended]
```

### Journal Entry Format
LLM-generated, 2-4 sentences, first-person past tense. Sounds like the player's own observations:

*"I found Aldric dead in the forge, his body positioned deliberately — not a fight. Someone wanted him silenced. The only thing missing from his workshop was the rubbing he made of the broken oath-stone."*

### Objective Format
Directional but not explicit. Tells the player what they know and what they're wondering about — not where to go:
- GOOD: *"Find out who silenced Aldric and why the oath-stone rubbing mattered."*
- BAD: *"Go to The Hollowed Barrow and search the third chamber."*

The player figures out the *where* from the journal entry content, NPC dialogue, and their own exploration.

### Relationship with Log Book
Quest entries appear in BOTH the Log Book (existing) and the Journal (new). The Log Book remains the chronological feed. The Journal is the organized reference. QUEST-tagged entries in the Log Book are what seed the Journal.

---

## Side Quests

### Sources

**From NPCs:**
- Named NPCs at settlements can offer quests via dialogue
- Faction NPCs offer quests tied to the main story thread
- Quest triggers: certain dialogue outcomes (CHA/INT success on specific topics)
- Example: *"The innkeeper mentions her son left for the barrow two weeks ago and hasn't returned."* → Quest entry seeds in journal.

**From environment:**
- A body in a dungeon with a letter referencing someone in a settlement
- A carved inscription that implies a hidden location
- Evidence of something that happened (bloodstains, abandoned camp, a sealed door with a name on it)
- A LORE item that contradicts official NPC accounts of history
- Trigger: reading/examining the object seeds the journal entry

### Quest Variety
Side quests generate with variety in:
- **Structure:** simple fetch, investigation, faction conflict, rescue, moral dilemma
- **Reward:** gold, items, information, faction standing, lore, unique equipment
- **Consequence:** some quests affect NPC availability, faction standing, world state
- **Tone:** matches world theme — a dark world's side quests are grimmer than a light world's

### Failure States
~20-30% of side quests have a failure state. Failure triggers from **player choices**, never from time passing:
- Helping the wrong faction in a conflict quest
- Taking an action that contradicts the quest's premise (killing the quest-giver, choosing the opposing faction's outcome)
- Accessing a hostile location before completing a prerequisite (not a timer — a specific trigger)

Failed quests go to Failed section. The world acknowledges it. Some cascade: the person you failed to help is now hostile, or dead, or the information is permanently lost.

---

## Location Type Taxonomy

### Node Types for Day 23

| Type | Description | Combat? | Lore? | NPCs? | Settlement? |
|---|---|---|---|---|---|
| Settlement Hub | Safe town with services | No | Yes | Yes | Yes |
| Small Outpost | 1-2 NPCs, limited services | No | Moderate | 1-2 | Partial |
| Wilderness/Path | Outdoor travel node, connects regions | Optional | Atmospheric | Rare | No |
| Dungeon/Equivalent | Dangerous multi-room structure | Yes | Yes | Enemies | No |
| Landmark | Ruins, monument, sacred site | Optional | High | Maybe | No |
| Abandoned Settlement | Ruined former town | Optional | High | Maybe (ghosts/survivors) | No |

### Genre dungeon equivalents

| Genre | Primary term | Secondary types |
|---|---|---|
| Fantasy | Dungeon / Ruin / Tomb | Corrupted Temple · Brigand Fortress · Cursed Cave |
| Cyberpunk | Corp Facility / Server Farm | Black Site · Underground Network · Abandoned Grid Sector |
| Horror | Asylum / Abandoned Hospital | Cult Compound · Haunted Estate · Quarantine Zone |
| Space Opera | Derelict Ship / Enemy Base | Ancient Alien Structure · Abandoned Station · Crashed Vessel |
| Post-Apoc | Vault / Raider Compound | Pre-War Facility · Flooded Subway · Ruined Skyscraper |

The code uses `dungeon` internally. The WCD/WorldBible/RegionBible prompts use genre-appropriate terminology.

### Region Structure Variety
Not every region has a settlement. Regional types:
- **Settled region** — 1 settlement hub + 2-3 additional locations. Safest. Starting region is always this type.
- **Frontier region** — 1 small outpost + 3-4 locations. Lower density of services. Wilderness nodes prevalent.
- **Hostile zone** — No settlement. Mostly dungeons, landmarks, wilderness. High encounter chance even in non-combat nodes. Greater loot and lore rewards. Players must prepare before entering — healing, supplies, escape route.

The WCD determines region type distribution across the world. A volcanic world might have 1 settled region and 3 hostile zones. A political intrigue world might have 3 settled regions with competing factions.

---

## Dungeon Structure

### Room Layout (Day 23)
```
[Entrance Room]
       ↓
[Middle Chamber]  →  [Side Chamber (optional branch)]
       ↓
[Boss Room] ← LOCKED until Middle Chamber condition met
```

### Room Contents
- **Entrance Room:** Scene-setting description. Container guaranteed (rule 84). Optional encounter. Often contains the lock's hint ("An inscription describes a seal needed to enter the vault below").
- **Middle Chamber:** More substantial. Container guaranteed. Likely encounter. Contains the lock solution (key, code, lore flag). Environmental story continues.
- **Side Chamber (optional):** No locks. Container with above-average loot rarity. Lore items that hint at boss history or weakness. Purely rewarding — never required.
- **Boss Room:** Named enemy. Boss-quality loot. Quest-relevant revelation. Main quest breadcrumb may be here. Unlocking this room requires Middle Chamber completion.

### The Lock System

**Data structure:**
```typescript
interface DungeonLock {
  type: "key" | "code" | "riddle" | "sequence" | "stat" | "lore_flag";
  hint: string;          // narrator description shown when player clicks locked nav card
  condition: LockCondition;
  bypass?: StatBypass;   // optional stat-based alternative path
  unlocked: boolean;
}

type LockCondition =
  | { type: "key"; item_id: string; item_name: string }
  | { type: "code"; answer: string; display: string }      // answer normalized to lowercase
  | { type: "riddle"; answers: string[]; prompt: string }  // multiple valid answer strings
  | { type: "sequence"; items: string[]; prompt: string }  // ordered item/name list
  | { type: "stat"; stat: keyof Attributes; minimum: number }
  | { type: "lore_flag"; flags: string[] }  // all flags must be set in world_state

interface StatBypass {
  stat: keyof Attributes;
  minimum: number;
  flavor: string;  // "The door is old. You force it." / "You find the mechanism's flaw."
}
```

### The Six Lock Types

**Physical Key** — Most legible. A named item (not a generic key) found in an earlier room. The item has its own story.
- *"The iron door has a circular recess shaped like a medallion."*
- Use key item from inventory → opens.
- Best for: any dungeon, first-time players, when the key is a story object.

**Code / Number** — Player finds a code in lore content earlier in the dungeon.
- *"A carved panel beside the sealed door has four rotating glyph-slots."*
- Answer planted in a LORE item (a year, a count, a significant number from the dungeon's history).
- Player types the answer in free text input.
- Best for: Cyberpunk, Post-Apoc, analytical players, codes with narrative weight.

**Riddle** — The dungeon poses a question. The answer requires lateral thinking or careful reading.
- *"The door's inscription: 'What am I — I guided armies across the continent, yet I have never moved.'"*
- Multiple valid answer strings accepted ("map", "a map", "maps").
- PER check can reveal a hint if the player is stuck.
- Best for: ancient/mystical dungeons, Mage/Scholar builds.

**Sequence / Pattern** — Player must apply information from a LORE item to order or select correctly.
- *"Five stone busts, each bearing a name. One is already turned inward."*
- Lore item found earlier listed these names in order of rank/date/significance.
- Player inputs the sequence in free text.
- Best for: larger dungeons, history-heavy worlds, lore-collector players.

**Stat Check** — No puzzle. Raw capability.
- STR ≥ threshold: force the door
- INT ≥ threshold: find the mechanism's flaw
- PER ≥ threshold: notice a hidden secondary latch
- Best for: players who haven't found the key, as an alternative path — never as the only option.

**Lore Flag** — The door opens only for those who have absorbed the dungeon's story.
- *"Only those who know the names of the Fallen Three may pass."*
- Player must have read three specific LORE items (flags set in world_state).
- Engine checks flags — player doesn't type anything; the door simply opens if conditions are met.
- Best for: the most invested explorers, boss room gates in major quest dungeons.

### Design principles for locks
- **Every lock's answer is findable within the same dungeon** — no external knowledge required
- **Multiple paths where possible** — code lock has a stat bypass; key lock has a STR bypass
- **PER helps notice clues** — a low-PER player sees the room; a high-PER player sees what's in it
- **The key is a thing with history** — it's not "brass key #2", it's "the Warden's Seal" with a lore entry
- **Variety per world** — WCD guidance ensures different dungeons in the same world use different lock types

### UX: Nav bar as puzzle interface
Locked rooms appear in the nav bar marked as inaccessible (different color, lock icon). Clicking a locked room opens a description screen instead of navigating:

```
THE VAULT DOOR
[Lock description and hint]

[EXAMINE]  [TRY TO FORCE IT — STR 6 required]  [ENTER CODE]  [CLOSE]
```

When the player has the relevant item, a `[USE {ITEM NAME}]` button appears. The available actions are derived from the lock type and the player's current state.

---

## The Ending Screen

When the main quest resolves (boss fight + resolution condition met):

1. LLM generates a resolution narrative (3-4 paragraphs, specific to which ending was reached, written as a Morrowind-style journal epilogue)
2. Resolution screen appears:

```
─────────────────────────────────────────────
THE WORLD OF [WORLD NAME] HAS CHANGED

[One-line summary of what the player did]
[One-line summary of what it meant for the world]

Time played     2h 14m
Level reached   6
Quests          3 complete · 4 undiscovered
Enemies         34 defeated
Defining choice [the faction/decision that determined the ending]
─────────────────────────────────────────────

         [CONTINUE EXPLORING]     [FINISH HERE]
```

**Continue Exploring:** Main quest marked complete in journal. World persists. NPCs acknowledge what happened. Remaining side quests still available. The world feels changed.

**Finish Here:** Session closes. World saved in "completed" state. Foundation for world save/replay feature — a completed world can be revisited with a new character.

---

## Day 23 Implementation Split

### Day 23A — World Structure Expansion
*Do first — everything else depends on it*
- WorldBible: 3-4 locations per region, typed (settlement/outpost/wilderness/dungeon/landmark/abandoned)
- RegionBible: same
- Hostile zone regions with no settlement
- Dungeons: 3 rooms (entrance → middle → boss) with locked boss room
- New DungeonLock type and data structures
- Locked nav cards show correctly, description screen shows on click
- Lock resolution UI (buttons + text input per lock type)
- Simple key lock for Day 23A; full lock variety in Day 23B

### Day 23B — Quest Schema + Data Structures
*Second — defines the data layer everything else writes to*
- WCD prompt expanded: generates archetype (internal), faction web (3 factions), threat description, finale type, 2 resolution states, Act 1 breadcrumb anchor, climax location designation
- WorldBible main_quest schema expanded significantly: title, archetype, threat, factions, breadcrumbs (Act 1 fixed, Acts 2-3 floating with content defined), two endings
- types/game.ts: full Quest schema (MainQuest, SideQuest, QuestEntry, QuestStatus, DungeonLock)
- MasterState: quest_threads field, faction_alignment field
- RegionBible route: receives active quest_threads in prompt, seeds floating breadcrumbs if eligible

### Day 23C — Quest Discovery + Journal UI
*Third — wires the experience*
- Act 1 trigger: first named NPC conversation OR first dungeon completion
- Journal UI component (Morrowind model): Main / Side / Completed / Failed sections
- Journal entries LLM-generated (short, first-person, diary format)
- Log Book quest entries tagged QUEST
- Objective format: directional, not explicit
- Quest entries seed from: NPC dialogue outcomes, LORE item reads, dungeon completions, environmental discoveries
- All six lock types fully implemented

### Day 23D — Side Quest Generation
*Fourth — populates the world*
- NPC dialogue can spawn side quests (triggered by specific dialogue outcomes)
- Environmental discovery spawns side quests (letters, bodies, inscriptions)
- Quest variety generation in WorldBible/RegionBible
- Quest failure states + world_state consequences
- Faction alignment tracking and NPC response changes
- Ending screen component

---

## Notes on future expansion

**Dungeon depth (post-Day-23):** 3 rooms is Day 23. Variable depth (1-5 rooms based on dungeon type and region tier) is a later expansion. The DungeonLock infrastructure supports this from Day 23A.

**More lock types:** The six types above cover Day 23. Later additions could include: environmental interaction ("move the stones in the right order"), multi-key locks, time-gated locks (certain world_state must be true). The DungeonLock schema is designed to be extended.

**Quest escalation:** After Day 23D, a future round should wire the faction alignment tracking to world-state changes — NPCs who were neutral turn hostile or friendly based on accumulated choices.

**Boss variety:** Day 23 bosses are WorldBible-generated with unique names and appropriate stats. Post-Day-23, bosses should have unique ability types, phase-based health (two HP thresholds with different behavior), and quest-specific dialogue before the fight.
