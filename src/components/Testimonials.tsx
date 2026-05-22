"use client";

export default function Testimonials() {
  const testimonials = [
    {
      name: "Arthur Pendelton",
      role: "Heart Patient",
      rating: 5,
      text: "The convenience of getting my EKG records analyzed by Dr. Jenkins within minutes saved me a trip to the emergency room. The interface is incredibly fast and secure.",
      category: "Cardiology Care",
      avatarInitials: "AP",
      avatarBg: "bg-brand-red text-white",
    },
    {
      name: "Emily Watson",
      role: "Diabetes Care Patient",
      rating: 5,
      text: "Managing my blood sugar trends and prescription refills on HealthKo has made my diabetes care effortless. I can sync my monitor directly to the health vault.",
      category: "Chronic Disease Mgmt",
      avatarInitials: "EW",
      avatarBg: "bg-brand-teal text-white",
    },
    {
      name: "Marcus Vance",
      role: "Software Architect",
      rating: 5,
      text: "I booked a video consultation during my lunch break, received my diagnosis, and had my medication sent to my local pharmacy. The tech is top-tier and highly professional.",
      category: "Remote Care",
      avatarInitials: "MV",
      avatarBg: "bg-indigo-600 text-white",
    },
    {
      name: "Dr. Aris Thorne, MD",
      role: "Clinic Director, Vanguard Pract.",
      rating: 5,
      text: "Integrating HealthKo into our family practices reduced queue congestion by 40% and drastically improved patient follow-up compliance. The encrypted clinical records system is seamless.",
      category: "Healthcare Partner",
      avatarInitials: "AT",
      avatarBg: "bg-slate-800 text-white",
    },
  ];

  return (
    <section id="testimonials" className="py-24 bg-white relative overflow-hidden">
      {/* Visual background details */}
      <div className="absolute top-20 right-0 w-80 h-80 rounded-full bg-brand-teal/5 blur-3xl" />
      <div className="absolute bottom-10 left-10 w-96 h-96 rounded-full bg-brand-red/5 blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-20">
          <h2 className="text-xs uppercase tracking-widest font-black text-brand-teal">
            Patient & Provider Reviews
          </h2>
          <h3 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            Loved by Patients. Trusted by Clinicians.
          </h3>
          <p className="text-slate-500 font-medium text-lg leading-relaxed">
            Discover how HealthKo is changing the healthcare experience for thousands of families and medical practitioners every day.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {testimonials.map((test, index) => (
            <div
              key={index}
              className="p-8 rounded-3xl bg-[#FAFBFD] border border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-2xl hover:shadow-slate-100/80 transition-all duration-300 flex flex-col justify-between"
            >
              <div className="space-y-6">
                {/* Rating & Category header */}
                <div className="flex items-center justify-between">
                  <div className="flex space-x-1">
                    {[...Array(test.rating)].map((_, i) => (
                      <svg
                        key={i}
                        className="w-5 h-5 text-amber-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md uppercase">
                    {test.category}
                  </span>
                </div>

                {/* Text Quote */}
                <p className="text-slate-600 text-sm font-medium leading-relaxed italic">
                  &quot;{test.text}&quot;
                </p>
              </div>

              {/* Avatar and name details */}
              <div className="flex items-center space-x-4 mt-8 pt-6 border-t border-slate-100">
                <div
                  className={`h-11 w-11 rounded-full flex items-center justify-center font-extrabold text-sm select-none shadow-md ${test.avatarBg}`}
                >
                  {test.avatarInitials}
                </div>
                <div>
                  <h4 className="font-display font-black text-slate-900 text-sm">
                    {test.name}
                  </h4>
                  <p className="text-slate-400 text-xs font-semibold">
                    {test.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
