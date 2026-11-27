import { afterAll, beforeEach } from "vitest";
import { db } from "@/server/db";
import { resetDatabase } from "./factories";

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await db.$disconnect();
});
