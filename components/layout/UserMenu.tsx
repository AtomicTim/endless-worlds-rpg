"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type ProfileMenuRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "display_name" | "avatar_seed"
>;

function asciiAvatarLines(seed: string | null): string[] {
  const glyphs = ["░", "▒", "▓", "█", "·"];
  const s = seed && seed.length > 0 ? seed : "null";
  const lines: string[] = [];
  for (let r = 0; r < 5; r++) {
    let row = "";
    for (let c = 0; c < 5; c++) {
      const idx =
        (s.charCodeAt((r * 5 + c) % s.length) + r * 7 + c * 3) % glyphs.length;
      row += glyphs[idx];
    }
    lines.push(row);
  }
  return lines;
}

export function UserMenu() {
  const { user, signOut } = useUser();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarSeed, setAvatarSeed] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setDisplayName(null);
      setAvatarSeed(null);
      return;
    }

    const userId = user.id;
    const supabase = createClient();

    let cancelled = false;

    async function loadProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, avatar_seed")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled || error) return;

      const row = data as ProfileMenuRow | null;
      setDisplayName(row?.display_name ?? null);
      setAvatarSeed(row?.avatar_seed ?? null);
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  const label =
    displayName?.trim() ||
    (user.email ? user.email.split("@")[0] : null) ||
    "Traveler";

  const asciiLines = asciiAvatarLines(avatarSeed);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          // UI-fix-A — UI chrome: Inter Tight (ew-sans), warm-brown
          // surface instead of pure black so the menu sits with the
          // rest of the topbar palette.
          className="ew-sans border-amber-900/50 bg-[#1a1410]/80 text-amber-400 hover:bg-amber-950/40 hover:text-amber-300"
        >
          <span className="ascii-art mr-2 inline-block text-[0.45rem] leading-[1.05] text-amber-500">
            {asciiLines.join("\n")}
          </span>
          <span className="max-w-[10rem] truncate">{label}</span>
          <ChevronDown className="ml-1 size-4 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        // UI-fix-A — dropdown chrome → ew-sans, warm-brown bg.
        className="ew-sans w-52 border-amber-900/45 bg-[#1a1410] text-foreground"
      >
        <DropdownMenuItem asChild>
          <Link
            href="/dashboard"
            className="flex cursor-pointer items-center gap-2 text-amber-200/90 focus:text-amber-100"
          >
            <User className="size-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href="/dashboard#settings"
            className="flex cursor-pointer items-center gap-2 text-amber-200/90 focus:text-amber-100"
          >
            <Settings className="size-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-amber-900/30" />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          onSelect={(e) => {
            e.preventDefault();
            void signOut();
          }}
        >
          <LogOut className="size-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
