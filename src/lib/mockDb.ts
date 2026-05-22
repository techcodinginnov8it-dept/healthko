import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const DB_PATH = path.join(process.cwd(), "src/lib/mock-db.json");

export type MockPatient = {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  email: string;
  countryCode: string;
  phone: string;
  dob: string;
  gender: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  password: string;
  hipaaConsent: boolean;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MockDoctor = {
  id: string;
  name: string;
  npi: string;
  email: string;
  password: string;
  specialty: string;
  bio: string | null;
  image: string | null;
  languages: string[];
  rating: number;
  reviewCount: number;
  availability: string;
  consultFee: number | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
  yearsExp?: number | null;
  isActive: boolean;
  isFeatured: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MockConsultation = {
  id: string;
  patientId: string;
  doctorId: string;
  scheduledAt: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
  reason: string | null;
  notes: string | null;
  prescription: string | null;
  duration: number;
  createdAt: string;
  updatedAt: string;
};

export type MockEmailOtp = {
  id: string;
  email: string;
  otp: string;
  purpose: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
};

export type MockVideoSession = {
  id: string;
  consultationId: string;
  status: "WAITING" | "STARTED" | "ENDED";
  roomId: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type MockDbSchema = {
  patients: MockPatient[];
  doctors: MockDoctor[];
  consultations: MockConsultation[];
  emailOtps: MockEmailOtp[];
  videoSessions?: MockVideoSession[];
};

function getDb(): MockDbSchema {
  try {
    if (!fs.existsSync(DB_PATH)) {
      // Seed data if database file does not exist
      const defaultDoctors: MockDoctor[] = [
        {
          id: "doc-sarah-jenkins-123",
          npi: "1982736450",
          email: "s.jenkins@healthko.com",
          password: bcrypt.hashSync("doctor123", 10),
          name: "Dr. Sarah Jenkins",
          specialty: "Board-Certified Cardiologist",
          rating: 4.9,
          reviewCount: 142,
          availability: "Mon - Fri, 9AM - 5PM",
          consultFee: 150,
          bio: "Dr. Sarah Jenkins is an Ivy League-educated cardiologist with over 15 years of clinical experience specializing in non-invasive cardiology and preventive health.",
          image: null,
          languages: ["English", "Spanish"],
          isActive: true,
          isFeatured: true,
          isVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "doc-marcus-vance-456",
          npi: "1098273645",
          email: "m.vance@healthko.com",
          password: bcrypt.hashSync("doctor123", 10),
          name: "Dr. Marcus Vance",
          specialty: "Pediatric Medicine Specialist",
          rating: 4.8,
          reviewCount: 98,
          availability: "Mon - Thu, 8AM - 4PM",
          consultFee: 120,
          bio: "Dr. Marcus Vance is a board-certified pediatrician dedicated to providing comprehensive healthcare for children from infancy through adolescence.",
          image: null,
          languages: ["English"],
          isActive: true,
          isFeatured: true,
          isVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "doc-aaliyah-patel-789",
          npi: "1234567890",
          email: "a.patel@healthko.com",
          password: bcrypt.hashSync("doctor123", 10),
          name: "Dr. Aaliyah Patel",
          specialty: "Family Practitioner & Telehealth Lead",
          rating: 4.9,
          reviewCount: 210,
          availability: "Tue - Sat, 10AM - 6PM",
          consultFee: 100,
          bio: "Dr. Aaliyah Patel is a passionate family physician specializing in chronic disease management and virtual healthcare delivery paradigms.",
          image: null,
          languages: ["English", "Hindi"],
          isActive: true,
          isFeatured: true,
          isVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ];

      const initialDb: MockDbSchema = {
        patients: [],
        doctors: defaultDoctors,
        consultations: [],
        emailOtps: [],
        videoSessions: [],
      };

      fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2), "utf8");
      return initialDb;
    }

    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as MockDbSchema;
    parsed.videoSessions ||= [];
    return parsed;
  } catch (error) {
    console.error("Error reading mock database, using empty state:", error);
    return { patients: [], doctors: [], consultations: [], emailOtps: [], videoSessions: [] };
  }
}

function saveDb(db: MockDbSchema) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch (error) {
    console.error("Error writing mock database to file:", error);
  }
}

export const mockDb = {
  // --- Patients ---
  findPatientByEmail(email: string): MockPatient | null {
    const db = getDb();
    return db.patients.find((p) => p.email.toLowerCase() === email.toLowerCase()) || null;
  },

  findPatientById(id: string): MockPatient | null {
    const db = getDb();
    return db.patients.find((p) => p.id === id) || null;
  },

  createPatient(data: Omit<MockPatient, "id" | "createdAt" | "updatedAt" | "isActive">): MockPatient {
    const db = getDb();
    const newPatient: MockPatient = {
      ...data,
      id: "pat-" + Math.random().toString(36).substr(2, 9),
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.patients.push(newPatient);
    saveDb(db);
    return newPatient;
  },

  updatePatient(email: string, data: Partial<MockPatient>): MockPatient | null {
    const db = getDb();
    const patientIndex = db.patients.findIndex((p) => p.email.toLowerCase() === email.toLowerCase());
    if (patientIndex === -1) return null;

    db.patients[patientIndex] = {
      ...db.patients[patientIndex],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    return db.patients[patientIndex];
  },

  updatePatientById(id: string, data: Partial<MockPatient>): MockPatient | null {
    const db = getDb();
    const patientIndex = db.patients.findIndex((p) => p.id === id);
    if (patientIndex === -1) return null;

    db.patients[patientIndex] = {
      ...db.patients[patientIndex],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    return db.patients[patientIndex];
  },

  // --- Doctors ---
  findDoctorByEmailOrNpi(emailOrNpi: string): MockDoctor | null {
    const db = getDb();
    const cleanValue = emailOrNpi.toLowerCase();
    return db.doctors.find(
      (d) => d.email.toLowerCase() === cleanValue || d.npi === emailOrNpi
    ) || null;
  },

  findDoctorById(id: string): MockDoctor | null {
    const db = getDb();
    return db.doctors.find((d) => d.id === id) || null;
  },

  updateDoctor(id: string, data: Partial<MockDoctor>): MockDoctor | null {
    const db = getDb();
    const doctorIndex = db.doctors.findIndex((d) => d.id === id);
    if (doctorIndex === -1) return null;

    db.doctors[doctorIndex] = {
      ...db.doctors[doctorIndex],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    return db.doctors[doctorIndex];
  },

  getDoctorsList(): Omit<MockDoctor, "password">[] {
    const db = getDb();
    return db.doctors
      .filter((d) => d.isActive)
      .map((doctor) => {
        const rest = { ...doctor } as Partial<MockDoctor>;
        delete rest.password;
        return rest as Omit<MockDoctor, "password">;
      });
  },

  // --- OTPs ---
  createEmailOtp(email: string, otp: string, purpose: string, expiresAt: Date) {
    const db = getDb();
    // Invalidate existing active OTPs for the same purpose
    db.emailOtps = db.emailOtps.map((record) => {
      if (record.email.toLowerCase() === email.toLowerCase() && record.purpose === purpose) {
        return { ...record, used: true };
      }
      return record;
    });

    const newOtp: MockEmailOtp = {
      id: "otp-" + Math.random().toString(36).substr(2, 9),
      email,
      otp,
      purpose,
      expiresAt: expiresAt.toISOString(),
      used: false,
      createdAt: new Date().toISOString(),
    };
    db.emailOtps.push(newOtp);
    saveDb(db);
    return newOtp;
  },

  findLatestOtp(email: string, purpose: string): MockEmailOtp | null {
    const db = getDb();
    const matching = db.emailOtps.filter(
      (record) =>
        record.email.toLowerCase() === email.toLowerCase() &&
        record.purpose === purpose &&
        !record.used
    );
    if (matching.length === 0) return null;
    // Return latest
    return matching[matching.length - 1];
  },

  markOtpAsUsed(id: string) {
    const db = getDb();
    const index = db.emailOtps.findIndex((r) => r.id === id);
    if (index !== -1) {
      db.emailOtps[index].used = true;
      saveDb(db);
    }
  },

  // --- Consultations ---
  getBookingsForPatient(patientId: string) {
    const db = getDb();
    return db.consultations
      .filter((c) => c.patientId === patientId)
      .map((c) => {
        const doctor = this.findDoctorById(c.doctorId);
        return {
          ...c,
          scheduledAt: new Date(c.scheduledAt),
          createdAt: new Date(c.createdAt),
          doctor: doctor
            ? {
                name: doctor.name,
                specialty: doctor.specialty,
              }
            : {
                name: "Unknown Doctor",
                specialty: "General Medicine",
              },
        };
      })
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  },

  getBookingsForDoctor(doctorId: string) {
    const db = getDb();
    return db.consultations
      .filter((c) => c.doctorId === doctorId)
      .map((c) => {
        const patient = this.findPatientById(c.patientId);
        return {
          ...c,
          scheduledAt: new Date(c.scheduledAt),
          createdAt: new Date(c.createdAt),
          patient: patient
            ? {
                id: patient.id,
                firstName: patient.firstName,
                lastName: patient.lastName,
                email: patient.email,
                phone: patient.phone,
                dob: patient.dob,
                gender: patient.gender,
                address: patient.address ?? null,
                city: patient.city ?? null,
                state: patient.state ?? null,
                zipCode: patient.zipCode ?? null,
                country: patient.country ?? null,
                emailVerified: patient.emailVerified,
              }
            : null,
        };
      })
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  },

  createConsultation(data: {
    patientId: string;
    doctorId: string;
    scheduledAt: Date;
    reason: string;
    status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED";
    duration: number;
  }): MockConsultation {
    const db = getDb();
    const newConsultation: MockConsultation = {
      id: "con-" + Math.random().toString(36).substr(2, 9),
      patientId: data.patientId,
      doctorId: data.doctorId,
      scheduledAt: data.scheduledAt.toISOString(),
      status: data.status,
      reason: data.reason,
      notes: null,
      prescription: null,
      duration: data.duration,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.consultations.push(newConsultation);
    saveDb(db);
    return newConsultation;
  },

  updateConsultation(id: string, data: Partial<Omit<MockConsultation, "id" | "createdAt">>): MockConsultation | null {
    const db = getDb();
    const index = db.consultations.findIndex((c) => c.id === id);
    if (index === -1) return null;

    db.consultations[index] = {
      ...db.consultations[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    return db.consultations[index];
  },

  startVideoSession(consultationId: string, roomId: string): MockVideoSession {
    const db = getDb();
    db.videoSessions ||= [];
    const now = new Date().toISOString();
    const index = db.videoSessions.findIndex((session) => session.consultationId === consultationId);

    if (index !== -1) {
      db.videoSessions[index] = {
        ...db.videoSessions[index],
        status: "STARTED",
        roomId,
        startedAt: now,
        updatedAt: now,
      };
      saveDb(db);
      return db.videoSessions[index];
    }

    const videoSession: MockVideoSession = {
      id: "vid-" + Math.random().toString(36).substr(2, 9),
      consultationId,
      status: "STARTED",
      roomId,
      startedAt: now,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    db.videoSessions.push(videoSession);
    saveDb(db);
    return videoSession;
  },

  findVideoSessionByConsultation(consultationId: string): MockVideoSession | null {
    const db = getDb();
    return db.videoSessions?.find((session) => session.consultationId === consultationId) || null;
  },

  endVideoSession(consultationId: string): MockVideoSession | null {
    const db = getDb();
    db.videoSessions ||= [];
    const index = db.videoSessions.findIndex((session) => session.consultationId === consultationId);
    if (index === -1) return null;

    const now = new Date().toISOString();
    db.videoSessions[index] = {
      ...db.videoSessions[index],
      status: "ENDED",
      endedAt: now,
      updatedAt: now,
    };
    saveDb(db);
    return db.videoSessions[index];
  },
};
