import type { Metadata } from "next";
import { ActivateForm } from "./activate-form";

export const metadata: Metadata = { title: "Activate your account" };
export const dynamic = "force-dynamic";

export default async function ActivatePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Activate your account</h1>
      <p className="mt-1 text-sm text-slate-500">Choose a password to finish setting up your student portal account.</p>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {token ? (
          <ActivateForm token={token} />
        ) : (
          <p className="text-sm text-rose-700">This link is incomplete. Ask the Registry to send you a new activation link.</p>
        )}
      </div>
    </div>
  );
}
