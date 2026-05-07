/* global React */
// Map system v3 — genre-native styles.
// Fantasy = drawn paper map (coastlines, trees, mountains, dotted travel lines).
// Cyberpunk = circuit/node graph.
// Three tier components dispatch by genre.

const useGenre = () => {
  const ref = React.useRef(null);
  const [genre, setGenre] = React.useState("fantasy");
  React.useEffect(() => {
    if (!ref.current) return;
    const el = ref.current.closest("[data-genre]");
    if (el) setGenre(el.getAttribute("data-genre") || "fantasy");
  }, []);
  return [genre, ref];
};

// ===== Paper backing (fantasy) =====
const PaperBacking = ({ children }) => (
  <svg viewBox="0 0 320 320" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
    <defs>
      <radialGradient id="pf-paper-warm" cx="50%" cy="45%" r="60%">
        <stop offset="0%" stopColor="#1a1611" stopOpacity="1" />
        <stop offset="100%" stopColor="#0e0c09" stopOpacity="1" />
      </radialGradient>
      <pattern id="pf-paper-fiber" width="80" height="80" patternUnits="userSpaceOnUse">
        <rect width="80" height="80" fill="transparent" />
        <path d="M 0 20 Q 40 18 80 22 M 0 50 Q 40 52 80 48 M 0 70 Q 40 68 80 72" stroke="rgba(180,160,130,0.04)" strokeWidth="0.4" fill="none" />
      </pattern>
      <radialGradient id="pf-paper-vig" cx="50%" cy="50%" r="70%">
        <stop offset="50%" stopColor="rgba(0,0,0,0)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.6)" />
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="320" height="320" fill="url(#pf-paper-warm)" />
    <rect x="0" y="0" width="320" height="320" fill="url(#pf-paper-fiber)" />
    {children}
    <rect x="0" y="0" width="320" height="320" fill="url(#pf-paper-vig)" pointerEvents="none" />
  </svg>
);

// ===== Ink/circuit backing (cyberpunk) =====
const InkBacking = ({ children }) => (
  <svg viewBox="0 0 320 320" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
    <defs>
      <pattern id="cy-circuit-grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 L 0 20" stroke="rgba(34,211,238,0.06)" strokeWidth="0.4" fill="none" />
      </pattern>
      <radialGradient id="cy-cyber-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="320" height="320" fill="#070a0c" />
    <rect x="0" y="0" width="320" height="320" fill="url(#cy-circuit-grid)" />
    {children}
  </svg>
);

// ===== Fantasy SVG primitives =====
const DrawnTree = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M 0 2 L 0 4" stroke="#8a6f4a" strokeWidth="0.6" />
    <path d="M -2.4 1 Q -2.6 -2 0 -3.5 Q 2.6 -2 2.4 1 Q 1 2 0 1.6 Q -1 2 -2.4 1 Z" fill="#3a2f20" stroke="#6b5638" strokeWidth="0.4" />
  </g>
);

const DrawnPeak = ({ x, y, w = 12, h = 10 }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d={`M ${-w/2} 0 L 0 ${-h} L ${w/2} 0 Z`} fill="#1f1813" stroke="#a08868" strokeWidth="0.7" strokeLinejoin="round" />
    <path d={`M ${-w/4} ${-h/3} L 0 ${-h*0.85}`} stroke="#a08868" strokeWidth="0.4" />
    <path d={`M ${-1.5} ${-h*0.7} L 0 ${-h} L ${1.5} ${-h*0.7}`} fill="#d8c8a8" opacity="0.85" />
  </g>
);

const Coastline = ({ d }) => (
  <g>
    <path d={d} fill="none" stroke="#7a5e38" strokeWidth="3.2" opacity="0.18" />
    <path d={d} fill="none" stroke="#7a5e38" strokeWidth="2.0" opacity="0.22" />
    <path d={d} fill="none" stroke="#c9a872" strokeWidth="0.8" />
  </g>
);

const Wavelet = ({ x, y, s = 1 }) => (
  <path d={`M ${x} ${y} q ${2*s} ${-1.5*s} ${4*s} 0 t ${4*s} 0`} fill="none" stroke="#7a92a8" strokeWidth="0.5" opacity="0.55" />
);

const TravelDots = ({ d, color = "#a08868" }) => (
  <path d={d} fill="none" stroke={color} strokeWidth="1" strokeDasharray="0.5 3.2" strokeLinecap="round" opacity="0.85" />
);

