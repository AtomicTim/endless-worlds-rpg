/* global React */
// Genre-specific map renderers: Space Opera, Post-Apocalyptic, Horror.
// All follow the same SVG conventions as FantasyWorld/CyberWorld in map-v2.jsx
// (320x320 viewbox, pulsing current marker, optional NPC dots).

// ===== SPACE — starfield backing =====
const StarBacking = ({ children }) => (
  <svg viewBox="0 0 320 320" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
    <defs>
      <radialGradient id="sp-space-bg" cx="50%" cy="45%" r="70%">
        <stop offset="0%" stopColor="#0d0a1f" />
        <stop offset="100%" stopColor="#04030c" />
      </radialGradient>
      <radialGradient id="sp-nebula" cx="35%" cy="65%" r="55%">
        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="sp-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="320" height="320" fill="url(#sp-space-bg)" />
    <rect x="0" y="0" width="320" height="320" fill="url(#sp-nebula)" />
    {[[22,38],[55,14],[98,60],[144,22],[188,48],[220,14],[266,36],[296,70],[12,110],[62,142],[108,130],[156,180],[202,162],[248,200],[288,138],[40,220],[82,260],[128,280],[174,230],[216,286],[256,248],[296,268],[70,190],[240,100],[180,90],[22,178],[134,244],[304,220]].map(([x,y],i) => (
      <circle key={i} cx={x} cy={y} r={0.5+(i%3)*0.25} fill="#cfd8ff" opacity={0.45+(i%4)*0.12} />
    ))}
    {[[68,70],[212,110],[98,220],[248,260]].map(([x,y],i) => (
      <g key={i}><circle cx={x} cy={y} r="1.2" fill="var(--accent)" opacity="0.9" /><circle cx={x} cy={y} r="3" fill="var(--accent)" opacity="0.18" /></g>
    ))}
    {children}
  </svg>
);

// ===== APOC — salvage paper backing =====
const SalvageBacking = ({ children }) => (
  <svg viewBox="0 0 320 320" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
    <defs>
      <linearGradient id="ap-paper" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#1a1108" />
        <stop offset="100%" stopColor="#0d0805" />
      </linearGradient>
      <pattern id="ap-stains" width="60" height="60" patternUnits="userSpaceOnUse">
        <circle cx="14" cy="22" r="9" fill="rgba(120,60,20,0.10)" />
        <circle cx="42" cy="46" r="6" fill="rgba(120,60,20,0.08)" />
        <circle cx="34" cy="10" r="3" fill="rgba(120,60,20,0.07)" />
      </pattern>
      <radialGradient id="ap-vig" cx="50%" cy="50%" r="70%">
        <stop offset="55%" stopColor="rgba(0,0,0,0)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0.7)" />
      </radialGradient>
      <radialGradient id="ap-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="320" height="320" fill="url(#ap-paper)" />
    <rect x="0" y="0" width="320" height="320" fill="url(#ap-stains)" />
    <g opacity="0.55">
      <rect x="-6" y="14" width="44" height="10" fill="rgba(220,200,160,0.18)" transform="rotate(-22 16 19)" />
      <rect x="282" y="298" width="44" height="10" fill="rgba(220,200,160,0.18)" transform="rotate(18 304 303)" />
    </g>
    {children}
    <rect x="0" y="0" width="320" height="320" fill="url(#ap-vig)" pointerEvents="none" />
  </svg>
);

// ===== HORROR — black ink backing =====
const BlackInkBacking = ({ children }) => (
  <svg viewBox="0 0 320 320" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
    <defs>
      <radialGradient id="ho-bg" cx="50%" cy="50%" r="70%">
        <stop offset="0%" stopColor="#0a0f08" />
        <stop offset="100%" stopColor="#040603" />
      </radialGradient>
      <radialGradient id="ho-smoke" cx="50%" cy="60%" r="55%">
        <stop offset="0%" stopColor="rgba(132,204,22,0.10)" />
        <stop offset="100%" stopColor="rgba(132,204,22,0)" />
      </radialGradient>
      <radialGradient id="ho-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.30" />
        <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
      </radialGradient>
    </defs>
    <rect x="0" y="0" width="320" height="320" fill="url(#ho-bg)" />
    <rect x="0" y="0" width="320" height="320" fill="url(#ho-smoke)" />
    {children}
  </svg>
);

// ============================================================
// SPACE OPERA — World
// ============================================================
const SpaceWorld = ({ npcMode }) => (
  <StarBacking>
    <text x="14" y="22" fontFamily="var(--mono)" fontSize="11" fill="var(--accent)" letterSpacing="3" fontWeight="600">OUTER OATHSTONE</text>
    <text x="14" y="34" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-4)" letterSpacing="2.5">SECTOR.7H // 4 SYSTEMS CHARTED</text>
    <circle cx="160" cy="175" r="34" fill="url(#sp-glow)" />
    <g stroke="var(--accent)" strokeWidth="0.7" fill="none" opacity="0.85">
      <path d="M 160 175 Q 130 130 100 100" />
      <path d="M 160 175 Q 200 145 240 130" />
      <path d="M 160 175 Q 175 220 210 250" />
      <path d="M 160 175 Q 110 200 80 220" />
    </g>
    <g stroke="var(--ink-4)" strokeWidth="0.5" fill="none" strokeDasharray="2 3" opacity="0.55">
      <path d="M 240 130 Q 280 100 290 70" />
      <path d="M 80 220 Q 50 250 38 280" />
    </g>
    {[{x:100,y:100,name:"KETHYR-7",sub:"DEAD STAR"},{x:240,y:130,name:"BELLHAVEN",sub:"CORE WORLD"},{x:210,y:250,name:"SHARD'S END",sub:"ASTEROID FLD"},{x:80,y:220,name:"VERIDIAN",sub:"AGRI WORLD"}].map(s => (
      <g key={s.name} transform={`translate(${s.x} ${s.y})`}>
        <ellipse cx="0" cy="0" rx="6" ry="2" fill="none" stroke="var(--accent)" strokeWidth="0.5" opacity="0.55" transform="rotate(-18)" />
        <circle r="2.4" fill="var(--accent)" />
        <text y="14" textAnchor="middle" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-1)" letterSpacing="1.2">{s.name}</text>
        <text y="22" textAnchor="middle" fontFamily="var(--mono)" fontSize="6" fill="var(--ink-4)" letterSpacing="1.5">{s.sub}</text>
      </g>
    ))}
    <g transform="translate(160 175)">
      <circle r="9" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="2 2" />
      <circle r="6" fill="none" stroke="var(--accent)" strokeWidth="1.0" className="ew-pulse" style={{ transformOrigin: "center" }} />
      <path d="M 0 -4 L 3 3 L 0 1.5 L -3 3 Z" fill="var(--accent)" />
      <text y="-12" textAnchor="middle" fontFamily="var(--mono)" fontSize="6.5" fill="var(--accent)" letterSpacing="2" fontWeight="600">◇ YOU ARE HERE</text>
      <text y="20" textAnchor="middle" fontFamily="var(--mono)" fontSize="8" fill="var(--accent)" letterSpacing="1.5" fontWeight="600">OATHSTONE-9</text>
    </g>
    {[[290,70],[38,280]].map((p,i) => (<g key={i} transform={`translate(${p[0]} ${p[1]})`} opacity="0.6"><circle r="2" fill="none" stroke="var(--ink-4)" strokeWidth="0.5" strokeDasharray="1.2 1.2" /><text y="14" textAnchor="middle" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-4)" letterSpacing="1.2">[UNCHARTED]</text></g>))}
    {npcMode && (<><circle cx="170" cy="172" r="1.4" fill="var(--accent)" /><circle cx="170" cy="172" r="3" fill="var(--accent)" opacity="0.3" /></>)}
  </StarBacking>
);

const SpaceRegion = ({ npcMode }) => (
  <StarBacking>
    <text x="14" y="22" fontFamily="var(--mono)" fontSize="11" fill="var(--accent)" letterSpacing="3" fontWeight="600">OATHSTONE-9 SURFACE</text>
    <text x="14" y="34" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-4)" letterSpacing="2.5">ORBITAL SCAN // 4 SETTLEMENTS</text>
    <ellipse cx="160" cy="350" rx="220" ry="180" fill="none" stroke="var(--accent)" strokeWidth="0.5" opacity="0.4" />
    <circle cx="160" cy="178" r="22" fill="url(#sp-glow)" />
    {[{x:100,y:218,name:"MARKED OUTPOST",sub:"WAY-STN"},{x:230,y:134,name:"KETHYR DRIFT",sub:"CRASH SITE"},{x:200,y:270,name:"BELLHAVEN",sub:"DOMED CITY"},{x:70,y:268,name:"RELAY 7-A",sub:"COMMS"}].map(s => (
      <g key={s.name}>
        <path d={`M 160 178 L ${s.x} ${s.y}`} stroke="var(--accent)" strokeWidth="0.5" opacity="0.55" />
        <g transform={`translate(${s.x} ${s.y})`}>
          <circle r="2" fill="var(--accent)" /><circle r="4" fill="none" stroke="var(--accent)" strokeWidth="0.4" />
          <text y="14" textAnchor="middle" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-1)" letterSpacing="1.2">{s.name}</text>
          <text y="22" textAnchor="middle" fontFamily="var(--mono)" fontSize="6" fill="var(--ink-4)" letterSpacing="1.5">{s.sub}</text>
        </g>
      </g>
    ))}
    <g transform="translate(160 178)">
      <path d="M 0 -5 L 4 4 L 0 2 L -4 4 Z" fill="var(--accent)" />
      <text y="-10" textAnchor="middle" fontFamily="var(--mono)" fontSize="6.5" fill="var(--accent)" letterSpacing="2" fontWeight="600">◇ LANDED</text>
      <text y="19" textAnchor="middle" fontFamily="var(--mono)" fontSize="8" fill="var(--accent)" letterSpacing="1.5" fontWeight="600">OATHSTONE BASIN</text>
    </g>
    {npcMode && (<><g transform="translate(166 175)"><circle r="1.4" fill="var(--accent)" /><circle r="3" fill="var(--accent)" opacity="0.3" /></g></>)}
  </StarBacking>
);

