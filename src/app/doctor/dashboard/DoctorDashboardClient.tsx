"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logoutDoctor } from "@/app/actions/auth";
import { acceptAppointment, cancelAppointment, completeConsultation, referAppointment, rescheduleAppointment, scheduleFollowUpAppointment } from "@/app/actions/doctor";
import { endVideoSession, startVideoSession } from "@/app/actions/video-session";
import { AppointmentCalendar, type CalendarViewMode } from "@/components/dashboard/AppointmentCalendar";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/DashboardShell";
import { DoctorSettingsModule } from "@/components/dashboard/SettingsModule";
import {
  AppointmentCard,
  ChatPanel,
  EmptyState,
  LiveConsultationPanel,
  PrescriptionList,
  StatGrid,
} from "@/components/dashboard/SharedModules";
import { useConsultationSession } from "@/hooks/useConsultationSession";
import { useDashboardModule } from "@/hooks/useDashboardModule";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { useWebRTC } from "@/hooks/useWebRTC";
import { formatDateTime } from "@/lib/dashboard/format";
import type {
  DashboardDoctor,
  DoctorAppointment,
  DoctorModuleId,
  RealtimeEvent,
} from "@/lib/dashboard/types";

type Doctor = DashboardDoctor & {
  email: string;
  npi: string;
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  bio?: string | null;
  image?: string | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
  yearsExp?: number | null;
  consultFee?: number | null;
  createdAt: Date;
  audits?: {
    id: string;
    status: string;
    submittedAt: Date | string;
    updatedAt: Date | string;
    licenseNumber: string;
    licenseState: string;
  }[];
  bookings: DoctorAppointment[];
};

type DoctorDashboardClientProps = {
  doctor: Doctor;
  doctors: DashboardDoctor[];
  initialModule?: DoctorModuleId;
};

const DOCTOR_MODULES = [
  "overview",
  "live",
  "patients",
  "schedule",
  "notes",
  "prescriptions",
  "messages",
  "notifications",
  "analytics",
  "settings",
] as const satisfies readonly DoctorModuleId[];

