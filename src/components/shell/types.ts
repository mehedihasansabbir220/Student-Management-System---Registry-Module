import type { Role } from "@/domain/permissions";

export type ShellUser = { name: string; email: string; role: Role; isDemo: boolean };
export type ShellArea = "staff" | "student";
