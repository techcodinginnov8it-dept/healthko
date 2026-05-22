"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logoutPatient } from "@/app/actions/auth";
import { bookAppointment } from "@/app/actions/patient";
import { authorizePatientVideoSession, endVideoSession } from "@/app/actions/video-session";
import { AppointmentCalendar } from "@/components/dashboard/AppointmentCalendar";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/DashboardShell";
import { PatientSettingsModule } from "@/components/dashboard/SettingsModule";
import {
  AppointmentCard,
  ChatPanel,
  EmptyState,
  LiveConsultationPanel,
  PrescriptionList,
  StatGrid,
  WaitingRoomPanel,
} from "@/components/dashboard/SharedModules";
import { useConsultationSession } from "@/hooks/useConsultationSession";
import { useDashboardModule } from "@/hooks/useDashboardModule";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { formatDateTime } from "@/lib/dashboard/format";
import type {
  DashboardDoctor,
  DashboardPatient,
  PatientAppointment,
  PatientModuleId,
  RealtimeEvent,
} from "@/lib/dashboard/types";

type Patient = DashboardPatient & {
  createdAt: Date;
  bookings: PatientAppointment[];
};

type PatientDashboardClientProps = {
  patient: Patient;
  doctors: DashboardDoctor[];
  initialModule?: PatientModuleId;
};

const PATIENT_MODULES = [
  "overview",
  "book",
  "live",
  "history",
  "prescriptions",
  "doctors",
  "messages",
  "notifications",
  "billing",
  "settings",
] as const satisfies readonly PatientModuleId[];

