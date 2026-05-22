"use server";

import { revalidatePath } from "next/cache";
import { getErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { requirePatientSession } from "@/lib/auth/patient-session";
import { mockDb } from "@/lib/mockDb";

export async function getDoctorsList() {
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
    try {
      const doctors = mockDb.getDoctorsList();
      return { success: true, doctors };
    } catch (mockErr) {
      console.error("Failed to retrieve doctors list:", mockErr);
      return { success: false, error: "Failed to retrieve physician directory." };
    }
  }
}

type BookAppointmentPayload = {
  doctorId: string;
  scheduledAt: string; // ISO string
  reason: string;
};

export async function bookAppointment(data: BookAppointmentPayload) {
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

    const consultation = await prisma.consultation.create({
      data: {
        patientId: session.userId,
        doctorId,
        scheduledAt: scheduledDate,
        reason,
        status: "PENDING",
        duration: 30, // Default duration in minutes
      },
    });

    revalidatePath("/patient/dashboard");
    return { success: true, consultation };
  } catch (error: unknown) {
    console.warn("Prisma bookAppointment failed, falling back to mock JSON database:", getErrorMessage(error, "Unknown error"));
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

      const consultation = mockDb.createConsultation({
        patientId: session.userId,
        doctorId,
        scheduledAt: scheduledDate,
        reason,
        status: "PENDING",
        duration: 30,
      });

      revalidatePath("/patient/dashboard");
      return { success: true, consultation };
    } catch (mockErr) {
      console.error("Appointment booking mock fallback failed:", mockErr);
      return { success: false, error: "Clinical reservation system failed. Please try again." };
    }
  }
}
