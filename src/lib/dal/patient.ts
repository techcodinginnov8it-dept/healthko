import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requirePatientSession } from "@/lib/auth/patient-session";
import { mockDb } from "@/lib/mockDb";

export const getPatientDashboardData = cache(async () => {
  const session = await requirePatientSession();

  try {
    const patient = await prisma.patient.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        countryCode: true,
        dob: true,
        gender: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        country: true,
        emailVerified: true,
        createdAt: true,
        bookings: {
          orderBy: { scheduledAt: "asc" },
          select: {
            id: true,
            scheduledAt: true,
            status: true,
            reason: true,
            duration: true,
            prescription: true,
            createdAt: true,
            doctor: {
              select: {
                name: true,
                specialty: true,
              },
            },
          },
        },
      },
    });

    if (!patient) {
      redirect("/signin");
    }

    return {
      session,
      patient,
    };
  } catch (error) {
    console.warn("Prisma getPatientDashboardData failed, falling back to mock JSON database:", error);
    try {
      const patientData = mockDb.findPatientById(session.userId);
      if (!patientData) {
        redirect("/signin");
      }

      const bookings = mockDb.getBookingsForPatient(session.userId);

      return {
        session,
        patient: {
          id: patientData.id,
          firstName: patientData.firstName,
          lastName: patientData.lastName,
          email: patientData.email,
          phone: patientData.phone,
          countryCode: patientData.countryCode,
          dob: patientData.dob,
          gender: patientData.gender,
          address: patientData.address ?? null,
          city: patientData.city ?? null,
          state: patientData.state ?? null,
          zipCode: patientData.zipCode ?? null,
          country: patientData.country ?? null,
          emailVerified: patientData.emailVerified,
          createdAt: new Date(patientData.createdAt),
          bookings,
        },
      };
    } catch (mockErr) {
      console.error("Patient DAL Mock DB critical failure:", mockErr);
      redirect("/signin");
    }
  }
});
