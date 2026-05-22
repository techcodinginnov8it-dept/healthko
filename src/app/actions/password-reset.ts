"use server";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Step 1 — Send a password-reset email via Supabase Auth.
 *
 * Supabase will email the user a magic link that redirects to:
 *   /auth/callback?code=<code>&next=/reset-password
 *
 * The /auth/callback route handler exchanges the code for a session
 * and forwards the user to /reset-password where they set the new password.
 */
export async function requestPasswordReset(data: {
  email: string;
}): Promise<{ success: boolean; error?: string }> {
  const { email } = data;

  if (!email) {
    return { success: false, error: "Email address is required." };
  }

  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(
            cookiesToSet: { name: string; value: string; options: CookieOptions }[]
          ) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Called from a Server Component — safe to ignore
            }
          },
        },
      }
    );

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
    });

    if (error) {
      console.error("[requestPasswordReset]", error.message);
      return {
        success: false,
        error:
          "We could not send the reset email right now. Please try again later.",
      };
    }

    return { success: true };
  } catch (err) {
    console.error("[requestPasswordReset] unexpected error:", err);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again.",
    };
  }
}
