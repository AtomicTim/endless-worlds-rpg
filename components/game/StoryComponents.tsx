"use client";

import React from "react";

/**
 * Inline story-feed components — ported from /design/ui-pieces.jsx.
 *
 * The design uses serif body prose (Cormorant Garamond) with mono
 * highlight chips and a custom .ew-said wrapper for direct character
 * speech ("...") inside narrative paragraphs. wrapQuotes walks any
 * React child tree and wraps quoted runs in <Said /> spans automatically.
 */

// ── Quote wrapping ──────────────────────────────────────────────────────────

const OPENERS = ['"', "“"];
const CLOSERS = ['"', "”"];
const isOpener = (c: string) => OPENERS.includes(c);
const isCloser = (c: string) => CLOSERS.includes(c);

interface WrapStringResult {
  nodes: React.ReactNode;
  inside: boolean;
}

function wrapQuoteString(text: string, startInside: boolean): WrapStringResult {
  const out: React.ReactNode[] = [];
  let buf = "";
  let inside = startInside;
  let key = 0;
  const flush = () => {
    if (!buf) return;
    if (inside) {
      out.push(<span key={key++} className="ew-said">{buf}</span>);
    } else {
      out.push(buf);
    }
    buf = "";
  };
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (!inside && isOpener(c)) {
      flush();
      inside = true;
      buf += c;
    } else if (inside && isCloser(c)) {
      buf += c;
      flush();
      inside = false;
    } else {
      buf += c;
    }
  }
  flush();
  return { nodes: out.length === 1 ? out[0] : out, inside };
}

/**
 * Walk a React child tree, splitting text nodes around quote characters
 * and wrapping the inside-quote runs with .ew-said. Existing elements
 * already styled as ew-said are skipped (idempotent). Honors a
 * data-said-skip attribute so callers can opt out for sub-trees.
 */
export function wrapQuotes(root: React.ReactNode): React.ReactNode {
  let inside = false;
  let key = 0;

  const walk = (node: React.ReactNode): React.ReactNode => {
    if (node === null || node === undefined || typeof node === "boolean") return node;

    if (typeof node === "string") {
      const { nodes, inside: next } = wrapQuoteString(node, inside);
      inside = next;
      return nodes;
    }

    if (typeof node === "number") return node;

    if (Array.isArray(node)) {
      return node.map((c) => (
        <React.Fragment key={key++}>{walk(c)}</React.Fragment>
      ));
    }

    if (React.isValidElement(node)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props = node.props as any;
      if (
        (typeof props?.className === "string" && props.className.includes("ew-said")) ||
        props?.["data-said-skip"]
      ) {
        return node;
      }
      const children = props?.children;
      if (children === undefined) {
        return inside
          ? <span key={key++} className="ew-said">{node}</span>
          : node;
      }
      return React.cloneElement(node, { key: key++ }, walk(children));
    }

    return node;
  };

  return walk(root);
}

// ── Said wrapper ────────────────────────────────────────────────────────────

export function Said({ children }: { children: React.ReactNode }) {
  return <span className="ew-said">{children}</span>;
}

// ── PR-7v-f — Mixed prose / spoken text parsing for NPCSpeech ──────────────
//
// NPC dialogue messages routinely mix narrative prose with quoted
// speech in the same content string, e.g.:
//   `Maise Redmark looks up. "What do you want?" She sets down a token.`
// The PR-7v-e --hl-said cream coloured the whole thing equally; this
// pair of helpers splits the string on quote boundaries so prose and
// speech can pick up their own colour + weight.
//
// extractText() walks a React node tree and concatenates the raw
// string content. The NPCSpeech caller in StoryFeed pre-wraps the
// dialogue content via wrapQuotes() (a legacy idempotent traversal),
// so by the time NPCSpeech receives `children` we already have a
// tree, not a string. Re-flattening to the raw string lets the new
// parseSpokenText() do its own clean split — the wrapQuotes pass
// becomes a no-op for the dialogue path.

function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement(node)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props = node.props as any;
    return extractText(props?.children);
  }
  return "";
}

