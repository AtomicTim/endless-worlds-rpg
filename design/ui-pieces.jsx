/* global React */
// Full game UI — header, story feed, navigation, input bar, dialogue, map sidebar
// Built as static demo screens; map uses LocalMap.

const { useState } = React;

// === Story feed pieces ===

const OPENERS = ['"', '“'];
const CLOSERS = ['"', '”'];
const isOpener = (c) => OPENERS.includes(c);
const isCloser = (c) => CLOSERS.includes(c);

const wrapQuoteString = (text, startInside) => {
  const out = [];
  let buf = "";
  let inside = startInside;
  let key = 0;
  const flush = () => {
    if (!buf) return;
    if (inside) out.push(<span key={key++} className="ew-said">{buf}</span>);
    else out.push(buf);
    buf = "";
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (!inside && isOpener(c)) {
      flush(); inside = true; buf += c;
    } else if (inside && isCloser(c)) {
      buf += c; flush(); inside = false;
    } else {
      buf += c;
    }
  }
  flush();
  return { nodes: out.length === 1 ? out[0] : out, inside };
};

const wrapQuotes = (root) => {
  let inside = false;
  let key = 0;
  const walk = (node) => {
    if (node === null || node === undefined || typeof node === "boolean") return node;
    if (typeof node === "string") {
      const { nodes, inside: next } = wrapQuoteString(node, inside);
      inside = next;
      return nodes;
    }
    if (typeof node === "number") return node;
    if (Array.isArray(node)) return node.map((c) => <React.Fragment key={key++}>{walk(c)}</React.Fragment>);
    if (React.isValidElement(node)) {
      if (node.props?.className?.includes?.("ew-said") || node.props?.["data-said-skip"]) return node;
      const children = node.props?.children;
      if (children === undefined) {
        return inside ? <span key={key++} className="ew-said">{node}</span> : node;
      }
      return React.cloneElement(node, { key: key++ }, walk(children));
    }
    return node;
  };
  return walk(root);
};

const Said = ({ children }) => <span className="ew-said">{children}</span>;

const NarrativeBlock = ({ children }) => (
  <p className="ew-serif" style={{ fontSize: 15, lineHeight: 1.85, color: "var(--ink-3)", margin: "12px 0", maxWidth: 640 }}>{wrapQuotes(children)}</p>
);

const SceneDivider = ({ label }) => (
  <div className="ew-divider" style={{ maxWidth: 640 }}>
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <svg width="10" height="10" viewBox="0 0 10 10"><path d="M 5 0 L 10 5 L 5 10 L 0 5 Z" fill="currentColor" /></svg>
      {label}
    </span>
  </div>
);

