"use client";

import { Package } from "lucide-react";
import { SidebarPanel } from "./SidebarPanel";

const GRID_SLOTS = 16; // 4 × 4

export function InventoryPanel() {
  return (
    <SidebarPanel
      id="inventory"
      title="Inventory"
      icon={<Package className="size-3" />}
      defaultCollapsed={false}
    >
      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: GRID_SLOTS }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-sm transition-colors"
            style={{
              border: "1px dashed var(--color-border)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--color-muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--color-border)";
            }}
          />
        ))}
      </div>
      <p
        className="mt-2 text-center text-[10px] italic"
        style={{ color: "var(--color-muted)" }}
      >
        Your pack is empty
      </p>
    </SidebarPanel>
  );
}
