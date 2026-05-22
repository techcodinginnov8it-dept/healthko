import { getPatientDashboardData } from "@/lib/dal/patient";
import { getDoctorsList } from "@/app/actions/patient";
import type { PatientModuleId } from "@/lib/dashboard/types";
import PatientDashboardClient from "./PatientDashboardClient";

const PATIENT_MODULES = [
  "overview",
  "book",
  "live",
  "history",
  "prescriptions",
  "doctors",
  "messages",
  "notifications",
  "billing",
  "settings",
] as const satisfies readonly PatientModuleId[];

function getInitialModule(moduleParam?: string | string[]) {
  const moduleValue = Array.isArray(moduleParam) ? moduleParam[0] : moduleParam;
  return moduleValue && PATIENT_MODULES.includes(moduleValue as PatientModuleId)
    ? (moduleValue as PatientModuleId)
    : "overview";
}

export default async function PatientDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ module?: string | string[] }>;
}) {
  const { patient } = await getPatientDashboardData();
  const doctorsRes = await getDoctorsList();
  const params = await searchParams;
  const initialModule = getInitialModule(params?.module);
  
  const doctors = doctorsRes.success ? doctorsRes.doctors || [] : [];

  // Convert Date objects to serialized format for Client Component if needed,
  // next.js 16 handles Date objects in Server Actions/Props safely, but let's make sure types match.
  const serializedPatient = {
    ...patient,
    bookings: patient.bookings.map((booking) => ({
      ...booking,
      scheduledAt: new Date(booking.scheduledAt),
      createdAt: new Date(booking.createdAt),
    })),
  };

  const serializedDoctors = doctors.map((doc) => ({
    id: doc.id,
    name: doc.name,
    specialty: doc.specialty,
    availability: doc.availability,
    consultFee: doc.consultFee !== null ? Number(doc.consultFee) : null,
  }));

  return (
    <PatientDashboardClient
      patient={serializedPatient}
      doctors={serializedDoctors}
      initialModule={initialModule}
    />
  );
}
