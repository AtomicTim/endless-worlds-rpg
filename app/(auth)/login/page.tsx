"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/game");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-black px-4 font-mono text-amber-400 scanlines">
      <div className="pointer-events-none absolute inset-0 opacity-[0.12] bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.35)_2px,rgba(0,0,0,0.35)_4px)]" />
      <div className="relative w-full max-w-md space-y-8 rounded-sm border border-amber-900/50 bg-[#050508] p-8 shadow-[0_0_40px_rgba(245,158,11,0.08)]">
        <header className="space-y-2 text-center">
          <pre className="ascii-art text-glow-amber text-xs text-amber-400 sm:text-sm">
            {`╔══════════════════════════════╗
║   ENDLESS WORLDS RPG — AUTH   ║
╚══════════════════════════════╝`}
          </pre>
          <h1 className="text-lg tracking-widest text-amber-500/90">SIGN IN</h1>
          <p className="text-xs text-muted-foreground">
            Enter your credentials to continue the session.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-amber-600/90">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-amber-900/40 bg-black font-mono text-amber-100 placeholder:text-amber-900/80 focus-visible:ring-amber-500/50"
              placeholder="traveler@realm.net"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-amber-600/90">
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-amber-900/40 bg-black font-mono text-amber-100 placeholder:text-amber-900/80 focus-visible:ring-amber-500/50"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p
              className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-500 font-mono text-black hover:bg-amber-400"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          No account?{" "}
          <Link
            href="/signup"
            className="text-amber-400 underline underline-offset-4 hover:text-amber-300"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
