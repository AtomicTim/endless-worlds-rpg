/**
 * Day 19C — Tier 2 Ambient Object Library
 *
 * Every WorldBible location carries an `ambient_type` (e.g.
 * "tavern_common_room", "smithy"). When the player tries to examine or
 * interact with something at a location, the engine first asks this
 * library: "is the target one of the ambient objects you know about?"
 * If yes, we return a flavour line instantly — no AI call, no state
 * change. If not, the engine falls through to Tier 3 (a brief
 * narrator-driven ambient response).
 *
 * Three tiers, simply put:
 *   Tier 1 — AI-generated LocationObjects (LocationDefinition.objects).
 *   Tier 2 — these templates. Code-driven, instant, never highlighted.
 *   Tier 3 — narrator handles "anything else the player tries".
 *
 * Coverage spans every location type across all five active genres:
 *   Fantasy / Cyberpunk / Horror-Lovecraftian / Space Opera / Post-Apoc.
 *
 * Each entry is a 1-2 sentence atmospheric description. Responses must
 * never describe the object disappearing, never deny existence, never
 * say "you can't do that" — the player's freedom to try is preserved.
 */

export interface AmbientObject {
  /** The lowercase keyword the player has to mention to match this object. */
  name:     string;
  /** 1-2 sentence atmospheric response. No game state change. */
  response: string;
}

