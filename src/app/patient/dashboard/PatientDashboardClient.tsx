"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { logoutPatient } from "@/app/actions/auth";
import { bookAppointment, confirmFollowUpAppointment, requestFollowUpReschedule } from "@/app/actions/patient";
import { authorizePatientVideoSession, endVideoSession } from "@/app/actions/video-session";
import { DashboardShell, type DashboardNavItem } from "@/components/dashboard/DashboardShell";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { PatientSettingsModule } from "@/components/dashboard/SettingsModule";
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
import { DEFAULT_DURATION_MINUTES, getScheduleConflict, parseAvailability } from "@/lib/scheduling";
import type {
  DashboardNotification,
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

type AppointmentFeedFilter = "all" | "pending" | "confirmed" | "completed" | "cancelled";
type MedicalAccessTab = "summary" | "assessment" | "prescriptions";

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

const APPOINTMENT_FILTERS: { id: AppointmentFeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

const MEDICAL_ACCESS_TABS: { id: MedicalAccessTab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "assessment", label: "Assessment" },
  { id: "prescriptions", label: "Prescriptions" },
];

function getAppointmentStatusStyle(status: string) {
  switch (status) {
    case "CONFIRMED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PENDING":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "COMPLETED":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "CANCELLED":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatAppointmentFeedDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatAppointmentFeedTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatPhilippinePeso(value?: number | null) {
  if (!value) {
    return "Not listed";
  }

  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value);
}

function getMedicalBullets(value?: string | null) {
  return (value || "")
    .split(/\n|\. /)
    .map((item) => item.replace(/\.$/, "").trim())
    .filter(Boolean);
}

function isDoctorFollowUp(appointment: PatientAppointment) {
  return appointment.reason?.toLowerCase().startsWith("follow-up") || appointment.notes?.includes("Follow-up requested by doctor");
}

function downloadMedicalReport(appointment: PatientAppointment) {
  const report = [
    "Healthko Medical Report",
    "",
    `Doctor: ${appointment.doctor.name}`,
    `Specialization: ${appointment.doctor.specialty}`,
    `Consultation Date: ${formatDateTime(appointment.scheduledAt)}`,
    `Status: ${appointment.status}`,
    "",
    "Chief Complaint",
    appointment.reason || "No chief complaint recorded.",
    "",
    "Doctor Assessment and Plan",
    appointment.notes || "No doctor assessment recorded.",
    "",
    "Prescription",
    appointment.prescription || "No prescription issued.",
  ].join("\n");
  const blob = new Blob([report], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `healthko-medical-report-${appointment.id}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

function startOfMonth(date: Date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getMiniCalendarDays(anchorDate: Date) {
  const monthStart = startOfMonth(anchorDate);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

function hasPatientScheduleConflict(appointments: PatientAppointment[], scheduledAt: Date) {
  const requestedStart = scheduledAt.getTime();
  const requestedEnd = requestedStart + DEFAULT_DURATION_MINUTES * 60 * 1000;

  return appointments.some((appointment) => {
    if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
      return false;
    }

    const appointmentStart = new Date(appointment.scheduledAt).getTime();
    const appointmentEnd = appointmentStart + (appointment.duration || DEFAULT_DURATION_MINUTES) * 60 * 1000;
    return requestedStart < appointmentEnd && requestedEnd > appointmentStart;
  });
}

function getSmartSchedulingSuggestions({
  doctor,
  appointments,
  referenceDate,
}: {
  doctor?: DashboardDoctor;
  appointments: PatientAppointment[];
  referenceDate: Date;
}) {
  const availability = parseAvailability(doctor?.availability);
  const suggestions: Date[] = [];
  const startHour = availability ? Math.ceil(availability.startMinutes / 60) : 9;
  const endHour = availability ? Math.floor((availability.endMinutes - DEFAULT_DURATION_MINUTES) / 60) : 16;
  const confirmedAppointments = appointments.filter((appointment) => appointment.status === "CONFIRMED");

  for (let dayOffset = 0; dayOffset < 21 && suggestions.length < 5; dayOffset += 1) {
    const day = new Date(referenceDate);
    day.setDate(referenceDate.getDate() + dayOffset);
    day.setMinutes(0, 0, 0);

    if (availability && !availability.days.includes(day.getDay())) {
      continue;
    }

    for (let hour = startHour; hour <= endHour && suggestions.length < 5; hour += 1) {
      const slot = new Date(day);
      slot.setHours(hour, 0, 0, 0);

      if (slot <= referenceDate) {
        continue;
      }

      if (hasPatientScheduleConflict(appointments, slot)) {
        continue;
      }

      if (getScheduleConflict(confirmedAppointments, slot, DEFAULT_DURATION_MINUTES)) {
        continue;
      }

      suggestions.push(slot);
    }
  }

  return suggestions;
}

function PatientQrCode({ value }: { value: string }) {
  const cells = Array.from({ length: 121 }, (_, index) => {
    const code = value.charCodeAt(index % Math.max(value.length, 1)) || 0;
    const row = Math.floor(index / 11);
    const col = index % 11;
    const finder =
      (row < 3 && col < 3) ||
      (row < 3 && col > 7) ||
      (row > 7 && col < 3);

    return finder || ((code + row * 7 + col * 13 + index) % 5 < 2);
  });

  return (
    <svg viewBox="0 0 132 132" role="img" aria-label="Patient quick access code" className="h-36 w-36 rounded-xl bg-white p-2">
      <title>{value}</title>
      <rect width="132" height="132" rx="10" fill="white" />
      {cells.map((filled, index) => {
        if (!filled) {
          return null;
        }

        const x = (index % 11) * 12 + 4;
        const y = Math.floor(index / 11) * 12 + 4;
        return <rect key={index} x={x} y={y} width="9" height="9" rx="2" fill="#0f766e" />;
      })}
    </svg>
  );
}

function PatientAppointmentMiniCalendar({
  anchorDate,
  selectedDate,
  appointments,
  onAnchorDateChange,
  onDateSelect,
}: {
  anchorDate: Date;
  selectedDate: string;
  appointments: PatientAppointment[];
  onAnchorDateChange: (date: Date) => void;
  onDateSelect: (date: string) => void;
}) {
  const days = getMiniCalendarDays(anchorDate);
  const appointmentCounts = appointments.reduce<Record<string, number>>((acc, appointment) => {
    const key = toDateKey(new Date(appointment.scheduledAt));
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const currentMonth = anchorDate.getMonth();
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(anchorDate);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Mini Calendar</p>
          <h3 className="text-base font-black text-slate-950">{monthLabel}</h3>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onAnchorDateChange(startOfMonth(addMonths(anchorDate, -1)))}
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600"
            aria-label="Previous month"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            onClick={() => onAnchorDateChange(startOfMonth(addMonths(anchorDate, 1)))}
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600"
            aria-label="Next month"
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase text-slate-400">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = toDateKey(day);
          const count = appointmentCounts[key] || 0;
          const selected = key === selectedDate;
          const muted = day.getMonth() !== currentMonth;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onDateSelect(key)}
              className={`min-h-12 rounded-lg border p-1 text-left transition ${
                selected
                  ? "border-brand-teal bg-brand-teal text-white"
                  : muted
                    ? "border-slate-100 bg-slate-50 text-slate-300"
                    : "border-slate-200 bg-white text-slate-700 hover:border-brand-teal/50"
              }`}
            >
              <span className="text-xs font-black">{day.getDate()}</span>
              {count ? (
                <span className={`mt-1 block h-1.5 w-1.5 rounded-full ${selected ? "bg-white" : "bg-brand-red"}`} />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function DoctorProfileModal({
  doctor,
  onClose,
}: {
  doctor: DashboardDoctor;
  onClose: () => void;
}) {
  const initials = doctor.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur" role="dialog" aria-modal="true" aria-labelledby="doctor-profile-title">
      <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div className="flex min-w-0 items-center gap-4">
            {doctor.image ? (
              <Image src={doctor.image} alt={doctor.name} width={64} height={64} unoptimized className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-brand-teal/10 text-lg font-black text-brand-teal">
                {initials || "DR"}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Doctor Profile</p>
              <h2 id="doctor-profile-title" className="mt-1 text-2xl font-black text-slate-950">{doctor.name}</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">{doctor.specialty}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600">
            Close
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-3">
          {[
            { label: "Verification", value: doctor.isVerified ? "Verified" : "Pending verification" },
            { label: "License", value: doctor.licenseNumber ? `${doctor.licenseNumber}${doctor.licenseState ? ` / ${doctor.licenseState}` : ""}` : "Not provided" },
            { label: "Experience", value: doctor.yearsExp ? `${doctor.yearsExp} years` : "Not provided" },
            { label: "Availability", value: doctor.availability || "Available by appointment" },
            { label: "NPI", value: doctor.npi || "Not provided" },
            { label: "Consult Fee", value: formatPhilippinePeso(doctor.consultFee) },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
              <p className="mt-1 text-sm font-black text-slate-800">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-200 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Professional Biography</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">
            {doctor.bio || "This doctor has not added a professional biography yet."}
          </p>
        </div>
      </section>
    </div>
  );
}

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
  const [joiningAppointmentId, setJoiningAppointmentId] = useState("");
  const [dismissedStartedId, setDismissedStartedId] = useState("");
  const [blockedAppointment, setBlockedAppointment] = useState<PatientAppointment | null>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentFeedFilter>("all");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [profileDoctor, setProfileDoctor] = useState<DashboardDoctor | null>(null);
  const [selectedMedicalAppointmentId, setSelectedMedicalAppointmentId] = useState("");
  const [medicalAccessTab, setMedicalAccessTab] = useState<MedicalAccessTab>("summary");
  const [followUpActionId, setFollowUpActionId] = useState("");
  const [rescheduleAppointment, setRescheduleAppointment] = useState<PatientAppointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [appointmentCalendarAnchor, setAppointmentCalendarAnchor] = useState(() => startOfMonth(new Date()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState("");
  const [appointmentReferenceTime] = useState(() => new Date());
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
        event.type === "appointment:created" ||
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
      }

      if (event.type === "session:ended") {
        setStartedAppointmentId((current) => current === event.appointmentId ? "" : current);
        setJoiningAppointmentId((current) => current === event.appointmentId ? "" : current);
        setDismissedStartedId((current) => current === event.appointmentId ? "" : current);
        setBlockedAppointment((current) => current?.id === event.appointmentId ? null : current);
        setAuthorizedRooms((current) => {
          if (!current[event.appointmentId]) {
            return current;
          }

          const next = { ...current };
          delete next[event.appointmentId];
          return next;
        });
      }
      router.refresh();
    }
  }, [dismissedStartedId, router]);

  const realtime = useDashboardRealtime(onRealtimeEvent);
  const session = useConsultationSession<PatientAppointment>({
    role: "patient",
    publish: realtime.publish,
    persistKey: `healthko:patient:${patient.id}:active-consultation`,
  });
  const webRTC = useWebRTC({
    roomId: session.roomId,
    role: "patient",
    getSocket: realtime.getSocket,
    isCameraOn: session.isCameraOn,
    isMicOn: session.isMicOn,
    isActive: Boolean(session.roomId && session.status === "connected"),
    signalingReady: realtime.socketReady,
    onRemoteSessionEnded: () => {
      session.endSession(false);
      setStartedAppointmentId("");
      setJoiningAppointmentId("");
      setBlockedAppointment(null);
      setActiveModule("overview");
    },
  });
  const receiveRealtimeEvent = session.receiveRealtimeEvent;

  useEffect(() => {
    receiveRealtimeEvent(realtime.lastEvent);
  }, [realtime.lastEvent, receiveRealtimeEvent]);

  const appointments = useMemo(
    () => [...patient.bookings].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [patient.bookings]
  );
  const upcomingAppointments = useMemo(
    () => appointments.filter((booking) => new Date(booking.scheduledAt) >= appointmentReferenceTime && booking.status !== "CANCELLED"),
    [appointmentReferenceTime, appointments]
  );
  const confirmedAppointments = useMemo(
    () => upcomingAppointments.filter((booking) => booking.status === "CONFIRMED"),
    [upcomingAppointments]
  );
  const historicalAppointments = useMemo(
    () =>
      [...appointments]
        .filter((booking) => booking.status === "COMPLETED" || booking.status === "CANCELLED" || new Date(booking.scheduledAt) < appointmentReferenceTime)
        .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [appointmentReferenceTime, appointments]
  );
  const prescriptions = useMemo(
    () => appointments.filter((booking) => booking.prescription),
    [appointments]
  );
  const appointmentFeed = useMemo(() => {
    const filtered = appointmentFilter === "all"
      ? appointments
      : appointments.filter((booking) => booking.status.toLowerCase() === appointmentFilter);
    const dateFiltered = selectedCalendarDate
      ? filtered.filter((booking) => toDateKey(new Date(booking.scheduledAt)) === selectedCalendarDate)
      : filtered;

    return [...dateFiltered].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [appointmentFilter, appointments, selectedCalendarDate]);
  const selectedAppointment = useMemo(() => {
    return (
      appointments.find((booking) => booking.id === selectedAppointmentId) ||
      appointmentFeed[0] ||
      upcomingAppointments[0] ||
      appointments[0] ||
      null
    );
  }, [appointmentFeed, appointments, selectedAppointmentId, upcomingAppointments]);
  const medicalAccessAppointments = useMemo(
    () => historicalAppointments.length ? historicalAppointments : [...appointments].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [appointments, historicalAppointments]
  );
  const selectedMedicalAppointment = useMemo(
    () =>
      medicalAccessAppointments.find((booking) => booking.id === selectedMedicalAppointmentId) ||
      medicalAccessAppointments[0] ||
      null,
    [medicalAccessAppointments, selectedMedicalAppointmentId]
  );
  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => doctor.id === selectedDoctorId),
    [doctors, selectedDoctorId]
  );
  const schedulingSuggestions = useMemo(
    () => getSmartSchedulingSuggestions({
      doctor: selectedDoctor,
      appointments,
      referenceDate: appointmentReferenceTime,
    }),
    [appointmentReferenceTime, appointments, selectedDoctor]
  );
  const requestedDateTime = appointmentDate && appointmentTime ? new Date(`${appointmentDate}T${appointmentTime}:00`) : null;
  const patientConflict = requestedDateTime && !Number.isNaN(requestedDateTime.getTime())
    ? hasPatientScheduleConflict(appointments, requestedDateTime)
    : false;
  const notificationSeed = useMemo<DashboardNotification[]>(
    () => [
      ...upcomingAppointments.slice(0, 3).map((booking) =>
        createDashboardNotification({
          id: `patient-appointment-${booking.id}`,
          title: `${booking.status.toLowerCase()} appointment`,
          body: `${booking.doctor.name} / ${formatDateTime(booking.scheduledAt)}`,
          kind: booking.status === "CONFIRMED" ? "consultation" : "appointment",
          createdAt: booking.createdAt,
          readAt: booking.status === "PENDING" ? null : booking.createdAt,
        })
      ),
      ...prescriptions.slice(0, 2).map((booking) =>
        createDashboardNotification({
          id: `patient-prescription-${booking.id}`,
          title: "Prescription available",
          body: `${booking.prescription} from ${booking.doctor.name}`,
          kind: "prescription",
          createdAt: booking.createdAt,
          readAt: null,
        })
      ),
    ],
    [prescriptions, upcomingAppointments]
  );
  const dashboardNotifications = useDashboardNotifications({
    role: "patient",
    initialNotifications: notificationSeed,
    realtimeEvent: realtime.lastEvent,
  });

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

    if (patientConflict) {
      setBookingState({ loading: false, error: "You already have an appointment in this time window. Choose another slot.", success: "" });
      return;
    }

    setBookingState({ loading: true, error: "", success: "" });
    const result = await bookAppointment({
      doctorId: selectedDoctorId,
      scheduledAt: `${appointmentDate}T${appointmentTime}:00`,
      reason,
    });

    if (!result.success) {
      const errorMessage = "error" in result ? result.error : "";
      setBookingState({ loading: false, error: errorMessage || "Could not book appointment.", success: "" });
      return;
    }

    realtime.publish({
      type: "appointment:created",
      appointmentId: result.consultation?.id || "pending",
      actorRole: "patient",
      targetDoctorId: result.consultation?.doctorId || selectedDoctorId,
      scheduledAt: `${appointmentDate}T${appointmentTime}:00`,
      title: "New appointment request",
      body: "A patient submitted a consultation request for review.",
    });
    setBookingState({ loading: false, error: "", success: "Appointment request sent to the doctor." });
    setAppointmentDate("");
    setAppointmentTime("");
    setReason("");
    setIsBookingOpen(false);
    setActiveModule("book");
    router.refresh();
  };

  const joinAuthorizedSession = async (targetAppointment?: PatientAppointment) => {
    const appointment = targetAppointment || session.activeAppointment;

    if (!appointment) {
      return;
    }

    setJoiningAppointmentId(appointment.id);

    const result = await authorizePatientVideoSession(appointment.id);
    if (!result.success || !result.roomId || !result.accessToken) {
      setJoiningAppointmentId("");
      setBlockedAppointment(appointment);
      setActiveModule("live");
      return;
    }

    setStartedAppointmentId("");
    setDismissedStartedId(appointment.id);
    setJoiningAppointmentId("");
    setBlockedAppointment(null);
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

  const handleConfirmFollowUp = async (appointment: PatientAppointment) => {
    setFollowUpActionId(appointment.id);
    const result = await confirmFollowUpAppointment(appointment.id);
    setFollowUpActionId("");

    if (!result.success) {
      const errorMessage = "error" in result ? result.error : "";
      setBookingState({ loading: false, error: errorMessage || "Could not confirm follow-up appointment.", success: "" });
      return;
    }

    realtime.publish({
      type: "appointment:updated",
      appointmentId: appointment.id,
      actorRole: "patient",
      targetDoctorId: result.consultation?.doctorId || appointment.doctor.id,
      title: "Follow-up confirmed",
      body: "The patient confirmed the follow-up appointment.",
    });
    setBookingState({ loading: false, error: "", success: "Follow-up appointment confirmed." });
    router.refresh();
  };

  const openFollowUpReschedule = (appointment: PatientAppointment) => {
    const currentDate = new Date(appointment.scheduledAt);
    const nextDate = Number.isNaN(currentDate.getTime()) ? new Date() : currentDate;

    setRescheduleAppointment(appointment);
    setRescheduleDate(toDateKey(nextDate));
    setRescheduleTime(toTimeValue(nextDate));
    setBookingState({ loading: false, error: "", success: "" });
  };

  const handleRequestFollowUpReschedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rescheduleAppointment || !rescheduleDate || !rescheduleTime) {
      setBookingState({ loading: false, error: "Choose your requested follow-up date and time.", success: "" });
      return;
    }

    const requestedDate = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
    if (Number.isNaN(requestedDate.getTime()) || requestedDate <= appointmentReferenceTime) {
      setBookingState({ loading: false, error: "Choose a valid future date and time.", success: "" });
      return;
    }

    const appointment = rescheduleAppointment;
    setFollowUpActionId(appointment.id);
    const result = await requestFollowUpReschedule({
      consultationId: appointment.id,
      requestedScheduledAt: requestedDate.toISOString(),
    });
    setFollowUpActionId("");

    if (!result.success) {
      const errorMessage = "error" in result ? result.error : "";
      setBookingState({ loading: false, error: errorMessage || "Could not request follow-up rescheduling.", success: "" });
      return;
    }

    realtime.publish({
      type: "appointment:rescheduled",
      appointmentId: appointment.id,
      actorRole: "patient",
      targetDoctorId: result.consultation?.doctorId || appointment.doctor.id,
      scheduledAt: requestedDate.toISOString(),
      title: "Reschedule requested",
      body: `The patient requested ${formatDateTime(requestedDate)} for the follow-up consultation.`,
    });
    setBookingState({ loading: false, error: "", success: "Reschedule request sent to the doctor." });
    setRescheduleAppointment(null);
    setRescheduleDate("");
    setRescheduleTime("");
    router.refresh();
  };

  const startLiveSession = (appointment: PatientAppointment) => {
    if (authorizedRooms[appointment.id]) {
      void joinAuthorizedSession(appointment);
      return;
    }

    setBlockedAppointment(appointment);
    setActiveModule("live");
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
    setStartedAppointmentId("");
    setJoiningAppointmentId("");
    setBlockedAppointment(null);
    setActiveModule("overview");
    router.refresh();
  };

  const tone = "light" as const;
  const startedAppointment = startedAppointmentId
    ? appointments.find((booking) => booking.id === startedAppointmentId)
    : undefined;
  const completedAppointments = appointments.filter((booking) => booking.status === "COMPLETED");
  const recentDoctorNames = Array.from(new Set(appointments.map((booking) => booking.doctor.name))).slice(0, 4);
  const patientAddress = [patient.address, patient.city, patient.state, patient.zipCode, patient.country].filter(Boolean).join(", ");
  const qrPayload = JSON.stringify({
    id: patient.id,
    name: `${patient.firstName} ${patient.lastName}`,
    dob: patient.dob,
    phone: patient.phone,
    email: patient.email,
    recentDoctors: recentDoctorNames,
  });

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
      notificationBell={
        <NotificationBell
          role="patient"
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
        <form action={logoutPatient}>
          <button type="submit" className="w-full rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-white">
            Sign Out
          </button>
        </form>
      )}
    >
      {profileDoctor && <DoctorProfileModal doctor={profileDoctor} onClose={() => setProfileDoctor(null)} />}

      {rescheduleAppointment && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <section className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-teal">Follow-Up Reschedule</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Request a new consultation time</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Your doctor will receive this proposed date and time for review.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleAppointment(null)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                aria-label="Close reschedule modal"
              >
                <span aria-hidden="true">X</span>
              </button>
            </div>
            <form onSubmit={handleRequestFollowUpReschedule} className="mt-5 grid gap-4 md:grid-cols-2">
              {bookingState.error && (
                <div className="rounded-lg border border-brand-red/20 bg-brand-red/10 p-3 text-xs font-bold text-brand-red md:col-span-2">
                  {bookingState.error}
                </div>
              )}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                <p className="text-xs font-black text-slate-950">{rescheduleAppointment.doctor.name}</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  Current follow-up: {formatDateTime(rescheduleAppointment.scheduledAt)}
                </p>
              </div>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                Requested Date
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(event) => setRescheduleDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold normal-case text-slate-900"
                />
              </label>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
                Requested Time
                <input
                  type="time"
                  value={rescheduleTime}
                  onChange={(event) => setRescheduleTime(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold normal-case text-slate-900"
                />
              </label>
              <div className="flex flex-col-reverse gap-2 md:col-span-2 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={() => setRescheduleAppointment(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={followUpActionId === rescheduleAppointment.id}
                  className="rounded-lg bg-brand-teal px-4 py-2.5 text-xs font-black text-white disabled:bg-slate-300"
                >
                  {followUpActionId === rescheduleAppointment.id ? "Sending..." : "Send Request"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {blockedAppointment && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-xl border border-brand-red/20 bg-white p-7 text-center shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-red">Room not available</p>
            <h2 className="mt-3 font-display text-2xl font-black text-slate-950">The doctor has not started this consultation yet</h2>
            <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-relaxed text-slate-500">
              For your privacy and security, only the doctor can create and start the live consultation room. Please wait for the doctor to begin the session, then use the join notification when it appears.
            </p>
            <button
              type="button"
              onClick={() => setBlockedAppointment(null)}
              className="mt-6 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {session.activeAppointment && activeModule !== "live" && session.status === "connected" && (
        <FloatingConsultationCall
          role="patient"
          counterpartName={session.activeAppointment.doctor.name}
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
              disabled={!startedAppointment || joiningAppointmentId === startedAppointment.id}
              onClick={() => {
                if (startedAppointment) {
                  void joinAuthorizedSession(startedAppointment);
                }
              }}
              className="mt-6 rounded-lg bg-brand-teal px-6 py-3 text-sm font-black text-white disabled:bg-slate-300"
            >
              {joiningAppointmentId === startedAppointment?.id ? "Joining..." : startedAppointment ? "Join Consultation" : "Syncing room..."}
            </button>
          </div>
        </div>
      )}

      {isBookingOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur" role="dialog" aria-modal="true">
          <section className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-teal">Appointments</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Book Appointment</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Your request goes to the selected doctor queue and updates both dashboards.</p>
              </div>
              <button type="button" onClick={() => setIsBookingOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Close booking modal">
                <span aria-hidden="true">X</span>
              </button>
            </div>
            <form onSubmit={handleBookAppointment} className="mt-5 grid gap-4 md:grid-cols-2">
              {bookingState.error && <div className="rounded-lg border border-brand-red/20 bg-brand-red/10 p-3 text-xs font-bold text-brand-red md:col-span-2">{bookingState.error}</div>}
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500 md:col-span-2">
                Doctor
                <select value={selectedDoctorId} onChange={(event) => setSelectedDoctorId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold normal-case text-slate-900">
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} - {doctor.specialty}
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
              {patientConflict && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-700 md:col-span-2">
                  This time overlaps with one of your active consultations. Pick a suggested slot or choose another time.
                </div>
              )}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Suggested slots</p>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {schedulingSuggestions.length ? schedulingSuggestions.map((slot) => (
                    <button
                      key={slot.toISOString()}
                      type="button"
                      onClick={() => {
                        setAppointmentDate(toDateKey(slot));
                        setAppointmentTime(toTimeValue(slot));
                      }}
                      className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 hover:border-brand-teal"
                    >
                      {formatDateTime(slot)}
                    </button>
                  )) : (
                    <span className="text-xs font-semibold text-slate-500">No suggestions available for this doctor yet.</span>
                  )}
                </div>
              </div>
              <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500 md:col-span-2">
                Visit reason
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold normal-case text-slate-900" />
              </label>
              <button type="submit" disabled={bookingState.loading} className="rounded-lg bg-brand-teal px-4 py-3 text-sm font-black text-white disabled:bg-slate-300 md:col-span-2">
                {bookingState.loading ? "Sending request..." : "Send Appointment Request"}
              </button>
            </form>
          </section>
        </div>
      )}

      {activeModule === "overview" && (
        <div className="space-y-6">
          <StatGrid
            stats={[
              { label: "Upcoming Consultations", value: upcomingAppointments.length, helper: "scheduled and requested visits" },
              { label: "Recent Doctors", value: recentDoctorNames.length, helper: "clinicians connected to your care" },
              { label: "Completed", value: completedAppointments.length, helper: "closed consultations" },
              { label: "Pending Rx", value: prescriptions.length, helper: "prescription records available" },
            ]}
          />
          <div className="grid gap-5 xl:grid-cols-12">
            <section className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-7">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Patient Information</p>
              <h2 className="mt-2 text-lg font-black text-slate-950">{patient.firstName} {patient.lastName}</h2>
              <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div><dt className="text-xs font-black uppercase text-slate-400">Email</dt><dd className="font-semibold text-slate-800">{patient.email}</dd></div>
                <div><dt className="text-xs font-black uppercase text-slate-400">Phone</dt><dd className="font-semibold text-slate-800">{patient.countryCode || ""} {patient.phone}</dd></div>
                <div><dt className="text-xs font-black uppercase text-slate-400">Date of birth</dt><dd className="font-semibold text-slate-800">{patient.dob}</dd></div>
                <div><dt className="text-xs font-black uppercase text-slate-400">Gender</dt><dd className="font-semibold text-slate-800">{patient.gender || "Not specified"}</dd></div>
                <div className="md:col-span-2"><dt className="text-xs font-black uppercase text-slate-400">Address</dt><dd className="font-semibold text-slate-800">{patientAddress || "No address on file"}</dd></div>
              </dl>
            </section>
            <section className="rounded-xl border border-brand-teal/20 bg-brand-teal/5 p-5 xl:col-span-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Patient QR</p>
              <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
                <PatientQrCode value={qrPayload} />
                <div>
                  <p className="text-sm font-black text-slate-950">Quick identity reference</p>
                  <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600">
                    Encodes patient ID, name, DOB, contact, and recent care team references for fast verification.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeModule === "book" && (
        <section className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Appointments</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Consultation Timeline</h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-500">
                  Track requests, doctor approvals, live-room readiness, prescriptions, and follow-up care without leaving the telehealth workflow.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModule("doctors")}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-700"
                >
                  Doctor Directory
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBookingState({ loading: false, error: "", success: "" });
                    setIsBookingOpen(true);
                  }}
                  className="rounded-lg bg-brand-teal px-4 py-2.5 text-xs font-black text-white"
                >
                  Book Appointment
                </button>
              </div>
            </div>
            {bookingState.success && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
                {bookingState.success}
              </div>
            )}
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {[
                { label: "Pending", value: appointments.filter((item) => item.status === "PENDING").length },
                { label: "Confirmed", value: confirmedAppointments.length },
                { label: "Completed", value: completedAppointments.length },
                { label: "Prescriptions", value: prescriptions.length },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-2xl font-black text-slate-950">{stat.value}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="rounded-xl border border-slate-200 bg-white">
              <header className="border-b border-slate-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Chronological Feed</p>
                    <h3 className="text-base font-black text-slate-950">
                      {selectedCalendarDate ? `Selected Date: ${selectedCalendarDate}` : "All Appointment States"}
                    </h3>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {APPOINTMENT_FILTERS.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setAppointmentFilter(filter.id)}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase ${
                          appointmentFilter === filter.id ? "bg-brand-teal text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                    {selectedCalendarDate && (
                      <button
                        type="button"
                        onClick={() => setSelectedCalendarDate("")}
                        className="shrink-0 rounded-full bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase text-white"
                      >
                        Clear Date
                      </button>
                    )}
                  </div>
                </div>
              </header>
              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="max-h-[720px] space-y-3 overflow-y-auto p-4">
                  {appointmentFeed.length ? appointmentFeed.map((booking) => {
                    const isSelected = selectedAppointment?.id === booking.id;
                    const roomReady = Boolean(authorizedRooms[booking.id] || startedAppointmentId === booking.id);

                    return (
                      <button
                        key={booking.id}
                        type="button"
                        onClick={() => setSelectedAppointmentId(booking.id)}
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          isSelected ? "border-brand-teal bg-brand-teal/5 shadow-[0_0_0_1px_rgba(20,184,166,0.2)]" : "border-slate-200 bg-white hover:border-brand-teal/40"
                        }`}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-black text-slate-950">{booking.doctor.name}</p>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${getAppointmentStatusStyle(booking.status)}`}>
                                {booking.status}
                              </span>
                              {roomReady && <span className="rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-black uppercase text-white">Room ready</span>}
                            </div>
                            <p className="mt-1 text-xs font-bold text-brand-teal">{booking.doctor.specialty}</p>
                          </div>
                          <time
                            dateTime={new Date(booking.scheduledAt).toISOString()}
                            className="shrink-0 text-right text-xs font-black text-slate-700"
                          >
                            <span className="block">{formatAppointmentFeedDate(booking.scheduledAt)}</span>
                            <span className="mt-0.5 block text-slate-500">{formatAppointmentFeedTime(booking.scheduledAt)}</span>
                          </time>
                        </div>
                      </button>
                    );
                  }) : (
                    <EmptyState title="No appointments match this view" body="Change filters or book a new consultation request." />
                  )}
                </div>

                <aside className="border-t border-slate-200 bg-slate-50 p-4 lg:border-l lg:border-t-0">
                  {selectedAppointment ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Selected Consultation</p>
                        <h3 className="mt-1 text-lg font-black text-slate-950">{selectedAppointment.doctor.name}</h3>
                        <p className="mt-1 text-xs font-bold text-slate-500">{formatDateTime(selectedAppointment.scheduledAt)}</p>
                      </div>
                      <div className={`rounded-xl border p-3 text-xs font-bold ${getAppointmentStatusStyle(selectedAppointment.status)}`}>
                        {selectedAppointment.status === "PENDING" && "Waiting for doctor approval. You will be notified when this consultation is confirmed."}
                        {selectedAppointment.status === "CONFIRMED" && "Confirmed. The doctor must start the secure room before you can join."}
                        {selectedAppointment.status === "COMPLETED" && "Completed. Clinical notes and prescriptions are available from Medical Access."}
                        {selectedAppointment.status === "CANCELLED" && "Cancelled. You can book another appointment from the doctor directory."}
                      </div>
                      <dl className="space-y-3 text-sm">
                        <div>
                          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Visit reason</dt>
                          <dd className="mt-1 font-semibold text-slate-700">{selectedAppointment.reason || "No reason provided"}</dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-400">Care continuity</dt>
                          <dd className="mt-1 font-semibold text-slate-700">{selectedAppointment.prescription ? `Prescription: ${selectedAppointment.prescription}` : selectedAppointment.notes || "No notes yet"}</dd>
                        </div>
                      </dl>
                      {selectedAppointment.status === "PENDING" && isDoctorFollowUp(selectedAppointment) && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs font-black text-amber-800">Doctor follow-up needs your response.</p>
                          <div className="mt-3 flex flex-col gap-2">
                            <button
                              type="button"
                              disabled={followUpActionId === selectedAppointment.id}
                              onClick={() => void handleConfirmFollowUp(selectedAppointment)}
                              className="rounded-lg bg-brand-teal px-4 py-2.5 text-xs font-black text-white disabled:bg-slate-300"
                            >
                              Confirm Follow-Up
                            </button>
                            <button
                              type="button"
                              disabled={followUpActionId === selectedAppointment.id}
                              onClick={() => openFollowUpReschedule(selectedAppointment)}
                              className="rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-xs font-black text-amber-800 disabled:text-slate-400"
                            >
                              Request Reschedule
                            </button>
                          </div>
                        </div>
                      )}
                      {selectedAppointment.status === "CONFIRMED" && (
                        <button
                          type="button"
                          onClick={() => startLiveSession(selectedAppointment)}
                          className="w-full rounded-lg bg-brand-red px-4 py-3 text-xs font-black text-white"
                        >
                          {authorizedRooms[selectedAppointment.id] ? "Join Consultation" : "Check Live Room"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <EmptyState title="No appointment selected" body="Choose an appointment to see its workflow status." />
                  )}
                </aside>
              </div>
            </section>

            <aside className="space-y-4">
              <PatientAppointmentMiniCalendar
                anchorDate={appointmentCalendarAnchor}
                selectedDate={selectedCalendarDate}
                appointments={appointments}
                onAnchorDateChange={setAppointmentCalendarAnchor}
                onDateSelect={setSelectedCalendarDate}
              />

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Smart Scheduling</p>
                <h3 className="mt-1 text-base font-black text-slate-950">{selectedDoctor?.name || "Choose a doctor"}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Suggestions use doctor availability and your current appointment windows before the server performs final conflict checks.
                </p>
                <div className="mt-4 space-y-2">
                  {schedulingSuggestions.length ? schedulingSuggestions.map((slot) => (
                    <button
                      key={slot.toISOString()}
                      type="button"
                      onClick={() => {
                        setAppointmentDate(toDateKey(slot));
                        setAppointmentTime(toTimeValue(slot));
                        setIsBookingOpen(true);
                      }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-bold text-slate-700 hover:border-brand-teal"
                    >
                      <span>{formatDateTime(slot)}</span>
                      <span className="text-brand-teal">Use</span>
                    </button>
                  )) : (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-500">
                      No low-conflict suggestions found. Choose a doctor or open booking to pick a custom time.
                    </p>
                  )}
                </div>
              </section>
            </aside>
          </div>
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
            chat={<ChatPanel role="patient" messages={session.messages} onSend={session.sendMessage} />}
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
                  actions={<button type="button" onClick={() => startLiveSession(booking)} className="rounded-lg bg-brand-red px-3 py-2 text-xs font-black text-white">Join Consultation</button>}
                />
              ))
            ) : (
              <EmptyState title="No confirmed live room" body="A doctor must accept your appointment before a room appears here." />
            )}
          </section>
        )
      )}

      {activeModule === "history" && (
        <section className="grid min-h-[calc(100vh-9rem)] gap-5 xl:grid-cols-[35fr_65fr]">
          <aside className="min-h-0 rounded-xl border border-slate-200 bg-white">
            <header className="border-b border-slate-200 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Medical Access</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">Consultation Timeline</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">Select an encounter to review clinical documentation.</p>
            </header>
            <div className="max-h-[calc(100vh-15rem)] space-y-2 overflow-y-auto p-3">
              {medicalAccessAppointments.length ? medicalAccessAppointments.map((booking) => {
                const selected = selectedMedicalAppointment?.id === booking.id;

                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => {
                      setSelectedMedicalAppointmentId(booking.id);
                      setMedicalAccessTab("summary");
                    }}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selected ? "border-brand-teal bg-brand-teal/5" : "border-slate-200 bg-white hover:border-brand-teal/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">{booking.doctor.name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{formatAppointmentFeedDate(booking.scheduledAt)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${getAppointmentStatusStyle(booking.status)}`}>
                        {booking.status}
                      </span>
                    </div>
                  </button>
                );
              }) : (
                <EmptyState title="No medical records yet" body="Completed consultations and doctor documentation appear here." />
              )}
            </div>
          </aside>

          <section className="min-w-0 rounded-xl border border-slate-200 bg-white">
            {selectedMedicalAppointment ? (
              <div className="flex h-full flex-col">
                <header className="border-b border-slate-200 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Encounter Detail</p>
                      <h2 className="mt-1 text-2xl font-black text-slate-950">{selectedMedicalAppointment.doctor.name}</h2>
                      <p className="mt-1 text-sm font-bold text-slate-500">{selectedMedicalAppointment.doctor.specialty}</p>
                      <p className="mt-2 text-xs font-semibold text-slate-500">{formatDateTime(selectedMedicalAppointment.scheduledAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadMedicalReport(selectedMedicalAppointment)}
                      className="rounded-lg bg-slate-950 px-4 py-3 text-xs font-black text-white"
                    >
                      Download PDF Report
                    </button>
                  </div>
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                    {MEDICAL_ACCESS_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setMedicalAccessTab(tab.id)}
                        className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase ${
                          medicalAccessTab === tab.id ? "bg-brand-teal text-white" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </header>

                <div className="flex-1 space-y-5 overflow-y-auto p-5">
                  {medicalAccessTab === "summary" && (
                    <section className="grid gap-3 md:grid-cols-4">
                      {[
                        { label: "Chief Complaint", value: selectedMedicalAppointment.reason || "No chief complaint recorded." },
                        { label: "Vitals", value: "Not recorded in this encounter." },
                        { label: "Duration", value: `${selectedMedicalAppointment.duration || DEFAULT_DURATION_MINUTES} minutes` },
                        { label: "Status", value: selectedMedicalAppointment.status },
                      ].map((item) => (
                        <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
                          <p className="mt-2 text-sm font-black leading-relaxed text-slate-800">{item.value}</p>
                        </div>
                      ))}
                    </section>
                  )}

                  {medicalAccessTab === "assessment" && (
                    <section className="space-y-4">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Doctor Assessment And Plan</p>
                        <ul className="mt-4 space-y-3">
                          {(getMedicalBullets(selectedMedicalAppointment.notes).length ? getMedicalBullets(selectedMedicalAppointment.notes) : ["No doctor assessment has been documented for this encounter."]).map((item) => (
                            <li key={item} className="flex gap-3 rounded-lg bg-white p-3 text-sm font-bold text-slate-800">
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-teal" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-red">Emergency Precautions</p>
                        <p className="mt-2 text-sm font-bold leading-relaxed text-red-800">
                          Seek urgent medical care for severe symptoms, breathing difficulty, chest pain, sudden weakness, allergic reactions, or rapidly worsening condition.
                        </p>
                      </div>
                    </section>
                  )}

                  {medicalAccessTab === "prescriptions" && (
                    <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Prescriptions</p>
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-base font-black text-slate-950">{selectedMedicalAppointment.prescription || "No prescription issued"}</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Directions</p>
                            <p className="mt-2 text-sm font-semibold text-slate-700">
                              {selectedMedicalAppointment.prescription ? "Follow the prescribing doctor's instructions and confirm dosage before taking medication." : "No medication directions available."}
                            </p>
                          </div>
                          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-brand-red">Warnings</p>
                            <p className="mt-2 text-sm font-semibold text-red-800">
                              Report allergies, side effects, pregnancy, or medication conflicts to your care team before use.
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState title="No encounter selected" body="Choose a consultation record from the timeline." />
              </div>
            )}
          </section>
        </section>
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
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">{doctor.name}</p>
                  <p className="mt-1 text-xs font-bold text-brand-teal">{doctor.specialty}</p>
                </div>
                {doctor.isVerified && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">
                    Verified
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">{doctor.availability}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => setProfileDoctor(doctor)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700">
                  View Profile
                </button>
                <button type="button" onClick={() => { setSelectedDoctorId(doctor.id); setActiveModule("book"); setIsBookingOpen(true); }} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white">
                  Book with Doctor
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {activeModule === "messages" && <ChatPanel role="patient" messages={session.messages} onSend={session.sendMessage} tone={tone} />}

      {activeModule === "notifications" && (
        <section className="space-y-3">
          {dashboardNotifications.notifications.length ? dashboardNotifications.notifications.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-black text-slate-950">{item.title}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{item.body}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">{item.kind || "system"} / {formatDateTime(item.createdAt)}</p>
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
