/** Client-side checks that mirror the File Assistant's server limits. */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".md", ".csv", ".docx", ".xlsx"] as const;

/** Returns a user-facing error, or null when the file can be uploaded. */
export function validateAttachment(file: { name: string; size: number }): string | null {
  const name = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return "Unsupported file type. Use PDF, TXT, MD, CSV, DOCX, or XLSX.";
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "That file is larger than the 10 MB limit.";
  }
  return null;
}