const Forest = ({ cx, cy, w = 40, h = 24, density = 14, label }) => {
  const trees = React.useMemo(() => {
    const arr = [];
    let seed = (cx * 1000 + cy) | 0;
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < density; i++) arr.push({ x: cx + (rand()-0.5)*w, y: cy + (rand()-0.5)*h, s: 0.85 + rand()*0.5 });
    return arr;
  }, [cx, cy, w, h, density]);
  return (
    <g>
      {trees.map((t, i) => <DrawnTree key={i} x={t.x} y={t.y} s={t.s} />)}
      {label && <text x={cx} y={cy+h/2+10} textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="9" fill="#c9a872" opacity="0.9">{label}</text>}
    </g>
  );
};

const MountainRange = ({ points, label }) => (
  <g>
    {points.map((p, i) => <DrawnPeak key={i} x={p[0]} y={p[1]} w={p[2]||12} h={p[3]||10} />)}
    {label && <text x={points[Math.floor(points.length/2)][0]} y={points[Math.floor(points.length/2)][1]+10} textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="9" fill="#c9a872" opacity="0.9">{label}</text>}
  </g>
);

const PlaceLabel = ({ x, y, primary, secondary, anchor = "middle", color = "#e8d8b0" }) => (
  <g>
    <text x={x} y={y} textAnchor={anchor} fontFamily="var(--serif)" fontStyle="italic" fontSize="11" fill={color} fontWeight="500" style={{ letterSpacing: 1.2 }}>{primary}</text>
    {secondary && <text x={x} y={y+11} textAnchor={anchor} fontFamily="var(--serif)" fontStyle="italic" fontSize="8" fill="#a08868" opacity="0.85" style={{ letterSpacing: 0.8 }}>{secondary}</text>}
  </g>
);

const TownGlyph = ({ x, y, current = false }) => (
  <g transform={`translate(${x} ${y})`}>
    {current && (
      <>
        <circle r="14" fill="rgba(245,158,11,0.10)" />
        <circle r="9" fill="none" stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2 2" className="ew-pulse" style={{ transformOrigin: "center" }} />
      </>
    )}
    <g stroke={current ? "#f59e0b" : "#e8d8b0"} strokeWidth="0.9" fill="#14110c" strokeLinejoin="round">
      <path d="M -4 1 L -4 -2 L -2 -4 L 0 -2 L 0 1 Z" />
      <path d="M 0 1 L 0 -1 L 2 -3 L 4 -1 L 4 1 Z" />
    </g>
  </g>
);

const CityGlyph = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <g stroke="#e8d8b0" strokeWidth="0.9" fill="#14110c" strokeLinejoin="round">
      <path d="M -5 2 L -5 -2 L -3 -4 L -1 -2 L 1 -4 L 3 -2 L 5 -4 L 5 2 Z" />
      <path d="M -2 2 L -2 -1 L 2 -1 L 2 2" />
    </g>
    <path d="M 5 -4 L 5 -8" stroke="#e8d8b0" strokeWidth="0.6" />
    <path d="M 5 -8 L 9 -7 L 5 -6 Z" fill="#c4302b" stroke="#e8d8b0" strokeWidth="0.4" />
  </g>
);

const RuinGlyph = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M -4 3 L -3 -3 L -1 -4 L 0 -1 L 2 -5 L 3 1 L 4 3 Z" fill="#14110c" stroke="#a08868" strokeWidth="0.8" strokeLinejoin="round" />
  </g>
);

const StoneGlyph = ({ x, y }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M -2 3 L -2.5 -3 L 0 -5 L 2.5 -3 L 2 3 Z" fill="#1a1611" stroke="#c9a872" strokeWidth="0.8" />
    <path d="M -1 -1 L 1 -1" stroke="#c9a872" strokeWidth="0.5" />
  </g>
);

const PaperCompass = ({ x, y, r = 16 }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={r} fill="rgba(20,17,12,0.55)" stroke="#a08868" strokeWidth="0.5" />
    <path d={`M 0 ${-r+3} L 1.5 0 L 0 ${r-3} L -1.5 0 Z`} fill="#e8d8b0" />
    <path d={`M ${-r+3} 0 L 0 -1.5 L ${r-3} 0 L 0 1.5 Z`} fill="#a08868" opacity="0.75" />
    <text y={-r-2} textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="8" fill="#e8d8b0">N</text>
  </g>
);

