"use client";

import { useState } from "react";

type TabId = "patient" | "doctor" | "video" | "records";

export default function DashboardPreview() {
  const [activeTab, setActiveTab] = useState<TabId>("patient");

  // State for interactive features in mockup
  const [notes, setNotes] = useState("Patient reports minor chest tightness during cardiovascular exercises. Last EKG reports normal sinus rhythm.");
  const [sharedFiles, setSharedFiles] = useState({
    ekg: true,
    blood: true,
    vaccine: false,
  });
  const [activeQueueId, setActiveQueueId] = useState(1);
  const [chatMessages, setChatMessages] = useState([
    { sender: "Dr. Jenkins", text: "Hello Arthur, I am reviewing your EKG results now." },
    { sender: "You", text: "Thank you doctor. I was feeling a bit of tightness yesterday." },
    { sender: "Dr. Jenkins", text: "We will go through it and adjust your prescription if needed." },
  ]);
  const [newMessage, setNewMessage] = useState("");

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setChatMessages([...chatMessages, { sender: "You", text: newMessage }]);
    setNewMessage("");
  };

  const queue = [
    { id: 1, name: "Arthur Pendelton", time: "4:00 PM", type: "Video Consult", reason: "EKG Review" },
    { id: 2, name: "Emily Watson", time: "4:30 PM", type: "Follow-up", reason: "Diabetes Mgmt" },
    { id: 3, name: "Marcus Vance", time: "5:15 PM", type: "Prescription Review", reason: "Refill check" },
  ];

  return (
    <section id="dashboard-preview" className="py-24 bg-gradient-to-b from-white to-[#F2F7FA] relative overflow-hidden">
      {/* Decorative background gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-brand-teal/5 blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-brand-red/5 blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <h2 className="text-xs uppercase tracking-widest font-black text-brand-red">
            Interactive Product Demo
          </h2>
          <h3 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            See the Platform in Action
          </h3>
          <p className="text-slate-500 font-medium text-lg leading-relaxed">
            Click through the tabs below to explore the portal features built for patients, doctors, and real-time care.
          </p>
        </div>

        {/* Tab Controllers */}
        <div className="flex flex-wrap justify-center gap-2 mb-10 max-w-4xl mx-auto p-1.5 rounded-2xl bg-slate-100 border border-slate-200/50">
          <button
            onClick={() => setActiveTab("patient")}
            className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === "patient"
                ? "bg-white text-brand-teal shadow-md"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Patient Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab("doctor")}
            className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === "doctor"
                ? "bg-white text-brand-teal shadow-md"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span>Doctor Workspace</span>
          </button>

          <button
            onClick={() => setActiveTab("video")}
            className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === "video"
                ? "bg-white text-brand-teal shadow-md"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Video Consultation</span>
          </button>

          <button
            onClick={() => setActiveTab("records")}
            className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === "records"
                ? "bg-white text-brand-teal shadow-md"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" />
            </svg>
            <span>Secure Records</span>
          </button>
        </div>

        {/* Mockup Canvas */}
        <div className="w-full max-w-5xl mx-auto rounded-3xl bg-slate-900 p-3 shadow-2xl border border-slate-800 relative">
          {/* Mock Browser Header */}
          <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-[#D30026]" />
              <span className="w-3 h-3 rounded-full bg-yellow-400" />
              <span className="w-3 h-3 rounded-full bg-brand-teal" />
            </div>
            <div className="px-4 py-1 rounded-full bg-slate-800 text-[10px] text-slate-400 font-mono tracking-wide w-64 text-center truncate">
              portal.healthko.com/{activeTab}
            </div>
            <span className="text-slate-500 font-bold text-xs">HTTPS Secure</span>
          </div>

          {/* Active Tab View */}
          <div className="bg-slate-950 text-slate-100 p-6 rounded-2xl mt-3 min-h-[460px] flex flex-col justify-between font-sans">
            
            {/* 1. Patient Dashboard Tab */}
            {activeTab === "patient" && (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                {/* Header */}
                <div className="flex justify-between items-center pb-4 border-b border-slate-900">
                  <div>
                    <h4 className="text-lg font-black tracking-tight">Welcome back, Arthur</h4>
                    <p className="text-xs text-slate-400">Patient ID: HK-94821 • Insurance Status: Active</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-slate-300 font-semibold bg-slate-900 px-3 py-1 rounded-full">
                      Sync Status: OK
                    </span>
                  </div>
                </div>

                {/* Grid */}
                <div className="grid md:grid-cols-3 gap-4 flex-1 my-2">
                  {/* Left - Vitals Card */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                      Active Vitals
                    </span>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900">
                        <span className="text-[10px] text-slate-400 font-bold block">HEART RATE</span>
                        <span className="font-extrabold text-lg text-brand-red">72 BPM</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900">
                        <span className="text-[10px] text-slate-400 font-bold block">BLOOD PRESS.</span>
                        <span className="font-extrabold text-lg text-brand-teal">120/80</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900">
                        <span className="text-[10px] text-slate-400 font-bold block">OXYGEN SAT.</span>
                        <span className="font-extrabold text-lg text-green-400">98%</span>
                      </div>
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-900">
                        <span className="text-[10px] text-slate-400 font-bold block">BLOOD SUGAR</span>
                        <span className="font-extrabold text-lg text-amber-400">95 mg/dL</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle - Consultation Alert */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">
                        Upcoming Consultation
                      </span>
                      <div className="flex items-center space-x-3 mb-4">
                        <span className="h-10 w-10 rounded-full bg-brand-teal text-white font-extrabold text-sm flex items-center justify-center">
                          SJ
                        </span>
                        <div>
                          <h5 className="font-bold text-sm">Dr. Sarah Jenkins</h5>
                          <p className="text-xs text-slate-400">Cardiology Specialist</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 font-medium">
                        Today at 4:00 PM (In 15 mins) • Video Call
                      </p>
                    </div>

                    <button
                      onClick={() => setActiveTab("video")}
                      className="w-full mt-4 bg-brand-teal hover:bg-brand-teal-hover text-white font-bold py-2 px-4 rounded-lg text-xs shadow-lg shadow-brand-teal/20 transition-all flex items-center justify-center space-x-2"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                      <span>Join Consultation Video Call</span>
                    </button>
                  </div>

                  {/* Right - Prescription Tracker */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                      Active Medications
                    </span>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-900">
                        <div>
                          <span className="text-xs font-bold block">Lipitor (10mg)</span>
                          <span className="text-[10px] text-slate-400">Take once daily before sleep</span>
                        </div>
                        <span className="text-[9px] font-bold text-brand-teal bg-brand-teal-tint/10 px-2 py-0.5 rounded border border-brand-teal/20">
                          2 Refills
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-900">
                        <div>
                          <span className="text-xs font-bold block">Amoxicillin (500mg)</span>
                          <span className="text-[10px] text-slate-400">Twice daily for 7 days</span>
                        </div>
                        <span className="text-[9px] font-bold text-brand-red bg-brand-red-tint/10 px-2 py-0.5 rounded border border-brand-red/20">
                          Course Active
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mini chart visual */}
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
                    <span>WEEKLY VITALS HISTORY (HEART RATE TREND)</span>
                    <span className="text-[10px] text-slate-500">60 - 90 BPM TARGET</span>
                  </div>
                  <svg className="w-full h-12 text-brand-teal" viewBox="0 0 500 40" fill="none">
                    <path
                      d="M0,30 L50,28 L100,32 L150,20 L200,24 L250,15 L300,18 L350,22 L400,14 L450,20 L500,15"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M0,30 L50,28 L100,32 L150,20 L200,24 L250,15 L300,18 L350,22 L400,14 L450,20 L500,15 L500,40 L0,40 Z"
                      fill="url(#tealGrad)"
                      opacity="0.1"
                    />
                    <defs>
                      <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="currentColor" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
            )}

            {/* 2. Doctor Workspace Tab */}
            {activeTab === "doctor" && (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                {/* Header */}
                <div className="flex justify-between items-center pb-4 border-b border-slate-900">
                  <div>
                    <h4 className="text-lg font-black tracking-tight">Dr. Sarah Jenkins, MD</h4>
                    <p className="text-xs text-slate-400">Cardiology Specialist • Provider License: HK-DOC-028</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-slate-300">Accepting Calls</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-12 gap-4 flex-1 my-2">
                  {/* Left 4 cols: Today's Queue */}
                  <div className="md:col-span-4 p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
                      Today&apos;s Patient Queue
                    </span>
                    <div className="space-y-2">
                      {queue.map((pt) => (
                        <button
                          key={pt.id}
                          onClick={() => setActiveQueueId(pt.id)}
                          className={`w-full text-left p-2.5 rounded-lg border transition-all text-xs ${
                            activeQueueId === pt.id
                              ? "bg-brand-teal/20 border-brand-teal text-white font-bold"
                              : "bg-slate-950 border-slate-900 hover:border-slate-800 text-slate-300"
                          }`}
                        >
                          <div className="flex justify-between font-bold mb-0.5">
                            <span>{pt.name}</span>
                            <span className="text-brand-red">{pt.time}</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>{pt.type}</span>
                            <span>{pt.reason}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Middle 5 cols: Active Panel Patient Info & Notes */}
                  <div className="md:col-span-5 p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                        <span className="text-xs font-bold text-slate-300 uppercase">
                          Active Consultation Note
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {queue.find((pt) => pt.id === activeQueueId)?.name}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[11px] text-slate-400">
                          Type notes dynamically below. Changes are auto-saved to secure electronic health records.
                        </p>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={6}
                          className="w-full text-xs p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-brand-teal resize-none font-mono"
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold mt-3">
                      AUTO-SAVE SECURED VIA AES-256 ENCRYPTION
                    </div>
                  </div>

                  {/* Right 3 cols: Quick actions */}
                  <div className="md:col-span-3 p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
                      Tools & Actions
                    </span>
                    <div className="space-y-2.5 flex-1 flex flex-col justify-center">
                      <button className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold py-2 rounded-lg text-xs transition-colors">
                        Write Prescription
                      </button>
                      <button className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold py-2 rounded-lg text-xs transition-colors">
                        Order Lab Test
                      </button>
                      <button
                        onClick={() => setActiveTab("records")}
                        className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold py-2 rounded-lg text-xs transition-colors"
                      >
                        View EHR Vault
                      </button>
                    </div>
                    <button
                      onClick={() => setActiveTab("video")}
                      className="w-full mt-4 bg-brand-red hover:bg-brand-red-hover text-white font-bold py-2 rounded-lg text-xs shadow-lg transition-all"
                    >
                      Connect Video Call
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Video Consultation Tab */}
            {activeTab === "video" && (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                <div className="grid md:grid-cols-12 gap-4 flex-1">
                  {/* Left 8 cols: Video Feed */}
                  <div className="md:col-span-8 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden relative flex flex-col justify-between min-h-[300px]">
                    {/* Header bar overlay */}
                    <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center z-10">
                      <div className="flex items-center space-x-2">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs font-bold text-white shadow-sm">
                          LIVE CONSULTATION • DR. SARAH JENKINS
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-300 font-bold bg-black/40 px-2 py-0.5 rounded backdrop-blur">
                        HD 1080p • Encrypted
                      </span>
                    </div>

                    {/* Main "Doctor Screen" representation (styled silhouette) */}
                    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-tr from-slate-900 via-brand-teal/10 to-slate-900 relative">
                      <div className="h-24 w-24 rounded-full bg-brand-teal text-white font-extrabold text-3xl flex items-center justify-center shadow-2xl border-4 border-slate-800">
                        SJ
                      </div>
                      <h5 className="font-extrabold text-sm mt-4 text-slate-100">Dr. Sarah Jenkins</h5>
                      <p className="text-xs text-slate-400">Active Video Connection</p>

                      {/* Small overlay window in corner (Patient's camera) */}
                      <div className="absolute bottom-4 right-4 h-24 w-32 rounded-lg bg-slate-950 border border-slate-800 shadow-xl overflow-hidden flex flex-col items-center justify-center">
                        <div className="h-8 w-8 rounded-full bg-brand-red text-white font-extrabold text-xs flex items-center justify-center border-2 border-slate-800">
                          AP
                        </div>
                        <span className="text-[8px] text-slate-400 mt-1 font-bold">Arthur (You)</span>
                      </div>
                    </div>

                    {/* Bottom overlay controls */}
                    <div className="p-3 bg-slate-950/90 border-t border-slate-900 flex justify-center space-x-4">
                      <button className="h-9 w-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors">
                        {/* Mic Icon */}
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </button>
                      <button className="h-9 w-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors">
                        {/* Camera Icon */}
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button className="h-9 w-9 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors">
                        {/* Desktop icon */}
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setActiveTab("patient")}
                        className="px-4 py-1.5 rounded-full bg-brand-red hover:bg-brand-red-hover text-white font-bold text-xs flex items-center space-x-1.5 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 8l2 2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5z" />
                        </svg>
                        <span>End Visit</span>
                      </button>
                    </div>
                  </div>

                  {/* Right 4 cols: Interactive Chat */}
                  <div className="md:col-span-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between overflow-hidden">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest p-3 border-b border-slate-800 block">
                      Consultation Chat
                    </span>

                    {/* Message Log */}
                    <div className="flex-1 p-3 overflow-y-auto space-y-2.5 max-h-[220px] text-xs no-scrollbar">
                      {chatMessages.map((msg, index) => (
                        <div
                          key={index}
                          className={`p-2 rounded-lg max-w-[85%] ${
                            msg.sender === "You"
                              ? "bg-brand-teal text-white ml-auto"
                              : "bg-slate-950 border border-slate-800 text-slate-200"
                          }`}
                        >
                          <span className="block text-[8px] opacity-75 font-bold uppercase mb-0.5">
                            {msg.sender}
                          </span>
                          <span className="font-medium leading-relaxed">{msg.text}</span>
                        </div>
                      ))}
                    </div>

                    {/* Chat Form */}
                    <form onSubmit={handleSendMessage} className="p-2.5 border-t border-slate-800 flex space-x-2 bg-slate-950">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type message..."
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-teal"
                      />
                      <button
                        type="submit"
                        className="bg-brand-teal hover:bg-brand-teal-hover text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      >
                        Send
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Secure Records Tab */}
            {activeTab === "records" && (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                {/* Header */}
                <div className="flex justify-between items-center pb-4 border-b border-slate-900">
                  <div>
                    <h4 className="text-lg font-black tracking-tight">Electronic Health Vault</h4>
                    <p className="text-xs text-slate-400">HIPAA Compliant Vault • AES-256 Storage</p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 text-xs px-3 py-1 rounded-full text-brand-teal font-extrabold flex items-center space-x-2">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>Shield Protection Active</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-12 gap-5 flex-1 my-2">
                  {/* Left 7 cols: Files list */}
                  <div className="md:col-span-7 p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Uploaded Medical Documents
                    </span>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-900 text-xs">
                        <div className="flex items-center space-x-3">
                          {/* PDF Icon */}
                          <div className="h-8 w-8 rounded bg-brand-red-tint/10 text-brand-red border border-brand-red/20 flex items-center justify-center font-bold text-[10px]">
                            PDF
                          </div>
                          <div>
                            <span className="font-bold block">EKG_Scan_May2026.pdf</span>
                            <span className="text-[9px] text-slate-500">2.4 MB • Uploaded May 10, 2026</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20 font-bold">
                          Verified
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-900 text-xs">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded bg-brand-red-tint/10 text-brand-red border border-brand-red/20 flex items-center justify-center font-bold text-[10px]">
                            PDF
                          </div>
                          <div>
                            <span className="font-bold block">Blood_Panel_Apr2026.pdf</span>
                            <span className="text-[9px] text-slate-500">1.1 MB • Uploaded Apr 24, 2026</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20 font-bold">
                          Verified
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-900 text-xs">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded bg-brand-red-tint/10 text-brand-red border border-brand-red/20 flex items-center justify-center font-bold text-[10px]">
                            PDF
                          </div>
                          <div>
                            <span className="font-bold block">COVID_Vaccine_Record.pdf</span>
                            <span className="text-[9px] text-slate-500">850 KB • Uploaded Dec 12, 2024</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20 font-bold">
                          Verified
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right 5 cols: Permissions manager */}
                  <div className="md:col-span-5 p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between text-xs">
                    <div>
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-widest block mb-2">
                        Vault Permissions Manager
                      </span>
                      <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                        Control doctor access to files. Toggle to authorize/revoke visibility in real-time.
                      </p>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-900">
                          <div>
                            <span className="font-bold block">EKG_Scan_May2026.pdf</span>
                            <span className="text-[9px] text-slate-500">Access for Dr. Sarah Jenkins</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSharedFiles({ ...sharedFiles, ekg: !sharedFiles.ekg })}
                            className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 focus:outline-none ${
                              sharedFiles.ekg ? "bg-brand-teal" : "bg-slate-800"
                            }`}
                          >
                            <div
                              className={`h-4 w-4 rounded-full bg-white transition-transform duration-300 ${
                                sharedFiles.ekg ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-900">
                          <div>
                            <span className="font-bold block">Blood_Panel_Apr2026.pdf</span>
                            <span className="text-[9px] text-slate-500">Access for Dr. Sarah Jenkins</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSharedFiles({ ...sharedFiles, blood: !sharedFiles.blood })}
                            className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 focus:outline-none ${
                              sharedFiles.blood ? "bg-brand-teal" : "bg-slate-800"
                            }`}
                          >
                            <div
                              className={`h-4 w-4 rounded-full bg-white transition-transform duration-300 ${
                                sharedFiles.blood ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-900">
                          <div>
                            <span className="font-bold block">COVID_Vaccine_Record.pdf</span>
                            <span className="text-[9px] text-slate-500">Access for Dr. Sarah Jenkins</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSharedFiles({ ...sharedFiles, vaccine: !sharedFiles.vaccine })}
                            className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-300 focus:outline-none ${
                              sharedFiles.vaccine ? "bg-brand-teal" : "bg-slate-800"
                            }`}
                          >
                            <div
                              className={`h-4 w-4 rounded-full bg-white transition-transform duration-300 ${
                                sharedFiles.vaccine ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold border-t border-slate-800 pt-3 mt-4">
                      CHANGES ARE DISTRIBUTED TO ENCRYPTED LEDGER IMMEDIATELY
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
