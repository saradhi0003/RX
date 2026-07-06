/**
 * MeetingToolbar — floating overlay buttons inside the LiveKit call view.
 *
 *   Screenshot     captures the current local-video frame as PNG, downloads it
 *   Record / Stop  records the user's screen (getDisplayMedia) + mic, uploads
 *                  the .webm to Supabase Storage, inserts a row, triggers
 *                  the transcribeRecording Edge Function (Whisper).
 *
 * Lives inside <LiveKitRoom>, so it can read LiveKit context hooks
 * (useLocalParticipant) for the screenshot.
 */
import { useEffect, useRef, useState } from "react";
import { Camera, Circle, Square, Loader2 } from "lucide-react";
import { useLocalParticipant } from "@livekit/components-react";
import { supabase } from "@/lib/supabase";
import { addNotification } from "@/components/notifications/NotificationToast";

function pickMime() {
  // Prefer codecs Chrome / Edge / Safari all accept.
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
}

export default function MeetingToolbar({ room, identity }) {
  const { localParticipant } = useLocalParticipant();
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [shotting, setShotting] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  /** @type {React.MutableRefObject<MediaRecorder | null>} */
  const recorderRef = useRef(null);
  /** @type {React.MutableRefObject<MediaStream | null>} */
  const streamRef = useRef(null);
  /** @type {React.MutableRefObject<Blob[]>} */
  const chunksRef = useRef([]);
  /** @type {React.MutableRefObject<number>} */
  const startedAtRef = useRef(0);
  /** @type {React.MutableRefObject<number | null>} */
  const timerRef = useRef(null);

  useEffect(() => () => {
    // On unmount, ensure we tear down the recorder + stream
    try { recorderRef.current?.state === "recording" && recorderRef.current.stop(); } catch { /* already stopped */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, []);

  // ── Screenshot ─────────────────────────────────────────────────────────────
  const handleScreenshot = async () => {
    setShotting(true);
    try {
      // Find the first publishing video track on the local participant.
      const videoPub = Array.from(localParticipant?.videoTrackPublications?.values?.() ?? []).find(
        (p) => p.track && p.kind === "video"
      );
      const mediaTrack = videoPub?.track?.mediaStreamTrack;
      if (!mediaTrack) throw new Error("No active camera — turn it on first.");

      const settings = mediaTrack.getSettings();
      const w = settings.width  || 1280;
      const h = settings.height || 720;

      // Draw the latest frame to an OffscreenCanvas via ImageCapture (Chrome) or
      // fall back to a temporary <video> element (Safari/Firefox).
      let blob;
      // @ts-ignore — ImageCapture is widely supported on Chromium browsers.
      if (typeof window.ImageCapture === "function") {
        // @ts-ignore
        const cap = new window.ImageCapture(mediaTrack);
        const bitmap = await cap.grabFrame();
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
        blob = await new Promise((r) => canvas.toBlob((b) => r(b), "image/png"));
      } else {
        const stream = new MediaStream([mediaTrack]);
        const v = document.createElement("video");
        v.srcObject = stream;
        v.muted = true;
        await v.play();
        await new Promise((r) => v.onloadedmetadata = r).catch(() => {});
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")?.drawImage(v, 0, 0, w, h);
        blob = await new Promise((r) => canvas.toBlob((b) => r(b), "image/png"));
        v.pause();
      }
      if (!blob) throw new Error("Capture returned no image.");

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${room || "call"}-${new Date().toISOString().replace(/[:.]/g,"-")}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);

      addNotification({ type: "success", title: "Screenshot saved", message: a.download });
    } catch (err) {
      addNotification({ type: "error", title: "Screenshot failed", message: err?.message || String(err) });
    } finally {
      setShotting(false);
    }
  };

  // ── Recording — start ──────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      // Capture whatever the user picks (a tab, a window, or the full screen)
      // + the user's mic.
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,            // optional; some browsers ignore
      });
      let mic;
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch { /* no mic granted — record without */ }

      // Mix display audio + mic audio into one stream if both exist.
      const tracks = [...display.getVideoTracks()];
      if (display.getAudioTracks().length) tracks.push(...display.getAudioTracks());
      if (mic) tracks.push(...mic.getAudioTracks());
      const stream = new MediaStream(tracks);
      streamRef.current = stream;

      const mime = pickMime();
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = handleStopUpload;
      recorderRef.current = rec;

      // Stop everything if the user uses the browser's native "Stop sharing" pill.
      display.getVideoTracks()[0].addEventListener("ended", () => {
        if (rec.state === "recording") rec.stop();
      });

      rec.start(1000);  // emit chunks every 1s
      startedAtRef.current = Date.now();
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 1000);
      addNotification({ type: "info", title: "Recording started", message: "Click Stop to upload." });
    } catch (err) {
      addNotification({ type: "error", title: "Recording failed", message: err?.message || String(err) });
    }
  };

  // ── Recording — stop ───────────────────────────────────────────────────────
  const stopRecording = () => {
    try {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
      setRecording(false);
    } catch (err) {
      addNotification({ type: "error", title: "Stop failed", message: err?.message || String(err) });
    }
  };

  // ── Stop handler: upload + insert row + invoke transcribe ─────────────────
  const handleStopUpload = async () => {
    setUploading(true);
    try {
      const mime = recorderRef.current?.mimeType || "video/webm";
      const ext  = mime.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type: mime });
      const duration = (Date.now() - startedAtRef.current) / 1000;
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const safeRoom = (room || "call").replace(/[^a-z0-9-]/gi, "-");
      const filePath = `${safeRoom}/${ts}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("meeting-recordings")
        .upload(filePath, blob, { contentType: mime, upsert: false });
      if (upErr) throw upErr;

      const { data: row, error: insErr } = await supabase
        .from("video_call_recordings")
        .insert({
          room: room || null,
          owner_email: identity || null,
          file_path: filePath,
          duration_seconds: duration,
          size_bytes: blob.size,
          mime_type: mime,
          status: "uploaded",
        })
        .select()
        .single();
      if (insErr) throw insErr;

      addNotification({
        type: "success",
        title: "Recording saved",
        message: `${(blob.size / (1024 * 1024)).toFixed(1)} MB · transcribing…`,
      });

      // Kick off Whisper transcription. Fire-and-forget — the row's `status`
      // column tracks the result.
      supabase.functions
        .invoke("transcribeRecording", { body: { recording_id: row.id } })
        .then(({ error }) => {
          if (error) {
            addNotification({
              type: "warning",
              title: "Transcription queued — error",
              message: error.message || "See video_call_recordings.error",
            });
          } else {
            addNotification({ type: "success", title: "Transcript ready" });
          }
        });
    } catch (err) {
      addNotification({ type: "error", title: "Upload failed", message: err?.message || String(err) });
    } finally {
      setUploading(false);
      setElapsed(0);
      chunksRef.current = [];
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const m = (s) => `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s % 60).padStart(2,"0")}`;

  return (
    <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-slate-900/90 backdrop-blur px-3 py-2 rounded-xl border border-slate-700 shadow-2xl">
      <button
        onClick={handleScreenshot}
        disabled={shotting}
        className="flex items-center gap-1.5 text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-xs font-medium disabled:opacity-50"
        title="Capture current frame as PNG"
      >
        {shotting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
        Screenshot
      </button>

      {!recording && !uploading && (
        <button
          onClick={startRecording}
          className="flex items-center gap-1.5 text-white px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 transition-colors text-xs font-medium"
          title="Capture screen + mic to Supabase Storage"
        >
          <Circle className="w-3.5 h-3.5 fill-current" /> Record
        </button>
      )}

      {recording && (
        <button
          onClick={stopRecording}
          className="flex items-center gap-2 text-white px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 transition-colors text-xs font-medium"
        >
          <Square className="w-3 h-3 fill-current" />
          <span className="font-mono">{m(elapsed)}</span>
          <span>Stop</span>
        </button>
      )}

      {uploading && (
        <span className="flex items-center gap-1.5 text-amber-200 text-xs font-medium px-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…
        </span>
      )}
    </div>
  );
}
