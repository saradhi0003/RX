import { describe, expect, it } from "vitest";
import { toCalendarEvent, joinLink } from "@/lib/bookingEvents";

describe("booking events", () => {
  it("drops invalid ranges so the calendar cannot crash", () => {
    expect(toCalendarEvent({ id: "1", start_at: "nope", end_at: "nope" })).toBeNull();
    expect(toCalendarEvent({
      id: "1",
      title: "Screen",
      start_at: "2026-10-04T15:00:00Z",
      end_at: "2026-10-04T15:30:00Z",
    })?.title).toBe("Screen");
  });

  it("builds a join link from the room name", () => {
    expect(joinLink("https://rx-self.vercel.app", { room_name: "meet-abc" }))
      .toBe("https://rx-self.vercel.app/VideoCall?room=meet-abc");
  });
});
