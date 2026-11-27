import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-semibold text-indigo-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold">We couldn&apos;t find that</h1>
      <p className="mt-2 text-sm text-slate-500">The record may have been removed, or the link is wrong.</p>
      <Link href="/" className="btn btn-secondary mt-6">Go home</Link>
    </div>
  );
}
