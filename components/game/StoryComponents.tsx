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
  return (
    <p
      className="ew-serif"
      style={{
        fontSize:   15,
        lineHeight: 1.85,
        color:      "var(--ink-3)",
        margin:     "12px 0",
        maxWidth:   640,
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
  return (
    <div className="ew-divider" style={{ maxWidth: 640 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M 5 0 L 10 5 L 5 10 L 0 5 Z" fill="currentColor" />
        </svg>
        {label}
      </span>
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
    <div style={{ margin: "16px 0", maxWidth: 640 }}>
      <div
        className="ew-mono"
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
        className="ew-serif"
        style={{
          fontSize:    15,
          lineHeight:  1.85,
          color:       "var(--ink-2)",
          borderLeft:  `2px solid ${color}`,
          paddingLeft: 14,
          opacity:     0.95,
        }}
      >
        {wrapQuotes(children)}
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
      <span className="ew-serif" style={{ fontStyle: "italic" }}>
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
