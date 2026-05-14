# Endless Worlds RPG — Ability Library (All 25 Classes)
# Version 1.0 — For Tim's review
# 125 entries: 25 classes × 4 active slots + 1 passive

# ARCHITECTURE REMINDER
# Templates are hardcoded. Names are LLM-generated per world at WCD time.
# "Frost Bolt" in Fantasy → "Abyssal Cold" in deep-ocean world → "Cryo-Spike" in Cyberpunk.
# Player sees world flavor names. Engine uses template IDs.
#
# BALANCE CONVENTION: 2 damage (D), 1 survival (S), 1 utility (U) per class.
# Survival = HP restore OR defensive buff OR debuff clear — anything that helps you survive.
# Some classes flex this (Medic = 2D/1S/1U with a heal-focused S3).
#
# SLOT UNLOCK: Slot 1 at start. Slot 2 at level 3. Slot 3 at level 6. Slot 4 at level 9.
# CHARGES: Base 2 per combat. Restore at end of combat (not rest).
# CHARGE SCALING: +1 charge per 2 levels gained in charge_stat.
# DAMAGE SCALING: damage_stat modifier added to every damage roll.
# LEVEL 5 BONUS: Slot 1 gains +1 charge (3 total at level 5).
#
# FORMAT: Slot [type] Name: damage_die + stat, effect. charge_stat. dmg_stat (if different).

---

## FANTASY

### KNIGHT (STR primary, AGI secondary)
Slot 1 [D] Shield Bash: 1d6 + STR, WEAKENED on enemy (80%). charge: STR. dmg: STR.
Slot 2 [D] War Cry: 1d8 + STR, no status — pure damage burst. charge: STR. dmg: STR.
Slot 3 [S] Battle Mend: Restore 20 HP + FORTIFIED self for 2 rounds. charge: STR.
Slot 4 [U] Iron Stance: FORTIFIED self for 3 rounds. charge: STR.
Passive — Iron Resolve: Take -1 from ALL damage sources.

### ROGUE (AGI primary, PER secondary)
Slot 1 [D] Poison Strike: 1d4 + AGI, 40% POISONED on enemy. charge: AGI. dmg: AGI.
Slot 2 [D] Flurry: 2 hits of (1d4 + AGI) — two separate damage rolls. charge: AGI. dmg: AGI.
Slot 3 [S] Fade: HASTENED self + clears own CHILLED or WEAKENED. charge: AGI.
Slot 4 [U] Marked Target: 60% FRIGHTENED on enemy. charge: PER.
Passive — Shadow Step: +15% flee success chance.

### MAGE (INT primary, PER secondary)
Slot 1 [D] Frost Bolt: 1d8 + INT, CHILLED guaranteed on enemy. charge: INT. dmg: INT.
Slot 2 [D] Arcane Blast: 1d10 + INT, no status — highest single damage. charge: INT. dmg: INT.
Slot 3 [S] Arcane Shield: FORTIFIED self for 3 rounds. charge: INT.
Slot 4 [U] Hex: WEAKENED on enemy (50%). charge: INT.
Passive — Arcane Focus: +2 to INT checks while any ability charges remain.

### RANGER (PER primary, AGI secondary)
Slot 1 [D] Hunter's Arrow: 1d6 + PER, 25% POISONED on enemy. charge: PER. dmg: PER.
Slot 2 [D] Rapid Shot: 2 hits of (1d4 + AGI). charge: AGI. dmg: AGI.
Slot 3 [S] Steady Aim: HASTENED + FOCUSED self, 2 rounds each. charge: PER.
Slot 4 [U] Crippling Shot: WEAKENED on enemy (55%). charge: PER.
Passive — Wilderness Instinct: +2 PER all checks, +10% flee success.

### HERALD (CHA primary, STR secondary)
Slot 1 [D] Inspiring Strike: 1d6 + STR + FORTIFIED self 1 round. charge: CHA. dmg: STR.
Slot 2 [D] Fear Shout: 1d4 + CHA (psychic), 50% FRIGHTENED on enemy. charge: CHA. dmg: CHA.
Slot 3 [S] Rally: Restore 20 HP + FOCUSED self 2 rounds. charge: CHA.
Slot 4 [U] Bolstering Presence: FORTIFIED self + allies for 2 rounds (multiplayer-forward). charge: CHA.
Passive — Commanding Presence: +2 CHA saves vs FRIGHTENED, +5% merchant discount.

