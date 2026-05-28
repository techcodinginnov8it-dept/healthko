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
        specialty: true,
        availability: true,
        consultFee: true,
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
