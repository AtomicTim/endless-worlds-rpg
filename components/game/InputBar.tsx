"use client";

import { type KeyboardEvent, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const MAX_LENGTH = 500;
const MAX_HISTORY = 20;

export interface InputBarHandle {
  focus: () => void;
}

interface InputBarProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
  processingStep?: string | null;
}

export const InputBar = forwardRef<InputBarHandle, InputBarProps>(function InputBar({
  onSubmit,
  disabled = false,
  processingStep = null,
}: InputBarProps, ref) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [draft, setDraft] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const wasDisabled = useRef(false);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  const remaining = MAX_LENGTH - value.length;

  // Dialogue mode: input begins with a quote character.
  const dialogueMode = /^["'“‘]/.test(value);

  // Re-focus the input when transitioning from disabled (processing) → enabled.
  useEffect(() => {
    if (wasDisabled.current && !disabled) {
      inputRef.current?.focus();
    }
    wasDisabled.current = disabled;
  }, [disabled]);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    onSubmit(trimmed);
    setHistory((prev) => [trimmed, ...prev].slice(0, MAX_HISTORY));
    // Clear immediately on submit so the field is empty during processing.
    setValue("");
    setHistoryIndex(-1);
    setDraft("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      if (historyIndex === -1) {
        setDraft(value);
        setHistoryIndex(0);
        setValue(history[0]);
      } else if (historyIndex < history.length - 1) {
        const next = historyIndex + 1;
        setHistoryIndex(next);
        setValue(history[next]);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      if (historyIndex === 0) {
        setHistoryIndex(-1);
        setValue(draft);
      } else {
        const prev = historyIndex - 1;
        setHistoryIndex(prev);
        setValue(history[prev]);
      }
      return;
    }
  }

  return (
    <div
      className="shrink-0 p-3"
      style={{ borderTop: "1px solid var(--color-border)", backgroundColor: "var(--color-bg)" }}
    >
      {/* Processing step indicator — reserved height so layout doesn't shift */}
      <div className="mb-1.5 h-4 px-1">
        {disabled && processingStep && (
          <span
            className="font-mono text-[11px] italic"
            style={{ color: "var(--color-muted)" }}
          >
            <span className="cursor-blink mr-1.5" style={{ color: "var(--color-primary)" }}>
              ▍
            </span>
            {processingStep}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            maxLength={MAX_LENGTH}
            // Navigation redesign — placeholder reflects what text input
            // actually does now: action verbs only. Movement is UI-driven
            // via the NavigationBar / map / highlighted location links.
            placeholder="Talk, examine, or take action..."
            // Navigation redesign — 16px font on mobile prevents iOS Safari
            // from auto-zooming on focus. minHeight 52px hits the
            // touch-target floor without disturbing desktop visuals.
            className="w-full rounded-sm bg-black pl-3 pr-8 font-mono transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              border: dialogueMode
                ? "1px solid var(--color-accent)"
                : "1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)",
              color:      "var(--color-text)",
              caretColor: dialogueMode ? "var(--color-accent)" : "var(--color-primary)",
              fontSize:   16,
              minHeight:  52,
              paddingTop:    10,
              paddingBottom: 10,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = dialogueMode
                ? "var(--color-accent)"
                : "var(--color-primary)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = dialogueMode
                ? "var(--color-accent)"
                : "color-mix(in srgb, var(--color-primary) 35%, transparent)";
            }}
          />
          {/* Mode indicator — speech bubble in dialogue mode, default chevron otherwise */}
          <span
            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm leading-none"
            style={{ color: dialogueMode ? "var(--color-accent)" : "var(--color-muted)" }}
            aria-hidden
          >
            {dialogueMode ? "💬" : "›"}
          </span>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="shrink-0 px-4 font-mono font-bold disabled:opacity-40"
          // Match the input's 52px height so the bottom row aligns
          // cleanly on mobile and gives a comfortable tap target.
          style={{
            backgroundColor: dialogueMode ? "var(--color-accent)" : "var(--color-primary)",
            color: "#000",
            minHeight: 52,
          }}
        >
          {dialogueMode ? "Speak" : "Act"}
        </Button>
      </div>

      {/* Hint + character counter */}
      <div className="mt-1 flex items-center justify-between gap-2">
        <span
          className="font-mono text-[10px] italic"
          style={{ color: dialogueMode ? "var(--color-accent)" : "var(--color-muted)" }}
        >
          {dialogueMode
            ? "Speech mode — your line goes to nearby characters"
            : 'Tip: Use "quotes" to speak to nearby characters'}
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: remaining <= 50 ? "#ef4444" : "var(--color-muted)" }}
        >
          {remaining}
        </span>
      </div>
    </div>
  );
});
