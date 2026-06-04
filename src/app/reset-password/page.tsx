"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  // Verify that the user has an active session (set by /auth/callback)
  useEffect(() => {
    setSupabase(createClient());
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSessionReady(!!data.session);
    });
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    if (!supabase) {
      setError("Secure session is still loading. Please try again in a moment.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      console.error("[reset-password]", updateError.message);
      setError(
        updateError.message.includes("same password")
          ? "New password must be different from your current password."
          : "Could not update your password. The link may have expired — please request a new one."
      );
      return;
    }

    setSuccess(true);
    // Sign out so the fresh sign-in flow applies the new password
    await supabase.auth.signOut();
    setTimeout(() => router.push("/signin"), 3000);
  }

  /* ── No active session ── */
  if (sessionReady === false) {
    return (
      <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-brand-teal/10 blur-3xl pointer-events-none" />

        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center relative z-10">
          <Link href="/" className="flex items-center space-x-1 select-none">
            <span className="font-display text-2xl tracking-tight">
              <span className="text-brand-red font-black">H</span>
              <span className="text-white font-extrabold">ealth</span>
              <span className="text-brand-teal font-black">K</span>
              <span className="text-white font-extrabold">o</span>
            </span>
          </Link>
        </header>

        <main className="flex-grow flex items-center justify-center px-4 py-12 relative z-10">
          <div className="max-w-md w-full">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
              <div className="h-14 w-14 rounded-full bg-brand-red/10 border border-brand-red/20 flex items-center justify-center text-brand-red mx-auto">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="font-display text-xl font-black text-white">Link Expired or Invalid</h1>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                  This password reset link has expired or has already been used. Please request a new one.
                </p>
              </div>
              <Link
                href="/forgot-password"
                className="block w-full bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-sm py-3 rounded-xl transition-all shadow-md shadow-brand-teal/10"
              >
                Request New Reset Link
              </Link>
            </div>
          </div>
        </main>

        <footer className="border-t border-slate-900 py-5 px-6 text-center text-[10px] text-slate-600 font-bold uppercase tracking-wider relative z-10">
          © {new Date().getFullYear()} HealthKo Technologies, Inc. | HIPAA Secure Infrastructure
        </footer>
      </div>
    );
  }

  /* ── Loading session check ── */
  if (sessionReady === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Verifying secure session…</div>
      </div>
    );
  }

  /* ── Main reset form ── */
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col justify-between relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-brand-teal/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-brand-red/5 blur-3xl pointer-events-none" />

      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center relative z-10">
        <Link href="/" className="flex items-center space-x-1 select-none">
          <span className="font-display text-2xl tracking-tight">
            <span className="text-brand-red font-black">H</span>
            <span className="text-white font-extrabold">ealth</span>
            <span className="text-brand-teal font-black">K</span>
            <span className="text-white font-extrabold">o</span>
          </span>
        </Link>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-12 relative z-10">
        <div className="max-w-md w-full">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-7">

            {/* Icon + title */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-brand-teal/10 border border-brand-teal/20 flex items-center justify-center text-brand-teal">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="font-display text-2xl font-black text-white tracking-tight">
                  {success ? "Password Updated" : "Set New Password"}
                </h1>
                <p className="text-slate-400 text-sm font-medium mt-1 leading-relaxed">
                  {success
                    ? "Your password has been updated. Redirecting to sign in…"
                    : "Choose a strong new password for your HealthKo account."}
                </p>
              </div>
            </div>

            {success ? (
              <div className="space-y-4">
                <div className="p-4 bg-brand-teal/10 border border-brand-teal/20 rounded-xl text-xs text-brand-teal font-medium text-center">
                  ✓ &nbsp;Password changed successfully. You will be redirected in 3 seconds.
                </div>
                <Link
                  href="/signin"
                  className="block w-full text-center bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-sm py-3 rounded-xl transition-all shadow-md shadow-brand-teal/10"
                >
                  Go to Sign In
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Error */}
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
                    {error}
                  </div>
                )}

                {/* New Password */}
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal transition-all"
                  />
                </div>

                {/* Password strength hint */}
                {password.length > 0 && (
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          password.length >= level * 3
                            ? password.length >= 12
                              ? "bg-brand-teal"
                              : password.length >= 8
                              ? "bg-yellow-400"
                              : "bg-red-400"
                            : "bg-slate-700"
                        }`}
                      />
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !password || !confirm}
                  id="update-password-btn"
                  className="w-full bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-sm py-3.5 rounded-xl transition-all duration-300 shadow-md shadow-brand-teal/10 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:cursor-not-allowed"
                >
                  {loading ? "Updating Password…" : "Update Password"}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 py-5 px-6 text-center text-[10px] text-slate-600 font-bold uppercase tracking-wider relative z-10">
        © {new Date().getFullYear()} HealthKo Technologies, Inc. | HIPAA Secure Infrastructure
      </footer>
    </div>
  );
}
