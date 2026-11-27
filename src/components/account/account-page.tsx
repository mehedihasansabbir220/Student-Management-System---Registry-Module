import { ROLE_LABEL } from "@/domain/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ShellUser } from "@/components/shell/types";
import { ChangePasswordForm } from "./change-password-form";
import { SessionsCard } from "./sessions-card";

/** Shared by /staff/account and /me/account (each sits inside its own area's guard). */
export function AccountPage({ user }: { user: ShellUser }) {
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-sm text-muted-foreground">Your sign-in details and devices.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Name</dt>
              <dd className="mt-0.5 text-sm">{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Email</dt>
              <dd className="mt-0.5 truncate text-sm">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Role</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="secondary">{ROLE_LABEL[user.role]}</Badge>
                {user.isDemo && <Badge variant="outline">Demo account</Badge>}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            {user.isDemo ? "Demo accounts are shared, so this is turned off." : "Changing your password signs you out on every other device."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm disabled={user.isDemo} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>Where you&apos;re signed in. Sessions end on their own after 7 days without use.</CardDescription>
        </CardHeader>
        <CardContent>
          <SessionsCard isDemo={user.isDemo} />
        </CardContent>
      </Card>
    </div>
  );
}
