import { Genre } from "@/types/game";
import type { WorldSeed } from "@/types/game";

/**
 * Per-genre fallback WorldSeed used when the AI generator fails (parse
 * error, network failure, validation reject). These skeletons are
 * intentionally generic but consistent — better than crashing the wizard.
 *
 * The character's name is interpolated into the main quest hook so even the
 * fallback feels personal.
 */
export function fallbackWorldSeed(genre: Genre, characterName: string): WorldSeed {
  switch (genre) {
    case Genre.FANTASY:
      return {
        world_name:    "The Greyspire Marches",
        world_tagline: "An old kingdom on the edge of waking ruin.",
        starting_location: {
          id:           "grey_anchor_inn",
          name:         "The Grey Anchor Inn",
          type:         "tavern",
          description:  "A timber-and-stone roadside inn at the crossroads, lit by oil lanterns and warmed by a wide hearth. Travelers stop here on the way north into the mountains.",
          faction_id:   "wardens_of_the_marches",
          connected_to: ["greyspire_market", "ashen_road"],
        },
        known_locations: [
          { id: "greyspire_market", name: "Greyspire Market",  type: "market",     description: "A walled market square below the keep where merchants from the lowlands trade for highland metals.",                connected_to: ["grey_anchor_inn"] },
          { id: "ashen_road",       name: "The Ashen Road",    type: "wilderness", description: "A long mountain road running north past burnt-out farmsteads. Travel after dusk is discouraged.",                  connected_to: ["grey_anchor_inn"] },
          { id: "old_keep",         name: "The Old Keep",      type: "stronghold", description: "A weathered stone keep on a ridge. Garrisoned by the Wardens. Strangers are watched but not turned away.",         connected_to: ["greyspire_market"] },
        ],
        key_npcs: [
          { id: "marta_ironwood",     name: "Marta Ironwood",     role: "innkeeper",     location_id: "grey_anchor_inn",   personality: "Sharp-tongued but fair. Trades gossip for silver and remembers every face.",         knows_about: ["the burnings on the Ashen Road", "rumors from the Old Keep"], is_merchant: false },
          { id: "dren_silvercoin",    name: "Dren Silvercoin",    role: "merchant",      location_id: "greyspire_market",  personality: "A guarded trader who'll sell to anyone with coin and a name.",                          knows_about: ["smuggled goods", "missing caravans"],                       is_merchant: true  },
          { id: "warden_caron_brask", name: "Warden Caron Brask", role: "warden_captain", location_id: "old_keep",          personality: "Stoic, suspicious of outsiders. Trusts deeds over words.",                              knows_about: ["the missing patrol", "strange lights to the north"],         is_merchant: false },
        ],
        main_quest: {
          title:         "The Burnings",
          hook:          `${characterName}, a stranger newly arrived at the Grey Anchor, hears talk of farmsteads going up in flame along the Ashen Road.`,
          antagonist:    "Something — or someone — that travels with fire and leaves no footprints.",
          goal:          "Discover who or what is burning the steadings and stop them before the road north is closed entirely.",
          breadcrumbs: [
            "A patrol of Wardens went north a fortnight ago and never returned.",
            "Witnesses describe figures cloaked in red moving against the wind.",
            "Burned farms are missing more than livestock — every adult is gone.",
            "An old map in the keep marks a forgotten shrine in the high valleys.",
            "The lights at night follow no constellation, and no one will name them.",
          ],
          win_condition: "Confront the source of the burnings and either destroy or pacify it.",
        },
        factions: [
          { id: "wardens_of_the_marches", name: "Wardens of the Marches", disposition: "ally",   territory: "Old Keep, Grey Anchor Inn" },
          { id: "ashfall_cult",           name: "The Ashfall Cult",       disposition: "enemy",  territory: "Northern wilderness, abandoned shrines" },
        ],
      };

    case Genre.CYBERPUNK:
      return {
        world_name:    "Sector Halcyon-7",
        world_tagline: "A corporate arcology where the only sky is a billboard.",
        starting_location: {
          id:           "neon_root_bar",
          name:         "Neon Root",
          type:         "tavern",
          description:  "A basement bar three levels below the arcology spine, walls papered with old ad-decals. Locals call it neutral ground; the corps mostly leave it alone.",
          faction_id:   "the_unseen_grid",
          connected_to: ["spine_market_42", "outer_drift"],
        },
        known_locations: [
          { id: "spine_market_42", name: "Spine Market 42",   type: "market",     description: "A vertical bazaar bolted to the arcology core. Anything can be bought if you know the right stall.", connected_to: ["neon_root_bar"] },
          { id: "outer_drift",     name: "The Outer Drift",   type: "wilderness", description: "Service corridors and abandoned subway tunnels at the arcology's outer ring. Surveillance is patchy.", connected_to: ["neon_root_bar"] },
          { id: "atrius_tower",    name: "Atrius Tower",      type: "stronghold", description: "Headquarters of Atrius Holdings. Corporate enforcers patrol the lobby. Civilians are tolerated, not welcomed.", connected_to: ["spine_market_42"] },
        ],
        key_npcs: [
          { id: "vex_mireno",   name: "Vex Mireno",   role: "barkeep",  location_id: "neon_root_bar",   personality: "Unflappable, encyclopedic memory. Trades favors as easily as drinks.",                       knows_about: ["who is hiring", "the missing courier"], is_merchant: false },
          { id: "kira_hollows", name: "Kira Hollows", role: "fixer",    location_id: "spine_market_42", personality: "Sharp, transactional. Has a contact for every problem and a price for every contact.",        knows_about: ["the leaked data drop", "an Atrius mole"],   is_merchant: true  },
          { id: "agent_reyes",  name: "Agent Reyes",  role: "corp_enforcer", location_id: "atrius_tower",    personality: "Cold, professional, blink-quick on a draw. Will kill if a contract requires it.",          knows_about: ["the courier's last sighting", "Atrius internal security"], is_merchant: false },
        ],
        main_quest: {
          title:         "The Courier",
          hook:          `Word at the Neon Root: a courier vanished with an Atrius data spike. ${characterName} is in the wrong bar at the wrong time.`,
          antagonist:    "Atrius Holdings and whoever paid the courier to run.",
          goal:          "Find the courier — or what they were carrying — before Atrius does.",
          breadcrumbs: [
            "A burner phone left on the bar with one missed call.",
            "Spine Market vendors whisper about a dead drop in the Outer Drift.",
            "Atrius black SUVs have been seen on perimeter sweeps.",
            "The data spike was reportedly proof of something inside Atrius itself.",
            "A second courier is rumored to be hiding in the lower levels.",
          ],
          win_condition: "Recover the data spike and decide what to do with it.",
        },
        factions: [
          { id: "atrius_holdings",  name: "Atrius Holdings",  disposition: "enemy",   territory: "Atrius Tower, upper Spine" },
          { id: "the_unseen_grid",  name: "The Unseen Grid",  disposition: "neutral", territory: "Neon Root, Outer Drift" },
        ],
      };

    case Genre.HORROR_LOVECRAFTIAN:
      return {
        world_name:    "Innsbough",
        world_tagline: "A coastal village where the tide brings things back.",
        starting_location: {
          id:           "tarnished_lantern",
          name:         "The Tarnished Lantern",
          type:         "tavern",
          description:  "A salt-warped pub on the harbor road, half its tables empty even on market days. The keeper does not meet your eye.",
          faction_id:   "village_council",
          connected_to: ["fishmonger_row", "old_chapel"],
        },
        known_locations: [
          { id: "fishmonger_row", name: "Fishmonger Row", type: "market",     description: "A row of stalls along the docks. Catches are smaller every season; locals do not speak of why.",                  connected_to: ["tarnished_lantern"] },
          { id: "old_chapel",     name: "The Old Chapel", type: "ruin",       description: "A roofless stone chapel above the cliffs. The bell still rings on certain nights though no one climbs the tower.", connected_to: ["tarnished_lantern"] },
          { id: "drowned_caves",  name: "The Drowned Caves", type: "dungeon", description: "Sea caves accessible only at the lowest tide. Locals will not enter them.",                                          connected_to: ["fishmonger_row"] },
        ],
        key_npcs: [
          { id: "elias_thorne",      name: "Elias Thorne",      role: "publican",   location_id: "tarnished_lantern", personality: "Watchful, weary. Speaks in half-sentences and never about the chapel.",         knows_about: ["the missing fishermen", "the chapel bell"],     is_merchant: false },
          { id: "moren_wick",        name: "Moren Wick",        role: "fishmonger", location_id: "fishmonger_row",    personality: "Cheerful in a way that doesn't reach his eyes. Will sell anything he caught.",  knows_about: ["the empty nets", "what came up last month"],     is_merchant: true  },
          { id: "sister_hennoch",    name: "Sister Hennoch",    role: "scholar",    location_id: "old_chapel",        personality: "Calm, exhausted, terrified of nightfall.",                                       knows_about: ["the chapel's old rites", "names that should not be spoken"], is_merchant: false },
        ],
        main_quest: {
          title:         "The Returning Tide",
          hook:          `${characterName} arrives in Innsbough as a fishing skiff comes back without its crew. The keeper of the Lantern says nothing about it.`,
          antagonist:    "Something beneath the water that the village has been feeding for generations.",
          goal:          "Learn what the village has bargained with — and decide whether to break the pact or keep it.",
          breadcrumbs: [
            "Empty nets, but with strange fragments tangled in them.",
            "A bell that rings without a hand on the rope.",
            "Doors locked from the inside in homes whose owners never returned.",
            "A page torn from the chapel's record book hidden under a table.",
            "Something just under the surface watching the harbor at low tide.",
          ],
          win_condition: "Confront the thing beneath the chapel and choose your bargain — or refuse it.",
        },
        factions: [
          { id: "village_council", name: "The Village Council", disposition: "neutral", territory: "Innsbough proper" },
          { id: "the_drowned",     name: "The Drowned",         disposition: "enemy",   territory: "The caves and what lies beyond them" },
        ],
      };

    case Genre.SPACE_OPERA:
      return {
        world_name:    "Helion Reach",
        world_tagline: "A frontier system where empire law arrives only after the funeral.",
        starting_location: {
          id:           "docking_bay_alpha",
          name:         "Docking Bay Alpha",
          type:         "port",
          description:  "A scarred orbital docking platform serving inbound traders to Helion Prime. Half the bay lights are out and security is laissez-faire.",
          faction_id:   "free_trader_pact",
          connected_to: ["concourse_market", "reach_station_core"],
        },
        known_locations: [
          { id: "concourse_market",    name: "The Concourse",       type: "market",     description: "An open-air bazaar suspended over the bay floor, stalls of every species. Currency is whatever the seller will accept.", connected_to: ["docking_bay_alpha"] },
          { id: "reach_station_core",  name: "Station Core",        type: "stronghold", description: "The administrative spine of the orbital. Imperial agents nominally run it; nothing nominally runs it.",               connected_to: ["docking_bay_alpha"] },
          { id: "scrap_belt",          name: "The Scrap Belt",      type: "wilderness", description: "A debris field of old wrecks within easy shuttle distance. Pirates and scavengers operate freely.",                       connected_to: ["concourse_market"] },
        ],
        key_npcs: [
          { id: "captain_maren_olla",  name: "Captain Maren Olla",  role: "freighter_captain", location_id: "docking_bay_alpha",   personality: "Direct, jaded, fiercely loyal to her crew.",                                            knows_about: ["the missing freighter", "imperial inspection schedules"], is_merchant: false },
          { id: "broker_iss_velo",     name: "Broker Iss Velo",     role: "broker",            location_id: "concourse_market",     personality: "Unctuous and quick-witted. Knows every transaction in the bay.",                       knows_about: ["under-the-counter cargo", "Imperial bounties"],          is_merchant: true  },
          { id: "magistrate_korrik",   name: "Magistrate Korrik",   role: "imperial_agent",    location_id: "reach_station_core",   personality: "Bureaucratic and bored, but suspicious when pressed.",                                  knows_about: ["the freighter incident report", "active warrants"],      is_merchant: false },
        ],
        main_quest: {
          title:         "The Lost Freighter",
          hook:          `An Imperial freighter went silent over the Scrap Belt. ${characterName} arrives in the bay just as Captain Olla is told no rescue will be authorized.`,
          antagonist:    "Whoever, or whatever, took the freighter — and the Imperial authority that wants it forgotten.",
          goal:          "Find the freighter and what it was really carrying.",
          breadcrumbs: [
            "A debris signature in the Scrap Belt that doesn't match the manifest.",
            "Imperial inspectors are quietly buying up surveillance footage.",
            "Three other ships have vanished in the same approach lane this season.",
            "A wreck broker is selling a salvage tag from the freighter — too soon.",
            "The freighter's last transmission is one word, repeated.",
          ],
          win_condition: "Recover the freighter's cargo or its truth, and decide whom to trust with it.",
        },
        factions: [
          { id: "imperial_authority", name: "The Imperial Authority", disposition: "neutral", territory: "Station Core, Helion Prime" },
          { id: "free_trader_pact",   name: "The Free Trader Pact",   disposition: "ally",    territory: "Docking Bay Alpha, the Concourse" },
        ],
      };

    case Genre.POST_APOCALYPTIC:
    default:
      return {
        world_name:    "The Hollow Coast",
        world_tagline: "Three generations after the sky burned, someone still has to find dinner.",
        starting_location: {
          id:           "salt_lantern_camp",
          name:         "The Salt Lantern",
          type:         "settlement",
          description:  "A scavenger camp built into the shell of a beached cargo ship. Drinking water is rationed; news is currency.",
          faction_id:   "lantern_traders",
          connected_to: ["coast_market", "ash_flats"],
        },
        known_locations: [
          { id: "coast_market", name: "Coast Market", type: "market",     description: "A weekly trade circle outside the Salt Lantern. Caps and ammunition pass for currency. Outsiders are watched.", connected_to: ["salt_lantern_camp"] },
          { id: "ash_flats",    name: "The Ash Flats", type: "wilderness", description: "A bleached salt plain where the old highway used to run. Heat shimmers hide whatever is moving on it.",          connected_to: ["salt_lantern_camp"] },
          { id: "rust_chapel",  name: "The Rust Chapel", type: "ruin",   description: "A pre-collapse fuel station turned shrine, run by a wandering preacher. Travelers leave offerings of working ammunition.", connected_to: ["coast_market"] },
        ],
        key_npcs: [
          { id: "old_renko",     name: "Old Renko",     role: "camp_elder",  location_id: "salt_lantern_camp", personality: "Tired, blunt, has heard every lie. Will help anyone who asks straight.",          knows_about: ["the missing scavenger party", "the chapel preacher"],   is_merchant: false },
          { id: "trader_bex",    name: "Trader Bex",    role: "merchant",    location_id: "coast_market",      personality: "Loud, generous with strangers, unsentimental about prices.",                       knows_about: ["who's been buying ammo lately", "raider movements"],     is_merchant: true  },
          { id: "preacher_korl", name: "Preacher Korl", role: "wanderer",    location_id: "rust_chapel",       personality: "Soft-spoken, eyes always on the horizon. Speaks of a 'voice in the flats'.",      knows_about: ["the lights at night", "what's beyond the highway"],      is_merchant: false },
        ],
        main_quest: {
          title:         "The Missing Scavengers",
          hook:          `A scavenger party from the Salt Lantern was due back at first light. ${characterName} hears Old Renko quietly counting empty bunks.`,
          antagonist:    "Raiders who don't act like raiders — and whatever they're working for.",
          goal:          "Find the scavengers, alive if possible, and learn what's really moving on the Ash Flats.",
          breadcrumbs: [
            "A child's water canteen left on the road north of camp.",
            "Spent shells of a calibre nobody at the Lantern uses.",
            "Lights moving in formation on the flats at night.",
            "The preacher's offerings have stopped vanishing — something has stopped collecting them.",
            "A raider taken at the market won't speak, but won't stop smiling.",
          ],
          win_condition: "Recover the scavengers or their fate, and decide what to do about the thing on the flats.",
        },
        factions: [
          { id: "lantern_traders", name: "The Lantern Traders", disposition: "ally",  territory: "Salt Lantern, Coast Market" },
          { id: "ash_walkers",     name: "The Ash Walkers",     disposition: "enemy", territory: "The Ash Flats and beyond" },
        ],
      };
  }
}