const SpaceLocal = ({ npcMode }) => {
  const rooms = [
    {id:"hub",x:160,y:175,w:60,h:40,label:"HAB.CORE",current:true,visited:true},
    {id:"mess",x:230,y:165,w:38,h:26,label:"MESS",visited:true},
    {id:"med",x:155,y:100,w:44,h:28,label:"MED.BAY",visited:true},
    {id:"lab",x:235,y:230,w:38,h:28,label:"LAB",visited:true},
    {id:"bay",x:80,y:170,w:40,h:30,label:"DOCK.BAY",visited:false},
    {id:"qrt",x:75,y:100,w:40,h:26,label:"QUARTERS",visited:false},
    {id:"eng",x:240,y:95,w:40,h:28,label:"ENGINE",visited:false},
    {id:"air",x:100,y:240,w:36,h:22,label:"AIRLOCK",visited:true},
  ];
  return (
    <StarBacking>
      <text x="14" y="22" fontFamily="var(--mono)" fontSize="11" fill="var(--accent)" letterSpacing="3" fontWeight="600">OATHSTONE STATION</text>
      <text x="14" y="34" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-4)" letterSpacing="2.5">DECK PLAN // 5 OF 8 PRESSURIZED</text>
      <rect x="42" y="62" width="246" height="220" rx="14" fill="none" stroke="var(--accent)" strokeWidth="0.5" opacity="0.5" strokeDasharray="3 3" />
      <g stroke="var(--accent)" strokeWidth="0.6" fill="none" opacity="0.6">
        {rooms.filter(r => !r.current).map(r => (<path key={r.id} d={`M 160 175 L ${r.x} ${r.y}`} strokeDasharray={r.visited ? undefined : "2 2"} opacity={r.visited ? 0.85 : 0.35} />))}
      </g>
      <ellipse cx="160" cy="175" rx="30" ry="20" fill="url(#sp-glow)" />
      {rooms.map(r => (
        <g key={r.id} transform={`translate(${r.x} ${r.y})`}>
          {r.current && (<rect x={-r.w/2-4} y={-r.h/2-4} width={r.w+8} height={r.h+8} rx="3" fill="none" stroke="var(--accent)" strokeWidth="0.4" strokeDasharray="2 2" className="ew-pulse" style={{ transformOrigin: "center" }} />)}
          <rect x={-r.w/2} y={-r.h/2} width={r.w} height={r.h} rx="3" fill={r.current ? "rgba(168,85,247,0.18)" : "rgba(20,15,30,0.7)"} stroke={r.current ? "var(--accent)" : (r.visited ? "var(--accent)" : "var(--ink-4)")} strokeWidth={r.current ? 1.1 : 0.7} strokeDasharray={r.visited || r.current ? undefined : "1.5 1.5"} />
          <text y="2" textAnchor="middle" fontFamily="var(--mono)" fontSize="7" fill={r.current ? "var(--accent)" : (r.visited ? "var(--ink-1)" : "var(--ink-4)")} letterSpacing="1" fontWeight={r.current ? 700 : 500}>{r.label}</text>
        </g>
      ))}
      {npcMode && (<><g transform="translate(150 173)"><circle r="1.5" fill="var(--accent)" /><circle r="3" fill="var(--accent)" opacity="0.3" /></g></>)}
    </StarBacking>
  );
};

