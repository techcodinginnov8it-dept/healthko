"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useMemo, useState, useTransition } from "react";
import {
  updateDoctorPassword,
  updateDoctorProfile,
  updatePatientPassword,
  updatePatientProfile,
} from "@/app/actions/settings";
import { formatDate } from "@/lib/dashboard/format";

type DoctorSettingsData = {
  name: string;
  email: string;
  image?: string | null;
  specialty: string;
  availability: string;
  status?: string | null;
  npi: string;
  licenseNumber?: string | null;
  licenseState?: string | null;
  bio?: string | null;
  consultFee?: number | null;
  consultationDuration?: number | null;
  consultationDurationUnit?: string | null;
  yearsExp?: number | null;
  isVerified: boolean;
  createdAt: Date | string;
  audits?: {
    id: string;
    status: string;
    submittedAt: Date | string;
    updatedAt: Date | string;
    licenseNumber: string;
    licenseState: string;
  }[];
};

type PatientSettingsData = {
  firstName: string;
  lastName: string;
  email: string;
  image?: string | null;
  countryCode?: string;
  phone: string;
  dob: string;
  gender: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  height?: string | null;
  weight?: string | null;
  bloodType?: string | null;
  allergies?: string | null;
  existingConditions?: string | null;
  currentMedications?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  emailVerified: boolean;
  createdAt: Date | string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type SettingsSection<TId extends string> = {
  id: TId;
  label: string;
  description: string;
};

const blankPasswordForm: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const patientSections = [
  { id: "profile", label: "Profile Management", description: "Identity, contact, address, and ZIP code" },
  { id: "medical", label: "Medical Profile", description: "Health profile details and emergency contacts" },
  { id: "security", label: "Account Security", description: "Password, 2FA, devices, and recovery" },
  { id: "notifications", label: "Notifications", description: "Appointment, consultation, email, and SMS preferences" },
  { id: "privacy", label: "Privacy", description: "Teleconsultation and data privacy consent" },
  { id: "support", label: "Support & Help", description: "Help channels and account assistance" },
] as const satisfies readonly SettingsSection<string>[];

const doctorSections = [
  { id: "professional", label: "Professional Profile", description: "Credentials and patient-facing profile" },
  { id: "schedule", label: "Schedule & Availability", description: "Working hours and consultation duration" },
  { id: "consultation", label: "Consultation Settings", description: "Device and admission preferences" },
  { id: "security", label: "Account Security", description: "Password management" },
  { id: "notifications", label: "Notification Settings", description: "Appointment and communication alerts" },
  { id: "prescriptions", label: "Prescription Settings", description: "Signature and templates" },
  { id: "privacy", label: "Privacy & Consent", description: "Data access and telehealth compliance" },
  { id: "support", label: "Support & Help", description: "Help channels and account assistance" },
] as const satisfies readonly SettingsSection<string>[];

type PatientSectionId = (typeof patientSections)[number]["id"];
type DoctorSectionId = (typeof doctorSections)[number]["id"];

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
      {label}
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold normal-case text-slate-900 outline-none focus:border-brand-teal"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500 md:col-span-2">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={2}
        className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold normal-case text-slate-900 outline-none focus:border-brand-teal"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="space-y-1 text-xs font-black uppercase tracking-wider text-slate-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold normal-case text-slate-900 outline-none focus:border-brand-teal"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function SettingsCard({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        {body && <p className="mt-1 text-sm font-semibold text-slate-500">{body}</p>}
      </div>
      {children}
    </section>
  );
}

