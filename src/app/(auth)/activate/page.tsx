import type { Metadata } from "next";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivateForm } from "./activate-form";

export const metadata: Metadata = { title: "Activate your account" };
export const dynamic = "force-dynamic";

export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Activate your account</CardTitle>
        <CardDescription>Choose a password to finish setting up your student portal account.</CardDescription>
      </CardHeader>
      <CardContent>
        {token ? (
          <ActivateForm token={token} />
        ) : (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>This link is incomplete</AlertTitle>
            <AlertDescription>Ask the Registry office for a new activation link.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
