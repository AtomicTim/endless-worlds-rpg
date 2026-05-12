# Endless Worlds RPG — Genre Reference

**Status:** Living document. Updated as genres are designed, playtested, and implemented.
**Purpose:** Reference for all genre and sub-genre ideas — tone, mechanics, loot, enemies, UI identity, and unique features. Used when designing Genre Wrappers and during the dedicated Genre Session (post-Day-25).

> Each genre/sub-genre is a Genre Wrapper: genre_id + WCD/WorldBible prompt modifiers + loot table + bestiary + starting equipment + UI tokens + narrator voice brief + unique mechanics. Sub-genres inherit from their parent and override specific fields.

## STATUS: ✅ Implemented · 📋 Designed · 💡 Brainstormed

---

# FANTASY

## ✅ Fantasy — Classic
References: LOTR, D&D, Dragon Age, Final Fantasy (pre-XIII), The Witcher (world)
Tone: Grounded heroism. Stakes feel real but hope is always present.
Narrator voice: Measured, descriptive, literary. Rich place names.
UI: #f59e0b amber · Gold · HP
Enemies: Goblins, undead, bandits, cultists, corrupted beasts, dragons, demons
Loot: Iron/steel weapons, chainmail, health potions, spell scrolls, gemstones, lore tomes
Settlement: Medieval towns — taverns, blacksmiths, market squares, temples, guildhalls
Dungeon: Stone crypts, goblin warrens, ancient ruins, corrupted forests, dragon lairs
Unique mechanics:
- Alignment system (moral choices tracked via world_state flags)
- Spell scroll system — LORE items consumed for one-time magical effects
- Faction reputation (shifts NPC trust scores)
- Day/night cycle affecting encounter rates and NPC availability

## 📋 Fantasy — Light
References: Legend of Zelda, Dragon Quest, Studio Ghibli, Stardew Valley, Golden Sun
Tone: Warm, optimistic, wondrous. Danger exists but doesn't feel hopeless.
Narrator voice: Vivid and sensory. Excitement over dread. Whimsical place names.
UI: #34d399 emerald green · Gold · Hearts
Enemies: Mischievous goblins (not murderous), enchanted constructs, forest spirits gone astray, slimes
Loot: Colorful potions, charmed jewelry, magical seeds, treasure maps, instruments with magical effects
Settlement: Villages with personality — cozy, lived-in, warm
Dungeon: Puzzle-forward ruins, enchanted forests, crystal caves, clockwork temples
Unique mechanics:
- Puzzle objects — interact sequences that unlock bonus loot or shortcuts
- Low death penalty — softer defeat consequence (lose some gold, not full XP rollback)
- Festival events — world_state flags trigger seasonal celebrations at settlements
- Companion hints — narrator gives more generous clues in terse mode

## 📋 Fantasy — Dark
References: Game of Thrones, Warhammer Fantasy, Berserk, Dark Souls, Abercrombie's First Law
Tone: Brutal and morally grey. No chosen ones. Help someone today, they betray you tomorrow.
Narrator voice: Unflinching, visceral, precise. Violence has weight. Poetic but not romantic about suffering.
UI: #dc2626 blood red · Silver · Vitality
Enemies: Corrupted knights, plague-carriers, war veterans gone feral, inquisitors, body-horror mutations, ambitious nobles with private armies
Loot: Scarred weapons with history, cursed armor (better stats + negative side effect), contraband, execrable relics
Settlement: Walled, fearful. Guards shake you down. Merchants desperate or crooked.
Dungeon: Actual battlefields still warm. Prison complexes. Inquisition chambers. Plague zones.
Unique mechanics:
- Corruption system — certain actions add CORRUPTION counter; high corruption changes narrator tone and NPC reactions
- Scar system — near-death leaves permanent minor stat modifiers + flavor text on character sheet
- Trust is costly — NPCs start at lower default_trust; high-trust NPC betrayal events possible
- Cursed loot — RARE items have a downside alongside upside; player chooses to accept or reject at pickup

## 💡 Fantasy — Sword & Sorcery
References: Conan, Elric, Red Sonja, Lankhmar (Fafhrd & Grey Mouser), Solomon Kane
Tone: Kinetic and sensory. Sorcerers are corrupt and terrifying. Physical might is heroic.
Narrator voice: Hard-boiled but vivid. Short punchy sentences for action.
UI: #b45309 burnt amber · Gold · Vitality
Enemies: Serpent cultists, sorcerers with inhuman pacts, undead sorcerer-kings, demons summoned by greed
Loot: Jeweled swords, stolen idols, cursed crowns, demon-forged armor, forbidden tomes, exotic poisons
Unique mechanics:
- Sorcery is dangerous — LORE spell items have chance to backfire (PER check to control)
- Wanderer identity — no permanent settlement allegiance; each town is a fresh start
- Mercenary contracts — players can take jobs from NPCs for gold

