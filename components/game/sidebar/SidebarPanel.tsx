"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface SidebarPanelProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}

function readStorage(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const val = localStorage.getItem(key);
  return val !== null ? val === "true" : fallback;
}

export function SidebarPanel({
  id,
  title,
  icon,
  defaultCollapsed = false,
  children,
}: SidebarPanelProps) {
  const storageKey = `sidebar-panel-${id}`;

  const [collapsed, setCollapsed] = useState<boolean>(() =>
    readStorage(storageKey, defaultCollapsed)
  );

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(storageKey, String(next));
      }
      return next;
    });
  }

  return (
    <div style={{ borderBottom: "1px solid var(--color-border)" }}>
      {/* Header / toggle button */}
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--color-primary)" }}>{icon}</span>
          <span
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "var(--color-muted)" }}
          >
            {title}
          </span>
        </div>
        {collapsed ? (
          <ChevronDown className="size-3" style={{ color: "var(--color-muted)" }} />
        ) : (
          <ChevronUp className="size-3" style={{ color: "var(--color-muted)" }} />
        )}
      </button>

      {/* Collapsible body — CSS max-height transition */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: collapsed ? "0px" : "1200px" }}
      >
        <div className="px-3 pb-3 pt-1">{children}</div>
      </div>
    </div>
  );
}
