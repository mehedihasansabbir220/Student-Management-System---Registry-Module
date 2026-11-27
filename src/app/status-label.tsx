import { STATUS_LABEL } from "@/lib/format";

export function StatusLabel({ status }: { status: string }) {
  return <>{STATUS_LABEL[status as keyof typeof STATUS_LABEL] ?? status}</>;
}