---

## CYBERPUNK

### NETRUNNER (INT primary, PER secondary)
Slot 1 [D] ICE Spike: 1d6 + INT, 40% FRIGHTENED (Glitched) on enemy. charge: INT. dmg: INT.
Slot 2 [D] System Crash: 1d8 + INT, no status — full overload. charge: INT. dmg: INT.
Slot 3 [S] Firewall: FORTIFIED self for 3 rounds. charge: INT.
Slot 4 [U] Trace Exploit: WEAKENED (Overloaded) on enemy (50%). charge: INT.
Passive — Neural Interface: +2 INT checks, +1 to all rolls vs mechanical/cyber enemies.

### FIXER (CHA primary, INT secondary)
Slot 1 [D] Street Justice: 1d6 + STR, 25% WEAKENED (Battered). charge: CHA. dmg: STR.
Slot 2 [D] Dirty Move: 1d4 + AGI, 35% FRIGHTENED (Glitched). charge: AGI. dmg: AGI.
Slot 3 [S] Back-Channel: Restore 20 HP (called in a favor). charge: CHA.
Slot 4 [U] Smooth Talk: FOCUSED self + clears own FRIGHTENED. charge: CHA.
Passive — Street Cred: 10% merchant discount, +2 CHA checks.

### STREET SAMURAI (STR primary, AGI secondary)
Slot 1 [D] Blade Rush: 1d8 + STR, no status — pure speed. charge: STR. dmg: STR.
Slot 2 [D] Thermal Strike: 1d6 + STR, 30% BURNING (Overheating). charge: STR. dmg: STR.
Slot 3 [S] Combat Stim: HASTENED self 3 rounds + restore 10 HP. charge: AGI.
Slot 4 [U] Disabling Cut: WEAKENED (Battered) on enemy (55%). charge: STR.
Passive — Reflex Augment: +1 AGI to all attack rolls, -1 physical damage taken.

### ENFORCER (STR primary, AGI secondary)
Slot 1 [D] Brutalize: 1d10 + STR — highest single hit in Cyberpunk. charge: STR. dmg: STR.
Slot 2 [D] Suppression Burst: 1d4 + AGI, 40% CHILLED (Cryo-locked). charge: AGI. dmg: AGI.
Slot 3 [S] Adrenaline Surge: Restore 25 HP + FORTIFIED self 2 rounds. charge: STR.
Slot 4 [U] Intimidate: 70% FRIGHTENED (Glitched) on enemy. charge: STR.
Passive — Thick Skin: -2 from all physical damage taken.

### GHOST (AGI primary, PER secondary)
Slot 1 [D] Silenced Strike: 1d6 + AGI, 40% POISONED (Infected). charge: AGI. dmg: AGI.
Slot 2 [D] Ambush: 2 hits of (1d4 + AGI) — double strike from shadow. charge: AGI. dmg: AGI.
Slot 3 [S] Ghost Protocol: HASTENED self + clears own FRIGHTENED. charge: AGI.
Slot 4 [U] Sensor Blind: CHILLED (Cryo-locked) on enemy (45%). charge: PER.
Passive — Shadow Operative: +15% flee success, +2 PER exploring.

---

## HORROR

### INVESTIGATOR (INT primary, PER secondary)
Slot 1 [D] Desperate Blow: 1d6 + STR, 25% WEAKENED (Withered). charge: INT. dmg: STR.
Slot 2 [D] Holy Water: 1d8 + INT — full damage vs corruption/psychic, half vs physical. charge: INT. dmg: INT.
Slot 3 [S] Steel Nerve: Restore 15 HP + clear own FRIGHTENED (Maddened) + FOCUSED 2 rounds. charge: CHA.
Slot 4 [U] Unsettling Revelation: 55% FRIGHTENED (Maddened) on enemy. charge: INT.
Passive — Pattern Recognition: +2 PER all checks. Immune to first FRIGHTENED application per combat.