## 💡 Fantasy — Mythic (Gods Walk Among Us)
References: Hades (game), God of War, Percy Jackson, The Iliad, Age of Mythology
Tone: Grand but personal. The gods interfere constantly. Everything is heightened.
Narrator voice: Epic register with flashes of dark humor (the gods are petty).
UI: #f59e0b divine gold · Drachma/Obol/divine favor · HP/Ichor
Enemies: Minotaurs, harpies, gorgons, cyclopes, divine champions, cursed heroes
Loot: Divine boons (passive stat bonuses, stackable), ambrosia (powerful consumable heal), legendary hero artifacts
Unique mechanics:
- Divine favor system — choices please or anger specific gods; each grants/removes passive bonuses
- Prophecy — a short prophecy generated at world creation; breadcrumbs lead toward or against it
- Fate currency — separate resource spent to re-roll failed checks (limited per session)
- Legendary difficulty scaling — gods send stronger champions as player accumulates victories

## 💡 Fantasy — Wuxia / Xianxia
References: Jade Empire, Crouching Tiger Hidden Dragon, Journey to the West
Tone: Honor, mastery, and spiritual ascension. Hierarchy matters but talent can overthrow it.
Narrator voice: Poetic and precise. Movement described with elegance. Silence used meaningfully.
UI: #ef4444 vermillion red · Spirit Coins/Taels · Qi
Enemies: Corrupt cultivators, demonic spirits, ghost warriors, guardian beasts, sect rivals
Loot: Cultivation manuals (LORE teaching techniques), spirit stones (XP items), heavenly elixirs, ancestral weapons, demon cores
Unique mechanics:
- Cultivation rank — replaces traditional leveling; ranks have names (Body Tempering → Qi Condensation → Foundation Building)
- Technique system — LORE items teach combat techniques unlocking new action types
- Face system — reputation affects NPC responses; losing face has mechanical consequences
- Sect allegiance — joining a sect gives passive bonuses but creates enemies with rival sects
- Tribulation events — rare divine tests the player must survive to advance cultivation

## 💡 Fantasy — Flintlock
References: Powder Mage Trilogy, Dishonored, Dragon Age: Origins
Tone: Political and grounded. Revolution in the air. Magic is regulated, feared, weaponized.
UI: #475569 gunmetal slate · Coin · HP
Unique mechanics:
- Ammunition as resource — ranged weapons require ammo tracked in inventory
- Magic licensing — some abilities require a license; unlicensed use triggers guard hostility
- Class warfare path — quests can side with nobility, merchants, or revolutionaries with long-term consequences

## 💡 Fantasy — Fairy Tale / Folk Horror
References: The Bear and the Nightingale, Spinning Silver, Pan's Labyrinth, Grimm (original), The Witch (film)
Tone: Beautiful and dreadful in equal measure. Every gift costs something. The land has memory.
Narrator voice: Lyrical and ominous. Repetition of threes. Ancient grammar. NPCs speak in riddles.
UI: #7c3aed deep violet · Silver · HP
Unique mechanics:
- Bargain system — trade stats/items/promises for immediate benefits; debts must eventually be paid
- True Name mechanic — discovering an enemy's true name gives permanent advantage in checks against them
- Iron weakness — certain enemies take extra damage from iron items
- Seasonal world state — Spring/Summer/Autumn/Winter affects encounter rates and NPC moods

## 💡 Fantasy — Dying Earth
References: Book of the New Sun (Gene Wolfe), The Dying Earth (Vance), Numenera (tabletop)
Tone: Melancholy and philosophical. Entropy as aesthetic. Genius preserved in ruins, dangerous when disturbed.
Narrator voice: Archaic and precise. Characters speak formally. The narrator mourns without stating it.
Unique mechanics:
- Artifact identification — ancient items require INT check; failure causes random effect
- Decay track — global entropy counter; certain actions accelerate or slow it

---

# SCIENCE FICTION

## ✅ Cyberpunk — Classic
References: Neuromancer, Blade Runner, Ghost in the Shell, Cyberpunk 2077, Shadowrun
Tone: Gritty and electric. Everyone has an angle. Technology has outpaced wisdom.
Narrator voice: Clipped and sensory. Brand names as texture.
UI: #22d3ee cyan · Credits · Integrity
Enemies: Corporate security (tiered), gang members, rogue AIs, bounty hunters, corrupted cyborgs
Loot: Cyberware (implants — equippable, permanent stat changes), ICE-breakers, data chips (LORE), stims
Unique mechanics:
- Cyberware slots — fixed augmentation slots; cyberware is permanent
- Heat system — aggressive actions in corp districts raise Alert level; high Alert sends security
- Hacking as action type — INT-based check unlocking shortcuts or disabling enemies remotely
- Humanity stat — cyberware increases power but decreases CHA effectiveness (optional)

## 💡 Cyberpunk — Biopunk
References: Deus Ex, Annihilation, Upgrade, SOMA, Gattaca
Tone: Body horror adjacent. The line between tool and organism is gone.
UI: #84cc16 bio-green · Credits/Gene Scrip · Cell Count
Unique mechanics:
- Gene mods instead of cyberware — organic augmentations with biological costs (some cause stat decay over time)
- Pathogen items — biological weapons with risk of self-infection
- Harvesting — organic enemies yield biological material as loot

