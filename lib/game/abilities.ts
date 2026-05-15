import type {
  AbilityCategory, AbilityId, AbilityStatShort, AbilityTemplate,
} from "@/types/game";

/**
 * P6 — Ability library v1.
 *
 * Pure data + lookup helpers. No React, no hooks, no engine coupling
 * — safe to import from anywhere (the eventual combat integration in
 * P7 reads `ABILITY_LIBRARY` to resolve a slot id into mechanical
 * effect).
 *
 * Source of truth: docs/ability-library.md (125 entries: 25 classes ×
 * 5 = 4 active slots + 1 passive each). The `description` strings are
 * terse mechanical lines pulled from the doc; the world-flavor
 * `name` is overwritten per-world by P7 (the WCD generator receives
 * each class's mechanical block and emits thematic renames).
 *
 * Slot unlock schedule per rules 97 / 164 + the prompt-stated values
 * (NOT the stale "level 3/6/9" line in docs/ability-library.md):
 *   level <  5  → 1 slot  (slot 1 only)
 *   level 5-9   → 2 slots
 *   level 10-14 → 3 slots
 *   level ≥ 15  → 4 slots
 */

// ─────────────────────────────────────────────────────────────────────────────
// Construction helpers — keep each entry to a single, readable line below.
// ─────────────────────────────────────────────────────────────────────────────

