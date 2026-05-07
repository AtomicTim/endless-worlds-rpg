/* global React */
// Dialogue modal + showcase rows for nav cards / stat pills

const DialogueModal = ({ genre = "fantasy" }) => (
  <div data-genre={genre} style={{
    width: 720, height: 480,
    background: "var(--bg-0)", color: "var(--ink-2)", fontFamily: "var(--sans)",
    border: "1px solid var(--line)", borderRadius: 6, position: "relative", overflow: "hidden",
    display: "flex", flexDirection: "column"
  }}>
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.4))" }} />
    <div style={{ flex: 1, margin: 28, border: "1px solid var(--accent-soft)", background: "var(--bg-1)", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
      <div style={{ position: "absolute", inset: 4, border: "1px solid var(--accent-soft)", pointerEvents: "none" }} />
      <div style={{ display: "flex", alignItems: "center", padding: "20px 24px", gap: 14, borderBottom: "1px solid var(--line)" }}>
        <div style={{ width: 56, height: 56, background: "var(--bg-2)", border: "1px solid var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 18, color: "var(--accent)", letterSpacing: "0.1em" }}>MC</div>
        <div style={{ flex: 1 }}>
          <div className="ew-mono" style={{ fontSize: 9, letterSpacing: "0.32em", color: "var(--accent)", marginBottom: 2 }}>◆ IN CONVERSATION</div>
          <div className="ew-serif" style={{ fontStyle: "italic", fontSize: 22, color: "var(--ink-1)" }}>Mireth Cole</div>
          <div style={{ display: "flex", gap: 10, marginTop: 4, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.2em", color: "var(--ink-4)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 5, height: 5, background: "#facc15", borderRadius: 3 }} /> NEUTRAL</span>
            <span>· SCAVENGER</span><span>· THE MARKED REST</span>
          </div>
        </div>
        <button style={{ width: 28, height: 28, border: "1px solid var(--line-2)", background: "transparent", color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 14, cursor: "pointer" }}>x</button>
      </div>
      <div style={{ padding: "16px 24px" }}>
        <div className="ew-serif" style={{ fontSize: 16, lineHeight: 1.7, color: "var(--ink-1)", fontStyle: "italic" }}>
          <span className="ew-said">"Dangerous times for travelers, friend. I'd ask what brings you to Bellhaven, but half the time the answer's the same — debts, oaths, or someone's missing brother."</span>
        </div>
      </div>
      <div style={{ padding: "8px 18px 14px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        {[
          { stat: "PER", val: 4, text: "What makes the times dangerous?" },
          { stat: "STR", val: 6, text: "That tattoo — you broke an oath?", check: true },
          { stat: null, text: "I'm just passing through. Need information." },
          { stat: null, text: "Leave him to his nerves." }
        ].map((opt, i) => (
          <button key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-2)", border: "1px solid var(--line)", borderLeft: opt.check ? "3px solid var(--accent)" : "3px solid var(--line-2)", color: "var(--ink-2)", fontFamily: "var(--serif)", fontSize: 14, textAlign: "left", cursor: "pointer" }}>
            <span style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.1em" }}>›</span>
            <span style={{ flex: 1, fontStyle: "italic" }}>{opt.text}</span>
            {opt.stat && (<span className="ew-mono" style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--ink-4)", padding: "2px 6px", border: "1px solid var(--line-2)", borderRadius: 1 }}>{opt.stat} {opt.val}</span>)}
          </button>
        ))}
        <div style={{ marginTop: 4, display: "flex", border: "1px dashed var(--line-2)", padding: "8px 12px", fontFamily: "var(--serif)", fontStyle: "italic", color: "var(--ink-5)", fontSize: 13 }}>✎  type your own response…</div>
        <div className="ew-mono" style={{ marginTop: 4, fontSize: 9, color: "var(--ink-5)", letterSpacing: "0.2em", textDecoration: "underline", cursor: "pointer", alignSelf: "flex-start" }}>walk away</div>
      </div>
    </div>
  </div>
);

window.DialogueModal = DialogueModal;
