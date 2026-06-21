/**
 * BookingForm — modal used to create or edit a booking.
 *
 * Props:
 *   booking?    pre-filled fields when editing; null for new
 *   defaultStart, defaultEnd  used when the user clicked an empty calendar slot
 *   onSave(values)            parent persists via Booking.create/update
 *   onCancel()
 *   onDelete?(id)             parent confirms + deletes (edit mode only)
 *
 * The form purposefully stays minimal — date+time, who, what. Linked candidate
 * and job are auto-suggested by typing.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X, Trash2, Loader2, Calendar as CalIcon, Video, ExternalLink } from "lucide-react";
import { Candidate } from "@/entities/Candidate";
import { Job } from "@/entities/Job";

function toLocalInput(dt) {
  if (!dt) return "";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return "";
  // datetime-local needs YYYY-MM-DDTHH:mm in local time
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BookingForm({ booking, defaultStart, defaultEnd, onSave, onCancel, onDelete }) {
  const editing = !!booking?.id;
  const [saving, setSaving] = useState(false);

  const [title, setTitle]               = useState(booking?.title || "");
  const [description, setDescription]   = useState(booking?.description || "");
  const [startAt, setStartAt]           = useState(toLocalInput(booking?.start_at || defaultStart));
  const [endAt, setEndAt]               = useState(toLocalInput(booking?.end_at || defaultEnd));
  const [guestName, setGuestName]       = useState(booking?.guest_name || "");
  const [guestEmail, setGuestEmail]     = useState(booking?.guest_email || "");
  const [candidateId, setCandidateId]   = useState(booking?.candidate_id || "");
  const [jobId, setJobId]               = useState(booking?.job_id || "");
  const [error, setError]               = useState("");

  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs]             = useState([]);

  useEffect(() => {
    Candidate.list("-created_at", 200).then(setCandidates).catch(() => {});
    Job.list("-created_at", 200).then(setJobs).catch(() => {});
  }, []);

  // When the user picks a candidate, auto-fill guest name+email
  useEffect(() => {
    if (!candidateId) return;
    const c = candidates.find((x) => x.id === candidateId);
    if (c) {
      if (!guestName)  setGuestName(c.full_name || `${c.first_name || ""} ${c.last_name || ""}`.trim());
      if (!guestEmail) setGuestEmail(c.email || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId, candidates]);

  const meetingUrl = useMemo(() => {
    if (!booking?.room_name) return null;
    return `${window.location.origin}/VideoCall?room=${encodeURIComponent(booking.room_name)}`;
  }, [booking?.room_name]);

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError("");
    if (!title.trim())  { setError("Title is required"); return; }
    if (!startAt)       { setError("Start time is required"); return; }
    if (!endAt)         { setError("End time is required"); return; }
    if (new Date(endAt) <= new Date(startAt)) { setError("End must be after start"); return; }

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        start_at: new Date(startAt).toISOString(),
        end_at:   new Date(endAt).toISOString(),
        guest_name:  guestName.trim() || null,
        guest_email: guestEmail.trim() || null,
        candidate_id: candidateId || null,
        job_id:       jobId       || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    } catch (err) {
      setError(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                 style={{ background: "linear-gradient(135deg,#FAF5FF 0%,#EFF6FF 100%)" }}>
              <CalIcon className="w-4 h-4" style={{ color: "#9333EA" }} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[.08em]" style={{ color: "#9333EA" }}>
                {editing ? "Edit booking" : "New booking"}
              </div>
              <h3 className="font-semibold text-slate-900 text-sm -mt-0.5">
                {editing ? booking.title : "Schedule a meeting"}
              </h3>
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Screening call — Jane Doe"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start_at">Starts</Label>
                <Input id="start_at" type="datetime-local" value={startAt}
                       onChange={(e) => setStartAt(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end_at">Ends</Label>
                <Input id="end_at" type="datetime-local" value={endAt}
                       onChange={(e) => setEndAt(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="guest_name">Guest name</Label>
                <Input id="guest_name" value={guestName}
                       onChange={(e) => setGuestName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guest_email">Guest email</Label>
                <Input id="guest_email" type="email" value={guestEmail}
                       onChange={(e) => setGuestEmail(e.target.value)} placeholder="jane@example.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="candidate_id">Linked candidate</Label>
                <select
                  id="candidate_id"
                  value={candidateId}
                  onChange={(e) => setCandidateId(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm bg-white"
                >
                  <option value="">— none —</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="job_id">Linked job</Label>
                <select
                  id="job_id"
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm bg-white"
                >
                  <option value="">— none —</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Agenda / notes</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What you want to cover. Sent in the invite email."
                rows={3}
              />
            </div>

            {meetingUrl && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Meeting link</div>
                    <a
                      href={meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-blue-700 hover:underline break-all inline-flex items-center gap-1"
                    >
                      {meetingUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => window.open(meetingUrl, "_blank")}
                    className="text-white gap-1 shrink-0"
                    style={{ background: "linear-gradient(135deg,#9333EA 0%,#2563EB 100%)" }}
                  >
                    <Video className="w-3.5 h-3.5" /> Join
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</div>
            )}
          </CardContent>

          <div className="flex items-center justify-between gap-2 px-6 py-3 border-t border-slate-200">
            {editing ? (
              <Button type="button" variant="ghost" className="text-red-600 hover:bg-red-50 gap-1"
                      onClick={() => onDelete?.(booking.id)}>
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
              <Button
                type="submit"
                disabled={saving}
                className="text-white gap-2"
                style={{ background: "linear-gradient(135deg,#9333EA 0%,#2563EB 100%)" }}
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : (editing ? "Save changes" : "Create booking")}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
