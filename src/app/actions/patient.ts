"use server";

import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/errors";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { requirePatientSession } from "@/lib/auth/patient-session";
import { mockDb } from "@/lib/mockDb";
import {
  DEFAULT_DURATION_MINUTES,
  getFullyBookedMessage,
  getOutsideAvailabilityMessage,
  getScheduleConflict,
  isWithinDoctorAvailability,
} from "@/lib/scheduling";

export async function getDoctorsList() {
  if (!isPrismaConfigured()) {
    return getMockDoctorsList();
  }

  try {
    const doctors = await prisma.doctor.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        npi: true,
        email: true,
        specialty: true,
        bio: true,
        image: true,
        availability: true,
        status: true,
        consultFee: true,
        rating: true,
        reviewCount: true,
        isVerified: true,
        licenseNumber: true,
        licenseState: true,
        yearsExp: true,
      },
    });
    return { success: true, doctors };
  } catch (error: unknown) {
    console.warn("Prisma getDoctorsList failed, falling back to mock JSON database:", getErrorMessage(error, "Unknown error"));
    return getMockDoctorsList();
  }
}

function getMockDoctorsList() {
  try {
    const doctors = mockDb.getDoctorsList();
    return { success: true, doctors };
  } catch (mockErr) {
    console.error("Failed to retrieve doctors list:", mockErr);
    return { success: false, error: "Failed to retrieve physician directory." };
  }
}

type BookAppointmentPayload = {
  doctorId: string;
  scheduledAt: string; // ISO string
  reason: string;
};

export async function bookAppointment(data: BookAppointmentPayload) {
  if (!isPrismaConfigured()) {
    return bookMockAppointment(data);
  }

  try {
    const session = await requirePatientSession();
    const { doctorId, scheduledAt, reason } = data;

    if (!doctorId || !scheduledAt || !reason) {
      return { success: false, error: "Doctor, date/time, and reason are required." };
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime()) || scheduledDate < new Date()) {
      return { success: false, error: "Please provide a valid future appointment date and time." };
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { availability: true },
    });

    if (!doctor) {
      return { success: false, error: "Selected doctor is not available." };
    }

    if (!isWithinDoctorAvailability(scheduledDate, DEFAULT_DURATION_MINUTES, doctor)) {
      return { success: false, error: getOutsideAvailabilityMessage(doctor.availability) };
    }

    const existingAppointments = await prisma.consultation.findMany({
      where: { doctorId, status: "CONFIRMED" },
      select: { id: true, scheduledAt: true, duration: true, status: true },
    });

    const conflict = getScheduleConflict(existingAppointments, scheduledDate, DEFAULT_DURATION_MINUTES);
    if (conflict) {
      return { success: false, error: getFullyBookedMessage() };
    }

    const consultation = await prisma.consultation.create({
      data: {
        patientId: session.userId,
        doctorId,
        scheduledAt: scheduledDate,
        reason,
        status: "PENDING",
        duration: DEFAULT_DURATION_MINUTES,
      },
    });

    revalidatePath("/patient/dashboard");
    return { success: true, consultation };
  } catch (error: unknown) {
    console.warn("Prisma bookAppointment failed, falling back to mock JSON database:", getErrorMessage(error, "Unknown error"));
    return bookMockAppointment(data);
  }
}

export async function confirmFollowUpAppointment(consultationId: string) {
  if (!isPrismaConfigured()) {
    return confirmMockFollowUpAppointment(consultationId);
  }

  try {
    const session = await requirePatientSession();
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { id: true, patientId: true, status: true, notes: true },
    });

    if (!consultation || consultation.patientId !== session.userId) {
      return { success: false, error: "Follow-up appointment was not found." };
    }

    if (consultation.status !== "PENDING" || !consultation.notes?.includes("Follow-up requested by doctor")) {
      return { success: false, error: "Only pending doctor follow-ups can be confirmed here." };
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: "CONFIRMED",
        notes: [consultation.notes, "Patient confirmed this follow-up appointment."].filter(Boolean).join("\n"),
      },
    });

    revalidatePath("/patient/dashboard");
    revalidatePath("/doctor/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.warn("Prisma confirmFollowUpAppointment failed, falling back to mock JSON database:", getErrorMessage(error, "Unknown error"));
    return confirmMockFollowUpAppointment(consultationId);
  }
}

type FollowUpReschedulePayload = {
  consultationId: string;
  requestedScheduledAt: string;
};