export const AMBIENT_OBJECTS: Record<string, AmbientObject[]> = {
  // ──────────────────────────────────────────────────────────────────────────
  // FANTASY
  // ──────────────────────────────────────────────────────────────────────────
  tavern_common_room: [
    { name: "fireplace",         response: "The fireplace crackles steadily, throwing dancing shadows across the timber walls. Its warmth has soaked into the very stone of the hearth." },
    { name: "bar counter",       response: "A long slab of dark, oil-rubbed wood, scarred by countless tankards and the occasional knife. The grain catches the firelight in soft amber whorls." },
    { name: "bar stools",        response: "The stools are worn smooth by generations of travellers. One has a missing leg propped up by a folded coaster." },
    { name: "ale casks",         response: "Heavy oak casks stacked behind the bar, their bellies dark with seepage. The air around them is thick with the yeasty bite of fermentation." },
    { name: "scattered tables",  response: "Rough-hewn timber tables, each one scored by years of dice games and spilled drinks. A few still bear half-empty mugs." },
    { name: "notice board",      response: "A patchwork of weathered flyers and faded bounty notices. Most are old enough that their ink has all but vanished." },
    { name: "mounted animal heads", response: "Trophies of the road — a stag, something tusked, something with too many eyes. Their glassy stares follow you whichever way you turn." },
    { name: "window",            response: "The thick glass distorts the road outside into wavering bands of light and shape. A traveller passes, made strange by the warp." },
    { name: "hearth poker",      response: "A long iron poker leans against the hearth, its tip blackened and warm to the touch. A pair of tongs rests beside it." },
    { name: "drip candles",      response: "Tallow candles in iron holders, each surrounded by a hardened lake of pale wax. They smoke faintly as they burn." },
  ],

  tavern_upper_rooms: [
    { name: "narrow hallway",    response: "A cramped corridor lined with closed doors, each numbered in faded paint. The floorboards complain at every step." },
    { name: "guest room door",   response: "A simple plank door with an iron latch. A faint murmur of voices leaks from somewhere down the hall." },
    { name: "small window",      response: "A square of cloudy glass overlooking the rooftops. The view stretches to the edge of the settlement and the wilds beyond." },
    { name: "chamber pot",       response: "A glazed clay pot tucked discreetly beneath the bedframe. Empty, thankfully." },
    { name: "wooden washbasin",  response: "A simple bowl on a stand, half-full of cool water. A folded linen cloth sits beside it." },
    { name: "straw mattress",    response: "Lumpy and a little damp, but serviceable. The ticking smells faintly of the road." },
    { name: "iron candleholder", response: "A heavy iron candleholder bolted to the wall, its candle long since guttered to a stub." },
  ],

  smithy: [
    { name: "anvil",             response: "Heavy iron, pitted with the marks of a thousand hammered blades. The horn is worn smooth where the smith's hands have rested." },
    { name: "forge",             response: "Banked coals glow orange behind a layer of ash. The heat washes against your face even at a distance." },
    { name: "cooling barrel",    response: "A wooden barrel of murky, oil-slicked water. A film of soot trembles on its surface." },
    { name: "weapon rack",       response: "A row of half-finished blades and tools, each waiting its turn at the forge. The steel still holds the dark of the quench." },
    { name: "workbench",         response: "Covered in metal filings, half-finished projects, and a scatter of well-loved hammers and tongs." },
    { name: "bellows",           response: "Great leather lungs strapped to a wooden frame. Their hinges creak when you brush against them." },
    { name: "coal bin",          response: "A bin heaped with anthracite, the dust black on every surface within reach. A scoop is buried halfway down." },
    { name: "apprentice's tools", response: "A smaller, cleaner set of files and chisels, neatly arranged. Whoever the apprentice is, they take care of their gear." },
    { name: "horseshoe pile",    response: "A heap of finished and rejected horseshoes in a corner. A few are still warm from the forge." },
  ],

  market_stall: [
    { name: "display counter",   response: "A long wooden surface laid out with sample wares — knot-tied ribbons, dried herbs, a few polished trinkets." },
    { name: "hanging goods",     response: "Bundles of dried meat, herbs, and lengths of cloth dangle from hooks above. They sway slightly as you move beneath them." },
    { name: "merchant's scales", response: "A pair of brass scales, their pans tarnished green at the edges. A small stack of weights sits beside them." },
    { name: "coin purse drawer", response: "A small drawer set into the counter. The merchant's hand drifts toward it whenever you step too close." },
    { name: "locked storage chest", response: "A heavy iron-bound chest pushed against the back wall behind the counter. Its lock looks expensive — and so does whatever it guards." },
    { name: "sample wares",      response: "Goods displayed on hooks for the curious — ribbons, charms, a couple of carved wooden tokens. Nothing of obvious value." },
  ],

  temple_shrine: [
    { name: "altar stone",       response: "A weathered slab of pale stone, the grooves of old offerings worn into its surface. The air around it feels still, deliberate." },
    { name: "offering bowl",     response: "A shallow bronze bowl on the altar, half-filled with dried petals and the occasional copper coin." },
    { name: "prayer candles",    response: "Rows of slim white candles, some lit, most spent. Their flames lean as one whenever the door opens." },
    { name: "religious iconography", response: "Carved symbols and woven hangings adorn the walls — old work, lovingly maintained. The motifs repeat in unfamiliar patterns." },
    { name: "donation box",      response: "A locked wooden box bolted to the floor near the entrance. The slot at the top is rubbed shiny by years of fingertips." },
    { name: "ceremonial robes",  response: "Heavy embroidered robes hang on a peg by the side door, smelling faintly of incense and old wool." },
    { name: "holy water basin",  response: "A shallow stone basin near the entrance, its water clouded with motes of dust and pollen. The surface is utterly still." },
  ],

  guild_hall: [
    { name: "member roster",     response: "A great board of names, ranks, and dues — most in fresh ink, a few crossed through with finality. Yours is not among them." },
    { name: "sealed contracts",  response: "A neat stack of waxed and ribboned contracts on the desk. The seals are pristine; the secrets within are not yours to read." },
    { name: "heraldic banner",   response: "A long banner hangs from the rafters, the guild's sigil bold in fading dyes. A patch of moth damage betrays its age." },
    { name: "meeting table",     response: "A long oak table strewn with papers, ledgers, and a few mugs gone cold. Someone has sketched a map in the margins of a contract." },
    { name: "locked cabinet",    response: "A tall iron-banded cabinet against the far wall. The keyhole is worn but the lock looks recently oiled." },
  ],

  garrison_post: [
    { name: "weapon rack",       response: "A rack of duty arms — pikes, short swords, a couple of crossbows. Each piece is stamped with the garrison's mark." },
    { name: "guard duty roster", response: "A chalkboard listing watches, names, and rotations. A few entries have been hastily scratched out and rewritten." },
    { name: "wanted posters",    response: "A wall of weathered posters — fugitives, deserters, the occasional missing person. Some of the faces look quite recent." },
    { name: "barracks bunks",    response: "Stacked wooden bunks lining the back wall, each with a folded blanket and a footlocker. The mattresses smell of straw and oiled steel." },
    { name: "iron lockbox",      response: "A heavy strongbox chained to the floor beside the duty desk. The chain is thicker than your wrist." },
    { name: "holding cell bars", response: "A small barred cell stands empty in the corner, its straw freshly turned. The lock looks well-maintained." },
  ],

  town_square: [
    { name: "central fountain",  response: "Water arcs from a weathered stone spout into a moss-green basin. A few coins glint in the silt at the bottom." },
    { name: "well",              response: "A round stone well with a rope and bucket, the water dark and inviting at the bottom of its long shaft." },
    { name: "market stalls",     response: "A scatter of bright awnings and shouted prices fills the edges of the square. Most of the goods are commonplace." },
    { name: "cobblestones",      response: "Worn flat by carts and feet, slick where the rain has pooled. Tufts of grass have made homes between the stones." },
    { name: "lamp post",         response: "A wrought-iron post topped with an oil lantern. The glass is sooted from years of nightly burns." },
    { name: "public notice board", response: "A board of pinned proclamations, lost-pet flyers, and faded edicts. The most recent notice is barely a week old." },
    { name: "hitching post",     response: "A simple timber post with iron rings, polished smooth where reins have been looped. Hoofprints in the dirt nearby." },
  ],

  wilderness_path: [
    { name: "fallen log",        response: "A moss-furred log lies across the trail, soft with rot. Insects scurry from beneath when your shadow falls across it." },
    { name: "mossy stones",      response: "A scatter of stones blanketed in soft green. They look like they've been here longer than any road." },
    { name: "animal tracks",     response: "Fresh tracks press into the mud beside the path — something larger than a deer, smaller than a horse. They lead off into the undergrowth." },
    { name: "scattered leaves",  response: "Drifts of damp leaves lie thick across the path, hiding roots and stones beneath. Each step releases the loamy smell of the forest floor." },
    { name: "distant sounds of wildlife", response: "Birds call from somewhere in the canopy, and farther off, something larger moves through the brush. None of it sounds urgent." },
    { name: "stream",            response: "A narrow stream winds across the path, clear over a bed of pebbles. The water is cold enough to numb your fingers." },
    { name: "creek",             response: "A shallow creek burbles beneath a half-rotted plank bridge. The water is the colour of weak tea where it runs over the leaves." },
  ],

  dungeon_corridor: [
    { name: "torch sconce",      response: "An iron sconce on the wall, its torch long since burned to a nub of charcoal. Soot streaks the stone above it." },
    { name: "stone floor drain", response: "A narrow grate set into the flagstones. Whatever flows beneath sounds slow and deliberate." },
    { name: "rusted iron door",  response: "A heavy iron door, its surface rusted to a flaking orange crust. The hinges look like they've not been turned in years." },
    { name: "cracks in the masonry", response: "Hairline cracks branch through the stonework, dust drifting from them at the slightest tremor. The walls have been here longer than they should be standing." },
    { name: "spider webs",       response: "Thick veils of cobweb stretch across the corners, heavy with dust. The makers have long since moved on — or are simply hiding." },
    { name: "faded wall markings", response: "Symbols scratched into the stone at chest height, almost obliterated by time. A few might be tally marks; others are less reassuring." },
  ],

  dungeon_chamber: [
    { name: "iron maiden",       response: "A man-shaped iron casket leans against the wall, its door slightly ajar. You decline to look inside." },
    { name: "torture device",    response: "Some kind of frame and lever, dark with age. Its purpose is unmistakable, and you avert your eyes." },
    { name: "bone pile",         response: "A heap of bones in the corner — some animal, some not. Most are picked clean; a few are scored with old tooth marks." },
    { name: "crumbling altar",   response: "A low altar at the chamber's centre, its surface stained dark and its edges chipped away. Something was done here a long time ago." },
    { name: "old campfire remnants", response: "A blackened ring of stones encircles a heap of cold ash. Whoever camped here moved on hurriedly." },
    { name: "discarded equipment", response: "Scraps of armour, a broken spear, a gnawed waterskin — the leavings of someone who didn't make it back out." },
  ],

  // ──────────────────────────────────────────────────────────────────────────
  // CYBERPUNK
  // ──────────────────────────────────────────────────────────────────────────
  bar_interior: [
    { name: "neon sign",         response: "A flickering neon glyph buzzes overhead, painting the bar in pulses of magenta and cyan. One of the tubes hisses faintly when you pass beneath it." },
    { name: "data terminal",     response: "A small screen embedded in the bartop scrolls drink prices and the latest pirated newsfeed. The interface is fingerprinted to opacity." },
    { name: "cracked bar stool", response: "A vinyl stool patched with packing tape. The padding inside has gone the colour of old chewing gum." },
    { name: "security camera",   response: "A camera dome in the ceiling corner. Its red light has been spray-painted out — whether by management or a customer is anyone's guess." },
    { name: "holographic drink menu", response: "A pale blue hologram hovers above the bar, listing drinks with names you don't recognise and prices you do." },
    { name: "back room door",    response: "A heavy door set into the rear wall, its keypad scuffed and one number rubbed almost smooth. The hinges have been recently oiled." },
  ],

  street_level: [
    { name: "rain gutter",       response: "An overflowing gutter spills neon-tinted runoff into the street, the smell of solvents rising with the steam. Trash circles in the puddle below." },
    { name: "discarded credstick", response: "A battered credstick lies in the gutter, snapped clean at the connector. Whoever lost it isn't coming back for it." },
    { name: "gang marking",      response: "A tag sprayed across the wall in three layered colours. You can't read the script, but you can read the warning in it." },
    { name: "broken streetlight", response: "A streetlight droops at an awkward angle, its housing cracked and dark. Sparks drip occasionally from its severed conduit." },
    { name: "public data kiosk", response: "A scuffed kiosk offers maps, news, and discount ad-loops to anyone who'll watch. Half the touchscreen is unresponsive." },
    { name: "trash compactor",   response: "An automated compactor groans through another cycle, the smell of pulped synthetics drifting out of its vents." },
  ],

  corp_lobby: [
    { name: "reception desk",    response: "A curved desk of brushed steel and tempered glass, currently unmanned. A small holographic name-plate flickers between languages." },
    { name: "security scanner",  response: "An archway of softly glowing blue, scanning everyone who passes. Its purr is felt more than heard." },
    { name: "corporate logo",    response: "The company's sigil rotates slowly above the lobby, machined from polished alloy. It is much larger than is strictly necessary." },
    { name: "elevator bank",     response: "A row of mirrored doors, each marked with a different floor range. They open and close with a discreet, expensive hush." },
    { name: "visitor badge dispenser", response: "A small kiosk offering temporary badges to verified guests. The screen glares red until proper credentials are presented." },
  ],

  back_alley: [
    { name: "dumpster",          response: "A scarred industrial dumpster, its lid askew. The smell coming off it suggests something organic and something distinctly not." },
    { name: "fire escape ladder", response: "A rusted iron ladder bolted to the wall, the lowest rung dangling out of reach. Someone has tied a knotted rope to it for emergencies." },
    { name: "surveillance camera", response: "A camera pivots silently above the dumpster, its lens beaded with rain. Its tally light is off — unconvincingly so." },
    { name: "chalk markings",    response: "Faint chalk arrows and glyphs trail along the brickwork — runner code, navigation hints, names crossed out. Most of it is faded past reading." },
    { name: "puddles",           response: "Oily puddles reflect the neon overhead in greasy pinks and greens. They tremble whenever the air conditioning roars somewhere above." },
  ],

  data_hub: [
    { name: "server rack",       response: "A black tower of stacked drives, indicator LEDs flickering in patterns too quick to follow. The hum settles into your back teeth." },
    { name: "cooling fan array", response: "Banks of fans pull warm air out of the room with a steady, monotone roar. The breeze carries the dry smell of hot plastic." },
    { name: "blinking indicator lights", response: "Hundreds of tiny status lights wink across the racks, green and amber and the occasional unhappy red. None of them seem to be screaming yet." },
    { name: "cable management chaos", response: "A nightmare of patch cables sags between the racks, half of them unlabelled. Someone has given up and zip-tied the entire mess together." },
    { name: "UPS battery bank",  response: "A wall of sealed batteries trickles power into the room with a low electrical hum. A small display ticks down minutes of runtime." },
    { name: "diagnostic terminal", response: "A console with a green-on-black readout scrolls system logs faster than you can read them. The keyboard's letters are worn off the most-used keys." },
  ],

  underground_den: [
    { name: "makeshift sleeping area", response: "A nest of blankets, foam pads, and rolled-up coats tucked into the corner. Someone has been sleeping here in shifts." },
    { name: "encrypted comm device", response: "A handheld unit with its casing screwed open, wires soldered in patterns that aren't standard. A green LED pulses slowly beneath it." },
    { name: "stolen corp equipment", response: "A small heap of branded crates and devices, the corporate logos partly scoured off. Some of it is still in factory plastic." },
    { name: "chemical smell",    response: "A sharp, antiseptic tang drifts from somewhere deeper in — solvent, or worse. Your eyes water if you breathe too deeply." },
  ],

  // ──────────────────────────────────────────────────────────────────────────
  // HORROR / LOVECRAFTIAN
  // ──────────────────────────────────────────────────────────────────────────
  manor_entrance: [
    { name: "moth-eaten coat rack", response: "A tall coat rack stands in the foyer, draped with a single mildewed coat that no one has worn in decades. The shoulders sag with dust." },
    { name: "antique mirror",    response: "A tall pier-glass in a tarnished silver frame. Your reflection seems to lag a half-beat behind your movements — surely a trick of the light." },
    { name: "grandfather clock", response: "A great walnut clock stands stopped at twelve minutes past three. Its pendulum hangs motionless, but you'd swear you hear it ticking." },
    { name: "faded family portrait", response: "A heavy oil painting of a family arranged in stiff Victorian poses. One of the figures has been carefully scratched out." },
    { name: "creaking floorboards", response: "The floorboards groan beneath your weight, and they groan again a moment after you've stepped off them." },
    { name: "east wing door",    response: "A heavy panelled door leads off the entrance hall to the east. The brass handle is cold enough to leave its shape on your palm." },
  ],

  manor_study: [
    { name: "roll-top desk",     response: "A vast roll-top desk dominates the room, its slatted cover lowered. A faint smell of old ink and tobacco rises from the seams." },
    { name: "bookshelves",       response: "Floor-to-ceiling shelves of leather-bound volumes, each one slightly out of true with the next. A film of dust softens every spine." },
    { name: "candelabra",        response: "A heavy bronze candelabra sits on a side table, its candles burned down to uneven nubs. Wax drips have hardened in the shape of small white teeth." },
    { name: "correspondence tray", response: "A silver tray heaped with yellowed letters, the topmost addressed in a hand that wavered as it wrote. The seals are unbroken." },
    { name: "taxidermy",         response: "A glass case mounts a stuffed creature you can't quite name — too many limbs for a fox, too few for a spider. Its eyes catch the light eagerly." },
  ],

  manor_cellar: [
    { name: "wine rack",         response: "Tall wooden racks cradle bottles whose labels have peeled to illegibility. A few are clouded with sediment in colours wine should not be." },
    { name: "root vegetable storage", response: "Bins of withered roots and shrivelled tubers, soft to the touch. The smell is sweet and unsettling." },
    { name: "damp stone walls",  response: "Beads of moisture trickle down the walls in slow, persistent lines. The mortar is dark with damp where it isn't crumbling away." },
    { name: "coal chute",        response: "A wooden hatch in the ceiling opens onto a chute long since exhausted of coal. Cold air seeps from it, smelling of wet stone." },
    { name: "iron shackle ring", response: "A rusted iron ring is set into the wall at chest height. Whatever it was meant to hold has long since gone — or so you tell yourself." },
    { name: "scratching sounds", response: "Somewhere behind the masonry, something scratches at the stone in fits and starts. It might be rats. You hope it is rats." },
  ],

  asylum_corridor: [
    { name: "padded wall panel", response: "A panel of stained canvas-wrapped padding lines a stretch of corridor, its surface marked with countless tiny scratches and bites." },
    { name: "locked observation window", response: "A small wire-glass window in a cell door. The room beyond is dark, and something pale shifts away when your eye reaches the glass." },
    { name: "stained floor tiles", response: "Cracked white tiles run the length of the corridor. Several have been bleached too many times — and one has not been bleached enough." },
    { name: "emergency pull cord", response: "A frayed red cord dangles from the ceiling at intervals along the hall. The end of one swings gently, though no one is near it." },
    { name: "numbered room plaques", response: "Small enamelled plaques mark each door — 11, 13, 14, 14, 16. You count again. The numbers are not what they were." },
  ],

  ritual_chamber: [
    { name: "chalk circle",      response: "A complex circle of chalk and ash spans most of the floor, its lines smudged in places where someone has stepped through. The pattern is not one you recognise — and you are sure you should not." },
    { name: "black candles",     response: "Tall black candles ring the chamber, their flames standing perfectly still despite the draught. The shadows they throw do not match their shapes." },
    { name: "esoteric texts",    response: "Books and loose vellum scattered across a low table, the scripts impossibly varied. One page seems to rearrange itself when you blink." },
    { name: "brass bowl",        response: "A heavy brass bowl sits in the centre of the circle, its interior coated in a dark, tacky residue. A copper smell rises from it faintly." },
    { name: "carved symbols",    response: "Symbols are gouged deep into the walls — fresh enough that splinters still curl at the edges. The longer you look at them, the less still they feel." },
  ],

  // ──────────────────────────────────────────────────────────────────────────
  // SPACE OPERA
  // ──────────────────────────────────────────────────────────────────────────
  station_hub: [
    { name: "arrivals and departures board", response: "A hovering display lists incoming and outgoing ships in a dozen scripts. Half the entries are blinking yellow with ominous delay codes." },
    { name: "customs checkpoint", response: "A line of weary travellers shuffles toward a row of automated scan-arches. Drone bots circle overhead, sniffing for contraband." },
    { name: "currency exchange terminal", response: "A kiosk offers conversion between a dozen local currencies, its rates ticking down even as you read them." },
    { name: "emergency evacuation map", response: "A holographic schematic of the station section, the nearest pressure-doors highlighted in pulsing amber. You note the route despite yourself." },
    { name: "vendor alcove",     response: "A small cluster of automated stalls offers ration bars, novelty pins, and reconstituted noodles. The smell is somehow both inviting and concerning." },
  ],

  ship_bridge: [
    { name: "navigation console", response: "A semi-circular console of holographic charts and astrogation overlays. The current heading is locked in pulsing green." },
    { name: "captain's chair",   response: "A heavy command chair on its central pedestal, the cushioning shaped to the absent captain. The armrests are scuffed by countless restless hands." },
    { name: "tactical display",  response: "A volumetric display projects the surrounding starfield, friendly contacts marked in cool blue and unknowns in cautious yellow." },
    { name: "comm array",        response: "A bank of communication consoles tracks signal traffic across a dozen bands. Most of the chatter is routine; some of it is encrypted." },
    { name: "star charts",       response: "Layered holographic maps of nearby systems hover above a side console. Trade lanes glow, hazard zones flicker." },
  ],

  ship_cargo_bay: [
    { name: "shipping containers", response: "Stacks of standardised containers fill the bay, secured by magnetic clamps. Their stencilled identifiers are scuffed past easy reading." },
    { name: "cargo manifest",    response: "A clipboard-shaped data slate listing the bay's contents, with handwritten notes in the margins. Several entries have been crossed out." },
    { name: "magnetic clamps",   response: "Heavy clamps lock each container to the deck plates, humming with a low, reassuring vibration. They smell faintly of ozone." },
    { name: "zero-g warning markings", response: "Yellow-and-black hazard stripes ring sections of the deck, marked for variable gravity operations. The paint is freshly touched up." },
    { name: "emergency kit",     response: "A bright red wall locker contains survival essentials — patches, masks, a small first aid pack. The seal is intact." },
  ],

  cantina: [
    { name: "zero-gravity drink dispenser", response: "A bulbous machine dispenses globules of brightly coloured liquid into spill-resistant pouches. A line of patrons waits with practiced patience." },
    { name: "species-mixed seating", response: "Booths and benches are scaled and shaped for half a dozen different physiologies. A few are empty; most are emphatically not." },
    { name: "translation earpiece rack", response: "A wall rack of tiny earpieces, each one keyed to a different language pack. A bored attendant slides one toward you with the suggestion of a smile." },
    { name: "back booth",        response: "A high-backed booth in the corner is screened from the rest of the bar by a privacy field. Whoever is inside paid extra to stay unseen." },
    { name: "docking news feed", response: "A wall-mounted feed cycles through arrivals, departures, and the occasional incident report. The newscaster's smile never quite reaches their eyes." },
  ],

  med_bay: [
    { name: "diagnostic bed",    response: "A low padded bed surrounded by a halo of scanner arms, all currently folded back into standby. The sheet is clean and crisp." },
    { name: "medical supply locker", response: "A wall-set locker of labelled drawers and ampoules. A neat handprint scanner controls access to the controlled substances." },
    { name: "bioscanner arm",    response: "A jointed arm tipped with a softly glowing emitter, programmed to drift across a patient's body. It hums to itself when idle." },
    { name: "specimen storage",  response: "A bank of small chilled drawers, each one numbered and tagged. A few of the tags are unsettlingly recent." },
    { name: "emergency oxygen mask", response: "A clear mask hangs from a wall mount, its tubing coiled. A small green light reassures you that the supply is full." },
  ],

  // ──────────────────────────────────────────────────────────────────────────
  // POST-APOCALYPTIC
  // ──────────────────────────────────────────────────────────────────────────
  shelter_interior: [
    { name: "emergency ration shelf", response: "A wire shelf of dented cans and shrink-wrapped meal bricks. The expiry dates are mostly hopeful suggestions." },
    { name: "water purification filter", response: "A barrel-sized filter ticks quietly to itself, the output tube dripping into a half-full jug. The water is clear; the colour of the jug is not." },
    { name: "hand-drawn map",    response: "A map of the surrounding wasteland sketched onto the wall in charcoal and chalk. New annotations have been added over older ones in a different hand." },
    { name: "crude bunk",        response: "A low cot of scavenged frame and salvaged blankets. It bears the shape of someone who slept badly." },
    { name: "radio receiver",    response: "An old transistor radio wired into a car battery, its dial swung between two static-haunted frequencies. Occasionally it whispers fragments of a voice." },
  ],

  scrapyard: [
    { name: "rusted vehicle hulk", response: "The carcass of a car or transport, stripped to the chassis. Weeds curl up through the engine bay." },
    { name: "parts bin",         response: "A repurposed barrel heaped with sorted scrap — bolts, brackets, lengths of cable. Each piece bears the dings of previous lives." },
    { name: "cutting torch setup", response: "A torch on a battered trolley, hoses snaking back to a pair of scarred gas cylinders. The tip is blackened from use." },
    { name: "scavenged electronics", response: "A pile of half-stripped circuit boards, cathode tubes, and unidentifiable components. A few wires twitch in the breeze as if remembering current." },
    { name: "guard dog kennel",  response: "A makeshift kennel of corrugated steel and chicken wire. A water bowl sits half-full beside the gate; the dog itself is elsewhere for now." },
  ],

  wasteland_outpost: [
    { name: "sandbag fortification", response: "Stacked sandbags ring the outpost in a low wall, the fabric bleached and split in places. Sand trickles softly from the worst of the tears." },
    { name: "watchtower ladder", response: "A welded iron ladder climbs to a small rooftop platform. The rungs flex more than you'd like." },
    { name: "fuel drum",         response: "A red-and-rust drum stamped with hazard symbols. A cap on top has been replaced with a length of rag." },
    { name: "scavenged generator", response: "A patchwork generator chugs steadily under a corrugated lean-to. The fuel hose is a knot of mismatched fittings." },
    { name: "patrol schedule",   response: "A piece of cardboard tacked to the wall lists patrol shifts in marker — names, times, occasional question marks. Some entries have been recently scratched out." },
  ],

  trading_post: [
    { name: "barter counter",    response: "A long counter built from salvaged sheet metal and door panels, its surface gouged by countless bargains. A small gong sits at one end." },
    { name: "displayed wares",   response: "Goods laid out under cracked glass — pre-war canned food, ammo of dubious provenance, a few resoled boots. Prices are scrawled in marker on torn paper." },
    { name: "suspicious scale",  response: "A weighing scale of questionable calibration sits on the counter. The merchant's hand drifts toward it whenever a deal gets serious." },
    { name: "back room curtain", response: "A heavy hanging curtain of stitched leather and tarpaulin separates the back room. Movement occasionally stirs it from the other side." },
    { name: "guard position",    response: "A high stool by the door supports a watchful figure with a battered rifle laid across their knees. They acknowledge you with the smallest of nods." },
  ],
};