// ============================================================
// POST-APOCALYPTIC
// ============================================================
const ApocWorld = ({ npcMode }) => (
  <SalvageBacking>
    <text x="14" y="22" fontFamily="var(--mono)" fontSize="11" fill="var(--accent)" letterSpacing="3" fontWeight="700">THE WASTES</text>
    <text x="14" y="34" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-4)" letterSpacing="2.5">SCROUNGED FROM A DEAD MAN // 4 KNOWN</text>
    <g stroke="var(--accent)" strokeWidth="1.0" fill="none" strokeDasharray="0.6 3" strokeLinecap="round" opacity="0.85">
      <path d="M 160 175 Q 132 145 100 100" /><path d="M 160 175 Q 200 150 240 130" />
      <path d="M 160 175 Q 178 220 210 252" /><path d="M 160 175 Q 112 198 80 220" />
    </g>
    <g opacity="0.55">
      <circle cx="265" cy="250" r="26" fill="rgba(234,88,12,0.15)" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="2 2" />
      <text x="265" y="252" textAnchor="middle" fontFamily="var(--mono)" fontSize="9" fill="var(--accent)" letterSpacing="2.5" fontWeight="700">☢ HOT</text>
    </g>
    {[{x:100,y:100,name:"KETHYR BONES",sub:"RUIN",danger:true},{x:240,y:130,name:"BELLHAVEN",sub:"WALLED CITY"},{x:210,y:252,name:"SHARD WELL",sub:"WATER"},{x:80,y:220,name:"TIN ROW",sub:"TRADE CAMP"}].map(s => (
      <g key={s.name} transform={`translate(${s.x} ${s.y})`}>
        <path d="M -3.5 -3.5 L 3.5 3.5 M -3.5 3.5 L 3.5 -3.5" stroke={s.danger ? "var(--hl-fail)" : "var(--accent)"} strokeWidth="1.2" strokeLinecap="round" />
        <circle r="5" fill="none" stroke={s.danger ? "var(--hl-fail)" : "var(--accent)"} strokeWidth="0.6" opacity="0.7" />
        <text y="14" textAnchor="middle" fontFamily="var(--mono)" fontSize="7.5" fill={s.danger ? "var(--hl-fail)" : "var(--ink-1)"} letterSpacing="1" fontWeight="600">{s.name}</text>
        <text y="22" textAnchor="middle" fontFamily="var(--mono)" fontSize="6" fill="var(--ink-4)" letterSpacing="1.5">{s.sub}</text>
      </g>
    ))}
    <circle cx="160" cy="175" r="32" fill="url(#ap-glow)" />
    <g transform="translate(160 175)">
      <circle r="8" fill="none" stroke="var(--accent)" strokeWidth="0.8" className="ew-pulse" style={{ transformOrigin: "center" }} />
      <path d="M -4 -4 L 4 4 M -4 4 L 4 -4" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
      <text y="-12" textAnchor="middle" fontFamily="var(--mono)" fontSize="7" fill="var(--accent)" letterSpacing="2.5" fontWeight="700">★ HERE ★</text>
      <text y="20" textAnchor="middle" fontFamily="var(--mono)" fontSize="8.5" fill="var(--accent)" letterSpacing="1" fontWeight="700">OATHSTONE FORK</text>
    </g>
    {[[290,70],[38,280]].map((p,i) => (<g key={i} transform={`translate(${p[0]} ${p[1]})`}><rect x="-18" y="-4" width="36" height="9" fill="rgba(0,0,0,0.85)" /><text y="2.5" textAnchor="middle" fontFamily="var(--mono)" fontSize="6" fill="var(--ink-4)" letterSpacing="2">▓▓▓▓▓▓</text></g>))}
    <text x="14" y="298" fontFamily="var(--mono)" fontSize="6.5" fill="var(--ink-4)" letterSpacing="1.5" fontStyle="italic" opacity="0.75">✱ don't take the river road past sundown</text>
    {npcMode && (<><circle cx="170" cy="172" r="1.4" fill="var(--accent)" /><circle cx="170" cy="172" r="3" fill="var(--accent)" opacity="0.3" /></>)}
  </SalvageBacking>
);

