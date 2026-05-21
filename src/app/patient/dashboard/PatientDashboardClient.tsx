"use client";

import { useState } from "react";
import Link from "next/link";
import { logoutPatient } from "@/app/actions/auth";
import { bookAppointment } from "@/app/actions/patient";

type Doctor = {
  id: string;
  name: string;
  specialty: string;
  availability: string;
  consultFee: number | null;
};

type Booking = {
  id: string;
  scheduledAt: Date;
  status: string;
  reason: string | null;
  duration: number | null;
  prescription: string | null;
  createdAt: Date;
  doctor: {
    name: string;
    specialty: string;
  };
};

type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode: string;
  dob: string;
  gender: string | null;
  emailVerified: boolean;
  createdAt: Date;
  bookings: Booking[];
};

type PatientDashboardClientProps = {
  patient: Patient;
  doctors: Doctor[];
};

export default function PatientDashboardClient({ patient, doctors }: PatientDashboardClientProps) {
  // Tabs: 'overview' | 'booking' | 'records' | 'telehealth'
  const [activeTab, setActiveTab] = useState<"overview" | "booking" | "records" | "telehealth">("overview");

  // Booking form state
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [reason, setReason] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState("");

  // Telehealth state
  const [activeCallBooking, setActiveCallBooking] = useState<Booking | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [callStatus, setCallStatus] = useState<"waiting" | "connected" | "ended">("waiting");
  const [chatMessages, setChatMessages] = useState<{ sender: "patient" | "doctor"; text: string; time: string }[]>([
    { sender: "doctor", text: "Hello, I will be joining in just a moment. Please keep your camera enabled.", time: "Just now" },
  ]);
  const [newMsg, setNewMsg] = useState("");

  // Helpers
  function formatDate(dateInput: any) {
    const date = new Date(dateInput);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function formatDateTime(dateInput: any) {
    const date = new Date(dateInput);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  const upcomingConsultations = patient.bookings.filter(
    (booking) => new Date(booking.scheduledAt) >= new Date() && booking.status !== "CANCELLED"
  );
  
  const recentConsultations = [...patient.bookings]
    .filter((booking) => new Date(booking.scheduledAt) < new Date() || booking.status === "COMPLETED" || booking.status === "CANCELLED")
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  const prescriptionAlerts = patient.bookings.filter((b) => b.prescription);

  // Handle Book Appointment
  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId || !appointmentDate || !appointmentTime || !reason) {
      setBookingError("Please fill out all clinical fields.");
      return;
    }

    setBookingLoading(true);
    setBookingError("");
    setBookingSuccess("");

    try {
      const scheduledAtStr = `${appointmentDate}T${appointmentTime}:00`;
      const res = await bookAppointment({
        doctorId: selectedDoctorId,
        scheduledAt: scheduledAtStr,
        reason,
      });

      setBookingLoading(false);
      if (res.success) {
        setBookingSuccess("Clinical reservation registered successfully! Refreshing dashboard...");
        // Clear fields
        setSelectedDoctorId("");
        setAppointmentDate("");
        setAppointmentTime("");
        setReason("");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setBookingError(res.error || "Reservation failed. Please check date rules.");
      }
    } catch (err) {
      setBookingLoading(false);
      setBookingError("Network gateway connection error. Please try again.");
    }
  };

  // Start telehealth simulation
  const startTelehealth = (booking: Booking) => {
    setActiveCallBooking(booking);
    setCallStatus("waiting");
    setActiveTab("telehealth");
    
    // Simulate doctor joining after 3 seconds
    setTimeout(() => {
      setCallStatus("connected");
      setChatMessages(prev => [
        ...prev,
        { sender: "doctor", text: "Welcome to your virtual clinic room. How can I help you today?", time: "10:02 AM" }
      ]);
    }, 4000);
  };

  // Send message
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { sender: "patient", text: newMsg, time: "Just now" },
    ]);
    const patientText = newMsg;
    setNewMsg("");

    // Simulate doctor responding after a short delay
    setTimeout(() => {
      let doctorResponse = "I understand. I am documenting these symptoms in your medical record.";
      if (patientText.toLowerCase().includes("cough") || patientText.toLowerCase().includes("fever")) {
        doctorResponse = "I see. I will write a prescription for a supportive cough remedy and direct you on resting protocols.";
      } else if (patientText.toLowerCase().includes("pain") || patientText.toLowerCase().includes("hurt")) {
        doctorResponse = "Please describe the severity from 1 to 10 so I can calibrate the treatment guidelines.";
      }
      setChatMessages((prev) => [
        ...prev,
        { sender: "doctor", text: doctorResponse, time: "Just now" },
      ]);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.11),_transparent_40%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] text-slate-900 font-sans flex">
      {/* Sidebar Navigation */}
      <aside className="w-80 hidden lg:flex flex-col bg-slate-900 text-white border-r border-slate-800 p-8 justify-between relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-64 h-64 rounded-full bg-brand-teal/10 blur-3xl pointer-events-none" />

        <div className="space-y-10 relative z-10">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-1 select-none">
            <span className="font-display text-2xl tracking-tight">
              <span className="text-brand-red font-black">H</span>
              <span className="text-white font-extrabold">ealth</span>
              <span className="text-brand-teal font-black">K</span>
              <span className="text-white font-extrabold">o</span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded ml-2 tracking-wider">
              PORTAL
            </span>
          </Link>

          {/* Nav List */}
          <nav className="flex flex-col gap-2">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center space-x-3 px-4 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all ${
                activeTab === "overview"
                  ? "bg-brand-teal text-white shadow-md shadow-brand-teal/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zm10 0a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
              </svg>
              <span>Overview Panel</span>
            </button>

            <button
              onClick={() => setActiveTab("booking")}
              className={`flex items-center space-x-3 px-4 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all ${
                activeTab === "booking"
                  ? "bg-brand-teal text-white shadow-md shadow-brand-teal/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Book Appointment</span>
            </button>

            <button
              onClick={() => setActiveTab("records")}
              className={`flex items-center space-x-3 px-4 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all ${
                activeTab === "records"
                  ? "bg-brand-teal text-white shadow-md shadow-brand-teal/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-left leading-tight">Medical History & Prescriptions</span>
            </button>

            {activeCallBooking && (
              <button
                onClick={() => setActiveTab("telehealth")}
                className={`flex items-center space-x-3 px-4 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all animate-pulse ${
                  activeTab === "telehealth"
                    ? "bg-brand-red text-white shadow-md shadow-brand-red/20"
                    : "bg-brand-red/20 text-brand-red hover:bg-brand-red/30"
                }`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Active Telehealth Room</span>
              </button>
            )}
          </nav>
        </div>

        {/* Patient Profile Snapshot */}
        <div className="border-t border-slate-800 pt-6 space-y-4 relative z-10">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">
              Logged in Patient
            </p>
            <p className="mt-1 font-display font-black text-white text-md">
              {patient.firstName} {patient.lastName}
            </p>
            <p className="text-xs text-slate-400 font-semibold">{patient.email}</p>
          </div>
          <form action={logoutPatient}>
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-800 hover:bg-brand-red py-2.5 text-xs font-black uppercase tracking-[0.2em] text-white transition-colors"
            >
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow p-6 lg:p-10 max-h-screen overflow-y-auto">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between border-b border-slate-200 pb-5 mb-6">
          <Link href="/" className="flex items-center space-x-1 select-none">
            <span className="font-display text-xl tracking-tight">
              <span className="text-brand-red font-black">H</span>
              <span className="text-slate-900 font-extrabold">ealth</span>
              <span className="text-brand-teal font-black">K</span>
              <span className="text-slate-900 font-extrabold">o</span>
            </span>
          </Link>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab(activeTab === "overview" ? "booking" : "overview")}
              className="text-xs font-black uppercase tracking-wider bg-brand-teal text-white px-3.5 py-2 rounded-xl"
            >
              {activeTab === "overview" ? "Book Consult" : "Overview"}
            </button>
            <form action={logoutPatient}>
              <button
                type="submit"
                className="text-xs font-black uppercase tracking-wider bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl"
              >
                Exit
              </button>
            </form>
          </div>
        </header>

        {/* ── MODULE A: OVERVIEW PANEL ── */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-fade-in">
            {/* Greeting Header */}
            <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.04)] backdrop-blur flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-brand-teal">
                  Secure Patient Account
                </span>
                <h1 className="font-display text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                  Hello, {patient.firstName}
                </h1>
                <p className="text-sm font-semibold text-slate-500">
                  Review and enter virtual waiting rooms, view clinical prescription forms, or register new physician care encounters.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-4.5 py-1.5 text-xs font-black uppercase tracking-widest">
                  HIPAA Secure
                </span>
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/70 bg-slate-900 text-white p-6 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-brand-teal/20 blur-2xl pointer-events-none" />
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-teal">
                  Upcoming Consults
                </p>
                <p className="mt-4 font-display text-4xl font-black">{upcomingConsultations.length}</p>
                <p className="mt-2 text-xs font-medium text-slate-400">Scheduled clinical appointments</p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-md">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-teal">
                  Active Prescriptions
                </p>
                <p className="mt-4 font-display text-4xl font-black text-slate-950">{prescriptionAlerts.length}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">E-prescriptions available to review</p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-md">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-red">
                  Portal Activity
                </p>
                <p className="mt-4 font-display text-4xl font-black text-slate-950">{patient.bookings.length}</p>
                <p className="mt-2 text-xs font-semibold text-slate-500">Total clinic sessions on your record</p>
              </div>
            </div>

            {/* Upcoming Appointments Container */}
            <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-md backdrop-blur">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-display text-xl font-black tracking-tight text-slate-900">
                      Your Healthcare Schedule
                    </h2>
                    <button
                      onClick={() => setActiveTab("booking")}
                      className="text-xs font-black uppercase tracking-wider text-brand-teal hover:underline"
                    >
                      + Book New
                    </button>
                  </div>

                  {upcomingConsultations.length > 0 ? (
                    <div className="space-y-4">
                      {upcomingConsultations.map((booking) => (
                        <div
                          key={booking.id}
                          className="rounded-2xl border border-slate-100 bg-slate-50/50 p-5 space-y-4 hover:border-brand-teal/30 transition-all"
                        >
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-slate-900">{booking.doctor.name}</h3>
                                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                                  booking.status === "CONFIRMED"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                    : "bg-amber-50 text-amber-700 border border-amber-100"
                                }`}>
                                  {booking.status}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-slate-500 mt-1">{booking.doctor.specialty}</p>
                              <p className="text-xs leading-relaxed text-slate-600 mt-2">
                                <strong>Reason for consultation:</strong> {booking.reason}
                              </p>
                            </div>

                            <div className="text-right flex flex-col items-end gap-2 shrink-0">
                              <span className="rounded-xl bg-white px-3.5 py-2 text-xs font-black text-slate-700 border border-slate-200/60 shadow-sm">
                                {formatDateTime(booking.scheduledAt)}
                              </span>
                              
                              {booking.status === "CONFIRMED" && (
                                <button
                                  onClick={() => startTelehealth(booking)}
                                  className="w-full bg-brand-red hover:bg-brand-teal text-white font-bold text-[10px] tracking-[0.2em] uppercase px-4 py-2.5 rounded-xl shadow-md transition-all animate-bounce"
                                >
                                  Join Video Call
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                      <p className="text-sm font-black uppercase tracking-[0.25em] text-brand-teal">
                        No Upcoming Appointments
                      </p>
                      <p className="mt-2 text-xs text-slate-500 font-semibold max-w-sm mx-auto leading-relaxed">
                        When you schedule a consultation with our verified board-certified physicians, it will appear here with dynamic entry pathways.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Side: Patient Clinical Details */}
              <div className="space-y-6">
                <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-md">
                  <h2 className="font-display text-lg font-black tracking-tight text-slate-900 mb-4">
                    Demographic Summary
                  </h2>
                  <div className="space-y-3.5 text-xs">
                    <div className="bg-slate-50 rounded-xl p-3.5 flex justify-between items-center">
                      <span className="font-black text-slate-450 uppercase tracking-wider">Date of Birth</span>
                      <span className="font-bold text-slate-700">{patient.dob}</span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3.5 flex justify-between items-center">
                      <span className="font-black text-slate-450 uppercase tracking-wider">Legal Gender</span>
                      <span className="font-bold text-slate-700">{patient.gender || "Not specified"}</span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3.5 flex justify-between items-center">
                      <span className="font-black text-slate-450 uppercase tracking-wider">Contact Number</span>
                      <span className="font-bold text-slate-700">{patient.countryCode} {patient.phone}</span>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3.5 flex justify-between items-center">
                      <span className="font-black text-slate-450 uppercase tracking-wider">Consents Filed</span>
                      <span className="font-bold text-emerald-600">HIPAA Compliant</span>
                    </div>
                  </div>
                </div>

                {/* Info block */}
                <div className="rounded-[2rem] bg-slate-900 border border-slate-800 p-6 text-white space-y-4">
                  <h3 className="font-display text-md font-black text-brand-teal uppercase tracking-widest">
                    Emergency Notice
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    The virtual consultation platform is optimized for outpatient, secure primary care audits. In the case of acute, life-threatening symptoms, immediately dial 911 or visit the nearest emergency department.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ── MODULE B: BOOKING SYSTEM ── */}
        {activeTab === "booking" && (
          <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
            <header className="space-y-2">
              <span className="text-[10px] font-black text-brand-teal uppercase bg-brand-teal/10 border border-brand-teal/20 px-2 py-0.5 rounded tracking-widest">
                Scheduling Office
              </span>
              <h2 className="font-display text-2xl font-black text-slate-900 tracking-tight">
                Secure Appointment Coordinator
              </h2>
              <p className="text-slate-500 font-semibold text-xs leading-relaxed">
                Configure your appointment details. Our platform will instantly register the booking and queue it for the doctor's clinician authorization logs.
              </p>
            </header>

            <form onSubmit={handleBook} className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-xl space-y-5">
              {bookingError && (
                <div className="p-3 bg-brand-red/10 border border-brand-red/20 text-brand-red text-xs font-bold rounded-xl text-center">
                  {bookingError}
                </div>
              )}
              {bookingSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold rounded-xl text-center">
                  {bookingSuccess}
                </div>
              )}

              {/* Doctor Directory Selector */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">
                  Select Board-Certified Clinician
                </label>
                <select
                  required
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal"
                >
                  <option value="">-- Choose Doctor & Specialty --</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} - {doc.specialty} ({doc.availability})
                    </option>
                  ))}
                </select>
              </div>

              {/* DateTime configuration */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">
                    Select Appointment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">
                    Select Consultation Slot Time
                  </label>
                  <input
                    type="time"
                    required
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal"
                  />
                </div>
              </div>

              {/* Chief complaint reason */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 tracking-wider">
                  Chief Complaint / Visit Reason
                </label>
                <textarea
                  required
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe your current symptoms, medical audit needs, or follow-up reason..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-850 focus:outline-none focus:border-brand-teal"
                />
              </div>

              {/* HIPAA Acknowledgement Checkbox */}
              <div className="flex items-start space-x-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <input
                  type="checkbox"
                  required
                  id="consent"
                  className="mt-0.5 rounded text-brand-teal focus:ring-brand-teal/20"
                />
                <label htmlFor="consent" className="text-[10px] font-semibold text-slate-500 leading-relaxed">
                  I consent to sharing my secure demographic summary and medical descriptors with the selected licensed health specialist for virtual evaluation.
                </label>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={bookingLoading}
                className="w-full bg-slate-900 hover:bg-brand-teal text-white font-bold text-xs py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center space-x-2"
              >
                {bookingLoading ? (
                  <span>Requesting Appointment Slot...</span>
                ) : (
                  <span>Submit Secure Booking Request</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── MODULE C: MEDICAL RECORDS & PRESCRIPTIONS ── */}
        {activeTab === "records" && (
          <div className="space-y-8 animate-fade-in">
            <header className="space-y-2">
              <span className="text-[10px] font-black text-brand-red uppercase bg-brand-red-tint/10 border border-brand-red/10 px-2 py-0.5 rounded tracking-widest">
                Patient Records
              </span>
              <h2 className="font-display text-2xl font-black text-slate-900 tracking-tight">
                Clinical Records & Prescription Vault
              </h2>
              <p className="text-slate-500 font-semibold text-xs leading-relaxed">
                Review your historical encounters, verified diagnosis notes, and active pharmaceutical prescription instructions issued by licensed practitioners.
              </p>
            </header>

            {/* List prescriptions */}
            <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-md">
              <h3 className="font-display text-lg font-black text-slate-900 mb-6">
                Active E-Prescriptions
              </h3>

              {prescriptionAlerts.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2">
                  {prescriptionAlerts.map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-2xl border border-brand-red/15 bg-white p-5 shadow-sm space-y-4 hover:border-brand-red/35 transition-all relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 bg-brand-red text-white text-[9px] font-black uppercase px-2.5 py-1 rounded-bl-xl tracking-widest">
                        Rx Active
                      </div>
                      
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                          Prescription Form
                        </p>
                        <h4 className="text-base font-black text-slate-900 mt-1">{booking.prescription}</h4>
                        <p className="text-xs font-semibold text-slate-500 mt-1">
                          Authored by: {booking.doctor.name}
                        </p>
                      </div>

                      <div className="border-t border-slate-100 pt-3 space-y-2">
                        <p className="text-[10px] text-slate-500 font-medium">
                          <strong>Date of Issue:</strong> {formatDate(booking.scheduledAt)}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          <strong>Indicated Diagnosis:</strong> {booking.reason || "General health evaluation"}
                        </p>
                      </div>

                      <button
                        onClick={() => alert(`Downloading secure prescription token for ${booking.prescription}...`)}
                        className="w-full text-center border border-slate-200 hover:border-brand-teal hover:text-brand-teal bg-slate-50 hover:bg-white text-[10px] font-black uppercase tracking-[0.2em] py-2.5 rounded-xl transition-all"
                      >
                        Download Prescriptive PDF
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-150">
                  <p className="text-xs font-bold text-slate-500">
                    No active pharmacological prescriptions found on your patient file.
                  </p>
                </div>
              )}
            </div>

            {/* List history */}
            <div className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-md">
              <h3 className="font-display text-lg font-black text-slate-900 mb-6">
                Consultation History
              </h3>

              {recentConsultations.length > 0 ? (
                <div className="space-y-4">
                  {recentConsultations.map((booking) => (
                    <div
                      key={booking.id}
                      className="rounded-2xl border border-slate-150 bg-white p-5 hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-800">{booking.doctor.name}</h4>
                          <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[9px] font-black uppercase">
                            {booking.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-semibold mt-1">
                          {booking.doctor.specialty}
                        </p>
                        <p className="text-xs leading-relaxed text-slate-600 mt-2">
                          <strong>Chief Complaint:</strong> {booking.reason || "Unspecified"}
                        </p>
                        {booking.prescription && (
                          <div className="mt-2.5 inline-flex items-center bg-brand-red-tint/10 border border-brand-red/10 text-brand-red font-bold text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">
                            Rx: {booking.prescription}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-bold text-slate-450">
                          {formatDate(booking.scheduledAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-150">
                  <p className="text-xs font-bold text-slate-500">
                    No completed healthcare consultations on your timeline yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MODULE D: TELEHEALTH ACTIVE ROOM (WebRTC Simulator) ── */}
        {activeTab === "telehealth" && activeCallBooking && (
          <div className="h-[80vh] flex flex-col bg-slate-950 rounded-3xl border border-slate-800 text-white shadow-2xl overflow-hidden animate-fade-in relative">
            {/* Header: Patient & Doc info */}
            <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex justify-between items-center z-10">
              <div className="flex items-center space-x-3">
                <span className="h-2 w-2 rounded-full bg-brand-red animate-pulse" />
                <div>
                  <h3 className="font-display font-black text-sm tracking-tight text-white">
                    Clinical Encounter Session
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold">
                    Licensed Practitioner: {activeCallBooking.doctor.name} ({activeCallBooking.doctor.specialty})
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-[9px] font-black uppercase bg-slate-850 border border-slate-800 px-3 py-1 rounded text-brand-teal tracking-widest">
                  AES-256 SRTP Encrypted
                </span>
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to disconnect this virtual session?")) {
                      setActiveCallBooking(null);
                      setActiveTab("overview");
                    }
                  }}
                  className="bg-brand-red hover:bg-brand-red/90 text-white font-bold text-[10px] uppercase px-3 py-1.5 rounded-lg transition-all tracking-wider"
                >
                  Disconnect
                </button>
              </div>
            </header>

            {/* Content: Main split screen grid */}
            <div className="flex-grow grid lg:grid-cols-12 overflow-hidden relative">
              {/* Left Column: Video feeds (8 cols) */}
              <div className="lg:col-span-8 flex flex-col justify-center items-center bg-slate-950 p-6 relative overflow-hidden">
                {callStatus === "waiting" ? (
                  /* Waiting room state */
                  <div className="text-center space-y-6 max-w-sm">
                    <div className="relative mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full bg-brand-teal/20 blur-xl animate-pulse" />
                      <div className="h-16 w-16 rounded-full border-2 border-dashed border-brand-teal flex items-center justify-center text-brand-teal relative z-10 animate-spin">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-display font-black text-lg tracking-tight text-white">
                        Telehealth waiting room
                      </h4>
                      <p className="text-xs font-semibold text-slate-400 leading-relaxed">
                        Initializing secure WebRTC camera protocols. Waiting for {activeCallBooking.doctor.name} to enter the consultation space...
                      </p>
                    </div>

                    <div className="border border-slate-800 bg-slate-900 rounded-xl p-3 text-slate-400 text-[10px] text-left">
                      <strong>Reconnection Check:</strong> All servers active. Network ping 18ms. Session logs ready.
                    </div>
                  </div>
                ) : (
                  /* Live consultation call state */
                  <div className="w-full h-full grid gap-4 p-2 grid-rows-2 sm:grid-rows-1 sm:grid-cols-2 relative">
                    
                    {/* Doctor Feed */}
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden relative shadow-lg">
                      <div className="absolute inset-0 flex flex-col justify-center items-center">
                        {/* Simulated high-fidelity avatar/video frame */}
                        <div className="absolute inset-0 bg-cover bg-center opacity-70" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80')" }} />
                        <div className="absolute inset-0 bg-slate-950/20" />
                        <span className="relative z-10 text-[10px] font-black uppercase bg-slate-950/80 px-3 py-1 rounded text-white tracking-widest">
                          Practitioner Active Feed
                        </span>
                      </div>
                      <div className="absolute bottom-4 left-4 bg-slate-950/80 px-3 py-1.5 rounded-lg text-xs font-bold z-10 border border-slate-800 text-brand-teal">
                        {activeCallBooking.doctor.name} (MD)
                      </div>
                    </div>

                    {/* Patient Self Feed */}
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden relative shadow-lg">
                      {isCameraOn ? (
                        <div className="absolute inset-0 flex flex-col justify-center items-center">
                          <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80')" }} />
                          <div className="absolute inset-0 bg-slate-950/30" />
                          <span className="relative z-10 text-[10px] font-black uppercase bg-slate-950/80 px-3 py-1 rounded text-white tracking-widest">
                            Your Self Stream
                          </span>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex flex-col justify-center items-center bg-slate-950 text-slate-500">
                          <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          <span className="text-xs font-black uppercase tracking-widest">Camera Disabled</span>
                        </div>
                      )}
                      
                      <div className="absolute bottom-4 left-4 bg-slate-950/80 px-3 py-1.5 rounded-lg text-xs font-bold z-10 border border-slate-800 text-slate-350">
                        {patient.firstName} {patient.lastName} (Self)
                      </div>

                      {/* Microphone Indicator */}
                      <div className="absolute bottom-4 right-4 z-10">
                        {!isMicOn && (
                          <span className="bg-brand-red text-white p-1.5 rounded-full flex items-center justify-center">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                          </span>
                        )}
                      </div>
                    </div>

                  </div>
                )}

                {/* Floating controls */}
                <div className="absolute bottom-6 bg-slate-900/90 border border-slate-800 rounded-2xl px-6 py-3 flex items-center space-x-6 backdrop-blur z-20 shadow-xl">
                  {/* Camera toggle */}
                  <button
                    onClick={() => setIsCameraOn(!isCameraOn)}
                    className={`p-3 rounded-xl transition-all ${
                      isCameraOn ? "bg-slate-800 text-brand-teal hover:bg-slate-700" : "bg-brand-red text-white"
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>

                  {/* Mic toggle */}
                  <button
                    onClick={() => setIsMicOn(!isMicOn)}
                    className={`p-3 rounded-xl transition-all ${
                      isMicOn ? "bg-slate-800 text-brand-teal hover:bg-slate-700" : "bg-brand-red text-white"
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </button>

                  <div className="h-6 w-px bg-slate-800" />

                  {/* Disconnect red button */}
                  <button
                    onClick={() => {
                      if (confirm("Disconnect consultation call stream?")) {
                        setActiveCallBooking(null);
                        setActiveTab("overview");
                      }
                    }}
                    className="bg-brand-red hover:bg-brand-red/90 text-white font-bold p-3 rounded-xl transition-all shadow-md"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Right Column: Live Chat Sidebar (4 cols) */}
              <div className="lg:col-span-4 bg-slate-900 border-l border-slate-800 flex flex-col justify-between overflow-hidden">
                <div className="p-4 bg-slate-950 border-b border-slate-800">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
                    Secure Conversation Log
                  </h4>
                </div>

                {/* Message display area */}
                <div className="flex-grow p-4 overflow-y-auto space-y-4 max-h-[50vh] lg:max-h-[60vh]">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col space-y-1 ${
                        msg.sender === "patient" ? "items-end" : "items-start"
                      }`}
                    >
                      <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">
                        {msg.sender === "patient" ? "You" : "Doctor"} - {msg.time}
                      </span>
                      <div className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                        msg.sender === "patient"
                          ? "bg-brand-teal text-white rounded-tr-none"
                          : "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-750"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input submission */}
                <form onSubmit={sendMessage} className="p-4 bg-slate-950 border-t border-slate-850 flex gap-2">
                  <input
                    type="text"
                    required
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    placeholder="Type encrypted message..."
                    className="flex-grow bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-teal"
                  />
                  <button
                    type="submit"
                    className="bg-brand-teal text-white font-bold text-xs px-4 rounded-xl transition-all"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