// ============================================================
// FANTASY WORLD
// ============================================================
const FantasyWorld = ({ npcMode }) => (
  <PaperBacking>
    <text x="14" y="22" fontFamily="var(--serif)" fontStyle="italic" fontSize="15" fill="#e8d8b0">Vryndaal</text>
    <text x="14" y="34" fontFamily="var(--serif)" fontStyle="italic" fontSize="8" fill="#a08868" letterSpacing="1.5">a world upon the broken accord</text>
    <Coastline d="M 270 30 Q 280 80 275 130 Q 285 180 280 230 Q 290 280 285 320" />
    {[[286,80],[292,130],[288,180],[295,230],[290,280]].map((p,i) => <Wavelet key={i} x={p[0]} y={p[1]} s={0.9} />)}
    <Coastline d="M 30 40 Q 80 35 130 42 Q 180 36 220 44 Q 250 38 270 40" />
    <MountainRange points={[[55,165,11,9],[68,158,13,11],[82,168,11,9],[95,160,13,12],[60,180,9,7],[78,188,11,8]]} label="Shardspine" />
    <Forest cx={150} cy={95} w={70} h={28} density={20} label="Hollowsbreath Wood" />
    <Forest cx={130} cy={250} w={60} h={26} density={16} label="Bellow Marsh" />
    <MountainRange points={[[220,115,10,8],[235,108,11,10],[248,118,9,7]]} />
    <TravelDots d="M 165 175 Q 130 175 95 175" />
    <TravelDots d="M 165 175 Q 200 145 230 130" />
    <TravelDots d="M 165 175 Q 175 215 200 250" />
    <TravelDots d="M 165 175 Q 130 130 130 100" />
    <RuinGlyph x={232} y={130} />
    <PlaceLabel x={232} y={148} primary="Kethyr-Fallen" secondary="ruined capital" />
    <CityGlyph x={200} y={250} />
    <PlaceLabel x={200} y={266} primary="Bellhaven" secondary="city of oaths" />
    <TownGlyph x={130} y={100} />
    <PlaceLabel x={130} y={86} primary="Hollow's Breath" />
    <TownGlyph x={95} y={175} />
    <PlaceLabel x={95} y={193} primary="Shard's End" />
    <TownGlyph x={165} y={175} current />
    <text x="165" y="160" textAnchor="middle" fontFamily="var(--mono)" fontSize="6.5" fill="#f59e0b" letterSpacing="1.5" fontWeight="600">— YOU —</text>
    <PlaceLabel x={165} y={195} primary="Oathstone Crossing" color="#f59e0b" />
    <StoneGlyph x={75} y={170} />
    <text x={75} y={183} textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="7" fill="#c4b5fd" opacity="0.9">the Bell</text>
    <StoneGlyph x={248} y={80} />
    <text x={248} y={93} textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="7" fill="#c4b5fd" opacity="0.9">North Obelisk</text>
    <text x={60} y={290} fontFamily="var(--serif)" fontStyle="italic" fontSize="11" fill="#a08868" opacity="0.55">terra incognita</text>
    <PaperCompass x={280} y={290} r={14} />
    {npcMode && (<><circle cx="170" cy="173" r="1.4" fill="#f59e0b" /><circle cx="170" cy="173" r="2.8" fill="#f59e0b" opacity="0.3" /></>)}
  </PaperBacking>
);

