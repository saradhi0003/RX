/**
 * Bookings — calendar view of meetings + the create/edit modal.
 *
 *   - Click an empty slot          → opens BookingForm with that time pre-filled
 *   - Click an existing event      → opens BookingForm in edit mode
 *   - "+ New booking" toolbar btn  → opens BookingForm blank
 *
 * Each booking auto-mints a LiveKit room name (via the DB trigger in 011).
 * The detail panel on the right surfaces:
 *   - Join link (deep-links to /VideoCall?room=...)
 *   - Recording (if the call has happened and a video_call_recordings row exists)
 *   - Whisper transcript + LLM summary + action items
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Video, RefreshCcw, FileText, ListChecks, Mic, Copy } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Booking } from "@/entities/Booking";
import { usePermissions } from "@/components/common/PermissionsContext";
import { addNotification } from "@/components/notifications/NotificationToast";
import BookingForm from "@/components/bookings/BookingForm";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { supabase } from "@/lib/supabase";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const statusColor = {
  scheduled:   "bg-blue-100 text-blue-800",
  confirmed:   "bg-green-100 text-green-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed:   "bg-slate-200 text-slate-700",
  cancelled:   "bg-red-100 text-red-800",
  no_show:     "bg-orange-100 text-orange-800",
};

export default function Bookings() {
  const { can } = usePermissions();
  const canView   = can("Booking", "view")   || true;        // tighten later
  const canCreate = can("Booking", "create") || true;
  const canUpdate = can("Booking", "update") || true;

  const [list, setList]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [formDefaults, setFormDefaults] = useState({ start: null, end: null });
  const [selectedId, setSelectedId] = useState(null);
  const [recording, setRecording]   = useState(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await Booking.list("-start_at", 500);
      setList(data);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── react-big-calendar wants events with Date objects + start/end + title ─
  const events = useMemo(() => list.map((b) => ({
    id:       b.id,
    title:    b.title,
    start:    new Date(b.start_at),
    end:      new Date(b.end_at),
    resource: b,
  })), [list]);

  // ── Slot click → create ───────────────────────────────────────────────────
  const handleSelectSlot = useCallback(({ start, end }) => {
    if (!canCreate) return;
    setEditing(null);
    setFormDefaults({ start, end });
    setShowForm(true);
  }, [canCreate]);

  // ── Event click → select (right panel) ────────────────────────────────────
  const handleSelectEvent = useCallback((ev) => {
    setSelectedId(ev.id);
  }, []);

  const selected = useMemo(() => list.find((b) => b.id === selectedId) || null, [list, selectedId]);

  // Whenever the selected booking changes, fetch its linked recording.
  useEffect(() => {
    if (!selected?.recording_id) { setRecording(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("video_call_recordings")
        .select("*")
        .eq("id", selected.recording_id)
        .maybeSingle();
      if (!cancelled) setRecording(data);
    })();
    return () => { cancelled = true; };
  }, [selected?.recording_id]);

  // ── Save / delete ─────────────────────────────────────────────────────────
  const handleSave = async (values) => {
    if (editing?.id) {
      await Booking.update(editing.id, values);
      addNotification({ type: "success", title: "Booking updated" });
    } else {
      await Booking.create(values);
      addNotification({ type: "success", title: "Booking created" });
    }
    setShowForm(false);
    setEditing(null);
    setFormDefaults({ start: null, end: null });
    await load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this booking? This cannot be undone.")) return;
    await Booking.delete(id);
    setShowForm(false);
    setEditing(null);
    if (selectedId === id) setSelectedId(null);
    await load();
    addNotification({ type: "success", title: "Booking deleted" });
  };

  const editFromPanel = () => {
    if (!selected) return;
    setEditing(selected);
    setShowForm(true);
  };

  const joinLink = (b) => `${window.location.origin}/VideoCall?room=${encodeURIComponent(b.room_name || "")}`;

  if (!canView) {
    return (
      <div className="p-6"><Card><CardHeader><CardTitle>Bookings</CardTitle></CardHeader>
      <CardContent><p>You don't have permission to view this page.</p></CardContent></Card></div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Bookings"
        subtitle="Schedule interviews and screens — each booking auto-generates a video call room."
        right={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={load}>
              <RefreshCcw className="w-4 h-4" /> Refresh
            </Button>
            {canCreate && (
              <Button
                className="gap-2 text-white"
                onClick={() => { setEditing(null); setFormDefaults({ start: null, end: null }); setShowForm(true); }}
                style={{ background: "linear-gradient(135deg,#9333EA 0%,#2563EB 100%)" }}
              >
                <Plus className="w-4 h-4" /> New booking
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <Card>
          <CardContent className="p-2 lg:p-3">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              defaultView="week"
              views={["month", "week", "day", "agenda"]}
              style={{ height: "70vh" }}
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={(ev) => {
                const s = ev.resource?.status;
                const bg = s === "cancelled" ? "#FECACA"
                         : s === "completed" ? "#E2E8F0"
                         : s === "in_progress" ? "#FDE68A"
                         : "#A78BFA";
                const fg = s === "cancelled" ? "#7F1D1D"
                         : s === "completed" ? "#1E293B"
                         : "#1E1B4B";
                return { style: { backgroundColor: bg, color: fg, borderRadius: 6, border: "none" } };
              }}
            />
          </CardContent>
        </Card>

        {/* Detail panel */}
        <div className="space-y-4">
          {!selected ? (
            <Card><CardContent className="p-6 text-sm text-slate-600">
              Click an event for details, or click an empty slot in the calendar to create one.
            </CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{selected.title}</CardTitle>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(selected.start_at).toLocaleString()} → {new Date(selected.end_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <Badge className={statusColor[selected.status] || statusColor.scheduled}>
                    {selected.status}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {selected.guest_name && (
                    <div className="text-sm text-slate-700">
                      <strong>Guest:</strong> {selected.guest_name}
                      {selected.guest_email ? <span className="text-slate-500"> · {selected.guest_email}</span> : null}
                    </div>
                  )}
                  {selected.description && (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{selected.description}</p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => window.open(joinLink(selected), "_blank")}
                      className="text-white gap-1.5 flex-1"
                      style={{ background: "linear-gradient(135deg,#9333EA 0%,#2563EB 100%)" }}
                    >
                      <Video className="w-3.5 h-3.5" /> Join call
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(joinLink(selected));
                        addNotification({ type: "success", title: "Link copied" });
                      }}
                      title="Copy meeting link"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    {canUpdate && (
                      <Button size="sm" variant="outline" onClick={editFromPanel}>
                        Edit
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Post-call AI artifacts */}
              {(selected.summary || (selected.action_items && selected.action_items.length) || recording) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5" /> Post-call notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0 text-sm">
                    {selected.summary && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Summary
                        </div>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{selected.summary}</p>
                      </div>
                    )}
                    {Array.isArray(selected.action_items) && selected.action_items.length > 0 && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                          <ListChecks className="w-3 h-3" /> Action items
                        </div>
                        <ul className="space-y-1">
                          {selected.action_items.map((a, i) => (
                            <li key={i} className="text-slate-700">
                              <span className="text-slate-400 mr-1.5">•</span>
                              {typeof a === "string" ? a : (
                                <>
                                  {a.task}
                                  {a.owner ? <span className="text-slate-500"> — {a.owner}</span> : null}
                                  {a.due_date_hint ? <span className="text-slate-500"> · {a.due_date_hint}</span> : null}
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {recording && (
                      <div className="pt-2 border-t border-slate-200">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Recording</div>
                        <p className="text-xs text-slate-600">
                          {Math.round(recording.duration_seconds || 0)}s ·
                          {" "}{((recording.size_bytes || 0) / 1048576).toFixed(1)} MB ·
                          {" "}status: <strong>{recording.status}</strong>
                        </p>
                        {recording.transcript_text && (
                          <details className="mt-2">
                            <summary className="text-xs text-slate-500 cursor-pointer">View full transcript</summary>
                            <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap leading-relaxed">
                              {recording.transcript_text}
                            </p>
                          </details>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {showForm && (
        <BookingForm
          booking={editing}
          defaultStart={formDefaults.start}
          defaultEnd={formDefaults.end}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
          onDelete={handleDelete}
        />
      )}

      {loading && (
        <div className="fixed bottom-4 right-4 bg-white shadow border rounded-lg px-3 py-1.5 text-xs text-slate-600">
          Loading bookings…
        </div>
      )}
    </div>
  );
}