## 💡 Cyberpunk — Solarpunk
References: Becky Chambers' Monk and Robot, Nausicaä of the Valley of the Wind
Tone: Warm and earnest. Community is the real power. Technology serves people.
Unique mechanics:
- Community favor — settlements have collective trust score; high favor unlocks shared resources
- Repair over replace — items can be maintained and upgraded rather than discarded

## ✅ Space Opera — Classic
References: Star Wars, Guardians of the Galaxy, Dune, Mass Effect, Firefly
Tone: Epic and personal simultaneously. The fate of worlds told through individual relationships.
UI: #a855f7 purple · Stellar Units · Hull Integrity/HP
Unique mechanics:
- Starship as hub — the player's ship is a portable settlement with upgradeable nodes
- Alien language — some NPCs speak untranslated; INT check to understand
- Hyperspace jumps — inter-region fast travel with random encounter chance during transit

## 💡 Space Opera — Military Sci-Fi
References: Warhammer 40,000, Starship Troopers, Mass Effect (Spectre missions), Halo ODST
Tone: Grim professionalism. Brotherhood forged in horror. Sacrifice is expected.
UI: #1f2937 dark military grey / #ef4444 red accent · Military Scrip · Combat Effectiveness
Unique mechanics:
- Squad morale — party shared morale stat; low morale penalizes all rolls
- Rank system — military rank affects commands to allied NPCs
- Ammo scarcity — combat resources tracked strictly; running dry forces improvisation
- Command decisions — some encounters offer tactical choice before initiative (ambush/breach/retreat)

## 💡 Space Opera — Space Horror
References: Dead Space, Alien, Event Horizon, Annihilation
Tone: Isolation and helplessness. The enemy cannot be reasoned with. Every resource is precious.
UI: #1e293b void black / #ef4444 emergency red · Salvage Value · Suit Integrity (Sanity active)
Unique mechanics:
- Oxygen/power as resources — environmental hazards consume suit resources
- Monster behavior unpredictable — enemy actions randomized more than standard
- Safe rooms — certain locations temporarily safe; resting restores partial resources

## 💡 Sci-Fi — Dystopian / Authoritarian
References: 1984, The Handmaid's Tale, V for Vendetta, Wolfenstein II
Tone: Oppressive and urgent. Information is the most valuable resource.
UI: #374151 state grey / #dc2626 resistance red · Ration Credits/Black Market Coin · HP
Unique mechanics:
- Surveillance rating — suspicious actions raise Suspicion counter; too high triggers arrest
- Propaganda items — state-issued LORE items; INT check to see through them
- Underground network — secret faction discovered through high-PER investigation
- Papers system — some zones require document items to enter; forging is craftable

## 💡 Sci-Fi — AI Uprising / Post-Human
References: Terminator (resistance era), Horizon Zero Dawn, The Matrix (Zion era)
Tone: Survival and adaptation. Humanity diminished but not gone.
UI: #f59e0b amber · Scrap/Data Cores · HP
Unique mechanics:
- Machine salvage — defeated machine enemies yield components for crafting/upgrading
- Signal detection — high-frequency zones increase encounter rates
- Reprogramming — very high INT check on disabled enemies converts them to temporary ally

---

# STEAMPUNK SPECTRUM

## 💡 Steampunk — Classic
References: Dishonored, Bioshock Infinite, 80 Days, Perdido Street Station
Tone: Gaslit wonder and social stratification. The marvels of progress hide exploitation.
UI: #d97706 brass amber · Sovereign/Pound · HP
Unique mechanics:
- Class system — social class affects NPC trust and dialogue options; disguise to pass as higher class
- Airship travel — inter-region travel via airship with sky encounter table
- Invention crafting — items can be combined to create novel tools

## 💡 Steampunk — Dieselpunk
References: Iron Harvest, Wolfenstein, Crimson Skies, Bioshock (early)
Tone: Dark glamour. Totalitarianism rising. The machinery of war is beautiful and murderous.
UI: #78350f dark amber/oil · Marks/War Scrip · HP
Unique mechanics:
- War zones — regions can be occupied; navigating requires papers or combat
- Black market — rarest items through underground economy; access via CHA/PER check

## 💡 Steampunk — Atompunk / Retrofuturism
References: Fallout (pre-war), Tomorrowland (dark version), Raygun Gothic aesthetic
Tone: Cheerful surface, existential dread underneath. Conformity enforced.
UI: #22d3ee atomic teal · Dollar/Atomic Credit · HP
Unique mechanics:
- Radiation as resource — some items require radiation exposure to activate
- Consumer goods as loot — mundane items have inflated value (working vacuum cleaner = rare treasure)

---

# HORROR

