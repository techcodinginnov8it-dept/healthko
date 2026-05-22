"use client";

import { useState } from "react";
import Link from "next/link";
import { getErrorMessage } from "@/lib/errors";
import { uploadFileToStorage } from "../../actions/storage";
import { submitDoctorAudit } from "../../actions/audit";

const SPECIALTIES = [
  { value: "GENERAL_PRACTITIONER", label: "General Practitioner / Family Medicine" },
  { value: "CARDIOLOGIST", label: "Cardiologist (Heart & Vascular)" },
  { value: "DERMATOLOGIST", label: "Dermatologist (Skin Care)" },
  { value: "NEUROLOGIST", label: "Neurologist (Brain & Nervous System)" },
  { value: "PEDIATRICIAN", label: "Pediatrician (Child Development)" },
  { value: "PSYCHIATRIST", label: "Psychiatrist (Mental Health)" },
  { value: "ORTHOPEDIST", label: "Orthopedist (Bones & Joints)" },
  { value: "GYNECOLOGIST", label: "Gynecologist (Women's Health)" },
  { value: "ONCOLOGIST", label: "Oncologist (Cancer Specialist)" },
  { value: "ENDOCRINOLOGIST", label: "Endocrinologist (Hormones & Diabetes)" },
  { value: "OTHER", label: "Other Specialties" },
];

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA",
  "RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export default function DoctorAuditPage() {
  const [step, setStep] = useState(1);

  // Step 1: Clinical Identity
  const [npi, setNpi] = useState("");
  const [specialty, setSpecialty] = useState("");

  // Step 2: Licensure & Experience
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseState, setLicenseState] = useState("");
  const [yearsExp, setYearsExp] = useState("");
  const [medicalSchool, setMedicalSchool] = useState("");
  const [gradYear, setGradYear] = useState("");

  // Step 3: Document Upload (Supabase Storage)
  const [fileName, setFileName] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");     // Public URL after upload
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Step 4: Attestation
  const [signature, setSignature] = useState("");
  const [consent, setConsent] = useState(false);
  const [doctorEmail, setDoctorEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState<{ auditId: string; linked: boolean } | null>(null);

  const isNpiInvalid = npi.length > 0 && (npi.length !== 10 || isNaN(Number(npi)));

  // ── Real Supabase Storage Upload ────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(file.type)) {
      setUploadError("Only PDF, PNG, or JPEG files are accepted.");
      return;
    }
    // Validate size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File size must not exceed 10 MB.");
      return;
    }

    setFileName(file.name);
    setDocumentUrl("");
    setUploadError("");
    setIsUploading(true);
    setUploadProgress(5); // Show immediate feedback

    try {
      // Simulate steady progress while uploading
      const ticker = setInterval(() => {
        setUploadProgress((prev) => (prev < 90 ? prev + 5 : prev));
      }, 150);

      // Create FormData to send to our server action (avoids client-side RLS limits)
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "doctor-credentials");

      const result = await uploadFileToStorage(formData);

      clearInterval(ticker);

      if (!result.success || !result.url) {
        setIsUploading(false);
        setUploadProgress(0);
        setFileName("");
        setUploadError(result.error || "Upload failed. Please try again.");
        return;
      }

      setDocumentUrl(result.url);
      setUploadProgress(100);
      setIsUploading(false);
    } catch (error: unknown) {
      setIsUploading(false);
      setUploadProgress(0);
      setFileName("");
      setUploadError(getErrorMessage(error, "An unexpected error occurred during upload."));
    }
  };

  // ── Step Navigation ──────────────────────────────────────────────────────────
  const handleNextStep = () => {
    if (step === 1) {
      if (!npi || npi.length !== 10 || isNaN(Number(npi))) {
        setError("Please enter a valid 10-digit National Provider Identifier (NPI).");
        return;
      }
      if (!specialty) {
        setError("Please select your medical specialty area.");
        return;
      }
    }
    if (step === 2) {
      if (!licenseNumber || !licenseState) {
        setError("Medical state licensure details are required.");
        return;
      }
      if (!yearsExp || Number(yearsExp) < 0 || Number(yearsExp) > 60) {
        setError("Please input a valid number of years in clinical practice.");
        return;
      }
      if (!medicalSchool || !gradYear || Number(gradYear) < 1960 || Number(gradYear) > new Date().getFullYear()) {
        setError("Please provide a valid medical school and graduation year.");
        return;
      }
    }
    if (step === 3) {
      if (!documentUrl) {
        setError("Please attach and upload a digital copy of your medical license to proceed.");
        return;
      }
      if (isUploading) {
        setError("Please wait for the secure document upload to complete.");
        return;
      }
    }
    setError("");
    setStep((s) => s + 1);
  };

  const handlePrevStep = () => {
    setError("");
    setStep((s) => s - 1);
  };

  // ── Final Submit ─────────────────────────────────────────────────────────────
  const handleSubmitAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signature) {
      setError("Please sign your legal name to authorize primary source verification.");
      return;
    }
    if (!consent) {
      setError("You must accept the HIPAA compliance and credentialing authorization.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await submitDoctorAudit({
        npi,
        licenseNumber,
        licenseState,
        specialty,
        medicalSchool,
        gradYear: Number(gradYear),
        yearsExp: Number(yearsExp),
        documentName: documentUrl || fileName,  // Public Supabase URL stored in DB
        signature,
        consent,
        doctorEmail: doctorEmail || undefined,
      });

      setLoading(false);
      if (res.success && res.auditId) {
        setSuccessData({ auditId: res.auditId, linked: res.linked });
      } else {
        setError(res.error || "Auditing submission failed. Please verify your NPI details.");
      }
    } catch {
      setLoading(false);
      setError("A connection error occurred. Our verification servers are momentarily loaded.");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col justify-between relative overflow-hidden">
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
          <span className="text-[10px] font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded ml-2 tracking-wider">
            CREDENTIALING
          </span>
        </Link>
        <Link href="/doctor/signin" className="text-xs font-bold text-slate-450 hover:text-slate-100 transition-colors">
          Return to Portal Sign In
        </Link>
      </header>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center px-4 py-12 relative z-10">
        <div className="max-w-2xl w-full bg-slate-900 border border-slate-850 rounded-2xl p-6 sm:p-10 shadow-2xl">
          {!successData ? (
            <>
              {/* Title */}
              <div className="space-y-2 mb-8">
                <span className="text-[9px] font-black text-brand-teal uppercase bg-brand-teal/10 border border-brand-teal/15 px-2.5 py-1 rounded-full tracking-widest">
                  Primary Source Verification
                </span>
                <h1 className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Physician Credentials Audit
                </h1>
                <p className="text-slate-400 text-xs sm:text-sm font-medium leading-relaxed">
                  Submit NPI records and state-licensure certificates to verify your clinical standing for digital consultations.
                </p>
              </div>

              {/* Step progress */}
              <div className="mb-8">
                <div className="flex items-center justify-between text-xs font-bold text-slate-450 mb-2">
                  <span>
                    Step {step} of 4:{" "}
                    {step === 1
                      ? "Clinical Identity"
                      : step === 2
                      ? "Licensure & Experience"
                      : step === 3
                      ? "Supporting Documentation"
                      : "Compliance & Consent"}
                  </span>
                  <span>{step * 25}% Complete</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-brand-teal h-full transition-all duration-500 ease-out shadow-lg shadow-brand-teal/30"
                    style={{ width: `${step * 25}%` }}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-brand-red/10 border border-brand-red/15 text-brand-red font-bold text-xs rounded-xl mb-6 animate-fade-in">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmitAudit} className="space-y-6">
                {/* ── STEP 1: Clinical Identity ── */}
                {step === 1 && (
                  <div className="space-y-5 animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                        10-Digit National Provider Identifier (NPI)
                      </label>
                      <input
                        type="text"
                        required
                        value={npi}
                        onChange={(e) => setNpi(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="e.g. 1982736450"
                        className={`w-full px-4 py-3 rounded-xl bg-slate-950 border text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all ${
                          isNpiInvalid ? "border-brand-red" : "border-slate-800"
                        }`}
                      />
                      {isNpiInvalid && (
                        <p className="text-[10px] text-brand-red font-bold mt-1.5">
                          NPI must be exactly 10 numeric digits.
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                        Your NPI will be authenticated against the NPPES registry to confirm primary licensing credentials.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                        Primary Clinical Specialty
                      </label>
                      <select
                        required
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                      >
                        <option value="">Select your medical board specialty...</option>
                        {SPECIALTIES.map((spec) => (
                          <option key={spec.value} value={spec.value} className="bg-slate-950 text-slate-300">
                            {spec.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* ── STEP 2: Licensure & Credentials ── */}
                {step === 2 && (
                  <div className="space-y-5 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                          State Medical License Number
                        </label>
                        <input
                          type="text"
                          required
                          value={licenseNumber}
                          onChange={(e) => setLicenseNumber(e.target.value)}
                          placeholder="e.g. C145892"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                          Issuing Medical Board State
                        </label>
                        <select
                          required
                          value={licenseState}
                          onChange={(e) => setLicenseState(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                        >
                          <option value="">State...</option>
                          {STATES.map((st) => (
                            <option key={st} value={st} className="bg-slate-950 text-slate-300">
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                          Years of Clinical Practice
                        </label>
                        <input
                          type="number"
                          required
                          min={0}
                          max={60}
                          value={yearsExp}
                          onChange={(e) => setYearsExp(e.target.value)}
                          placeholder="e.g. 12"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                          Medical School Graduation Year
                        </label>
                        <input
                          type="number"
                          required
                          min={1960}
                          max={new Date().getFullYear()}
                          value={gradYear}
                          onChange={(e) => setGradYear(e.target.value)}
                          placeholder="e.g. 2012"
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                        Medical School / University
                      </label>
                      <input
                        type="text"
                        required
                        value={medicalSchool}
                        onChange={(e) => setMedicalSchool(e.target.value)}
                        placeholder="e.g. Johns Hopkins School of Medicine"
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* ── STEP 3: Supabase Storage Upload ── */}
                {step === 3 && (
                  <div className="space-y-5 animate-fade-in">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-wider">
                      Attach License / Certifications (PDF, PNG, JPG · max 10 MB)
                    </label>

                    {/* Drop zone */}
                    <div className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center bg-slate-950 transition-all duration-300 relative group cursor-pointer ${
                      documentUrl
                        ? "border-brand-teal/60 bg-brand-teal/5"
                        : "border-slate-800 hover:bg-slate-900 hover:border-brand-teal/50"
                    }`}>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                      />

                      {documentUrl ? (
                        <svg className="w-10 h-10 text-brand-teal mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-10 h-10 text-slate-500 group-hover:text-brand-teal transition-colors mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      )}

                      <span className="text-xs font-bold text-slate-200">
                        {documentUrl
                          ? "Document uploaded — click to replace"
                          : fileName
                          ? fileName
                          : "Drag & drop or click to select file"}
                      </span>
                      <span className="text-[10px] text-slate-500 mt-1">
                        {documentUrl ? "Secured in HealthKo HIPAA Vault" : "PDF, PNG, JPEG · max 10 MB"}
                      </span>
                    </div>

                    {/* Upload progress */}
                    {fileName && (
                      <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-2 animate-fade-in">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-300 truncate max-w-xs">{fileName}</span>
                          <span className={`${uploadProgress === 100 ? "text-brand-teal" : "text-amber-400"} shrink-0 ml-2`}>
                            {isUploading
                              ? `${uploadProgress}% Uploading…`
                              : uploadProgress === 100
                              ? "✓ Secured in Bucket"
                              : `${uploadProgress}%`}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              uploadProgress === 100 ? "bg-brand-teal" : "bg-amber-400"
                            }`}
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        {documentUrl && (
                          <p className="text-[10px] text-slate-500 break-all">
                            Storage URL: <span className="text-brand-teal/70">{documentUrl}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {/* Upload error */}
                    {uploadError && (
                      <div className="p-3 bg-brand-red/10 border border-brand-red/15 text-brand-red font-bold text-xs rounded-xl animate-fade-in">
                        {uploadError}
                      </div>
                    )}
                  </div>
                )}

                {/* ── STEP 4: Attestation & Compliance ── */}
                {step === 4 && (
                  <div className="space-y-5 animate-fade-in">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                        Practitioner Account Link Email (Optional)
                      </label>
                      <input
                        type="email"
                        value={doctorEmail}
                        onChange={(e) => setDoctorEmail(e.target.value)}
                        placeholder="doctor@clinic.com"
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                      />
                      <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                        Provide the email linked to your practitioner portal account to automatically attach these credentials to your profile once approved.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl text-[11px] leading-relaxed text-slate-400 space-y-3 max-h-40 overflow-y-auto">
                      <p className="font-extrabold text-slate-200">HIPAA & BACKGROUND CHECK DISCLOSURE & CONSENT</p>
                      <p>
                        By checking the box below and entering your digital signature, you hereby authorize HealthKo Technologies, Inc. and its designated validation agents to conduct primary source verification (PSV) of your state medical credentials, National Provider Identifier (NPI) standing, board certifications, and educational graduation records.
                      </p>
                      <p>
                        This audit will be conducted in accordance with the Fair Credit Reporting Act (FCRA) and medical compliance standards required under NCQA credentialing regulations. You attest that all information submitted is true, correct, and current to the best of your medical legal knowledge.
                      </p>
                    </div>

                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="attestation-consent"
                        required
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-800 text-brand-teal bg-slate-950 mt-0.5 focus:ring-brand-teal/20"
                      />
                      <label htmlFor="attestation-consent" className="ml-3 block text-xs font-bold text-slate-400 select-none leading-relaxed">
                        I hereby attest that the information provided is fully accurate, and I consent to a compliance background credentials audit.
                      </label>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-wider">
                        Medical Practitioner Digital Signature
                      </label>
                      <input
                        type="text"
                        required
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                        placeholder="Type your full legal name to sign"
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm font-display italic font-bold text-brand-teal placeholder-slate-650 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Nav Buttons */}
                <div className="flex justify-between items-center pt-6 border-t border-slate-850">
                  {step > 1 ? (
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-5 py-3 rounded-xl bg-slate-850 hover:bg-slate-800 text-xs sm:text-sm font-bold text-slate-200 transition-all"
                    >
                      Back
                    </button>
                  ) : (
                    <div />
                  )}

                  {step < 4 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      disabled={step === 3 && isUploading}
                      className="px-6 py-3 rounded-xl bg-brand-teal hover:bg-brand-teal-hover text-xs sm:text-sm font-bold text-white transition-all shadow-md shadow-brand-teal/15 flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-wait"
                    >
                      <span>Continue</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-3 rounded-xl bg-brand-teal hover:bg-brand-teal-hover text-xs sm:text-sm font-bold text-white transition-all shadow-md shadow-brand-teal/15 disabled:bg-slate-800 disabled:shadow-none flex items-center justify-center space-x-2"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Submitting Audit…</span>
                        </>
                      ) : (
                        <span>Authorize & Submit Audit</span>
                      )}
                    </button>
                  )}
                </div>
              </form>
            </>
          ) : (
            /* ── Success State ── */
            <div className="py-8 text-center space-y-6 animate-fade-in">
              <div className="h-16 w-16 rounded-full bg-brand-teal/10 border-2 border-brand-teal/30 flex items-center justify-center text-brand-teal mx-auto">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4" />
                </svg>
              </div>

              <div className="space-y-2">
                <h2 className="font-display text-2xl font-black text-white tracking-tight">
                  Verification Audit Initiated
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm font-medium max-w-md mx-auto leading-relaxed">
                  Your credentials and supporting documents have been securely stored in the HealthKo HIPAA Vault and queued for primary source validation.
                </p>
              </div>

              <div className="p-5 bg-slate-950 border border-slate-850 rounded-2xl max-w-sm mx-auto space-y-3.5 text-left text-xs font-bold text-slate-350">
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span>AUDIT RECORD ID</span>
                  <span className="text-white font-mono select-all truncate max-w-[180px]">{successData.auditId}</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span>DOCUMENT VAULT</span>
                  <span className="text-brand-teal">SECURED ✓</span>
                </div>
                <div className="flex justify-between border-b border-slate-900 pb-2">
                  <span>REGISTRY LOOKUP</span>
                  <span className="text-brand-teal">PENDING NPPES AUDIT</span>
                </div>
                <div className="flex justify-between">
                  <span>PORTAL STATUS</span>
                  <span className="text-white">{successData.linked ? "LINKED TO ACCOUNT" : "UNRESOLVED ACCOUNT"}</span>
                </div>
              </div>

              <div className="pt-6 space-y-3">
                <Link
                  href="/doctor/signin"
                  className="inline-block bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl transition-all"
                >
                  Return to Portal Sign In
                </Link>
                <p className="text-[10px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Credential auditing typically completes within 24–48 business hours. You will receive an encrypted verification email once completed.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-900 py-6 px-6 text-center select-none text-[10px] text-slate-550 font-bold uppercase tracking-wider relative z-10">
        © {new Date().getFullYear()} HealthKo Technologies, Inc. • HIPAA Compliance Security Vault
      </footer>
    </div>
  );
}