export default function PatientDashboardClient({ patient, doctors, initialModule = "overview" }: PatientDashboardClientProps) {
  const router = useRouter();
  const [activeModule, setActiveModule] = useDashboardModule<PatientModuleId>(initialModule, PATIENT_MODULES);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id || "");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");
  const [reason, setReason] = useState("");
  const [authorizedRooms, setAuthorizedRooms] = useState<Record<string, string>>({});
  const [startedAppointmentId, setStartedAppointmentId] = useState("");
  const [dismissedStartedId, setDismissedStartedId] = useState("");
  const [sessionNotice, setSessionNotice] = useState("");
  const [joinError, setJoinError] = useState("");
  const [bookingState, setBookingState] = useState<{ loading: boolean; error: string; success: string }>({
    loading: false,
    error: "",
    success: "",
  });

  const onRealtimeEvent = useCallback((event: RealtimeEvent) => {
    if (
      event.actorRole === "doctor" &&
      (
        event.type === "appointment:updated" ||
        event.type === "appointment:rescheduled" ||
        event.type === "appointment:cancelled" ||
        event.type === "appointment:referred" ||
        event.type === "session:started" ||
        event.type === "session:ended" ||
        event.type === "notification:new"
      )
    ) {
      if (event.type === "session:started" && event.roomId) {
        setAuthorizedRooms((current) => ({ ...current, [event.appointmentId]: event.roomId || "" }));
        if (dismissedStartedId !== event.appointmentId) {
          setStartedAppointmentId(event.appointmentId);
        }
        setSessionNotice(event.body || "Your doctor has started the consultation. You may now join.");
      }
      router.refresh();
    }
  }, [dismissedStartedId, router]);

  const realtime = useDashboardRealtime(onRealtimeEvent);
  const session = useConsultationSession<PatientAppointment>({
    role: "patient",
    publish: realtime.publish,
  });
  const receiveRealtimeEvent = session.receiveRealtimeEvent;

  useEffect(() => {
    receiveRealtimeEvent(realtime.lastEvent);
  }, [realtime.lastEvent, receiveRealtimeEvent]);

  const appointments = patient.bookings;
  const upcomingAppointments = useMemo(
    () => appointments.filter((booking) => new Date(booking.scheduledAt) >= new Date() && booking.status !== "CANCELLED"),
    [appointments]
  );
  const confirmedAppointments = upcomingAppointments.filter((booking) => booking.status === "CONFIRMED");
  const historicalAppointments = useMemo(
    () =>
      [...appointments]
        .filter((booking) => booking.status === "COMPLETED" || booking.status === "CANCELLED" || new Date(booking.scheduledAt) < new Date())
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [appointments]
  );
  const prescriptions = appointments.filter((booking) => booking.prescription);
  const notifications = [
    ...upcomingAppointments.slice(0, 3).map((booking) => ({
      title: `${booking.status.toLowerCase()} appointment`,
      body: `${booking.doctor.name} · ${formatDateTime(booking.scheduledAt)}`,
    })),
    ...prescriptions.slice(0, 2).map((booking) => ({
      title: "Prescription available",
      body: `${booking.prescription} from ${booking.doctor.name}`,
    })),
  ];

  const navItems: DashboardNavItem<PatientModuleId>[] = [
    { id: "overview", label: "Overview" },
    { id: "book", label: "Appointments" },
    { id: "live", label: "Consultations", badge: confirmedAppointments.length || undefined },
    { id: "history", label: "Medical Access", badge: prescriptions.length || undefined },
    { id: "settings", label: "Settings" },
  ];

  const handleBookAppointment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDoctorId || !appointmentDate || !appointmentTime || !reason.trim()) {
      setBookingState({ loading: false, error: "Choose a doctor, date, time, and visit reason.", success: "" });
      return;
    }

    setBookingState({ loading: true, error: "", success: "" });
    const result = await bookAppointment({
      doctorId: selectedDoctorId,
      scheduledAt: `${appointmentDate}T${appointmentTime}:00`,
      reason,
    });

    if (!result.success) {
      setBookingState({ loading: false, error: result.error || "Could not book appointment.", success: "" });
      return;
    }

    realtime.publish({
      type: "appointment:created",
      appointmentId: result.consultation?.id || "pending",
      actorRole: "patient",
      scheduledAt: `${appointmentDate}T${appointmentTime}:00`,
      title: "New appointment request",
      body: "A patient submitted a consultation request for review.",
    });
    setBookingState({ loading: false, error: "", success: "Appointment request sent to the doctor." });
    setAppointmentDate("");
    setAppointmentTime("");
    setReason("");
    router.refresh();
  };

  const joinAuthorizedSession = async (targetAppointment?: PatientAppointment) => {
    const appointment = targetAppointment || session.activeAppointment;

    if (!appointment) {
      return;
    }

    setJoinError("");
    setStartedAppointmentId("");
    setDismissedStartedId(appointment.id);

    const result = await authorizePatientVideoSession(appointment.id);
    if (!result.success || !result.roomId || !result.accessToken) {
      setJoinError(result.error || "The doctor has not started this consultation yet.");
      session.openWaitingRoom(appointment);
      setActiveModule("live");
      return;
    }

    session.enterAuthorizedRoom(appointment, result.roomId, result.accessToken);
    realtime.joinVideoRoom(result.roomId);
    setActiveModule("live");
    realtime.publish({
      type: "session:joined",
      appointmentId: appointment.id,
      actorRole: "patient",
      roomId: result.roomId,
    });
  };

  const startLiveSession = (appointment: PatientAppointment) => {
    setJoinError("");
    setSessionNotice("");

    if (authorizedRooms[appointment.id]) {
      void joinAuthorizedSession(appointment);
      return;
    }

    session.openWaitingRoom(appointment);
    setActiveModule("live");
  };

  const handleEndSession = async () => {
    if (session.activeAppointment) {
      await endVideoSession(session.activeAppointment.id);
    }
    session.endSession();
    setStartedAppointmentId("");
    setActiveModule("overview");
    router.refresh();
  };

  const tone = "light" as const;
  const startedAppointment = startedAppointmentId
    ? confirmedAppointments.find((booking) => booking.id === startedAppointmentId)
    : undefined;

  return (
    <DashboardShell
      role="patient"
      activeModule={activeModule}
      navItems={navItems}
      title={`${patient.firstName} ${patient.lastName}`}
      subtitle="Patient dashboard"
      profile={{
        name: `${patient.firstName} ${patient.lastName}`,
        detail: patient.email,
        meta: patient.emailVerified ? "Email verified" : "Email pending verification",
      }}
      connectionState={realtime.connectionState}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((value) => !value)}
      onNavigate={setActiveModule}
      onLogout={() => (
        <form action={logoutPatient}>
          <button type="submit" className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-white">
            Sign Out
          </button>
        </form>
      )}
    >
      {startedAppointmentId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-xl border border-emerald-200 bg-white p-8 text-center shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-teal">Live consultation ready</p>
            <h2 className="mt-3 font-display text-3xl font-black text-slate-950">
              {startedAppointment?.doctor.name || "Your doctor"} started the consultation
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm font-semibold text-slate-500">
              Join the secure live room now.
            </p>
            <button
              type="button"
              onClick={() => {
                if (startedAppointment) {
                  void joinAuthorizedSession(startedAppointment);
                }
              }}
              className="mt-6 rounded-lg bg-brand-teal px-6 py-3 text-sm font-black text-white"
            >
              Join Consultation
            </button>
          </div>
        </div>
      )}

      {activeModule === "overview" && (
        <div className="space-y-6">
          <StatGrid
            stats={[
              { label: "Upcoming", value: upcomingAppointments.length, helper: "appointments in your care plan" },
              { label: "Prescriptions", value: prescriptions.length, helper: "active documents available" },
              { label: "Doctors", value: doctors.length, helper: "clinicians in directory" },
            ]}
          />
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">Appointment Timeline</h2>
              <button type="button" onClick={() => setActiveModule("book")} className="rounded-lg bg-brand-teal px-3 py-2 text-xs font-black text-white">
                Book Appointment
              </button>
            </div>
            <div className="space-y-3">
              {upcomingAppointments.length ? (
                upcomingAppointments.map((booking) => (
                  <AppointmentCard
                    key={booking.id}
                    title={booking.doctor.name}
                    subtitle={booking.doctor.specialty}
                    scheduledAt={booking.scheduledAt}
                    status={booking.status}
                    reason={booking.reason}
                    actions={
                      booking.status === "CONFIRMED" ? (
                        <button type="button" onClick={() => startLiveSession(booking)} className="rounded-lg bg-brand-red px-3 py-2 text-xs font-black text-white">
                          Open Waiting Room
                        </button>
                      ) : undefined
                    }
                  />
                ))
              ) : (
                <EmptyState title="No upcoming appointments" body="Book a visit to start a connected care workflow." />
              )}
            </div>
          </section>
          <AppointmentCalendar
            appointments={upcomingAppointments.map((booking) => ({
              id: booking.id,
              title: booking.doctor.name,
              subtitle: booking.reason || booking.doctor.specialty,
              scheduledAt: booking.scheduledAt,
              status: booking.status,
            }))}
          />
        </div>
      )}

      {activeModule === "book" && (
        <section className="max-w-3xl rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-black">Book Appointment</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Your request goes to the selected doctor queue and updates both dashboards.</p>
          <form onSubmit={handleBookAppointment} className="mt-5 grid gap-4 md:grid-cols-2">
            {bookingState.error && <div className="rounded-lg border border-brand-red/20 bg-brand-red/10 p-3 text-xs font-bold text-brand-red md:col-span-2">{bookingState.error}</div>}
            {bookingState.success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700 md:col-span-2">{bookingState.success}</div>}
            <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500 md:col-span-2">
              Doctor
              <select value={selectedDoctorId} onChange={(event) => setSelectedDoctorId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold normal-case text-slate-900">
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name} · {doctor.specialty}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
              Date
              <input type="date" value={appointmentDate} onChange={(event) => setAppointmentDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900" />
            </label>
            <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
              Time
              <input type="time" value={appointmentTime} onChange={(event) => setAppointmentTime(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900" />
            </label>
            <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500 md:col-span-2">
              Visit reason
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold normal-case text-slate-900" />
            </label>
            <button type="submit" disabled={bookingState.loading} className="rounded-lg bg-brand-teal px-4 py-3 text-sm font-black text-white disabled:bg-slate-300 md:col-span-2">
              {bookingState.loading ? "Sending request..." : "Send Appointment Request"}
            </button>
          </form>
        </section>
      )}

      {activeModule === "live" && (
        session.activeAppointment && session.status === "connected" ? (
          <LiveConsultationPanel
            role="patient"
            counterpartName={session.activeAppointment.doctor.name}
            appointmentTime={session.activeAppointment.scheduledAt}
            status={session.status}
            isCameraOn={session.isCameraOn}
            isMicOn={session.isMicOn}
            counterpartCameraOn={session.counterpartCameraOn}
            counterpartMicOn={session.counterpartMicOn}
            onToggleCamera={session.toggleCamera}
            onToggleMic={session.toggleMic}
            onEnd={handleEndSession}
            chat={<ChatPanel role="patient" messages={session.messages} onSend={session.sendMessage} />}
          />
        ) : session.activeAppointment ? (
          <WaitingRoomPanel
            doctorName={session.activeAppointment.doctor.name}
            appointmentTime={session.activeAppointment.scheduledAt}
            isCameraOn={session.isCameraOn}
            isMicOn={session.isMicOn}
            isSpeakerReady={session.isSpeakerReady}
            canJoin={Boolean(authorizedRooms[session.activeAppointment.id])}
            notice={sessionNotice}
            error={joinError}
            onToggleCamera={session.toggleCamera}
            onToggleMic={session.toggleMic}
            onToggleSpeaker={session.toggleSpeaker}
            onJoin={joinAuthorizedSession}
          />
        ) : (
          <section className="space-y-4">
            <h2 className="text-lg font-black">Live Consultation</h2>
            {confirmedAppointments.length ? (
              confirmedAppointments.map((booking) => (
                <AppointmentCard
                  key={booking.id}
                  title={booking.doctor.name}
                  subtitle={booking.doctor.specialty}
                  scheduledAt={booking.scheduledAt}
                  status={booking.status}
                  reason={booking.reason}
                  actions={<button type="button" onClick={() => startLiveSession(booking)} className="rounded-lg bg-brand-red px-3 py-2 text-xs font-black text-white">Enter Waiting Room</button>}
                />
              ))
            ) : (
              <EmptyState title="No confirmed live room" body="A doctor must accept your appointment before a room appears here." />
            )}
          </section>
        )
      )}

      {activeModule === "history" && (
        <div className="space-y-6">
          <section className="space-y-4">
            <h2 className="text-lg font-black">Medical Access</h2>
            {historicalAppointments.length ? (
              historicalAppointments.map((booking) => (
                <AppointmentCard key={booking.id} title={booking.doctor.name} subtitle={booking.doctor.specialty} scheduledAt={booking.scheduledAt} status={booking.status} reason={booking.notes || booking.reason} />
              ))
            ) : (
              <EmptyState title="No medical history yet" body="Completed consultations and doctor notes appear here." />
            )}
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-black">Prescriptions</h3>
              <p className="text-xs font-semibold text-slate-500">Issued prescriptions remain available with your visit history.</p>
            </div>
            <PrescriptionList
              role="patient"
              items={appointments.map((booking) => ({
                id: booking.id,
                prescription: booking.prescription,
                reason: booking.reason,
                scheduledAt: booking.scheduledAt,
                owner: booking.doctor.name,
              }))}
            />
          </section>
        </div>
      )}

      {activeModule === "prescriptions" && (
        <PrescriptionList
          role="patient"
          items={appointments.map((booking) => ({
            id: booking.id,
            prescription: booking.prescription,
            reason: booking.reason,
            scheduledAt: booking.scheduledAt,
            owner: booking.doctor.name,
          }))}
        />
      )}

      {activeModule === "doctors" && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {doctors.map((doctor) => (
            <article key={doctor.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-black text-slate-950">{doctor.name}</p>
              <p className="mt-1 text-xs font-bold text-brand-teal">{doctor.specialty}</p>
              <p className="mt-3 text-xs font-semibold text-slate-500">{doctor.availability}</p>
              <button type="button" onClick={() => { setSelectedDoctorId(doctor.id); setActiveModule("book"); }} className="mt-4 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white">
                Book with Doctor
              </button>
            </article>
          ))}
        </section>
      )}

      {activeModule === "messages" && <ChatPanel role="patient" messages={session.messages} onSend={session.sendMessage} tone={tone} />}

      {activeModule === "notifications" && (
        <section className="space-y-3">
          {notifications.length ? notifications.map((item) => (
            <article key={`${item.title}-${item.body}`} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-black text-slate-950">{item.title}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{item.body}</p>
            </article>
          )) : <EmptyState title="No notifications" body="Appointment, consultation, and prescription alerts appear here." />}
        </section>
      )}

      {activeModule === "billing" && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-black">Payments & Billing</h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">No outstanding patient balances. Payment records will attach to confirmed consultations.</p>
        </section>
      )}

      {activeModule === "settings" && (
        <PatientSettingsModule patient={patient} />
      )}
    </DashboardShell>
  );
}