## ✅ Horror — Lovecraftian / Cosmic
References: H.P. Lovecraft, Bloodborne (cosmic), Control, Alan Wake 2
Tone: Dread and wonder. The enemy cannot be defeated, only survived.
UI: #84cc16 acid green · None · HP + Sanity
Unique mechanics:
- Sanity system — active
- Knowledge items that reduce sanity — some LORE items damage Sanity on read
- True form enemies — some have hidden true names causing additional Sanity loss on discovery

## 💡 Horror — Gothic
References: Dracula, Frankenstein, Bloodborne (Gothic), Castlevania, Crimson Peak
Tone: Romantic and terrible. The villain is seductive. Beauty conceals rot.
Narrator voice: Rich and melancholic. Victorian gothic register. Death described as transfiguration.
UI: #7c3aed deep violet · Silver · Vitality/Blood
Enemies: Vampires (multiple bloodline types, different weaknesses), werewolves, wraiths, animated portraits, gargoyles, cursed servants, witches
Loot: Silver weapons, holy symbols, bloodvials (risky consumable), ancestral relics, cursed jewelry, cryptic letters
Settlement: Crumbling estates. Village in shadow of the castle. Graveyard as public space.
Dungeon: The castle (many floors), the catacombs, the mad scientist's laboratory.
Unique mechanics:
- Bloodline system — drinking enemy blood accumulates powers but accelerates vampire corruption track
- Silver inventory — silver items deal special damage type against undead; limited supply
- Faith mechanic — religious items work based on belief (derived from player choices); lose faith, lose the power
- Cursed items more prevalent — higher % of RARE items are cursed than other genres
- Sunlight timer — some dungeons have a time limit before dawn/dusk changes encounter rates

## 💡 Horror — Folk Horror
References: Midsommar, The Wicker Man, The Witch, The Ritual, Shirley Jackson
Tone: The familiar turned threatening. Ritual as violence given form. Nature is not safe.
Narrator voice: Deceptively welcoming at first. Slowly wrong. Specific sensory details that feel real.
UI: #65a30d harvest green · Barter (not gold) · HP
Enemies: Cultists who look like neighbors, corrupted druidic guardians, things the cult has created, possessed animals
Loot: Handmade items, ritual components, protective charms, folk medicines, evidence of the village's true nature
Unique mechanics:
- Barter system — settlements use trade rather than gold; item value shifts by community need
- Paranoia mechanic — as player discovers more, certain NPC dialogue changes retroactively in feed
- Festival timer — a festival approaches from world creation; things escalate as it approaches
- Hidden lore tier — folk horror worlds have more LORE items than others

## 💡 Horror — Psychological
References: Silent Hill, Get Out, Annihilation, Us
Tone: Reality is unreliable. The horror is personal and specific.
Unique mechanics:
- Unreliable narrator — narrator occasionally contradicts itself; player chooses which to believe (INT check to detect)
- PER checks carry more weight — failure means potentially false narrator information
- Mirror encounters — enemy that mirrors player's loadout; rich loot if won
- Character backstory echo — world_state flags reference player's character creation choices; horror is specific to them

## 💡 Horror — Survival Horror
References: Resident Evil (classic), The Last of Us, Alien: Isolation, Darkwood
Tone: Tense and exhausting. Relief is brief. The environment is the enemy.
Unique mechanics:
- Weight-based inventory (stricter than standard 20 slots)
- Crafting from salvage — items broken down and recombined
- Stealth as primary option (Day 20.6 especially critical here)
- Resources degrade — consumables have use-by dates in long playthroughs (optional)
- Save scarcity — limited save points at settlements only (optional toggle)

## 💡 Horror — Paranormal / Occult
References: The X-Files, SCP Foundation, Constantine, American Horror Story, Warehouse 13
Tone: Conspiratorial and wry. The world-as-we-know-it is false.
Unique mechanics:
- Investigation system — clues accumulate in case file; enough clues unlock true identity of threat
- Containment loot — special items that trap entities (alternate win condition for some fights)
- Clearance levels — some information locked behind secret society standing

---

# HISTORICAL SETTINGS

## 💡 Historical — Ancient Egypt
References: Assassin's Creed: Origins, Age of Mythology (Egyptian), The Kane Chronicles
Tone: Monumental and intimate. The afterlife is a bureaucracy. Magic is state-sponsored.
UI: #f59e0b gold · Deben · Ka
Enemies: Tomb guardians, corrupted priests, animated ushabti, crocodile-headed entities, sand elementals
Loot: Canopic jars (powerful consumables), scarab amulets, ushabti figurines (single-use summon), papyrus scrolls (LORE), electrum weapons
Unique mechanics:
- Ma'at system — weighing of the heart at death determines respawn location and XP loss amount
- Death magic — LORE items are literally spells from the Book of the Dead
- River flood cycle — seasonal world state changing agricultural settlement resources