function SettingsToastStack({ toasts }: { toasts: { id: string; tone: "success" | "error"; message: string }[] }) {
  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[90] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur ${
            toast.tone === "success"
              ? "border-emerald-200 bg-emerald-50/95 text-emerald-700"
              : "border-red-200 bg-red-50/95 text-red-700"
          }`}
          role="status"
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function InitialsAvatar({ label, image }: { label: string; image?: string | null }) {
  return (
    <div className="flex items-center gap-4">
      {image ? (
        <div
          className="h-20 w-20 shrink-0 rounded-full border-4 border-white bg-cover bg-center shadow-sm ring-1 ring-slate-200"
          style={{ backgroundImage: `url(${image})` }}
          aria-label={`${label} profile image`}
          role="img"
        />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-brand-teal/10 text-xl font-black text-brand-teal shadow-sm ring-1 ring-slate-200">
          {label.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
        </div>
      )}
      <div>
        <p className="text-sm font-black text-slate-950">{label}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">Profile identity visible across secure care workflows.</p>
      </div>
    </div>
  );
}

function ProfileImageUploader({
  label,
  image,
  onChange,
  onToast,
}: {
  label: string;
  image?: string | null;
  onChange: (value: string) => void;
  onToast: (tone: "success" | "error", message: string) => void;
}) {
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      onToast("error", "Upload an image file for the profile picture.");
      return;
    }

    if (file.size > 750_000) {
      onToast("error", "Profile image must be 750 KB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <InitialsAvatar label={label} image={image} />
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <label className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-black text-white">
            Upload Photo
            <input type="file" accept="image/*" onChange={handleFile} className="sr-only" />
          </label>
          {image && (
            <button type="button" onClick={() => onChange("")} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700">
              Remove Photo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StickyActionBar({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <div
      className={`sticky bottom-0 z-20 -mx-5 -mb-5 mt-2 flex justify-end rounded-b-xl border-t px-5 py-3 backdrop-blur md:col-span-2 xl:col-span-3 ${
        tone === "dark" ? "border-slate-800 bg-slate-950/90" : "border-slate-200 bg-white/90"
      }`}
    >
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked = true,
}: {
  label: string;
  description: string;
  checked?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 py-3">
      <span>
        <span className="block text-sm font-black text-slate-800">{label}</span>
        <span className="mt-1 block text-xs font-semibold text-slate-500">{description}</span>
      </span>
      <input type="checkbox" checked={checked} readOnly className="h-4 w-4 shrink-0 accent-brand-teal" />
    </label>
  );
}

function ReadOnlyTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-slate-800">{value}</p>
    </div>
  );
}

function PlaceholderTile({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-800">{title}</p>
      <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{body}</p>
    </div>
  );
}

function SettingsLayout<TId extends string>({
  role,
  sections,
  activeSection,
  onSectionChange,
  title,
  subtitle,
  children,
}: {
  role: "doctor" | "patient";
  sections: readonly SettingsSection<TId>[];
  activeSection: TId;
  onSectionChange: (section: TId) => void;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const isDoctor = role === "doctor";

  return (
    <section className="grid min-h-[calc(100vh-9rem)] gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className={`rounded-xl border p-4 ${isDoctor ? "border-slate-850 bg-slate-900" : "border-slate-200 bg-white"}`}>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Settings</p>
        <h2 className={`mt-1 text-lg font-black ${isDoctor ? "text-white" : "text-slate-950"}`}>{title}</h2>
        <p className={`mt-1 text-xs font-semibold ${isDoctor ? "text-slate-400" : "text-slate-500"}`}>{subtitle}</p>
        <nav className="mt-5 space-y-2" aria-label={`${role} settings sections`}>
          {sections.map((section) => {
            const active = activeSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => onSectionChange(section.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                  active
                    ? "border-brand-teal bg-brand-teal text-white"
                    : isDoctor
                      ? "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-teal/40"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="block text-sm font-black">{section.label}</span>
                <span className={`mt-1 block text-[11px] font-semibold ${active ? "text-white/80" : isDoctor ? "text-slate-500" : "text-slate-500"}`}>
                  {section.description}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

function useSettingsToasts() {
  const [toasts, setToasts] = useState<{ id: string; tone: "success" | "error"; message: string }[]>([]);

  const showToast = useCallback((tone: "success" | "error", message: string) => {
    const id = `settings-toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((current) => [...current, { id, tone, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  return { toasts, showToast };
}

function PasswordManagement({
  role,
  onToast,
}: {
  role: "doctor" | "patient";
  onToast: (tone: "success" | "error", message: string) => void;
}) {
  const [form, setForm] = useState<PasswordForm>(blankPasswordForm);
  const [isPending, startTransition] = useTransition();

  const setField = (field: keyof PasswordForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <SettingsCard title="Password Management" body="Update your password after confirming the current one.">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = role === "doctor" ? await updateDoctorPassword(form) : await updatePatientPassword(form);
            if (!result.success) {
              onToast("error", result.error || "Could not update password.");
              return;
            }

            setForm(blankPasswordForm);
            onToast("success", "Password updated.");
          });
        }}
        className="grid gap-4 md:grid-cols-3"
      >
        <Field label="Current password" type="password" value={form.currentPassword} onChange={(value) => setField("currentPassword", value)} required />
        <Field label="New password" type="password" value={form.newPassword} onChange={(value) => setField("newPassword", value)} required />
        <Field label="Confirm password" type="password" value={form.confirmPassword} onChange={(value) => setField("confirmPassword", value)} required />
        <button type="submit" disabled={isPending} className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300 md:col-span-3">
          {isPending ? "Updating..." : "Update Password"}
        </button>
      </form>
    </SettingsCard>
  );
}

