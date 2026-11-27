import { describe, expect, it } from "vitest";
import { detectSubmissionFileType } from "@/domain/file-type";

const pdfBytes = new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n1 0 obj\n");
// DOCX = ZIP whose entries include word/document.xml (local header filenames are stored uncompressed)
const docxBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode("....[Content_Types].xml....word/document.xml")]);
const xlsxBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode("....xl/workbook.xml")]);
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("detectSubmissionFileType", () => {
  it("accepts a real PDF", () => {
    expect(detectSubmissionFileType("essay.pdf", pdfBytes)).toEqual({ ok: true, kind: "pdf", mimeType: "application/pdf" });
  });

  it("accepts a real DOCX", () => {
    const r = detectSubmissionFileType("essay.DOCX", docxBytes);
    expect(r).toEqual({
      ok: true,
      kind: "docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  });

  it("rejects other extensions", () => {
    const r = detectSubmissionFileType("photo.png", pngBytes);
    expect(r.ok).toBe(false);
  });

  it("rejects a file renamed to .pdf whose contents are not a PDF", () => {
    const r = detectSubmissionFileType("malware.pdf", new TextEncoder().encode("MZ\x90\x00 this is an exe"));
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.reason).toMatch(/not a valid PDF/i);
  });

  it("rejects a non-Word zip renamed to .docx", () => {
    expect(detectSubmissionFileType("sheet.docx", xlsxBytes).ok).toBe(false);
  });

  it("rejects empty files", () => {
    const r = detectSubmissionFileType("empty.pdf", new Uint8Array());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/empty/i);
  });

  it("rejects legacy .doc with a helpful message", () => {
    const r = detectSubmissionFileType("old.doc", pdfBytes);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/PDF or DOCX/);
  });
});