## 💡 Historical — Ancient Greece
References: Hades (game), Troy (film), God of War (original trilogy)
Tone: Glorious and doomed. Hubris is punished. Excellence is celebrated and then punished.
UI: #f59e0b gold · Drachma/Obol · HP
Unique mechanics:
- Hubris track — winning too well accumulates hubris; high hubris triggers divine interference
- Olympian patrons — allegiance to a god grants passive bonus and divine item; betrayal punished
- Oracle breadcrumbs — main quest delivered through deliberately ambiguous prophecy
- Heroic epithets — earned through great deeds; passive bonuses (The Swift, The Cunning, The Unbowed)
- Underworld as endgame region — Elysian Fields vs. Tartarus based on player's honor track

## 💡 Historical — Viking Age
References: God of War (Norse), Vinland Saga, Assassin's Creed: Valhalla
Tone: Fatalistic and alive. Death in battle is a gift. Loyalty to the crew above all.
Narrator voice: Kenning-rich. Direct and unromantic about violence.
UI: #0369a1 deep blue · Silver (hack silver) · Courage/HP
Enemies: Rival clans, draugr (undead warriors), lindworms, jotnar scouts, berserker champions, Seiðr witches
Unique mechanics:
- Wyrd track — some events are fated; player chooses HOW not WHETHER
- Skaldic glory — great deeds generate saga-verse in LOG entries
- Longship exploration — sea travel with distinct encounter table (sea monsters, storms, rival raiders)

## 💡 Historical — Piracy / Age of Sail ⭐
References: Treasure Island, Pirates of the Caribbean, Assassin's Creed: Black Flag, Sea of Thieves
Tone: Freedom and danger. Every horizon promises something. Loyalties shift with the wind.
Narrator voice: Salty and expansive. Ship terminology used naturally.
UI: #0369a1 ocean blue · Gold (pieces of eight) · HP
Enemies: Naval officers, rival pirates, sea monsters, mutinous crew, privateers, harbor guards, the Kraken (boss)
Loot: Treasure maps, naval charts, jeweled daggers, exotic goods, ship components, letters of marque, cursed pirate gold
Unique mechanics:
- Ship combat layer — simplified ship-vs-ship before boarding (can flee or negotiate)
- Crew morale — maintaining crew requires resources; low morale triggers mutiny event
- Port reputation — each port tracks standing (pirate/privateer/merchant alignment)
- Treasure map system — LORE items revealing location of buried caches in the current region
- Smuggling — high-value items flagged contraband in some ports; detection triggers combat

## 💡 Historical — Aztec / Mesoamerican ⭐
Tone: Vivid and cosmologically rich. Beauty and brutality intertwined. The calendar matters.
Narrator voice: Formal and precise. Colors are ritual. The names of things have power.
UI: #dc2626 ritual red / #f59e0b gold · Cacao beans/Jade · Tonalli
Enemies: Jaguar warriors, eagle warriors, death-gods manifest, quetzal guardians, rain-serpent entities, undead ancestors
Loot: Obsidian weapons (high damage, fragile), jade pieces (valuable), feathered armor, cacao (consumable/currency), sacred calendar items (LORE), turquoise masks
Unique mechanics:
- Calendar system — the Tonalpohualli generates day-signs modifying daily encounter odds and stat bonuses
- Sacrifice offering — optional post-combat action yielding divine favor in exchange for an item
- Underworld layer — Mictlan accessible as dungeon type with inverted rules

## 💡 Historical — Feudal Japan (Samurai) ⭐
References: Ghost of Tsushima, Sekiro, Kurosawa films, Lone Wolf and Cub, Vagabond
Tone: Honor, exile, and inevitability. Nature as aesthetic backdrop to violence.
Narrator voice: Restrained and precise. Nature imagery as emotional language. Silence honored.
UI: #dc2626 red · Mon/Ryō · Stamina/HP
Enemies: Ronin (masterless samurai), oni, tengu, kappa, serpent-spirits, shinobi, corrupt magistrates
Loot: Named katanas and wakizashi (with provenance), lacquered armor, healing herbs, sake (consumable with stat effects), netsuke (trinket valuables), ghost-ward charms
Unique mechanics:
- Honor system — cowardly actions accumulate dishonor; high dishonor closes dialogue paths and changes NPC reactions
- Iaijutsu strike — first-round initiative win opens additional high-damage action option
- Seasonal haiku — LOG entries include a short AI-generated haiku per major location
- Katana durability — named weapons degrade; require maintenance at smithy

## 💡 Historical — Renaissance Italy
References: Assassin's Creed II, The Borgias (TV), Machiavelli
Tone: Decadent and dangerous. Beauty funds murder. Art and assassination share the same patron.
Unique mechanics:
- Patronage system — wealthy NPCs can be cultivated as patrons; they fund resources but expect services
- Poison as craft — certain items combine to create poisons for combat or social encounters
- Conspiracy map — world_state tracks political connections; decisions ripple through faction relationships

## 💡 Historical — Cold War / Espionage
References: The Americans, Tinker Tailor Soldier Spy, Bridge of Spies
Tone: Paranoid and precise. Trust is a weapon. Everyone is compromised.
UI: #374151 Cold War grey · Cash (multiple currencies per region) · HP
Unique mechanics:
- Cover identity — false identity with separate lower trust scores; blown cover triggers hostility
- Dead drops — items left in world locations for allied NPC pickup; asynchronous quest system
- Exfiltration windows — timed exits from hostile locations
- Double agent system — some NPCs secretly allied; PER check to identify