const NPCSpeech = ({ name, color = "var(--accent)", children }) => (
  <div style={{ margin: "16px 0", maxWidth: 640 }}>
    <div className="ew-mono" style={{ color, fontSize: 10, letterSpacing: "0.2em", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 0 2px var(--bg-0), 0 0 0 3px ${color}` }} />
      {name.toUpperCase()}
    </div>
    <div className="ew-serif" style={{ fontSize: 15, lineHeight: 1.85, color: "var(--ink-2)", borderLeft: `2px solid ${color}`, paddingLeft: 14, opacity: 0.95 }}>
      {wrapQuotes(children)}
    </div>
  </div>
);

const StatPill = ({ stat, value, dc, total, pass, descriptor, children }) => {
  const color = pass ? "var(--hl-pass)" : "var(--hl-fail)";
  return (
    <span style={{ display: "inline", background: pass ? "rgba(163,230,53,0.08)" : "rgba(248,113,113,0.08)", padding: "1px 6px", borderRadius: 2, color: "var(--ink-1)" }}>
      <span className="ew-serif" style={{ fontStyle: "italic" }}>{descriptor || children || `${stat} check`}</span>
      <span className="ew-mono" style={{ fontSize: 9, letterSpacing: "0.18em", marginLeft: 6, color, verticalAlign: "1px", fontWeight: 600 }}>
        {stat.toUpperCase()} {total}<span style={{ color: "var(--ink-5)" }}>/</span>{dc}
      </span>
    </span>
  );
};

const Loc = ({ children }) => <span className="ew-link-loc">{children}</span>;
const Npc = ({ children }) => <span className="ew-link-npc">{children}</span>;
const Item = ({ children }) => <span className="ew-link-item">{children}</span>;
const Lndmk = ({ children }) => <span className="ew-link-landmark">{children}</span>;

const NavCard = ({ icon, name, type, visited, undiscovered, current }) => {
  const borderStyle = undiscovered ? "dashed" : "solid";
  return (
    <button style={{
      display: "flex", alignItems: "center", gap: 10,
      minHeight: 52, padding: "8px 14px",
      background: current ? "var(--accent-faint)" : "var(--bg-2)",
      border: `1px ${borderStyle} ${current ? "var(--accent)" : "var(--line)"}`,
      borderRadius: 4, color: "var(--ink-2)", fontFamily: "var(--mono)",
      cursor: "pointer", flexShrink: 0, textAlign: "left",
      position: "relative", transition: "all 120ms"
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, color: undiscovered ? "var(--ink-4)" : (current ? "var(--accent)" : "var(--ink-2)") }}>
        {icon}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.16em", fontWeight: 600, color: current ? "var(--accent)" : (undiscovered ? "var(--ink-4)" : "var(--ink-1)") }}>
          {undiscovered ? "??? " : ""}{name}
        </div>
        <div style={{ fontSize: 8, letterSpacing: "0.2em", color: "var(--ink-4)", display: "flex", alignItems: "center", gap: 6 }}>
          <span>{type}</span>
          {visited && !current && (<><span style={{ width: 3, height: 3, background: "var(--ink-5)", borderRadius: 2 }} /><span>VISITED</span></>)}
          {current && <><span style={{ width: 3, height: 3, background: "var(--accent)", borderRadius: 2 }} /><span style={{ color: "var(--accent)" }}>HERE</span></>}
        </div>
      </div>
    </button>
  );
};

window.NarrativeBlock = NarrativeBlock;
window.SceneDivider = SceneDivider;
window.NPCSpeech = NPCSpeech;
window.Said = Said;
window.wrapQuotes = wrapQuotes;
window.StatPill = StatPill;
window.Loc = Loc;
window.Npc = Npc;
window.Item = Item;
window.Lndmk = Lndmk;
window.NavCard = NavCard;

window.NavIcons = {
  trail: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M 3 17 Q 6 10 10 12 Q 14 14 17 4" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2 2" strokeLinecap="round" /></svg>,
  inn: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M 3 16 L 3 8 L 10 3 L 17 8 L 17 16 Z" stroke="currentColor" strokeWidth="1.4" /><path d="M 8 16 L 8 11 L 12 11 L 12 16" stroke="currentColor" strokeWidth="1.4" /></svg>,
  city: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M 3 17 L 3 9 L 8 9 L 8 5 L 14 5 L 14 9 L 17 9 L 17 17 Z" stroke="currentColor" strokeWidth="1.4" /><path d="M 6 17 L 6 13 M 11 17 L 11 13" stroke="currentColor" strokeWidth="1" /></svg>,
  ruin: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M 2 17 L 2 11 L 6 11 L 6 6 L 9 11 L 13 7 L 13 11 L 18 11 L 18 17 Z" stroke="currentColor" strokeWidth="1.4" /></svg>,
  fog: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" /><text x="10" y="13" fontSize="8" fontFamily="monospace" textAnchor="middle" fill="currentColor">?</text></svg>,
  shrine: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M 10 3 L 10 17 M 6 8 L 14 8" stroke="currentColor" strokeWidth="1.4" /><circle cx="10" cy="3" r="1.5" fill="currentColor" /></svg>,
};
