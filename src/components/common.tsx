import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** App-level building blocks shared by every page, on top of the shadcn primitives. */

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export type Tone = "green" | "amber" | "red" | "blue" | "slate" | "violet";

/** Status colours carry meaning only: red = overdue/late/fail, amber = attention, green = done. */
const TONE: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-400/20",
  amber: "bg-amber-50 text-amber-800 border-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-400/20",
  red: "bg-rose-50 text-rose-700 border-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-400/20",
  blue: "bg-sky-50 text-sky-700 border-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-400/20",
  slate: "bg-muted text-muted-foreground border-border",
  violet: "bg-violet-50 text-violet-700 border-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-400/20",
};

export function ToneBadge({ tone = "slate", children, title, className }: { tone?: Tone; children: ReactNode; title?: string; className?: string }) {
  return (
    <Badge variant="outline" title={title} className={cn(TONE[tone], className)}>
      {children}
    </Badge>
  );
}

export function EmptyState({ title, children, icon: Icon }: { title: string; children?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed px-6 py-10 text-center">
      {Icon && <Icon className="mb-2 size-6 text-muted-foreground" />}
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

const NOTICE: Record<"amber" | "red" | "blue" | "green", { icon: LucideIcon; className: string }> = {
  amber: { icon: TriangleAlert, className: "border-amber-300/60 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 [&>svg]:text-amber-600" },
  red: { icon: CircleAlert, className: "border-rose-300/60 bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-200 [&>svg]:text-rose-600" },
  blue: { icon: Info, className: "border-sky-300/60 bg-sky-50 text-sky-900 dark:bg-sky-500/10 dark:text-sky-200 [&>svg]:text-sky-600" },
  green: { icon: CircleCheck, className: "border-emerald-300/60 bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200 [&>svg]:text-emerald-600" },
};

export function Notice({ tone = "amber", children, className }: { tone?: keyof typeof NOTICE; children: ReactNode; className?: string }) {
  const { icon: Icon, className: toneClass } = NOTICE[tone];
  return (
    <Alert className={cn(toneClass, className)}>
      <Icon />
      <AlertDescription className="text-inherit">{children}</AlertDescription>
    </Alert>
  );
}

export function DescriptionList({ items, className }: { items: [string, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
          <dd className="mt-0.5 text-sm">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StatCard({ label, value, hint, tone, href, icon: Icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "red" | "amber" | "green"; href?: string; icon?: LucideIcon }) {
  const accent = tone === "red" ? "text-rose-600 dark:text-rose-400" : tone === "amber" ? "text-amber-600 dark:text-amber-400" : tone === "green" ? "text-emerald-600 dark:text-emerald-400" : "";
  const body = (
    <Card className={cn("gap-0 py-0 transition", href && "hover:border-primary/40 hover:shadow-md")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          {label}
          {Icon && <Icon className="size-4" />}
        </div>
        <div className={cn("mt-1 text-2xl font-semibold tabular-nums", accent)}>{value}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">{body}</Link> : body;
}