### CULTIST (CHA primary, INT secondary)
Slot 1 [D] Eldritch Touch: 1d6 + INT (corruption), 35% FRIGHTENED (Maddened). charge: INT. dmg: INT.
Slot 2 [D] Dark Blessing: 1d8 + CHA (void damage). charge: CHA. dmg: CHA.
Slot 3 [S] Blood Rite: Restore 25 HP. charge: CHA.
Slot 4 [U] Binding Curse: 70% FRIGHTENED (Maddened) on enemy — highest fear rate in Horror. charge: CHA.
Passive — Eldritch Resilience: +3 saves vs FRIGHTENED, +2 CHA checks.

### SURVIVOR (STR primary, AGI secondary)
Slot 1 [D] Savage Strike: 1d8 + STR — desperation. charge: STR. dmg: STR.
Slot 2 [D] Improvised Weapon: 1d6 + STR, 35% WEAKENED (Withered). charge: STR. dmg: STR.
Slot 3 [S] Second Wind: Restore 30 HP — best heal in Horror. charge: STR.
Slot 4 [U] Flee Route: Clear own FRIGHTENED + HASTENED self 2 rounds. charge: AGI.
Passive — Survivor's Grit: +2 STR saves, take -1 from all damage.

### PHANTOM (INT primary, CHA secondary)
Slot 1 [D] Wail: 1d6 + CHA (void), 50% FRIGHTENED (Maddened). charge: CHA. dmg: CHA.
Slot 2 [D] Spectral Touch: 1d8 + INT (corruption). charge: INT. dmg: INT.
Slot 3 [S] Phase Shift: HASTENED self + FORTIFIED self 1 round. charge: INT.
Slot 4 [U] Haunt: WEAKENED (Withered) on enemy (50%). charge: CHA.
Passive — Ethereal Form: +1 to all saves, +2 to FRIGHTENED saves specifically.

### MEDIUM (INT primary, CHA secondary)
Slot 1 [D] Spirit Blast: 1d6 + INT (void) — focused spiritual force. charge: INT. dmg: INT.
Slot 2 [D] Channel Wrath: 1d8 + INT, 30% WEAKENED (Withered, spirits drain strength). charge: INT. dmg: INT.
Slot 3 [S] Spirit Mend: Restore 20 HP + FOCUSED self 2 rounds. charge: CHA.
Slot 4 [U] Ward: FORTIFIED self for 3 rounds. charge: CHA.
Passive — Spirit Sight: +3 PER all checks, +1 breadcrumb discovery chance.

---

## SPACE OPERA

### COMMANDER (CHA primary, INT secondary)
Slot 1 [D] Tactical Strike: 1d6 + INT, 40% WEAKENED (Destabilized). charge: INT. dmg: INT.
Slot 2 [D] Fire Command: 1d8 + CHA (coordinated psychic command). charge: CHA. dmg: CHA.
Slot 3 [S] Field Rally: Restore 20 HP + FORTIFIED self 2 rounds. charge: CHA.
Slot 4 [U] Morale Boost: HASTENED + FOCUSED self, 2 rounds each. charge: CHA.
Passive — Strategic Mind: +2 INT checks, +1 all checks while all ability charges remain.

### PILOT (AGI primary, PER secondary)
Slot 1 [D] Precision Shot: 1d6 + PER, 30% BURNING (Plasma-burned). charge: PER. dmg: PER.
Slot 2 [D] Evasive Strike: 1d6 + AGI + HASTENED self 1 round. charge: AGI. dmg: AGI.
Slot 3 [S] Emergency Thrust: HASTENED self 3 rounds + clears own CHILLED (Cryo-locked). charge: AGI.
Slot 4 [U] Disorienting Maneuver: 55% FRIGHTENED (Disoriented) on enemy. charge: PER.
Passive — Combat Reflexes: +2 AGI saves, +10% flee success.

### ENGINEER (INT primary, STR secondary)
Slot 1 [D] Overcharge: 1d6 + INT, 35% BURNING (Plasma-burned, electrical). charge: INT. dmg: INT.
Slot 2 [D] EMP Burst: 1d8 + INT, WEAKENED (Destabilized, 50% vs mechanical, 25% organic). charge: INT. dmg: INT.
Slot 3 [S] Repair Module: Restore 25 HP (field repair). charge: INT.
Slot 4 [U] System Weaken: WEAKENED (Destabilized) on enemy (55%). charge: INT.
Passive — Technical Mastery: +2 INT checks, identify item damage types on sight.