const ApocRegion = ({ npcMode }) => (
  <SalvageBacking>
    <text x="14" y="22" fontFamily="var(--mono)" fontSize="11" fill="var(--accent)" letterSpacing="3" fontWeight="700">IRON MARK BASIN</text>
    <text x="14" y="34" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-4)" letterSpacing="2.5">WALK ROUTE // 4 STOPS</text>
    <g stroke="var(--accent)" strokeWidth="1.0" fill="none" strokeDasharray="0.6 3" strokeLinecap="round" opacity="0.85">
      <path d="M 160 178 Q 130 200 100 215" /><path d="M 160 178 Q 200 155 230 130" />
      <path d="M 160 178 Q 180 222 200 270" /><path d="M 100 215 Q 75 240 70 268" />
    </g>
    <circle cx="160" cy="178" r="26" fill="url(#ap-glow)" />
    <g transform="translate(160 178)">
      <circle r="8" fill="none" stroke="var(--accent)" strokeWidth="0.8" className="ew-pulse" style={{ transformOrigin: "center" }} />
      <path d="M -4 -4 L 4 4 M -4 4 L 4 -4" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
      <text y="20" textAnchor="middle" fontFamily="var(--mono)" fontSize="8.5" fill="var(--accent)" letterSpacing="1" fontWeight="700">OATHSTONE FORK</text>
    </g>
    {[{x:100,y:215,name:"MARKED REST",sub:"BAR // BEDS"},{x:230,y:130,name:"KETHYR DUMP",sub:"SCRAP // HOT",danger:true},{x:200,y:270,name:"BELLHAVEN",sub:"WALLED"},{x:70,y:268,name:"WAYSHRINE",sub:"OLD GODS"}].map(s => (
      <g key={s.name} transform={`translate(${s.x} ${s.y})`}>
        <path d="M -3.5 -3.5 L 3.5 3.5 M -3.5 3.5 L 3.5 -3.5" stroke={s.danger ? "var(--hl-fail)" : "var(--accent)"} strokeWidth="1.2" strokeLinecap="round" />
        <text y="14" textAnchor="middle" fontFamily="var(--mono)" fontSize="7.5" fill={s.danger ? "var(--hl-fail)" : "var(--ink-1)"} letterSpacing="1" fontWeight="600">{s.name}</text>
        <text y="22" textAnchor="middle" fontFamily="var(--mono)" fontSize="6" fill="var(--ink-4)" letterSpacing="1.5">{s.sub}</text>
      </g>
    ))}
    {npcMode && (<><g transform="translate(102 213)"><circle r="1.4" fill="var(--accent)" /><circle r="3" fill="var(--accent)" opacity="0.3" /></g></>)}
  </SalvageBacking>
);

