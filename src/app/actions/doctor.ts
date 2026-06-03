"use server";

import { revalidatePath } from "next/cache";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { requireDoctorSession } from "@/lib/auth/doctor-session";
import { mockDb } from "@/lib/mockDb";
import {
  DEFAULT_DURATION_MINUTES,
  getFullyBookedMessage,
  getOutsideAvailabilityMessage,
  getScheduleConflict,
  isWithinDoctorAvailability,
} from "@/lib/scheduling";

async function validatePrismaDoctorSchedule({
  doctorId,
  scheduledAt,
  durationMinutes = DEFAULT_DURATION_MINUTES,
  excludeAppointmentId,
}: {
  doctorId: string;
  scheduledAt: Date;
  durationMinutes?: number;
  excludeAppointmentId?: string;
}) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { availability: true },
  });

  if (!doctor) {
    return "Doctor schedule was not found.";
  }

  if (!isWithinDoctorAvailability(scheduledAt, durationMinutes, doctor)) {
    return getOutsideAvailabilityMessage(doctor.availability);
  }

  const confirmedAppointments = await prisma.consultation.findMany({
    where: { doctorId, status: "CONFIRMED" },
    select: { id: true, scheduledAt: true, duration: true, status: true },
  });

  const conflict = getScheduleConflict(confirmedAppointments, scheduledAt, durationMinutes, excludeAppointmentId);
  return conflict ? getFullyBookedMessage() : "";
}

function validateMockDoctorSchedule({
  doctorId,
  scheduledAt,
  durationMinutes = DEFAULT_DURATION_MINUTES,
  excludeAppointmentId,
}: {
  doctorId: string;
  scheduledAt: Date;
  durationMinutes?: number;
  excludeAppointmentId?: string;
}) {
  const doctor = mockDb.findDoctorById(doctorId);

  if (!doctor) {
    return "Doctor schedule was not found.";
  }

  if (!isWithinDoctorAvailability(scheduledAt, durationMinutes, doctor)) {
    return getOutsideAvailabilityMessage(doctor.availability);
  }

  const conflict = getScheduleConflict(
    mockDb.getBookingsForDoctor(doctorId),
    scheduledAt,
    durationMinutes,
    excludeAppointmentId
  );

  return conflict ? getFullyBookedMessage() : "";
}

export async function acceptAppointment(consultationId: string) {
  try {
    const session = await requireDoctorSession();

    if (!isPrismaConfigured()) {
      const existing = mockDb.getBookingsForDoctor(session.userId).find((c) => c.id === consultationId);

      if (!existing) {
        return { success: false, error: "Consultation not found or unauthorized access." };
      }

      const scheduleError = validateMockDoctorSchedule({
        doctorId: session.userId,
        scheduledAt: new Date(existing.scheduledAt),
        durationMinutes: existing.duration || DEFAULT_DURATION_MINUTES,
        excludeAppointmentId: consultationId,
      });

      if (scheduleError) {
        return { success: false, error: scheduleError };
      }

      const updated = mockDb.updateConsultation(consultationId, { status: "CONFIRMED" });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation: updated };
    }

    // Verify ownership in Prisma
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation || consultation.doctorId !== session.userId) {
      return { success: false, error: "Consultation not found or unauthorized access." };
    }

    const scheduleError = await validatePrismaDoctorSchedule({
      doctorId: session.userId,
      scheduledAt: consultation.scheduledAt,
      durationMinutes: consultation.duration || DEFAULT_DURATION_MINUTES,
      excludeAppointmentId: consultationId,
    });

    if (scheduleError) {
      return { success: false, error: scheduleError };
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: { status: "CONFIRMED" },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.warn("Prisma acceptAppointment failed, falling back to mock JSON database:", error);
    try {
      const session = await requireDoctorSession();
      const existing = mockDb.getBookingsForDoctor(session.userId).find((c) => c.id === consultationId);

      if (!existing) {
        return { success: false, error: "Consultation not found or unauthorized access." };
      }

      const scheduleError = validateMockDoctorSchedule({
        doctorId: session.userId,
        scheduledAt: new Date(existing.scheduledAt),
        durationMinutes: existing.duration || DEFAULT_DURATION_MINUTES,
        excludeAppointmentId: consultationId,
      });

      if (scheduleError) {
        return { success: false, error: scheduleError };
      }

      const updated = mockDb.updateConsultation(consultationId, { status: "CONFIRMED" });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation: updated };
    } catch (mockErr) {
      console.error("Failed to accept appointment in mock fallback:", mockErr);
      return { success: false, error: "System failed to approve consultation request." };
    }
  }
}

