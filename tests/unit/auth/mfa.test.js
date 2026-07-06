// Layer 19: MFA. Unit-tests the assurance-level logic + factor filtering by
// mocking supabase.auth.mfa.* (SDK calls, not plain HTTP).
import { describe, it, expect, vi, beforeEach } from "vitest";

const mfa = {
  listFactors: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  enroll: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
  unenroll: vi.fn(),
};
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { mfa } } }));

const { mfaStatus, listFactors, verifyEnrollment } = await import("@/lib/mfa");

beforeEach(() => vi.clearAllMocks());

describe("mfaStatus()", () => {
  it("flags shouldChallenge when session is aal1 but a factor requires aal2", async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null,
    });
    const s = await mfaStatus();
    expect(s.shouldChallenge).toBe(true);
    expect(s.isEnrolled).toBe(true);
  });

  it("does not challenge once the session is aal2", async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null,
    });
    expect((await mfaStatus()).shouldChallenge).toBe(false);
  });

  it("does not challenge a user with no enrolled factor", async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null,
    });
    const s = await mfaStatus();
    expect(s.shouldChallenge).toBe(false);
    expect(s.isEnrolled).toBe(false);
  });
});

describe("listFactors()", () => {
  it("returns only verified factors in .verified", async () => {
    mfa.listFactors.mockResolvedValue({
      data: {
        all: [{ id: "a", status: "verified" }, { id: "b", status: "unverified" }],
        totp: [],
      },
      error: null,
    });
    const { verified } = await listFactors();
    expect(verified).toHaveLength(1);
    expect(verified[0].id).toBe("a");
  });
});

describe("verifyEnrollment()", () => {
  it("runs challenge → verify with the returned challengeId", async () => {
    mfa.challenge.mockResolvedValue({ data: { id: "chal-1" }, error: null });
    mfa.verify.mockResolvedValue({ data: {}, error: null });
    await verifyEnrollment("factor-1", "123456");
    expect(mfa.challenge).toHaveBeenCalledWith({ factorId: "factor-1" });
    expect(mfa.verify).toHaveBeenCalledWith({
      factorId: "factor-1", challengeId: "chal-1", code: "123456",
    });
  });

  it("throws if the code is rejected", async () => {
    mfa.challenge.mockResolvedValue({ data: { id: "chal-1" }, error: null });
    mfa.verify.mockResolvedValue({ data: null, error: new Error("Invalid TOTP code") });
    await expect(verifyEnrollment("factor-1", "000000")).rejects.toThrow(/invalid/i);
  });
});
