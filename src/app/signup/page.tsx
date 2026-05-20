"use client";

import { useState } from "react";
import Link from "next/link";
import { registerPatient } from "../actions/auth";

// Universal Country Code configurations and validation patterns
const countries = [
  { code: "+1", name: "United States / Canada", regex: /^\d{10}$/, placeholder: "555 123 4567", formatHint: "10 digits" },
  { code: "+44", name: "United Kingdom", regex: /^7\d{9}$/, placeholder: "7123 456789", formatHint: "10 digits starting with 7" },
  { code: "+61", name: "Australia", regex: /^4\d{8}$/, placeholder: "412 345 678", formatHint: "9 digits starting with 4" },
  { code: "+63", name: "Philippines", regex: /^(09|9)\d{9}$/, placeholder: "917 123 4567", formatHint: "10 digits starting with 9 (or 11 starting with 09)" },
  { code: "+65", name: "Singapore", regex: /^[89]\d{7}$/, placeholder: "8123 4567", formatHint: "8 digits starting with 8 or 9" },
  { code: "+91", name: "India", regex: /^[6-9]\d{9}$/, placeholder: "98765 43210", formatHint: "10 digits starting with 6-9" },
  { code: "+other", name: "International", regex: /^\d{7,15}$/, placeholder: "Enter international format", formatHint: "7 to 15 digits" }
];

