/**
 * Phase M / WS-A4 — email verification + password reset pages.
 * Minimal functional surfaces matching the auth page idiom (light, orange CTAs);
 * the visual pass can restyle freely. Tokens arrive via ?token= from the emailed link.
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MailCheck, KeyRound, CheckCircle2, XCircle } from "lucide-react";

function tokenFromUrl(): string {
  return new URLSearchParams(window.location.search).get("token") ?? "";
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f4f6f9] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-[0_10px_40px_rgba(20,30,55,0.08)] p-7">
        {children}
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      });
    } finally {
      setPending(false);
      setSubmitted(true); // identical outcome either way (anti-enumeration)
    }
  };

  return (
    <Shell>
      <KeyRound className="w-8 h-8 text-recipal-orange mb-3" />
      <h1 className="text-xl font-bold mb-1">Reset your password</h1>
      {submitted ? (
        <p className="text-sm text-muted-foreground" data-testid="text-reset-sent">
          If that account exists, a reset link is on its way. Check your inbox — the link expires in 1 hour.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4 mt-3">
          <div>
            <Label htmlFor="fp-email">Email</Label>
            <Input id="fp-email" type="email" required value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="you@example.com" data-testid="input-forgot-email" />
          </div>
          <Button type="submit" disabled={pending}
            className="w-full bg-recipal-orange hover:bg-recipal-orange/90 text-white font-bold h-11 rounded-full"
            data-testid="button-send-reset">
            {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send reset link"}
          </Button>
        </form>
      )}
      <Link href="/login" className="block text-center text-sm text-recipal-deep-green underline underline-offset-2 mt-5">
        Back to sign in
      </Link>
    </Shell>
  );
}

export function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: tokenFromUrl(), newPassword: password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Reset failed");
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <Shell>
      <KeyRound className="w-8 h-8 text-recipal-orange mb-3" />
      <h1 className="text-xl font-bold mb-1">Choose a new password</h1>
      {done ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2" data-testid="text-reset-done">
          <CheckCircle2 className="w-4 h-4 text-green-600" /> Password updated — taking you to sign in…
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4 mt-3">
          <div>
            <Label htmlFor="rp-pass">New password</Label>
            <Input id="rp-pass" type="password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)} data-testid="input-new-password" />
          </div>
          <div>
            <Label htmlFor="rp-confirm">Confirm password</Label>
            <Input id="rp-confirm" type="password" required value={confirm}
              onChange={(e) => setConfirm(e.target.value)} data-testid="input-confirm-password" />
          </div>
          {error && <p className="text-sm text-destructive" data-testid="text-reset-error">{error}</p>}
          <Button type="submit" disabled={pending}
            className="w-full bg-recipal-orange hover:bg-recipal-orange/90 text-white font-bold h-11 rounded-full"
            data-testid="button-reset-password">
            {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Update password"}
          </Button>
        </form>
      )}
    </Shell>
  );
}

export function VerifyEmailPage() {
  const [state, setState] = useState<"verifying" | "ok" | "fail">("verifying");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ token: tokenFromUrl() }),
        });
        setState(res.ok ? "ok" : "fail");
      } catch {
        setState("fail");
      }
    })();
  }, []);

  return (
    <Shell>
      <MailCheck className="w-8 h-8 text-recipal-orange mb-3" />
      <h1 className="text-xl font-bold mb-2">Email verification</h1>
      {state === "verifying" && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Verifying your email…
        </p>
      )}
      {state === "ok" && (
        <p className="text-sm text-muted-foreground flex items-center gap-2" data-testid="text-verify-ok">
          <CheckCircle2 className="w-4 h-4 text-green-600" /> You're verified! You can close this tab or head back to the app.
        </p>
      )}
      {state === "fail" && (
        <p className="text-sm text-muted-foreground flex items-center gap-2" data-testid="text-verify-fail">
          <XCircle className="w-4 h-4 text-destructive" /> This link is invalid or expired. Request a fresh one from your profile.
        </p>
      )}
      <Link href="/" className="block text-center text-sm text-recipal-deep-green underline underline-offset-2 mt-5">
        Open ReciPal
      </Link>
    </Shell>
  );
}
