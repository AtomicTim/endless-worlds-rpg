# Combat System — Design Spec (Day 20)

**Status:** Spec frozen. Implementation pending.
**Version:** 1.0
**Last updated:** V8.30 design pass.
**Reference:** Used as authoritative source for the Day 20 implementation prompt. Defer to `/docs/architecture-spec.md` for all Domain 1 vs Domain 2 questions.

---

## 1. Design Philosophy

Combat follows the same Hybrid Authority Model as the rest of the game:

- **Domain 1 (Code):** All combat math. Hit rolls, damage, initiative, HP changes, victory/defeat, loot generation, XP awards. Pure deterministic resolution.
- **Domain 2 (Content, frozen):** Enemy roster (genre bestiary + region-specific). Loot tables. Boss definitions.
- **AI:** Narrates each round in 1 sentence (longer beats on crits and KOs only). Receives the resolved outcome as input. Never decides anything.

Combat is a separate "mode" that takes over the UI until the encounter resolves. No fleeing into normal navigation mid-fight, no save scumming through navigation tricks. One encounter, fully resolved, then back to exploration.

---

## 2. Phasing — What Day 20 Ships vs. Defers

**Day 20 ships:**
- Tagged-location encounters (dungeon / wilderness / etc with `encounter_chance` per node)
- Combat mode UI (HP bars, turn counter, action buttons, story feed integration)
- Four player actions (Attack, Defend, Use Item, Flee)
- Multi-enemy combat with target picking
- d20 hit/damage/initiative math
- Genre bestiary for Fantasy (12-15 enemies), placeholder skeletons for other 4 genres
- Region-specific enemy generation in WorldBible (3-5 per region)
- Boss enemies via WorldBible main quest + dungeon roster tagging
- Loot drop on victory, XP award, defeat-returns-to-settlement penalty
- Permanent combat log in story feed

**Deferred to post-combat / future systems:**
- Random travel encounters (small extension after Day 20 stabilizes)
- Player-initiated combat ("attack X" from non-combat) — own session
- Class-flavored / special abilities — Day 22 leveling
- Other 4 genre bestiaries fully filled — incremental
- Enemy portrait art — art pass
- AP-based action economy — never, unless a "tactics mode" gets designed later
- Mid-combat rest/regen actions — never (item-only healing in combat)

---

## 3. Encounter Triggers

### 3.1 Tagged-location encounters (Day 20 mechanic)

Every dungeon, wilderness, and combat-eligible location node carries:

```
{
  encounter_chance: float,    // 0.0 - 1.0
  encounter_roster: string[]  // enemy ids drawn from bestiary + regional list
}
```

WorldBible and RegionBible generate these at world-creation time. Examples:

- Dungeon boss room: `encounter_chance: 1.0, encounter_roster: ["boss_velith", "fantasy_skeleton", "fantasy_skeleton"]` — 100% trigger, fights boss + 2 skeletons.
- Dungeon hallway: `encounter_chance: 0.5, encounter_roster: ["fantasy_goblin", "fantasy_skeleton"]` — 50% chance of fighting one of these.
- Bandit camp wilderness: `encounter_chance: 1.0, encounter_roster: ["fantasy_bandit", "fantasy_bandit", "fantasy_bandit"]` — guaranteed bandit fight.
- Quiet glade wilderness: `encounter_chance: 0.0` — peaceful.

On arrival at a node with `encounter_chance > 0`:
1. Code rolls `Math.random()` against `encounter_chance`.
2. If success → enter combat mode with a randomized subset of `encounter_roster` (1-4 enemies).
3. If fail → arrive peacefully, normal narration.

**Encounter selection:** Code randomly picks 1-4 enemies from the roster, weighted toward fewer enemies (e.g. 50% chance of 1 enemy, 30% of 2, 15% of 3, 5% of 4). Boss-tagged entries always solo or with their flavor adds (defined in roster as a fixed group).

### 3.2 Boss encounters