// ============================================================
// FANTASY REGION
// ============================================================
const FantasyRegion = ({ npcMode }) => (
  <PaperBacking>
    <text x="14" y="22" fontFamily="var(--serif)" fontStyle="italic" fontSize="15" fill="#e8d8b0">The Iron Mark Reaches</text>
    <text x="14" y="34" fontFamily="var(--serif)" fontStyle="italic" fontSize="8" fill="#a08868" letterSpacing="1.5">4 known · 1 rumored</text>
    <path d="M 25 295 Q 80 270 130 250 Q 175 230 220 200 Q 265 175 300 155" fill="none" stroke="#5a7a8c" strokeWidth="2.2" opacity="0.5" />
    <path d="M 25 295 Q 80 270 130 250 Q 175 230 220 200 Q 265 175 300 155" fill="none" stroke="#7a92a8" strokeWidth="0.8" />
    <text x="100" y="278" fontFamily="var(--serif)" fontStyle="italic" fontSize="8" fill="#7a92a8" opacity="0.85">the Veywash</text>
    <Forest cx={75} cy={88} w={80} h={32} density={26} label="Shardspine Wood" />
    <MountainRange points={[[25,175,9,8],[32,165,11,10],[42,178,9,7],[30,195,8,7]]} />
    <Forest cx={250} cy={270} w={60} h={26} density={14} label="Bellow Marsh" />
    <TravelDots d="M 160 178 Q 130 195 100 215" />
    <TravelDots d="M 160 178 Q 195 150 230 128" />
    <TravelDots d="M 160 178 Q 175 220 200 270" />
    <TravelDots d="M 160 178 Q 215 175 265 175" />
    <TravelDots d="M 100 215 Q 78 240 70 268" />
    <TownGlyph x={160} y={178} current />
    <PlaceLabel x={160} y={198} primary="Oathstone Crossing" color="#f59e0b" />
    <text x="160" y="208" textAnchor="middle" fontFamily="var(--mono)" fontSize="6.5" fill="#f59e0b" letterSpacing="2" fontWeight="600">— YOU ARE HERE —</text>
    <g transform="translate(100 215)"><g stroke="#e8d8b0" strokeWidth="0.9" fill="#14110c" strokeLinejoin="round"><rect x="-3.5" y="-2" width="7" height="5" /><path d="M -4 -2 L 0 -5 L 4 -2" /></g></g>
    <PlaceLabel x={100} y={232} primary="The Marked Rest" secondary="inn · visited" />
    <RuinGlyph x={230} y={128} />
    <PlaceLabel x={230} y={146} primary="Kethyr Scavenge" secondary="ruin · danger" />
    <CityGlyph x={200} y={270} />
    <PlaceLabel x={200} y={286} primary="Bellhaven" secondary="city" />
    <StoneGlyph x={70} y={268} />
    <text x="70" y="282" textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="8" fill="#c4b5fd" opacity="0.85">Wayshrine</text>
    <text x={265} y={172} textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="11" fill="#a08868" opacity="0.6">unknown</text>
    <PaperCompass x={285} y={50} r={12} />
    {npcMode && (<><g transform="translate(166 175)"><circle r="1.3" fill="#f59e0b" /><circle r="2.6" fill="#f59e0b" opacity="0.3" /></g><g transform="translate(102 213)"><circle r="1.3" fill="#f59e0b" /><circle r="2.6" fill="#f59e0b" opacity="0.3" /></g><g transform="translate(232 126)"><circle r="1.3" fill="#f87171" /><circle r="2.6" fill="#f87171" opacity="0.3" /></g></>)}
  </PaperBacking>
);

