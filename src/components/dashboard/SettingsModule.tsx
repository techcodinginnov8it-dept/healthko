"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState, useTransition } from "react";
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
  npi: string;
  licenseNumber?: string | null;
  licenseState?: string | null;
  bio?: string | null;
  consultFee?: number | null;
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
  countryCode?: string;
  phone: string;
  dob: string;
  gender: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  emailVerified: boolean;
  createdAt: Date | string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const blankPasswordForm: PasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

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
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold normal-case text-slate-900 outline-none focus:border-brand-teal"
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
        rows={4}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold normal-case text-slate-900 outline-none focus:border-brand-teal"
      />
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

function FormStatus({ error, success }: { error: string; success: string }) {
  if (!error && !success) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border p-3 text-xs font-bold ${
        error ? "border-brand-red/20 bg-brand-red/10 text-brand-red" : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
      role="status"
    >
      {error || success}
    </div>
  );
}

function InitialsAvatar({ label, image }: { label: string; image?: string | null }) {
  return (
    <div className="flex items-center gap-4">
      {image ? (
        <div
          className="h-16 w-16 rounded-xl bg-cover bg-center"
          style={{ backgroundImage: `url(${image})` }}
          aria-hidden="true"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-brand-teal/10 text-lg font-black text-brand-teal">
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

function SharedAccountControls({
  role,
  verified,
  createdAt,
}: {
  role: "doctor" | "patient";
  verified: boolean;
  createdAt: Date | string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <SettingsCard title="Notification Preferences" body="Connected account alerts stay contextual to appointments and consultations.">
        <div className="space-y-3 text-sm font-semibold text-slate-600">
          <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-3 py-2">
            Email alerts
            <input type="checkbox" checked readOnly className="h-4 w-4 accent-brand-teal" />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-3 py-2">
            Care updates
            <input type="checkbox" checked readOnly className="h-4 w-4 accent-brand-teal" />
          </label>
          <p className="text-xs text-slate-500">Preference persistence is not yet modeled in the current schema.</p>
        </div>
      </SettingsCard>

      <SettingsCard title="Security & Privacy" body="Role-based sessions use signed, HTTP-only cookies.">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-black text-slate-500">Account status</dt>
            <dd className="font-semibold text-slate-900">{verified ? "Verified" : "Verification pending"}</dd>
          </div>
          <div>
            <dt className="font-black text-slate-500">Privacy mode</dt>
            <dd className="font-semibold text-slate-900">HIPAA-aware care access</dd>
          </div>
          <div>
            <dt className="font-black text-slate-500">Joined</dt>
            <dd className="font-semibold text-slate-900">{formatDate(createdAt)}</dd>
          </div>
        </dl>
      </SettingsCard>

      <SettingsCard title="Sessions & Devices" body="Active browser sessions are managed through secure cookies.">
        <div className="space-y-3 text-sm font-semibold text-slate-600">
          <p>Current {role} session is active on this device.</p>
          <p className="text-xs text-slate-500">Device inventory and remote revocation need a dedicated session table before they can be persisted.</p>
        </div>
      </SettingsCard>
    </div>
  );
}

function PasswordManagement({ role }: { role: "doctor" | "patient" }) {
  const [form, setForm] = useState<PasswordForm>(blankPasswordForm);
  const [status, setStatus] = useState({ error: "", success: "" });
  const [isPending, startTransition] = useTransition();

  const setField = (field: keyof PasswordForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <SettingsCard title="Password Management" body="Update your password after confirming the current one.">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setStatus({ error: "", success: "" });
          startTransition(async () => {
            const result = role === "doctor" ? await updateDoctorPassword(form) : await updatePatientPassword(form);
            if (!result.success) {
              setStatus({ error: result.error || "Could not update password.", success: "" });
              return;
            }
            setForm(blankPasswordForm);
            setStatus({ error: "", success: "Password updated." });
          });
        }}
        className="grid gap-4 md:grid-cols-3"
      >
        <div className="md:col-span-3">
          <FormStatus error={status.error} success={status.success} />
        </div>
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

export function DoctorSettingsModule({ doctor }: { doctor: DoctorSettingsData }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: doctor.name,
    email: doctor.email,
    image: doctor.image || "",
    specialty: doctor.specialty,
    availability: doctor.availability,
    licenseNumber: doctor.licenseNumber || "",
    licenseState: doctor.licenseState || "",
    bio: doctor.bio || "",
    consultFee: doctor.consultFee?.toString() || "",
    yearsExp: doctor.yearsExp?.toString() || "",
  });
  const [status, setStatus] = useState({ error: "", success: "" });
  const [isPending, startTransition] = useTransition();

  const setField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <SettingsCard title="Profile Management" body="Manage the professional identity patients see before and during care.">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setStatus({ error: "", success: "" });
            startTransition(async () => {
              const result = await updateDoctorProfile(form);
              if (!result.success) {
                setStatus({ error: result.error || "Could not update profile.", success: "" });
                return;
              }
              setStatus({ error: "", success: "Profile updated." });
              router.refresh();
            });
          }}
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <InitialsAvatar label={form.name} image={form.image} />
          </div>
          <div className="md:col-span-2">
            <FormStatus error={status.error} success={status.success} />
          </div>
          <Field label="Profile photo URL" value={form.image} onChange={(value) => setField("image", value)} placeholder="https://..." />
          <Field label="Full name" value={form.name} onChange={(value) => setField("name", value)} required />
          <Field label="Email" type="email" value={form.email} onChange={(value) => setField("email", value)} required />
          <Field label="Specialization" value={form.specialty} onChange={(value) => setField("specialty", value)} required />
          <Field label="License number" value={form.licenseNumber} onChange={(value) => setField("licenseNumber", value)} />
          <Field label="License state" value={form.licenseState} onChange={(value) => setField("licenseState", value)} />
          <Field label="Consultation schedule" value={form.availability} onChange={(value) => setField("availability", value)} required />
          <Field label="Consult fee" type="number" value={form.consultFee} onChange={(value) => setField("consultFee", value)} />
          <Field label="Years experience" type="number" value={form.yearsExp} onChange={(value) => setField("yearsExp", value)} />
          <Field label="Availability status" value={form.availability} onChange={(value) => setField("availability", value)} required />
          <TextAreaField label="Professional bio" value={form.bio} onChange={(value) => setField("bio", value)} />
          <button type="submit" disabled={isPending} className="rounded-lg bg-brand-teal px-4 py-3 text-sm font-black text-white disabled:bg-slate-300 md:col-span-2">
            {isPending ? "Saving..." : "Save Professional Profile"}
          </button>
        </form>
      </SettingsCard>

      <PasswordManagement role="doctor" />
      <SharedAccountControls role="doctor" verified={doctor.isVerified} createdAt={doctor.createdAt} />

      <SettingsCard title="Account Activity Logs" body="Credential review activity already tracked by the Healthko audit model.">
        {doctor.audits?.length ? (
          <div className="space-y-3">
            {doctor.audits.map((audit) => (
              <article key={audit.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="font-black text-slate-950">{audit.status}</p>
                <p className="mt-1 font-semibold text-slate-500">License {audit.licenseNumber}, {audit.licenseState}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">Submitted {formatDate(audit.submittedAt)}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm font-semibold text-slate-500">No credential audit activity is available for this account yet.</p>
        )}
      </SettingsCard>
    </div>
  );
}

export function PatientSettingsModule({ patient }: { patient: PatientSettingsData }) {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email,
    countryCode: patient.countryCode || "+1",
    phone: patient.phone,
    dob: patient.dob,
    gender: patient.gender || "",
    address: patient.address || "",
    city: patient.city || "",
    state: patient.state || "",
    zipCode: patient.zipCode || "",
    country: patient.country || "",
  });
  const [status, setStatus] = useState({ error: "", success: "" });
  const [isPending, startTransition] = useTransition();

  const setField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <SettingsCard title="Profile Management" body="Manage the personal information used for patient identity and care coordination.">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setStatus({ error: "", success: "" });
            startTransition(async () => {
              const result = await updatePatientProfile(form);
              if (!result.success) {
                setStatus({ error: result.error || "Could not update profile.", success: "" });
                return;
              }
              setStatus({ error: "", success: "Profile updated." });
              router.refresh();
            });
          }}
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="md:col-span-2">
            <InitialsAvatar label={`${form.firstName} ${form.lastName}`} />
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 md:col-span-2">
            Patient profile photo storage is not present in the current patient schema, so this dashboard shows initials until the data model adds a photo field.
          </div>
          <div className="md:col-span-2">
            <FormStatus error={status.error} success={status.success} />
          </div>
          <Field label="First name" value={form.firstName} onChange={(value) => setField("firstName", value)} required />
          <Field label="Last name" value={form.lastName} onChange={(value) => setField("lastName", value)} required />
          <Field label="Email" type="email" value={form.email} onChange={(value) => setField("email", value)} required />
          <div className="grid grid-cols-[96px_1fr] gap-3">
            <Field label="Code" value={form.countryCode} onChange={(value) => setField("countryCode", value)} required />
            <Field label="Contact number" value={form.phone} onChange={(value) => setField("phone", value)} required />
          </div>
          <Field label="Date of birth" type="date" value={form.dob} onChange={(value) => setField("dob", value)} required />
          <Field label="Gender" value={form.gender} onChange={(value) => setField("gender", value)} />
          <Field label="Address" value={form.address} onChange={(value) => setField("address", value)} />
          <Field label="City" value={form.city} onChange={(value) => setField("city", value)} />
          <Field label="State" value={form.state} onChange={(value) => setField("state", value)} />
          <Field label="ZIP code" value={form.zipCode} onChange={(value) => setField("zipCode", value)} />
          <Field label="Country" value={form.country} onChange={(value) => setField("country", value)} />
          <button type="submit" disabled={isPending} className="rounded-lg bg-brand-teal px-4 py-3 text-sm font-black text-white disabled:bg-slate-300 md:col-span-2">
            {isPending ? "Saving..." : "Save Patient Profile"}
          </button>
        </form>
      </SettingsCard>

      <SettingsCard title="Medical Profile" body="Medical details are shown only when they exist in the active Healthko schema.">
        <div className="grid gap-3 md:grid-cols-3">
          {["Emergency contact", "Blood type", "Personal health details"].map((item) => (
            <div key={item} className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-800">{item}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">Not yet supported by the current patient data model.</p>
            </div>
          ))}
        </div>
      </SettingsCard>

      <PasswordManagement role="patient" />
      <SharedAccountControls role="patient" verified={patient.emailVerified} createdAt={patient.createdAt} />

      <SettingsCard title="Account Activity Logs" body="Patient activity logging is not modeled in the current schema.">
        <p className="text-sm font-semibold text-slate-500">Security events can be added here once an account activity table is introduced.</p>
      </SettingsCard>
    </div>
  );
}
