import { ClassificationBadge } from "@/components/badges";
import { classify } from "@/domain/grades";

/** Live preview of the classification for a typed mark, using the same domain rule as the server. */
export function ClassificationPreview({ value }: { value: string }) {
  const n = Number(value);
  if (value.trim() === "" || !Number.isFinite(n) || n < 0 || n > 100) return null;
  return <ClassificationBadge value={classify(n)} />;
}
