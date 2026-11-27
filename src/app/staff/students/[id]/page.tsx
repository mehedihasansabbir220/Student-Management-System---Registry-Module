import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ClipboardList, FileText, GraduationCap, History } from "lucide-react";
import { getStudent } from "@/server/services/students";
import { getStaffMarksheet } from "@/server/services/results";
import { listStudentSubmissions } from "@/server/services/submissions";
import { NotFoundError } from "@/server/errors";
import { requirePagePermission } from "@/server/session";
import { can, type Role } from "@/domain/permissions";
import { formatGBP, toPence } from "@/domain/money";
import { activityLabel, describeActivity, visibleActivity } from "@/lib/activity";
import { formatDate, formatDateTime, METHOD_LABEL } from "@/lib/format";
import { resolveTab, studentTabsFor } from "@/lib/student-tabs";
import { cn } from "@/lib/utils";
import { ClassificationBadge, ReleaseBadge, SubmissionBadge } from "@/components/badges";
import { DescriptionList, EmptyState, Notice, StatCard } from "@/components/common";
import { BreadcrumbTitle } from "@/components/shell/breadcrumb-context";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AddFeeDialog } from "./add-fee-dialog";
import { RecordPaymentDialog } from "./payment-dialog";
import { PortalAccount } from "./portal-account";
import { RecordTabs } from "./record-tabs";
import { ReleaseControls } from "./release-controls";
import { StatusEditor } from "./status-editor";
import { StudentHeader } from "./student-header";
import { VoidPaymentButton } from "./void-payment";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

/**
 * Server Components call services directly, bypassing API route guards — so this
 * page enforces the permission matrix itself: each tab's data is only *loaded*
 * (not merely hidden) for roles allowed to see it.
 */
