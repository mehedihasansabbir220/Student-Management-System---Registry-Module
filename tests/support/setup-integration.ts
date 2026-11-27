import { afterAll, beforeEach } from "vitest";
import { db } from "@/server/db";
import { resetDatabase } from "./factories";
import { resetAuthCache } from "./http";

beforeEach(async () => {
  await resetDatabase();
  resetAuthCache();
});

afterAll(async () => {
  await db.$disconnect();
});
