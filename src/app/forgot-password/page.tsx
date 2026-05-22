"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/password-reset";
import { useSearchParams } from "next/navigation";

export default function ForgotPasswordPage() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError === "link_expired"
      ? "That reset link has expired. Please request a new one."
      : urlError === "missing_code"
      ? "The reset link was invalid. Please request a new one."
      : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await requestPasswordReset({ email: email.trim() });

    setLoading(false);

    if (!result.success) {
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-brand-teal/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-brand-red/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between relative z-10">
        <Link href="/" className="flex items-center space-x-1 select-none">
          <span className="font-display text-2xl tracking-tight">
            <span className="text-brand-red font-black">H</span>
            <span className="text-white font-extrabold">ealth</span>
            <span className="text-brand-teal font-black">K</span>
            <span className="text-white font-extrabold">o</span>
          </span>
        </Link>
        <div className="flex items-center space-x-4 text-xs font-bold">
          <Link
            href="/signin"
            className="text-slate-400 hover:text-slate-100 transition-colors"
          >
            Patient Sign In
          </Link>
          <Link
            href="/doctor/signin"
            className="text-slate-400 hover:text-slate-100 transition-colors"
          >
            Physician Sign In
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center px-4 py-12 relative z-10">
        <div className="max-w-md w-full">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-7">

            {/* Icon */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-brand-teal/10 border border-brand-teal/20 flex items-center justify-center text-brand-teal">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="font-display text-2xl font-black text-white tracking-tight">
                  {submitted ? "Check Your Inbox" : "Reset Password"}
                </h1>
                <p className="text-slate-400 text-sm font-medium mt-1 leading-relaxed">
                  {submitted
                    ? `We sent a secure reset link to ${email}. Click it to set a new password.`
                    : "Enter your registered email address and we'll send you a secure reset link."}
                </p>
              </div>
            </div>

            {submitted ? (
              /* Success state */
              <div className="space-y-4">
                <div className="p-4 bg-brand-teal/10 border border-brand-teal/20 rounded-xl text-xs text-brand-teal leading-relaxed text-center font-medium">
                  ✓ &nbsp;Reset link sent. The link expires in 1 hour.
                </div>
                <p className="text-center text-xs text-slate-500">
                  Didn't receive it?{" "}
                  <button
                    className="text-brand-teal hover:underline font-bold"
                    onClick={() => { setSubmitted(false); setError(null); }}
                  >
                    Send again
                  </button>
                </p>
                <Link
                  href="/signin"
                  className="block w-full text-center bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs py-3 rounded-xl transition-all"
                >
                  Back to Sign In
                </Link>
              </div>
            ) : (
              /* Email form */
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Error */}
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 font-medium">
                    {error}
                  </div>
                )}

                {/* Email field */}
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="patient@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal transition-all"
                  />
                </div>

                {/* Info note */}
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  A reset link will be sent to this address if it matches a registered HealthKo account. Check your spam folder if you don't see it within a few minutes.
                </p>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  id="send-reset-link-btn"
                  className="w-full bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-sm py-3.5 rounded-xl transition-all duration-300 shadow-md shadow-brand-teal/10 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0 disabled:cursor-not-allowed"
                >
                  {loading ? "Sending Secure Link…" : "Send Reset Link"}
                </button>

                <div className="text-center text-xs text-slate-500">
                  Remembered it?{" "}
                  <Link href="/signin" className="text-brand-teal hover:underline font-bold">
                    Sign in
                  </Link>
                </div>
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
