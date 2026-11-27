"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { withholdResultsSchema } from "@/lib/validation";
import { notifyError, notifySuccess } from "@/components/feedback";
import { SubmitButton, TextField } from "@/components/form/form-fields";
import { useApiForm } from "@/components/form/use-api-form";
import { Notice } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const REASONS = ["Outstanding tuition fees", "Pending moderation by external examiner", "Academic misconduct investigation", "Mitigating circumstances under review"];

type Props = {
  studentId: string;
  studentName?: string;
  status: "PUBLISHED" | "WITHHELD";
  reason: string | null;
  publishedAt: string | null;
  gradeCount: number;
  isOverdue: boolean;
  /** Buttons only (results table rows); the full version adds the status sentence. */
  compact?: boolean;
};

function WithholdDialog({ studentId, studentName, isOverdue, label }: { studentId: string; studentName?: string; isOverdue: boolean; label: string }) {
  const [open, setOpen] = useState(false);
  const { form, onSubmit, pending } = useApiForm(withholdResultsSchema, (v) => apiFetch(`/api/students/${studentId}/results/withhold`, { method: "POST", json: v }), {
    defaultValues: { reason: isOverdue ? REASONS[0] : "", shareReason: false },
    successToast: "Results withheld",
    onSuccess: () => setOpen(false),
  });
  const share = form.watch("shareReason") === true;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><EyeOff /> {label}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withhold results{studentName ? ` for ${studentName}` : ""}</DialogTitle>
          <DialogDescription>The student won&apos;t see any marks until results are published. The reason is recorded in the audit log.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={onSubmit} className="grid gap-4">
          <TextField form={form} name="reason" label="Reason" placeholder="Choose or type a reason" />
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <Button key={r} type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={() => form.setValue("reason", r, { shouldValidate: true })}>{r}</Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id={`share-${studentId}`} checked={share} onCheckedChange={(v) => form.setValue("shareReason", v === true)} />
            <Label htmlFor={`share-${studentId}`} className="font-normal">Show this reason to the student</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton pending={pending} pendingLabel="Saving…" variant="destructive">Withhold results</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReleaseControls({ studentId, studentName, status, reason, publishedAt, gradeCount, isOverdue, compact }: Props) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);

  async function publish() {
    setPublishing(true);
    try {
      await apiFetch(`/api/students/${studentId}/results/publish`, { method: "POST" });
      notifySuccess("Results published. The student can now see their marks.");
      router.refresh();
    } catch (err) {
      notifyError(err);
    } finally {
      setPublishing(false);
    }
  }

  const buttons = (
    <div className="flex flex-wrap gap-2">
      {status === "WITHHELD" && (
        <Button size="sm" onClick={publish} disabled={publishing || gradeCount === 0} title={gradeCount === 0 ? "No grades to publish" : undefined}>
          {publishing ? <Loader2 className="animate-spin" /> : <Eye />} Publish results
        </Button>
      )}
      <WithholdDialog
        studentId={studentId}
        studentName={studentName}
        isOverdue={isOverdue}
        label={status === "PUBLISHED" ? "Withhold" : reason ? "Change reason" : "Withhold with reason"}
      />
    </div>
  );
  if (compact) return buttons;

  return (
    <div className="grid gap-3 text-sm">
      <p className="text-muted-foreground">
        {status === "PUBLISHED" ? (
          <>Results are <strong className="text-emerald-700 dark:text-emerald-400">visible to the student</strong>{publishedAt && <> since {formatDateTime(publishedAt)}</>}.</>
        ) : (
          <>Results are <strong className="text-amber-700 dark:text-amber-400">hidden from the student</strong>{reason && <>: {reason}</>}.</>
        )}
      </p>
      {status === "WITHHELD" && isOverdue && gradeCount > 0 && <Notice tone="amber">This student has an overdue balance. Check Registry policy before publishing.</Notice>}
      {buttons}
    </div>
  );
}
