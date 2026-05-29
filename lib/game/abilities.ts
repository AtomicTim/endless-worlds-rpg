import type {
  AbilityCategory, AbilityEffects, AbilityId, AbilityStatShort,
  AbilityTemplate, Attributes,
} from "@/types/game";

/**
 * P6 — Ability library v1 (data) + P7 — combat resolution effects.
 *
 * Pure data + lookup helpers. No React, no hooks. The eventual combat
 * integration in combat-engine.ts reads ABILITY_LIBRARY to resolve a
 * slot id into mechanical effect.
 *
 * Source of truth: docs/ability-library.md (125 entries: 25 classes ×
 * 5 = 4 active slots + 1 passive each). The `description` strings are
 * terse mechanical lines pulled from the doc; the world-flavor `name`
 * is overwritten per-world by P7's WCD generator (deferred — flavor
 * naming lands when the WCD knows the class).
 *
 * P7 adds a structured `effects` payload on each active ability (the
 * doc strings are human-readable but not engine-parseable; rather than
 * parsing prose, we hand-encode the same mechanics into a typed map).
 *
 * Slot unlock schedule (rules 97 / 164 + prompt spec):
 *   level <  5  → 1 slot  (slot 1 only)
 *   level 5-9   → 2 slots
 *   level 10-14 → 3 slots
 *   level ≥ 15  → 4 slots
 */

// ─────────────────────────────────────────────────────────────────────────────
// Construction helpers
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
// The 125 entries — grouped by genre / class to mirror the doc.
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
// P7 — mechanical effects per ability id. Keyed off so the entry list
// above stays readable. Merged into AbilityTemplate.effects at freeze
// time. Passives + utility-only abilities omit a row here.
//
// NOTE: keys must match the id generated by snake(base_name).
// snake() replaces ALL non-alphanumeric chars with "_", so apostrophes
// become underscores: "Hunter's Arrow" → "hunter_s_arrow".
// ─────────────────────────────────────────────────────────────────────────────

