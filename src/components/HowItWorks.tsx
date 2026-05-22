"use client";

export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Create Your Profile",
      description: "Sign up in under two minutes. Fill out your medical background, active allergies, and insurance details to compile your secure electronic health file.",
      badge: "Account Setup",
      colorClass: "border-brand-teal text-brand-teal bg-brand-teal-tint",
      svg: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
    },
    {
      number: "02",
      title: "Consult Certified Doctors",
      description: "Browse medical specialists, check live availability slots, and book your consult. Connect in high-definition video directly in-browser on any device.",
      badge: "Virtual Visit",
      colorClass: "border-brand-red text-brand-red bg-brand-red-tint",
      svg: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      number: "03",
      title: "Receive Premium Care",
      description: "Receive instant electronic prescriptions sent directly to your pharmacy. Access clinical session summaries and track health trends through your dashboard.",
      badge: "Get Prescriptions",
      colorClass: "border-emerald-500 text-emerald-500 bg-emerald-50",
      svg: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="how-it-works" className="py-24 bg-white relative overflow-hidden">
      {/* Visual background details */}
      <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-brand-red/5 blur-3xl" />
      <div className="absolute bottom-10 right-10 w-72 h-72 rounded-full bg-brand-teal/5 blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-20">
          <h2 className="text-xs uppercase tracking-widest font-black text-brand-teal">
            Simple 3-Step Process
          </h2>
          <h3 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            How HealthKo Works for You
          </h3>
          <p className="text-slate-500 font-medium text-lg leading-relaxed">
            We&apos;ve simplified virtual clinic visits down to a straightforward process so you can focus on recovering rather than navigating paperwork.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="relative">
          {/* Connecting line for desktop */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-dashed bg-slate-200 -translate-y-12 hidden lg:block" style={{ borderStyle: 'dashed', borderWidth: '1px' }} />

          <div className="grid lg:grid-cols-3 gap-12 relative z-10">
            {steps.map((step, index) => (
              <div
                key={index}
                className="group flex flex-col items-center text-center space-y-6"
              >
                {/* Visual Step bubble with index */}
                <div className="relative">
                  <div
                    className={`h-20 w-20 rounded-full border-2 flex items-center justify-center ${step.colorClass} shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:rotate-6`}
                  >
                    {step.svg}
                  </div>
                  {/* Floating Number index badge */}
                  <span className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center shadow-lg">
                    {step.number}
                  </span>
                </div>

                {/* Step Metadata Card */}
                <div className="p-6 rounded-2xl bg-[#FAFBFD] border border-slate-100 group-hover:bg-white group-hover:border-slate-200 group-hover:shadow-2xl group-hover:shadow-slate-100/80 transition-all duration-300 space-y-3 w-full">
                  <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                    {step.badge}
                  </span>
                  <h4 className="font-display text-xl font-black text-slate-900">
                    {step.title}
                  </h4>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
