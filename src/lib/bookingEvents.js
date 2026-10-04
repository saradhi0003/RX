/** Map booking rows to calendar events. Drops rows that would crash the calendar. */
export function toCalendarEvent(booking) {
  if (!booking?.id || !booking.start_at || !booking.end_at) return null;
  const start = new Date(booking.start_at);
  const end = new Date(booking.end_at);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  return {
    id: booking.id,
    title: booking.title || "Untitled booking",
    start,
    end,
    resource: booking,
  };
}

export function joinLink(origin, booking) {
  const room = booking?.room_name || booking?.id || "";
  if (!room) return "";
  return `${origin}/VideoCall?room=${encodeURIComponent(room)}`;
}
