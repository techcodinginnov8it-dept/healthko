"use server";

import { createClient as createSupabaseServerClient } from "@/utils/supabase/server";
import { isPrismaConfigured, prisma } from "@/lib/prisma";
import { clearPatientSession, createPatientSession } from "@/lib/auth/patient-session";
import { clearDoctorSession, createDoctorSession } from "@/lib/auth/doctor-session";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { redirect } from "next/navigation";
import { mockDb } from "@/lib/mockDb";
import { cookies } from "next/headers";

// Seed data helper to ensure demo doctors exist in Supabase
async function ensureFeaturedDoctorsSeeded() {
  if (!isPrismaConfigured()) {
    return;
  }

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
  delivery?: "email" | "dev";
  debugOtp?: string;
};

type DoctorLoginPayload = {
  emailOrNpi: string;
  password: string;
  securityKey?: string;
};

async function validateMockPatientLogin({ email, password }: PatientLoginPayload) {
  const patient = mockDb.findPatientByEmail(email);

  if (!patient) {
    return null;
  }

  const isMatch = await bcrypt.compare(password, patient.password);
  if (!isMatch) {
    return null;
  }

  return {
    email: patient.email,
    firstName: patient.firstName,
    emailVerified: patient.emailVerified,
  };
}

async function loginMockDoctor({ emailOrNpi, password, securityKey }: DoctorLoginPayload) {
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

  if (securityKey && securityKey.length !== 6) {
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
      specialty: doctor.specialty,
    },
  };
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
  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
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

function isLocalOtpFallbackEnabled() {
  return process.env.NODE_ENV !== "production";
}

function generateDevOtp() {
  return randomInt(100000, 1000000).toString();
}

function storeMockOtp(email: string, purpose: OtpPurpose, otp: string) {
  mockDb.createEmailOtp(email, otp, purpose, new Date(Date.now() + 10 * 60 * 1000));
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
  try {
    await sendPatientSupabaseOtp({
      email,
      purpose,
      firstName,
    });

    return { delivery: "email" as const };
  } catch (error: unknown) {
    if (!isLocalOtpFallbackEnabled()) {
      throw error;
    }

    const debugOtp = generateDevOtp();
    storeMockOtp(email, purpose, debugOtp);
    console.warn("[issueEmailOtp] Falling back to local mock OTP:", error);
    return { delivery: "dev" as const, debugOtp };
  }
}

function withOtpDeliveryHint(message: string) {
  return message;
}

async function verifySupabaseEmailOtp(email: string, otp: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Incorrect verification code.");
  }

  const cookieStore = await cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  const verificationTypes: ("magiclink" | "signup" | "email")[] = ["magiclink", "signup", "email"];
  let lastError: unknown = null;

  for (const type of verificationTypes) {
    try {
      console.log(`[verifySupabaseEmailOtp] Attempting OTP verification for ${email} with type '${type}'`);
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type,
      });

      if (!error) {
        console.log(`[verifySupabaseEmailOtp] OTP verification succeeded for ${email} with type '${type}'`);
        return;
      }

      console.warn(`[verifySupabaseEmailOtp] OTP verification failed with type '${type}':`, error.message);
      lastError = error;
    } catch (err: unknown) {
      console.error(`[verifySupabaseEmailOtp] Exception during OTP verification with type '${type}':`, err);
      lastError = err;
    }
  }

  const message = lastError instanceof Error ? lastError.message : "Incorrect verification code.";
  throw new Error(message);
}

async function verifyPatientOtpCode(email: string, otp: string, purpose: OtpPurpose) {
  if (isLocalOtpFallbackEnabled()) {
    const latestOtp = mockDb.findLatestOtp(email, purpose);
    if (latestOtp && !latestOtp.used) {
      const expiresAt = new Date(latestOtp.expiresAt);
      if (latestOtp.otp === otp && expiresAt.getTime() > Date.now()) {
        mockDb.markOtpAsUsed(latestOtp.id);
        return { delivery: "dev" as const };
      }
    }
  }

  await verifySupabaseEmailOtp(email, otp);
  return { delivery: "email" as const };
}

/**
 * Step 1 of patient signup: create the account and email an OTP.
 */