function snake(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function slot(
  class_id:    string,
  slot:        1 | 2 | 3 | 4,
  base_name:   string,
  category:    AbilityCategory,
  description: string,
  charge_stat: AbilityStatShort,
): AbilityTemplate {
  return {
    id:            `${class_id}_${snake(base_name)}`,
    name:          base_name,
    base_name,
    class_id,
    category,
    description,
    base_charges:  2,
    charge_stat,
    is_passive:    false,
    slot_position: slot,
  };
}

function passive(
  class_id:    string,
  base_name:   string,
  category:    AbilityCategory,
  description: string,
): AbilityTemplate {
  return {
    id:           `${class_id}_${snake(base_name)}`,
    name:         base_name,
    base_name,
    class_id,
    category,
    description,
    base_charges: 2,
    is_passive:   true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The 125 entries — grouped by genre and class to mirror the doc.
// ─────────────────────────────────────────────────────────────────────────────

const ENTRIES: AbilityTemplate[] = [
  // ── FANTASY ────────────────────────────────────────────────────────────
  // KNIGHT — STR primary, AGI secondary
  slot   ("knight", 1, "Shield Bash",   "damage", "1d6 + STR. 80% WEAKENED on enemy.",                  "str"),
  slot   ("knight", 2, "War Cry",       "damage", "1d8 + STR. Pure damage burst, no status.",          "str"),
  slot   ("knight", 3, "Battle Mend",   "heal",   "Restore 20 HP and FORTIFY self for 2 rounds.",       "str"),
  slot   ("knight", 4, "Iron Stance",   "buff",   "FORTIFIED self for 3 rounds.",                       "str"),
  passive("knight",    "Iron Resolve",  "buff",   "Take -1 from ALL damage sources."),

  // ROGUE — AGI primary, PER secondary
  slot   ("rogue",  1, "Poison Strike",   "damage",  "1d4 + AGI. 40% POISONED on enemy.",               "agi"),
  slot   ("rogue",  2, "Flurry",          "damage",  "Two hits of 1d4 + AGI — two separate damage rolls.", "agi"),
  slot   ("rogue",  3, "Fade",            "buff",    "HASTENED self; clears own CHILLED or WEAKENED.",  "agi"),
  slot   ("rogue",  4, "Marked Target",   "debuff",  "60% FRIGHTENED on enemy.",                        "per"),
  passive("rogue",     "Shadow Step",     "utility", "+15% flee success chance."),

  // MAGE — INT primary, PER secondary
  slot   ("mage",   1, "Frost Bolt",      "damage",  "1d8 + INT. CHILLED guaranteed on enemy.",         "int"),
  slot   ("mage",   2, "Arcane Blast",    "damage",  "1d10 + INT. Highest single-hit damage, no status.", "int"),
  slot   ("mage",   3, "Arcane Shield",   "buff",    "FORTIFIED self for 3 rounds.",                    "int"),
  slot   ("mage",   4, "Hex",             "debuff",  "50% WEAKENED on enemy.",                          "int"),
  passive("mage",      "Arcane Focus",    "buff",    "+2 to INT checks while any ability charges remain."),

  // RANGER — PER primary, AGI secondary
  slot   ("ranger", 1, "Hunter's Arrow",  "damage",  "1d6 + PER. 25% POISONED on enemy.",               "per"),
  slot   ("ranger", 2, "Rapid Shot",      "damage",  "Two hits of 1d4 + AGI.",                          "agi"),
  slot   ("ranger", 3, "Steady Aim",      "buff",    "HASTENED and FOCUSED self, 2 rounds each.",       "per"),
  slot   ("ranger", 4, "Crippling Shot",  "debuff",  "55% WEAKENED on enemy.",                          "per"),
  passive("ranger",    "Wilderness Instinct", "buff", "+2 PER on all checks. +10% flee success."),

  // HERALD — CHA primary, STR secondary
  slot   ("herald", 1, "Inspiring Strike", "damage", "1d6 + STR. FORTIFIED self for 1 round.",          "cha"),
  slot   ("herald", 2, "Fear Shout",       "damage", "1d4 + CHA (psychic). 50% FRIGHTENED on enemy.",   "cha"),
  slot   ("herald", 3, "Rally",            "heal",   "Restore 20 HP and FOCUSED self for 2 rounds.",    "cha"),
  slot   ("herald", 4, "Bolstering Presence", "buff", "FORTIFIED self and allies for 2 rounds.",        "cha"),
  passive("herald",    "Commanding Presence", "buff", "+2 CHA saves vs FRIGHTENED. +5% merchant discount."),

  // ── CYBERPUNK ──────────────────────────────────────────────────────────
  // NETRUNNER — INT primary, PER secondary
  slot   ("netrunner", 1, "ICE Spike",      "damage", "1d6 + INT. 40% FRIGHTENED (Glitched) on enemy.", "int"),
  slot   ("netrunner", 2, "System Crash",   "damage", "1d8 + INT. Full overload, no status.",          "int"),
  slot   ("netrunner", 3, "Firewall",       "buff",   "FORTIFIED self for 3 rounds.",                  "int"),
  slot   ("netrunner", 4, "Trace Exploit",  "debuff", "50% WEAKENED (Overloaded) on enemy.",           "int"),
  passive("netrunner",    "Neural Interface", "buff", "+2 INT checks. +1 to all rolls vs mechanical / cyber enemies."),

  // FIXER — CHA primary, INT secondary
  slot   ("fixer",     1, "Street Justice", "damage", "1d6 + STR. 25% WEAKENED (Battered) on enemy.",  "cha"),
  slot   ("fixer",     2, "Dirty Move",     "damage", "1d4 + AGI. 35% FRIGHTENED (Glitched) on enemy.","agi"),
  slot   ("fixer",     3, "Back-Channel",   "heal",   "Restore 20 HP — call in a favor.",             "cha"),
  slot   ("fixer",     4, "Smooth Talk",    "buff",   "FOCUSED self; clears own FRIGHTENED.",         "cha"),
  passive("fixer",        "Street Cred",    "buff",   "10% merchant discount. +2 CHA checks."),

  // STREET SAMURAI — STR primary, AGI secondary
  slot   ("street_samurai", 1, "Blade Rush",     "damage", "1d8 + STR. Pure speed, no status.",        "str"),
  slot   ("street_samurai", 2, "Thermal Strike", "damage", "1d6 + STR. 30% BURNING (Overheating).",    "str"),
  slot   ("street_samurai", 3, "Combat Stim",    "heal",   "HASTENED self for 3 rounds; restore 10 HP.","agi"),
  slot   ("street_samurai", 4, "Disabling Cut",  "debuff", "55% WEAKENED (Battered) on enemy.",        "str"),
  passive("street_samurai",    "Reflex Augment", "buff",   "+1 AGI on all attack rolls. -1 physical damage taken."),

  // ENFORCER — STR primary, AGI secondary
  slot   ("enforcer", 1, "Brutalize",          "damage", "1d10 + STR. Highest single hit in Cyberpunk.","str"),
  slot   ("enforcer", 2, "Suppression Burst",  "damage", "1d4 + AGI. 40% CHILLED (Cryo-locked).",      "agi"),
  slot   ("enforcer", 3, "Adrenaline Surge",   "heal",   "Restore 25 HP and FORTIFIED self for 2 rounds.","str"),
  slot   ("enforcer", 4, "Intimidate",         "debuff", "70% FRIGHTENED (Glitched) on enemy.",        "str"),
  passive("enforcer",    "Thick Skin",         "buff",   "-2 from all physical damage taken."),

  // GHOST — AGI primary, PER secondary
  slot   ("ghost", 1, "Silenced Strike", "damage", "1d6 + AGI. 40% POISONED (Infected) on enemy.",     "agi"),
  slot   ("ghost", 2, "Ambush",          "damage", "Two hits of 1d4 + AGI — double strike from shadow.","agi"),
  slot   ("ghost", 3, "Ghost Protocol",  "buff",   "HASTENED self; clears own FRIGHTENED.",            "agi"),
  slot   ("ghost", 4, "Sensor Blind",    "debuff", "45% CHILLED (Cryo-locked) on enemy.",              "per"),
  passive("ghost",    "Shadow Operative", "utility", "+15% flee success. +2 PER while exploring."),

  // ── HORROR ─────────────────────────────────────────────────────────────
  // INVESTIGATOR — INT primary, PER secondary
  slot   ("investigator", 1, "Desperate Blow",         "damage", "1d6 + STR. 25% WEAKENED (Withered).","int"),
  slot   ("investigator", 2, "Holy Water",             "damage", "1d8 + INT — full vs corruption / psychic, half vs physical.","int"),
  slot   ("investigator", 3, "Steel Nerve",            "heal",   "Restore 15 HP; clear own FRIGHTENED (Maddened); FOCUSED 2 rounds.","cha"),
  slot   ("investigator", 4, "Unsettling Revelation",  "debuff", "55% FRIGHTENED (Maddened) on enemy.","int"),
  passive("investigator",    "Pattern Recognition",    "buff",   "+2 PER on all checks. Immune to the first FRIGHTENED application per combat."),

  // CULTIST — CHA primary, INT secondary
  slot   ("cultist", 1, "Eldritch Touch",   "damage", "1d6 + INT (corruption). 35% FRIGHTENED (Maddened).","int"),
  slot   ("cultist", 2, "Dark Blessing",    "damage", "1d8 + CHA (void).",                              "cha"),
  slot   ("cultist", 3, "Blood Rite",       "heal",   "Restore 25 HP.",                                 "cha"),
  slot   ("cultist", 4, "Binding Curse",    "debuff", "70% FRIGHTENED (Maddened) — highest fear rate in Horror.","cha"),
  passive("cultist",    "Eldritch Resilience", "buff", "+3 saves vs FRIGHTENED. +2 CHA checks."),

  // SURVIVOR — STR primary, AGI secondary
  slot   ("survivor", 1, "Savage Strike",      "damage", "1d8 + STR — desperation.",                   "str"),
  slot   ("survivor", 2, "Improvised Weapon",  "damage", "1d6 + STR. 35% WEAKENED (Withered).",        "str"),
  slot   ("survivor", 3, "Second Wind",        "heal",   "Restore 30 HP — best heal in Horror.",       "str"),
  slot   ("survivor", 4, "Flee Route",         "buff",   "Clear own FRIGHTENED; HASTENED self for 2 rounds.","agi"),
  passive("survivor",    "Survivor's Grit",    "buff",   "+2 STR saves. Take -1 from all damage."),

  // PHANTOM — INT primary, CHA secondary
  slot   ("phantom", 1, "Wail",             "damage", "1d6 + CHA (void). 50% FRIGHTENED (Maddened) on enemy.","cha"),
  slot   ("phantom", 2, "Spectral Touch",   "damage", "1d8 + INT (corruption).",                       "int"),
  slot   ("phantom", 3, "Phase Shift",      "buff",   "HASTENED self; FORTIFIED self for 1 round.",    "int"),
  slot   ("phantom", 4, "Haunt",            "debuff", "50% WEAKENED (Withered) on enemy.",             "cha"),
  passive("phantom",    "Ethereal Form",    "buff",   "+1 to all saves. +2 to FRIGHTENED saves specifically."),

  // MEDIUM — INT primary, CHA secondary
  slot   ("medium", 1, "Spirit Blast",     "damage", "1d6 + INT (void) — focused spiritual force.",    "int"),
  slot   ("medium", 2, "Channel Wrath",    "damage", "1d8 + INT. 30% WEAKENED (Withered).",            "int"),
  slot   ("medium", 3, "Spirit Mend",      "heal",   "Restore 20 HP and FOCUSED self for 2 rounds.",   "cha"),
  slot   ("medium", 4, "Ward",             "buff",   "FORTIFIED self for 3 rounds.",                   "cha"),
  passive("medium",    "Spirit Sight",     "utility","+3 PER on all checks. +1 breadcrumb discovery chance."),

  // ── SPACE OPERA ────────────────────────────────────────────────────────
  // COMMANDER — CHA primary, INT secondary
  slot   ("commander", 1, "Tactical Strike", "damage", "1d6 + INT. 40% WEAKENED (Destabilized).",      "int"),
  slot   ("commander", 2, "Fire Command",    "damage", "1d8 + CHA (coordinated psychic command).",     "cha"),
  slot   ("commander", 3, "Field Rally",     "heal",   "Restore 20 HP and FORTIFIED self for 2 rounds.","cha"),
  slot   ("commander", 4, "Morale Boost",    "buff",   "HASTENED and FOCUSED self, 2 rounds each.",    "cha"),
  passive("commander",    "Strategic Mind",  "buff",   "+2 INT checks. +1 all checks while all ability charges remain."),

  // PILOT — AGI primary, PER secondary
  slot   ("pilot", 1, "Precision Shot",       "damage", "1d6 + PER. 30% BURNING (Plasma-burned).",     "per"),
  slot   ("pilot", 2, "Evasive Strike",       "damage", "1d6 + AGI. HASTENED self for 1 round.",       "agi"),
  slot   ("pilot", 3, "Emergency Thrust",     "buff",   "HASTENED self for 3 rounds; clears own CHILLED (Cryo-locked).","agi"),
  slot   ("pilot", 4, "Disorienting Maneuver","debuff", "55% FRIGHTENED (Disoriented) on enemy.",      "per"),
  passive("pilot",    "Combat Reflexes",      "buff",   "+2 AGI saves. +10% flee success."),

  // ENGINEER — INT primary, STR secondary
  slot   ("engineer", 1, "Overcharge",      "damage", "1d6 + INT. 35% BURNING (Plasma-burned, electrical).","int"),
  slot   ("engineer", 2, "EMP Burst",       "damage", "1d8 + INT. WEAKENED (Destabilized): 50% vs mechanical, 25% organic.","int"),
  slot   ("engineer", 3, "Repair Module",   "heal",   "Restore 25 HP (field repair).",                 "int"),
  slot   ("engineer", 4, "System Weaken",   "debuff", "55% WEAKENED (Destabilized) on enemy.",         "int"),
  passive("engineer",    "Technical Mastery","buff",  "+2 INT checks. Identify item damage types on sight."),

  // MARINE — STR primary, AGI secondary
  slot   ("marine", 1, "Plasma Charge",     "damage", "1d8 + STR. 25% BURNING (Plasma-burned).",       "str"),
  slot   ("marine", 2, "Breach and Clear",  "damage", "Two hits of 1d4 + AGI — sweep fire.",           "agi"),
  slot   ("marine", 3, "Combat Stims",      "heal",   "Restore 20 HP and HASTENED self for 2 rounds.", "str"),
  slot   ("marine", 4, "Suppressive Fire",  "debuff", "40% CHILLED (Cryo-locked) on enemy.",           "agi"),
  passive("marine",    "Battle Hardened",   "buff",   "-1 from all damage taken. +1 STR saves."),

  // RECON — PER primary, AGI secondary
  slot   ("recon", 1, "Sniper Shot",        "damage", "1d8 + PER. High single-target, no status.",     "per"),
  slot   ("recon", 2, "Cryo Round",         "damage", "1d4 + PER. CHILLED (Cryo-locked) guaranteed.",  "per"),
  slot   ("recon", 3, "Ghost Mode",         "buff",   "HASTENED and FOCUSED self, 2 rounds each.",     "agi"),
  slot   ("recon", 4, "Target Acquired",    "debuff", "55% WEAKENED (Destabilized) on enemy.",         "per"),
  passive("recon",     "Long Range",        "buff",   "+2 PER checks. +3 to first attack roll each combat."),

  // ── POST-APOCALYPTIC ───────────────────────────────────────────────────
  // SCAVENGER — PER primary, INT secondary
  slot   ("scavenger", 1, "Improvised Explosive", "damage", "1d8 + PER. 30% BURNING (Scorched).",      "per"),
  slot   ("scavenger", 2, "Trick Shot",           "damage", "1d6 + PER. 25% WEAKENED (Battered, joint shot).","per"),
  slot   ("scavenger", 3, "Field Patch",          "heal",   "Restore 20 HP.",                          "int"),
  slot   ("scavenger", 4, "Smoke Grenade",        "debuff", "45% CHILLED (Frosted) on enemy.",         "per"),
  passive("scavenger",    "Scavenger's Eye",      "utility","+2 PER while exploring. Material nodes occasionally yield +1."),

  // RAIDER — STR primary, AGI secondary
  slot   ("raider", 1, "Savage Assault",  "damage", "1d10 + STR — highest damage in Post-Apoc.",       "str"),
  slot   ("raider", 2, "Blood Frenzy",    "damage", "1d6 + STR. HASTENED self (violence as fuel).",    "str"),
  slot   ("raider", 3, "Hardened",        "buff",   "FORTIFIED self for 3 rounds.",                    "str"),
  slot   ("raider", 4, "War Cry",         "debuff", "60% FRIGHTENED (Shaken) on enemy.",               "str"),
  passive("raider",    "Brutal Fighter",  "buff",   "-1 from all damage taken. +1 to all damage dealt."),

  // MEDIC — INT primary, CHA secondary
  slot   ("medic", 1, "Toxic Injection",    "damage", "1d4 + INT. 50% POISONED (Irradiated) on enemy.","int"),
  slot   ("medic", 2, "Scalpel Strike",     "damage", "1d6 + INT. 30% WEAKENED (Battered, precision cut).","int"),
  slot   ("medic", 3, "Field Surgery",      "heal",   "Restore 35 HP — highest heal in Post-Apoc and best heal in game.","int"),
  slot   ("medic", 4, "Antidote Mastery",   "utility","Clear own active ailment; FOCUSED self for 2 rounds.","int"),
  passive("medic",     "Combat Medicine",   "buff",   "All HP healed from items +5. +2 INT on all checks."),

  // RUNNER — AGI primary, PER secondary
  slot   ("runner", 1, "Hit and Run",     "damage", "1d4 + AGI. HASTENED self for 1 round (strike then vanish).","agi"),
  slot   ("runner", 2, "Shiv",            "damage", "1d6 + AGI. 35% POISONED (Irradiated, tainted blade).","agi"),
  slot   ("runner", 3, "Parkour",         "buff",   "HASTENED self for 3 rounds.",                   "agi"),
  slot   ("runner", 4, "Flash Grenade",   "debuff", "45% CHILLED (Frosted) on enemy.",                "per"),
  passive("runner",    "Born to Run",     "utility","+20% flee success (best in game). +2 AGI saves."),

  // DEMAGOGUE — CHA primary, INT secondary
  slot   ("demagogue", 1, "Crowd's Wrath",     "damage", "1d6 + CHA (manifests as psychic force through the crowd).","cha"),
  slot   ("demagogue", 2, "Battle Rhetoric",   "damage", "1d4 + CHA. 60% FRIGHTENED (Shaken) on enemy.","cha"),
  slot   ("demagogue", 3, "Rousing Speech",    "heal",   "Restore 20 HP and FORTIFIED self.",          "cha"),
  slot   ("demagogue", 4, "Demoralize",        "debuff", "75% FRIGHTENED (Shaken) — highest fear application rate in game.","cha"),
  passive("demagogue",    "Silver Tongue",     "buff",   "10% merchant discount. +2 CHA on all checks."),
];

// ─────────────────────────────────────────────────────────────────────────────
// Public exports
// ─────────────────────────────────────────────────────────────────────────────

/** Keyed by ability id for O(1) lookup. Frozen at module load — the
 *  library is hardcoded data, never mutated at runtime. */
export const ABILITY_LIBRARY: Readonly<Record<AbilityId, AbilityTemplate>> =
  Object.freeze(
    Object.fromEntries(ENTRIES.map((e) => [e.id, e]))
  );

/** Every ability — passive + 4 slot abilities — for a given class.
 *  Order: slot 1, slot 2, slot 3, slot 4, passive. */
export function getAbilitiesForClass(classId: string): AbilityTemplate[] {
  const matches = ENTRIES.filter((e) => e.class_id === classId);
  // Stable order: slot ascending, passive last.
  return matches.slice().sort((a, b) => {
    if (a.is_passive && !b.is_passive) return 1;
    if (!a.is_passive && b.is_passive) return -1;
    return (a.slot_position ?? 0) - (b.slot_position ?? 0);
  });
}

/** The class passive — exactly one per class. Returns undefined for an
 *  unknown class id (defensive — every shipped class has a passive). */
export function getPassiveForClass(classId: string): AbilityTemplate | undefined {
  return ENTRIES.find((e) => e.class_id === classId && e.is_passive);
}

/** Pool of slot candidates for a given (class, slot). v1 library ships
 *  exactly 1 per slot per class; the v2 variant pool (8-10/class, 3
 *  drawn per playthrough) is a P7 follow-up. */
export function getSlotAbilitiesForClass(
  classId: string,
  slot:    1 | 2 | 3 | 4,
): AbilityTemplate[] {
  return ENTRIES.filter(
    (e) => e.class_id === classId && !e.is_passive && e.slot_position === slot
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot unlock schedule (rules 97 / 164 + prompt spec)
//
//   level <  5  → 1 slot  (slot 1 only)
//   level 5-9   → 2 slots
//   level 10-14 → 3 slots
//   level ≥ 15  → 4 slots
// ─────────────────────────────────────────────────────────────────────────────

/** Number of equipped-ability slots unlocked at a given player level. */
export function getUnlockedSlotCount(level: number): number {
  if (level >= 15) return 4;
  if (level >= 10) return 3;
  if (level >= 5)  return 2;
  return 1;
}

/** Whether the named slot is unlocked at the given level. Slot 1 is
 *  always unlocked. */
export function isSlotUnlocked(
  slot:  1 | 2 | 3 | 4,
  level: number,
): boolean {
  return slot <= getUnlockedSlotCount(level);
}
