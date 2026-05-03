"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const MAX_LENGTH = 500;
const MAX_HISTORY = 20;

interface InputBarProps {
  onSubmit: (input: string) => void;
  disabled?: boolean;
  processingStep?: string | null;
}

export function InputBar({
  onSubmit,
  disabled = false,
  processingStep = null,
}: InputBarProps) {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [draft, setDraft] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const wasDisabled = useRef(false);

  const remaining = MAX_LENGTH - value.length;

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
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          maxLength={MAX_LENGTH}
          placeholder="What do you do?"
          className="min-w-0 flex-1 rounded-sm bg-black px-3 py-2 font-mono text-sm transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            border: "1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)",
            color: "var(--color-text)",
            caretColor: "var(--color-primary)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-primary)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor =
              "color-mix(in srgb, var(--color-primary) 35%, transparent)";
          }}
        />
        <Button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="shrink-0 px-4 font-mono font-bold disabled:opacity-40"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "#000",
          }}
        >
          Act
        </Button>
      </div>

      {/* Character counter */}
      <div className="mt-1 flex justify-end">
        <span
          className="font-mono text-[10px]"
          style={{ color: remaining <= 50 ? "#ef4444" : "var(--color-muted)" }}
        >
          {remaining}
        </span>
      </div>
    </div>
  );
}
