"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import PatientOtpModal from "@/components/PatientOtpModal";
import { requestPatientLoginOtp, verifyPatientLoginOtp } from "../actions/auth";

type OtpPurpose = "signup_verify" | "login_verify";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [otpPurpose, setOtpPurpose] = useState<OtpPurpose>("login_verify");

  useEffect(() => {
    if (!showOtpModal) {
      return;
    }

    const timer = window.setTimeout(() => {
      document.getElementById("patient-otp-input-0")?.focus();
    }, 100);

    return () => window.clearTimeout(timer);
  }, [showOtpModal]);

  const handleOtpChange = (value: string, idx: number) => {
    const cleaned = value.slice(-1);
    if (cleaned && Number.isNaN(Number(cleaned))) {
      return;
    }

    const nextDigits = [...otpDigits];
    nextDigits[idx] = cleaned;
    setOtpDigits(nextDigits);

    if (cleaned && idx < 5) {
      document.getElementById(`patient-otp-input-${idx + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (event.key !== "Backspace") {
      return;
    }

    if (!otpDigits[idx] && idx > 0) {
      const nextDigits = [...otpDigits];
      nextDigits[idx - 1] = "";
      setOtpDigits(nextDigits);
      document.getElementById(`patient-otp-input-${idx - 1}`)?.focus();
      return;
    }

    const nextDigits = [...otpDigits];
    nextDigits[idx] = "";
    setOtpDigits(nextDigits);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    setOtpError("");

    try {
      const res = await requestPatientLoginOtp({ email, password });
      setLoading(false);

      if (!res.success) {
        setError(res.error || "Invalid email or password");
        return;
      }

      setOtpDigits(["", "", "", "", "", ""]);
      setOtpPurpose(res.purpose || "login_verify");
      setInfo(res.message || "");
      setShowOtpModal(true);
    } catch {
      setLoading(false);
      setError("A network error occurred. Please verify your connection.");
    }
  };

  const handleVerifyOtp = async () => {
    const otp = otpDigits.join("");

    if (otp.length !== 6) {
      setOtpError("Please enter the full 6-digit code.");
      return;
    }

    setLoading(true);
    setOtpError("");

    try {
      const res = await verifyPatientLoginOtp({
        email,
        otp,
        purpose: otpPurpose,
      });

      setLoading(false);

      if (!res.success) {
        setOtpError(res.error || "Verification failed.");
        return;
      }

      router.push("/patient/dashboard");
      router.refresh();
    } catch {
      setLoading(false);
      setOtpError("A connection error occurred. Please verify your connection.");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-white font-sans text-slate-800">
      <div className="hidden lg:flex lg:col-span-5 bg-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 rounded-full bg-brand-teal/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-brand-red/10 blur-3xl" />

        <Link href="/" className="flex items-center space-x-1 select-none relative z-10">
          <span className="font-display text-2xl tracking-tight">
            <span className="text-brand-red font-black">H</span>
            <span className="text-white font-extrabold">ealth</span>
            <span className="text-brand-teal font-black">K</span>
            <span className="text-white font-extrabold">o</span>
          </span>
        </Link>

        <div className="space-y-6 relative z-10 max-w-sm">
          <h1 className="font-display text-3xl font-black tracking-tight leading-tight">
            Your Premium Health Vault Awaits
          </h1>
          <p className="text-slate-400 text-sm font-medium leading-relaxed">
            Access secure virtual consultation sessions, direct pharmacy refills, and clinical trend tracking using our state-of-the-art telehealth system.
          </p>
          <div className="pt-6 border-t border-slate-850 flex items-center space-x-3 text-xs text-slate-400 font-bold">
            <svg className="w-5 h-5 text-brand-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Fully HIPAA & SOC2 Compliant Encryption</span>
          </div>
        </div>

        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider relative z-10">
          Copyright {new Date().getFullYear()} HealthKo Technologies, Inc.
        </span>
      </div>

      <div className="col-span-12 lg:col-span-7 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 relative">
        <div className="absolute top-8 left-8 lg:hidden">
          <Link href="/" className="flex items-center space-x-1">
            <span className="font-display text-xl tracking-tight">
              <span className="text-brand-red font-black">H</span>
              <span className="text-slate-900 font-extrabold">ealth</span>
              <span className="text-brand-teal font-black">K</span>
              <span className="text-slate-900 font-extrabold">o</span>
            </span>
          </Link>
        </div>

        <div className="max-w-md w-full mx-auto space-y-8">
          <div className="space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Sign In to Patient Portal
            </h2>
            <p className="text-slate-500 font-medium text-xs sm:text-sm">
              Enter your verified credentials to access your secure medical vault.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-brand-red/10 border border-brand-red/20 text-brand-red font-bold text-xs rounded-xl animate-fade-in">
                {error}
              </div>
            )}

            {info && (
              <div className="rounded-xl border border-brand-teal/20 bg-brand-teal-tint p-3 text-xs font-bold text-brand-teal">
                {info}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="jane.doe@example.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="........"
                  className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember-me"
                  className="h-4 w-4 rounded border-slate-350 text-brand-teal focus:ring-brand-teal/20"
                />
                <label htmlFor="remember-me" className="ml-2 block text-xs font-bold text-slate-500 select-none">
                  Keep me logged in for 30 days
                </label>
              </div>
              <Link
                href="/forgot-password"
                className="text-xs font-bold text-brand-teal hover:text-brand-teal-hover hover:underline transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-sm py-3.5 rounded-xl transition-all duration-300 shadow-md shadow-brand-teal/10 hover:-translate-y-0.5 active:translate-y-0 disabled:bg-slate-300 disabled:translate-y-0"
            >
              {loading ? "Sending Secure Code..." : "Access Secure Dashboard"}
            </button>
          </form>

          <div className="text-center text-xs font-semibold text-slate-500 pt-4 space-y-2">
            <div>
              <span>New to HealthKo? </span>
              <Link href="/signup" className="text-brand-teal hover:text-brand-teal-hover font-extrabold underline">
                Create a secure patient profile
              </Link>
            </div>
            <div className="pt-1 border-t border-slate-100">
              <span>Are you a medical practitioner? </span>
              <Link href="/doctor/signin" className="text-slate-850 hover:text-brand-teal font-extrabold underline">
                Sign in to Doctor Portal
              </Link>
            </div>
          </div>
        </div>
      </div>

      <PatientOtpModal
        open={showOtpModal}
        title={otpPurpose === "signup_verify" ? "Verify Your Email" : "Email Security Check"}
        description={
          otpPurpose === "signup_verify"
            ? "Your account still needs email verification. Enter the code we sent to activate your patient dashboard."
            : "Enter the 6-digit code we emailed to you to finish signing in securely."
        }
        email={email}
        otpDigits={otpDigits}
        otpError={otpError}
        loading={loading}
        actionLabel={otpPurpose === "signup_verify" ? "Verify & Enter Dashboard" : "Confirm & Sign In"}
        onOtpChange={handleOtpChange}
        onOtpKeyDown={handleOtpKeyDown}
        onSubmit={handleVerifyOtp}
        onClose={() => {
          setShowOtpModal(false);
          setOtpError("");
        }}
        onClear={() => {
          setOtpDigits(["", "", "", "", "", ""]);
          setOtpError("");
          document.getElementById("patient-otp-input-0")?.focus();
        }}
      />
    </div>
  );
}
