"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, X } from "lucide-react";
import { describeError } from "@/lib/form-errors";
import { checkFileBeforeUpload, uploadWithProgress } from "@/lib/upload";
import { cn } from "@/lib/utils";
import { notifyError, notifySuccess } from "@/components/feedback";
import { Notice } from "@/components/common";
import { Button } from "@/components/ui/button";

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function UploadForm({ assessmentId, title, isResubmission, willBeLate, maxMb }: { assessmentId: string; title: string; isResubmission: boolean; willBeLate: boolean; maxMb: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  function pick(f: File | null) {
    setProblem(f ? checkFileBeforeUpload(f, maxMb) : null);
    setFile(f);
  }

  function clear() {
    setFile(null);
    setProblem(null);
    if (input.current) input.current.value = "";
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0] ?? null);
  }

  async function submit() {
    if (!file || problem) return;
    const body = new FormData();
    body.set("file", file);
    setProgress(0);
    try {
      const s = await uploadWithProgress<{ isLate: boolean; version: number }>(`/api/assessments/${assessmentId}/submissions`, body, setProgress);
      notifySuccess(s.isLate ? "Submitted. This has been recorded as a late submission." : `Submitted${s.version > 1 ? ` (version ${s.version})` : ""}.`);
      clear();
      router.refresh();
    } catch (err) {
      const d = describeError(err);
      if (d.fields.file) setProblem(d.fields.file);
      else notifyError(err);
    } finally {
      setProgress(null);
    }
  }

  const uploading = progress !== null;

  return (
    <div className="grid gap-3">
      {willBeLate && (
        <Notice tone="amber">
          The deadline has passed. You can still submit once, but it will be <strong>flagged as late</strong> and cannot be replaced afterwards.
        </Notice>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition",
          dragging ? "border-primary bg-accent/60" : "border-border hover:border-primary/50",
          uploading && "pointer-events-none opacity-70",
        )}
      >
        <FileUp className="size-6 text-muted-foreground" />
        <p className="text-sm">
          <label htmlFor={`file-${assessmentId}`} className="cursor-pointer font-medium text-primary hover:underline">Choose a file</label> or drag it here
        </p>
        <p className="text-xs text-muted-foreground">PDF or DOCX, up to {maxMb} MB</p>
        <input
          ref={input}
          id={`file-${assessmentId}`}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          aria-label={`Choose a file for ${title}`}
        />
      </div>

      {file && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{size(file.size)}</span>
          {!uploading && (
            <Button variant="ghost" size="icon" className="size-7" onClick={clear} aria-label="Remove file"><X /></Button>
          )}
        </div>
      )}

      {uploading && (
        <div className="grid gap-1" role="status" aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">Uploading… {Math.round(progress * 100)}%</span>
        </div>
      )}

      {problem && <p className="text-sm text-destructive" role="alert">{problem}</p>}
      {isResubmission && !willBeLate && <p className="text-xs text-muted-foreground">Uploading again will replace your current submission.</p>}

      <div>
        <Button onClick={submit} disabled={!file || !!problem || uploading}>
          {uploading && <Loader2 className="animate-spin" />}
          {isResubmission ? "Resubmit" : willBeLate ? "Submit late" : "Submit"}
        </Button>
      </div>
    </div>
  );
}
