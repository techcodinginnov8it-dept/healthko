"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireDoctorSession } from "@/lib/auth/doctor-session";
import { requirePatientSession } from "@/lib/auth/patient-session";
import { mockDb } from "@/lib/mockDb";

type ActionResult = {
  success: boolean;
  error?: string;
};

type DoctorProfilePayload = {
  name: string;
  email: string;
  image?: string;
  specialty: string;
  availability: string;
  status?: string;
  licenseNumber?: string;
  licenseState?: string;
  bio?: string;
  consultFee?: string;
  yearsExp?: string;
  consultationDuration?: string;
  consultationDurationUnit?: string;
};

type PatientProfilePayload = {
  firstName: string;
  lastName: string;
  email: string;
  image?: string;
  countryCode: string;
  phone: string;
  dob: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  height?: string;
  weight?: string;
  bloodType?: string;
  allergies?: string;
  existingConditions?: string;
  currentMedications?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
};

type PasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

function normalizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalNumber(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseDuration(value?: string) {
  const parsed = parseOptionalNumber(value);
  if (!parsed) {
    return 30;
  }

  return Math.max(1, Math.round(parsed));
}

function normalizeDurationUnit(value?: string) {
  return value === "hours" ? "hours" : "minutes";
}

function normalizeDoctorStatus(value?: string) {
  return value === "BUSY" || value === "OFFLINE" ? value : "ONLINE";
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePasswordPayload(data: PasswordPayload) {
  if (!data.currentPassword || !data.newPassword || !data.confirmPassword) {
    return "Current password, new password, and confirmation are required.";
  }

  if (data.newPassword.length < 8) {
    return "New password must be at least 8 characters.";
  }

  if (data.newPassword !== data.confirmPassword) {
    return "New password and confirmation do not match.";
  }

  if (data.currentPassword === data.newPassword) {
    return "Choose a new password that is different from your current password.";
  }

  return "";
}

export async function updateDoctorProfile(data: DoctorProfilePayload): Promise<ActionResult> {
  try {
    const session = await requireDoctorSession();
    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();
    const specialty = data.specialty.trim();
    const availability = data.availability.trim();
    const status = normalizeDoctorStatus(data.status);

    if (!name || !email || !specialty || !availability) {
      return { success: false, error: "Name, email, specialization, and availability are required." };
    }

    if (!validateEmail(email)) {
      return { success: false, error: "Enter a valid email address." };
    }

    const consultFee = parseOptionalNumber(data.consultFee);
    const yearsExp = parseOptionalNumber(data.yearsExp);
    const consultationDuration = parseDuration(data.consultationDuration);
    const consultationDurationUnit = normalizeDurationUnit(data.consultationDurationUnit);

    const existing = await prisma.doctor.findFirst({
      where: {
        email,
        NOT: { id: session.userId },
      },
      select: { id: true },
    });

    if (existing) {
      return { success: false, error: "That email is already used by another doctor account." };
    }

    await prisma.doctor.update({
      where: { id: session.userId },
      data: {
        name,
        email,
        image: normalizeOptional(data.image),
        specialty,
        availability,
        status,
        licenseNumber: normalizeOptional(data.licenseNumber),
        licenseState: normalizeOptional(data.licenseState),
        bio: normalizeOptional(data.bio),
        consultFee,
        yearsExp,
        consultationDuration,
        consultationDurationUnit,
      },
    });

    revalidatePath("/doctor/dashboard");
    return { success: true };
  } catch (error: unknown) {
    console.warn("Prisma updateDoctorProfile failed, falling back to mock JSON database:", error);
    try {
      const session = await requireDoctorSession();
      const doctor = mockDb.findDoctorById(session.userId);

      if (!doctor) {
        return { success: false, error: "Doctor account was not found." };
      }

      const email = data.email.trim().toLowerCase();
      if (!validateEmail(email)) {
        return { success: false, error: "Enter a valid email address." };
      }

      const duplicate = mockDb.findDoctorByEmailOrNpi(email);
      if (duplicate && duplicate.id !== session.userId) {
        return { success: false, error: "That email is already used by another doctor account." };
      }

      mockDb.updateDoctor(session.userId, {
        name: data.name.trim(),
        email,
        image: normalizeOptional(data.image),
        specialty: data.specialty.trim(),
        availability: data.availability.trim(),
        status: normalizeDoctorStatus(data.status),
        licenseNumber: normalizeOptional(data.licenseNumber),
        licenseState: normalizeOptional(data.licenseState),
        bio: normalizeOptional(data.bio),
        consultFee: parseOptionalNumber(data.consultFee),
        yearsExp: parseOptionalNumber(data.yearsExp),
        consultationDuration: parseDuration(data.consultationDuration),
        consultationDurationUnit: normalizeDurationUnit(data.consultationDurationUnit),
      });

      revalidatePath("/doctor/dashboard");
      return { success: true };
    } catch (mockErr) {
      console.error("Doctor profile mock fallback failed:", mockErr);
      return { success: false, error: "Could not update doctor profile." };
    }
  }
}

export async function updatePatientProfile(data: PatientProfilePayload): Promise<ActionResult> {
  try {
    const session = await requirePatientSession();
    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();
    const email = data.email.trim().toLowerCase();
    const phone = data.phone.trim();
    const dob = data.dob.trim();

    if (!firstName || !lastName || !email || !phone || !dob) {
      return { success: false, error: "First name, last name, email, phone, and date of birth are required." };
    }

    if (!validateEmail(email)) {
      return { success: false, error: "Enter a valid email address." };
    }

    const existing = await prisma.patient.findFirst({
      where: {
        email,
        NOT: { id: session.userId },
      },
      select: { id: true },
    });

    if (existing) {
      return { success: false, error: "That email is already used by another patient account." };
    }

    await prisma.patient.update({
      where: { id: session.userId },
      data: {
        firstName,
        lastName,
        email,
        image: normalizeOptional(data.image),
        countryCode: data.countryCode.trim() || "+1",
        phone,
        dob,
        gender: normalizeOptional(data.gender),
        address: normalizeOptional(data.address),
        city: normalizeOptional(data.city),
        state: normalizeOptional(data.state),
        zipCode: normalizeOptional(data.zipCode),
        country: normalizeOptional(data.country),
        height: normalizeOptional(data.height),
        weight: normalizeOptional(data.weight),
        bloodType: normalizeOptional(data.bloodType),
        allergies: normalizeOptional(data.allergies),
        existingConditions: normalizeOptional(data.existingConditions),
        currentMedications: normalizeOptional(data.currentMedications),
        emergencyContactName: normalizeOptional(data.emergencyContactName),
        emergencyContactPhone: normalizeOptional(data.emergencyContactPhone),
        emergencyContactRelation: normalizeOptional(data.emergencyContactRelation),
      },
    });

    revalidatePath("/patient/dashboard");
    return { success: true };
  } catch (error: unknown) {
    console.warn("Prisma updatePatientProfile failed, falling back to mock JSON database:", error);
    try {
      const session = await requirePatientSession();
      const patient = mockDb.findPatientById(session.userId);

      if (!patient) {
        return { success: false, error: "Patient account was not found." };
      }

      const email = data.email.trim().toLowerCase();
      if (!validateEmail(email)) {
        return { success: false, error: "Enter a valid email address." };
      }

      const duplicate = mockDb.findPatientByEmail(email);
      if (duplicate && duplicate.id !== session.userId) {
        return { success: false, error: "That email is already used by another patient account." };
      }

      mockDb.updatePatientById(session.userId, {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email,
        image: normalizeOptional(data.image),
        countryCode: data.countryCode.trim() || "+1",
        phone: data.phone.trim(),
        dob: data.dob.trim(),
        gender: normalizeOptional(data.gender),
        address: normalizeOptional(data.address),
        city: normalizeOptional(data.city),
        state: normalizeOptional(data.state),
        zipCode: normalizeOptional(data.zipCode),
        country: normalizeOptional(data.country),
        height: normalizeOptional(data.height),
        weight: normalizeOptional(data.weight),
        bloodType: normalizeOptional(data.bloodType),
        allergies: normalizeOptional(data.allergies),
        existingConditions: normalizeOptional(data.existingConditions),
        currentMedications: normalizeOptional(data.currentMedications),
        emergencyContactName: normalizeOptional(data.emergencyContactName),
        emergencyContactPhone: normalizeOptional(data.emergencyContactPhone),
        emergencyContactRelation: normalizeOptional(data.emergencyContactRelation),
      });

      revalidatePath("/patient/dashboard");
      return { success: true };
    } catch (mockErr) {
      console.error("Patient profile mock fallback failed:", mockErr);
      return { success: false, error: "Could not update patient profile." };
    }
  }
}

export async function updateDoctorPassword(data: PasswordPayload): Promise<ActionResult> {
  const validationError = validatePasswordPayload(data);
  if (validationError) {
    return { success: false, error: validationError };
  }

  try {
    const session = await requireDoctorSession();
    const doctor = await prisma.doctor.findUnique({
      where: { id: session.userId },
      select: { password: true },
    });

    if (!doctor || !(await bcrypt.compare(data.currentPassword, doctor.password))) {
      return { success: false, error: "Current password is incorrect." };
    }

    await prisma.doctor.update({
      where: { id: session.userId },
      data: { password: await bcrypt.hash(data.newPassword, 12) },
    });

    return { success: true };
  } catch (error: unknown) {
    console.warn("Prisma updateDoctorPassword failed, falling back to mock JSON database:", error);
    try {
      const session = await requireDoctorSession();
      const doctor = mockDb.findDoctorById(session.userId);

      if (!doctor || !(await bcrypt.compare(data.currentPassword, doctor.password))) {
        return { success: false, error: "Current password is incorrect." };
      }

      mockDb.updateDoctor(session.userId, {
        password: await bcrypt.hash(data.newPassword, 12),
      });

      return { success: true };
    } catch (mockErr) {
      console.error("Doctor password mock fallback failed:", mockErr);
      return { success: false, error: "Could not update password." };
    }
  }
}

export async function updatePatientPassword(data: PasswordPayload): Promise<ActionResult> {
  const validationError = validatePasswordPayload(data);
  if (validationError) {
    return { success: false, error: validationError };
  }

  try {
    const session = await requirePatientSession();
    const patient = await prisma.patient.findUnique({
      where: { id: session.userId },
      select: { password: true },
    });

    if (!patient || !(await bcrypt.compare(data.currentPassword, patient.password))) {
      return { success: false, error: "Current password is incorrect." };
    }

    await prisma.patient.update({
      where: { id: session.userId },
      data: { password: await bcrypt.hash(data.newPassword, 12) },
    });

    return { success: true };
  } catch (error: unknown) {
    console.warn("Prisma updatePatientPassword failed, falling back to mock JSON database:", error);
    try {
      const session = await requirePatientSession();
      const patient = mockDb.findPatientById(session.userId);

      if (!patient || !(await bcrypt.compare(data.currentPassword, patient.password))) {
        return { success: false, error: "Current password is incorrect." };
      }

      mockDb.updatePatientById(session.userId, {
        password: await bcrypt.hash(data.newPassword, 12),
      });

      return { success: true };
    } catch (mockErr) {
      console.error("Patient password mock fallback failed:", mockErr);
      return { success: false, error: "Could not update password." };
    }
  }
}
