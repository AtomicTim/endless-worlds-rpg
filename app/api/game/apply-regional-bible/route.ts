import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AssetCategory } from "@/types/game";
import type {
  LocationDefinition,
  NPCDefinition,
  RegionBible,
  WorldAsset,
  WorldGraph,
  WorldNode,
} from "@/types/game";

/**
 * Day 19D — Apply a freshly-generated RegionBible to a session.
 *
 * Mirrors apply-world-bible but extends the existing WorldGraph rather
 * than building one from scratch:
 *   • Writes every new location, NPC, and interactable Tier 1 object
 *     as a permanent world_asset (write-once via ignoreDuplicates).
 *   • Adds new WorldNodes for each location in the bible.
 *   • Wires the new region's settlement node bidirectionally to the
 *     origin node the player crossed from.
 *   • Replaces the placeholder outline-zone node from the WorldBible
 *     pass (graphNodes[bible.id]) with the fully-fleshed settlement node.
 *
 * Returns the updated graph and the settlement node id so the caller
 * can navigate the player into the new region.
 */

interface RequestBody {
  session_id?:           string;
  bible?:                RegionBible;
  origin_node_id?:       string;
  existing_world_graph?: WorldGraph;
}

// ── Helpers: convert bible entries into WorldAsset rows ────────────────────────

function locationToAsset(loc: LocationDefinition, sessionId: string): WorldAsset {
  return {
    id:                  `location_${loc.id}`,
    category:            AssetCategory.LOCATION,
    name:                loc.name,
    constitution: {
      physical_description: loc.atmosphere,
      key_landmarks:        loc.objects.map((o) => o.name),
      ambient_type:         loc.ambient_type ?? "",
      available_services:   [],
    },
    significance:        loc.is_settlement_node ? "MAJOR" : "NOTABLE",
    first_seen_location: loc.id,
    session_id:          sessionId,
    name_known:          true,
    created_at:          new Date().toISOString(),
  };
}

function npcToAsset(npc: NPCDefinition, sessionId: string): WorldAsset {
  return {
    id:                  npc.id,
    category:            AssetCategory.CHARACTER,
    name:                npc.name,
    constitution: {
      appearance:      npc.appearance,
      personality:     npc.personality,
      role:            npc.role,
      speech_patterns: npc.speech_style,
      ...(npc.faction_id ? { faction: npc.faction_id } : {}),
      notes:           npc.knowledge.join(". "),
    },
    significance:        npc.quest_relevance === "key" ? "MAJOR" : "NOTABLE",
    first_seen_location: npc.home_location_id,
    session_id:          sessionId,
    name_known:          true,
    created_at:          new Date().toISOString(),
  };
}