// ============================================================
// FANTASY LOCAL
// ============================================================
const FantasyLocal = ({ npcMode }) => {
  const buildings = [
    { id: "inn", x: 160, y: 175, label: "The Marked Rest", current: true, visited: true, type: "inn" },
    { id: "frg", x: 230, y: 165, label: "Halen's Forge", visited: true, type: "forge" },
    { id: "mkt", x: 155, y: 100, label: "Crossroads Market", visited: true, type: "market" },
    { id: "ldg", x: 235, y: 230, label: "Verity's Ledger", visited: true, type: "shop" },
    { id: "shr", x: 80, y: 170, label: "Chain Shrine", visited: false, type: "shrine" },
    { id: "gld", x: 75, y: 100, label: "Oathbinder Hall", visited: false, type: "guild" },
    { id: "stb", x: 240, y: 95, label: "Stables", visited: false, type: "stable" },
    { id: "wll", x: 110, y: 240, label: "The Well", visited: true, type: "well" },
  ];
  const drawBuilding = (b) => {
    const stroke = b.current ? "#f59e0b" : (b.visited ? "#e8d8b0" : "#7a6850");
    const fill = "#14110c";
    switch (b.type) {
      case "inn": return (<g stroke={stroke} strokeWidth="1" fill={fill} strokeLinejoin="round"><rect x="-9" y="-3" width="18" height="9" /><path d="M -10 -3 L 0 -10 L 10 -3" /></g>);
      case "forge": return (<g stroke={stroke} strokeWidth="1" fill={fill} strokeLinejoin="round"><rect x="-7" y="-2" width="14" height="8" /><path d="M -8 -2 L 0 -8 L 8 -2" /><path d="M 3 -8 L 3 -11 M 5 -8 L 5 -11" stroke={stroke} strokeWidth="0.5" /></g>);
      case "market": return (<g stroke={stroke} strokeWidth="1" fill={fill} strokeLinejoin="round"><path d="M -10 -2 L 10 -2 L 10 5 L -10 5 Z" /><path d="M -11 -2 L -8 -6 L 8 -6 L 11 -2" /></g>);
      case "shrine": return (<g stroke={stroke} strokeWidth="1" fill={fill} strokeLinejoin="round"><path d="M -6 6 L -6 -2 Q -6 -8 0 -8 Q 6 -8 6 -2 L 6 6" /><path d="M -2 6 L -2 -2 L 2 -2 L 2 6" /></g>);
      case "shop": return (<g stroke={stroke} strokeWidth="1" fill={fill} strokeLinejoin="round"><rect x="-7" y="-3" width="14" height="9" /><path d="M -8 -3 L 0 -8 L 8 -3" /></g>);
      case "guild": return (<g stroke={stroke} strokeWidth="1" fill={fill} strokeLinejoin="round"><path d="M -8 6 L -8 -2 L -6 -2 L -6 -4 L -3 -4 L -3 -2 L 3 -2 L 3 -4 L 6 -4 L 6 -2 L 8 -2 L 8 6 Z" /></g>);
      case "stable": return (<g stroke={stroke} strokeWidth="1" fill={fill} strokeLinejoin="round"><rect x="-8" y="-2" width="16" height="7" /><path d="M -9 -2 L 0 -7 L 9 -2" /></g>);
      case "well": return (<g stroke={stroke} strokeWidth="1" fill={fill}><ellipse cx="0" cy="2" rx="4" ry="1.5" /><path d="M -4 2 L -4 -1 L 4 -1 L 4 2" /><path d="M -5 -1 L -3 -5 L 3 -5 L 5 -1" /></g>);
      default: return null;
    }
  };
  return (
    <PaperBacking>
      <text x="14" y="22" fontFamily="var(--serif)" fontStyle="italic" fontSize="15" fill="#e8d8b0">Oathstone Crossing</text>
      <text x="14" y="34" fontFamily="var(--serif)" fontStyle="italic" fontSize="8" fill="#a08868" letterSpacing="1.5">4 of 8 buildings explored</text>
      <path d="M 38 70 Q 40 58 80 56 Q 160 50 240 58 Q 285 64 290 110 Q 295 200 285 255 Q 270 285 200 285 Q 100 290 50 280 Q 25 250 30 180 Q 30 90 38 70 Z" fill="none" stroke="#a08868" strokeWidth="0.8" strokeDasharray="4 2 1 2" opacity="0.7" />
      <g>
        <g stroke="#3d3528" strokeWidth="6" fill="none" opacity="0.6" strokeLinecap="round">
          {[["M 160 175 L 80 170"],["M 160 175 L 230 165"],["M 160 175 L 155 100"],["M 160 175 L 235 230"],["M 80 170 L 75 100"],["M 75 100 L 155 100"],["M 230 165 L 240 95"],["M 240 95 L 155 100"],["M 235 230 L 110 240"],["M 110 240 L 80 170"]].map((d,i) => <path key={i} d={d[0]} />)}
        </g>
        <g stroke="#a08868" strokeWidth="0.6" fill="none" strokeLinecap="round" strokeDasharray="0.5 3.5">
          {[["M 160 175 L 80 170"],["M 160 175 L 230 165"],["M 160 175 L 155 100"],["M 160 175 L 235 230"],["M 80 170 L 75 100"],["M 75 100 L 155 100"],["M 230 165 L 240 95"],["M 240 95 L 155 100"],["M 235 230 L 110 240"],["M 110 240 L 80 170"]].map((d,i) => <path key={i} d={d[0]} />)}
        </g>
      </g>
      {[[55,220],[60,245],[275,270],[280,230],[50,130],[285,130]].map((p,i) => <DrawnTree key={i} x={p[0]} y={p[1]} s={0.9} />)}
      {buildings.map(b => (
        <g key={b.id} transform={`translate(${b.x} ${b.y})`}>
          {b.current && (<><circle r="18" fill="rgba(245,158,11,0.10)" /><circle r="14" fill="none" stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2 2" className="ew-pulse" style={{ transformOrigin: "center" }} /></>)}
          {drawBuilding(b)}
          <text y={b.type === "stable" || b.type === "market" || b.type === "guild" ? -10 : 16} textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="9" fill={b.current ? "#f59e0b" : (b.visited ? "#e8d8b0" : "#7a6850")} fontWeight={b.current ? 600 : 400}>{b.label}</text>
        </g>
      ))}
      <text x="160" y="155" textAnchor="middle" fontFamily="var(--mono)" fontSize="6.5" fill="#f59e0b" letterSpacing="2" fontWeight="600">— YOU ARE HERE —</text>
      <text x="22" y="178" textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="8" fill="#a08868">← W. Gate</text>
      <text x="298" y="178" textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="8" fill="#a08868">E. Gate →</text>
      {npcMode && (<><g transform="translate(150 173)"><circle r="1.5" fill="#f59e0b" /><circle r="3" fill="#f59e0b" opacity="0.3" /></g><g transform="translate(167 178)"><circle r="1.5" fill="#f59e0b" /><circle r="3" fill="#f59e0b" opacity="0.3" /></g></>)}
    </PaperBacking>
  );
};

// ============================================================
// CYBERPUNK WORLD
// ============================================================
const CyberWorld = ({ npcMode }) => (
  <InkBacking>
    <text x="14" y="22" fontFamily="var(--mono)" fontSize="11" fill="var(--accent)" letterSpacing="3" fontWeight="600">NEO-VRYNDAAL</text>
    <text x="14" y="34" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-4)" letterSpacing="2.5">SECTOR.MAP // 5 KNOWN // 3 UNMAPPED</text>
    <circle cx="160" cy="175" r="40" fill="url(#cy-cyber-glow)" />
    <g stroke="var(--accent)" strokeWidth="0.8" fill="none" opacity="0.85">
      <path d="M 160 175 L 100 175 L 95 165" />
      <path d="M 160 175 L 175 130 L 230 130" />
      <path d="M 160 175 L 175 215 L 200 245" />
      <path d="M 160 175 L 130 100" />
    </g>
    <g stroke="var(--ink-4)" strokeWidth="0.6" fill="none" strokeDasharray="2 2" opacity="0.6">
      <path d="M 160 175 L 220 175 L 265 175" />
      <path d="M 95 165 L 70 105" />
    </g>
    {[{x:230,y:130,name:"KETHYR-FALLEN",sub:"ARCH.RUIN"},{x:200,y:245,name:"BELLHAVEN",sub:"MEGABLOCK"},{x:130,y:100,name:"HOLLOWS-BR",sub:"OUTPOST"},{x:95,y:175,name:"SHARD'S-END",sub:"SUBNODE"}].map(n => (
      <g key={n.name} transform={`translate(${n.x} ${n.y})`}>
        <rect x="-3" y="-3" width="6" height="6" fill="var(--bg-0)" stroke="var(--accent)" strokeWidth="0.8" />
        <rect x="-1.5" y="-1.5" width="3" height="3" fill="var(--accent)" />
        <text y="14" textAnchor="middle" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-1)" letterSpacing="1.2">{n.name}</text>
        <text y="22" textAnchor="middle" fontFamily="var(--mono)" fontSize="6" fill="var(--ink-4)" letterSpacing="1.5">{n.sub}</text>
      </g>
    ))}
    <g transform="translate(160 175)">
      <rect x="-7" y="-7" width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="0.4" strokeDasharray="2 2" />
      <rect x="-5" y="-5" width="10" height="10" fill="none" stroke="var(--accent)" strokeWidth="1.1" className="ew-pulse" style={{ transformOrigin: "center" }} />
      <rect x="-3" y="-3" width="6" height="6" fill="var(--accent)" />
      <text y="-12" textAnchor="middle" fontFamily="var(--mono)" fontSize="6.5" fill="var(--accent)" letterSpacing="2" fontWeight="600">// JACKED-IN //</text>
      <text y="20" textAnchor="middle" fontFamily="var(--mono)" fontSize="8" fill="var(--accent)" letterSpacing="1.5" fontWeight="600">OATHSTONE.X</text>
    </g>
    {[[265,175],[70,105],[70,245]].map((p,i) => (<g key={i} transform={`translate(${p[0]} ${p[1]})`} opacity="0.55"><rect x="-3" y="-3" width="6" height="6" fill="none" stroke="var(--ink-4)" strokeWidth="0.6" strokeDasharray="1.5 1.5" /><text y="14" textAnchor="middle" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-4)" letterSpacing="1.2">[NO_DATA]</text></g>))}
    <g stroke="var(--accent)" strokeWidth="0.6" fill="none" opacity="0.5"><path d="M 8 50 L 8 60 L 18 60" /><path d="M 312 50 L 312 60 L 302 60" /><path d="M 8 310 L 8 300 L 18 300" /><path d="M 312 310 L 312 300 L 302 300" /></g>
    {npcMode && (<><circle cx="170" cy="172" r="1.4" fill="var(--accent)" /><circle cx="170" cy="172" r="3" fill="var(--accent)" opacity="0.3" /></>)}
  </InkBacking>
);

const CyberRegion = ({ npcMode }) => (
  <InkBacking>
    <text x="14" y="22" fontFamily="var(--mono)" fontSize="11" fill="var(--accent)" letterSpacing="3" fontWeight="600">IRON.MARK.SECTOR</text>
    <text x="14" y="34" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-4)" letterSpacing="2.5">LOCAL.ROUTE.MAP // 4 NODES</text>
    <g stroke="var(--accent)" strokeWidth="0.6" fill="none" opacity="0.5"><path d="M 8 50 L 8 60 L 18 60" /><path d="M 312 50 L 312 60 L 302 60" /><path d="M 8 310 L 8 300 L 18 300" /><path d="M 312 310 L 312 300 L 302 300" /></g>
    <circle cx="160" cy="178" r="40" fill="url(#cy-cyber-glow)" />
    <g stroke="var(--accent)" strokeWidth="0.8" fill="none">
      <path d="M 160 178 L 110 215 L 100 215" opacity="0.85" />
      <path d="M 160 178 L 195 145 L 230 130" opacity="0.85" />
      <path d="M 160 178 L 175 220 L 200 270" opacity="0.85" />
    </g>
    <g stroke="var(--ink-4)" strokeWidth="0.6" fill="none" strokeDasharray="2 2" opacity="0.6"><path d="M 160 178 L 215 178 L 265 175" /></g>
    <g transform="translate(160 178)">
      <rect x="-7" y="-7" width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="0.4" strokeDasharray="2 2" />
      <rect x="-5" y="-5" width="10" height="10" fill="none" stroke="var(--accent)" strokeWidth="1.1" className="ew-pulse" style={{ transformOrigin: "center" }} />
      <rect x="-3" y="-3" width="6" height="6" fill="var(--accent)" />
      <text y="20" textAnchor="middle" fontFamily="var(--mono)" fontSize="8" fill="var(--accent)" letterSpacing="1.5" fontWeight="600">OATHSTONE.JCT</text>
    </g>
    {[{x:100,y:215,name:"MARKED.REST",sub:"INN.NODE"},{x:230,y:130,name:"KETHYR.SCAV",sub:"RUIN // RISK 2"},{x:200,y:270,name:"BELLHAVEN",sub:"MEGABLOCK"}].map(n => (
      <g key={n.name} transform={`translate(${n.x} ${n.y})`}>
        <rect x="-3" y="-3" width="6" height="6" fill="var(--bg-0)" stroke="var(--accent)" strokeWidth="0.8" />
        <rect x="-1.5" y="-1.5" width="3" height="3" fill="var(--accent)" />
        <text y="14" textAnchor="middle" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-1)" letterSpacing="1.2">{n.name}</text>
        <text y="22" textAnchor="middle" fontFamily="var(--mono)" fontSize="6" fill="var(--ink-4)" letterSpacing="1.5">{n.sub}</text>
      </g>
    ))}
    {npcMode && (<><g transform="translate(166 175)"><circle r="1.4" fill="var(--accent)" /><circle r="3" fill="var(--accent)" opacity="0.3" /></g></>)}
  </InkBacking>
);

