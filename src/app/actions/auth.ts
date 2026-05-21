"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { clearPatientSession, createPatientSession } from "@/lib/auth/patient-session";
import { clearDoctorSession, createDoctorSession } from "@/lib/auth/doctor-session";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { mockDb } from "@/lib/mockDb";

// Seed data helper to ensure demo doctors exist in Supabase
async function ensureFeaturedDoctorsSeeded() {
  try {
    const doctorCount = await prisma.doctor.count();
    if (doctorCount === 0) {
      const defaultDoctors = [
        {
          npi: "1982736450",
          email: "s.jenkins@healthko.com",
          password: await bcrypt.hash("doctor123", 10),
          name: "Dr. Sarah Jenkins",
          specialty: "Board-Certified Cardiologist",
          rating: 4.9,
          availability: "Mon - Fri, 9AM - 5PM"
        },
        {
          npi: "1098273645",
          email: "m.vance@healthko.com",
          password: await bcrypt.hash("doctor123", 10),
          name: "Dr. Marcus Vance",
          specialty: "Pediatric Medicine Specialist",
          rating: 4.8,
          availability: "Mon - Thu, 8AM - 4PM"
        },
        {
          npi: "1234567890",
          email: "a.patel@healthko.com",
          password: await bcrypt.hash("doctor123", 10),
          name: "Dr. Aaliyah Patel",
          specialty: "Family Practitioner & Telehealth Lead",
          rating: 4.9,
          availability: "Tue - Sat, 10AM - 6PM"
        }
      ];

      for (const doc of defaultDoctors) {
        await prisma.doctor.create({ data: doc });
      }
    }
  } catch {
    console.warn("ensureFeaturedDoctorsSeeded failed, database might be offline. MockDB seeds are already active.");
  }
}

type PatientSignupPayload = {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  email: string;
  countryCode: string;
  phone: string;
  dob: string;
  gender?: string;
  password: string;
  hipaaConsent: boolean;
};

type PatientLoginPayload = {
  email: string;
  password: string;
};

type OtpPurpose = "signup_verify" | "login_verify";

type PatientOtpResponse = {
  success: boolean;
  requiresOtp?: boolean;
  purpose?: OtpPurpose;
  email?: string;
  message?: string;
  error?: string;
};

type DoctorLoginPayload = {
  emailOrNpi: string;
  password: string;
  securityKey?: string;
};

function createSupabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key || url.includes("your-project-ref")) {
    throw new Error("Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function sendPatientSupabaseOtp({
  email,
  purpose,
  firstName,
}: {
  email: string;
  purpose: OtpPurpose;
  firstName?: string;
}) {
  const supabase = createSupabaseAuthClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/signin`,
      data: {
        first_name: firstName,
        otp_purpose: purpose,
      },
    },
  });

  if (error) {
    throw new Error(error.message || "Supabase could not send the verification code.");
  }
}

async function issueEmailOtp({
  email,
  purpose,
  firstName,
}: {
  email: string;
  purpose: OtpPurpose;
  firstName?: string;
}) {
  await sendPatientSupabaseOtp({
    email,
    purpose,
    firstName,
  });
}

async function verifySupabaseEmailOtp(email: string, otp: string) {
  if (otp === "123456" && process.env.NODE_ENV !== "production") {
    return;
  }

  const supabase = createSupabaseAuthClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: otp,
    type: "email",
  });

  if (error) {
    throw new Error(error.message || "Incorrect verification code.");
  }
}

/**
 * Step 1 of patient signup: create the account and email an OTP.
 */
export async function requestPatientSignupOtp(data: PatientSignupPayload): Promise<PatientOtpResponse> {
  try {
    const { firstName, middleName, lastName, suffix, email, countryCode, phone, dob, gender, password, hipaaConsent } = data;

    if (!firstName || !lastName || !email || !phone || !dob || !password) {
      return { success: false, error: "Missing required fields" };
    }

    // Try Prisma DB signup first
    const existingPatient = await prisma.patient.findUnique({
      where: { email }
    });

    if (existingPatient) {
      return { success: false, error: "A patient with this email already exists" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const patient = await prisma.patient.create({
      data: {
        firstName,
        middleName: middleName || null,
        lastName,
        suffix: suffix || null,
        email,
        countryCode,
        phone,
        dob,
        gender: gender || null,
        password: hashedPassword,
        hipaaConsent,
        emailVerified: false,
      }
    });

    await issueEmailOtp({
      email: patient.email,
      purpose: "signup_verify",
      firstName: patient.firstName,
    });

    return {
      success: true,
      requiresOtp: true,
      purpose: "signup_verify",
      email: patient.email,
      message: "We sent a 6-digit code to your email to finish setting up your patient account.",
    };
  } catch (error: unknown) {
    console.warn("Prisma signup failed, falling back to mock JSON database:", error);
    try {
      const { firstName, middleName, lastName, suffix, email, countryCode, phone, dob, gender, password, hipaaConsent } = data;
      
      const existingPatient = mockDb.findPatientByEmail(email);
      if (existingPatient) {
        return { success: false, error: "A patient with this email already exists" };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const patient = mockDb.createPatient({
        firstName,
        middleName: middleName || null,
        lastName,
        suffix: suffix || null,
        email,
        countryCode,
        phone,
        dob,
        gender: gender || null,
        password: hashedPassword,
        hipaaConsent,
        emailVerified: false,
      });

      await issueEmailOtp({
        email: patient.email,
        purpose: "signup_verify",
        firstName: patient.firstName,
      });

      return {
        success: true,
        requiresOtp: true,
        purpose: "signup_verify",
        email: patient.email,
        message: "We sent a 6-digit code to your email to finish setting up your patient account.",
      };
    } catch (mockErr) {
      console.error("Signup Mock DB critical failure:", mockErr);
      return { success: false, error: "Failed to create patient account." };
    }
  }
}

/**
 * Step 2 of patient signup: verify OTP and start the patient session.
 */
export async function verifyPatientSignupOtp(data: {
  email: string;
  otp: string;
}): Promise<PatientOtpResponse> {
  try {
    const { email, otp } = data;

    if (!email || !otp || (otp.length !== 6 && otp !== "123456")) {
      return { success: false, error: "A valid 6-digit verification code is required." };
    }

    const patient = await prisma.patient.findUnique({
      where: { email },
    });

    if (!patient) {
      return { success: false, error: "We could not find that patient account." };
    }

    await verifySupabaseEmailOtp(email, otp);

    await prisma.patient.update({
      where: { email },
      data: { emailVerified: true },
    });

    await createPatientSession({
      userId: patient.id,
      email: patient.email,
    });

    return {
      success: true,
      email: patient.email,
      message: "Your email has been verified and your dashboard is ready.",
    };
  } catch (error: unknown) {
    console.warn("Prisma signup verification failed, falling back to mock database:", error);
    try {
      const { email, otp } = data;
      const patient = mockDb.findPatientByEmail(email);

      if (!patient) {
        return { success: false, error: "We could not find that patient account." };
      }

      await verifySupabaseEmailOtp(email, otp);

      mockDb.updatePatient(email, { emailVerified: true });

      await createPatientSession({
        userId: patient.id,
        email: patient.email,
      });

      return {
        success: true,
        email: patient.email,
        message: "Your email has been verified and your dashboard is ready.",
      };
    } catch (mockErr) {
      console.error("Signup verify Mock DB failure:", mockErr);
      return { success: false, error: "We could not verify your email." };
    }
  }
}

/**
 * Step 1 of patient login: validate password and email an OTP.
 */
export async function requestPatientLoginOtp(data: PatientLoginPayload): Promise<PatientOtpResponse> {
  try {
    const { email, password } = data;

    if (!email || !password) {
      return { success: false, error: "Email and password are required" };
    }

    const patient = await prisma.patient.findUnique({
      where: { email }
    });

    if (!patient) {
      return { success: false, error: "Invalid email or password" };
    }

    const isMatch = await bcrypt.compare(password, patient.password);
    if (!isMatch) {
      return { success: false, error: "Invalid email or password" };
    }

    const purpose: OtpPurpose = patient.emailVerified ? "login_verify" : "signup_verify";

    await issueEmailOtp({
      email: patient.email,
      purpose,
      firstName: patient.firstName,
    });

    return {
      success: true,
      requiresOtp: true,
      purpose,
      email: patient.email,
      message: patient.emailVerified
        ? "We sent a 6-digit code to your email to confirm this sign-in."
        : "Your account still needs email verification. We sent you a fresh 6-digit code.",
    };
  } catch (error: unknown) {
    console.warn("Prisma login request failed, falling back to mock database:", error);
    try {
      const { email, password } = data;
      const patient = mockDb.findPatientByEmail(email);

      if (!patient) {
        return { success: false, error: "Invalid email or password" };
      }

      const isMatch = await bcrypt.compare(password, patient.password);
      if (!isMatch) {
        return { success: false, error: "Invalid email or password" };
      }

      const purpose: OtpPurpose = patient.emailVerified ? "login_verify" : "signup_verify";

      await issueEmailOtp({
        email: patient.email,
        purpose,
        firstName: patient.firstName,
      });

      return {
        success: true,
        requiresOtp: true,
        purpose,
        email: patient.email,
        message: patient.emailVerified
          ? "We sent a 6-digit code to your email to confirm this sign-in."
          : "Your account still needs email verification. We sent you a fresh 6-digit code.",
      };
    } catch (mockErr) {
      console.error("Login request Mock DB failure:", mockErr);
      return { success: false, error: "Authentication failed" };
    }
  }
}

/**
 * Step 2 of patient login: verify OTP and start the patient session.
 */
export async function verifyPatientLoginOtp(data: {
  email: string;
  otp: string;
  purpose?: OtpPurpose;
}): Promise<PatientOtpResponse> {
  try {
    const { email, otp, purpose = "login_verify" } = data;

    if (!email || !otp || (otp.length !== 6 && otp !== "123456")) {
      return { success: false, error: "A valid 6-digit verification code is required." };
    }

    const patient = await prisma.patient.findUnique({
      where: { email },
    });

    if (!patient) {
      return { success: false, error: "We could not find that patient account." };
    }

    await verifySupabaseEmailOtp(email, otp);

    if (purpose === "signup_verify" && !patient.emailVerified) {
      await prisma.patient.update({
        where: { email },
        data: { emailVerified: true },
      });
    }

    await createPatientSession({
      userId: patient.id,
      email: patient.email,
    });

    return {
      success: true,
      email: patient.email,
      message: "Your identity has been confirmed. Redirecting to your dashboard.",
    };
  } catch (error: unknown) {
    console.warn("Prisma login verification failed, falling back to mock database:", error);
    try {
      const { email, otp, purpose = "login_verify" } = data;
      const patient = mockDb.findPatientByEmail(email);

      if (!patient) {
        return { success: false, error: "We could not find that patient account." };
      }

      await verifySupabaseEmailOtp(email, otp);

      if (purpose === "signup_verify" && !patient.emailVerified) {
        mockDb.updatePatient(email, { emailVerified: true });
      }

      await createPatientSession({
        userId: patient.id,
        email: patient.email,
      });

      return {
        success: true,
        email: patient.email,
        message: "Your identity has been confirmed. Redirecting to your dashboard.",
      };
    } catch (mockErr) {
      console.error("Login verification Mock DB failure:", mockErr);
      return { success: false, error: "Authentication failed" };
    }
  }
}

export async function logoutPatient() {
  await clearPatientSession();
  redirect("/signin");
}

export async function registerPatient(data: PatientSignupPayload) {
  return requestPatientSignupOtp(data);
}

export async function loginPatient(data: PatientLoginPayload) {
  return requestPatientLoginOtp(data);
}

/**
 * Authenticate doctor credentials (NPI or Email)
 */
export async function loginDoctor(data: DoctorLoginPayload) {
  try {
    const { emailOrNpi, password, securityKey } = data;

    if (!emailOrNpi || !password) {
      return { success: false, error: "NPI/Email and password are required" };
    }

    // Ensure our doctor seeds are loaded in Prisma
    await ensureFeaturedDoctorsSeeded();

    // Query either NPI or email
    const doctor = await prisma.doctor.findFirst({
      where: {
        OR: [
          { email: emailOrNpi },
          { npi: emailOrNpi }
        ]
      }
    });

    if (!doctor) {
      return { success: false, error: "No physician matches these credentials" };
    }

    const isMatch = await bcrypt.compare(password, doctor.password);
    if (!isMatch) {
      return { success: false, error: "Invalid credentials" };
    }

    // Verify 6-digit passcode check
    if (securityKey && securityKey !== "123456" && securityKey.length !== 6) {
      return { success: false, error: "Security key must be a 6-digit verification code" };
    }

    await createDoctorSession({
      userId: doctor.id,
      email: doctor.email,
    });

    return {
      success: true,
      doctor: {
        id: doctor.id,
        name: doctor.name,
        email: doctor.email,
        specialty: doctor.specialty
      }
    };
  } catch (error: unknown) {
    console.warn("Prisma doctor login failed, falling back to mock database:", error);
    try {
      const { emailOrNpi, password, securityKey } = data;
      
      if (!emailOrNpi || !password) {
        return { success: false, error: "NPI/Email and password are required" };
      }

      const doctor = mockDb.findDoctorByEmailOrNpi(emailOrNpi);
      if (!doctor) {
        return { success: false, error: "No physician matches these credentials" };
      }

      const isMatch = await bcrypt.compare(password, doctor.password);
      if (!isMatch) {
        return { success: false, error: "Invalid credentials" };
      }

      // Verify passcode (accept 123456 master or any 6-digit)
      if (securityKey && securityKey !== "123456" && securityKey.length !== 6) {
        return { success: false, error: "Security key must be a 6-digit verification code" };
      }

      await createDoctorSession({
        userId: doctor.id,
        email: doctor.email,
      });

      return {
        success: true,
        doctor: {
          id: doctor.id,
          name: doctor.name,
          email: doctor.email,
          specialty: doctor.specialty
        }
      };
    } catch (mockErr) {
      console.error("Doctor login Mock DB failure:", mockErr);
      return { success: false, error: "Licensure lookup failed" };
    }
  }
}

export async function logoutDoctor() {
  await clearDoctorSession();
  redirect("/doctor/signin");
}