const ApocLocal = ({ npcMode }) => {
  const buildings = [
    {id:"inn",x:160,y:175,label:"MARKED REST",current:true,visited:true},
    {id:"frg",x:230,y:165,label:"TIN SHOP",visited:true},
    {id:"mkt",x:155,y:100,label:"TRADE CIRCLE",visited:true},
    {id:"ldg",x:235,y:230,label:"BUNKHOUSE",visited:true},
    {id:"shr",x:80,y:170,label:"OLD ALTAR",visited:false},
    {id:"gld",x:75,y:100,label:"MAYOR'S TENT",visited:false},
    {id:"stb",x:240,y:95,label:"STABLES",visited:false},
    {id:"wll",x:110,y:240,label:"WELL",visited:true},
  ];
  return (
    <SalvageBacking>
      <text x="14" y="22" fontFamily="var(--mono)" fontSize="11" fill="var(--accent)" letterSpacing="3" fontWeight="700">OATHSTONE FORK</text>
      <text x="14" y="34" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-4)" letterSpacing="2.5">CAMP MAP // 5 OF 8 KNOWN</text>
      <path d="M 38 60 L 290 62 L 292 286 L 36 284 Z" fill="none" stroke="var(--accent)" strokeWidth="1.0" strokeDasharray="6 2" opacity="0.7" />
      <g stroke="var(--accent)" strokeWidth="0.7" fill="none" strokeDasharray="0.4 2.5" strokeLinecap="round" opacity="0.7">
        {buildings.filter(b => !b.current).map(b => (<path key={b.id} d={`M 160 175 L ${b.x} ${b.y}`} opacity={b.visited ? 0.85 : 0.4} />))}
      </g>
      <circle cx="160" cy="175" r="22" fill="url(#ap-glow)" />
      {buildings.map(b => (
        <g key={b.id} transform={`translate(${b.x} ${b.y})`}>
          {b.current && (<circle r="11" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="2 2" className="ew-pulse" style={{ transformOrigin: "center" }} />)}
          <path d="M -5 4 L -5 -2 L -2 -5 L 5 -2 L 5 4 Z" fill={b.current ? "rgba(234,88,12,0.20)" : "rgba(15,12,8,0.85)"} stroke={b.current ? "var(--accent)" : (b.visited ? "var(--accent)" : "var(--ink-4)")} strokeWidth={b.current ? 1.2 : 0.7} strokeDasharray={b.visited || b.current ? undefined : "1.5 1.5"} />
          <text y="16" textAnchor="middle" fontFamily="var(--mono)" fontSize="7" fill={b.current ? "var(--accent)" : (b.visited ? "var(--ink-1)" : "var(--ink-4)")} letterSpacing="1" fontWeight={b.current ? 700 : 500}>{b.label}</text>
        </g>
      ))}
      <text x="160" y="153" textAnchor="middle" fontFamily="var(--mono)" fontSize="6.5" fill="var(--accent)" letterSpacing="2" fontWeight="700">★ HERE ★</text>
      {npcMode && (<><g transform="translate(150 173)"><circle r="1.5" fill="var(--accent)" /><circle r="3" fill="var(--accent)" opacity="0.3" /></g></>)}
    </SalvageBacking>
  );
};

