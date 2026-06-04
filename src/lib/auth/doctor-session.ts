import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "healthko_doctor_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type DoctorSession = {
  userId: string;
  email: string;
  role: "doctor";
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }

  return "healthko-dev-session-secret";
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function encodeSession(session: DoctorSession) {
  const payload = toBase64Url(JSON.stringify(session));
  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

function decodeSession(token: string): DoctorSession | null {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signValue(payload);

  try {
    const signatureBuffer = Buffer.from(signature, "base64url");
    const expectedBuffer = Buffer.from(expectedSignature, "base64url");

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    const parsed = JSON.parse(fromBase64Url(payload)) as DoctorSession;

    if (
      !parsed ||
      typeof parsed.userId !== "string" ||
      typeof parsed.email !== "string" ||
      parsed.role !== "doctor" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }

    if (parsed.exp <= Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export async function createDoctorSession({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const session: DoctorSession = {
    userId,
    email,
    role: "doctor",
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  };

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearDoctorSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getDoctorSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = decodeSession(token);

  if (!session) {
    // NOTE: Cannot delete cookies here — this function is called from Server
    // Components where cookie writes are forbidden. The expired/invalid cookie
    // will be overwritten on next login or cleared by clearDoctorSession().
    return null;
  }

  return session;
}

export async function requireDoctorSession(redirectTo = "/doctor/signin") {
  const session = await getDoctorSession();

  if (!session) {
    redirect(redirectTo);
  }

  return session;
}