### MARINE (STR primary, AGI secondary)
Slot 1 [D] Plasma Charge: 1d8 + STR, 25% BURNING (Plasma-burned). charge: STR. dmg: STR.
Slot 2 [D] Breach and Clear: 2 hits of (1d4 + AGI) — sweep fire. charge: AGI. dmg: AGI.
Slot 3 [S] Combat Stims: Restore 20 HP + HASTENED self 2 rounds. charge: STR.
Slot 4 [U] Suppressive Fire: CHILLED (Cryo-locked) on enemy (40%). charge: AGI.
Passive — Battle Hardened: -1 all damage taken, +1 STR saves.

### RECON (PER primary, AGI secondary)
Slot 1 [D] Sniper Shot: 1d8 + PER — high single-target, no status. charge: PER. dmg: PER.
Slot 2 [D] Cryo Round: 1d4 + PER, CHILLED (Cryo-locked) guaranteed. charge: PER. dmg: PER.
Slot 3 [S] Ghost Mode: HASTENED + FOCUSED self, 2 rounds each. charge: AGI.
Slot 4 [U] Target Acquired: WEAKENED (Destabilized) on enemy (55%). charge: PER.
Passive — Long Range: +2 PER checks, first attack roll each combat +3.

---

## POST-APOCALYPTIC

### SCAVENGER (PER primary, INT secondary)
Slot 1 [D] Improvised Explosive: 1d8 + PER, 30% BURNING (Scorched). charge: PER. dmg: PER.
Slot 2 [D] Trick Shot: 1d6 + PER, 25% WEAKENED (Battered, joint shot). charge: PER. dmg: PER.
Slot 3 [S] Field Patch: Restore 20 HP. charge: INT.
Slot 4 [U] Smoke Grenade: CHILLED (Frosted) on enemy (45%). charge: PER.
Passive — Scavenger's Eye: +2 PER exploring, material nodes occasionally yield +1.

### RAIDER (STR primary, AGI secondary)
Slot 1 [D] Savage Assault: 1d10 + STR — highest damage in Post-Apoc. charge: STR. dmg: STR.
Slot 2 [D] Blood Frenzy: 1d6 + STR + HASTENED self (violence as fuel). charge: STR. dmg: STR.
Slot 3 [S] Hardened: FORTIFIED self for 3 rounds. charge: STR.
Slot 4 [U] War Cry: 60% FRIGHTENED (Shaken) on enemy. charge: STR.
Passive — Brutal Fighter: -1 all damage taken, +1 all damage dealt.

### MEDIC (INT primary, CHA secondary)
Slot 1 [D] Toxic Injection: 1d4 + INT, 50% POISONED (Irradiated) on enemy. charge: INT. dmg: INT.
Slot 2 [D] Scalpel Strike: 1d6 + INT, 30% WEAKENED (Battered, precision cut). charge: INT. dmg: INT.
Slot 3 [S] Field Surgery: Restore 35 HP — highest heal in Post-Apoc, best heal in game. charge: INT.
Slot 4 [U] Antidote Mastery: Clear own active ailment + FOCUSED self 2 rounds. charge: INT.
Passive — Combat Medicine: All HP healed from items +5, +2 INT all checks.

### RUNNER (AGI primary, PER secondary)
Slot 1 [D] Hit and Run: 1d4 + AGI + HASTENED self 1 round (strike then vanish). charge: AGI. dmg: AGI.
Slot 2 [D] Shiv: 1d6 + AGI, 35% POISONED (Irradiated, tainted blade). charge: AGI. dmg: AGI.
Slot 3 [S] Parkour: HASTENED self for 3 rounds. charge: AGI.
Slot 4 [U] Flash Grenade: CHILLED (Frosted) on enemy (45%). charge: PER.
Passive — Born to Run: +20% flee success (best in game), +2 AGI saves.