function AccountSecurityContent({
  role,
  verified,
  createdAt,
  onToast,
}: {
  role: "doctor" | "patient";
  verified: boolean;
  createdAt: Date | string;
  onToast: (tone: "success" | "error", message: string) => void;
}) {
  return (
    <div className="space-y-4">
      <PasswordManagement role={role} onToast={onToast} />
      <SettingsCard title="Security Overview" body="Role-based sessions use signed, HTTP-only cookies.">
        <div className="grid gap-3 md:grid-cols-3">
          <ReadOnlyTile label="Account Status" value={verified ? "Verified" : "Verification pending"} />
          <ReadOnlyTile label="Joined" value={formatDate(createdAt)} />
          <ReadOnlyTile label="Current Session" value="Active on this device" />
        </div>
      </SettingsCard>
      {role === "patient" && (
        <SettingsCard title="Two-Factor, Devices, Login Activity, and Recovery" body="These controls are represented for workflow planning and require dedicated persistence tables before they can be edited.">
          <div className="grid gap-3 md:grid-cols-2">
            <PlaceholderTile title="Two-Factor Authentication" body="Not yet stored in the active account schema." />
            <PlaceholderTile title="Login Activity History" body="Security event history needs an account activity table." />
            <PlaceholderTile title="Device Management" body="Remote device revocation needs session inventory storage." />
            <PlaceholderTile title="Account Recovery Options" body="Recovery settings currently use the OTP and password reset workflows." />
          </div>
        </SettingsCard>
      )}
    </div>
  );
}

