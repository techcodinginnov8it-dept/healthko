import { getDoctorDashboardData } from "@/lib/dal/doctor";
import { getDoctorsList } from "@/app/actions/patient";
import type { DoctorModuleId } from "@/lib/dashboard/types";
import DoctorDashboardClient from "./DoctorDashboardClient";

const DOCTOR_MODULES = [
  "overview",
  "live",
  "patients",
  "schedule",
  "notes",
  "prescriptions",
  "messages",
  "notifications",
  "analytics",
  "settings",
] as const satisfies readonly DoctorModuleId[];

function getInitialModule(moduleParam?: string | string[]) {
  const moduleValue = Array.isArray(moduleParam) ? moduleParam[0] : moduleParam;
  return moduleValue && DOCTOR_MODULES.includes(moduleValue as DoctorModuleId)
    ? (moduleValue as DoctorModuleId)
    : "overview";
}

export default async function DoctorDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ module?: string | string[] }>;
}) {
  const { doctor } = await getDoctorDashboardData();
  const doctorsRes = await getDoctorsList();
  const params = await searchParams;
  const initialModule = getInitialModule(params?.module);

  // Serialize models correctly for client component boundary
  const serializedDoctor = {
    ...doctor,
    bookings: doctor.bookings
      .filter((booking) => booking.patient !== null && booking.patient !== undefined)
      .map((booking) => ({
        ...booking,
        scheduledAt: new Date(booking.scheduledAt),
        createdAt: new Date(booking.createdAt),
        patient: {
          id: booking.patient!.id,
          firstName: booking.patient!.firstName,
          lastName: booking.patient!.lastName,
          email: booking.patient!.email,
          image: booking.patient!.image ?? null,
          phone: booking.patient!.phone,
          countryCode: booking.patient!.countryCode ?? "+1",
          dob: booking.patient!.dob,
          gender: booking.patient!.gender,
          address: booking.patient!.address ?? null,
          city: booking.patient!.city ?? null,
          state: booking.patient!.state ?? null,
          zipCode: booking.patient!.zipCode ?? null,
          country: booking.patient!.country ?? null,
          height: booking.patient!.height ?? null,
          weight: booking.patient!.weight ?? null,
          bloodType: booking.patient!.bloodType ?? null,
          allergies: booking.patient!.allergies ?? null,
          existingConditions: booking.patient!.existingConditions ?? null,
          currentMedications: booking.patient!.currentMedications ?? null,
          emergencyContactName: booking.patient!.emergencyContactName ?? null,
          emergencyContactPhone: booking.patient!.emergencyContactPhone ?? null,
          emergencyContactRelation: booking.patient!.emergencyContactRelation ?? null,
          emailVerified: booking.patient!.emailVerified,
        },
      })),
  };

  const doctors = (doctorsRes.success ? doctorsRes.doctors || [] : [])
    .filter((candidate) => candidate.id !== doctor.id)
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      npi: candidate.npi,
      specialty: candidate.specialty,
      bio: candidate.bio,
      image: candidate.image,
      availability: candidate.availability,
      status: candidate.status,
      consultFee: candidate.consultFee !== null ? Number(candidate.consultFee) : null,
      rating: candidate.rating,
      reviewCount: candidate.reviewCount,
      isVerified: candidate.isVerified,
      licenseNumber: candidate.licenseNumber,
      licenseState: candidate.licenseState,
      yearsExp: candidate.yearsExp,
    }));

  return <DoctorDashboardClient doctor={serializedDoctor} doctors={doctors} initialModule={initialModule} />;
}
