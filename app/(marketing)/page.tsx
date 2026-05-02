export default function MarketingHomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background">
      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(rgba(245,158,11,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.15) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 px-4 text-center">
        {/* ASCII logo */}
        <pre className="ascii-art text-amber-400 text-glow-amber select-none hidden sm:block">
          {`╔═══════════════════════════════════════════╗
║                                           ║
║    ███████╗███╗   ██╗██████╗ ██╗     ███████╗███████╗  ║
║    ██╔════╝████╗  ██║██╔══██╗██║     ██╔════╝██╔════╝  ║
║    █████╗  ██╔██╗ ██║██║  ██║██║     █████╗  ███████╗  ║
║    ██╔══╝  ██║╚██╗██║██║  ██║██║     ██╔══╝  ╚════██║  ║
║    ███████╗██║ ╚████║██████╔╝███████╗███████╗███████║  ║
║    ╚══════╝╚═╝  ╚═══╝╚═════╝ ╚══════╝╚══════╝╚══════╝  ║
║                                           ║
║              W O R L D S   R P G         ║
║                                           ║
╚═══════════════════════════════════════════╝`}
        </pre>

        {/* Mobile title */}
        <div className="sm:hidden">
          <h1 className="text-4xl font-bold tracking-widest text-amber-400 text-glow-amber font-mono">
            ENDLESS WORLDS
          </h1>
          <p className="text-lg text-amber-600 font-mono tracking-widest mt-1">R P G</p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="text-xl text-amber-400/80 font-mono tracking-wider">
            — Coming Soon —
          </p>
          <p className="max-w-md text-muted-foreground font-mono text-sm leading-relaxed">
            A genre-agnostic AI-driven RPG engine. Choose your world — Fantasy,
            Cyberpunk, Noir, or Space Opera — and let the story unfold.
          </p>
        </div>

        {/* Genre badges */}
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {[
            { label: "Fantasy", color: "text-amber-400 border-amber-400/30 bg-amber-400/5" },
            { label: "Cyberpunk", color: "text-sky-400 border-sky-400/30 bg-sky-400/5" },
            { label: "Noir", color: "text-yellow-700 border-yellow-700/30 bg-yellow-700/5" },
            { label: "Space Opera", color: "text-purple-400 border-purple-400/30 bg-purple-400/5" },
          ].map(({ label, color }) => (
            <span
              key={label}
              className={`px-3 py-1 rounded border font-mono text-xs tracking-widest ${color}`}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mt-4">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Day 1 — Scaffold initialized</span>
        </div>
      </div>
    </main>
  );
}