function objectToAsset(
  obj: LocationDefinition["objects"][number],
  parentLocationId: string,
  sessionId: string
): WorldAsset {
  return {
    id:                  `item_${obj.id}`,
    category:            AssetCategory.ITEM,
    name:                obj.name,
    constitution: {
      item_description: obj.description,
      ...(obj.contains_lore ? { lore_content: obj.contains_lore } : {}),
    },
    significance:        "NOTABLE",
    first_seen_location: parentLocationId,
    session_id:          sessionId,
    name_known:          true,
    created_at:          new Date().toISOString(),
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { session_id, bible, origin_node_id, existing_world_graph } = body;
  if (!session_id || !bible || !origin_node_id || !existing_world_graph) {
    return NextResponse.json(
      { error: "Missing required fields: session_id, bible, origin_node_id, existing_world_graph" },
      { status: 400 }
    );
  }

  // Alias the narrowed body objects so closures defined below see the
  // non-undefined types — TS doesn't propagate narrowing into deferred
  // closures the way it does for inline expressions.
  const sessionId          = session_id;
  const bibleNarrowed:     RegionBible = bible;
  const originNodeId       = origin_node_id;
  const existingGraph:     WorldGraph  = existing_world_graph;

  // Verify ownership of the session.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row, error: fetchErr } = await (supabase.from("game_sessions") as any)
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single() as { data: { id: string } | null; error: unknown };

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // ── 1. Build all world_asset rows ──────────────────────────────────────────
  const locationAssets = bibleNarrowed.locations.map((l) => locationToAsset(l, sessionId));
  const npcAssets      = bibleNarrowed.npcs.map((n) => npcToAsset(n, sessionId));
  const objectAssets:    WorldAsset[] = [];
  for (const loc of bibleNarrowed.locations) {
    for (const obj of loc.objects) {
      if (obj.is_interactable) {
        objectAssets.push(objectToAsset(obj, loc.id, sessionId));
      }
    }
  }
  const allAssets = [...locationAssets, ...npcAssets, ...objectAssets];

  // ── 2. Upsert every asset (write-once via ignoreDuplicates) ────────────────
  for (const asset of allAssets) {
    const insertRow: Record<string, unknown> = {
      session_id:          sessionId,
      asset_id:            asset.id,
      category:            asset.category,
      name:                asset.name,
      constitution:        asset.constitution,
      significance:        asset.significance,
      first_seen_location: asset.first_seen_location,
      name_known:          asset.name_known,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("world_assets") as any).upsert(
      insertRow,
      { onConflict: "session_id,asset_id", ignoreDuplicates: true }
    );
    if (error) {
      console.error("[apply-regional-bible] world_asset write failed for", asset.id, error);
    }
  }

  // ── 3. Resolve the settlement node ─────────────────────────────────────────
  const settlementNode = bibleNarrowed.locations.find((l) => l.is_settlement_node);
  if (!settlementNode) {
    return NextResponse.json(
      { error: "RegionBible has no settlement_node in locations" },
      { status: 400 }
    );
  }
  const startingNodeId = settlementNode.id;

  // ── 4. Build the new region's WorldNodes ───────────────────────────────────
  const newNodes: Record<string, WorldNode> = {};
  for (const loc of bibleNarrowed.locations) {
    newNodes[loc.id] = {
      id:            loc.id,
      name:          loc.name,
      type:          loc.is_interior ? "sub_location" : "zone",
      category:      loc.type,
      zone_id:       loc.is_interior && loc.parent_location_id ? loc.parent_location_id : loc.id,
      is_expandable: !loc.is_interior,
      connections:   [...loc.connections],
      npc_ids:       loc.npc_ids.slice(),
      item_ids:      loc.objects.map((o) => `item_${o.id}`),
      asset_id:      `location_${loc.id}`,
      // The settlement node is what the player just crossed into — mark it
      // discovered so the world map renders it without delay.
      discovered:    loc.is_settlement_node,
      map_position:  loc.grid_position,
    };
  }

  // ── 5. Merge the new nodes into the existing graph ─────────────────────────
  // Remove the placeholder outline node (added by apply-world-bible at
  // bibleNarrowed.id with discovered=false). The fully-fleshed settlement
  // node replaces it. Keep every other existing node untouched.
  const mergedNodes: Record<string, WorldNode> = { ...existingGraph.nodes };
  if (mergedNodes[bibleNarrowed.id] && !newNodes[bibleNarrowed.id]) {
    // Outline used the region id as its node id but the bible uses a
    // different settlement node id — drop the placeholder before adding.
    delete mergedNodes[bibleNarrowed.id];
  }
  for (const [id, node] of Object.entries(newNodes)) {
    mergedNodes[id] = node;
  }

  // ── 6. Wire the bidirectional link from the origin node ────────────────────
  const originNode = mergedNodes[originNodeId];
  if (originNode) {
    const filteredConnections = originNode.connections.filter(
      (c) => c !== bibleNarrowed.id // strip the stale outline link
    );
    if (!filteredConnections.includes(startingNodeId)) {
      filteredConnections.push(startingNodeId);
    }
    mergedNodes[originNodeId] = {
      ...originNode,
      connections: filteredConnections,
    };
  }
  const settlementMerged = mergedNodes[startingNodeId];
  if (settlementMerged && !settlementMerged.connections.includes(originNodeId)) {
    mergedNodes[startingNodeId] = {
      ...settlementMerged,
      connections: [...settlementMerged.connections, originNodeId],
    };
  }

  const updatedWorldGraph: WorldGraph = {
    ...existingGraph,
    nodes:           mergedNodes,
    current_node_id: startingNodeId,
  };

  console.log(
    `[apply-regional-bible] Applied: ${bibleNarrowed.name}, ` +
    `${bibleNarrowed.locations.length} locations, ` +
    `${bibleNarrowed.npcs.length} NPCs, ` +
    `${objectAssets.length} interactable objects.`
  );

  return NextResponse.json({
    success:             true,
    starting_node_id:    startingNodeId,
    updated_world_graph: updatedWorldGraph,
    location_count:      bibleNarrowed.locations.length,
    npc_count:           bibleNarrowed.npcs.length,
  });
}