---

# NOIR & CRIME

## 💡 Noir — Classic Film Noir ⭐
References: Chinatown, The Maltese Falcon, Double Indemnity, Raymond Chandler, L.A. Noire
Tone: Rain-slick streets and weary cynicism. The city is rotten. The case always leads somewhere worse.
Narrator voice: First-person hardboiled register. Metaphor-heavy but grounded.
UI: #374151 dark slate / amber accent · Dollar · HP
Enemies: Corrupt cops, mob muscle, femme fatale henchmen, corrupt politicians' security, loan sharks
Loot: Evidence (LORE items building the case), dirty cash, incriminating photographs, snub-nose revolvers, forged documents, ledgers
Settlement: Layered city — nightclub above speakeasy above basement. Precinct house. Pawn shop. Diner at 3am.
Dungeon: Warehouse districts. The villain's penthouse. The docks. City hall subbasement.
Unique mechanics:
- Case file system — LORE items accumulate into a case file; enough evidence unlocks confrontation with true villain
- Contacts network — named NPCs cultivated as informants; one piece of information per region
- Shakedown option — Intimidate extracts information but damages long-term relationship
- The Twist — at a late-game breadcrumb, the perceived villain is innocent and the ally is guilty

## 💡 Noir — Heist
References: Ocean's Eleven, Heat, Payday, The Italian Job, Rififi
Tone: Precision and improvisation. The crew dynamic is everything. The vault is the dungeon.
Unique mechanics:
- Planning phase — before a heist dungeon, allocate preparation items affecting dungeon generation (bribed guards = lower encounter chance)
- Role specialization — crew member NPCs each have specialty unlocking unique interaction options
- Score split — loot from heist dungeons is larger but split with crew
- Heat rating — successful heists increase city-wide Heat; next heist dungeon is harder

## 💡 Noir — Organized Crime / Mafia
References: The Godfather, The Sopranos, Goodfellas, Peaky Blinders, Yakuza (series)
Tone: Intimate and brutal. Power is personal. Betrayal is inevitable.
Unique mechanics:
- Family standing — rises/falls with actions; exile is possible
- Protection racket — recurring passive income from controlled settlement areas; requires maintenance
- Succession event — boss NPC can be killed or arrested; standing determines who fills the power vacuum

## 💡 Spy Thriller ⭐
References: James Bond (serious), John le Carré, Mission: Impossible
Tone: Competence and deception. The hero is brilliant and compromised.
Narrator voice: Precise and elegant. Danger described calmly.
UI: #0f172a midnight blue · Cash (mission-funded) · HP
Unique mechanics:
- Gadget inventory — special single-use items with specific applications (grapple, signal jammer, explosive pen)
- Cover maintenance — disguise mechanic; CHA checks to maintain cover
- Mission briefing — main quest as classified document with explicit objectives
- Double agent option — player can sell information to opposing faction; short-term benefit, long-term consequence

---

# UNCONVENTIONAL