export async function cancelAppointment(consultationId: string) {
  try {
    const session = await requireDoctorSession();

    // Verify ownership in Prisma
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation || consultation.doctorId !== session.userId) {
      return { success: false, error: "Consultation not found or unauthorized access." };
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: { status: "CANCELLED" },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.warn("Prisma cancelAppointment failed, falling back to mock JSON database:", error);
    try {
      const session = await requireDoctorSession();
      const existing = mockDb.getBookingsForDoctor(session.userId).find((c) => c.id === consultationId);

      if (!existing) {
        return { success: false, error: "Consultation not found or unauthorized access." };
      }

      const updated = mockDb.updateConsultation(consultationId, { status: "CANCELLED" });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation: updated };
    } catch (mockErr) {
      console.error("Failed to cancel appointment in mock fallback:", mockErr);
      return { success: false, error: "System failed to cancel consultation request." };
    }
  }
}

type CompleteConsultationPayload = {
  consultationId: string;
  notes: string;
  prescription: string;
  reason?: string; // Diagnosis
};

type RescheduleAppointmentPayload = {
  consultationId: string;
  scheduledAt: string;
};

type ScheduleFollowUpPayload = {
  patientId: string;
  scheduledAt: string;
  reason: string;
};

type ReferAppointmentPayload = {
  consultationId: string;
  targetDoctorId: string;
  note?: string;
};

export async function completeConsultation(data: CompleteConsultationPayload) {
  try {
    const session = await requireDoctorSession();
    const { consultationId, notes, prescription, reason } = data;

    // Verify ownership in Prisma
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation || consultation.doctorId !== session.userId) {
      return { success: false, error: "Consultation not found or unauthorized access." };
    }

    const updated = await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: "COMPLETED",
        notes,
        prescription,
        reason: reason || consultation.reason,
      },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.warn("Prisma completeConsultation failed, falling back to mock JSON database:", error);
    try {
      const session = await requireDoctorSession();
      const { consultationId, notes, prescription, reason } = data;

      const existing = mockDb.getBookingsForDoctor(session.userId).find((c) => c.id === consultationId);
      if (!existing) {
        return { success: false, error: "Consultation not found or unauthorized access." };
      }

      const updated = mockDb.updateConsultation(consultationId, {
        status: "COMPLETED",
        notes,
        prescription,
        reason: reason || existing.reason,
      });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation: updated };
    } catch (mockErr) {
      console.error("Failed to complete consultation in mock fallback:", mockErr);
      return { success: false, error: "Clinical documentation upload failed." };
    }
  }
}