### DEMAGOGUE (CHA primary, INT secondary)
Slot 1 [D] Crowd's Wrath: 1d6 + CHA (manifests as psychic force through the crowd). charge: CHA. dmg: CHA.
Slot 2 [D] Battle Rhetoric: 1d4 + CHA, 60% FRIGHTENED (Shaken). charge: CHA. dmg: CHA.
Slot 3 [S] Rousing Speech: Restore 20 HP + FORTIFIED self (inspired by own words). charge: CHA.
Slot 4 [U] Demoralize: 75% FRIGHTENED (Shaken) — highest fear application rate in game. charge: CHA.
Passive — Silver Tongue: 10% merchant discount, +2 CHA all checks.

---

## DESIGN NOTES

### Status Effect Distribution
POISONED applicators (6): Rogue, Ranger, Ghost, Silenced Strike, Medic, Runner, Shiv
BURNING applicators (5): Street Samurai, Marine, Engineer, Pilot, Scavenger
CHILLED applicators (6): Mage, Enforcer, Ghost, Recon, Marine, Runner, Scavenger
WEAKENED applicators (12): Knight, Ranger, Herald(via items), Netrunner, Street Sam, Investigator,
  Survivor, Phantom, Commander, Engineer(2x), Scavenger, Medic, Recon
FRIGHTENED applicators (12): Rogue, Herald, Enforcer, Netrunner, Fixer, Investigator,
  Cultist(2x), Phantom, Commander, Pilot, Raider, Demagogue(2x)

WEAKENED and FRIGHTENED are more common because they're utility-type statuses.
POISONED and BURNING are more rare — reserved for thematically appropriate classes.

### Stat Relevance After This Design
STR: Heavy damage classes. Also WEAKENED application (feel of brute force).
AGI: Speed classes. CHILLED application (speed = agility). Flee success.
INT: Mages/Hackers/Medics. Complex ability interactions.
PER: Rangers/Scouts. Detection, precision, exploration bonuses.
CHA: Heralds/Fixers/Demagogues. Fear application. Merchant discounts. Resist fear.

Every stat is now combat-relevant, not just STR and AGI.

### Class Identity Through Abilities
High damage ceiling: Mage (1d10), Enforcer (1d10), Raider (1d10), Medic S3 (35 HP heal)
Best heals: Medic (35), Survivor (30), Field Surgery tier
Best flee: Born to Run Runner (20%), Shadow Step classes (15%)
Best merchant discount: Street Cred Fixer (10%), Silver Tongue Demagogue (10%), Commanding Herald (5%)
Best FRIGHTENED: Demoralize Demagogue (75%), Binding Curse Cultist (70%), Intimidate Enforcer (70%)
Best POISONED: Toxic Injection Medic (50%), ironic for the healer
Unique mechanics: Medic Antidote Mastery (free ailment cure), Investigator immune to first FRIGHTENED,
  Engineer EMP scales differently vs mechanical enemies, Herald/Commander multiplayer synergy

### Ability Flavor Name Generation (WCD prompt guidance)
The WCD receives each class's ability mechanical descriptions and generates:
  - A world-appropriate name (1-3 words)
  - A one-sentence flavor description
  - The name should evoke the world's theme, not the mechanical effect
  Examples: "Frost Bolt" → "Abyssal Chill" (deep ocean world) → "Winter's Fang" (tundra world)
  All 4 active abilities + 1 passive per class get flavor names.
  Passive names should feel like a character trait, not a skill: "Iron Resolve" → "The Unbroken"

---

## POST-QUEST WORLD DESIGN NOTE (captured here)

Decision: Player chooses End Chapter OR Continue Exploring after main quest resolution.

After resolution is chosen:
  - Narrator context gains permanent flag: QUEST_STATUS: resolved_[resolution_id]
  - Resolution tone (hopeful / dark / ambiguous) colors all subsequent narrator output
  - NPCs acknowledge what happened — defenders celebrate, enemies shift, neutrals remark
  - Zero content locks: professions, side quests, region exploration all continue
  - New region expansions still fire if player explores undiscovered regions
  - World feels like the aftermath of the story told, not a void

Example:
  Resolution A (hopeful) → NPCs speak hopefully, merchants more generous, enemies
    less aggressive in known regions. The world is healing.
  Resolution B (dark) → World is quieter, more fearful. NPCs speak of what was lost.
    Some enemies more brazen. Narrator carries weight of the choice.

The quest_threads.main_quest.active_resolution_id drives this in the narrator context block.
No new system needed — just a prompt block extension in prompt-builder.ts.

