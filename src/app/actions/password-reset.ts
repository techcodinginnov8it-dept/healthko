"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { randomBytes } from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const TOKEN_TTL_MINUTES = 30;

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function getResetErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && !error.message.includes("Can't reach database server")) {
    return error.message;
  }

  return fallback;
}

// ── 1. Request password reset (forgot-password page) ─────────────────────────
export async function requestPasswordReset(data: {
  email: string;
  userType: "patient" | "doctor";
}): Promise<{ success: boolean; error?: string }> {
  const { email, userType } = data;

  try {
    // Find user in the correct table
    let userExists = false;
    if (userType === "patient") {
      const patient = await prisma.patient.findUnique({ where: { email } });
      userExists = !!patient;
    } else {
      const doctor = await prisma.doctor.findUnique({ where: { email } });
      userExists = !!doctor;
    }

    // Always return success to prevent user enumeration
    if (!userExists) {
      return { success: true };
    }

    // Invalidate any existing unused tokens for this email
    await prisma.passwordResetToken.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    // Generate new token and OTP
    const token = generateToken();
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { email, userType, token, otp, expiresAt },
    });

    const resetUrl = `${APP_URL}/reset-password?token=${token}`;
    const portalLabel = userType === "doctor" ? "Physician" : "Patient";

    // Send email via Resend
    await resend.emails.send({
      from: "HealthKo <onboarding@resend.dev>",
      to: email,
      subject: "HealthKo — Password Reset Request",
      html: `
        <!DOCTYPE html>
        <html>
          <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#f1f5f9;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
              <tr><td align="center">
                <table width="520" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
                  <!-- Header -->
                  <tr>
                    <td style="background:#0f172a;padding:24px 32px;border-bottom:1px solid #1e293b;">
                      <span style="font-size:22px;font-weight:900;letter-spacing:-0.5px;">
                        <span style="color:#ef4444;">H</span><span style="color:#f8fafc;">ealth</span><span style="color:#14b8a6;">K</span><span style="color:#f8fafc;">o</span>
                      </span>
                      <span style="font-size:10px;color:#94a3b8;background:#1e293b;padding:2px 8px;border-radius:4px;margin-left:8px;font-weight:700;letter-spacing:2px;">
                        SECURITY
                      </span>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:32px;">
                      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#14b8a6;text-transform:uppercase;letter-spacing:2px;">
                        ${portalLabel} Password Reset
                      </p>
                      <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;color:#f8fafc;">
                        Reset Your Password
                      </h1>
                      <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;line-height:1.6;">
                        We received a request to reset the password for your HealthKo ${portalLabel} account. Click the button below and enter your verification passcode to proceed.
                      </p>

                      <!-- OTP Box -->
                      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border:1px solid #334155;border-radius:12px;margin-bottom:24px;">
                        <tr><td style="padding:20px;text-align:center;">
                          <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:2px;">Your Verification OTP</p>
                          <p style="margin:0;font-size:36px;font-weight:900;letter-spacing:12px;color:#14b8a6;font-family:monospace;">${otp}</p>
                          <p style="margin:8px 0 0;font-size:11px;color:#475569;">Valid for ${TOKEN_TTL_MINUTES} minutes</p>
                        </td></tr>
                      </table>

                      <!-- Reset Button -->
                      <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                        <tr>
                          <td style="background:#14b8a6;border-radius:10px;">
                            <a href="${resetUrl}" style="display:block;padding:14px 32px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">
                              Reset My Password →
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:0 0 8px;font-size:12px;color:#475569;text-align:center;">Or copy this link into your browser:</p>
                      <p style="margin:0 0 24px;font-size:11px;color:#334155;word-break:break-all;text-align:center;background:#0f172a;padding:10px;border-radius:8px;">
                        ${resetUrl}
                      </p>

                      <p style="margin:0;font-size:12px;color:#475569;line-height:1.6;">
                        If you did not request this password reset, you can safely ignore this email. Your password will not change unless you click the link above and complete the process.
                      </p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding:16px 32px;border-top:1px solid #334155;text-align:center;">
                      <p style="margin:0;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:2px;">
                        © ${new Date().getFullYear()} HealthKo Technologies, Inc. — HIPAA Secure
                      </p>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </body>
        </html>
      `,
    });

    return { success: true };
  } catch (err: unknown) {
    console.error("[requestPasswordReset]", err);
    return {
      success: false,
      error: getResetErrorMessage(
        err,
        "Password reset is temporarily unavailable. Please try again later."
      ),
    };
  }
}

// ── 2. Verify OTP + token (reset-password page step 1) ───────────────────────
export async function verifyResetOtp(data: {
  token: string;
  otp: string;
}): Promise<{ success: boolean; email?: string; userType?: string; error?: string }> {
  const { token, otp } = data;

  try {
    const record = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!record) return { success: false, error: "Invalid or expired reset link." };
    if (record.used) return { success: false, error: "This reset link has already been used." };
    if (new Date() > record.expiresAt) return { success: false, error: "This reset link has expired. Please request a new one." };
    if (record.otp !== otp) return { success: false, error: "Incorrect verification code. Please check your email." };

    return { success: true, email: record.email, userType: record.userType };
  } catch (err: unknown) {
    console.error("[verifyResetOtp]", err);
    return {
      success: false,
      error: getResetErrorMessage(
        err,
        "We could not verify this reset code right now. Please try again later."
      ),
    };
  }
}

// ── 3. Apply new password after OTP verified ─────────────────────────────────
export async function applyNewPassword(data: {
  token: string;
  otp: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  const { token, otp, newPassword } = data;

  try {
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters." };
    }

    const record = await prisma.passwordResetToken.findUnique({ where: { token } });

    if (!record) return { success: false, error: "Invalid or expired reset link." };
    if (record.used) return { success: false, error: "This reset link has already been used." };
    if (new Date() > record.expiresAt) return { success: false, error: "This reset link has expired. Please request a new one." };
    if (record.otp !== otp) return { success: false, error: "Verification code mismatch. Please try again." };

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    if (record.userType === "patient") {
      await prisma.patient.update({
        where: { email: record.email },
        data: { password: hashedPassword },
      });
    } else {
      await prisma.doctor.update({
        where: { email: record.email },
        data: { password: hashedPassword },
      });
    }

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { token },
      data: { used: true },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error("[applyNewPassword]", err);
    return {
      success: false,
      error: getResetErrorMessage(
        err,
        "We could not update your password right now. Please try again later."
      ),
    };
  }
}