export default function DoctorDashboardClient({ doctor, doctors, initialModule = "overview" }: DoctorDashboardClientProps) {
  const router = useRouter();
  const [activeModule, setActiveModule] = useDashboardModule<DoctorModuleId>(initialModule, DOCTOR_MODULES);
  const [collapsed, setCollapsed] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [prescriptionText, setPrescriptionText] = useState("");
  const [diagnosisText, setDiagnosisText] = useState("");
  const [referralTargets, setReferralTargets] = useState<Record<string, string>>({});
  const [submitState, setSubmitState] = useState({ loading: false, error: "", success: "" });
  const [scheduleState, setScheduleState] = useState({ loading: false, error: "", success: "" });
  const [followUpPatientId, setFollowUpPatientId] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [followUpReason, setFollowUpReason] = useState("");
  const [calendarView, setCalendarView] = useState<CalendarViewMode>("week");
  const [calendarAnchorDate, setCalendarAnchorDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [doctorAvailability, setDoctorAvailability] = useState(doctor.availability);
  const [toasts, setToasts] = useState<{ id: string; tone: "success" | "error"; message: string }[]>([]);

  const showToast = useCallback((tone: "success" | "error", message: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const onRealtimeEvent = useCallback((event: RealtimeEvent) => {
    if (
      event.actorRole === "patient" &&
      (
        event.type === "appointment:created" ||
        event.type === "appointment:updated" ||
        event.type === "appointment:rescheduled" ||
        event.type === "appointment:cancelled"
      )
    ) {
      router.refresh();
    }

    if (event.type === "doctor:availability-updated" && event.doctorId === doctor.id) {
      setDoctorAvailability(event.availability);
      router.refresh();
    }
  }, [doctor.id, router]);

  const realtime = useDashboardRealtime(onRealtimeEvent);
  const session = useConsultationSession<DoctorAppointment>({
    role: "doctor",
    publish: realtime.publish,
  });
  const webRTC = useWebRTC({
    roomId: session.roomId,
    role: "doctor",
    getSocket: realtime.getSocket,
    isCameraOn: session.isCameraOn,
    isMicOn: session.isMicOn,
    isActive: Boolean(session.roomId && (session.status === "waiting" || session.status === "connected")),
  });
  const receiveRealtimeEvent = session.receiveRealtimeEvent;

  useEffect(() => {
    receiveRealtimeEvent(realtime.lastEvent);
  }, [realtime.lastEvent, receiveRealtimeEvent]);

  useEffect(() => {
    setDoctorAvailability(doctor.availability);
  }, [doctor.availability]);

  const pendingAppointments = doctor.bookings.filter((booking) => booking.status === "PENDING");
  const confirmedAppointments = doctor.bookings.filter(
    (booking) => booking.status === "CONFIRMED" && new Date(booking.scheduledAt) >= new Date()
  );
  const completedConsultations = doctor.bookings.filter((booking) => booking.status === "COMPLETED");
  const patients = useMemo(() => {
    const map = new Map<string, DoctorAppointment["patient"]>();
    doctor.bookings.forEach((booking) => map.set(booking.patient.id, booking.patient));
    return Array.from(map.values());
  }, [doctor.bookings]);
  const prescriptions = doctor.bookings.filter((booking) => booking.prescription);
  const notifications = [
    ...pendingAppointments.slice(0, 4).map((booking) => ({
      title: "New appointment request",
      body: `${booking.patient.firstName} ${booking.patient.lastName} · ${formatDateTime(booking.scheduledAt)}`,
    })),
    ...confirmedAppointments.slice(0, 2).map((booking) => ({
      title: "Live room ready",
      body: `${booking.patient.firstName} ${booking.patient.lastName} is scheduled for ${formatDateTime(booking.scheduledAt)}`,
    })),
  ];

  const visibleScheduleAppointments = useMemo(() => {
    const start = new Date(calendarAnchorDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);

    if (calendarView === "day") {
      end.setDate(start.getDate() + 1);
    } else if (calendarView === "month") {
      start.setDate(1);
      end.setMonth(start.getMonth() + 1, 1);
    } else {
      end.setDate(start.getDate() + 7);
    }

    return [...pendingAppointments, ...confirmedAppointments].filter((booking) => {
      const scheduledAt = new Date(booking.scheduledAt);
      return scheduledAt >= start && scheduledAt < end;
    });
  }, [calendarAnchorDate, calendarView, confirmedAppointments, pendingAppointments]);

  const visibleConfirmedAppointments = visibleScheduleAppointments.filter((booking) => booking.status === "CONFIRMED");

  const navItems: DashboardNavItem<DoctorModuleId>[] = [
    { id: "overview", label: "Overview" },
    { id: "schedule", label: "Appointments", badge: pendingAppointments.length || undefined },
    { id: "live", label: "Consultations", badge: confirmedAppointments.length || undefined },
    { id: "patients", label: "Patient Management" },
    { id: "settings", label: "Settings" },
  ];

  const handleAccept = async (consultationId: string) => {
    setActionLoadingId(consultationId);
    setScheduleState({ loading: false, error: "", success: "" });
    const result = await acceptAppointment(consultationId);
    setActionLoadingId(null);
    if (result.success) {
      setScheduleState({ loading: false, error: "", success: "" });
      showToast("success", "Appointment approved and schedule updated.");
      realtime.publish({ type: "appointment:updated", appointmentId: consultationId, actorRole: "doctor", title: "Appointment approved", body: "Your doctor approved the consultation request." });
      router.refresh();
    } else {
      const message = result.error || "Could not approve appointment.";
      setScheduleState({ loading: false, error: message, success: "" });
      showToast("error", message);
    }
  };

  const handleCancel = async (consultationId: string) => {
    setActionLoadingId(consultationId);
    const result = await cancelAppointment(consultationId);
    setActionLoadingId(null);
    if (result.success) {
      realtime.publish({ type: "appointment:cancelled", appointmentId: consultationId, actorRole: "doctor", title: "Appointment cancelled", body: "Your doctor cancelled this consultation request." });
      router.refresh();
    }
  };

  const handleReschedule = async (consultationId: string, scheduledAt: string) => {
    setActionLoadingId(consultationId);
    setScheduleState({ loading: false, error: "", success: "" });
    const result = await rescheduleAppointment({ consultationId, scheduledAt });
    setActionLoadingId(null);
    if (result.success) {
      setScheduleState({ loading: false, error: "", success: "" });
      showToast("success", "Consultation rescheduled and patient dashboard updated.");
      realtime.publish({
        type: "appointment:rescheduled",
        appointmentId: consultationId,
        actorRole: "doctor",
        scheduledAt,
        title: "Consultation rescheduled",
        body: `Your consultation moved to ${formatDateTime(scheduledAt)}.`,
      });
      router.refresh();
    } else {
      const message = result.error || "Could not reschedule consultation.";
      setScheduleState({ loading: false, error: message, success: "" });
      showToast("error", message);
    }
  };

  const handleScheduleFollowUp = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!followUpPatientId || !followUpDate || !followUpTime || !followUpReason.trim()) {
      const message = "Choose a patient, date, time, and follow-up reason.";
      setScheduleState({ loading: false, error: message, success: "" });
      showToast("error", message);
      return;
    }

    setScheduleState({ loading: true, error: "", success: "" });
    const scheduledAt = `${followUpDate}T${followUpTime}:00`;
    const result = await scheduleFollowUpAppointment({
      patientId: followUpPatientId,
      scheduledAt,
      reason: followUpReason,
    });

    if (!result.success) {
      const message = result.error || "Could not schedule follow-up consultation.";
      setScheduleState({ loading: false, error: message, success: "" });
      showToast("error", message);
      return;
    }

    realtime.publish({
      type: "appointment:created",
      appointmentId: result.consultation?.id || "follow-up",
      actorRole: "doctor",
      scheduledAt,
      title: "Follow-up consultation scheduled",
      body: `Your doctor scheduled a follow-up for ${formatDateTime(scheduledAt)}.`,
    });
    setScheduleState({ loading: false, error: "", success: "" });
    showToast("success", "Follow-up consultation scheduled and patient dashboard updated.");
    setFollowUpPatientId("");
    setFollowUpDate("");
    setFollowUpTime("");
    setFollowUpReason("");
    router.refresh();
  };

  const handleReferral = async (consultationId: string) => {
    const targetDoctorId = referralTargets[consultationId];
    if (!targetDoctorId) {
      return;
    }

    setActionLoadingId(consultationId);
    const result = await referAppointment({ consultationId, targetDoctorId });
    setActionLoadingId(null);
    if (result.success) {
      realtime.publish({
        type: "appointment:referred",
        appointmentId: result.consultation?.id || consultationId,
        actorRole: "doctor",
        targetDoctorId,
        title: "Referral recommended",
        body: "Your visit was reassigned to a doctor whose specialization better matches your reason for visit.",
      });
      router.refresh();
    }
  };

  const startLiveSession = async (appointment: DoctorAppointment) => {
    setClinicalNotes(appointment.notes || "");
    setPrescriptionText(appointment.prescription || "");
    setDiagnosisText(appointment.reason || "");
    setActionLoadingId(appointment.id);
    const result = await startVideoSession(appointment.id);
    setActionLoadingId(null);

    if (!result.success || !result.roomId || !result.accessToken) {
      setSubmitState({ loading: false, error: result.error || "Could not start secure video session.", success: "" });
      return;
    }

    session.enterAuthorizedRoom(appointment, result.roomId, result.accessToken, "waiting");
    realtime.joinVideoRoom(result.roomId);
    realtime.publish({
      type: "session:started",
      appointmentId: appointment.id,
      actorRole: "doctor",
      roomId: result.roomId,
      title: "Doctor started the consultation",
      body: `Dr. ${doctor.name} has started your consultation. Join the secure live room now.`,
    });
    setActiveModule("live");
  };

  const handleComplete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session.activeAppointment) {
      return;
    }

    if (!clinicalNotes.trim() || !prescriptionText.trim()) {
      setSubmitState({ loading: false, error: "Clinical notes and prescription are required.", success: "" });
      return;
    }

    setSubmitState({ loading: true, error: "", success: "" });
    const result = await completeConsultation({
      consultationId: session.activeAppointment.id,
      notes: clinicalNotes,
      prescription: prescriptionText,
      reason: diagnosisText || undefined,
    });

    if (!result.success) {
      setSubmitState({ loading: false, error: result.error || "Could not complete consultation.", success: "" });
      return;
    }

    realtime.publish({ type: "appointment:updated", appointmentId: session.activeAppointment.id, actorRole: "doctor" });
    setSubmitState({ loading: false, error: "", success: "Consultation completed and patient portal updated." });
    session.endSession();
    router.refresh();
  };

  const handleEndSession = async () => {
    if (session.activeAppointment) {
      await endVideoSession(session.activeAppointment.id);
    }
    session.endSession();
    setActiveModule("overview");
    router.refresh();
  };

  const tone = "dark" as const;

  return (
    <DashboardShell
      role="doctor"
      activeModule={activeModule}
      navItems={navItems}
      title={doctor.name}
      subtitle="Doctor dashboard"
      profile={{
        name: doctor.name,
        detail: doctor.specialty,
        meta: `NPI ${doctor.npi}`,
      }}
      connectionState={realtime.connectionState}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((value) => !value)}
      onNavigate={setActiveModule}
      onLogout={() => (
        <form action={logoutDoctor}>
          <button type="submit" className="w-full rounded-xl bg-slate-850 px-3 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-white">
            Sign Out
          </button>
        </form>
      )}
    >
      <div className="fixed right-5 top-5 z-[80] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur ${
              toast.tone === "success"
                ? "border-emerald-300/30 bg-emerald-950/90 text-emerald-100"
                : "border-red-300/30 bg-red-950/90 text-red-100"
            }`}
            role="status"
          >
            {toast.message}
          </div>
        ))}
      </div>

      {activeModule === "overview" && (
        <div className="space-y-6">
          <StatGrid
            tone="dark"
            stats={[
              { label: "Pending", value: pendingAppointments.length, helper: "requests awaiting authorization" },
              { label: "Confirmed", value: confirmedAppointments.length, helper: "live-ready consultations" },
              { label: "Patients", value: patients.length, helper: "distinct patient records" },
            ]}
          />
          <section className="rounded-xl border border-slate-850 bg-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">Clinical Queue</h2>
              <button type="button" onClick={() => setActiveModule("schedule")} className="rounded-lg bg-brand-teal px-3 py-2 text-xs font-black text-white">
                Open Appointments
              </button>
            </div>
            <div className="space-y-3">
              {confirmedAppointments.length ? (
                confirmedAppointments.map((booking) => (
                  <AppointmentCard
                    key={booking.id}
                    tone={tone}
                    title={`${booking.patient.firstName} ${booking.patient.lastName}`}
                    subtitle={`${booking.patient.dob} · ${booking.patient.email}`}
                    scheduledAt={booking.scheduledAt}
                    status={booking.status}
                    reason={booking.reason}
                    actions={<button type="button" onClick={() => startLiveSession(booking)} className="rounded-lg bg-brand-red px-3 py-2 text-xs font-black text-white">Start Consultation</button>}
                  />
                ))
              ) : (
                <EmptyState title="No confirmed visits" body="Accepted appointments appear in the clinical queue." />
              )}
            </div>
          </section>
        </div>
      )}

      {activeModule === "live" && (
        session.activeAppointment ? (
          <LiveConsultationPanel
            role="doctor"
            counterpartName={`${session.activeAppointment.patient.firstName} ${session.activeAppointment.patient.lastName}`}
            appointmentTime={session.activeAppointment.scheduledAt}
            status={session.status}
            isCameraOn={session.isCameraOn}
            isMicOn={session.isMicOn}
            counterpartCameraOn={session.counterpartCameraOn}
            counterpartMicOn={session.counterpartMicOn}
            onToggleCamera={session.toggleCamera}
            onToggleMic={session.toggleMic}
            onEnd={handleEndSession}
            localStream={webRTC.localStream}
            remoteStream={webRTC.remoteStream}
            connectionState={webRTC.connectionState}
            mediaError={webRTC.error}
            chat={<ChatPanel role="doctor" messages={session.messages} onSend={session.sendMessage} />}
            documentation={
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-teal">Clinical Documentation</p>
                <form onSubmit={handleComplete} className="mt-4 space-y-3">
                  {submitState.error && <div className="rounded-lg border border-brand-red/20 bg-brand-red/10 p-3 text-xs font-bold text-brand-red">{submitState.error}</div>}
                  {submitState.success && <div className="rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-xs font-bold text-emerald-300">{submitState.success}</div>}
                  <div className="rounded-xl border border-amber-400/20 border-l-4 border-l-amber-300 bg-amber-300/10 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Chief Complaint</p>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-amber-50">
                      {diagnosisText || "No chief complaint was provided for this appointment."}
                    </p>
                  </div>
                  <textarea value={clinicalNotes} onChange={(event) => setClinicalNotes(event.target.value)} rows={4} placeholder="Consultation notes" className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand-teal" />
                  <input value={prescriptionText} onChange={(event) => setPrescriptionText(event.target.value)} placeholder="Prescription" className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand-teal" />
                  <button type="submit" disabled={submitState.loading} className="w-full rounded-lg bg-brand-teal px-4 py-2.5 text-xs font-black text-white disabled:bg-slate-800">
                    {submitState.loading ? "Saving..." : "Complete & Issue Prescription"}
                  </button>
                </form>
              </section>
            }
          />
        ) : (
          <section className="space-y-4">
            <h2 className="text-lg font-black text-white">Live Consultations</h2>
            {confirmedAppointments.length ? (
              confirmedAppointments.map((booking) => (
                <AppointmentCard
                  key={booking.id}
                  tone={tone}
                  title={`${booking.patient.firstName} ${booking.patient.lastName}`}
                  subtitle={booking.patient.email}
                  scheduledAt={booking.scheduledAt}
                  status={booking.status}
                  reason={booking.reason}
                  actions={<button type="button" onClick={() => startLiveSession(booking)} className="rounded-lg bg-brand-red px-3 py-2 text-xs font-black text-white">Start Consultation</button>}
                />
              ))
            ) : (
              <EmptyState title="No live consultations" body="Accept appointment requests from Schedule Console first." />
            )}
          </section>
        )
      )}

      {activeModule === "patients" && (
        <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {patients.length ? patients.map((patientRecord) => (
            <article key={patientRecord.id} className="rounded-xl border border-slate-850 bg-slate-900 p-5">
              <p className="text-sm font-black text-white">{patientRecord.firstName} {patientRecord.lastName}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{patientRecord.email}</p>
              <p className="mt-3 text-xs text-slate-500">DOB {patientRecord.dob} · {patientRecord.gender || "Unspecified"}</p>
            </article>
          )) : <EmptyState title="No patients yet" body="Patients appear after appointment requests are booked." />}
        </section>
        <section className="space-y-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-black text-white">Embedded Records</h2>
            <p className="text-xs font-semibold text-slate-400">Notes and prescriptions stay attached to completed patient visits.</p>
          </div>
          {completedConsultations.length ? completedConsultations.map((booking) => (
            <AppointmentCard
              key={booking.id}
              tone={tone}
              title={`${booking.patient.firstName} ${booking.patient.lastName}`}
              subtitle={booking.notes || "No notes captured"}
              scheduledAt={booking.scheduledAt}
              status={booking.status}
              reason={booking.prescription ? `Rx: ${booking.prescription}` : booking.reason}
            />
          )) : <EmptyState title="No completed records" body="Completed live consultations create patient records here." />}
        </section>
        </div>
      )}

      {activeModule === "schedule" && (
        <section className="grid min-h-[calc(100vh-9rem)] gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-850 bg-slate-900 p-5 text-white">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Main Stage</p>
                  <h2 className="mt-1 text-2xl font-black">Weekly Schedule Grid</h2>
                  <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-400">
                    Drag appointment blocks to rebook within open availability. Confirmed visits and pending requests update across dashboards.
                  </p>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    Availability: {doctorAvailability}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-lg border border-sky-300/20 bg-sky-400/10 px-4 py-3">
                    <p className="text-2xl font-black text-sky-100">{confirmedAppointments.length}</p>
                    <p className="text-[10px] font-black uppercase text-sky-200">Confirmed</p>
                  </div>
                  <div className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-4 py-3">
                    <p className="text-2xl font-black text-amber-100">{pendingAppointments.length}</p>
                    <p className="text-[10px] font-black uppercase text-amber-200">Pending</p>
                  </div>
                </div>
              </div>
            </section>
            <AppointmentCalendar
              tone={tone}
              editable
              variant="stage"
              viewMode={calendarView}
              onViewModeChange={setCalendarView}
              anchorDate={calendarAnchorDate}
              onAnchorDateChange={setCalendarAnchorDate}
              availability={doctorAvailability}
              appointments={visibleScheduleAppointments.map((booking) => ({
                id: booking.id,
                title: `${booking.patient.firstName} ${booking.patient.lastName}`,
                subtitle: booking.reason || booking.patient.email,
                scheduledAt: booking.scheduledAt,
                status: booking.status,
              }))}
              onReschedule={handleReschedule}
            />
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-slate-850 bg-slate-900 p-4">
              <div className="mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Action Panel</p>
                <h2 className="text-base font-black text-white">Follow-Up Scheduling</h2>
              </div>
              <form onSubmit={handleScheduleFollowUp} className="grid gap-3">
                <label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Patient
                  <select
                    value={followUpPatientId}
                    onChange={(event) => setFollowUpPatientId(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold normal-case text-white"
                  >
                    <option value="">Select patient with history</option>
                    {patients.map((patientRecord) => (
                      <option key={patientRecord.id} value={patientRecord.id}>
                        {patientRecord.firstName} {patientRecord.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Date
                    <input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white" />
                  </label>
                  <label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Time
                    <input type="time" value={followUpTime} onChange={(event) => setFollowUpTime(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white" />
                  </label>
                </div>
                <label className="space-y-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Reason
                  <input value={followUpReason} onChange={(event) => setFollowUpReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold normal-case text-white" />
                </label>
                <button type="submit" disabled={scheduleState.loading || !patients.length} className="rounded-lg bg-brand-teal px-4 py-2.5 text-xs font-black text-white disabled:bg-slate-800">
                  {scheduleState.loading ? "Scheduling..." : "Schedule Follow-Up"}
                </button>
              </form>
            </section>

            <section className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 shadow-[0_0_32px_rgba(245,158,11,0.08)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Needs Review</p>
                  <h2 className="text-base font-black text-white">Pending Appointments</h2>
                </div>
                <span className="rounded-full bg-amber-300 px-2.5 py-1 text-[10px] font-black text-slate-950">{pendingAppointments.length} active</span>
              </div>
              <div className="max-h-[32vh] space-y-3 overflow-y-auto pr-1">
                {pendingAppointments.length ? pendingAppointments.map((booking) => (
                  <article key={booking.id} className="rounded-lg border border-amber-200/20 bg-slate-950/70 p-3 text-white shadow-[0_0_18px_rgba(245,158,11,0.08)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">{booking.patient.firstName} {booking.patient.lastName}</p>
                        <p className="mt-1 text-[11px] font-semibold text-amber-100">{formatDateTime(booking.scheduledAt)}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-300">{booking.reason || booking.patient.email}</p>
                      </div>
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-black uppercase text-amber-100">Request</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={actionLoadingId === booking.id} onClick={() => handleAccept(booking.id)} className="rounded-lg bg-brand-teal px-3 py-2 text-[11px] font-black text-white disabled:bg-slate-800">Accept</button>
                      <button type="button" disabled={actionLoadingId === booking.id} onClick={() => handleCancel(booking.id)} className="rounded-lg bg-slate-800 px-3 py-2 text-[11px] font-black text-white">Cancel</button>
                      <select
                        value={referralTargets[booking.id] || ""}
                        onChange={(event) => setReferralTargets((current) => ({ ...current, [booking.id]: event.target.value }))}
                        className="min-w-28 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-[11px] font-bold text-white"
                        aria-label="Refer to doctor"
                      >
                        <option value="">Refer</option>
                        {doctors.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.name}
                          </option>
                        ))}
                      </select>
                      <button type="button" disabled={actionLoadingId === booking.id || !referralTargets[booking.id]} onClick={() => handleReferral(booking.id)} className="rounded-lg bg-brand-red px-3 py-2 text-[11px] font-black text-white disabled:bg-slate-800">Send</button>
                    </div>
                  </article>
                )) : <EmptyState title="No pending requests" body="Patient bookings arrive here in realtime." />}
              </div>
            </section>

            <section className="rounded-xl border border-slate-850 bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-200">Agenda Ticker</p>
                  <h2 className="text-base font-black text-white">Confirmed Appointments</h2>
                </div>
                <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-[10px] font-black uppercase text-sky-100">Live-ready</span>
              </div>
              <div className="max-h-[360px] min-h-32 space-y-2 overflow-y-auto pr-1">
                {visibleConfirmedAppointments.length ? visibleConfirmedAppointments.map((booking) => (
                  <article key={booking.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-white">{booking.patient.firstName} {booking.patient.lastName}</p>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">{booking.reason || booking.patient.email}</p>
                    </div>
                    <time className="shrink-0 text-right text-[11px] font-black text-sky-100">{formatDateTime(booking.scheduledAt)}</time>
                  </article>
                )) : <EmptyState title="No confirmed visits" body="Accepted requests move into this schedule." />}
              </div>
            </section>
          </aside>
        </section>
      )}

      {activeModule === "notes" && (
        <section className="space-y-3">
          <h2 className="text-lg font-black text-white">Consultation Notes</h2>
          {completedConsultations.length ? completedConsultations.map((booking) => (
            <AppointmentCard
              key={booking.id}
              tone={tone}
              title={`${booking.patient.firstName} ${booking.patient.lastName}`}
              subtitle={booking.notes || "No notes captured"}
              scheduledAt={booking.scheduledAt}
              status={booking.status}
              reason={booking.prescription ? `Rx: ${booking.prescription}` : booking.reason}
            />
          )) : <EmptyState title="No completed notes" body="Completed live consultations create clinical notes here." />}
        </section>
      )}

      {activeModule === "prescriptions" && (
        <PrescriptionList
          role="doctor"
          items={doctor.bookings.map((booking) => ({
            id: booking.id,
            prescription: booking.prescription,
            reason: booking.reason,
            scheduledAt: booking.scheduledAt,
            owner: `${booking.patient.firstName} ${booking.patient.lastName}`,
          }))}
        />
      )}

      {activeModule === "messages" && <ChatPanel role="doctor" messages={session.messages} onSend={session.sendMessage} />}

      {activeModule === "notifications" && (
        <section className="space-y-3">
          {notifications.length ? notifications.map((item) => (
            <article key={`${item.title}-${item.body}`} className="rounded-xl border border-slate-850 bg-slate-900 p-4">
              <p className="text-sm font-black text-white">{item.title}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{item.body}</p>
            </article>
          )) : <EmptyState title="No notifications" body="Appointment, message, and prescription alerts appear here." />}
        </section>
      )}

      {activeModule === "analytics" && (
        <div className="space-y-5">
          <StatGrid
            tone="dark"
            stats={[
              { label: "Completed", value: completedConsultations.length, helper: "closed consultations" },
              { label: "Rating", value: doctor.rating.toFixed(1), helper: `${doctor.reviewCount} reviews` },
              { label: "Rx issued", value: prescriptions.length, helper: "prescriptions documented" },
            ]}
          />
        </div>
      )}

      {activeModule === "settings" && (
        <DoctorSettingsModule
          doctor={{ ...doctor, availability: doctorAvailability }}
          onProfileUpdated={(availability) => {
            setDoctorAvailability(availability);
            showToast("success", "Availability updated and schedule calendar synchronized.");
            realtime.publish({
              type: "doctor:availability-updated",
              actorRole: "doctor",
              doctorId: doctor.id,
              availability,
              title: "Doctor availability updated",
              body: "The consultation calendar schedule was updated.",
            });
          }}
        />
      )}
    </DashboardShell>
  );
}
