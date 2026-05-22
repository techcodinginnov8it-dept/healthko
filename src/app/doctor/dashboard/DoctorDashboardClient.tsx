"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logoutDoctor } from "@/app/actions/auth";
import { acceptAppointment, cancelAppointment, completeConsultation, referAppointment, rescheduleAppointment } from "@/app/actions/doctor";
import { endVideoSession, startVideoSession } from "@/app/actions/video-session";
import { AppointmentCalendar } from "@/components/dashboard/AppointmentCalendar";
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

  const onRealtimeEvent = useCallback((event: RealtimeEvent) => {
    if (
      event.actorRole === "patient" &&
      (event.type === "appointment:created" || event.type === "appointment:updated")
    ) {
      router.refresh();
    }
  }, [router]);

  const realtime = useDashboardRealtime(onRealtimeEvent);
  const session = useConsultationSession<DoctorAppointment>({
    role: "doctor",
    publish: realtime.publish,
  });
  const receiveRealtimeEvent = session.receiveRealtimeEvent;

  useEffect(() => {
    receiveRealtimeEvent(realtime.lastEvent);
  }, [realtime.lastEvent, receiveRealtimeEvent]);

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

  const navItems: DashboardNavItem<DoctorModuleId>[] = [
    { id: "overview", label: "Overview" },
    { id: "schedule", label: "Appointments", badge: pendingAppointments.length || undefined },
    { id: "live", label: "Consultations", badge: confirmedAppointments.length || undefined },
    { id: "patients", label: "Patient Management" },
    { id: "settings", label: "Settings" },
  ];

  const handleAccept = async (consultationId: string) => {
    setActionLoadingId(consultationId);
    const result = await acceptAppointment(consultationId);
    setActionLoadingId(null);
    if (result.success) {
      realtime.publish({ type: "appointment:updated", appointmentId: consultationId, actorRole: "doctor", title: "Appointment approved", body: "Your doctor approved the consultation request." });
      router.refresh();
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
    const result = await rescheduleAppointment({ consultationId, scheduledAt });
    setActionLoadingId(null);
    if (result.success) {
      realtime.publish({
        type: "appointment:rescheduled",
        appointmentId: consultationId,
        actorRole: "doctor",
        scheduledAt,
        title: "Consultation rescheduled",
        body: `Your consultation moved to ${formatDateTime(scheduledAt)}.`,
      });
      router.refresh();
    }
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
            chat={<ChatPanel role="doctor" messages={session.messages} onSend={session.sendMessage} />}
            documentation={
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-teal">Clinical Documentation</p>
                <form onSubmit={handleComplete} className="mt-4 space-y-3">
                  {submitState.error && <div className="rounded-lg border border-brand-red/20 bg-brand-red/10 p-3 text-xs font-bold text-brand-red">{submitState.error}</div>}
                  {submitState.success && <div className="rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-xs font-bold text-emerald-300">{submitState.success}</div>}
                  <input value={diagnosisText} onChange={(event) => setDiagnosisText(event.target.value)} placeholder="Diagnosis / impression" className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand-teal" />
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
        <section className="space-y-5">
          <AppointmentCalendar
            tone={tone}
            editable
            appointments={[...pendingAppointments, ...confirmedAppointments].map((booking) => ({
              id: booking.id,
              title: `${booking.patient.firstName} ${booking.patient.lastName}`,
              subtitle: booking.reason || booking.patient.email,
              scheduledAt: booking.scheduledAt,
              status: booking.status,
            }))}
            onReschedule={handleReschedule}
          />
          <div className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-3">
            <h2 className="text-lg font-black text-white">Pending Appointments</h2>
            {pendingAppointments.length ? pendingAppointments.map((booking) => (
              <AppointmentCard
                key={booking.id}
                tone={tone}
                title={`${booking.patient.firstName} ${booking.patient.lastName}`}
                subtitle={booking.patient.email}
                scheduledAt={booking.scheduledAt}
                status={booking.status}
                reason={booking.reason}
                actions={
                  <>
                    <button type="button" disabled={actionLoadingId === booking.id} onClick={() => handleAccept(booking.id)} className="rounded-lg bg-brand-teal px-3 py-2 text-xs font-black text-white">Accept</button>
                    <button type="button" disabled={actionLoadingId === booking.id} onClick={() => handleCancel(booking.id)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-black text-white">Cancel</button>
                    <select
                      value={referralTargets[booking.id] || ""}
                      onChange={(event) => setReferralTargets((current) => ({ ...current, [booking.id]: event.target.value }))}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                      aria-label="Refer to doctor"
                    >
                      <option value="">Refer</option>
                      {doctors.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name} - {candidate.specialty}
                        </option>
                      ))}
                    </select>
                    <button type="button" disabled={actionLoadingId === booking.id || !referralTargets[booking.id]} onClick={() => handleReferral(booking.id)} className="rounded-lg bg-brand-red px-3 py-2 text-xs font-black text-white disabled:bg-slate-800">Send Referral</button>
                  </>
                }
              />
            )) : <EmptyState title="No pending requests" body="Patient bookings arrive here in realtime." />}
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-black text-white">Confirmed Appointments</h2>
            {confirmedAppointments.length ? confirmedAppointments.map((booking) => (
              <AppointmentCard key={booking.id} tone={tone} title={`${booking.patient.firstName} ${booking.patient.lastName}`} subtitle={booking.patient.email} scheduledAt={booking.scheduledAt} status={booking.status} reason={booking.reason} />
            )) : <EmptyState title="No confirmed visits" body="Accepted requests move into this schedule." />}
          </div>
          </div>
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
        <DoctorSettingsModule doctor={doctor} />
      )}
    </DashboardShell>
  );
}