## 💡 Weird West ⭐⭐ TOP RECOMMENDATION
References: Deadlands TTRPG, Weird West (game), Bone Tomahawk, Jonah Hex, True Grit meets Lovecraft
Tone: Laconic and dreadful. Cowboys don't talk much because they've seen things words can't hold. The land is older than the settlers.
Narrator voice: Spare and Western. Short declarative sentences. Landscape as character. Supernatural described with the same flat tone as weather.
UI: #b45309 burnt sienna · Dollar/Gold Dust · Grit
Enemies: Wendigo, skinwalkers, possessed cattle, revenant outlaws (can't be killed without ritual), hex-slinging witches, supernatural railroad gangs, the Hanged Man (boss type), things that wear human skin
Loot: Cursed silver bullets, dreamcatcher charms (passive protection), hex bags (single-use curse), whiskey (consumable with stat effects), Wanted posters (LORE), Native talismans, relics of the Old West dead
Settlement: Frontier towns with one of everything — sheriff's office, saloon, general store, undertaker (busy). The church may or may not help. The Native encampment on the outskirts knows more than anyone.
Dungeon: Abandoned mines (something moved in), cursed canyons, ghost towns where everyone vanished same night, forts where soldiers went mad, ritual sites the railroad tried to build over.
Unique mechanics:
- Ritual system — some enemies can only be permanently killed by performing a ritual (requires specific items + location)
- Hex system — curse/blessing track; hexed players have bad luck modifier on d20 rolls
- Bounty system — player can have a bounty; high bounty causes random bounty hunter encounters
- Spiritual awareness — PER checks reveal supernatural elements before they manifest
- Silver economy — silver is special currency and combat resource simultaneously
- Grit mechanic — Strength equivalent; used for endurance, brawling, surviving harsh environments

## 💡 Urban Fantasy ⭐⭐ TOP RECOMMENDATION
References: The Dresden Files, American Gods, Neverwhere, Rivers of London, October Daye series
Tone: Wonder hiding in plain sight. The city is a palimpsest — the magical world written over it.
Narrator voice: Grounded and contemporary. Normal descriptions that suddenly reveal the uncanny.
UI: #7c3aed purple · Dollar/Magical Favors (dual economy) · HP
Enemies: Fae pretending to be dating app profiles, vampire crime syndicates with corporate fronts, werewolf biker gangs, rogue wizards, demons in middle management, constructs from city debris, old gods working service jobs
Loot: Wards (passive items disguised as jewelry), focus items (magic amplifiers as mundane objects), spell components (herbs from corner stores), true silver (jewelry as weapons), enchanted everyday items
Settlement: City neighborhoods each with magical character. Hub disguised as a dive bar/used bookshop/laundromat. The mundane police station across the street doesn't know.
Dungeon: The parking garage that goes deeper than the building has floors. The office building where the 13th floor only appears at midnight. The subway tunnel that opens onto the Fae Court.
Unique mechanics:
- Veil mechanic — magical events have a mundane explanation planted in narrative; mundane NPCs see the mundane version
- True sight toggle — PER-based ability to see through magical disguises (costs an action)
- Magical community standing — separate from main faction system; hidden world has its own hierarchy
- Glamour items — consumables making the player appear mundane (useful in certain locations)
- Modern tools — smartphone as in-world item (maps, magical contact list, information)

## 💡 Kaiju / Giant Monsters
References: Pacific Rim, Godzilla (Minus One), Shadow of the Colossus, Neon Genesis Evangelion
Tone: Awe and terror at scale. Human life precious because it is fragile.
Unique mechanics:
- Kaiju as dungeon — climbing the monster is the dungeon; body regions are zones with different encounters and loot
- Scale inversion — standard encounters are humans around the kaiju, not the kaiju itself
- World damage — kaiju movement changes the regional map (destroyed buildings = new paths)

## 💡 Progression Fantasy / LitRPG
References: Solo Leveling, Re:Zero, That Time I Got Reincarnated as a Slime, Overlord
Tone: Meta and earnest simultaneously. Characters treat game mechanics as laws of physics.
Narrator voice: Shows the numbers. Characters discuss stats openly. Unusually transparent.
Unique mechanics:
- Visible stat growth — stat gains larger per level than other genres; growth is the explicit reward
- Title system — great deeds earn Titles with passive stat bonuses ("Goblin Slayer," "Dungeon Diver")
- Monster appraisal — high INT allows seeing enemy stats before combat
- Achievement system — hidden achievements unlock visible titles and bonuses

## 💡 Arctic / Antarctic Survival Horror
References: The Thing, At the Mountains of Madness, The Terror, Into the White
Tone: Isolation, frostbite, and creeping madness. The station feels smaller every day.
Unique mechanics:
- Cold as resource — warmth tracked; cold environments drain it; hypothermia causes stat penalties
- Paranoia mechanic — party members (NPCs) become suspects; trust system inverts
- Supply depletion — food/fuel as additional tracked resources alongside HP

## 💡 Underground / Subterranean
References: Journey to the Center of the Earth, Caves of Qud, Dwarf Fortress, Descent
Tone: Claustrophobic and wondrous. Civilizations that never saw sunlight. Geology as mythology.
Unique mechanics:
- Depth system — deeper zones have harder encounters, better loot, and stranger environments
- Bioluminescence economy — light is a resource in dark zones
- Geological loot — crystals, minerals, fossils as valuable and LORE items

---

# MYTHOLOGICAL / SPIRITUAL

## 💡 Norse Mythology
References: God of War (Kratos era), The Gospel of Loki, Prose Edda, Gaiman's Norse Mythology
Tone: Fated but defiant. The end is known; the journey still matters.
Unique mechanics:
- The Norns — fate system; at world creation, three fate threads are set; fighting them is possible but costly
- Rune magic — runic LORE items grant passive bonuses in specific combinations
- Nine Realms — each adjacent region is a different realm with distinct physics (Niflheim cold damage, Muspelheim fire)

## 💡 Greek Mythology
Tone: The gods are watching. They find your suffering entertaining. Try to be entertaining.
Unique mechanics:
- Divine patrons and hubris system (see Mythic Fantasy — this is the historically-accurate version)
- Heroic epithets — earned through great deeds; passive bonuses (The Swift, The Cunning, The Unbowed)
- Underworld as endgame region — Elysian Fields vs. Tartarus based on player's honor track

## 💡 Egyptian Mythology
Unique mechanics:
- Duat dungeon type — underworld accessible as special region; rules inverted (will = survival)
- Ma'at balance — weighing of the heart defeat mechanic
- Shabtis — figurine items activated to fight for the player (single-use summon)

## 💡 Slavic Mythology
References: The Bear and the Nightingale, Pathologic, Deathless (Valente), The Witcher (source material)
Tone: Simultaneously warm and dangerous. The old gods are capricious. Winter is the villain.
Unique mechanics:
- Domovoi system — household spirit appeased or offended; affects settlement resting bonuses
- Seasonal power shifts — world_state season has dramatic mechanical effect (winter = scarcity, spring = renewal)
- Named spirits — every major location has a spirit that can be bargained with

## 💡 African Mythology (Yoruba / Pan-African) ⭐
References: Black Panther (Wakanda cosmology), Anansi Boys (Gaiman), Yoruba oral traditions
Tone: Community and cosmic simultaneously. Power derives from relationship.
Unique mechanics:
- Orisha allegiance — patron grants domain bonuses (Ogun = combat, Oshun = healing/CHA, Shango = power/thunder)
- Ancestor consultation — resting at designated locations allows consulting ancestors for guidance/hints
- Community obligations — individual advancement requires giving back (resource cost for level-ups)

## 💡 Japanese Mythology (Shinto / Yokai)
References: Princess Mononoke, Spirited Away, Nioh, Ōkami, Kubo and the Two Strings
Tone: Coexistence of mundane and sacred. Spirits have rules. Respect is safety.
Unique mechanics:
- Yokai typing — enemies have elemental affinities; certain items effective against specific types
- Shrine system — shrines provide free blessings if properly approached (PER to find, CHA to receive)
- Purity/pollution — sacred areas require purity (no cursed items); violation triggers spirit hostility

## 💡 Polynesian / Pacific Mythology
References: Moana, Te Fiti mythology, Māori legend, Maui stories
Tone: Expansive and communal. Navigation as heroism. The ocean is alive.
Unique mechanics:
- Star navigation — inter-region travel uses star-reading mechanic (INT/PER check) affecting destination and encounters
- Mana resource — separate resource pool (positive equivalent of sanity); earned through honorable acts; powers special abilities
- Wayfinding lore — LORE items are navigation charts revealing adjacent regions on world map

---

# IMPLEMENTATION NOTES

## Priority Tiers for Genre Session

**Tier 1 — Implement first (highest impact, infrastructure already compatible):**
1. Fantasy sub-genres (Light / Classic / Dark) — existing infrastructure, tone/loot overrides only
2. Weird West — most distinctive, highest narrative differentiation
3. Gothic Horror — strong fit, Bloodborne audience, adjacent to existing Horror infrastructure
4. Urban Fantasy — most accessible new genre, huge existing audience

**Tier 2 — Medium term:**
5. Piracy / Age of Sail — exploration mechanic matches game format perfectly
6. Wuxia / Xianxia — large underserved audience, completely different aesthetic
7. Military Sci-Fi — combat-forward, strong loot identity, Warhammer 40k energy
8. Spy Thriller — social combat as primary mechanic is genuinely fresh

**Tier 3 — Later (more mechanical investment required):**
9. Aztec / Mesoamerican — genuinely original, needs cultural research
10. Norse Mythology — nine realms as regional structure is a larger map rework
11. Folk Horror — barter economy and paranoia mechanics need new systems
12. Heist — planning phase is a new pre-dungeon system

## Shared mechanics that cross multiple genres

| Mechanic | Genres that use it | Slot |
|---|---|---|
| Reputation/standing | Mafia, Spy, Piracy, Wuxia | Day 23+ faction system v2 |
| Cover/disguise | Spy, Dystopian, Urban Fantasy | Identity layer on dialogue system |
| Seasonal world state | Folk Horror, Slavic, Fairy Tale, Viking | world_state.season flag |
| Second resource (Sanity/Mana/Qi) | Cosmic Horror, Gothic, Space Horror, Wuxia | Already in types/game.ts |
| Sacrifice/cost mechanics | Aztec, Slavic, Fairy Tale | Bargain system |
| Patrol/detection | Spy, Dystopian, Heist | Day 20.6 stealth |
| Corruption/heat/pollution | Cyberpunk, Dark Fantasy, Gothic, Shinto | Secondary track mechanic |
| Ritual kill requirement | Weird West, Gothic, Folk Horror | Interact-to-complete flag |

## Genre ID naming conventions (when implemented)

```
fantasy_light, fantasy_classic, fantasy_dark
fantasy_sword_sorcery, fantasy_mythic, fantasy_wuxia
fantasy_flintlock, fantasy_fairy_tale, fantasy_dying_earth
cyber_classic, cyber_bio, cyber_solar, cyber_nano
space_opera, space_military, space_horror, space_hard
sci_dystopian, sci_ai_uprising, sci_time
steam_classic, steam_diesel, steam_atompunk
horror_cosmic, horror_gothic, horror_folk
horror_psychological, horror_survival, horror_paranormal
hist_egypt, hist_greece, hist_viking, hist_piracy
hist_aztec, hist_japan, hist_renaissance, hist_coldwar
noir_classic, noir_heist, noir_mafia, noir_spy
weird_west, urban_fantasy, kaiju, progression_fantasy
underground, arctic_survival
myth_norse, myth_greek, myth_egyptian, myth_yoruba
myth_slavic, myth_shinto, myth_polynesian
```