export function DoctorSettingsModule({
  doctor,
  onProfileUpdated,
  onToast,
}: {
  doctor: DoctorSettingsData;
  onProfileUpdated?: (profile: { availability: string; status: string }) => void;
  onToast?: (tone: "success" | "error", message: string) => void;
}) {
  const router = useRouter();
  const { toasts, showToast: showLocalToast } = useSettingsToasts();
  const showToast = onToast ?? showLocalToast;
  const [activeSection, setActiveSection] = useState<DoctorSectionId>("professional");
  const [form, setForm] = useState({
    name: doctor.name,
    email: doctor.email,
    image: doctor.image || "",
    specialty: doctor.specialty,
    availability: doctor.availability,
    status: doctor.status || "ONLINE",
    licenseNumber: doctor.licenseNumber || "",
    licenseState: doctor.licenseState || "",
    bio: doctor.bio || "",
    consultFee: doctor.consultFee?.toString() || "",
    yearsExp: doctor.yearsExp?.toString() || "",
    consultationDuration: doctor.consultationDuration?.toString() || "30",
    consultationDurationUnit: doctor.consultationDurationUnit || "minutes",
    admitMode: "manual",
  });
  const [isPending, startTransition] = useTransition();

  const setField = useCallback((field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const saveDoctorProfile = useCallback((message: string) => {
    startTransition(async () => {
      const result = await updateDoctorProfile(form);
      if (!result.success) {
        showToast("error", result.error || "Could not update profile.");
        return;
      }

      showToast("success", message);
      onProfileUpdated?.({ availability: form.availability, status: form.status });
      router.refresh();
    });
  }, [form, onProfileUpdated, router, showToast]);

  const activeContent = useMemo(() => {
    if (activeSection === "professional") {
      return (
        <SettingsCard title="Professional Profile" body="Manage the professional identity patients see before and during care.">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveDoctorProfile("Professional profile updated.");
            }}
            className="grid gap-4 md:grid-cols-2"
          >
            <ProfileImageUploader label={form.name} image={form.image} onChange={(value) => setField("image", value)} onToast={showToast} />
            <Field label="Full name" value={form.name} onChange={(value) => setField("name", value)} required />
            <Field label="Medical specialty" value={form.specialty} onChange={(value) => setField("specialty", value)} required />
            <SelectField
              label="Dashboard status"
              value={form.status}
              onChange={(value) => setField("status", value)}
              options={[
                { value: "ONLINE", label: "Online" },
                { value: "BUSY", label: "Busy" },
                { value: "OFFLINE", label: "Offline" },
              ]}
            />
            <Field label="License number" value={form.licenseNumber} onChange={(value) => setField("licenseNumber", value)} />
            <Field label="License state" value={form.licenseState} onChange={(value) => setField("licenseState", value)} />
            <Field label="Contact information" type="email" value={form.email} onChange={(value) => setField("email", value)} required />
            <Field label="Consultation fee" type="number" value={form.consultFee} onChange={(value) => setField("consultFee", value)} />
            <Field label="Years experience" type="number" value={form.yearsExp} onChange={(value) => setField("yearsExp", value)} />
            <TextAreaField label="Professional bio" value={form.bio} onChange={(value) => setField("bio", value)} />
            <StickyActionBar>
              <button type="submit" disabled={isPending} className="rounded-lg bg-brand-teal px-5 py-3 text-sm font-black text-white disabled:bg-slate-300">
                {isPending ? "Saving..." : "Save Professional Profile"}
              </button>
            </StickyActionBar>
          </form>
        </SettingsCard>
      );
    }

    if (activeSection === "schedule") {
      return (
        <SettingsCard title="Schedule & Availability" body="Availability is synchronized with appointment suggestions and scheduling tools.">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveDoctorProfile("Schedule and availability updated.");
            }}
            className="grid gap-4 md:grid-cols-2"
          >
            <Field label="Working hours" value={form.availability} onChange={(value) => setField("availability", value)} required />
            <Field label="Consultation duration" type="number" value={form.consultationDuration} onChange={(value) => setField("consultationDuration", value)} />
            <SelectField
              label="Duration unit"
              value={form.consultationDurationUnit}
              onChange={(value) => setField("consultationDurationUnit", value)}
              options={[
                { value: "minutes", label: "Minutes" },
                { value: "hours", label: "Hours" },
              ]}
            />
            <ReadOnlyTile label="Availability Status" value={doctor.isVerified ? "Verified doctor schedule" : "Pending verification"} />
            <StickyActionBar>
              <button type="submit" disabled={isPending} className="rounded-lg bg-brand-teal px-5 py-3 text-sm font-black text-white disabled:bg-slate-300">
                {isPending ? "Saving..." : "Save Schedule"}
              </button>
            </StickyActionBar>
          </form>
        </SettingsCard>
      );
    }

    if (activeSection === "consultation") {
      return (
        <SettingsCard title="Consultation Settings" body="Camera and microphone controls are used by the live consultation room.">
          <div className="grid gap-3 md:grid-cols-2">
            <PlaceholderTile title="Camera Selection" body="Managed inside the active live consultation room device selector." />
            <PlaceholderTile title="Microphone Selection" body="Managed inside the active live consultation room device selector." />
            <ToggleRow label="Manual Admit Patients" description="Current WebRTC flow lets the doctor start the room before patients join." checked={form.admitMode === "manual"} />
            <ToggleRow label="Auto Admit Patients" description="Future workflow option once waiting-room admission policies are modeled." checked={false} />
          </div>
        </SettingsCard>
      );
    }

    if (activeSection === "security") {
      return <AccountSecurityContent role="doctor" verified={doctor.isVerified} createdAt={doctor.createdAt} onToast={showToast} />;
    }

    if (activeSection === "notifications") {
      return (
        <SettingsCard title="Notification Settings" body="These preferences connect to existing dashboard alerts and realtime notifications.">
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleRow label="Appointment Updates" description="New requests, approvals, reschedules, and cancellations." />
            <ToggleRow label="Consultation Reminders" description="Live room and follow-up reminders." />
            <ToggleRow label="Communication Preferences" description="Messages and clinical workflow notifications." />
            <ToggleRow label="Email Notifications" description="Email delivery is handled by account communication services." />
          </div>
        </SettingsCard>
      );
    }

    if (activeSection === "prescriptions") {
      return (
        <SettingsCard title="Prescription Settings" body="Prescription output uses current consultation documentation until template storage is added.">
          <div className="grid gap-3 md:grid-cols-2">
            <PlaceholderTile title="Digital Signature Upload" body="Requires a secure file storage field before upload persistence can be enabled." />
            <PlaceholderTile title="Prescription Templates" body="Reusable templates need a prescription template table." />
          </div>
        </SettingsCard>
      );
    }

    if (activeSection === "privacy") {
      return (
        <SettingsCard title="Privacy & Consent" body="Clinical access follows doctor authentication and role-based consultation ownership.">
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleRow label="Patient Data Access Permissions" description="Access is limited to assigned consultations and patient records." />
            <ToggleRow label="Telehealth Compliance Acknowledgment" description="Doctor account operates under Healthko telehealth workflow policies." checked={doctor.isVerified} />
          </div>
        </SettingsCard>
      );
    }

    return (
      <SettingsCard title="Support & Help" body="Credential review and support context for the doctor account.">
        <div className="space-y-3">
          <ReadOnlyTile label="NPI" value={doctor.npi} />
          {doctor.audits?.length ? (
            doctor.audits.map((audit) => (
              <article key={audit.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="font-black text-slate-950">{audit.status}</p>
                <p className="mt-1 font-semibold text-slate-500">License {audit.licenseNumber}, {audit.licenseState}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Submitted {formatDate(audit.submittedAt)}</p>
              </article>
            ))
          ) : (
            <PlaceholderTile title="Credential Audit" body="No credential audit activity is available for this account yet." />
          )}
        </div>
      </SettingsCard>
    );
  }, [activeSection, doctor.audits, doctor.createdAt, doctor.isVerified, doctor.npi, form, isPending, saveDoctorProfile, setField, showToast]);

  return (
    <>
      {!onToast && <SettingsToastStack toasts={toasts} />}
      <SettingsLayout
        role="doctor"
        sections={doctorSections}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        title="Doctor Settings"
        subtitle="Manage professional, clinical, account, and compliance settings."
      >
        {activeContent}
      </SettingsLayout>
    </>
  );
}