// Splits text into alternating prose / speech segments. The split
// regex captures BOTH straight-quote (".+") and curly-quote (".+")
// pairs as a single segment per the brief; mixed-quote pairs (e.g.
// straight-open + curly-close) fall through as prose, which matches
// the rare edge case behaviour we want (don't over-claim a colour
// without clear quote pairing).
//
// segments[0], [2], [4]…  → prose
// segments[1], [3], [5]…  → quoted speech (quote chars included)
function parseSpokenText(text: string): React.ReactNode[] {
  const segments = text.split(/(“[^”]*”|"[^"]*")/g);
  return segments
    .map((seg, i) => {
      if (!seg) return null;
      const isSpoken = i % 2 === 1;
      return (
        <span
          key={i}
          style={{
            color:      isSpoken ? "var(--hl-said)" : "var(--ui-text-prose)",
            fontWeight: isSpoken ? 600 : 400,
          }}
        >
          {seg}
        </span>
      );
    })
    .filter(Boolean);
}

// ── Inline highlight spans ──────────────────────────────────────────────────
//
// Each one: matches the design's role classes and supports an optional
// onClick so the StoryFeed can wire them up to navigateTo / submitAction
// without the spans needing to know about the game loop.

interface SpanProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export function LocationSpan({ children, ...rest }: SpanProps) {
  return <span {...rest} className="ew-link-loc" data-said-skip>{children}</span>;
}
/**
 * FIX 1 — region-tier locations (e.g. "The Drift Barrens") render
 * through their own span class so the player can tell at a glance
 * whether a highlighted name is a Tier 2 region or a Tier 3
 * settlement / sub-location. Lavender (--hl-region) reads as
 * "wider area"; sky-blue (--hl-loc) reads as "specific place".
 */
export function RegionSpan({ children, ...rest }: SpanProps) {
  return <span {...rest} className="ew-link-region" data-said-skip>{children}</span>;
}
export function NpcSpan({ children, ...rest }: SpanProps) {
  return <span {...rest} className="ew-link-npc" data-said-skip>{children}</span>;
}
export function ItemSpan({ children, ...rest }: SpanProps) {
  return <span {...rest} className="ew-link-item" data-said-skip>{children}</span>;
}
export function LandmarkSpan({ children, ...rest }: SpanProps) {
  return <span {...rest} className="ew-link-landmark" data-said-skip>{children}</span>;
}

// ── Block-level components ──────────────────────────────────────────────────

interface NarrativeBlockProps {
  children: React.ReactNode;
  /** Skip quote wrapping when the caller has already split the content
   *  into highlight spans + plain runs (the StoryFeed path). */
  skipQuoteWrap?: boolean;
}

export function NarrativeBlock({ children, skipQuoteWrap }: NarrativeBlockProps) {
  // UI-4 — Story Panel typography (design ref §2 / §5):
  //   Cormorant Garamond italic · 14px mobile, 15px md+ · line-height
  //   1.82 · colour #c0a878 (story prose — distinct from --ink-3).
  return (
    <p
      className="ew-serif text-[16px] md:text-[17px]"
      style={{
        lineHeight: 1.82,
        color:      "var(--ui-text-prose)",
        margin:     "12px 0",
      }}
    >
      {skipQuoteWrap ? children : wrapQuotes(children)}
    </p>
  );
}

interface SceneDividerProps {
  label: React.ReactNode;
}

export function SceneDivider({ label }: SceneDividerProps) {
  // Fix 6 — full-width flex container with the label centered between
  // the two ::before / ::after rule lines that .ew-divider draws. The
  // explicit width:100% + justifyContent:center overrides the prior
  // maxWidth:640 that left the divider hugging the left edge.
  return (
    <div
      className="ew-divider"
      style={{
        width:          "100%",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        textAlign:      "center",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M 5 0 L 10 5 L 5 10 L 0 5 Z" fill="currentColor" />
        </svg>
        {label}
      </span>
    </div>
  );
}

// ── SceneArrival ────────────────────────────────────────────────────────────
//
// UI-4 — multi-line arrival header. Replaces the single-line SceneDivider
// for arrival NARRATIVE messages (design ref §5). Layout, top to bottom:
//   1. thin horizontal rule       1px #2d2618
//   2. ◆ + type label             Inter Tight 7px uppercase #6a5530
//   3. location name              Cormorant Garamond italic 13px #e2cda0
//   4. region sub-label           Inter Tight 7px #4a3818
//   5. thin horizontal rule       1px #2d2618
// Missing type / region rows skip; rules + name always render.

export interface SceneArrivalProps {
  name:       string;
  typeLabel?: string;
  region?:    string;
}

export function SceneArrival({ name, typeLabel, region }: SceneArrivalProps) {
  return (
    <div
      className="message-enter"
      style={{ margin: "18px 0 10px", textAlign: "center" }}
    >
      <div style={{ height: 1, background: "var(--ui-border-default)" }} aria-hidden />
      <div
        className="ew-sans uppercase"
        style={{
          marginTop:     8,
          fontSize:      7,
          letterSpacing: "0.14em",
          color:         "var(--ui-text-muted)",
        }}
      >
        ◆ {(typeLabel ?? "Location").toUpperCase()}
      </div>
      <div
        className="ew-serif"
        style={{
          marginTop: 4,
          fontSize:  13,
          color:     "var(--ui-text-1)",
        }}
      >
        {name}
      </div>
      {region && (
        <div
          className="ew-sans"
          style={{
            marginTop:     2,
            fontSize:      7,
            letterSpacing: "0.10em",
            color:         "var(--nav-breadcrumb)",
          }}
        >
          {region}
        </div>
      )}
      <div
        style={{ marginTop: 8, height: 1, background: "var(--ui-border-default)" }}
        aria-hidden
      />
    </div>
  );
}

interface NPCSpeechProps {
  name: string;
  color?: string;
  children: React.ReactNode;
}

export function NPCSpeech({ name, color = "var(--accent)", children }: NPCSpeechProps) {
  return (
    <div style={{ margin: "16px 0" }}>
      <div
        // UI-fix-A — NPC name header is UI chrome, not a numeric
        // value: switch from ew-mono to ew-sans (Inter Tight) per
        // the three-font rule. Roll annotations (StatPill below)
        // remain ew-mono — those *are* numeric.
        className="ew-sans"
        style={{
          color,
          fontSize:      10,
          letterSpacing: "0.2em",
          marginBottom:  6,
          display:       "flex",
          alignItems:    "center",
          gap:           8,
        }}
      >
        <span
          style={{
            width:        6,
            height:       6,
            borderRadius: "50%",
            background:   color,
            boxShadow:    `0 0 0 2px var(--bg-0), 0 0 0 3px ${color}`,
          }}
        />
        {name.toUpperCase()}
      </div>
      <div
        // PR-7v-f — NPC speech body now splits prose vs spoken text:
        // the outer div defaults to var(--ui-text-prose) weight 400 so
        // prose around the quotes reads as narration, and the inline
        // parseSpokenText spans override per-segment to var(--hl-said)
        // weight 600 inside quoted runs. The legacy wrapQuotes() pass
        // the caller still runs becomes a no-op for this code path —
        // extractText() flattens its output back to a raw string before
        // parseSpokenText() does its own clean split. Cormorant
        // Garamond italic + 13/1.82 layout untouched.
        className="ew-serif"
        style={{
          fontSize:    13,
          lineHeight:  1.82,
          color:       "var(--ui-text-prose)",
          fontWeight:  400,
          borderLeft:  `2px solid ${color}`,
          paddingLeft: 14,
        }}
      >
        {parseSpokenText(extractText(children))}
      </div>
    </div>
  );
}

// ── StatPill ────────────────────────────────────────────────────────────────

interface StatPillProps {
  stat:        string;
  total:       number;
  dc:          number;
  pass:        boolean;
  /** Italic descriptor phrase rendered before the mono roll annotation. */
  descriptor?: React.ReactNode;
  children?:   React.ReactNode;
}

export function StatPill({ stat, total, dc, pass, descriptor, children }: StatPillProps) {
  const color = pass ? "var(--hl-pass)" : "var(--hl-fail)";
  return (
    <span
      style={{
        display:    "inline",
        background: pass ? "rgba(163,230,53,0.08)" : "rgba(248,113,113,0.08)",
        padding:    "1px 6px",
        borderRadius: 2,
        color:      "var(--ink-1)",
      }}
    >
      <span className="ew-serif">
        {descriptor || children || `${stat} check`}
      </span>
      <span
        className="ew-mono"
        style={{
          fontSize:      9,
          letterSpacing: "0.18em",
          marginLeft:    6,
          color,
          verticalAlign: "1px",
          fontWeight:    600,
        }}
      >
        {stat.toUpperCase()} {total}
        <span style={{ color: "var(--ink-5)" }}>/</span>
        {dc}
      </span>
    </span>
  );
}