async function load(id: string, role: Role) {
  try {
    return await Promise.all([
      getStudent(id),
      can(role, "results.read") ? getStaffMarksheet(id) : null,
      can(role, "submissions.read") ? listStudentSubmissions(id) : null,
    ]);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // NB: no loading.tsx above this route on purpose — a Suspense boundary would flush
  // a 200 before notFound() runs, and unknown records must return a real 404.
  const { id } = await params;
  const s = await getStudent(id).catch((err) => {
    if (err instanceof NotFoundError) notFound();
    throw err;
  });
  return { title: `${s.fullName} (${s.studentNumber})` };
}

const th = "h-10 text-xs font-medium text-muted-foreground";

export default async function StudentPage({ params, searchParams }: Props) {
  const user = await requirePagePermission("students.read");
  const { id } = await params;
  const { tab } = await searchParams;
  const [s, marksheet, submissions] = await load(id, user.role);
  const may = (p: Parameters<typeof can>[1]) => can(user.role, p);
  const a = s.account;
  const tabs = studentTabsFor(user.role);
  const activity = visibleActivity(s.auditLogs, user.role);

  return (
    <>
      <BreadcrumbTitle id={s.id} label={s.fullName} />
      <StudentHeader
        fullName={s.fullName}
        studentNumber={s.studentNumber}
        status={s.status}
        programme={s.programme.name}
        academicYear={s.academicYear}
        account={may("finance.read") ? a : null}
        portalStatus={s.portalAccount.status}
      />

      <RecordTabs key={s.id} tabs={tabs} initial={resolveTab(tab, user.role)}>
        {/* ---------------- Overview ---------------- */}
        <TabsContent value="overview" className="grid gap-6">
          {may("finance.read") && a.isOverdue && (
            <Notice tone="red">
              {formatGBP(a.overduePence)} is overdue since {formatDate(a.oldestOverdueDueDate)} ({a.daysOverdue} day{a.daysOverdue === 1 ? "" : "s"}).
            </Notice>
          )}
          {may("finance.read") && s.status === "WITHDRAWN" && a.balancePence > 0 && (
            <Notice tone="red">This student has withdrawn but still owes {formatGBP(a.balancePence)}. The debt remains on the account.</Notice>
          )}
          {marksheet?.release.status === "WITHHELD" && marksheet.grades.length > 0 && (
            <Notice tone="amber">Results are withheld{marksheet.release.reason ? `: ${marksheet.release.reason}` : ""}.</Notice>
          )}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Student details</CardTitle>
              </CardHeader>
              <CardContent>
                <DescriptionList
                  items={[
                    ["Email", s.email],
                    ["Date of birth", formatDate(s.dateOfBirth)],
                    ["Programme", `${s.programme.code} — ${s.programme.name}`],
                    ["Academic year", s.academicYear],
                    ["Enrolled on", formatDate(s.createdAt)],
                  ]}
                />
                {may("students.write") && (
                  <div className="mt-6 border-t pt-6">
                    <StatusEditor studentId={s.id} status={s.status} balancePence={may("finance.read") ? a.balancePence : 0} />
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Portal account</CardTitle>
              </CardHeader>
              <CardContent>
                <PortalAccount
                  studentId={s.id}
                  status={s.portalAccount.status}
                  lastLoginAt={s.portalAccount.lastLoginAt?.toISOString() ?? null}
                  canManage={may("students.write")}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------- Finance ---------------- */}
        {may("finance.read") && (
          <TabsContent value="finance" className="grid gap-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Total fees" value={formatGBP(a.billedPence)} />
              <StatCard label="Paid" value={formatGBP(a.paidPence)} />
              <StatCard label={a.creditPence ? "Credit" : "Outstanding"} value={formatGBP(a.creditPence || a.balancePence)} tone={a.isOverdue ? "red" : undefined} />
              <StatCard label="Overdue" value={formatGBP(a.overduePence)} tone={a.isOverdue ? "red" : undefined} hint={a.isOverdue ? `since ${formatDate(a.oldestOverdueDueDate)}` : undefined} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Charges</CardTitle>
                {may("fees.write") && <CardAction><AddFeeDialog studentId={s.id} /></CardAction>}
              </CardHeader>
              <CardContent>
                {s.fees.length === 0 ? (
                  <EmptyState title="No charges" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead className={th}>Description</TableHead><TableHead className={th}>Due</TableHead><TableHead className={cn(th, "text-right")}>Amount</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.fees.map((f) => (
                        <TableRow key={f.id}>
                          <TableCell>{f.description}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(f.dueDate)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatGBP(toPence(f.amount))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payments</CardTitle>
                {may("payments.write") && <CardAction><RecordPaymentDialog studentId={s.id} balancePence={a.balancePence} /></CardAction>}
              </CardHeader>
              <CardContent>
                {s.payments.length === 0 ? (
                  <EmptyState title="No payments recorded" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className={th}>Date</TableHead>
                        <TableHead className={th}>Reference</TableHead>
                        <TableHead className={th}>Method</TableHead>
                        <TableHead className={cn(th, "text-right")}>Amount</TableHead>
                        <TableHead className={th}><span className="sr-only">Actions</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.payments.map((p) => (
                        <TableRow key={p.id} className={p.voidedAt ? "text-muted-foreground" : undefined}>
                          <TableCell>{formatDate(p.paidOn)}</TableCell>
                          <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                          <TableCell>{METHOD_LABEL[p.method]}</TableCell>
                          <TableCell className={cn("text-right tabular-nums", p.voidedAt && "line-through")}>{formatGBP(toPence(p.amount))}</TableCell>
                          <TableCell className="text-right">
                            {p.voidedAt ? (
                              <Tooltip>
                                <TooltipTrigger className="cursor-default text-xs">Voided</TooltipTrigger>
                                <TooltipContent>{p.voidReason ?? "No reason recorded"}</TooltipContent>
                              </Tooltip>
                            ) : (
                              may("payments.void") && <VoidPaymentButton paymentId={p.id} reference={p.reference} amount={formatGBP(toPence(p.amount))} />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ---------------- Coursework ---------------- */}
        {submissions && (
          <TabsContent value="coursework">
            <Card>
              <CardHeader>
                <CardTitle>Submissions</CardTitle>
              </CardHeader>
              <CardContent>
                {submissions.length === 0 ? (
                  <EmptyState title="No submissions yet" icon={ClipboardList} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead className={th}>Assessment</TableHead><TableHead className={th}>Submitted</TableHead><TableHead className={th}>State</TableHead><TableHead className={th}>File</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell>
                            <Link className="font-medium text-primary hover:underline" href={`/staff/assessments/${sub.assessment.id}`}>{sub.assessment.title}</Link>
                            <div className="text-xs text-muted-foreground">{sub.assessment.module.code} · due {formatDateTime(sub.assessment.deadline)}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDateTime(sub.submittedAt)}
                            {sub.version > 1 && <div className="text-xs">version {sub.version}</div>}
                          </TableCell>
                          <TableCell><SubmissionBadge state={sub.isLate ? "LATE" : "ON_TIME"} /></TableCell>
                          <TableCell>
                            <a className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" href={`/api/submissions/${sub.id}/file`}>
                              <FileText className="size-3.5" /> {sub.originalName}
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ---------------- Results ---------------- */}
        {marksheet && (
          <TabsContent value="results" className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Marksheet</CardTitle>
                {marksheet.average !== null && marksheet.overall && (
                  <CardDescription>
                    Average <strong className="tabular-nums text-foreground">{marksheet.average}</strong> · <ClassificationBadge value={marksheet.overall} />
                  </CardDescription>
                )}
                <CardAction><ReleaseBadge status={marksheet.release.status} /></CardAction>
              </CardHeader>
              <CardContent>
                {marksheet.grades.length === 0 ? (
                  <EmptyState title="No grades entered yet" icon={GraduationCap}>Grades are entered from each assessment&apos;s page.</EmptyState>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow><TableHead className={th}>Assessment</TableHead><TableHead className={th}>Module</TableHead><TableHead className={cn(th, "text-right")}>Mark</TableHead><TableHead className={th}>Classification</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {marksheet.grades.map((g) => (
                        <TableRow key={g.id}>
                          <TableCell><Link className="font-medium text-primary hover:underline" href={`/staff/assessments/${g.assessmentId}`}>{g.assessmentTitle}</Link></TableCell>
                          <TableCell className="text-muted-foreground">{g.moduleCode}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{g.mark}</TableCell>
                          <TableCell><ClassificationBadge value={g.classification} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            {may("results.release") && (
              <Card>
                <CardHeader>
                  <CardTitle>Release to student</CardTitle>
                </CardHeader>
                <CardContent>
                  <ReleaseControls
                    studentId={s.id}
                    status={marksheet.release.status}
                    reason={marksheet.release.reason}
                    publishedAt={marksheet.release.publishedAt?.toISOString() ?? null}
                    gradeCount={marksheet.grades.length}
                    isOverdue={a.isOverdue}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* ---------------- Activity ---------------- */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Every change to this record, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <EmptyState title="No activity yet" icon={History} />
              ) : (
                <ol className="divide-y">
                  {activity.map((l) => {
                    const detail = describeActivity(l.details);
                    return (
                      <li key={l.id} className="py-3 text-sm first:pt-0 last:pb-0">
                        <div className="font-medium">{activityLabel(l.action)}</div>
                        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
                        <div className="text-xs text-muted-foreground">{formatDateTime(l.createdAt)} · {l.actor}</div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </RecordTabs>
    </>
  );
}