// ============================================================
// HORROR — Lovecraftian
// ============================================================
const HorrorWorld = ({ npcMode }) => (
  <BlackInkBacking>
    <text x="14" y="22" fontFamily="var(--serif)" fontStyle="italic" fontSize="14" fill="var(--accent)" letterSpacing="2">The Pale Country</text>
    <text x="14" y="34" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-4)" letterSpacing="2.5">4 PLACES NAMED · 3 NAMED ONLY IN WHISPERS</text>
    <g stroke="var(--accent)" strokeWidth="0.6" fill="none" opacity="0.55">
      <path d="M 160 175 L 138 145 L 100 100" strokeDasharray="3 1.5" />
      <path d="M 160 175 L 188 152 L 240 130" strokeDasharray="3 1.5" />
      <path d="M 160 175 L 178 218 L 210 252" strokeDasharray="3 1.5" />
      <path d="M 160 175 L 110 198 L 80 220" strokeDasharray="3 1.5" />
    </g>
    <g transform="translate(160 175)" opacity="0.85">
      <circle r="30" fill="url(#ho-glow)" />
      <circle r="22" fill="none" stroke="var(--accent)" strokeWidth="0.4" strokeDasharray="1 2" />
      <circle r="14" fill="none" stroke="var(--accent)" strokeWidth="0.4" />
      <path d="M 0 -10 L 9 7 L -9 7 Z" fill="none" stroke="var(--accent)" strokeWidth="0.7" />
      <ellipse rx="5" ry="2.4" fill="none" stroke="var(--accent)" strokeWidth="0.7" />
      <circle r="1.2" fill="var(--accent)" />
      <circle r="6" fill="none" stroke="var(--accent)" strokeWidth="0.6" className="ew-pulse" style={{ transformOrigin: "center" }} />
      <text y="-30" textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="11" fill="var(--accent)" letterSpacing="2">— here —</text>
      <text y="40" textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="13" fill="var(--accent)" letterSpacing="1.2" fontWeight="500">Oathstone Cross</text>
    </g>
    {[{x:100,y:100,name:"Kethyr Reach",sub:"burnt parish"},{x:240,y:130,name:"Bellhaven",sub:"the white town"},{x:210,y:252,name:"Shard's Hollow",sub:"where it sings"},{x:80,y:220,name:"Verdant Mire",sub:"do not drink"}].map(s => (
      <g key={s.name} transform={`translate(${s.x} ${s.y})`}>
        <path d="M 0 -5 L 0 4 M -2 -3 L 2 -3" stroke="var(--accent)" strokeWidth="1.0" strokeLinecap="round" />
        <text y="14" textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="10.5" fill="var(--ink-1)" letterSpacing="0.8">{s.name}</text>
        <text y="24" textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="8" fill="var(--ink-4)" letterSpacing="0.6">{s.sub}</text>
      </g>
    ))}
    <text x="14" y="300" fontFamily="var(--serif)" fontStyle="italic" fontSize="9.5" fill="var(--ink-4)" opacity="0.75" letterSpacing="0.4">the eye opens at the dark of the moon</text>
    {npcMode && (<><circle cx="170" cy="172" r="1.4" fill="var(--accent)" /><circle cx="170" cy="172" r="3" fill="var(--accent)" opacity="0.3" /></>)}
  </BlackInkBacking>
);

