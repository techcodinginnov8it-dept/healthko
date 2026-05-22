"use client";

export default function WhyChooseUs() {
  const comparisons = [
    {
      metric: "Physician Wait Time",
      healthko: "Under 10 minutes",
      traditional: "18.5 days average",
      highlight: true,
    },
    {
      metric: "Travel & Parking",
      healthko: "Zero (Consult anywhere)",
      traditional: "1.5 hours + costs",
      highlight: false,
    },
    {
      metric: "Medical Records",
      healthko: "Secure HIPAA Vault",
      traditional: "Paper-based / Isolated silos",
      highlight: false,
    },
    {
      metric: "Prescription Delivery",
      healthko: "Instant e-prescribe & delivery",
      traditional: "Wait at pharmacy counter",
      highlight: false,
    },
    {
      metric: "Consultation Costs",
      healthko: "Flat rate / Insurance support",
      traditional: "Co-pays + hidden facility fees",
      highlight: true,
    },
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-[#F2F7FA] to-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-12 gap-16 items-center">
          
          {/* Left Column: Comparisons Table */}
          <div className="lg:col-span-7 space-y-8 animate-slide-up">
            <div className="space-y-4 text-center lg:text-left">
              <span className="text-xs uppercase tracking-widest font-black text-brand-red">
                Why Choose HealthKo
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Setting a New Standard for Clinical Care
              </h2>
              <p className="text-slate-500 font-medium text-sm leading-relaxed max-w-xl mx-auto lg:mx-0">
                Traditional clinical visits are outdated, expensive, and stressful. HealthKo uses digital orchestration to deliver superior, faster care at lower rates.
              </p>
            </div>

            {/* Comparison Matrix Table Mockup */}
            <div className="rounded-2xl border border-slate-100 bg-white shadow-xl overflow-hidden">
              <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-100 bg-slate-50 text-[10px] uppercase font-black tracking-wider text-slate-400">
                <div className="col-span-5">Healthcare Metric</div>
                <div className="col-span-4 text-brand-teal">HealthKo</div>
                <div className="col-span-3 text-slate-500">Traditional</div>
              </div>
              <div className="divide-y divide-slate-100">
                {comparisons.map((row, index) => (
                  <div
                    key={index}
                    className={`grid grid-cols-12 gap-4 p-4 items-center text-xs transition-colors hover:bg-slate-50/50 ${
                      row.highlight ? "bg-brand-teal-tint/10" : ""
                    }`}
                  >
                    <div className="col-span-5 font-extrabold text-slate-800">{row.metric}</div>
                    <div className="col-span-4 font-black text-brand-teal flex items-center space-x-1.5">
                      <svg className="w-4 h-4 text-brand-teal flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4" />
                      </svg>
                      <span>{row.healthko}</span>
                    </div>
                    <div className="col-span-3 font-semibold text-slate-400">{row.traditional}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Visual highlight list */}
          <div className="lg:col-span-5 space-y-8">
            <div className="p-8 rounded-3xl bg-slate-900 text-white shadow-2xl space-y-6 relative overflow-hidden">
              {/* Overlay graphics */}
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-brand-teal/20 blur-2xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-brand-red/10 blur-2xl" />

              <h3 className="font-display text-2xl font-black tracking-tight relative z-10">
                Designed for Absolute Trust & Confidentiality
              </h3>

              <div className="space-y-6 relative z-10">
                <div className="flex items-start space-x-4">
                  <div className="h-10 w-10 rounded-xl bg-brand-teal/20 flex items-center justify-center text-brand-teal flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-100">Military-Grade Encryption</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">
                      All video consults, chats, and medical records are secured under AES-256 standards. Your files are accessible only to you and authorized doctors.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="h-10 w-10 rounded-xl bg-brand-red/20 flex items-center justify-center text-brand-red flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-100">Board-Certified Clinicians</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">
                      Every practitioner on HealthKo undergoes rigorous credentials audits, background screening, and clinical standards onboarding.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-100">Transparent Co-Pay Billing</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1">
                      No surprise charges. We verify insurance co-pays before you book, or offer flat pricing for out-of-network consults.
                    </p>
                  </div>
                </div>
              </div>

              {/* Compliance Badges Strip */}
              <div className="pt-6 border-t border-slate-800 flex items-center justify-between text-[9px] font-bold text-slate-500 tracking-wider">
                <span>HIPAA COMPLIANT</span>
                <span>•</span>
                <span>SOC2 TYPE II SECURE</span>
                <span>•</span>
                <span>FDA COMPLIANT INTEGRATIONS</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