export async function rescheduleAppointment(data: RescheduleAppointmentPayload) {
  try {
    const session = await requireDoctorSession();
    const scheduledAt = new Date(data.scheduledAt);

    if (!data.consultationId || Number.isNaN(scheduledAt.getTime()) || scheduledAt < new Date()) {
      return { success: false, error: "Choose a valid future consultation time." };
    }

    if (!isPrismaConfigured()) {
      const existing = mockDb.getBookingsForDoctor(session.userId).find((c) => c.id === data.consultationId);

      if (!existing) {
        return { success: false, error: "Consultation not found or invalid appointment time." };
      }

      const scheduleError = validateMockDoctorSchedule({
        doctorId: session.userId,
        scheduledAt,
        durationMinutes: existing.duration || DEFAULT_DURATION_MINUTES,
        excludeAppointmentId: data.consultationId,
      });

      if (scheduleError) {
        return { success: false, error: scheduleError };
      }

      const updated = mockDb.updateConsultation(data.consultationId, {
        scheduledAt: scheduledAt.toISOString(),
        status: existing.status === "PENDING" ? "CONFIRMED" : existing.status,
      });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation: updated };
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: data.consultationId },
    });

    if (!consultation || consultation.doctorId !== session.userId) {
      return { success: false, error: "Consultation not found or unauthorized access." };
    }

    const scheduleError = await validatePrismaDoctorSchedule({
      doctorId: session.userId,
      scheduledAt,
      durationMinutes: consultation.duration || DEFAULT_DURATION_MINUTES,
      excludeAppointmentId: data.consultationId,
    });

    if (scheduleError) {
      return { success: false, error: scheduleError };
    }

    const updated = await prisma.consultation.update({
      where: { id: data.consultationId },
      data: {
        scheduledAt,
        status: consultation.status === "PENDING" ? "CONFIRMED" : consultation.status,
      },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation: updated };
  } catch (error: unknown) {
    console.warn("Prisma rescheduleAppointment failed, falling back to mock JSON database:", error);
    try {
      const session = await requireDoctorSession();
      const scheduledAt = new Date(data.scheduledAt);
      const existing = mockDb.getBookingsForDoctor(session.userId).find((c) => c.id === data.consultationId);

      if (!existing || Number.isNaN(scheduledAt.getTime())) {
        return { success: false, error: "Consultation not found or invalid appointment time." };
      }

      const scheduleError = validateMockDoctorSchedule({
        doctorId: session.userId,
        scheduledAt,
        durationMinutes: existing.duration || DEFAULT_DURATION_MINUTES,
        excludeAppointmentId: data.consultationId,
      });

      if (scheduleError) {
        return { success: false, error: scheduleError };
      }

      const updated = mockDb.updateConsultation(data.consultationId, {
        scheduledAt: scheduledAt.toISOString(),
        status: existing.status === "PENDING" ? "CONFIRMED" : existing.status,
      });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation: updated };
    } catch (mockErr) {
      console.error("Failed to reschedule appointment in mock fallback:", mockErr);
      return { success: false, error: "System failed to reschedule consultation." };
    }
  }
}

export async function scheduleFollowUpAppointment(data: ScheduleFollowUpPayload) {
  try {
    const session = await requireDoctorSession();
    const scheduledAt = new Date(data.scheduledAt);
    const reason = data.reason.trim();

    if (!data.patientId || !reason || Number.isNaN(scheduledAt.getTime()) || scheduledAt < new Date()) {
      return { success: false, error: "Choose a patient, future time, and follow-up reason." };
    }

    if (!isPrismaConfigured()) {
      const patientHistory = mockDb
        .getBookingsForDoctor(session.userId)
        .some((booking) => booking.patient?.id === data.patientId);

      if (!patientHistory) {
        return { success: false, error: "Follow-up scheduling is only available for existing patients." };
      }

      const scheduleError = validateMockDoctorSchedule({
        doctorId: session.userId,
        scheduledAt,
      });

      if (scheduleError) {
        return { success: false, error: scheduleError };
      }

      const consultation = mockDb.createConsultation({
        patientId: data.patientId,
        doctorId: session.userId,
        scheduledAt,
        reason,
        status: "PENDING",
        duration: DEFAULT_DURATION_MINUTES,
      });
      mockDb.updateConsultation(consultation.id, {
        notes: "Follow-up requested by doctor. Awaiting patient confirmation.",
      });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation };
    }

    const patientHistory = await prisma.consultation.findFirst({
      where: {
        patientId: data.patientId,
        doctorId: session.userId,
      },
      select: { id: true },
    });

    if (!patientHistory) {
      return { success: false, error: "Follow-up scheduling is only available for existing patients." };
    }

    const scheduleError = await validatePrismaDoctorSchedule({
      doctorId: session.userId,
      scheduledAt,
    });

    if (scheduleError) {
      return { success: false, error: scheduleError };
    }

    const consultation = await prisma.consultation.create({
      data: {
        patientId: data.patientId,
        doctorId: session.userId,
        scheduledAt,
        reason,
        status: "PENDING",
        notes: "Follow-up requested by doctor. Awaiting patient confirmation.",
        duration: DEFAULT_DURATION_MINUTES,
      },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation };
  } catch (error: unknown) {
    console.warn("Prisma scheduleFollowUpAppointment failed, falling back to mock JSON database:", error);
    try {
      const session = await requireDoctorSession();
      const scheduledAt = new Date(data.scheduledAt);
      const reason = data.reason.trim();

      if (!data.patientId || !reason || Number.isNaN(scheduledAt.getTime())) {
        return { success: false, error: "Choose a patient, future time, and follow-up reason." };
      }

      const patientHistory = mockDb
        .getBookingsForDoctor(session.userId)
        .some((booking) => booking.patient?.id === data.patientId);

      if (!patientHistory) {
        return { success: false, error: "Follow-up scheduling is only available for existing patients." };
      }

      const scheduleError = validateMockDoctorSchedule({
        doctorId: session.userId,
        scheduledAt,
      });

      if (scheduleError) {
        return { success: false, error: scheduleError };
      }

      const consultation = mockDb.createConsultation({
        patientId: data.patientId,
        doctorId: session.userId,
        scheduledAt,
        reason,
        status: "PENDING",
        duration: DEFAULT_DURATION_MINUTES,
      });
      mockDb.updateConsultation(consultation.id, {
        notes: "Follow-up requested by doctor. Awaiting patient confirmation.",
      });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation };
    } catch (mockErr) {
      console.error("Failed to schedule follow-up in mock fallback:", mockErr);
      return { success: false, error: "System failed to schedule follow-up consultation." };
    }
  }
}

