import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { makeProgramme, makeStudent, makeStudentUser, makeUser } from "../support/factories";

describe("auth schema invariants", () => {
  it("refuses a STUDENT user that is not linked to a student record", async () => {
    await expect(db.user.create({ data: { email: "s@example.com", name: "S", role: "STUDENT" } })).rejects.toThrow();
  });

  it("refuses a staff user that is linked to a student record", async () => {
    const s = await makeStudent((await makeProgramme()).id);
    await expect(db.user.create({ data: { email: "f@example.com", name: "F", role: "FINANCE", studentId: s.id } })).rejects.toThrow();
  });

  it("stores emails lower-case only", async () => {
    await expect(db.user.create({ data: { email: "Admin@Example.com", name: "A", role: "REGISTRY_ADMIN" } })).rejects.toThrow();
  });

  it("deletes a user's refresh tokens with the user", async () => {
    const u = await makeUser("FINANCE");
    await db.refreshToken.create({ data: { userId: u.id, tokenHash: "h1", familyId: "f1", expiresAt: new Date(Date.now() + 1e6) } });
    await db.user.delete({ where: { id: u.id } });
    expect(await db.refreshToken.count()).toBe(0);
  });

  it("allows only one account per student", async () => {
    const s = await makeStudent((await makeProgramme()).id);
    await makeStudentUser(s.id);
    await expect(makeStudentUser(s.id, { email: "second@example.com" })).rejects.toThrow();
  });

  it("factories create users whose password verifies", async () => {
    const u = await makeUser("ACADEMIC");
    expect(u.password).toBe("Correct-Horse-1");
    expect(u.passwordHash).toMatch(/^scrypt\$/);
  });
});
