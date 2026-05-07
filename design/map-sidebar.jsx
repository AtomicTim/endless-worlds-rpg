/* global React */
// Map sidebar shell — tier icon buttons, map area, location info panel
// Designed for 320px desktop sidebar / mobile bottom sheet

const MapSidebar = ({ genre = "fantasy", tier: tierProp = "local", height = 720, npcMode = true, asSheet = false }) => {
  const [tier, setTier] = React.useState(tierProp);
  React.useEffect(() => setTier(tierProp), [tierProp]);

  const TierBtn = ({ id, icon, label }) => {
    const active = tier === id;
    return (
      <button onClick={() => setTier(id)} title={label} style={{
        flex: 1, padding: "8px 0",
        background: active ? "var(--accent-faint)" : "transparent",
        border: active ? "1px solid var(--accent)" : "1px solid var(--line-2)",
        borderRadius: 2, color: active ? "var(--accent)" : "var(--ink-3)",
        cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        fontFamily: "var(--mono)", fontSize: 8, letterSpacing: "0.18em", transition: "all 120ms"
      }}>{icon}<span>{label}</span></button>
    );
  };

  const MapView = tier === "world" ? window.WorldMapV2 : tier === "region" ? window.RegionMapV2 : window.LocalMapV2;

  const info = tier === "local" ? {
    title: "The Marked Rest", type: "INN · TAVERN",
    atmosphere: "Heavy timber beams bear carved promises from past patrons. Hearthlight pools amber on the floor.",
    npcs: [{ name: "Drenn Val", role: "innkeeper", mood: "neutral" }, { name: "Mireth Cole", role: "scavenger", mood: "anxious" }],
    objects: [{ name: "The Promise Hearth", verb: "examine" }, { name: "Reputation Ledger", verb: "read" }, { name: "Carved beam", verb: "trace" }]
  } : tier === "region" ? {
    title: "Oathstone Crossing", type: "HUB · 4 EXITS",
    atmosphere: "The crossroads hum with traffic. Travelers pause at the carved stone, murmuring promises.",
    npcs: [{ name: "Drenn Val", role: "innkeeper", mood: "neutral" }],
    objects: [{ name: "The Oathstone", verb: "touch" }, { name: "Posted notices", verb: "read" }]
  } : {
    title: "The Iron Mark Reaches", type: "REGION · 4 KNOWN · 1 RUMORED",
    atmosphere: "A patchwork of cleared land between the Shardspine peaks and Bellhaven's titan-shadow.",
    npcs: [], objects: [{ name: "Roadside cairns", verb: "examine" }]
  };

  return (
    <div data-genre={genre} style={{ width: 320, height, background: "var(--bg-1)", borderRight: asSheet ? "none" : "1px solid var(--line)", borderRadius: asSheet ? "12px 12px 0 0" : 0, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", fontFamily: "var(--sans)", color: "var(--ink-2)" }}>
      <div className="ew-grain" style={{ "--grain": 0.18 }} />
      {asSheet && <div style={{ width: 40, height: 4, background: "var(--line-2)", borderRadius: 2, margin: "10px auto 4px" }} />}
      <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--line)", position: "relative", zIndex: 1 }}>
        <div className="ew-mono" style={{ fontSize: 9, letterSpacing: "0.32em", color: "var(--accent)", fontWeight: 600, marginBottom: 8 }}>◆ MAP</div>
        <div style={{ display: "flex", gap: 6 }}>
          <TierBtn id="world" label="WORLD" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.1" /><path d="M 1.5 7 L 12.5 7 M 7 1.5 Q 4 7 7 12.5 M 7 1.5 Q 10 7 7 12.5" stroke="currentColor" strokeWidth="0.7" /></svg>} />
          <TierBtn id="region" label="REGION" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M 1 4 L 5 2 L 9 4 L 13 2 L 13 10 L 9 12 L 5 10 L 1 12 Z" stroke="currentColor" strokeWidth="1.1" /><path d="M 5 2 L 5 10 M 9 4 L 9 12" stroke="currentColor" strokeWidth="0.7" /></svg>} />
          <TierBtn id="local" label="LOCAL" icon={<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M 7 13 Q 2 8 2 5 A 5 5 0 1 1 12 5 Q 12 8 7 13 Z" stroke="currentColor" strokeWidth="1.1" /><circle cx="7" cy="5.5" r="1.5" fill="currentColor" /></svg>} />
        </div>
      </div>
      <div style={{ position: "relative", aspectRatio: "1", flexShrink: 0 }}>
        <MapView npcMode={npcMode} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 16px", borderTop: "1px solid var(--line)", background: "var(--bg-0)" }} className="ew-scroll">
        <div className="ew-mono" style={{ fontSize: 8, letterSpacing: "0.3em", color: "var(--accent)", marginBottom: 4, fontWeight: 600 }}>{info.type}</div>
        <div className="ew-serif" style={{ fontStyle: "italic", fontSize: 17, color: "var(--ink-1)", marginBottom: 8, lineHeight: 1.2 }}>{info.title}</div>
        <div className="ew-serif" style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.65, marginBottom: 14, fontStyle: "italic" }}>{info.atmosphere}</div>
        {info.npcs.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="ew-mono" style={{ fontSize: 8, letterSpacing: "0.3em", color: "var(--ink-4)", marginBottom: 6 }}>◆ PRESENT — {info.npcs.length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {info.npcs.map(npc => (
                <div key={npc.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "var(--bg-2)", border: "1px solid var(--line)", borderLeft: "2px solid var(--accent)" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: npc.mood === "anxious" ? "#facc15" : "var(--accent)", flexShrink: 0 }} />
                  <span className="ew-mono" style={{ fontSize: 10, color: "var(--ink-1)", letterSpacing: "0.06em", flex: 1 }}>{npc.name}</span>
                  <span className="ew-mono" style={{ fontSize: 8, color: "var(--ink-4)", letterSpacing: "0.16em", textTransform: "uppercase" }}>{npc.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {info.objects.length > 0 && (
          <div>
            <div className="ew-mono" style={{ fontSize: 8, letterSpacing: "0.3em", color: "var(--ink-4)", marginBottom: 6 }}>◆ INTERACT</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {info.objects.map(o => (
                <div key={o.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", border: "1px dashed var(--line-2)", cursor: "pointer" }}>
                  <span className="ew-mono" style={{ fontSize: 9, color: "var(--accent)", letterSpacing: "0.18em", textTransform: "uppercase", width: 56 }}>{o.verb} ›</span>
                  <span className="ew-serif" style={{ fontSize: 12, color: "var(--ink-2)", fontStyle: "italic", flex: 1 }}>{o.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

window.MapSidebar = MapSidebar;