const HorrorRegion = ({ npcMode }) => (
  <BlackInkBacking>
    <text x="14" y="22" fontFamily="var(--serif)" fontStyle="italic" fontSize="14" fill="var(--accent)" letterSpacing="2">The Iron Mark</text>
    <text x="14" y="34" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-4)" letterSpacing="2.5">4 PARISHES · 1 LEFT UNFINISHED</text>
    <g stroke="var(--accent)" strokeWidth="0.6" fill="none" opacity="0.65">
      <path d="M 160 178 C 140 195 120 205 100 215" />
      <path d="M 160 178 C 190 165 210 150 230 130" />
      <path d="M 160 178 C 175 215 188 240 200 270" />
      <path d="M 100 215 C 90 235 80 250 70 268" strokeDasharray="2 2" />
    </g>
    <circle cx="160" cy="178" r="26" fill="url(#ho-glow)" />
    <g transform="translate(160 178)">
      <circle r="14" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="1 2" />
      <circle r="8" fill="none" stroke="var(--accent)" strokeWidth="0.6" className="ew-pulse" style={{ transformOrigin: "center" }} />
      <ellipse rx="5" ry="2.2" fill="none" stroke="var(--accent)" strokeWidth="0.7" />
      <circle r="1.2" fill="var(--accent)" />
      <text y="20" textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="12" fill="var(--accent)" letterSpacing="1.2">Oathstone Cross</text>
    </g>
    {[{x:100,y:215,name:"Marked Rest",sub:"an inn that listens"},{x:230,y:130,name:"Kethyr Reach",sub:"burnt parish"},{x:200,y:270,name:"Bellhaven",sub:"the white town"},{x:70,y:268,name:"the Wayshrine",sub:"do not pray here"}].map(s => (
      <g key={s.name} transform={`translate(${s.x} ${s.y})`}>
        <path d="M 0 -5 L 0 4 M -2 -3 L 2 -3" stroke="var(--accent)" strokeWidth="1.0" strokeLinecap="round" />
        <text y="14" textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="10.5" fill="var(--ink-1)" letterSpacing="0.8">{s.name}</text>
        <text y="24" textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="8" fill="var(--ink-4)" letterSpacing="0.6">{s.sub}</text>
      </g>
    ))}
    {npcMode && (<><g transform="translate(102 213)"><circle r="1.4" fill="var(--accent)" /><circle r="3" fill="var(--accent)" opacity="0.3" /></g></>)}
  </BlackInkBacking>
);

