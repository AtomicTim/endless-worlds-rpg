"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/UserMenu";
import { useUser } from "@/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type ProfileDisplayRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "display_name"
>;

export default function GamePage() {
  const { user, loading, signOut } = useUser();
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    const supabase = createClient();

    let cancelled = false;

    async function loadProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled || error) return;
      const row = data as ProfileDisplayRow | null;
      setDisplayName(row?.display_name ?? null);
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const welcomeName =
    displayName?.trim() ||
    (user?.email ? user.email.split("@")[0] : null) ||
    "Traveler";

  return (
    <div className="relative min-h-screen bg-black font-mono text-amber-400">
      <header className="flex items-center justify-end border-b border-amber-900/30 bg-[#050508] px-4 py-3">
        <UserMenu />
      </header>
      <div className="flex flex-col items-center justify-center px-4 py-24 text-center scanlines">
        <pre className="ascii-art mb-6 text-glow-amber text-xs text-amber-500 sm:text-sm">
          {`╔══════════════════════╗
║   ENDLESS WORLDS RPG  ║
╚══════════════════════╝`}
        </pre>
        {loading ? (
          <p className="text-muted-foreground">Loading session…</p>
        ) : (
          <>
            <p className="max-w-md text-lg text-amber-300/95">
              Welcome,{" "}
              <span className="text-amber-400 text-glow-amber">{welcomeName}</span>
              . Your adventure begins soon.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-8 border-amber-700/50 bg-transparent font-mono text-amber-400 hover:bg-amber-950/50 hover:text-amber-300"
              onClick={() => void signOut()}
            >
              Sign Out
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