export async function requestPatientSignupOtp(data: PatientSignupPayload): Promise<PatientOtpResponse> {
  const { firstName, middleName, lastName, suffix, email, countryCode, phone, dob, gender, password, hipaaConsent } = data;

  if (!firstName || !lastName || !email || !phone || !dob || !password) {
    return { success: false, error: "Missing required fields" };
  }

  let createdPatient: { id: string; email: string; firstName: string } | null = null;
  let isMockDb = false;

  // Step 1: Create the patient record in either Prisma or Mock DB fallback
  try {
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

    createdPatient = { id: patient.id, email: patient.email, firstName: patient.firstName };
  } catch (error: unknown) {
    console.warn("Prisma signup failed, falling back to mock JSON database:", error);
    try {
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

      createdPatient = { id: patient.id, email: patient.email, firstName: patient.firstName };
      isMockDb = true;
    } catch (mockErr: unknown) {
      console.error("Signup Mock DB critical failure:", mockErr);
      return { success: false, error: "Failed to create patient account." };
    }
  }

  // Step 2: Attempt to send the verification OTP
  try {
    const otpDelivery = await issueEmailOtp({
      email: createdPatient.email,
      purpose: "signup_verify",
      firstName: createdPatient.firstName,
    });

    return {
      success: true,
      requiresOtp: true,
      purpose: "signup_verify",
      email: createdPatient.email,
      message: withOtpDeliveryHint("We sent a 6-digit code to your email to finish setting up your patient account."),
      delivery: otpDelivery.delivery,
      debugOtp: otpDelivery.debugOtp,
    };
  } catch (otpError: unknown) {
    console.error("Supabase OTP send failed. Rolling back patient record creation...", otpError);

    // Rollback DB creation so user is not left in a half-created/orphaned state!
    if (isMockDb) {
      mockDb.deletePatient(createdPatient.email);
    } else {
      await prisma.patient.delete({
        where: { email: createdPatient.email }
      }).catch((dbDeleteErr) => {
        console.error("Failed to delete patient during signup rollback:", dbDeleteErr);
      });
    }

    // Return the informative error message (e.g. "email rate limit exceeded") so the user knows what actually failed!
    return {
      success: false,
      error: otpError instanceof Error ? otpError.message : "We could not send the verification code. Please try again."
    };
  }
}

/**
 * Step 2 of patient signup: verify OTP and start the patient session.
 */
export async function verifyPatientSignupOtp(data: {
  email: string;
  otp: string;
}): Promise<PatientOtpResponse> {
  if (!isPrismaConfigured()) {
    try {
      const { email, otp } = data;

      if (!email || !otp || otp.length !== 6) {
        return { success: false, error: "A valid 6-digit verification code is required." };
      }

      const patient = mockDb.findPatientByEmail(email);

      if (!patient) {
        return { success: false, error: "We could not find that patient account." };
      }

      await verifyPatientOtpCode(email, otp, "signup_verify");
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

  try {
    const { email, otp } = data;

    if (!email || !otp || otp.length !== 6) {
      return { success: false, error: "A valid 6-digit verification code is required." };
    }

    const patient = await prisma.patient.findUnique({
      where: { email },
    });

    if (!patient) {
      return { success: false, error: "We could not find that patient account." };
    }

    await verifyPatientOtpCode(email, otp, "signup_verify");

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

      await verifyPatientOtpCode(email, otp, "signup_verify");

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
  let validatedPatient: { email: string; firstName: string; emailVerified: boolean } | null = null;
  const { email, password } = data;

  if (!email || !password) {
    return { success: false, error: "Email and password are required" };
  }

  // Step 1: Validate credentials using Prisma or Mock DB fallback
  if (!isPrismaConfigured()) {
    validatedPatient = await validateMockPatientLogin(data);

    if (!validatedPatient) {
      return { success: false, error: "Invalid email or password" };
    }
  } else {
    try {
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

      validatedPatient = { email: patient.email, firstName: patient.firstName, emailVerified: patient.emailVerified };
    } catch (error: unknown) {
      console.warn("Prisma login request failed, falling back to mock database:", error);
      validatedPatient = await validateMockPatientLogin(data);

      if (!validatedPatient) {
        return { success: false, error: "Invalid email or password" };
      }
    }
  }

  // Step 2: Attempt to send the verification OTP
  try {
    const purpose: OtpPurpose = validatedPatient.emailVerified ? "login_verify" : "signup_verify";

    const otpDelivery = await issueEmailOtp({
      email: validatedPatient.email,
      purpose,
      firstName: validatedPatient.firstName,
    });

    const message = validatedPatient.emailVerified
      ? "We sent a 6-digit code to your email to confirm this sign-in."
      : "Your account still needs email verification. We sent you a fresh 6-digit code.";

    return {
      success: true,
      requiresOtp: true,
      purpose,
      email: validatedPatient.email,
      message: withOtpDeliveryHint(message),
      delivery: otpDelivery.delivery,
      debugOtp: otpDelivery.debugOtp,
    };
  } catch (otpError: unknown) {
    console.error("Supabase login OTP send failed:", otpError);
    return {
      success: false,
      error: otpError instanceof Error ? otpError.message : "We could not send the verification code. Please try again."
    };
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
  if (!isPrismaConfigured()) {
    try {
      const { email, otp, purpose = "login_verify" } = data;

      if (!email || !otp || otp.length !== 6) {
        return { success: false, error: "A valid 6-digit verification code is required." };
      }

      const patient = mockDb.findPatientByEmail(email);

      if (!patient) {
        return { success: false, error: "We could not find that patient account." };
      }

      await verifyPatientOtpCode(email, otp, purpose);

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

  try {
    const { email, otp, purpose = "login_verify" } = data;

    if (!email || !otp || otp.length !== 6) {
      return { success: false, error: "A valid 6-digit verification code is required." };
    }

    const patient = await prisma.patient.findUnique({
      where: { email },
    });

    if (!patient) {
      return { success: false, error: "We could not find that patient account." };
    }

    await verifyPatientOtpCode(email, otp, purpose);

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

      await verifyPatientOtpCode(email, otp, purpose);

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
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseServerClient(cookieStore);
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Supabase signOut failed:", err);
  }
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

    if (!isPrismaConfigured()) {
      return loginMockDoctor(data);
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
    if (securityKey && securityKey.length !== 6) {
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
      return await loginMockDoctor(data);
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
