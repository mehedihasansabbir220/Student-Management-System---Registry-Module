import "server-only";
import type { EnrolmentStatus } from "@prisma/client";
import { db } from "../db";
import { accountFor, accountSelect } from "./accounts";
import { listAssessmentsForStaff } from "./assessments";
import { listOverdueStudents } from "./fees";
import { listReleaseOverview } from "./results";

const WEEK_MS = 7 * 86_400_000;

/** Everything a Registry admin needs to triage their morning, in one call. */
export async function getDashboard(today = new Date()) {
  const [statusGroups, overdue, assessments, lateSubmissions, releases, accounts] = await Promise.all([
    db.student.groupBy({ by: ["status"], _count: true }),
    listOverdueStudents(today),
    listAssessmentsForStaff(),
    db.submission.findMany({
      where: { isLate: true },
      orderBy: { submittedAt: "desc" },
      take: 10,
      include: {
        student: { select: { id: true, studentNumber: true, fullName: true } },
        assessment: { select: { id: true, title: true, deadline: true } },
      },
    }),
    listReleaseOverview(),
    db.student.findMany({ select: accountSelect }),
  ]);

  const statusCounts: Record<EnrolmentStatus, number> = { ENROLLED: 0, DEFERRED: 0, WITHDRAWN: 0, COMPLETED: 0 };
  for (const g of statusGroups) statusCounts[g.status] = g._count;

  const finance = { billedPence: 0, collectedPence: 0, outstandingPence: 0, creditPence: 0 };
  for (const s of accounts) {
    const a = accountFor(s.fees, s.payments, today);
    finance.billedPence += a.billedPence;
    finance.collectedPence += a.paidPence;
    finance.outstandingPence += a.balancePence;
    finance.creditPence += a.creditPence;
  }

  const horizon = today.getTime() + WEEK_MS;
  const upcomingDeadlines = assessments.filter((a) => a.deadline.getTime() >= today.getTime() && a.deadline.getTime() <= horizon);

  return {
    statusCounts,
    overdue,
    overdueTotalPence: overdue.reduce((s, o) => s + o.overduePence, 0),
    finance,
    upcomingDeadlines,
    lateSubmissions,
    awaitingRelease: releases.filter((r) => r.awaitingRelease),
  };
}
