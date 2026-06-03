"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { logoutDoctor } from "@/app/actions/auth";
import { acceptAppointment, cancelAppointment, completeConsultation, referAppointment, rescheduleAppointment, scheduleFollowUpAppointment } from "@/app/actions/doctor";
import { endVideoSession, startVideoSession } from "@/app/actions/video-session";
import { AppointmentCalendar, type CalendarViewMode } from "@/components/dashboard/AppointmentCalendar";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/DashboardShell";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { DoctorSettingsModule } from "@/components/dashboard/SettingsModule";
import {
  AppointmentCard,
  ChatPanel,
  EmptyState,
  FloatingConsultationCall,
  LiveConsultationPanel,
  PrescriptionList,
  StatGrid,
} from "@/components/dashboard/SharedModules";
import { useConsultationSession } from "@/hooks/useConsultationSession";
import { useDashboardModule } from "@/hooks/useDashboardModule";
import { useDashboardNotifications } from "@/hooks/useDashboardNotifications";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { useWebRTC } from "@/hooks/useWebRTC";
import { formatDateTime } from "@/lib/dashboard/format";
import { createDashboardNotification } from "@/lib/dashboard/notifications";
import type {
  ChatAttachment,
  ChatMessage,
  DashboardNotification,
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

type PatientStatusFilter = "all" | "active" | "pending" | "completed" | "prescriptions";
type PatientRecordsTab = "records" | "history" | "prescriptions" | "session";

type PatientProfile = DoctorAppointment["patient"] & {
  appointments: DoctorAppointment[];
  pending: DoctorAppointment[];
  confirmed: DoctorAppointment[];
  completed: DoctorAppointment[];
  prescriptions: DoctorAppointment[];
  nextAppointment: DoctorAppointment | null;
  lastEncounter: DoctorAppointment | null;
  activeAppointment: DoctorAppointment | null;
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

const PATIENT_STATUS_FILTERS: { id: PatientStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "prescriptions", label: "Rx" },
];

const PATIENT_RECORD_TABS: { id: PatientRecordsTab; label: string }[] = [
  { id: "records", label: "Records" },
  { id: "history", label: "History" },
  { id: "prescriptions", label: "Rx" },
  { id: "session", label: "Live" },
];

function getPatientDisplayName(patient: Pick<DoctorAppointment["patient"], "firstName" | "lastName">) {
  return `${patient.firstName} ${patient.lastName}`.trim();
}

function getPatientAge(dob: string) {
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) {
    return "Age unavailable";
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age >= 0 ? `${age} years` : "Age unavailable";
}

function getStatusClasses(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "border-emerald-300/20 bg-emerald-400/10 text-emerald-100";
    case "PENDING":
      return "border-amber-300/20 bg-amber-400/10 text-amber-100";
    case "COMPLETED":
      return "border-sky-300/20 bg-sky-400/10 text-sky-100";
    case "CANCELLED":
      return "border-red-300/20 bg-red-400/10 text-red-100";
    default:
      return "border-slate-700 bg-slate-800 text-slate-200";
  }
}

