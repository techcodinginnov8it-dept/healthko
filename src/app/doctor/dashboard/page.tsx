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
          phone: booking.patient!.phone,
          dob: booking.patient!.dob,
          gender: booking.patient!.gender,
          address: booking.patient!.address ?? null,
          city: booking.patient!.city ?? null,
          state: booking.patient!.state ?? null,
          zipCode: booking.patient!.zipCode ?? null,
          country: booking.patient!.country ?? null,
          emailVerified: booking.patient!.emailVerified,
        },
      })),
  };

  const doctors = (doctorsRes.success ? doctorsRes.doctors || [] : [])
    .filter((candidate) => candidate.id !== doctor.id)
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      specialty: candidate.specialty,
      availability: candidate.availability,
      consultFee: candidate.consultFee !== null ? Number(candidate.consultFee) : null,
    }));

  return <DoctorDashboardClient doctor={serializedDoctor} doctors={doctors} initialModule={initialModule} />;
}
