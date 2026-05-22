"use server";

import { getErrorMessage } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export async function submitDoctorAudit(data: {
  npi: string;
  licenseNumber: string;
  licenseState: string;
  specialty: string;
  medicalSchool: string;
  gradYear: number;
  yearsExp: number;
  documentName?: string;
  signature: string;
  consent: boolean;
  doctorEmail?: string;
}) {
  try {
    const {
      npi,
      licenseNumber,
      licenseState,
      specialty,
      medicalSchool,
      gradYear,
      yearsExp,
      documentName,
      signature,
      consent,
      doctorEmail,
    } = data;

    // Validate parameters
    if (!npi || npi.length !== 10 || isNaN(Number(npi))) {
      return { success: false, error: "NPI must be a valid 10-digit number" };
    }
    if (!licenseNumber || !licenseState) {
      return { success: false, error: "License number and issuing state are required" };
    }
    if (!specialty) {
      return { success: false, error: "Specialty is required" };
    }
    if (!medicalSchool || !gradYear || !yearsExp) {
      return { success: false, error: "Medical credentials are incomplete" };
    }
    if (!signature || !consent) {
      return { success: false, error: "Legal consent and digital signature are required" };
    }

    // Try to find the doctor using either the provided email or NPI
    let linkedDoctorId: string | null = null;
    if (doctorEmail) {
      const doc = await prisma.doctor.findUnique({ where: { email: doctorEmail } });
      if (doc) linkedDoctorId = doc.id;
    }
    if (!linkedDoctorId) {
      const doc = await prisma.doctor.findUnique({ where: { npi } });
      if (doc) linkedDoctorId = doc.id;
    }

    // Create the credentials audit record in the database
    const audit = await prisma.doctorAudit.create({
      data: {
        npi,
        licenseNumber,
        licenseState,
        specialty,
        medicalSchool,
        gradYear: Number(gradYear),
        yearsExp: Number(yearsExp),
        documentName: documentName || null,
        signature,
        consent,
        status: "PENDING",
        doctorId: linkedDoctorId,
      },
    });

    // If a doctor is linked, update their profile flags to reflect that credentials are under audit
    if (linkedDoctorId) {
      await prisma.doctor.update({
        where: { id: linkedDoctorId },
        data: {
          licenseNumber,
          licenseState,
          yearsExp: Number(yearsExp),
          specialty,
          isVerified: false, // Reset verification status during audit
        },
      });
    }

    return {
      success: true,
      auditId: audit.id,
      status: audit.status,
      linked: !!linkedDoctorId,
    };
  } catch (error: unknown) {
    console.error("Credentials Audit Error:", error);
    return {
      success: false,
      error: getErrorMessage(error, "Failed to submit credential audit details"),
    };
  }
}
