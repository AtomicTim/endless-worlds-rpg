import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // RPG genre-specific palette tokens
        rpg: {
          amber: "#F59E0B",
          "amber-dim": "#78450A",
          green: "#10B981",
          "neon-blue": "#38BDF8",
          magenta: "#E879F9",
          sepia: "#A16207",
          purple: "#A855F7",
          silver: "#CBD5E1",
          "bg-dark": "#050508",
          "bg-card": "#0D0D14",
          "bg-panel": "#13131E",
          border: "#1E1E2E",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        // UI-fix-A — Tailwind's `font-mono` utility now resolves to
        // JetBrains Mono so any class-based mono usage matches the
        // var(--mono) token in globals.css. Courier is reserved for
        // the genre-specific .font-terminal escape hatch (Cyberpunk
        // UI labels per design ref §3) — never bleeds into Fantasy
        // game prose. Three-font rule: serif prose · sans UI chrome
        // · mono numbers (design ref §2 Typography).
        mono:  ["'JetBrains Mono'", "ui-monospace", "monospace"],
        serif: ["'Cormorant Garamond'", "Georgia", "serif"],
        sans:  ["'Inter Tight'", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
