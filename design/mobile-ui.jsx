/* global React */
// Mobile game UI — 390×844

const MobileGameUI = ({ genre = "fantasy" }) => {
  const [sheetOpen, setSheetOpen] = React.useState(false);

  return (
    <div data-genre={genre} style={{ width: 390, height: 844, background: "var(--bg-0)", color: "var(--ink-2)", fontFamily: "var(--sans)", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", borderRadius: 28, border: "1px solid var(--line)" }}>
      <div className="ew-grain" style={{ "--grain": 0.2 }} />

      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", fontSize: 12, fontFamily: "var(--mono)", color: "var(--ink-2)" }}>
        <span>9:41</span>
        <span style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ width: 14, height: 8, border: "1px solid currentColor", borderRadius: 1, position: "relative" }}><span style={{ position: "absolute", inset: 1, background: "currentColor" }} /></span></span>
      </div>

      {/* HEADER */}
      <header style={{ display: "flex", alignItems: "center", padding: "8px 16px 12px", borderBottom: "1px solid var(--line)" }}>
        <div className="ew-mono" style={{ fontSize: 11, letterSpacing: "0.28em", color: "var(--accent)", fontWeight: 600, flex: 1 }}>ENDLESS WORLDS</div>
        <button onClick={() => setSheetOpen(s => !s)} style={mobileIconBtn}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M 1 3 L 5 5 L 9 3 L 13 5 L 13 11 L 9 9 L 5 11 L 1 9 Z" stroke="currentColor" strokeWidth="1.1" fill="none" /></svg>
        </button>
        <button style={mobileIconBtn}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M 2 2 L 7 1 L 12 2 L 12 12 L 7 11 L 2 12 Z M 7 1 L 7 11" stroke="currentColor" strokeWidth="1.1" fill="none" /></svg>
        </button>
        <div style={{ width: 28, height: 28, marginLeft: 6, background: "var(--accent-faint)", border: "1px solid var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.1em" }}>TM</div>
      </header>

      {/* Verbosity */}
      <div style={{ display: "flex", padding: "8px 16px", gap: 6, borderBottom: "1px solid var(--line)" }}>
        {["TERSE", "STANDARD", "RICH"].map((v, i) => (
          <div key={v} style={{ flex: 1, textAlign: "center", padding: "6px 0", border: i === 1 ? "1px solid var(--accent)" : "1px solid var(--line-2)", background: i === 1 ? "var(--accent-faint)" : "transparent", color: i === 1 ? "var(--accent)" : "var(--ink-4)", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.2em", borderRadius: 2 }}>{v}</div>
        ))}
      </div>

      {/* Story feed */}
      <main style={{ flex: 1, padding: "20px 18px 0", overflowY: "auto" }} className="ew-scroll">
        <div style={{ border: "1px solid var(--accent-soft)", padding: "12px 16px", marginBottom: 18, textAlign: "center" }}>
          <div className="ew-mono" style={{ fontSize: 8, letterSpacing: "0.32em", color: "var(--accent)" }}>— CURRENT —</div>
          <div className="ew-serif" style={{ fontSize: 20, fontStyle: "italic", color: "var(--ink-1)", margin: "4px 0" }}>The Marked Rest</div>
          <div className="ew-mono" style={{ fontSize: 8, letterSpacing: "0.3em", color: "var(--ink-4)" }}>TAVERN · OATHSTONE CROSSING</div>
        </div>
        <p className="ew-serif" style={{ fontSize: 14, lineHeight: 1.8, color: "var(--ink-3)", margin: "0 0 14px" }}>
          <span className="ew-link-npc">Drenn Val</span> nods once. <em>"<span className="ew-link-npc">Mireth</span> keeps to herself in the corner booth,"</em> she says. <em>"Lost her brother to <span className="ew-link-landmark">the Wound</span> six months past."</em>
        </p>
        <window.NPCSpeech name="Mireth Cole">
          "New face. Don't see many new faces anymore. Looking for work? Most folks want something."
        </window.NPCSpeech>
        <window.SceneDivider label="Persuasion" />
        <p className="ew-serif" style={{ fontSize: 14, lineHeight: 1.8, color: "var(--ink-3)", margin: "0 0 14px" }}>
          You set your hands on the table.{" "}<window.StatPill stat="CHA" value={4} dc={3} total={5} pass />{" "}His shoulders drop a half-inch.
        </p>
      </main>

      {/* Nav cards */}
      <div style={{ padding: "10px 16px", borderTop: "1px solid var(--line)", background: "var(--bg-1)", display: "flex", gap: 8, overflowX: "auto" }} className="ew-scroll">
        <window.NavCard icon={window.NavIcons.inn} name="OATHSTONE" type="HUB" current />
        <window.NavCard icon={window.NavIcons.trail} name="SHARDSPINE" type="WILDS" visited />
        <window.NavCard icon={window.NavIcons.city} name="BELLHAVEN" type="CITY" visited />
        <window.NavCard icon={window.NavIcons.ruin} name="KETHYR" type="RUIN" />
        <window.NavCard icon={window.NavIcons.fog} name="???" type="RUMORED" undiscovered />
      </div>

      {/* Input */}
      <div style={{ display: "flex", alignItems: "stretch", margin: "0 16px 14px", border: "1px solid var(--line-2)", borderRadius: 2, background: "var(--bg-0)" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "0 12px", color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 14 }}>›</div>
        <input placeholder="Talk, examine, act…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "12px 4px", fontFamily: "var(--serif)", fontSize: 14, color: "var(--ink-1)", fontStyle: "italic" }} />
        <button style={{ padding: "0 20px", border: "none", borderLeft: "1px solid var(--line-2)", background: "var(--accent-faint)", color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.3em", fontWeight: 600 }}>ACT</button>
      </div>

      {/* Map bottom sheet */}
      {sheetOpen && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 10 }} onClick={() => setSheetOpen(false)}>
          <div style={{ width: "100%", height: "65%" }} onClick={e => e.stopPropagation()}>
            <window.MapSidebar genre={genre} tier="local" height="100%" asSheet />
          </div>
        </div>
      )}

      {/* Map toggle pill — bottom-left floating */}
      {!sheetOpen && (
        <button onClick={() => setSheetOpen(true)} style={{ position: "absolute", left: 16, bottom: 72, padding: "6px 12px", border: "1px solid var(--accent-soft)", background: "var(--bg-1)", color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.24em", borderRadius: 2, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>◆ MAP</button>
      )}
    </div>
  );
};

const mobileIconBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, marginLeft: 4, border: "1px solid var(--line-2)", borderRadius: 2, background: "transparent", color: "var(--ink-2)", cursor: "pointer" };

window.MobileGameUI = MobileGameUI;
