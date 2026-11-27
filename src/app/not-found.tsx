import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-md place-items-center px-4 py-16 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <SearchX className="size-5" />
      </div>
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">We couldn&apos;t find that</h1>
      <p className="mt-2 text-sm text-muted-foreground">The record may have been removed, or the link is wrong.</p>
      <Button asChild variant="outline" className="mt-6"><Link href="/">Go home</Link></Button>
    </div>
  );
}
