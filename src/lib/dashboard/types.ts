export type DashboardRole = "patient" | "doctor";

export type PatientModuleId =
  | "overview"
  | "book"
  | "live"
  | "history"
  | "prescriptions"
  | "doctors"
  | "messages"
  | "notifications"
  | "billing"
  | "settings";

export type DoctorModuleId =
  | "overview"
  | "live"
  | "patients"
  | "schedule"
  | "notes"
  | "prescriptions"
  | "messages"
  | "notifications"
  | "analytics"
  | "settings";

export type ModuleId = PatientModuleId | DoctorModuleId;

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | string;

export type DashboardDoctor = {
  id: string;
  name: string;
  email?: string;
  npi?: string;
  specialty: string;
  availability: string;
  consultFee?: number | null;
  rating?: number;
  reviewCount?: number;
  isVerified?: boolean;
  bio?: string | null;
  image?: string | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
  yearsExp?: number | null;
};

export type DashboardPatient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode?: string;
  dob: string;
  gender: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  emailVerified: boolean;
};

export type PatientAppointment = {
  id: string;
  scheduledAt: Date | string;
  status: AppointmentStatus;
  reason: string | null;
  duration: number | null;
  prescription: string | null;
  notes?: string | null;
  createdAt: Date | string;
  doctor: {
    name: string;
    specialty: string;
  };
};

export type DoctorAppointment = {
  id: string;
  scheduledAt: Date | string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  prescription: string | null;
  duration: number | null;
  createdAt: Date | string;
  patient: DashboardPatient;
};

export type RealtimeEvent =
  | {
      type: "appointment:created" | "appointment:updated" | "appointment:rescheduled" | "appointment:cancelled" | "appointment:referred";
      appointmentId: string;
      actorRole: DashboardRole;
      targetDoctorId?: string;
      scheduledAt?: string;
      title?: string;
      body?: string;
    }
  | {
      type: "session:joined" | "session:started" | "session:ended" | "session:reconnected";
      appointmentId: string;
      actorRole: DashboardRole;
      roomId?: string;
      title?: string;
      body?: string;
    }
  | {
      type: "message:new";
      appointmentId: string;
      actorRole: DashboardRole;
      messageId: string;
      text: string;
      time: string;
      attachment?: ChatAttachment;
    }
  | {
      type: "media:updated";
      appointmentId: string;
      actorRole: DashboardRole;
      cameraOn: boolean;
      micOn: boolean;
    }
  | {
      type: "notification:new";
      actorRole: DashboardRole;
      title: string;
      body: string;
    };

export type ChatMessage = {
  id: string;
  sender: DashboardRole;
  text: string;
  time: string;
  attachment?: ChatAttachment;
};

export type ChatAttachment = {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
};
