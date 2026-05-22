/**
 * src/utils/supabase/storage.ts
 *
 * Centralized helper for uploading files to the HealthKo Supabase Storage bucket.
 * Import this wherever you need to upload files (audit docs, avatars, etc.)
 */

import { createClient } from "@/utils/supabase/client";
import { getErrorMessage } from "@/lib/errors";

/** Single Supabase Storage bucket used by the entire app */
export const STORAGE_BUCKET = "healthko";

/** Allowed MIME types for medical documents and images */
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

/** Allowed MIME types for profile images only */
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

export type UploadFolder =
  | "doctor-credentials"   // Medical licenses, board certs, diplomas
  | "doctor-avatars"       // Physician profile photos
  | "patient-documents"    // Patient medical records
  | "patient-avatars";     // Patient profile photos

export interface UploadResult {
  success: boolean;
  url?: string;       // Full public URL (stored in DB)
  path?: string;      // Storage path relative to bucket (for deletion)
  error?: string;
}

/**
 * Upload a file to Supabase Storage `healthko` bucket.
 *
 * @param file           - The File object from an <input type="file">
 * @param folder         - Sub-folder inside the bucket (e.g. "doctor-credentials")
 * @param allowedTypes   - Array of accepted MIME types. Defaults to documents + images.
 * @param maxSizeMb      - Max file size in MB. Defaults to 10.
 * @param onProgress     - Optional callback that receives a 0–100 numeric progress estimate.
 */
export async function uploadToStorage(
  file: File,
  folder: UploadFolder,
  allowedTypes: string[] = ALLOWED_DOCUMENT_TYPES,
  maxSizeMb = 10,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  // ── Client-side validation ──────────────────────────────────────────────────
  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      error: `File type "${file.type}" is not allowed. Accepted: ${allowedTypes.join(", ")}`,
    };
  }

  if (file.size > maxSizeMb * 1024 * 1024) {
    return {
      success: false,
      error: `File size exceeds the ${maxSizeMb} MB limit.`,
    };
  }

  // ── Build a unique storage path ─────────────────────────────────────────────
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${folder}/${Date.now()}-${safeName}`;

  // ── Start steady progress ticker ────────────────────────────────────────────
  onProgress?.(5);
  let tickInterval: ReturnType<typeof setInterval> | null = null;
  if (onProgress) {
    let currentPct = 5;
    tickInterval = setInterval(() => {
      if (currentPct < 80) {
        currentPct += 5;
        onProgress(currentPct);
      }
    }, 200);
  }

  try {
    const supabase = createClient();

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (tickInterval) clearInterval(tickInterval);

    if (error) {
      onProgress?.(0);
      return {
        success: false,
        error: error.message || "Upload failed. Check bucket policies.",
      };
    }

    // ── Retrieve public URL ────────────────────────────────────────────────────
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    onProgress?.(100);

    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    };
  } catch (error: unknown) {
    if (tickInterval) clearInterval(tickInterval);
    onProgress?.(0);
    return {
      success: false,
      error: getErrorMessage(error, "An unexpected upload error occurred."),
    };
  }
}

/**
 * Delete a previously uploaded file from Supabase Storage.
 *
 * @param path - The storage path returned from `uploadToStorage` (e.g. "doctor-credentials/...")
 */
export async function deleteFromStorage(path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Delete failed.") };
  }
}
