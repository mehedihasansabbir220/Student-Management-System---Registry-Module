/**
 * Validate an uploaded submission by extension AND content ("magic bytes").
 * The browser-supplied MIME type is not trusted — it is trivially spoofed.
 */

export type FileCheck =
  | { ok: true; kind: "pdf" | "docx"; mimeType: string }
  | { ok: false; reason: string };

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b);
const PDF_SIG = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_SIG = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04

export function detectSubmissionFileType(fileName: string, bytes: Uint8Array): FileCheck {
  if (bytes.length === 0) return { ok: false, reason: "The file is empty" };
  const ext = fileName.toLowerCase().split(".").pop();

  if (ext === "pdf") {
    return startsWith(bytes, PDF_SIG)
      ? { ok: true, kind: "pdf", mimeType: "application/pdf" }
      : { ok: false, reason: "This file is not a valid PDF" };
  }

  if (ext === "docx") {
    // Entry names in ZIP local headers are stored uncompressed, so we can look
    // for the Word main part without unzipping.
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 64 * 1024)));
    return startsWith(bytes, ZIP_SIG) && head.includes("word/")
      ? { ok: true, kind: "docx", mimeType: DOCX_MIME }
      : { ok: false, reason: "This file is not a valid Word (.docx) document" };
  }

  return { ok: false, reason: "Only PDF or DOCX files can be submitted" };
}
