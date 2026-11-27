"use client";

import type { ReactNode } from "react";
import { Controller, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FieldProps<T extends FieldValues> = {
  form: UseFormReturn<T, unknown, unknown>;
  name: Path<T>;
  label: string;
  hint?: ReactNode;
  className?: string;
};

function useFieldMeta<T extends FieldValues>(form: FieldProps<T>["form"], name: Path<T>) {
  const id = `f-${String(name)}`;
  const error = form.formState.errors[name]?.message as string | undefined;
  return { id, error, describedBy: error ? `${id}-error` : `${id}-hint` };
}

export function FieldShell({ id, label, error, hint, className, children }: { id: string; label: string; error?: string; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs text-destructive">{error}</p>
      ) : (
        hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function TextField<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  className,
  type = "text",
  autoComplete,
  placeholder,
  disabled,
  inputClassName,
  step,
  min,
  max,
}: FieldProps<T> & { type?: string; autoComplete?: string; placeholder?: string; disabled?: boolean; inputClassName?: string; step?: string; min?: string; max?: string }) {
  const { id, error, describedBy } = useFieldMeta(form, name);
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} className={className}>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        disabled={disabled}
        step={step}
        min={min}
        max={max}
        className={inputClassName}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...form.register(name)}
      />
    </FieldShell>
  );
}

export function TextareaField<T extends FieldValues>({ form, name, label, hint, className, rows = 3, placeholder }: FieldProps<T> & { rows?: number; placeholder?: string }) {
  const { id, error, describedBy } = useFieldMeta(form, name);
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} className={className}>
      <Textarea id={id} rows={rows} placeholder={placeholder} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...form.register(name)} />
    </FieldShell>
  );
}

export function SelectField<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  className,
  options,
  placeholder = "Select…",
}: FieldProps<T> & { options: { value: string; label: string }[]; placeholder?: string }) {
  const { id, error, describedBy } = useFieldMeta(form, name);
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} className={className}>
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select value={(field.value as string | undefined) ?? ""} onValueChange={field.onChange}>
            <SelectTrigger id={id} className="w-full" aria-invalid={error ? true : undefined} aria-describedby={describedBy} onBlur={field.onBlur}>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </FieldShell>
  );
}

export function SubmitButton({ pending, children, pendingLabel, className, variant, size }: { pending: boolean; children: ReactNode; pendingLabel?: string; className?: string; variant?: "default" | "destructive" | "outline" | "secondary"; size?: "default" | "sm" }) {
  return (
    <Button type="submit" disabled={pending} className={className} variant={variant} size={size}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