const CyberLocal = ({ npcMode }) => {
  const buildings = [
    { id:"inn", x:160, y:175, label:"MARKED.REST", current:true, visited:true },
    { id:"frg", x:230, y:165, label:"FORGE.NODE", visited:true },
    { id:"mkt", x:155, y:100, label:"BAZAAR.NET", visited:true },
    { id:"ldg", x:235, y:230, label:"VERITY.LDG", visited:true },
    { id:"shr", x:80, y:170, label:"CHAIN.SHR", visited:false },
    { id:"gld", x:75, y:100, label:"OATHBINDER", visited:false },
    { id:"stb", x:240, y:95, label:"TRANSIT.HB", visited:false },
    { id:"wll", x:110, y:240, label:"WELL.PUMP", visited:true },
  ];
  return (
    <InkBacking>
      <text x="14" y="22" fontFamily="var(--mono)" fontSize="11" fill="var(--accent)" letterSpacing="3" fontWeight="600">OATHSTONE.JCT</text>
      <text x="14" y="34" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-4)" letterSpacing="2.5">BLOCK.MAP // 4 OF 8 ACCESSED</text>
      <g stroke="var(--accent)" strokeWidth="0.6" fill="none" opacity="0.5"><path d="M 8 50 L 8 60 L 18 60" /><path d="M 312 50 L 312 60 L 302 60" /><path d="M 8 310 L 8 300 L 18 300" /><path d="M 312 310 L 312 300 L 302 300" /></g>
      <rect x="38" y="60" width="252" height="225" fill="none" stroke="var(--ink-4)" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.6" />
      <g stroke="var(--accent)" strokeWidth="0.6" fill="none" opacity="0.6">
        {buildings.filter(b => !b.current).map(b => (<path key={b.id} d={`M 160 175 L ${b.x} ${b.y}`} strokeDasharray={b.visited ? undefined : "2 2"} opacity={b.visited ? 0.85 : 0.45} />))}
      </g>
      <circle cx="160" cy="175" r="22" fill="url(#cy-cyber-glow)" />
      {buildings.map(b => (
        <g key={b.id} transform={`translate(${b.x} ${b.y})`}>
          {b.current && (<><rect x="-9" y="-9" width="18" height="18" fill="none" stroke="var(--accent)" strokeWidth="0.4" strokeDasharray="2 2" /><rect x="-7" y="-7" width="14" height="14" fill="none" stroke="var(--accent)" strokeWidth="1.1" className="ew-pulse" style={{ transformOrigin: "center" }} /></>)}
          <rect x="-4" y="-4" width="8" height="8" fill={b.current ? "var(--accent)" : "var(--bg-0)"} stroke={b.current ? "var(--accent)" : (b.visited ? "var(--accent)" : "var(--ink-4)")} strokeWidth={b.current ? 1.2 : 0.8} strokeDasharray={b.visited || b.current ? undefined : "1.5 1.5"} />
          {!b.current && b.visited && <rect x="-2" y="-2" width="4" height="4" fill="var(--accent)" opacity="0.5" />}
          <text y="16" textAnchor="middle" fontFamily="var(--mono)" fontSize="7" fill={b.current ? "var(--accent)" : (b.visited ? "var(--ink-1)" : "var(--ink-4)")} letterSpacing="1" fontWeight={b.current ? 700 : 500}>{b.label}</text>
        </g>
      ))}
      <text x="160" y="153" textAnchor="middle" fontFamily="var(--mono)" fontSize="6.5" fill="var(--accent)" letterSpacing="2" fontWeight="600">// JACKED-IN //</text>
      {npcMode && (<><g transform="translate(150 173)"><circle r="1.5" fill="var(--accent)" /><circle r="3" fill="var(--accent)" opacity="0.3" /></g></>)}
    </InkBacking>
  );
};

