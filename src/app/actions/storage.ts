"use server";

/**
 * src/app/actions/storage.ts
 *
 * Server-side file upload action using the Supabase service_role key.
 * Bypasses RLS — safe because this runs only on the server.
 * Only async functions are exported in this file, as required by Next.js.
 */

import { getErrorMessage } from "@/lib/errors";
import { createAdminClient } from "@/utils/supabase/admin";
import { STORAGE_BUCKET, type UploadFolder } from "@/utils/supabase/storage";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Upload a file to the Supabase `healthko` bucket via a server action.
 * Called from client components with FormData containing the file.
 *
 * @param formData - Must contain: "file" (File), "folder" (UploadFolder string)
 */
export async function uploadFileToStorage(
  formData: FormData
): Promise<{ success: boolean; url?: string; path?: string; error?: string }> {
  try {
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as UploadFolder) || "doctor-credentials";

    if (!file || file.size === 0) {
      return { success: false, error: "No file provided." };
    }

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        success: false,
        error: `File type "${file.type}" is not allowed. Accepted: PDF, PNG, JPG, WEBP.`,
      };
    }

    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      return { success: false, error: "File size must not exceed 10 MB." };
    }

    // Build a unique, URL-safe storage path
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${folder}/${Date.now()}-${safeName}`;

    // Convert File → ArrayBuffer → Buffer (required by Supabase server-side)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use admin client (bypasses RLS entirely)
    const supabase = createAdminClient();

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("[Storage Upload Error]", error);
      return {
        success: false,
        error: error.message || "Upload to storage failed.",
      };
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (error: unknown) {
    console.error("[Storage Action Error]", error);
    return {
      success: false,
      error: getErrorMessage(error, "An unexpected error occurred during upload."),
    };
  }
}

/**
 * Delete a previously uploaded file from Supabase Storage.
 * Uses admin client to bypass RLS.
 */
export async function deleteFileFromStorage(
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Delete failed.") };
  }
}
