/**
 * Bookings — week calendar plus a detail panel.
 * moment localizer: date-fns v3 breaks react-big-calendar and blanked this page.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Video, RefreshCcw, FileText, ListChecks, Mic, Copy, Loader2 } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Booking } from "@/entities/Booking";
import { usePermissions } from "@/components/common/PermissionsContext";
import { addNotification } from "@/components/notifications/NotificationToast";
import BookingForm from "@/components/bookings/BookingForm";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { supabase } from "@/lib/supabase";
import { joinLink as buildJoinLink, toCalendarEvent } from "@/lib/bookingEvents";

const localizer = momentLocalizer(moment);

const statusColor = {
  scheduled: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-slate-200 text-slate-700",
  cancelled: "bg-red-100 text-red-800",
  no_show: "bg-orange-100 text-orange-800",
};

export default function Bookings() {
  const { can } = usePermissions();
  const canView = can("Booking", "view") !== false;
  const canCreate = can("Booking", "create") !== false;
  const canUpdate = can("Booking", "update") !== false;
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formDefaults, setFormDefaults] = useState({ start: null, end: null });
  const [selectedId, setSelectedId] = useState(null);
  const [recording, setRecording] = useState(null);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await Booking.list("-start_at", 500);
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const events = useMemo(() => list.map(toCalendarEvent).filter(Boolean), [list]);
  const dropped = list.length - events.length;
  const handleSelectSlot = useCallback(({ start, end }) => {
    if (!canCreate) return;
    setEditing(null);
    setFormDefaults({ start, end });
    setShowForm(true);
  }, [canCreate]);
  const handleSelectEvent = useCallback((ev) => setSelectedId(ev.id), []);
  const handleDoubleClickEvent = useCallback((ev) => {
    setSelectedId(ev.id);
    if (!canUpdate) return;
    setEditing(ev.resource);
    setShowForm(true);
  }, [canUpdate]);
  const selected = useMemo(() => list.find((b) => b.id === selectedId) || null, [list, selectedId]);

  useEffect(() => {
    if (!selected?.recording_id) { setRecording(null); return; }
    let cancelled = false;
    (async () => {
      const { data, error: recErr } = await supabase.from("video_call_recordings").select("*").eq("id", selected.recording_id).maybeSingle();
      if (!cancelled) setRecording(recErr ? null : data);
    })();
    return () => { cancelled = true; };
  }, [selected?.recording_id]);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      if (editing?.id) {
        await Booking.update(editing.id, values);
        addNotification({ type: "success", title: "Booking updated" });
      } else {
        const created = await Booking.create(values);
        if (created?.id) setSelectedId(created.id);
        addNotification({ type: "success", title: "Booking created" });
      }
      setShowForm(false);
      setEditing(null);
      setFormDefaults({ start: null, end: null });
      await load();
    } finally { setSaving(false); }
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
  const setStatus = async (status) => {
    if (!selected?.id) return;
    setSaving(true);
    try {
      await Booking.update(selected.id, { status });
      setList((rows) => rows.map((row) => row.id === selected.id ? { ...row, status } : row));
      addNotification({ type: "success", title: `Marked ${status.replace("_", " ")}` });
    } catch (err) {
      addNotification({ type: "error", title: "Status update failed", message: err?.message || "Try again" });
    } finally { setSaving(false); }
  };
  const joinLink = (b) => buildJoinLink(window.location.origin, b);
  const copyLink = async (b) => {
    const link = joinLink(b);
    if (!link) return addNotification({ type: "error", title: "No room yet" });
    try { await navigator.clipboard.writeText(link); addNotification({ type: "success", title: "Link copied" }); }
    catch { addNotification({ type: "error", title: "Copy failed", message: link }); }
  };

  if (!canView) return <div className="rx-surface p-6"><Card><CardContent className="p-6">You don't have permission to view this page.</CardContent></Card></div>;

  return (
    <div className="rx-surface p-6 lg:p-8 space-y-6">
      <PageHeader title="Bookings" subtitle="Schedule interviews and screens. Each booking opens a video room." right={
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={load} disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />} Refresh</Button>
          {canCreate && <Button className="gap-2 text-white" style={{ background: "linear-gradient(135deg,#9333EA 0%,#2563EB 100%)" }} onClick={() => { setEditing(null); setFormDefaults({ start: null, end: null }); setShowForm(true); }}><Plus className="w-4 h-4" /> New booking</Button>}
        </div>
      } />
      {error && <div className="rx-banner flex items-center justify-between gap-3"><span>{error}</span><Button size="sm" variant="outline" onClick={load}>Retry</Button></div>}
      {dropped > 0 && <div className="text-xs text-amber-700">Skipped {dropped} booking{dropped === 1 ? "" : "s"} with a missing or invalid time.</div>}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <Card className={loading ? "rx-busy" : ""}><CardContent className="p-2 lg:p-3"><div className="rx-calendar">
          <Calendar localizer={localizer} events={events} startAccessor="start" endAccessor="end" defaultView={narrow ? "agenda" : "week"} views={["month","week","day","agenda"]} style={{ height: narrow ? "100%" : 680 }} selectable longPressThreshold={1} onSelectSlot={handleSelectSlot} onSelectEvent={handleSelectEvent} onDoubleClickEvent={handleDoubleClickEvent} popup eventPropGetter={(ev) => {
            const s = ev.resource?.status;
            const bg = s === "cancelled" ? "#FECACA" : s === "completed" ? "#E2E8F0" : s === "in_progress" ? "#FDE68A" : s === "confirmed" ? "#BBF7D0" : "#C4B5FD";
            return { style: { backgroundColor: bg, color: "#1E1B4B", borderRadius: 6, border: "none" } };
          }} />
        </div></CardContent></Card>
        <div className="space-y-4">
          {!selected ? <Card><CardContent className="p-6 text-sm text-slate-600">Click an event for details. Double-click it to edit. Click an empty slot to create one.</CardContent></Card> : (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                <div className="min-w-0"><CardTitle className="text-base truncate">{selected.title}</CardTitle><p className="text-xs text-slate-500 mt-0.5">{new Date(selected.start_at).toLocaleString()} → {new Date(selected.end_at).toLocaleTimeString()}</p></div>
                <Badge className={statusColor[selected.status] || statusColor.scheduled}>{selected.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {selected.guest_name && <div className="text-sm"><strong>Guest:</strong> {selected.guest_name}{selected.guest_email ? ` · ${selected.guest_email}` : ""}</div>}
                {selected.description && <p className="text-sm whitespace-pre-wrap">{selected.description}</p>}
                {recording?.transcript_text && <p className="text-xs text-slate-500">Recording ready · {recording.status}</p>}
                <div className="flex gap-2">
                  <Button size="sm" disabled={!joinLink(selected)} onClick={() => window.open(joinLink(selected), "_blank")} className="text-white gap-1.5 flex-1" style={{ background: "linear-gradient(135deg,#9333EA 0%,#2563EB 100%)" }}><Video className="w-3.5 h-3.5" /> Join call</Button>
                  <Button size="sm" variant="outline" onClick={() => copyLink(selected)}><Copy className="w-3.5 h-3.5" /></Button>
                  {canUpdate && <Button size="sm" variant="outline" onClick={() => { setEditing(selected); setShowForm(true); }}>Edit</Button>}
                </div>
                {canUpdate && <div className="flex flex-wrap gap-1.5">{["confirmed","in_progress","completed","no_show","cancelled"].map((status) => <Button key={status} size="sm" variant={selected.status === status ? "default" : "outline"} disabled={saving} onClick={() => setStatus(status)}>{status.replace("_", " ")}</Button>)}</div>}
                {selected.summary && <p className="text-sm whitespace-pre-wrap"><FileText className="w-3 h-3 inline" /> {selected.summary}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {showForm && <BookingForm booking={editing} defaultStart={formDefaults.start} defaultEnd={formDefaults.end} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} onDelete={editing?.id ? handleDelete : undefined} />}
    </div>
  );
}