export async function referAppointment(data: ReferAppointmentPayload) {
  try {
    const session = await requireDoctorSession();

    if (!data.consultationId || !data.targetDoctorId || data.targetDoctorId === session.userId) {
      return { success: false, error: "Choose another doctor for referral." };
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: data.consultationId },
    });

    if (!consultation || consultation.doctorId !== session.userId) {
      return { success: false, error: "Consultation not found or unauthorized access." };
    }

    const targetDoctor = await prisma.doctor.findUnique({
      where: { id: data.targetDoctorId },
      select: { id: true, name: true, specialty: true, isActive: true },
    });

    if (!targetDoctor?.isActive) {
      return { success: false, error: "Recommended doctor is not available." };
    }

    await prisma.consultation.update({
      where: { id: data.consultationId },
      data: {
        status: "CANCELLED",
        notes: [consultation.notes, `Referred to ${targetDoctor.name} (${targetDoctor.specialty}). ${data.note || ""}`]
          .filter(Boolean)
          .join("\n"),
      },
    });

    const referred = await prisma.consultation.create({
      data: {
        patientId: consultation.patientId,
        doctorId: data.targetDoctorId,
        scheduledAt: consultation.scheduledAt,
        reason: consultation.reason,
        duration: consultation.duration,
        status: "PENDING",
      },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true, consultation: referred, targetDoctor };
  } catch (error: unknown) {
    console.warn("Prisma referAppointment failed, falling back to mock JSON database:", error);
    try {
      const session = await requireDoctorSession();
      const existing = mockDb.getBookingsForDoctor(session.userId).find((c) => c.id === data.consultationId);
      const targetDoctor = mockDb.findDoctorById(data.targetDoctorId);

      if (!existing?.patient || !targetDoctor || data.targetDoctorId === session.userId) {
        return { success: false, error: "Consultation or recommended doctor was not found." };
      }

      mockDb.updateConsultation(data.consultationId, {
        status: "CANCELLED",
        notes: [existing.notes, `Referred to ${targetDoctor.name} (${targetDoctor.specialty}). ${data.note || ""}`]
          .filter(Boolean)
          .join("\n"),
      });

      const referred = mockDb.createConsultation({
        patientId: existing.patient.id,
        doctorId: data.targetDoctorId,
        scheduledAt: new Date(existing.scheduledAt),
        reason: existing.reason || "Referral consultation",
        status: "PENDING",
        duration: existing.duration || 30,
      });

      revalidatePath("/doctor/dashboard");
      revalidatePath("/patient/dashboard");
      return { success: true, consultation: referred, targetDoctor };
    } catch (mockErr) {
      console.error("Failed to refer appointment in mock fallback:", mockErr);
      return { success: false, error: "System failed to create referral." };
    }
  }
}
