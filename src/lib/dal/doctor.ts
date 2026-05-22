import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireDoctorSession } from "@/lib/auth/doctor-session";
import { mockDb } from "@/lib/mockDb";

export const getDoctorDashboardData = cache(async () => {
  const session = await requireDoctorSession();

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        npi: true,
        specialty: true,
        bio: true,
        image: true,
        licenseNumber: true,
        licenseState: true,
        yearsExp: true,
        consultFee: true,
        rating: true,
        reviewCount: true,
        availability: true,
        isVerified: true,
        createdAt: true,
        bookings: {
          orderBy: { scheduledAt: "asc" },
          select: {
            id: true,
            scheduledAt: true,
            status: true,
            reason: true,
            notes: true,
            prescription: true,
            duration: true,
            createdAt: true,
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                dob: true,
                gender: true,
                address: true,
                city: true,
                state: true,
                zipCode: true,
                country: true,
                emailVerified: true,
              },
            },
          },
        },
        audits: {
          orderBy: { submittedAt: "desc" },
          take: 5,
          select: {
            id: true,
            status: true,
            submittedAt: true,
            updatedAt: true,
            licenseNumber: true,
            licenseState: true,
          },
        },
      },
    });

    if (!doctor) {
      redirect("/doctor/signin");
    }

    return {
      session,
      doctor,
    };
  } catch (error) {
    console.warn("Prisma getDoctorDashboardData failed, falling back to mock JSON database:", error);
    try {
      const doctorData = mockDb.findDoctorById(session.userId);
      if (!doctorData) {
        redirect("/doctor/signin");
      }

      const bookings = mockDb.getBookingsForDoctor(session.userId);

      return {
        session,
        doctor: {
          id: doctorData.id,
          name: doctorData.name,
          email: doctorData.email,
          npi: doctorData.npi,
          specialty: doctorData.specialty,
          bio: doctorData.bio,
          image: doctorData.image,
          licenseNumber: doctorData.licenseNumber ?? null,
          licenseState: doctorData.licenseState ?? null,
          yearsExp: doctorData.yearsExp ?? null,
          consultFee: doctorData.consultFee,
          rating: doctorData.rating,
          reviewCount: doctorData.reviewCount,
          availability: doctorData.availability,
          isVerified: doctorData.isVerified,
          createdAt: new Date(doctorData.createdAt),
          bookings,
          audits: [],
        },
      };
    } catch (mockErr) {
      console.error("Doctor DAL Mock DB critical failure:", mockErr);
      redirect("/doctor/signin");
    }
  }
});