function PatientOperationsHub({
  patients,
  allPatientCount,
  selectedPatient,
  selectedConsultation,
  activeAppointment,
  activeSessionStatus,
  patientSearch,
  statusFilter,
  recordsTab,
  actionLoadingId,
  messages,
  onSearchChange,
  onStatusFilterChange,
  onRecordsTabChange,
  onSelectPatient,
  onSelectConsultation,
  onOpenFollowUp,
  onAccept,
  onCancel,
  onStartLive,
  onOpenLive,
  onSendMessage,
}: {
  patients: PatientProfile[];
  allPatientCount: number;
  selectedPatient: PatientProfile | null;
  selectedConsultation: DoctorAppointment | null;
  activeAppointment: DoctorAppointment | null;
  activeSessionStatus: "idle" | "waiting" | "connected" | "ended";
  patientSearch: string;
  statusFilter: PatientStatusFilter;
  recordsTab: PatientRecordsTab;
  actionLoadingId: string | null;
  messages: ChatMessage[];
  onSearchChange: (value: string) => void;
  onStatusFilterChange: (value: PatientStatusFilter) => void;
  onRecordsTabChange: (value: PatientRecordsTab) => void;
  onSelectPatient: (patientId: string) => void;
  onSelectConsultation: (consultationId: string) => void;
  onOpenFollowUp: (patientId: string, reason?: string | null) => void;
  onAccept: (consultationId: string) => void;
  onCancel: (consultationId: string) => void;
  onStartLive: (appointment: DoctorAppointment) => void;
  onOpenLive: () => void;
  onSendMessage: (text: string, attachment?: ChatAttachment) => void;
}) {
  const selectedPatientName = selectedPatient ? getPatientDisplayName(selectedPatient) : "";
  const selectedPatientActiveAppointment =
    activeAppointment && selectedPatient && activeAppointment.patient.id === selectedPatient.id ? activeAppointment : null;
  const selectedPatientMessages = selectedPatientActiveAppointment ? messages : [];
  const selectedPatientLiveStatus = selectedPatientActiveAppointment
    ? activeSessionStatus === "connected"
      ? "Connected"
      : activeSessionStatus === "waiting"
        ? "Waiting room"
        : "Session staged"
    : "No active room";

  return (
    <section className="grid min-h-[calc(100vh-9rem)] gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px] 2xl:grid-cols-[360px_minmax(0,1fr)_400px]">
      <aside className="flex min-h-0 flex-col rounded-xl border border-slate-850 bg-slate-900">
        <header className="border-b border-slate-850 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Directory</p>
              <h2 className="mt-1 text-lg font-black text-white">Patients</h2>
            </div>
            <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-black text-slate-300">
              {allPatientCount}
            </span>
          </div>
          <input
            value={patientSearch}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search patient, reason, contact"
            className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-white outline-none focus:border-brand-teal"
          />
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {PATIENT_STATUS_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => onStatusFilterChange(filter.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase ${
                  statusFilter === filter.id ? "bg-brand-teal text-white" : "bg-slate-950 text-slate-400"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </header>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {patients.length ? (
            patients.map((patient) => {
              const isSelected = selectedPatient?.id === patient.id;
              const nextLabel = patient.nextAppointment ? formatDateTime(patient.nextAppointment.scheduledAt) : "No upcoming visit";

              return (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => onSelectPatient(patient.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-brand-teal bg-brand-teal/10 shadow-[0_0_0_1px_rgba(20,184,166,0.2)]"
                      : "border-slate-800 bg-slate-950 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">{getPatientDisplayName(patient)}</p>
                      <p className="mt-1 truncate text-[11px] font-semibold text-slate-400">{patient.email}</p>
                    </div>
                    {patient.activeAppointment && (
                      <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-200">
                        Live
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <span className="rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-black text-slate-300">{patient.pending.length} pending</span>
                    <span className="rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-black text-slate-300">{patient.confirmed.length} active</span>
                    <span className="rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-black text-slate-300">{patient.completed.length} records</span>
                  </div>
                  <p className="mt-3 text-[11px] font-semibold text-slate-500">{nextLabel}</p>
                </button>
              );
            })
          ) : (
            <EmptyState title="No matching patients" body="Adjust search or filters to review patient records." />
          )}
        </div>
      </aside>

      <section className="min-w-0 space-y-4">
        {selectedPatient ? (
          <>
            <section className="rounded-xl border border-slate-850 bg-slate-900 p-5 text-white">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-black">{selectedPatientName}</h2>
                    <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-black uppercase text-slate-300">
                      {selectedPatient.emailVerified ? "Verified" : "Unverified"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-400">
                    {getPatientAge(selectedPatient.dob)} / {selectedPatient.gender || "Unspecified"} / DOB {selectedPatient.dob}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {selectedPatient.email} / {selectedPatient.countryCode || ""} {selectedPatient.phone}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenFollowUp(selectedPatient.id, selectedConsultation?.reason)}
                    className="rounded-lg bg-brand-teal px-3 py-2 text-xs font-black text-white"
                  >
                    Schedule Follow-Up
                  </button>
                  {selectedPatientActiveAppointment ? (
                    <button type="button" onClick={onOpenLive} className="rounded-lg bg-brand-red px-3 py-2 text-xs font-black text-white">
                      Open Live Room
                    </button>
                  ) : selectedPatient.nextAppointment ? (
                    <button
                      type="button"
                      disabled={actionLoadingId === selectedPatient.nextAppointment.id}
                      onClick={() => onStartLive(selectedPatient.nextAppointment as DoctorAppointment)}
                      className="rounded-lg bg-brand-red px-3 py-2 text-xs font-black text-white disabled:bg-slate-800"
                    >
                      Start Consultation
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {[
                  { label: "Encounters", value: selectedPatient.appointments.length },
                  { label: "Open", value: selectedPatient.pending.length + selectedPatient.confirmed.length },
                  { label: "Completed", value: selectedPatient.completed.length },
                  { label: "Prescriptions", value: selectedPatient.prescriptions.length },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3">
                    <p className="text-xl font-black">{stat.value}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="rounded-xl border border-slate-850 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Clinical Workspace</p>
                    <h3 className="text-base font-black text-white">Consultation Context</h3>
                  </div>
                  {selectedConsultation && (
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${getStatusClasses(selectedConsultation.status)}`}>
                      {selectedConsultation.status}
                    </span>
                  )}
                </div>
                {selectedConsultation ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-amber-300/20 border-l-4 border-l-amber-300 bg-amber-300/10 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Chief Complaint</p>
                      <p className="mt-2 text-sm font-semibold leading-relaxed text-amber-50">
                        {selectedConsultation.reason || "No chief complaint captured."}
                      </p>
                      <p className="mt-3 text-xs font-bold text-amber-100">{formatDateTime(selectedConsultation.scheduledAt)}</p>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <ClinicalTextBlock title="Active Care Notes" body={selectedConsultation.notes || "No signed clinical notes for this encounter."} />
                      <ClinicalTextBlock title="Medication Plan" body={selectedConsultation.prescription || "No prescription issued for this encounter."} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedConsultation.status === "PENDING" && (
                        <>
                          <button
                            type="button"
                            disabled={actionLoadingId === selectedConsultation.id}
                            onClick={() => onAccept(selectedConsultation.id)}
                            className="rounded-lg bg-brand-teal px-3 py-2 text-xs font-black text-white disabled:bg-slate-800"
                          >
                            Accept Request
                          </button>
                          <button
                            type="button"
                            disabled={actionLoadingId === selectedConsultation.id}
                            onClick={() => onCancel(selectedConsultation.id)}
                            className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-black text-white"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {selectedConsultation.status === "CONFIRMED" && (
                        <button
                          type="button"
                          disabled={actionLoadingId === selectedConsultation.id}
                          onClick={() => onStartLive(selectedConsultation)}
                          className="rounded-lg bg-brand-red px-3 py-2 text-xs font-black text-white disabled:bg-slate-800"
                        >
                          Start Live Session
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <EmptyState title="No consultation selected" body="Select a patient encounter from the record panel." />
                )}
              </div>

              <div className="rounded-xl border border-slate-850 bg-slate-900 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Realtime Communication</p>
                <div className="mt-3">
                  {selectedPatientActiveAppointment ? (
                    <ChatPanel role="doctor" messages={selectedPatientMessages} onSend={onSendMessage} />
                  ) : (
                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                      <p className="text-sm font-black text-white">No active consultation chat</p>
                      <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-400">
                        Start or open a live room for this patient to continue secure consultation messaging.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : (
          <EmptyState title="No patients yet" body="Patients appear after appointment requests are booked." />
        )}
      </section>

      <aside className="min-h-0 rounded-xl border border-slate-850 bg-slate-900">
        <header className="border-b border-slate-850 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Records</p>
          <h2 className="mt-1 text-lg font-black text-white">Patient Chart</h2>
          <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-slate-950 p-1">
            {PATIENT_RECORD_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onRecordsTabChange(tab.id)}
                className={`rounded-md px-2 py-1.5 text-[10px] font-black uppercase ${
                  recordsTab === tab.id ? "bg-brand-teal text-white" : "text-slate-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>
        <div className="max-h-[calc(100vh-15rem)] space-y-3 overflow-y-auto p-4">
          {selectedPatient ? (
            <>
              {recordsTab === "records" && (
                <div className="space-y-3">
                  <ClinicalTextBlock title="Medical Record Summary" body={selectedPatient.lastEncounter?.notes || "No completed medical record summary is available yet."} />
                  <ClinicalTextBlock title="Current Medication" body={selectedPatient.prescriptions.at(-1)?.prescription || "No active prescription on file."} />
                  <ClinicalTextBlock title="Care Continuity" body={selectedPatient.nextAppointment ? `Next confirmed visit: ${formatDateTime(selectedPatient.nextAppointment.scheduledAt)}` : "No confirmed follow-up is scheduled."} />
                </div>
              )}

              {recordsTab === "history" && (
                <RecordTimeline
                  appointments={selectedPatient.appointments}
                  selectedConsultationId={selectedConsultation?.id || ""}
                  onSelectConsultation={onSelectConsultation}
                />
              )}

              {recordsTab === "prescriptions" && (
                <div className="space-y-3">
                  {selectedPatient.prescriptions.length ? (
                    selectedPatient.prescriptions.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        tone="dark"
                        title={appointment.prescription || "Prescription"}
                        subtitle={getPatientDisplayName(selectedPatient)}
                        scheduledAt={appointment.scheduledAt}
                        status={appointment.status}
                        reason={appointment.reason}
                      />
                    ))
                  ) : (
                    <EmptyState title="No prescriptions" body="Medication plans issued during consultations appear here." />
                  )}
                </div>
              )}

              {recordsTab === "session" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Live Session Status</p>
                    <p className="mt-2 text-lg font-black text-white">{selectedPatientLiveStatus}</p>
                    {selectedPatientActiveAppointment && (
                      <button type="button" onClick={onOpenLive} className="mt-4 w-full rounded-lg bg-brand-red px-3 py-2 text-xs font-black text-white">
                        Return To Live Room
                      </button>
                    )}
                  </div>
                  <RecordTimeline
                    appointments={selectedPatient.confirmed}
                    selectedConsultationId={selectedConsultation?.id || ""}
                    onSelectConsultation={onSelectConsultation}
                  />
                </div>
              )}
            </>
          ) : (
            <EmptyState title="No chart selected" body="Choose a patient to open their longitudinal chart." />
          )}
        </div>
      </aside>
    </section>
  );
}

function ClinicalTextBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-200">{body}</p>
    </div>
  );
}

function RecordTimeline({
  appointments,
  selectedConsultationId,
  onSelectConsultation,
}: {
  appointments: DoctorAppointment[];
  selectedConsultationId: string;
  onSelectConsultation: (consultationId: string) => void;
}) {
  return appointments.length ? (
    <div className="space-y-2">
      {appointments.map((appointment) => {
        const isSelected = appointment.id === selectedConsultationId;

        return (
          <button
            key={appointment.id}
            type="button"
            onClick={() => onSelectConsultation(appointment.id)}
            className={`w-full rounded-xl border p-3 text-left ${
              isSelected ? "border-brand-teal bg-brand-teal/10" : "border-slate-800 bg-slate-950 hover:border-slate-700"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-black text-white">{formatDateTime(appointment.scheduledAt)}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${getStatusClasses(appointment.status)}`}>
                {appointment.status}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs font-semibold text-slate-400">
              {appointment.reason || appointment.notes || appointment.prescription || "Clinical encounter"}
            </p>
          </button>
        );
      })}
    </div>
  ) : (
    <EmptyState title="No records" body="Encounters for this patient appear here." />
  );
}

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
  const [patientSearch, setPatientSearch] = useState("");
  const [patientStatusFilter, setPatientStatusFilter] = useState<PatientStatusFilter>("all");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedConsultationId, setSelectedConsultationId] = useState("");
  const [patientRecordsTab, setPatientRecordsTab] = useState<PatientRecordsTab>("records");
  const [patientReferenceTime] = useState(() => Date.now());
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
    }, 5000);
  }, []);

  const onRealtimeEvent = useCallback((event: RealtimeEvent) => {
    const targetsAnotherDoctor = "targetDoctorId" in event && event.targetDoctorId && event.targetDoctorId !== doctor.id;
    if (targetsAnotherDoctor) {
      return;
    }

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
  const doctorScopedRealtimeEvent = useMemo(() => {
    const event = realtime.lastEvent;
    if (!event || !("targetDoctorId" in event) || !event.targetDoctorId || event.targetDoctorId === doctor.id) {
      return event;
    }

    return null;
  }, [doctor.id, realtime.lastEvent]);
  const session = useConsultationSession<DoctorAppointment>({
    role: "doctor",
    publish: realtime.publish,
    persistKey: `healthko:doctor:${doctor.id}:active-consultation`,
  });
  const webRTC = useWebRTC({
    roomId: session.roomId,
    role: "doctor",
    getSocket: realtime.getSocket,
    isCameraOn: session.isCameraOn,
    isMicOn: session.isMicOn,
    isActive: Boolean(session.roomId && (session.status === "waiting" || session.status === "connected")),
    signalingReady: realtime.socketReady,
    onRemoteSessionEnded: () => {
      session.endSession(false);
      showToast("error", "The other participant ended the consultation.");
      setActiveModule("overview");
    },
  });
  const receiveRealtimeEvent = session.receiveRealtimeEvent;

  useEffect(() => {
    receiveRealtimeEvent(realtime.lastEvent);
  }, [realtime.lastEvent, receiveRealtimeEvent]);

  const pendingAppointments = useMemo(
    () => doctor.bookings.filter((booking) => booking.status === "PENDING"),
    [doctor.bookings]
  );
  const confirmedAppointments = useMemo(
    () => doctor.bookings.filter(
      (booking) => booking.status === "CONFIRMED" && new Date(booking.scheduledAt).getTime() >= patientReferenceTime
    ),
    [doctor.bookings, patientReferenceTime]
  );
  const completedConsultations = useMemo(
    () => doctor.bookings.filter((booking) => booking.status === "COMPLETED"),
    [doctor.bookings]
  );
  const patients = useMemo(() => {
    const map = new Map<string, DoctorAppointment["patient"]>();
    doctor.bookings.forEach((booking) => map.set(booking.patient.id, booking.patient));
    return Array.from(map.values());
  }, [doctor.bookings]);
  const prescriptions = useMemo(
    () => doctor.bookings.filter((booking) => booking.prescription),
    [doctor.bookings]
  );
  const patientProfiles = useMemo<PatientProfile[]>(() => {
    const patientMap = new Map<string, PatientProfile>();
    const sortedBookings = [...doctor.bookings].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );

    sortedBookings.forEach((booking) => {
      const existing = patientMap.get(booking.patient.id);
      const profile: PatientProfile = existing || {
        ...booking.patient,
        appointments: [],
        pending: [],
        confirmed: [],
        completed: [],
        prescriptions: [],
        nextAppointment: null,
        lastEncounter: null,
        activeAppointment: null,
      };

      profile.appointments.push(booking);

      if (booking.status === "PENDING") {
        profile.pending.push(booking);
      }

      if (booking.status === "CONFIRMED") {
        profile.confirmed.push(booking);
      }

      if (booking.status === "COMPLETED") {
        profile.completed.push(booking);
      }

      if (booking.prescription) {
        profile.prescriptions.push(booking);
      }

      patientMap.set(booking.patient.id, profile);
    });

    return Array.from(patientMap.values())
      .map((profile) => {
        const futureAppointments = profile.appointments.filter(
          (booking) => booking.status === "CONFIRMED" && new Date(booking.scheduledAt).getTime() >= patientReferenceTime
        );
        const pastAppointments = profile.appointments.filter(
          (booking) => new Date(booking.scheduledAt).getTime() < patientReferenceTime || booking.status === "COMPLETED"
        );

        return {
          ...profile,
          nextAppointment: futureAppointments[0] || null,
          lastEncounter: pastAppointments[pastAppointments.length - 1] || null,
          activeAppointment:
            session.activeAppointment?.patient.id === profile.id ? session.activeAppointment : null,
        };
      })
      .sort((a, b) => {
        const aTime = new Date(a.nextAppointment?.scheduledAt || a.lastEncounter?.scheduledAt || 0).getTime();
        const bTime = new Date(b.nextAppointment?.scheduledAt || b.lastEncounter?.scheduledAt || 0).getTime();
        return bTime - aTime;
      });
  }, [doctor.bookings, patientReferenceTime, session.activeAppointment]);

  const filteredPatientProfiles = useMemo(() => {
    const query = patientSearch.trim().toLowerCase();

    return patientProfiles.filter((profile) => {
      const searchable = [
        profile.firstName,
        profile.lastName,
        profile.email,
        profile.phone,
        profile.gender || "",
        profile.appointments.map((appointment) => appointment.reason || "").join(" "),
      ].join(" ").toLowerCase();

      const matchesSearch = !query || searchable.includes(query);
      const matchesFilter =
        patientStatusFilter === "all" ||
        (patientStatusFilter === "active" && profile.confirmed.length > 0) ||
        (patientStatusFilter === "pending" && profile.pending.length > 0) ||
        (patientStatusFilter === "completed" && profile.completed.length > 0) ||
        (patientStatusFilter === "prescriptions" && profile.prescriptions.length > 0);

      return matchesSearch && matchesFilter;
    });
  }, [patientProfiles, patientSearch, patientStatusFilter]);

  const selectedPatient = useMemo(() => {
    return (
      patientProfiles.find((profile) => profile.id === selectedPatientId) ||
      filteredPatientProfiles[0] ||
      patientProfiles[0] ||
      null
    );
  }, [filteredPatientProfiles, patientProfiles, selectedPatientId]);

  const selectedConsultation = useMemo(() => {
    if (!selectedPatient) {
      return null;
    }

    return (
      selectedPatient.appointments.find((booking) => booking.id === selectedConsultationId) ||
      selectedPatient.activeAppointment ||
      selectedPatient.nextAppointment ||
      selectedPatient.lastEncounter ||
      selectedPatient.appointments[0] ||
      null
    );
  }, [selectedConsultationId, selectedPatient]);

  const notificationSeed = useMemo<DashboardNotification[]>(
    () => [
      ...pendingAppointments.slice(0, 4).map((booking) =>
        createDashboardNotification({
          id: `doctor-request-${booking.id}`,
          title: "New appointment request",
          body: `${booking.patient.firstName} ${booking.patient.lastName} / ${formatDateTime(booking.scheduledAt)}`,
          kind: "appointment",
          createdAt: booking.createdAt,
          readAt: null,
        })
      ),
      ...confirmedAppointments.slice(0, 2).map((booking) =>
        createDashboardNotification({
          id: `doctor-consultation-${booking.id}`,
          title: "Consultation reminder",
          body: `${booking.patient.firstName} ${booking.patient.lastName} is scheduled for ${formatDateTime(booking.scheduledAt)}`,
          kind: "consultation",
          createdAt: booking.createdAt,
          readAt: booking.createdAt,
        })
      ),
      ...prescriptions.slice(0, 2).map((booking) =>
        createDashboardNotification({
          id: `doctor-prescription-${booking.id}`,
          title: "Prescription issued",
          body: `${booking.patient.firstName} ${booking.patient.lastName} has an active prescription record.`,
          kind: "prescription",
          createdAt: booking.createdAt,
          readAt: booking.createdAt,
        })
      ),
    ],
    [confirmedAppointments, pendingAppointments, prescriptions]
  );
  const dashboardNotifications = useDashboardNotifications({
    role: "doctor",
    initialNotifications: notificationSeed,
    realtimeEvent: doctorScopedRealtimeEvent,
  });

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
      start.setDate(start.getDate() - start.getDay());
      end.setTime(start.getTime());
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
      title: "Follow-up confirmation requested",
      body: `Your doctor requested a follow-up for ${formatDateTime(scheduledAt)}. Please confirm or request a new time.`,
    });
    setScheduleState({ loading: false, error: "", success: "" });
    showToast("success", "Follow-up request sent for patient confirmation.");
    setFollowUpPatientId("");
    setFollowUpDate("");
    setFollowUpTime("");
    setFollowUpReason("");
    router.refresh();
  };

  const openFollowUpForPatient = (patientId: string, reason?: string | null) => {
    setFollowUpPatientId(patientId);
    setFollowUpReason(reason ? `Follow-up: ${reason}` : "");
    setActiveModule("schedule");
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
      showToast("error", result.error || "Could not start secure video session.");
      setSubmitState({ loading: false, error: "", success: "" });
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
      showToast("error", "Clinical notes and prescription are required.");
      setSubmitState({ loading: false, error: "", success: "" });
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
      showToast("error", result.error || "Could not complete consultation.");
      setSubmitState({ loading: false, error: "", success: "" });
      return;
    }

    realtime.publish({ type: "appointment:updated", appointmentId: session.activeAppointment.id, actorRole: "doctor" });
    showToast("success", "Consultation completed and patient portal updated.");
    setSubmitState({ loading: false, error: "", success: "" });
    if (session.roomId) {
      realtime.endVideoRoom(session.roomId);
    }
    session.endSession();
    router.refresh();
  };

  const handleEndSession = async () => {
    const roomId = session.roomId;
    if (session.activeAppointment) {
      await endVideoSession(session.activeAppointment.id);
    }
    if (roomId) {
      realtime.endVideoRoom(roomId);
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
      notificationBell={
        <NotificationBell
          role="doctor"
          notifications={dashboardNotifications.notifications}
          unreadCount={dashboardNotifications.unreadCount}
          onMarkAllRead={dashboardNotifications.markAllRead}
          onOpenNotifications={() => setActiveModule("notifications")}
        />
      }
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

      {session.activeAppointment && activeModule !== "live" && (session.status === "waiting" || session.status === "connected") && (
        <FloatingConsultationCall
          role="doctor"
          counterpartName={`${session.activeAppointment.patient.firstName} ${session.activeAppointment.patient.lastName}`}
          status={session.status}
          isCameraOn={session.isCameraOn}
          isMicOn={session.isMicOn}
          counterpartCameraOn={session.counterpartCameraOn}
          onToggleCamera={session.toggleCamera}
          onToggleMic={session.toggleMic}
          onEnd={handleEndSession}
          onOpen={() => setActiveModule("live")}
          localStream={webRTC.localStream}
          remoteStream={webRTC.remoteStream}
          connectionState={webRTC.connectionState}
          mediaError={webRTC.error || webRTC.deviceStatus.message}
        />
      )}

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
            devices={webRTC.devices}
            cameraDeviceId={webRTC.cameraDeviceId}
            microphoneDeviceId={webRTC.microphoneDeviceId}
            deviceStatus={webRTC.deviceStatus}
            onCameraDeviceChange={webRTC.setCameraDeviceId}
            onMicrophoneDeviceChange={webRTC.setMicrophoneDeviceId}
            onRefreshDevices={() => void webRTC.refreshDevices()}
            chat={<ChatPanel role="doctor" messages={session.messages} onSend={session.sendMessage} />}
            documentation={
              <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-teal">Clinical Documentation</p>
                <form onSubmit={handleComplete} className="mt-4 space-y-3">
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
        <PatientOperationsHub
          patients={filteredPatientProfiles}
          allPatientCount={patientProfiles.length}
          selectedPatient={selectedPatient}
          selectedConsultation={selectedConsultation}
          activeAppointment={session.activeAppointment}
          activeSessionStatus={session.status}
          patientSearch={patientSearch}
          statusFilter={patientStatusFilter}
          recordsTab={patientRecordsTab}
          actionLoadingId={actionLoadingId}
          messages={session.messages}
          onSearchChange={setPatientSearch}
          onStatusFilterChange={setPatientStatusFilter}
          onRecordsTabChange={setPatientRecordsTab}
          onSelectPatient={(patientId) => {
            setSelectedPatientId(patientId);
            setSelectedConsultationId("");
          }}
          onSelectConsultation={setSelectedConsultationId}
          onOpenFollowUp={openFollowUpForPatient}
          onAccept={handleAccept}
          onCancel={handleCancel}
          onStartLive={startLiveSession}
          onOpenLive={() => setActiveModule("live")}
          onSendMessage={session.sendMessage}
        />
      )}

      {activeModule === "schedule" && (
        <section className="grid min-h-[calc(100vh-9rem)] gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">
          <div className="space-y-4">
            <section className="rounded-xl border border-slate-850 bg-slate-900 p-5 text-white">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Main Stage</p>
                  <h2 className="mt-1 text-2xl font-black">Consultation Calendar</h2>
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
          {dashboardNotifications.notifications.length ? dashboardNotifications.notifications.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-850 bg-slate-900 p-4">
              <p className="text-sm font-black text-white">{item.title}</p>
              <p className="mt-1 text-xs font-semibold text-slate-400">{item.body}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-500">{item.kind || "system"} / {formatDateTime(item.createdAt)}</p>
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