export function PatientSettingsModule({
  patient,
  onToast,
}: {
  patient: PatientSettingsData;
  onToast?: (tone: "success" | "error", message: string) => void;
}) {
  const router = useRouter();
  const { toasts, showToast: showLocalToast } = useSettingsToasts();
  const showToast = onToast ?? showLocalToast;
  const [activeSection, setActiveSection] = useState<PatientSectionId>("profile");
  const [form, setForm] = useState({
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email,
    image: patient.image || "",
    countryCode: patient.countryCode || "+1",
    phone: patient.phone,
    dob: patient.dob,
    gender: patient.gender || "",
    address: patient.address || "",
    city: patient.city || "",
    state: patient.state || "",
    zipCode: patient.zipCode || "",
    country: patient.country || "",
    height: patient.height || "",
    weight: patient.weight || "",
    bloodType: patient.bloodType || "",
    allergies: patient.allergies || "",
    existingConditions: patient.existingConditions || "",
    currentMedications: patient.currentMedications || "",
    emergencyContactName: patient.emergencyContactName || "",
    emergencyContactPhone: patient.emergencyContactPhone || "",
    emergencyContactRelation: patient.emergencyContactRelation || "",
  });
  const [isPending, startTransition] = useTransition();

  const setField = useCallback((field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const activeContent = useMemo(() => {
    if (activeSection === "profile") {
      return (
        <SettingsCard title="Profile Management" body="Manage identity, contact, address, and ZIP code information used for care coordination.">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await updatePatientProfile(form);
                if (!result.success) {
                  showToast("error", result.error || "Could not update profile.");
                  return;
                }

                showToast("success", "Patient profile updated.");
                router.refresh();
              });
            }}
            className="grid gap-4 md:grid-cols-2"
          >
            <ProfileImageUploader label={`${form.firstName} ${form.lastName}`} image={form.image} onChange={(value) => setField("image", value)} onToast={showToast} />
            <Field label="First name" value={form.firstName} onChange={(value) => setField("firstName", value)} required />
            <Field label="Last name" value={form.lastName} onChange={(value) => setField("lastName", value)} required />
            <Field label="Date of birth" type="date" value={form.dob} onChange={(value) => setField("dob", value)} required />
            <Field label="Gender" value={form.gender} onChange={(value) => setField("gender", value)} />
            <Field label="Email" type="email" value={form.email} onChange={(value) => setField("email", value)} required />
            <div className="grid grid-cols-[96px_1fr] gap-3">
              <Field label="Code" value={form.countryCode} onChange={(value) => setField("countryCode", value)} required />
              <Field label="Contact information" value={form.phone} onChange={(value) => setField("phone", value)} required />
            </div>
            <div className="md:col-span-2">
              <Field label="Address" value={form.address} onChange={(value) => setField("address", value)} />
            </div>
            <Field label="City" value={form.city} onChange={(value) => setField("city", value)} />
            <Field label="State" value={form.state} onChange={(value) => setField("state", value)} />
            <Field label="ZIP code" value={form.zipCode} onChange={(value) => setField("zipCode", value)} />
            <Field label="Country" value={form.country} onChange={(value) => setField("country", value)} />
            <StickyActionBar>
              <button type="submit" disabled={isPending} className="rounded-lg bg-brand-teal px-5 py-3 text-sm font-black text-white disabled:bg-slate-300">
                {isPending ? "Saving..." : "Save Patient Profile"}
              </button>
            </StickyActionBar>
          </form>
        </SettingsCard>
      );
    }

    if (activeSection === "medical") {
      return (
        <SettingsCard title="Medical Profile" body="Manage medical details used by patient overview, QR, and doctor clinical context.">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await updatePatientProfile(form);
                if (!result.success) {
                  showToast("error", result.error || "Could not update medical profile.");
                  return;
                }

                showToast("success", "Medical profile updated.");
                router.refresh();
              });
            }}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            <Field label="Height" value={form.height} onChange={(value) => setField("height", value)} placeholder="e.g. 170 cm" />
            <Field label="Weight" value={form.weight} onChange={(value) => setField("weight", value)} placeholder="e.g. 68 kg" />
            <Field label="Blood type" value={form.bloodType} onChange={(value) => setField("bloodType", value)} placeholder="e.g. O+" />
            <TextAreaField label="Allergies" value={form.allergies} onChange={(value) => setField("allergies", value)} />
            <TextAreaField label="Existing medical conditions" value={form.existingConditions} onChange={(value) => setField("existingConditions", value)} />
            <TextAreaField label="Current medications" value={form.currentMedications} onChange={(value) => setField("currentMedications", value)} />
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2 xl:col-span-3">
              <h3 className="text-sm font-black text-slate-950">Emergency Contact Information</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-3">
                <Field label="Contact name" value={form.emergencyContactName} onChange={(value) => setField("emergencyContactName", value)} />
                <Field label="Contact phone" value={form.emergencyContactPhone} onChange={(value) => setField("emergencyContactPhone", value)} />
                <Field label="Relation" value={form.emergencyContactRelation} onChange={(value) => setField("emergencyContactRelation", value)} />
              </div>
            </section>
            <StickyActionBar>
              <button type="submit" disabled={isPending} className="rounded-lg bg-brand-teal px-5 py-3 text-sm font-black text-white disabled:bg-slate-300">
                {isPending ? "Saving..." : "Save Medical Profile"}
              </button>
            </StickyActionBar>
          </form>
        </SettingsCard>
      );
    }

    if (activeSection === "security") {
      return <AccountSecurityContent role="patient" verified={patient.emailVerified} createdAt={patient.createdAt} onToast={showToast} />;
    }

    if (activeSection === "notifications") {
      return (
        <SettingsCard title="Notifications" body="Dashboard notifications use the existing realtime alert system. Preference storage can be added when notification preferences are modeled.">
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleRow label="Appointment Reminders" description="Pending, confirmed, and rescheduled appointment reminders." />
            <ToggleRow label="Consultation Notifications" description="Live room, session, and consultation status alerts." />
            <ToggleRow label="Email Preferences" description="Email alerts for appointment workflow updates." />
            <ToggleRow label="SMS Preferences" description="SMS delivery can be enabled when SMS preferences are stored." checked={false} />
          </div>
        </SettingsCard>
      );
    }

    if (activeSection === "privacy") {
      return (
        <SettingsCard title="Privacy" body="Consent status follows current patient account and telehealth workflow requirements.">
          <div className="grid gap-3 md:grid-cols-2">
            <ToggleRow label="Teleconsultation Consent" description="Consent is required before participating in telehealth consultations." />
            <ToggleRow label="Data Privacy Consent" description="Healthko protects clinical access through role-based dashboard sessions." checked={patient.emailVerified} />
          </div>
        </SettingsCard>
      );
    }

    return (
      <SettingsCard title="Support & Help" body="Account assistance and care workflow support.">
        <div className="grid gap-3 md:grid-cols-2">
          <ReadOnlyTile label="Account Email" value={patient.email} />
          <ReadOnlyTile label="Joined" value={formatDate(patient.createdAt)} />
          <PlaceholderTile title="Support Center" body="Contact Healthko support for account, booking, or consultation access issues." />
          <PlaceholderTile title="Help Documentation" body="Patient help articles can be linked here when the support knowledge base is connected." />
        </div>
      </SettingsCard>
    );
  }, [activeSection, form, isPending, patient.createdAt, patient.email, patient.emailVerified, router, setField, showToast]);

  return (
    <>
      {!onToast && <SettingsToastStack toasts={toasts} />}
      <SettingsLayout
        role="patient"
        sections={patientSections}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        title="Patient Settings"
        subtitle="Manage profile, medical, account, privacy, and support settings."
      >
        {activeContent}
      </SettingsLayout>
    </>
  );
}
