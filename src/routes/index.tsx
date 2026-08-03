import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — WaveClimate Lead Engine" },
      {
        name: "description",
        content:
          "Sign in to the WaveClimate Lead Engine, or explore a sample-data demo with no login required.",
      },
      { property: "og:title", content: "Sign in — WaveClimate Lead Engine" },
      {
        property: "og:description",
        content:
          "Commercial energy prospecting in deregulated markets — sign in or view the demo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) navigate({ to: "/app", replace: true });
    })();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          toast.info("Account created — check your email to confirm before signing in.");
          setMode("signin");
          return;
        }
        navigate({ to: "/app", replace: true });
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/app", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="pipeline-scope min-h-screen">
      <div
        className="flex min-h-screen items-center justify-center px-6 py-16"
        style={{
          backgroundImage:
            "radial-gradient(900px 500px at 12% -8%, oklch(0.62 0.24 300 / 0.22), transparent 60%), radial-gradient(760px 420px at 92% 0%, oklch(0.82 0.15 55 / 0.16), transparent 62%)",
        }}
      >
        <div className="w-full max-w-5xl">
          <div className="flex items-baseline gap-3">
            <span className="headline text-lg text-white">WaveClimate</span>
            <span className="eyebrow" style={{ color: "var(--cc-muted)" }}>
              Lead Engine
            </span>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="glass-panel rounded-2xl p-8">
              <h1 className="headline text-3xl text-white">
                Commercial energy accounts in{" "}
                <span className="grad-text">deregulated markets</span>.
              </h1>
              <p className="mt-3 max-w-md text-sm" style={{ color: "var(--cc-muted)" }}>
                Prospect search, decision-maker enrichment, tier matching and outreach — with
                live market intelligence behind every target.
              </p>

              <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.04] p-6">
                <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                  No account needed
                </div>
                <p className="mt-2 text-sm text-white/75">
                  Explore the product with a frozen sample data set. No credentials, no live API
                  calls, no outreach sent.
                </p>
                <Button
                  className="grad-fill mt-5 rounded-full border-0 font-medium text-black hover:opacity-90"
                  onClick={() => navigate({ to: "/demo/app" })}
                >
                  View Demo
                </Button>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-8">
              <div className="eyebrow" style={{ color: "var(--cc-muted)" }}>
                {mode === "signin" ? "Sign in" : "Create account"}
              </div>
              <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label className="eyebrow" htmlFor="email">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-lg border-white/15 bg-white/5 text-white placeholder:text-white/35"
                    placeholder="you@waveclimate.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="eyebrow" htmlFor="password">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-lg border-white/15 bg-white/5 text-white placeholder:text-white/35"
                    placeholder="••••••••"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busy}
                  className="grad-fill w-full rounded-full border-0 font-medium text-black hover:opacity-90"
                >
                  {busy
                    ? "Working…"
                    : mode === "signin"
                      ? "Sign in to Lead Engine"
                      : "Create account"}
                </Button>
              </form>
              <button
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="mt-5 text-xs text-white/50 transition-colors hover:text-white"
              >
                {mode === "signin"
                  ? "Need an account? Create one"
                  : "Already have an account? Sign in"}
              </button>
              <p className="mt-6 text-xs" style={{ color: "var(--cc-muted)" }}>
                Signing in unlocks live Google Places search, enrichment providers, Instantly
                campaigns and your real pipeline data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
