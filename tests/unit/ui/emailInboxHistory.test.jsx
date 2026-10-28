// Email Inbox → History: provenance badges + filter (migration 036) and the
// error state that replaced a toast over a silently empty list.
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { server } from "../msw/server";
import EmailInbox from "@/pages/EmailInbox";

const SUPABASE = "https://bwjfglerixssibenkjse.supabase.co";

const row = (over) => ({
  id: over.message_id,
  from_email: "someone@example.com",
  to_email: "jobs@talentstack.example",
  processing_status: "processed",
  created_at: "2026-10-28T10:00:00Z",
  ...over,
});

const ROWS = [
  row({ message_id: "gmail-1", subject: "Senior Java Developer", ingest_channel: "bot_ingest", source: "gmail", classification: "job" }),
  row({ message_id: "zoho-2", subject: "Application — Data Engineer", ingest_channel: "bot_ingest", source: "zoho", classification: "resume" }),
  row({ message_id: "pm-3", subject: "QA Engineer opening", ingest_channel: "postmark_webhook", source: "postmark" }),
  // Written before 036: no channel, but a linked mailbox still identifies the poller.
  row({ message_id: "old-4", subject: "Legacy polled mail", email_account_id: "acc-1" }),
  row({
    message_id: "gmail-5", subject: "Hiring: Python Dev", ingest_channel: "bot_ingest", source: "gmail",
    processing_status: "failed", error_message: "Classifier unavailable — reprocess this email once the LLM is reachable.",
  }),
];

function renderHistory() {
  render(
    <MemoryRouter>
      <EmailInbox />
    </MemoryRouter>,
  );
  return userEvent.setup();
}

describe("EmailInbox history", () => {
  it("labels each row by how it arrived and filters by channel", async () => {
    server.use(http.get(`${SUPABASE}/rest/v1/inbound_emails`, () => HttpResponse.json(ROWS)));
    const user = renderHistory();
    await user.click(screen.getByRole("tab", { name: "Email History" }));

    expect(await screen.findByText("Senior Java Developer")).toBeInTheDocument();
    expect(screen.getAllByText("Bot · Gmail")).toHaveLength(2);
    expect(screen.getByText("Bot · Zoho")).toBeInTheDocument();
    expect(screen.getByText("Legacy polled mail")).toBeInTheDocument();

    const filters = screen.getByRole("group", { name: /filter by how the email arrived/i });
    expect(within(filters).getByRole("button", { name: /^All\s*5$/ })).toHaveAttribute("aria-pressed", "true");

    await user.click(within(filters).getByRole("button", { name: /^Bot\s*3$/ }));
    expect(screen.getByText("Senior Java Developer")).toBeInTheDocument();
    expect(screen.queryByText("QA Engineer opening")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy polled mail")).not.toBeInTheDocument();

    await user.click(within(filters).getByRole("button", { name: /^Mailbox\s*1$/ }));
    expect(screen.getByText("Legacy polled mail")).toBeInTheDocument();
    expect(screen.queryByText("Senior Java Developer")).not.toBeInTheDocument();

    await user.click(within(filters).getByRole("button", { name: /^Manual\s*0$/ }));
    expect(screen.getByText("No Manual emails")).toBeInTheDocument();
  });

  it("shows why a failed email failed", async () => {
    server.use(http.get(`${SUPABASE}/rest/v1/inbound_emails`, () => HttpResponse.json(ROWS)));
    const user = renderHistory();
    await user.click(screen.getByRole("tab", { name: "Email History" }));
    expect(await screen.findByText(/Classifier unavailable/)).toBeInTheDocument();
  });

  it("renders an error with Retry instead of an empty list when the load fails", async () => {
    let calls = 0;
    server.use(
      http.get(`${SUPABASE}/rest/v1/inbound_emails`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ message: "permission denied for table inbound_emails" }, { status: 403 })
          : HttpResponse.json(ROWS);
      }),
    );
    const user = renderHistory();
    await user.click(screen.getByRole("tab", { name: "Email History" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Could not load emails: permission denied/);
    expect(screen.queryByText("No emails yet")).not.toBeInTheDocument();

    await user.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Senior Java Developer")).toBeInTheDocument();
  });
});