const EFFECTS: Record<string, AbilityEffects> = {
  // FANTASY
  knight_shield_bash:       { damage_die: "1d6", damage_stat: "str", target_status: { id: "weakened",   chance: 0.80 } },
  knight_war_cry:           { damage_die: "1d8", damage_stat: "str" },
  knight_battle_mend:       { heal_amount: 20, self_statuses: ["fortified"] },
  knight_iron_stance:       { self_statuses: ["fortified"] },

  rogue_poison_strike:      { damage_die: "1d4", damage_stat: "agi", target_status: { id: "poisoned",   chance: 0.40 } },
  rogue_flurry:             { damage_die: "1d4", damage_stat: "agi", hits: 2 },
  rogue_fade:               { self_statuses: ["hastened"], clears_self_ids: ["chilled", "weakened"] },
  rogue_marked_target:      { target_status: { id: "frightened", chance: 0.60 } },

  mage_frost_bolt:          { damage_die: "1d8", damage_stat: "int", target_status: { id: "chilled",    chance: 1.00 } },
  mage_arcane_blast:        { damage_die: "1d10", damage_stat: "int" },
  mage_arcane_shield:       { self_statuses: ["fortified"] },
  mage_hex:                 { target_status: { id: "weakened", chance: 0.50 } },

  // "Hunter's Arrow" → snake → "hunter_s_arrow" (apostrophe becomes _)
  ranger_hunter_s_arrow:    { damage_die: "1d6", damage_stat: "per", target_status: { id: "poisoned",   chance: 0.25 } },
  ranger_rapid_shot:        { damage_die: "1d4", damage_stat: "agi", hits: 2 },
  ranger_steady_aim:        { self_statuses: ["hastened", "focused"] },
  ranger_crippling_shot:    { target_status: { id: "weakened", chance: 0.55 } },

  herald_inspiring_strike:  { damage_die: "1d6", damage_stat: "str", self_statuses: ["fortified"] },
  herald_fear_shout:        { damage_die: "1d4", damage_stat: "cha", target_status: { id: "frightened", chance: 0.50 } },
  herald_rally:             { heal_amount: 20, self_statuses: ["focused"] },
  herald_bolstering_presence: { self_statuses: ["fortified"] },

  // CYBERPUNK
  netrunner_ice_spike:      { damage_die: "1d6", damage_stat: "int", target_status: { id: "frightened", chance: 0.40 } },
  netrunner_system_crash:   { damage_die: "1d8", damage_stat: "int" },
  netrunner_firewall:       { self_statuses: ["fortified"] },
  netrunner_trace_exploit:  { target_status: { id: "weakened", chance: 0.50 } },

  fixer_street_justice:     { damage_die: "1d6", damage_stat: "str", target_status: { id: "weakened",   chance: 0.25 } },
  fixer_dirty_move:         { damage_die: "1d4", damage_stat: "agi", target_status: { id: "frightened", chance: 0.35 } },
  fixer_back_channel:       { heal_amount: 20 },
  fixer_smooth_talk:        { self_statuses: ["focused"], clears_self_ids: ["frightened"] },

  street_samurai_blade_rush:     { damage_die: "1d8", damage_stat: "str" },
  street_samurai_thermal_strike: { damage_die: "1d6", damage_stat: "str", target_status: { id: "burning", chance: 0.30 } },
  street_samurai_combat_stim:    { self_statuses: ["hastened"], heal_amount: 10 },
  street_samurai_disabling_cut:  { target_status: { id: "weakened", chance: 0.55 } },

  enforcer_brutalize:           { damage_die: "1d10", damage_stat: "str" },
  enforcer_suppression_burst:   { damage_die: "1d4", damage_stat: "agi", target_status: { id: "chilled", chance: 0.40 } },
  enforcer_adrenaline_surge:    { heal_amount: 25, self_statuses: ["fortified"] },
  enforcer_intimidate:          { target_status: { id: "frightened", chance: 0.70 } },

  ghost_silenced_strike: { damage_die: "1d6", damage_stat: "agi", target_status: { id: "poisoned", chance: 0.40 } },
  ghost_ambush:          { damage_die: "1d4", damage_stat: "agi", hits: 2 },
  ghost_ghost_protocol:  { self_statuses: ["hastened"], clears_self_ids: ["frightened"] },
  ghost_sensor_blind:    { target_status: { id: "chilled", chance: 0.45 } },

  // HORROR
  investigator_desperate_blow:         { damage_die: "1d6", damage_stat: "str", target_status: { id: "weakened",   chance: 0.25 } },
  investigator_holy_water:             { damage_die: "1d8", damage_stat: "int" },
  investigator_steel_nerve:            { heal_amount: 15, clears_self_ids: ["frightened"], self_statuses: ["focused"] },
  investigator_unsettling_revelation:  { target_status: { id: "frightened", chance: 0.55 } },

  cultist_eldritch_touch: { damage_die: "1d6", damage_stat: "int", target_status: { id: "frightened", chance: 0.35 } },
  cultist_dark_blessing:  { damage_die: "1d8", damage_stat: "cha" },
  cultist_blood_rite:     { heal_amount: 25 },
  cultist_binding_curse:  { target_status: { id: "frightened", chance: 0.70 } },

  survivor_savage_strike:     { damage_die: "1d8", damage_stat: "str" },
  survivor_improvised_weapon: { damage_die: "1d6", damage_stat: "str", target_status: { id: "weakened", chance: 0.35 } },
  survivor_second_wind:       { heal_amount: 30 },
  survivor_flee_route:        { clears_self_ids: ["frightened"], self_statuses: ["hastened"] },

  phantom_wail:           { damage_die: "1d6", damage_stat: "cha", target_status: { id: "frightened", chance: 0.50 } },
  phantom_spectral_touch: { damage_die: "1d8", damage_stat: "int" },
  phantom_phase_shift:    { self_statuses: ["hastened", "fortified"] },
  phantom_haunt:          { target_status: { id: "weakened", chance: 0.50 } },

  medium_spirit_blast:  { damage_die: "1d6", damage_stat: "int" },
  medium_channel_wrath: { damage_die: "1d8", damage_stat: "int", target_status: { id: "weakened", chance: 0.30 } },
  medium_spirit_mend:   { heal_amount: 20, self_statuses: ["focused"] },
  medium_ward:          { self_statuses: ["fortified"] },

  // SPACE OPERA
  commander_tactical_strike: { damage_die: "1d6", damage_stat: "int", target_status: { id: "weakened", chance: 0.40 } },
  commander_fire_command:    { damage_die: "1d8", damage_stat: "cha" },
  commander_field_rally:     { heal_amount: 20, self_statuses: ["fortified"] },
  commander_morale_boost:    { self_statuses: ["hastened", "focused"] },

  pilot_precision_shot:        { damage_die: "1d6", damage_stat: "per", target_status: { id: "burning", chance: 0.30 } },
  pilot_evasive_strike:        { damage_die: "1d6", damage_stat: "agi", self_statuses: ["hastened"] },
  pilot_emergency_thrust:      { self_statuses: ["hastened"], clears_self_ids: ["chilled"] },
  pilot_disorienting_maneuver: { target_status: { id: "frightened", chance: 0.55 } },

  engineer_overcharge:     { damage_die: "1d6", damage_stat: "int", target_status: { id: "burning",  chance: 0.35 } },
  engineer_emp_burst:      { damage_die: "1d8", damage_stat: "int", target_status: { id: "weakened", chance: 0.50 } },
  engineer_repair_module:  { heal_amount: 25 },
  engineer_system_weaken:  { target_status: { id: "weakened", chance: 0.55 } },

  marine_plasma_charge:    { damage_die: "1d8", damage_stat: "str", target_status: { id: "burning", chance: 0.25 } },
  marine_breach_and_clear: { damage_die: "1d4", damage_stat: "agi", hits: 2 },
  marine_combat_stims:     { heal_amount: 20, self_statuses: ["hastened"] },
  marine_suppressive_fire: { target_status: { id: "chilled", chance: 0.40 } },

  recon_sniper_shot:     { damage_die: "1d8", damage_stat: "per" },
  recon_cryo_round:      { damage_die: "1d4", damage_stat: "per", target_status: { id: "chilled", chance: 1.00 } },
  recon_ghost_mode:      { self_statuses: ["hastened", "focused"] },
  recon_target_acquired: { target_status: { id: "weakened", chance: 0.55 } },

  // POST-APOCALYPTIC
  scavenger_improvised_explosive: { damage_die: "1d8", damage_stat: "per", target_status: { id: "burning",  chance: 0.30 } },
  scavenger_trick_shot:           { damage_die: "1d6", damage_stat: "per", target_status: { id: "weakened", chance: 0.25 } },
  scavenger_field_patch:          { heal_amount: 20 },
  scavenger_smoke_grenade:        { target_status: { id: "chilled", chance: 0.45 } },

  raider_savage_assault: { damage_die: "1d10", damage_stat: "str" },
  raider_blood_frenzy:   { damage_die: "1d6",  damage_stat: "str", self_statuses: ["hastened"] },
  raider_hardened:       { self_statuses: ["fortified"] },
  raider_war_cry:        { target_status: { id: "frightened", chance: 0.60 } },

  medic_toxic_injection:   { damage_die: "1d4", damage_stat: "int", target_status: { id: "poisoned", chance: 0.50 } },
  medic_scalpel_strike:    { damage_die: "1d6", damage_stat: "int", target_status: { id: "weakened", chance: 0.30 } },
  medic_field_surgery:     { heal_amount: 35 },
  medic_antidote_mastery:  { clears_self_ids: ["any_ailment"], self_statuses: ["focused"] },

  runner_hit_and_run:    { damage_die: "1d4", damage_stat: "agi", self_statuses: ["hastened"] },
  runner_shiv:           { damage_die: "1d6", damage_stat: "agi", target_status: { id: "poisoned", chance: 0.35 } },
  runner_parkour:        { self_statuses: ["hastened"] },
  runner_flash_grenade:  { target_status: { id: "chilled", chance: 0.45 } },

  demagogue_crowds_wrath:    { damage_die: "1d6", damage_stat: "cha" },
  demagogue_battle_rhetoric: { damage_die: "1d4", damage_stat: "cha", target_status: { id: "frightened", chance: 0.60 } },
  demagogue_rousing_speech:  { heal_amount: 20, self_statuses: ["fortified"] },
  demagogue_demoralize:      { target_status: { id: "frightened", chance: 0.75 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Public exports
// ─────────────────────────────────────────────────────────────────────────────

/** Keyed by ability id for O(1) lookup. Frozen at module load — the
 *  library is hardcoded data, never mutated at runtime. Effects are
 *  merged in from EFFECTS so consumers get a single record per id. */
export const ABILITY_LIBRARY: Readonly<Record<AbilityId, AbilityTemplate>> =
  Object.freeze(
    Object.fromEntries(
      ENTRIES.map((e) => [
        e.id,
        EFFECTS[e.id] ? { ...e, effects: EFFECTS[e.id] } : e,
      ])
    )
  );

/** Every ability — passive + 4 slot abilities — for a given class.
 *  Order: slot 1, slot 2, slot 3, slot 4, passive. */
export function getAbilitiesForClass(classId: string): AbilityTemplate[] {
  const matches = Object.values(ABILITY_LIBRARY).filter((e) => e.class_id === classId);
  return matches.slice().sort((a, b) => {
    if (a.is_passive && !b.is_passive) return 1;
    if (!a.is_passive && b.is_passive) return -1;
    return (a.slot_position ?? 0) - (b.slot_position ?? 0);
  });
}

/** The class passive — exactly one per class. */
export function getPassiveForClass(classId: string): AbilityTemplate | undefined {
  return Object.values(ABILITY_LIBRARY).find((e) => e.class_id === classId && e.is_passive);
}

/** Pool of slot candidates for a given (class, slot). v1 library ships
 *  exactly 1 per slot per class; v2 variant pools (8-10/class, 3 drawn
 *  per playthrough) is a planned follow-up — the helper is the seam. */
export function getSlotAbilitiesForClass(
  classId: string,
  slot:    1 | 2 | 3 | 4,
): AbilityTemplate[] {
  return Object.values(ABILITY_LIBRARY).filter(
    (e) => e.class_id === classId && !e.is_passive && e.slot_position === slot
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// P7 — runtime helpers (charge math, starting pool, level-up unlocks)
// ─────────────────────────────────────────────────────────────────────────────

/** Stat short-form → full Attributes key. */
const STAT_KEY_MAP: Record<AbilityStatShort, keyof Attributes> = {
  str: "strength",
  agi: "agility",
  int: "intelligence",
  per: "perception",
  cha: "charisma",
};

/**
 * P7 — slot unlock count by player level (rules 97 / 164):
 *   level <  5  → 1 slot
 *   level 5-9   → 2 slots
 *   level 10-14 → 3 slots
 *   level ≥ 15  → 4 slots
 */
export function getUnlockedSlotCount(level: number): number {
  if (level >= 15) return 4;
  if (level >= 10) return 3;
  if (level >= 5)  return 2;
  return 1;
}

export function isSlotUnlocked(slot: 1 | 2 | 3 | 4, level: number): boolean {
  return slot <= getUnlockedSlotCount(level);
}

/**
 * P7 — max charges for a given ability at the player's current
 * (level, attributes). Formula from the P7 prompt spec:
 *
 *   base_charges (2)
 *   + Math.floor(playerAttributes[charge_stat] / 2)   if charge_stat set
 *   + 1   if playerLevel >= 5 AND ability is in slot 1
 *   + perkChargeBonus   (P8 — total of all charge_bonus perks)
 *
 * Returns base_charges when the template carries no charge_stat
 * (e.g. defensive default for utility abilities that should always
 * be usable a fixed 2 times per combat).
 *
 * P8 — `perkChargeBonus` is the player's total `perk_charge_bonus`
 * (sum of every charge_bonus perk taken). Optional with a 0 default
 * so legacy callers don't have to pass it.
 */
export function computeMaxCharges(
  ability:         AbilityTemplate,
  playerLevel:     number,
  attributes:      Attributes,
  perkChargeBonus: number = 0,
): number {
  let charges = ability.base_charges;
  if (ability.charge_stat) {
    const statKey = STAT_KEY_MAP[ability.charge_stat];
    const statValue = attributes[statKey] ?? 0;
    charges += Math.floor(statValue / 2);
  }
  if (playerLevel >= 5 && ability.slot_position === 1) {
    charges += 1;
  }
  charges += perkChargeBonus;
  return charges;
}

/**
 * P7 — current remaining charges given a CombatState's
 * ability_charges_used counter. Pure derivative.
 *
 * P8 — `perkChargeBonus` threads through to computeMaxCharges.
 */
export function remainingCharges(
  ability:         AbilityTemplate,
  playerLevel:     number,
  attributes:      Attributes,
  usedSoFar:       number,
  perkChargeBonus: number = 0,
): number {
  const max = computeMaxCharges(ability, playerLevel, attributes, perkChargeBonus);
  return Math.max(0, max - usedSoFar);
}

/**
 * P7 — accessor for combat-engine. Returns the effects payload for an
 * ability id, or undefined when the ability is unknown / has no
 * mechanical effect (passives, utility-flavor-only).
 */
export function getAbilityEffects(id: AbilityId): AbilityEffects | undefined {
  return ABILITY_LIBRARY[id]?.effects;
}

/**
 * P7 CHANGE 1c — draw the starting LEARNED POOL for a class. v1
 * variant pool = the single slot-2/3/4 candidates combined; with v1
 * that's exactly 3 entries, so the draw is deterministic. When v2
 * variant pools land (8-10 per class) this is the seam where 3 of N
 * get selected per playthrough. Returns ability ids.
 */
export function drawStartingLearnedPool(
  classId: string,
  rng:     () => number = Math.random,
): AbilityId[] {
  const pool = [
    ...getSlotAbilitiesForClass(classId, 2),
    ...getSlotAbilitiesForClass(classId, 3),
    ...getSlotAbilitiesForClass(classId, 4),
  ];
  if (pool.length <= 3) return pool.map((e) => e.id);
  // v2 — Fisher-Yates shuffle, take first 3.
  const arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, 3).map((e) => e.id);
}

/**
 * P7 CHANGE 5 — candidates the level-up modal offers for the
 * newly-unlocked slot. The prompt anticipates 2 options for slots 3/4;
 * v1 ships 1 per slot per class. Helper returns whatever's there; the
 * LevelUpModal degrades to a single auto-confirm card when only 1
 * candidate exists, and shows a 2-card picker when 2+ exist.
 *
 * Slot 2 (level 5) is conceptually "random from the learned pool that
 * fits slot 2" per the prompt — the modal handles that case directly
 * via the learned_abilities filter.
 */
export function getSlotCandidatesForLevelUp(
  classId: string,
  slot:    2 | 3 | 4,
): AbilityTemplate[] {
  return getSlotAbilitiesForClass(classId, slot);
}
