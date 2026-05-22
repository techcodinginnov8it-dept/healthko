"use server";

import { createHmac, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getDoctorSession, requireDoctorSession } from "@/lib/auth/doctor-session";
import { getPatientSession, requirePatientSession } from "@/lib/auth/patient-session";
import { mockDb } from "@/lib/mockDb";

type VideoSessionResult = {
  success: boolean;
  error?: string;
  roomId?: string;
  accessToken?: string;
};

function getSessionSecret() {
  return process.env.SESSION_SECRET || "healthko-dev-session-secret";
}

function signRoomAccess(payload: {
  consultationId: string;
  roomId: string;
  role: "doctor" | "patient";
  userId: string;
}) {
  const exp = Date.now() + 1000 * 60 * 90;
  const body = Buffer.from(JSON.stringify({ ...payload, exp }), "utf8").toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function createRoomId(consultationId: string) {
  return `healthko-${consultationId}-${randomBytes(8).toString("hex")}`;
}

export async function startVideoSession(consultationId: string): Promise<VideoSessionResult> {
  try {
    const session = await requireDoctorSession();
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { id: true, doctorId: true, status: true },
    });

    if (!consultation || consultation.doctorId !== session.userId || consultation.status !== "CONFIRMED") {
      return { success: false, error: "Only the assigned doctor can start a confirmed consultation." };
    }

    const existing = await prisma.videoSession.findUnique({
      where: { consultationId },
      select: { roomId: true },
    });
    const roomId = existing?.roomId || createRoomId(consultationId);

    await prisma.videoSession.upsert({
      where: { consultationId },
      update: { status: "STARTED", startedAt: new Date(), roomId },
      create: { consultationId, status: "STARTED", startedAt: new Date(), roomId },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return {
      success: true,
      roomId,
      accessToken: signRoomAccess({ consultationId, roomId, role: "doctor", userId: session.userId }),
    };
  } catch (error: unknown) {
    console.warn("Prisma startVideoSession failed, using mock video session fallback:", error);
    try {
      const session = await requireDoctorSession();
      const existing = mockDb.getBookingsForDoctor(session.userId).find((booking) => booking.id === consultationId);

      if (!existing || existing.status !== "CONFIRMED") {
        return { success: false, error: "Only the assigned doctor can start a confirmed consultation." };
      }

      const videoSession = mockDb.startVideoSession(consultationId, createRoomId(consultationId));
      return {
        success: true,
        roomId: videoSession.roomId,
        accessToken: signRoomAccess({ consultationId, roomId: videoSession.roomId, role: "doctor", userId: session.userId }),
      };
    } catch (mockErr) {
      console.error("Mock startVideoSession failed:", mockErr);
      return { success: false, error: "Could not start the secure video session." };
    }
  }
}

export async function authorizePatientVideoSession(consultationId: string): Promise<VideoSessionResult> {
  try {
    const session = await requirePatientSession();
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      select: {
        id: true,
        patientId: true,
        status: true,
        videoSession: { select: { roomId: true, status: true } },
      },
    });

    if (
      !consultation ||
      consultation.patientId !== session.userId ||
      consultation.status !== "CONFIRMED" ||
      consultation.videoSession?.status !== "STARTED"
    ) {
      return { success: false, error: "The doctor has not started this consultation yet." };
    }

    return {
      success: true,
      roomId: consultation.videoSession.roomId,
      accessToken: signRoomAccess({
        consultationId,
        roomId: consultation.videoSession.roomId,
        role: "patient",
        userId: session.userId,
      }),
    };
  } catch (error: unknown) {
    console.warn("Prisma authorizePatientVideoSession failed, using mock fallback:", error);
    try {
      const session = await requirePatientSession();
      const existing = mockDb.getBookingsForPatient(session.userId).find((booking) => booking.id === consultationId);

      const videoSession = mockDb.findVideoSessionByConsultation(consultationId);

      if (!existing || existing.status !== "CONFIRMED" || videoSession?.status !== "STARTED") {
        return { success: false, error: "The doctor has not started this consultation yet." };
      }

      return {
        success: true,
        roomId: videoSession.roomId,
        accessToken: signRoomAccess({ consultationId, roomId: videoSession.roomId, role: "patient", userId: session.userId }),
      };
    } catch (mockErr) {
      console.error("Mock authorizePatientVideoSession failed:", mockErr);
      return { success: false, error: "Could not authorize secure room access." };
    }
  }
}

export async function endVideoSession(consultationId: string): Promise<{ success: boolean; error?: string }> {
  const endedAt = new Date();

  try {
    const [doctorSession, patientSession] = await Promise.all([getDoctorSession(), getPatientSession()]);
    const userId = doctorSession?.userId || patientSession?.userId;
    const role = doctorSession?.role || patientSession?.role;

    if (!userId || !role) {
      return { success: false, error: "Authenticated session required." };
    }

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { doctorId: true, patientId: true },
    });

    if (!consultation || (consultation.doctorId !== userId && consultation.patientId !== userId)) {
      return { success: false, error: "Consultation not found or unauthorized access." };
    }

    await prisma.videoSession.updateMany({
      where: { consultationId },
      data: { status: "ENDED", endedAt },
    });

    revalidatePath("/doctor/dashboard");
    revalidatePath("/patient/dashboard");
    return { success: true };
  } catch (error: unknown) {
    console.warn("Prisma endVideoSession failed, using mock fallback:", error);
    try {
      const doctorSession = await getDoctorSession();
      const patientSession = await getPatientSession();
      const userId = doctorSession?.userId || patientSession?.userId;

      if (!userId) {
        return { success: false, error: "Authenticated session required." };
      }

      mockDb.endVideoSession(consultationId);
      return { success: true };
    } catch (mockErr) {
      console.error("Mock endVideoSession failed:", mockErr);
      return { success: false, error: "Could not end the secure video session." };
    }
  }
}
