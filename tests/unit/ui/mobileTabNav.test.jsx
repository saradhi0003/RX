// Layer 17 (UX/UI): MobileTabNav — the phone bottom tab bar that replaces the
// icon rail below 768px.
//
// The invariant worth guarding is reachability. On a phone there is no rail and
// no hamburger, so four tabs are the only way into the app. If someone adds a
// nav group to Layout's navGroups and it lands in neither the Recruiting tab
// nor the Settings sheet, those pages become silently unreachable on mobile —
// a regression nothing else in the suite would catch.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// Mounted without a provider, usePermissions() returns can:()=>false, which
// would hide the permission-gated Accounts items. Grant everything so the test
// asserts routing coverage rather than gating.
vi.mock("@/components/common/PermissionsContext", () => ({
  usePermissions: () => ({
    me: null, role: null, isAdmin: true,
    can: () => true, scopeFor: () => "all", listFilterFor: () => null,
  }),
  PermissionsProvider: ({ children }) => children,
}));

const { default: MobileTabNav } = await import("@/components/common/MobileTabNav");
const { navGroups, visibleItems } = await import("@/Layout");

function renderNav(initialPath = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MobileTabNav groups={navGroups} isAdmin visibleItems={visibleItems} />
    </MemoryRouter>
  );
}

const sheet = () => screen.getByRole("dialog");
// A row's textContent concatenates its badge ("Bookings" + "New"), so read the
// title span rather than the whole link.
const sheetTitles = () =>
  [...sheet().querySelectorAll(".rxmn-item-title")].map(e => e.textContent);

describe("MobileTabNav", () => {
  beforeEach(() => { document.body.style.overflow = ""; });

  it("renders exactly the four phone tabs", () => {
    renderNav();
    const bar = screen.getByRole("navigation", { name: /primary/i });
    expect(within(bar).getAllByText(/^(Home|Recruiting|Playbooks|Settings)$/).map(e => e.textContent))
      .toEqual(["Home", "Recruiting", "Playbooks", "Settings"]);
  });

  it("Home and Playbooks navigate directly instead of opening a sheet", () => {
    renderNav();
    expect(screen.getByRole("link", { name: /home/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /playbooks/i })).toHaveAttribute("href", "/playbooks");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Recruiting opens a sheet holding that group's destinations", async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(screen.getByRole("button", { name: /recruiting/i }));
    const links = sheetTitles();
    expect(links).toEqual(
      visibleItems(navGroups.find(g => g.id === "recruiting"), { isAdmin: true, can: () => true })
        .map(i => i.title)
    );
  });

  it("leaves no nav destination unreachable from the four tabs", async () => {
    const user = userEvent.setup();
    renderNav();

    await user.click(screen.getByRole("button", { name: /recruiting/i }));
    const fromRecruiting = sheetTitles();
    await user.click(screen.getByRole("button", { name: /close menu/i }));

    await user.click(screen.getByRole("button", { name: /settings/i }));
    const fromSettings = sheetTitles();

    // Dashboard and Playbooks are tabs in their own right.
    const reachable = new Set([...fromRecruiting, ...fromSettings, "Dashboard", "Playbooks"]);
    const everyDestination = [...new Set(navGroups.flatMap(g => g.items.map(i => i.title)))];
    expect(everyDestination.filter(t => !reachable.has(t))).toEqual([]);
  });

  it("does not list the same destination twice in the Settings sheet", async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(screen.getByRole("button", { name: /settings/i }));
    const hrefs = within(sheet()).getAllByRole("link").map(a => a.getAttribute("href"));
    expect(hrefs).toHaveLength(new Set(hrefs).size);
  });

  it("closes the sheet on Escape and restores body scroll", async () => {
    const user = userEvent.setup();
    renderNav();
    await user.click(screen.getByRole("button", { name: /settings/i }));
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("marks the tab owning the current route as current", async () => {
    renderNav("/candidates");
    expect(screen.getByRole("button", { name: /recruiting/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /home/i })).not.toHaveAttribute("aria-current");
  });
});