export async function requestFollowUpReschedule(data: FollowUpReschedulePayload) {
  if (!isPrismaConfigured()) {
    return requestMockFollowUpReschedule(data);
  }

  try {
    const session = await requirePatientSession();
    const { consultationId, requestedScheduledAt } = data;
    const requestedDate = new Date(requestedScheduledAt);

    if (Number.isNaN(requestedDate.getTime()) || requestedDate <= new Date()) {
      return { success: false, error: "Choose a valid future date and time for the reschedule request." };
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { id: true, patientId: true, status: true, notes: true },
    });

    if (!consultation || consultation.patientId !== session.userId) {
      return { success: false, error: "Follow-up appointment was not found." };
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: "PENDING",
        scheduledAt: requestedDate,
        notes: [
          consultation.notes,
          `Patient requested rescheduling to ${requestedDate.toISOString()} on ${new Date().toISOString()}. Doctor review required.`,
        ].filter(Boolean).join("\n"),
      },
    });

    revalidatePath("/patient/dashboard");
    revalidatePath("/doctor/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.warn("Prisma requestFollowUpReschedule failed, falling back to mock JSON database:", getErrorMessage(error, "Unknown error"));
    return requestMockFollowUpReschedule(data);
  }
}

async function bookMockAppointment(data: BookAppointmentPayload) {
  try {
    const session = await requirePatientSession();
    const { doctorId, scheduledAt, reason } = data;

    if (!doctorId || !scheduledAt || !reason) {
      return { success: false, error: "Doctor, date/time, and reason are required." };
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return { success: false, error: "Please provide a valid appointment date and time." };
    }

    const doctor = mockDb.findDoctorById(doctorId);
    if (!doctor) {
      return { success: false, error: "Selected doctor is not available." };
    }

    if (!isWithinDoctorAvailability(scheduledDate, DEFAULT_DURATION_MINUTES, doctor)) {
      return { success: false, error: getOutsideAvailabilityMessage(doctor.availability) };
    }

    const conflict = getScheduleConflict(mockDb.getBookingsForDoctor(doctorId), scheduledDate, DEFAULT_DURATION_MINUTES);
    if (conflict) {
      return { success: false, error: getFullyBookedMessage() };
    }

    const consultation = mockDb.createConsultation({
      patientId: session.userId,
      doctorId,
      scheduledAt: scheduledDate,
      reason,
      status: "PENDING",
      duration: DEFAULT_DURATION_MINUTES,
    });

    revalidatePath("/patient/dashboard");
    return { success: true, consultation };
  } catch (mockErr) {
    console.error("Appointment booking mock fallback failed:", mockErr);
    return { success: false, error: "Clinical reservation system failed. Please try again." };
  }
}

async function confirmMockFollowUpAppointment(consultationId: string) {
  try {
    const session = await requirePatientSession();
    const existing = mockDb.getBookingsForPatient(session.userId).find((booking) => booking.id === consultationId);

    if (!existing) {
      return { success: false, error: "Follow-up appointment was not found." };
    }

    if (existing.status !== "PENDING" || !existing.notes?.includes("Follow-up requested by doctor")) {
      return { success: false, error: "Only pending doctor follow-ups can be confirmed here." };
    }

    const updated = mockDb.updateConsultation(consultationId, {
      status: "CONFIRMED",
      notes: [existing.notes, "Patient confirmed this follow-up appointment."].filter(Boolean).join("\n"),
    });

    revalidatePath("/patient/dashboard");
    revalidatePath("/doctor/dashboard");
    return { success: true, consultation: updated };
  } catch (mockErr) {
    console.error("Follow-up confirmation mock fallback failed:", mockErr);
    return { success: false, error: "Could not confirm follow-up appointment." };
  }
}

async function requestMockFollowUpReschedule(data: FollowUpReschedulePayload) {
  try {
    const session = await requirePatientSession();
    const { consultationId, requestedScheduledAt } = data;
    const requestedDate = new Date(requestedScheduledAt);

    if (Number.isNaN(requestedDate.getTime()) || requestedDate <= new Date()) {
      return { success: false, error: "Choose a valid future date and time for the reschedule request." };
    }

    const existing = mockDb.getBookingsForPatient(session.userId).find((booking) => booking.id === consultationId);

    if (!existing) {
      return { success: false, error: "Follow-up appointment was not found." };
    }

    const updated = mockDb.updateConsultation(consultationId, {
      status: "PENDING",
      scheduledAt: requestedDate.toISOString(),
      notes: [
        existing.notes,
        `Patient requested rescheduling to ${requestedDate.toISOString()} on ${new Date().toISOString()}. Doctor review required.`,
      ].filter(Boolean).join("\n"),
    });

    revalidatePath("/patient/dashboard");
    revalidatePath("/doctor/dashboard");
    return { success: true, consultation: updated };
  } catch (mockErr) {
    console.error("Follow-up reschedule mock fallback failed:", mockErr);
    return { success: false, error: "Could not request follow-up rescheduling." };
  }
}