export default function SignUpPage() {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hipaaConsent, setHipaaConsent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Dynamic phone validation
  const activeCountry = countries.find((c) => c.code === countryCode) || countries[0];
  const digitsOnly = phone.replace(/\D/g, "");
  const isPhoneInvalid = phone.length > 0 && !activeCountry.regex.test(digitsOnly);

  // Password validation constraints
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const hasMinLen = password.length >= 8;
  const isPasswordValid = hasUppercase && hasNumber && hasSymbol && hasMinLen && password.length <= 12;
  const isPasswordMatch = password === confirmPassword;

  // Strength score calculation
  let score = 0;
  if (password.length > 0) {
    if (hasMinLen) score++;
    if (hasUppercase) score++;
    if (hasNumber) score++;
    if (hasSymbol) score++;
  }

  let strengthLabel = "Weak";
  let strengthColor = "text-brand-red";
  let strengthColorBg = "bg-brand-red";
  let strengthPercent = 33;

  if (score === 3) {
    strengthLabel = "Medium";
    strengthColor = "text-amber-500";
    strengthColorBg = "bg-amber-500";
    strengthPercent = 66;
  } else if (score === 4) {
    strengthLabel = "Strong";
    strengthColor = "text-brand-teal";
    strengthColorBg = "bg-brand-teal";
    strengthPercent = 100;
  }

  const isSubmitDisabled =
    loading ||
    !hipaaConsent ||
    isPhoneInvalid ||
    !isPasswordValid ||
    !isPasswordMatch ||
    !firstName ||
    !lastName ||
    !phone ||
    !email ||
    !dob;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return;
    setLoading(true);
    setError("");
    try {
      const res = await registerPatient({
        firstName,
        middleName,
        lastName,
        suffix,
        email,
        countryCode,
        phone,
        dob,
        password,
        hipaaConsent
      });
      setLoading(false);
      if (res.success) {
        setSuccess(true);
      } else {
        setError(res.error || "Failed to register profile");
      }
    } catch (err: any) {
      setLoading(false);
      setError("A network error occurred. Please verify your connection.");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-white font-sans text-slate-800">
      
      {/* Left Column: Brand & Trust Info (5 cols) */}
      <div className="hidden lg:flex lg:col-span-5 bg-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 left-0 w-80 h-80 rounded-full bg-brand-teal/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-brand-red/10 blur-3xl" />

        {/* Logo */}
        <Link href="/" className="flex items-center space-x-1 select-none relative z-10">
          <span className="font-display text-2xl tracking-tight">
            <span className="text-brand-red font-black">H</span>
            <span className="text-white font-extrabold">ealth</span>
            <span className="text-brand-teal font-black">K</span>
            <span className="text-white font-extrabold">o</span>
          </span>
        </Link>

        {/* Setup Bullet Points */}
        <div className="space-y-8 relative z-10 max-w-sm">
          <h1 className="font-display text-3xl font-black tracking-tight leading-tight">
            Create Your Protected Health Vault
          </h1>
          
          <div className="space-y-5">
            <div className="flex items-start space-x-3.5">
              <span className="h-5 w-5 rounded-full bg-brand-teal/20 text-brand-teal flex items-center justify-center flex-shrink-0 text-xs font-black">1</span>
              <div>
                <h4 className="font-extrabold text-sm text-slate-100">Register in 2 minutes</h4>
                <p className="text-xs text-slate-450 leading-relaxed mt-0.5">Quick onboarding with simple credentials and insurance linkages.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3.5">
              <span className="h-5 w-5 rounded-full bg-brand-red/20 text-brand-red flex items-center justify-center flex-shrink-0 text-xs font-black">2</span>
              <div>
                <h4 className="font-extrabold text-sm text-slate-100">Upload medical files</h4>
                <p className="text-xs text-slate-450 leading-relaxed mt-0.5">Store active medication logs and previous diagnoses in the secure HIPAA vault.</p>
              </div>
            </div>
            <div className="flex items-start space-x-3.5">
              <span className="h-5 w-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 text-xs font-black">3</span>
              <div>
                <h4 className="font-extrabold text-sm text-slate-100">Connect to doctors 24/7</h4>
                <p className="text-xs text-slate-450 leading-relaxed mt-0.5">Gain direct video-consult entry to our board-certified clinical practitioners.</p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-850 flex items-center space-x-3 text-xs text-slate-400 font-bold">
            <svg className="w-5 h-5 text-brand-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>SOC2 Audit Verified Database Vault</span>
          </div>
        </div>

        {/* Copyright */}
        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider relative z-10">
          © {new Date().getFullYear()} HealthKo Technologies, Inc.
        </span>
      </div>

      {/* Right Column: Sign Up Form (7 cols) */}
      <div className="col-span-12 lg:col-span-7 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-12 relative">
        {/* Mobile Header Logo */}
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

        <div className="max-w-xl w-full mx-auto space-y-8">
          
          {/* Form Header */}
          <div className="space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Register HealthKo Profile
            </h2>
            <p className="text-slate-500 font-medium text-xs sm:text-sm">
              Create your profile to start booking video consults and requesting refills.
            </p>
          </div>

          {!success ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-brand-red/10 border border-brand-red/20 text-brand-red font-bold text-xs rounded-xl animate-fade-in">
                  {error}
                </div>
              )}
              
              {/* Separated Name Grid */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-6 sm:col-span-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">
                    M.I.
                  </label>
                  <input
                    type="text"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Ann"
                    maxLength={10}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
                  />
                </div>
                <div className="col-span-8 sm:col-span-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">
                    Suffix
                  </label>
                  <select
                    value={suffix}
                    onChange={(e) => setSuffix(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 bg-white"
                  >
                    <option value="">None</option>
                    <option value="Jr.">Jr.</option>
                    <option value="Sr.">Sr.</option>
                    <option value="II">II</option>
                    <option value="III">III</option>
                    <option value="IV">IV</option>
                  </select>
                </div>
              </div>

              {/* Grid: Email & Phone */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane.doe@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">
                    Phone Number
                  </label>
                  <div className="flex space-x-2">
                    <select
                      value={countryCode}
                      onChange={(e) => {
                        setCountryCode(e.target.value);
                        setPhone(""); // Reset field for clean formatting entry
                      }}
                      className="px-2 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 bg-white w-28 flex-shrink-0"
                    >
                      {countries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} {c.name.split(" ")[0]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={activeCountry.placeholder}
                      className={`w-full px-3 py-2.5 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-1 ${
                        isPhoneInvalid
                          ? "border-brand-red focus:border-brand-red focus:ring-brand-red/20 text-brand-red"
                          : "border-slate-200 focus:border-brand-teal focus:ring-brand-teal/20 text-slate-850"
                      }`}
                    />
                  </div>
                  {/* Real-time Validation Feedback */}
                  {isPhoneInvalid && (
                    <span className="text-[10px] font-bold text-brand-red mt-1 block animate-slide-up">
                      Invalid format for {activeCountry.name}. Expected: {activeCountry.formatHint}
                    </span>
                  )}
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">
                  Date of Birth
                </label>
                <input
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20"
                />
              </div>

              {/* Password & Confirm Password Grid */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">
                    Password (Max 12 chars)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      maxLength={12}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-1 ${
                        password && !isPasswordValid
                          ? "border-brand-red focus:border-brand-red focus:ring-brand-red/20 text-brand-red"
                          : "border-slate-200 focus:border-brand-teal focus:ring-brand-teal/20 text-slate-850"
                      }`}
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

                  {/* Strength & Restrictions */}
                  {password && (
                    <div className="mt-2 space-y-1.5 animate-slide-up">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                        <span>Strength: <span className={strengthColor}>{strengthLabel}</span></span>
                        <span>{password.length}/12 chars</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex space-x-0.5">
                        <div className={`h-full transition-all duration-300 ${strengthPercent >= 33 ? strengthColorBg : "bg-transparent"}`} style={{ width: "33.33%" }} />
                        <div className={`h-full transition-all duration-300 ${strengthPercent >= 66 ? strengthColorBg : "bg-transparent"}`} style={{ width: "33.33%" }} />
                        <div className={`h-full transition-all duration-300 ${strengthPercent === 100 ? strengthColorBg : "bg-transparent"}`} style={{ width: "33.33%" }} />
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] font-bold">
                        <span className={`flex items-center space-x-1 ${hasUppercase ? "text-emerald-600" : "text-slate-400"}`}>
                          <span>{hasUppercase ? "✓" : "○"}</span> <span>Uppercase</span>
                        </span>
                        <span className={`flex items-center space-x-1 ${hasNumber ? "text-emerald-600" : "text-slate-400"}`}>
                          <span>{hasNumber ? "✓" : "○"}</span> <span>Number</span>
                        </span>
                        <span className={`flex items-center space-x-1 ${hasSymbol ? "text-emerald-600" : "text-slate-400"}`}>
                          <span>{hasSymbol ? "✓" : "○"}</span> <span>Symbol</span>
                        </span>
                        <span className={`flex items-center space-x-1 ${hasMinLen ? "text-emerald-600" : "text-slate-400"}`}>
                          <span>{hasMinLen ? "✓" : "○"}</span> <span>Min 8 chars</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">
                    Retype Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      maxLength={12}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full px-4 py-2.5 pr-10 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-1 ${
                        confirmPassword && !isPasswordMatch
                          ? "border-brand-red focus:border-brand-red focus:ring-brand-red/20 text-brand-red"
                          : "border-slate-200 focus:border-brand-teal focus:ring-brand-teal/20 text-slate-850"
                      }`}
                    />
                  </div>
                  {confirmPassword && !isPasswordMatch && (
                    <span className="text-[10px] font-bold text-brand-red mt-1.5 block animate-slide-up">
                      Passwords do not match
                    </span>
                  )}
                  {confirmPassword && isPasswordMatch && isPasswordValid && (
                    <span className="text-[10px] font-bold text-emerald-600 mt-1.5 block animate-slide-up">
                      ✓ Passwords match
                    </span>
                  )}
                </div>
              </div>

              {/* HIPAA Consent Checklist */}
              <div className="flex items-start p-3 bg-slate-50 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  required
                  id="hipaa-consent"
                  checked={hipaaConsent}
                  onChange={(e) => setHipaaConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-350 text-brand-teal focus:ring-brand-teal/20 cursor-pointer"
                />
                <label htmlFor="hipaa-consent" className="ml-2.5 block text-[10px] sm:text-xs font-bold text-slate-500 select-none leading-normal cursor-pointer">
                  I consent to virtual care treatment under HIPAA privacy regulations and agree to the storage of my record logs in HealthKo's secure repository.
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitDisabled}
                className="w-full bg-brand-teal hover:bg-brand-teal-hover text-white font-bold text-sm py-3.5 rounded-xl transition-all duration-300 shadow-md shadow-brand-teal/10 hover:-translate-y-0.5 active:translate-y-0 disabled:bg-slate-300 disabled:translate-y-0 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Generating Vault...</span>
                  </>
                ) : (
                  <span>Create Account & Vault</span>
                )}
              </button>
            </form>
          ) : (
            /* Success Feedback / Redirect Simulation */
            <div className="py-8 text-center space-y-6 animate-fade-in">
              <div className="h-16 w-16 rounded-full bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center text-emerald-500 mx-auto">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-black text-slate-900 text-lg">
                  Profile Registered Successfully
                </h3>
                <p className="text-slate-550 text-sm font-semibold max-w-sm mx-auto leading-relaxed">
                  Welcome, <span className="text-brand-teal font-extrabold">{firstName} {lastName} {suffix}</span>! Your HIPAA electronic health file has been vaulted. Initializing your patient medical panel...
                </p>
              </div>
              <div className="w-full max-w-xs mx-auto bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-brand-teal h-1.5 rounded-full animate-progress-bar" style={{ width: '100%', transition: 'width 2s ease-in-out' }} />
              </div>
              <div className="pt-4">
                <Link
                  href="/"
                  className="text-xs font-black text-brand-teal hover:underline"
                >
                  Return to Homepage
                </Link>
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          {!success && (
            <div className="text-center text-xs font-semibold text-slate-500 pt-4">
              <span>Already have an account? </span>
              <Link href="/signin" className="text-brand-teal hover:text-brand-teal-hover font-extrabold underline">
                Sign in to your dashboard
              </Link>
            </div>
          )}

        </div>
      </div>
      
    </div>
  );
}