Bosses bypass the random selection. A node tagged with a boss in its roster spawns the boss every time `encounter_chance` succeeds (which for bosses is always 1.0 — boss rooms aren't optional).

Boss entries can specify guaranteed adds: `["boss_velith", "fantasy_skeleton", "fantasy_skeleton"]` always spawns Velith plus two skeletons.

---

## 4. Combat Mode UI

### 4.1 Layout

When combat starts, the normal action bar and nav cards are replaced by the combat UI:

- **Top of combat panel:** Player HP bar + name + level
- **Center:** Enemy roster panel — one row per enemy, showing name, HP bar, optional 1-line description. Highlighted on click for target selection.
- **Bottom:** Action buttons: Attack, Defend, Use Item, Flee
- **Story feed (right column, unchanged):** narrator writes round results inline, accumulating

The map and codex tabs remain accessible (player can check the codex during combat, that's fine). Save is disabled mid-combat.

### 4.2 Turn flow

1. Combat starts. Initiative rolled for player and each enemy.
2. Story feed prints `⚔ Combat begins:` followed by enemy roster summary.
3. Highest initiative acts first. Repeats in order each round.
4. **Player turn:** action buttons enabled. Player picks action.
   - If Attack: target picker activates. Player clicks an enemy. Code resolves.
   - If Defend / Use Item / Flee: resolves immediately on click.
5. AI narrates the round result (1 sentence; 2-3 on crit/KO).
6. Story feed shows result + updated HP bars.
7. Next initiative slot acts.
8. **Enemy turn:** auto-resolves. Enemy attacks player (or does enemy-specific behavior — see §6.3).
9. AI narrates.
10. Loop until combat resolves: all enemies dead (victory), player HP 0 (defeat), or successful flee.

### 4.3 Victory

- Story feed prints `⚔ Victory.`
- Code rolls loot from each defeated enemy's loot table reference. Adds to player inventory.
- Code awards XP from each defeated enemy's XP value.
- Story feed prints loot acquired + XP gained, in summary form.
- Combat UI dismissed. Normal action bar returns. Player remains at the same node.

### 4.4 Defeat

- Story feed prints `⚔ Defeat.`
- Code resets player HP to 50% of max. Removes 10% of current gold (rounded down).
- All XP earned during this combat is forfeit.
- Player is teleported back to the last visited settlement hub (`current_node_id` set).
- Combat UI dismissed. Normal exploration resumes.

### 4.5 Successful Flee

- Story feed prints `⚔ You escape.`
- Player is moved one node back along the path they came from.
- No XP, no loot, no HP penalty.
- Combat UI dismissed.

---

## 5. Action Economy & d20 Math

### 5.1 No action points

One action per turn. Effectiveness comes from rolls.

### 5.2 Attack

```
hit_roll = 1d20 + AGI_mod
target_DC = 10 + target.AGI_mod + target.armor_bonus

if hit_roll === 1: critical miss (always misses, narrated as fumble)
if hit_roll === 20: critical hit (always hits, doubles damage roll)
else if hit_roll >= target_DC: hit
else: miss

damage_roll = weapon.damage_die + STR_mod
if crit: damage = weapon.damage_die.max + 1d(weapon.damage_die) + STR_mod
target.HP -= max(damage, 1)  // attacks always do at least 1 if they hit
```

Crit threshold: **natural 20** (5% rate). Predictable, iconic, fair.
Critical miss on **natural 1** — flavor only, doesn't add penalty beyond missing.

### 5.3 Defend

Player skips their attack. Until the start of their next turn:
- All incoming damage reduced by 50% (rounded down, minimum 1)
- Player gains +2 to AGI for defense calculations

Useful for surviving a high-damage round when a heal isn't ready.

### 5.4 Use Item

Opens inventory filtered to consumables. Player picks one. Item resolves immediately:
- Health potion: heals defined HP amount (e.g. 1d8 + 4)
- Antidote: removes status effect (deferred — Day 20 has no status effects)
- Buff item: temporary stat bump (deferred)

Day 20 ships with **health potions only** as the consumable category. Future items added with the Container + Loot system Day 21.

### 5.5 Flee

```
flee_roll = 1d20 + AGI_mod
flee_DC = 10 + average(enemy.AGI_mod for each living enemy)

if flee_roll >= flee_DC: success → leave combat (§4.5)
else: fail → forfeit turn, enemies attack normally
```

Multiple enemies make fleeing harder (their average AGI is higher, especially if any are agile).

### 5.6 Initiative

```
For each combatant (player + each enemy):
  initiative = 1d20 + AGI_mod

Order: descending. Ties broken in player's favor.
Locked at combat start, doesn't re-roll between rounds.
```

---

## 6. Enemy Generation

### 6.1 Two-tier structure

**Genre Bestiary (frozen, hand-authored, in code):**
A fixed roster per genre. Lives in `/lib/game/bestiary/<genre>.ts`. Doesn't add to LLM generation time.

**Region-specific enemies (LLM-generated at WorldBible time, frozen):**
3-5 region-themed enemies generated alongside the WorldBible. Stored in `WorldBible.starting_region.enemies` and `RegionBible.enemies` arrays.

### 6.2 Enemy data structure

```ts
interface Enemy {
  id: string;                 // e.g. "fantasy_goblin", "ash_wraith_knight"
  name: string;
  description: string;        // 1 sentence, used by AI narrator
  hp_range: [number, number]; // randomized per spawn, e.g. [8, 12]
  agi_mod: number;            // typically -2 to +4
  str_mod: number;            // typically -2 to +4
  damage_die: string;         // e.g. "1d6", "1d8", "2d4"
  armor_bonus: number;        // typically 0-3
  xp_value: number;           // base XP awarded on kill
  loot_table_id: string;      // reference to the loot system (Day 21 — placeholder for Day 20)
  is_boss: boolean;
  behavior_flavor: string;    // 1 phrase: "aggressive melee", "ranged ambusher", "defensive caster"
}
```

### 6.3 Behavior flavor

For Day 20 enemy AI is dead simple: every enemy attacks the player every turn. The `behavior_flavor` field is consumed by the AI narrator only — flavor text for narration. Enemies don't actually use their behavior flavor mechanically yet.

A "ranged ambusher" goblin and a "defensive caster" wizard both just deal damage on their turn. Narration describes the difference; mechanics don't.

This is an intentional simplification. We can add behavior dispatch (target weakest, prioritize healers, focus fire, retreat at low HP) in a later combat-depth pass.

### 6.4 Fantasy genre bestiary (Day 20 launch)

Authored in code. 14 entries:

| id | name | hp | agi | str | dmg | armor | xp | flavor |
|---|---|---|---|---|---|---|---|---|
| `fantasy_giant_rat` | Giant Rat | [4,6] | +2 | -1 | 1d4 | 0 | 10 | scurrying biter |
| `fantasy_goblin` | Goblin | [6,10] | +1 | 0 | 1d6 | 1 | 25 | aggressive melee |
| `fantasy_wolf` | Wolf | [8,12] | +3 | +1 | 1d6 | 0 | 30 | pack hunter |
| `fantasy_skeleton` | Skeleton | [10,14] | 0 | +1 | 1d6 | 1 | 40 | relentless undead |
| `fantasy_bandit` | Bandit | [10,16] | +1 | +1 | 1d8 | 1 | 50 | desperate brigand |
| `fantasy_cultist` | Cultist | [10,14] | +1 | 0 | 1d6 | 0 | 50 | fanatical chanter |
| `fantasy_orc` | Orc | [16,22] | 0 | +3 | 1d10 | 2 | 75 | brutal melee |
| `fantasy_zombie` | Zombie | [14,20] | -2 | +2 | 1d8 | 0 | 65 | shambling rotter |
| `fantasy_brigand_archer` | Brigand Archer | [10,14] | +2 | +1 | 1d8 | 1 | 60 | ranged ambusher |
| `fantasy_dire_boar` | Dire Boar | [20,28] | +1 | +3 | 2d4 | 2 | 90 | charging beast |
| `fantasy_ogre` | Ogre | [30,40] | -1 | +4 | 2d6 | 2 | 150 | massive bruiser |
| `fantasy_troll` | Troll | [40,55] | 0 | +4 | 2d6 | 3 | 200 | regenerating monster |
| `fantasy_specter` | Specter | [18,25] | +3 | +1 | 1d8 | 0 | 120 | incorporeal wraith |
| `fantasy_dragon_whelp` | Dragon Whelp | [50,70] | +2 | +3 | 2d8 | 4 | 350 | apex predator |

Other genres (Cyberpunk, Horror, Space, Apoc) ship with a placeholder skeleton — 3-4 entries each — to be expanded incrementally. The architecture supports them; only Fantasy is fully populated for Day 20.

### 6.5 Region-specific enemy generation

WorldBible prompt (and RegionBible prompt) is extended to request:

```json
"enemies": [
  {
    "id": "ash_wraith_knight",
    "name": "Ash-Wraith Knight",
    "description": "A fallen oath-knight of charred bone wreathed in ash, still bound to a broken vow.",
    "hp_range": [22, 30],
    "agi_mod": 0,
    "str_mod": 2,
    "damage_die": "1d10",
    "armor_bonus": 3,
    "xp_value": 100,
    "loot_table_id": "ash_marches_undead",
    "is_boss": false,
    "behavior_flavor": "implacable melee"
  },
  // 2-4 more...
]
```

Constraints in the prompt:
- 3-5 enemies per region
- HP between 8-25 for common, 25-50 for elite, 50-100 for boss
- Modifiers between -2 and +4
- Each enemy must thematically fit the region's WCD flavor

This adds ~600-800 tokens to WorldBible. Token budgets accommodate this — WorldBible already at 8000 max_tokens. RegionBible uses similar structure but at 6000 max with stub fallback (per V8.30).

### 6.6 Boss generation

Bosses come from two sources:

1. **Main quest antagonist** (already in WorldBible main quest structure). At Day 20, extend this to include full enemy stat block. The boss for the Ashen Marches example would be Commander Velith with `is_boss: true, hp_range: [80,100], agi_mod: +2, str_mod: +4, damage_die: "2d8", armor_bonus: 4, xp_value: 1000`.

2. **Dungeon mid-bosses** — when WorldBible / RegionBible defines a dungeon, allow it to optionally specify a boss enemy with its own stat block. Same structure as quest boss but with `is_boss: true`. Grants higher XP and a guaranteed loot drop.

### 6.7 Encounter roster wiring

Each combat-eligible node has an `encounter_roster: string[]` referencing enemy ids. WorldBible/RegionBible generate these alongside enemy lists. Example:

```json
{
  "id": "the_thorned_cloister",
  "type": "dungeon",
  "encounter_chance": 0.7,
  "encounter_roster": ["fantasy_skeleton", "fantasy_cultist", "ash_wraith_knight"]
}
```

Bosses and their adds are tagged separately at the boss room sub-node, e.g.:

```json
{
  "id": "the_thorned_cloister_inner_sanctum",
  "type": "dungeon_boss_room",
  "encounter_chance": 1.0,
  "encounter_roster": ["boss_velith", "fantasy_skeleton", "fantasy_skeleton"],
  "is_boss_room": true
}
```

Boss rooms guarantee combat (chance 1.0) and lock until cleared (no flee from boss = forfeit, sends player to settlement).

---

## 7. Player Stats Wiring

Combat reads from existing player state (per CLAUDE.md):

- **HP / max HP:** existing field
- **STR_mod:** computed from STR stat (1-10 stat → -2 to +4 mod, standard d20 mapping)
- **AGI_mod:** same formula from AGI
- **Equipped weapon:** provides `damage_die` and a flat damage bonus if defined
- **Equipped armor:** provides `armor_bonus`

Day 20 assumes the player starts with sensible starting equipment (knight = longsword 1d8 + chainmail +2 armor). If the inventory system isn't quite ready for this, hardcode initial loadout per genre/class on character creation.

XP bumps existing player.xp counter. Day 22 leveling system consumes XP for level-ups; for Day 20 XP just accumulates.

---

## 8. Out-of-Combat HP Recovery

- **Settlement rest:** full HP restored. Triggered by entering any settlement hub or by an explicit "rest" action there. Free.
- **Mid-dungeon recovery:** consumables only. Health potions found in containers (Day 21) or bought from merchants.

No in-combat resting. No per-turn regen. HP is a resource managed by potions and settlement returns.

---

## 9. Defeat Penalty Specification

When player HP hits 0:

```
player.hp = floor(player.max_hp * 0.5)
player.gold = floor(player.gold * 0.9)
player.xp = previous_xp_before_combat  // forfeit any XP gained in this fight
session.current_node_id = last_visited_settlement_hub_id
```

The "last visited settlement hub" is tracked as a separate field updated whenever the player enters a settlement. Death-warp goes there.

If the player has never visited any settlement (impossible at present since starting node IS a settlement, but defensive against future edits): respawn at the starting settlement.

Story feed prints the defeat narration and the wake-up-at-settlement narration as two separate beats (former in combat mode, latter as a normal arrival event).

---

## 10. AI Narration Spec

### 10.1 Per-round prompt

Per round, the narrator gets a structured input:

```
{
  combat_event: "player_attack" | "enemy_attack" | "defend" | "use_item" | "flee_attempt" | "round_start" | "victory" | "defeat",
  actor_name: string,
  target_name: string | null,
  outcome: "hit" | "miss" | "crit" | "kill" | "defended" | "fled" | etc,
  damage_dealt: number | null,
  remaining_target_hp: number | null,
  weapon_or_item: string | null,
  enemy_behavior_flavor: string | null,  // for flavor only
  region_atmosphere: string,  // for tonal context
}
```

Narrator returns 1 sentence by default, 2-3 sentences on `outcome: "crit" | "kill"` or `combat_event: "victory" | "defeat"`.

### 10.2 Tonal guidance in prompt

Combat narration is direct and physical. No interior monologue, no cliffhanger framing. Match the genre — Fantasy combat gets blood-and-steel description, Cyberpunk gets servos-and-blood, Horror gets dread-physical, Space gets vacuum-physics, Apoc gets gritty-survival.

Example outputs:

- Hit (Fantasy): "Your longsword bites into the goblin's shoulder, drawing a thin wet line."
- Miss: "The skeleton's bony claw scrapes off your shield."
- Crit: "You drive the blade through the orc's collarbone — bone splinters and the brute staggers, life pouring out faster than rage can hold it."
- Kill: "The cultist crumples, breath rattling once before silence. The chant ends mid-syllable."
- Victory: "The last brigand falls. The clearing is yours, ringing with sudden quiet."

### 10.3 Combat log permanence

All combat narration stays in the story feed permanently after combat resolves. It is not summarized, cleared, or condensed. The story feed serves as the player's combat log and narrative record.

---

## 11. Implementation Boundaries

For the Day 20 implementation prompt, scope is limited to:

✅ Combat mode UI component
✅ Turn loop state machine
✅ d20 math resolver (`combat-resolver.ts`)
✅ Enemy data structure + Fantasy bestiary file
✅ Region-specific enemy LLM generation (extend WorldBible/RegionBible prompts)
✅ Encounter trigger in `useGameLoop` step 7 (post-arrival)
✅ Victory/defeat handlers
✅ Loot drop placeholder (XP awards working; loot is a stub until Day 21)
✅ AI narration integration (extend narrator prompt builder for combat events)
✅ Story feed combat-event rendering

🚫 NOT in scope:
- Random travel encounters (post-Day-20 follow-up)
- Player-initiated attack from non-combat (own session)
- Special abilities / class moves (Day 22)
- Other 4 genre bestiaries beyond skeleton placeholders
- Enemy portrait art
- Behavior dispatch beyond flavor text
- AP system

---

## 12. Open Questions Resolved

For traceability, here is the design conversation that locked these decisions:

| Question | Decision | Reason |
| --- | --- | --- |
| Encounter trigger model | Tagged-location (Day 20), random + player-initiated deferred | Ship the loop first, add triggers later |
| Action point system | None — one action per turn | Roll determines effectiveness |
| UI model | Dedicated combat mode | Clear feedback, CRPG idiom |
| Multi-enemy handling | Target picking | More tactical, modest complexity cost |
| Narration length | 1 sentence default, 2-3 on crit/KO | Fast pacing |
| Enemy generation | 2-tier: hand-authored bestiary + LLM region-specific | Variety without LLM time cost |
| Crit threshold | Natural 20 | Iconic, predictable |
| Initiative | 1d20 + AGI, locked at start | Standard d20 |
| Healing in combat | Items only | Tight design |
| Out-of-combat HP | Full at settlement, items elsewhere | Simple resource model |
| Combat log lifecycle | Permanent in story feed | Narrative continuity |

---

*This spec is the authoritative source for the Day 20 implementation prompt. Any later combat changes update this file first, code second.*