/** All known ambient_type keys for reference (e.g. validation, debug UIs). */
export const AMBIENT_TYPES: string[] = Object.keys(AMBIENT_OBJECTS);

/**
 * Tier 2 router — case-insensitive substring match.
 *
 * Looks up the ambient library for `ambient_type`, then scans each entry's
 * name against the player's input. Returns the matching `response` if found,
 * else null (signals the caller to fall through to Tier 3).
 *
 *   findAmbientResponse("smithy", "examine the anvil") → "Heavy iron…"
 *   findAmbientResponse("smithy", "kick the gnome")    → null
 *
 * `null` semantics:
 *   - unknown ambient_type
 *   - empty/whitespace input
 *   - no template name matched
 *
 * Matching is intentionally lenient (substring, case-insensitive) so the
 * player can phrase their action loosely — "look at the bar counter" still
 * matches the "bar counter" entry.
 */
export function findAmbientResponse(
  ambient_type: string,
  player_input:  string
): string | null {
  if (!ambient_type) return null;
  if (!player_input) return null;

  const objects = AMBIENT_OBJECTS[ambient_type];
  if (!objects || objects.length === 0) return null;

  const haystack = player_input.toLowerCase();

  // Prefer the longest matching name when multiple entries collide
  // (e.g. "bar counter" beats "bar" if both happened to be present).
  let bestMatch: AmbientObject | null = null;
  for (const obj of objects) {
    const needle = obj.name.toLowerCase();
    if (haystack.includes(needle)) {
      if (!bestMatch || needle.length > bestMatch.name.length) {
        bestMatch = obj;
      }
    }
  }

  return bestMatch ? bestMatch.response : null;
}
