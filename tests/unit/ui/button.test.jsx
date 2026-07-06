// Layer 17: UX/UI. Proves the React + Testing Library + jsdom render path works
// against a real app component (the shadcn Button primitive).
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button (UI primitive)", () => {
  it("renders its label", () => {
    render(<Button>Save changes</Button>);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });

  it("fires onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button", { name: /go/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
