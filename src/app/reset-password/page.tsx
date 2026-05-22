"use client";

import Link from "next/link";

export default function ResetPasswordPage() {
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
      </header>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center px-4 py-12 relative z-10">
        <div className="max-w-md w-full">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-7 text-center">
            {/* Locked Shield Icon */}
            <div className="h-16 w-16 rounded-full bg-brand-red/10 border border-brand-red/20 flex items-center justify-center text-brand-red mx-auto">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            <div className="space-y-3">
              <h1 className="font-display text-2xl font-black text-white tracking-tight">
                Portal Suspended
              </h1>
              <p className="text-slate-450 text-sm font-medium leading-relaxed">
                Self-service credential resets are currently suspended under strict clinical security regulations.
              </p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl text-xs text-slate-400 leading-relaxed text-left space-y-2">
              <p className="font-black text-slate-350 uppercase tracking-wider text-[10px]">
                Support Helpline:
              </p>
              <p>
                Please contact the HealthKo Security Desk at <strong className="text-white">support@healthko.com</strong> to verify your identity and receive authorized clinical access keys.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <Link
                href="/signin"
                className="w-full bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-xs py-3 rounded-xl transition-all shadow-md shadow-brand-teal/15 flex items-center justify-center"
              >
                Go to Sign In Page
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 py-5 px-6 text-center text-[10px] text-slate-600 font-bold uppercase tracking-wider relative z-10">
        © {new Date().getFullYear()} HealthKo Technologies, Inc. • HIPAA Secure Credential Reset
      </footer>
    </div>
  );
}