// ============================================================
// Dispatchers
// ============================================================
const pickWorld = (genre) => ({ fantasy: FantasyWorld, cyber: CyberWorld }[genre] || FantasyWorld);
const WorldMapV2 = (props) => { const [genre, ref] = useGenre(); const Body = pickWorld(genre); return <div ref={ref} style={{ width:"100%", height:"100%" }}><Body {...props} /></div>; };

const pickRegion = (genre) => ({ fantasy: FantasyRegion, cyber: CyberRegion }[genre] || FantasyRegion);
const RegionMapV2 = (props) => { const [genre, ref] = useGenre(); const Body = pickRegion(genre); return <div ref={ref} style={{ width:"100%", height:"100%" }}><Body {...props} /></div>; };

const pickLocal = (genre) => ({ fantasy: FantasyLocal, cyber: CyberLocal }[genre] || FantasyLocal);
const LocalMapV2 = (props) => { const [genre, ref] = useGenre(); const Body = pickLocal(genre); return <div ref={ref} style={{ width:"100%", height:"100%" }}><Body {...props} /></div>; };

window.WorldMapV2 = WorldMapV2;
window.RegionMapV2 = RegionMapV2;
window.LocalMapV2 = LocalMapV2;
// Export primitives for map-genres.jsx to reuse
window.MapPrimitives = { PaperBacking, InkBacking, DrawnTree, DrawnPeak, Forest, MountainRange, TownGlyph, CityGlyph, RuinGlyph, StoneGlyph, PaperCompass, TravelDots, PlaceLabel, Coastline, Wavelet };
