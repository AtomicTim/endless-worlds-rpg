/* global React */
// Desktop game UI — 1280×860 demo frame

const DesktopGameUI = ({ genre = "fantasy" }) => {
  const genreLabel = { fantasy: "FANTASY", cyber: "CYBERPUNK", horror: "HORROR", space: "SPACE OPERA", apoc: "POST-APOC" }[genre];

  return (
    <div data-genre={genre} style={{ width: 1280, height: 860, background: "var(--bg-0)", color: "var(--ink-2)", fontFamily: "var(--sans)", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", borderRadius: 6, border: "1px solid var(--line)" }}>
      <div className="ew-grain" style={{ "--grain": 0.25 }} />

      {/* HEADER */}
      <header style={{ height: 56, display: "flex", alignItems: "center", padding: "0 22px", borderBottom: "1px solid var(--line)", background: "linear-gradient(180deg, var(--bg-1), var(--bg-0))", position: "relative", zIndex: 2 }}>
        <div className="ew-mono" style={{ fontSize: 13, letterSpacing: "0.32em", color: "var(--accent)", fontWeight: 600, display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="1.2" />
            <path d="M 9 2 L 9 16 M 2 9 L 16 9" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
            <path d="M 9 2 Q 13 9 9 16 Q 5 9 9 2" fill="none" stroke="currentColor" strokeWidth="0.8" />
          </svg>
          ENDLESS WORLDS
        </div>
        <div style={{ marginLeft: 28, padding: "3px 10px", border: "1px solid var(--accent-soft)", borderRadius: 2, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.24em", color: "var(--accent)" }}>{genreLabel}</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", border: "1px solid var(--line-2)", borderRadius: 2, fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", marginRight: 18 }}>
          {["TERSE", "STANDARD", "RICH"].map((v, i) => (
            <div key={v} style={{ padding: "5px 12px", color: i === 1 ? "var(--accent)" : "var(--ink-4)", borderRight: i < 2 ? "1px solid var(--line-2)" : "none", background: i === 1 ? "var(--accent-faint)" : "transparent" }}>{v}</div>
          ))}
        </div>
        <button style={iconBtn}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M 1 3 L 5 5 L 9 3 L 13 5 L 13 11 L 9 9 L 5 11 L 1 9 Z" stroke="currentColor" strokeWidth="1.1" fill="none" /></svg>
          MAP
        </button>
        <button style={iconBtn}>
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M 2 2 L 7 1 L 12 2 L 12 12 L 7 11 L 2 12 Z M 7 1 L 7 11" stroke="currentColor" strokeWidth="1.1" fill="none" /></svg>
          CODEX
        </button>
        <div style={{ marginLeft: 14, display: "flex", alignItems: "center", gap: 10, padding: "4px 12px 4px 4px", border: "1px solid var(--line-2)", borderRadius: 2 }}>
          <div style={{ width: 28, height: 28, background: "var(--accent-faint)", border: "1px solid var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", letterSpacing: "0.1em" }}>TM</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <div className="ew-mono" style={{ fontSize: 11, color: "var(--ink-1)", letterSpacing: "0.1em" }}>Timoteus</div>
            <div className="ew-mono" style={{ fontSize: 8, color: "var(--ink-4)", letterSpacing: "0.2em" }}>LVL 1 · 100 HP</div>
          </div>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <window.MapSidebar genre={genre} tier="local" height="100%" />

        {/* STORY FEED */}
        <main style={{ flex: 1, padding: "32px 60px 0", overflowY: "auto", position: "relative", display: "flex", flexDirection: "column" }} className="ew-scroll">
          <div style={{ border: "1px solid var(--accent-soft)", background: "linear-gradient(180deg, var(--accent-faint), transparent)", padding: "20px 28px", marginBottom: 24, position: "relative", maxWidth: 640, alignSelf: "center" }}>
            <div style={{ position: "absolute", inset: 0, padding: 4, pointerEvents: "none", border: "1px solid var(--accent-soft)", margin: 4 }} />
            <div className="ew-mono" style={{ fontSize: 9, letterSpacing: "0.32em", color: "var(--accent)", marginBottom: 6, textAlign: "center" }}>— CURRENT LOCATION —</div>
            <div className="ew-serif" style={{ fontSize: 28, fontStyle: "italic", color: "var(--ink-1)", textAlign: "center" }}>The Marked Rest</div>
            <div className="ew-mono" style={{ fontSize: 9, letterSpacing: "0.4em", color: "var(--ink-4)", marginTop: 8, textAlign: "center" }}>TAVERN · OATHSTONE CROSSING · IRON MARK REACHES</div>
          </div>

          <div style={{ alignSelf: "center", width: "100%", maxWidth: 640 }}>
            <window.NarrativeBlock>
              <window.Npc>Drenn Val</window.Npc> nods once, a gesture of acknowledgment rather than approval.
              {" "}<em>"<window.Npc>Mireth</window.Npc> keeps to herself in the corner booth,"</em> she says,
              tilting her head toward the far end of the common room. <em>"Lost her brother to <window.Lndmk>the Wound</window.Lndmk> six months past. She doesn't take kindly to strangers, but she's here most nights."</em> The innkeeper's hands pause briefly on the glass. {" "}<em>"Tread carefully with that one."</em>
            </window.NarrativeBlock>

            <window.NPCSpeech name="Mireth Cole">
              Mireth Cole looks up sharply as you approach, one hand gripping his mug. "New face," he says, the words tumbling out too fast. "Don't see many new faces anymore." His gaze darts to the door, then back. "Looking for work? Information? Most folks want something."
            </window.NPCSpeech>

            <window.SceneDivider label="Persuasion · Approach" />

            <window.NarrativeBlock>
              You set your hands on the table, palms open. Mireth's eyes track them.
              {" "}<window.StatPill stat="CHA" value={4} dc={3} total={5} pass descriptor="he relaxes" />
              {" "}His shoulders drop a half-inch. Not trust — but not hostility, either.
            </window.NarrativeBlock>

            <window.NarrativeBlock>
              "Sit," he says, gesturing at the empty bench. "Tell me what you're after. Maybe I've heard of it. Maybe I haven't." He glances toward <window.Loc>Verity's Ledger</window.Loc>, visible through the window, lamps still lit.
            </window.NarrativeBlock>

            <window.SceneDivider label="Investigation · The Tattoo" />

            <window.NarrativeBlock>
              You glance at the chain-link ink on his wrist — faded, but deliberate.
              {" "}<window.StatPill stat="INT" value={4} dc={6} total={5} pass={false} descriptor="meaning escapes you" />
              {" "}The pattern means something, certainly, but the specific knot-work is beyond you. Could be a guild mark. Could be a curse. <window.Item>The Verity Ledger</window.Item> would know.
            </window.NarrativeBlock>
          </div>
          <div style={{ flex: 1, minHeight: 30 }} />
        </main>

        {/* CHARACTER PANEL */}
        <aside style={{ width: 280, borderLeft: "1px solid var(--line)", background: "var(--bg-1)", padding: "16px 18px", overflowY: "auto" }} className="ew-scroll">
          <div className="ew-mono" style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--ink-4)", marginBottom: 10 }}>◆ CHARACTER</div>
          <div className="ew-serif" style={{ fontStyle: "italic", fontSize: 22, color: "var(--ink-1)", marginBottom: 2 }}>Timoteus</div>
          <div className="ew-mono" style={{ fontSize: 9, color: "var(--accent)", letterSpacing: "0.24em", marginBottom: 14 }}>LVL 1 · WANDERER</div>

          <div style={{ marginBottom: 14 }}>
            <div className="ew-mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--ink-4)", letterSpacing: "0.2em", marginBottom: 4 }}><span>HP</span><span style={{ color: "var(--ink-2)" }}>100 / 100</span></div>
            <div style={{ height: 4, background: "var(--bg-3)", border: "1px solid var(--line)", position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, var(--hl-pass), color-mix(in oklab, var(--hl-pass) 70%, var(--accent)))" }} />
            </div>
          </div>
          <div style={{ marginBottom: 18 }}>
            <div className="ew-mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--ink-4)", letterSpacing: "0.2em", marginBottom: 4 }}><span>XP</span><span style={{ color: "var(--ink-2)" }}>120 / 500</span></div>
            <div style={{ height: 3, background: "var(--bg-3)", border: "1px solid var(--line)", position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, width: "24%", background: "var(--accent)" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px", marginBottom: 18 }}>
            {[["STR", 6], ["AGI", 4], ["CHA", 4], ["INT", 4], ["PER", 4]].map(([s, v]) => (
              <div key={s}>
                <div className="ew-mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--ink-4)", letterSpacing: "0.2em" }}><span>{s}</span><span style={{ color: "var(--ink-2)" }}>{v}</span></div>
                <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
                  {Array.from({ length: 6 }).map((_, i) => (<div key={i} style={{ flex: 1, height: 6, background: i < v ? "var(--accent)" : "var(--bg-3)", border: "1px solid var(--line)" }} />))}
                </div>
              </div>
            ))}
          </div>

          <div className="ew-mono" style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--ink-4)", marginBottom: 8 }}>◆ EQUIPPED</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
            {["WPN", "ARM", "ACC"].map(s => (<div key={s} style={{ aspectRatio: "1", border: "1px dashed var(--line-2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-5)", letterSpacing: "0.2em" }}>{s}</div>))}
          </div>

          <div className="ew-mono" style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--ink-4)", marginBottom: 8 }}>◆ LOG BOOK</div>
          {[["just now", "Spoke with Mireth Cole. He seemed anxious and watchful."], ["1m ago", "Returned to titan's ribs beneath Chain-Keeper watch."]].map(([t, s], i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div className="ew-mono" style={{ fontSize: 9, color: "var(--accent)", letterSpacing: "0.18em", marginBottom: 3 }}>{t}</div>
              <div className="ew-serif" style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5, fontStyle: "italic" }}>{s}</div>
            </div>
          ))}

          <div style={{ marginTop: 14, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 2, display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 11 }}>
            <span style={{ color: "var(--ink-4)", letterSpacing: "0.2em" }}>GOLD</span>
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>10</span>
          </div>
        </aside>
      </div>

      {/* NAV + INPUT */}
      <div style={{ borderTop: "1px solid var(--line)", background: "var(--bg-1)", padding: "12px 60px 16px", position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, overflowX: "auto" }} className="ew-scroll">
          <window.NavCard icon={window.NavIcons.inn} name="OATHSTONE CRSG." type="HUB · INN" current />
          <window.NavCard icon={window.NavIcons.trail} name="THE SHARD FOOTHILLS" type="WILDERNESS" visited />
          <window.NavCard icon={window.NavIcons.city} name="BELLHAVEN APPROACH" type="CITY · KNOWN" visited />
          <window.NavCard icon={window.NavIcons.ruin} name="KETHYR SCAVENGE" type="RUIN · DANGER 2" />
          <window.NavCard icon={window.NavIcons.fog} name="UNCHARTED" type="RUMORED" undiscovered />
        </div>
        <div style={{ display: "flex", alignItems: "stretch", gap: 0, border: "1px solid var(--line-2)", borderRadius: 2, background: "var(--bg-0)" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "0 14px", color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 14 }}>›</div>
          <input placeholder="Talk, examine, or take action…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "14px 4px", fontFamily: "var(--serif)", fontSize: 15, color: "var(--ink-1)", fontStyle: "italic" }} />
          <button style={{ padding: "0 28px", border: "none", borderLeft: "1px solid var(--line-2)", background: "var(--accent-faint)", color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.32em", fontWeight: 600, cursor: "pointer" }}>ACT ›</button>
        </div>
      </div>
    </div>
  );
};

const iconBtn = { display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", marginLeft: 6, border: "1px solid var(--line-2)", borderRadius: 2, background: "transparent", color: "var(--ink-2)", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.24em", cursor: "pointer" };

window.DesktopGameUI = DesktopGameUI;
