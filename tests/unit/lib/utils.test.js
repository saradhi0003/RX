// Layer: UX/UI (styling utility). Proves the pure-logic test path.
import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn() classname merge", () => {
  it("joins truthy classes and drops falsy ones", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });

  it("later tailwind utilities win over earlier conflicting ones", () => {
    // tailwind-merge should collapse p-2 + p-4 to just p-4
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