const HorrorLocal = ({ npcMode }) => {
  const rooms = [
    {id:"inn",x:160,y:175,label:"the common room",current:true,visited:true},
    {id:"frg",x:230,y:165,label:"the smith",visited:true},
    {id:"mkt",x:155,y:100,label:"the chapel",visited:true},
    {id:"ldg",x:235,y:230,label:"the lodging",visited:true},
    {id:"shr",x:80,y:170,label:"the shrine",visited:false},
    {id:"gld",x:75,y:100,label:"the warden",visited:false},
    {id:"stb",x:240,y:95,label:"the stables",visited:false},
    {id:"wll",x:110,y:240,label:"the well",visited:true},
  ];
  return (
    <BlackInkBacking>
      <text x="14" y="22" fontFamily="var(--serif)" fontStyle="italic" fontSize="14" fill="var(--accent)" letterSpacing="2">Oathstone Cross</text>
      <text x="14" y="34" fontFamily="var(--mono)" fontSize="7" fill="var(--ink-4)" letterSpacing="2.5">5 OF 8 ROOMS WALKED</text>
      <path d="M 40 62 L 288 60 L 292 286 L 38 284 Z" fill="none" stroke="var(--accent)" strokeWidth="0.7" strokeDasharray="2 3" opacity="0.55" />
      <g stroke="var(--accent)" strokeWidth="0.6" fill="none" opacity="0.55">
        {rooms.filter(r => !r.current).map(r => (<path key={r.id} d={`M 160 175 Q ${(160+r.x)/2+4} ${(175+r.y)/2-6} ${r.x} ${r.y}`} strokeDasharray={r.visited ? undefined : "2 2"} opacity={r.visited ? 0.85 : 0.4} />))}
      </g>
      <circle cx="160" cy="175" r="22" fill="url(#ho-glow)" />
      {rooms.map(r => (
        <g key={r.id} transform={`translate(${r.x} ${r.y})`}>
          {r.current && (<circle r="11" fill="none" stroke="var(--accent)" strokeWidth="0.5" strokeDasharray="1 2" className="ew-pulse" style={{ transformOrigin: "center" }} />)}
          <path d="M 0 -5 L 0 4 M -2 -3 L 2 -3" stroke={r.current ? "var(--accent)" : (r.visited ? "var(--accent)" : "var(--ink-4)")} strokeWidth={r.current ? 1.4 : (r.visited ? 1.0 : 0.7)} strokeLinecap="round" strokeDasharray={r.visited || r.current ? undefined : "1.2 1.2"} />
          <text y="16" textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="9.5" fill={r.current ? "var(--accent)" : (r.visited ? "var(--ink-1)" : "var(--ink-4)")} letterSpacing="0.6" fontWeight={r.current ? 600 : 400}>{r.label}</text>
        </g>
      ))}
      <text x="160" y="153" textAnchor="middle" fontFamily="var(--serif)" fontStyle="italic" fontSize="9.5" fill="var(--accent)" letterSpacing="1.2">— you stand here —</text>
      {npcMode && (<><g transform="translate(150 173)"><circle r="1.5" fill="var(--accent)" /><circle r="3" fill="var(--accent)" opacity="0.3" /></g></>)}
    </BlackInkBacking>
  );
};

// Export to window for dispatcher in map-v2.jsx
window.SpaceWorld = SpaceWorld;
window.SpaceRegion = SpaceRegion;
window.SpaceLocal = SpaceLocal;
window.ApocWorld = ApocWorld;
window.ApocRegion = ApocRegion;
window.ApocLocal = ApocLocal;
window.HorrorWorld = HorrorWorld;
window.HorrorRegion = HorrorRegion;
window.HorrorLocal = HorrorLocal;
