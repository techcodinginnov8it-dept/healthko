"use server";

// ── Password Reset Server Actions (Disabled for security compliance) ──────────────────

export async function requestPasswordReset(data: {
  email: string;
  userType: "patient" | "doctor";
}): Promise<{ success: boolean; error?: string }> {
  return {
    success: false,
    error: "Password recovery is currently disabled. Please contact system support.",
  };
}

export async function verifyResetOtp(data: {
  token: string;
  otp: string;
}): Promise<{ success: boolean; email?: string; userType?: string; error?: string }> {
  return {
    success: false,
    error: "Password recovery is currently disabled. Please contact system support.",
  };
}

export async function applyNewPassword(data: {
  token: string;
  otp: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  return {
    success: false,
    error: "Password recovery is currently disabled. Please contact system support.",
  };
}
