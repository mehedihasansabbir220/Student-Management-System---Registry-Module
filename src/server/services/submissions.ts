import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import { audit } from "../audit";
import { config } from "../config";
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from "../errors";
import { logger } from "../logger";
import { readStoredFile, removeFile, saveFile } from "../storage";
import { detectSubmissionFileType } from "@/domain/file-type";
import { evaluateSubmission } from "@/domain/submissions";

type Viewer = { role: "STAFF" } | { role: "STUDENT"; studentId: string };

/** Keep only a safe display name (no paths, control chars), capped in length. */
function cleanFileName(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "file";
  // eslint-disable-next-line no-control-regex
  return base.replace(/[\u0000-\u001f"<>|]/g, "").slice(0, 200) || "file";
}

/**
 * Upload or replace a submission.
 *
 * Order of operations matters:
 *  1. cheap checks first (size, type, student, assessment, rules) — nothing written yet
 *  2. write the new file under a fresh UUID key
 *  3. DB upsert + audit in a transaction
 *  4. on DB failure → delete the new file (no orphans); on success → delete the old file
 * The deadline decision uses the server clock, never the client's.
 */
export async function submitAssessment(input: {
  assessmentId: string;
  studentId: string;
  fileName: string;
  bytes: Uint8Array;
  actor: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const { maxUploadBytes, maxUploadMb } = config();

  if (input.bytes.length > maxUploadBytes) {
    throw new PayloadTooLargeError(`Files must be ${maxUploadMb} MB or smaller`);
  }
  const fileCheck = detectSubmissionFileType(input.fileName, input.bytes);
  if (!fileCheck.ok) throw new UnsupportedMediaTypeError(fileCheck.reason);

  const [student, assessment] = await Promise.all([
    db.student.findUnique({ where: { id: input.studentId }, select: { id: true, status: true, programmeId: true } }),
    db.assessment.findUnique({ where: { id: input.assessmentId }, include: { module: { select: { programmeId: true } } } }),
  ]);
  if (!student) throw new NotFoundError("Student");
  if (!assessment) throw new NotFoundError("Assessment");
  if (assessment.module.programmeId !== student.programmeId) {
    throw new ForbiddenError("This assessment is not part of your programme");
  }

  const existing = await db.submission.findUnique({
    where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: student.id } },
  });
  const decision = evaluateSubmission({ now, deadline: assessment.deadline, existing, studentStatus: student.status });
  if (!decision.allowed) throw new BusinessRuleError(decision.reason);

  const storageKey = `${assessment.id}/${student.id}/${randomUUID()}.${fileCheck.kind}`;
  await saveFile(storageKey, input.bytes);

  const data = {
    originalName: cleanFileName(input.fileName),
    storageKey,
    mimeType: fileCheck.mimeType,
    sizeBytes: input.bytes.length,
    submittedAt: now,
    isLate: decision.isLate,
  };

  let saved;
  try {
    saved = await db.$transaction(async (tx) => {
      const sub = existing
        ? // Optimistic concurrency: only replace the version we evaluated the rules against.
          await tx.submission.update({ where: { id: existing.id, version: existing.version }, data: { ...data, version: { increment: 1 } } })
        : await tx.submission.create({ data: { ...data, assessmentId: assessment.id, studentId: student.id } });
      await audit(tx, {
        actor: input.actor,
        action: existing ? "submission.replaced" : "submission.created",
        entityType: "Submission",
        entityId: sub.id,
        studentId: student.id,
        details: { assessmentId: assessment.id, version: sub.version, isLate: sub.isLate, fileName: sub.originalName },
      });
      return sub;
    });
  } catch (err) {
    await removeFile(storageKey);
    throw err;
  }

  if (existing) await removeFile(existing.storageKey);
  logger.info("submission stored", { submissionId: saved.id, version: saved.version, isLate: saved.isLate });
  return saved;
}

export async function readSubmissionFile(submissionId: string, viewer: Viewer) {
  const sub = await db.submission.findUnique({ where: { id: submissionId } });
  if (!sub) throw new NotFoundError("Submission");
  if (viewer.role === "STUDENT" && viewer.studentId !== sub.studentId) {
    throw new ForbiddenError("You can only download your own submissions");
  }
  try {
    const bytes = await readStoredFile(sub.storageKey);
    return { bytes, fileName: sub.originalName, mimeType: sub.mimeType };
  } catch (err) {
    // DB says the file exists but disk disagrees — a real operational problem worth an error log.
    logger.error("submission file missing from storage", { submissionId, storageKey: sub.storageKey, err });
    throw new NotFoundError("Submission file");
  }
}
