/**
 * Video Call — interview rooms backed by LiveKit.
 *
 *   Browser  →  @livekit/components-react  →  LiveKit Cloud
 *                     ↑
 *               JWT access token (signed server-side by livekitToken)
 *
 * Flow
 *   1. Lobby           — pick room name + display name
 *   2. PreJoin         — LiveKit device test + permission grant (camera/mic)
 *   3. In-call         — LiveKitRoom + VideoConference + MeetingToolbar
 *
 * Setup checklist (see also: supabase/functions/livekitToken/index-paste-version.ts)
 *   1. Create LiveKit project at cloud.livekit.io
 *   2. .env.local:   VITE_LIVEKIT_URL=wss://<project>.livekit.cloud
 *   3. Supabase secrets:  LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
 *   4. Deploy:   livekitToken Edge Function (Verify JWT off)
 *   5. Apply migration 010 for recording storage + table
 *   6. Set Supabase secret  OPENAI_API_KEY  for post-call Whisper transcripts
 *   7. Deploy:   transcribeRecording Edge Function
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, Loader2, Link2, AlertCircle, Copy, LogOut } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { User } from "@/entities/User";
import { supabase } from "@/lib/supabase";
import { addNotification } from "@/components/notifications/NotificationToast";
import "@livekit/components-styles";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  PreJoin,
} from "@livekit/components-react";
import MeetingToolbar from "@/components/video/MeetingToolbar";

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || "";

function randomRoomName() {
  const adj  = ["bright","calm","deep","fast","keen","lush","mint","quiet","swift","warm"];
  const noun = ["river","valley","summit","forest","harbor","ridge","glade","cove","plains","peak"];
  const n    = () => Math.floor(Math.random() * 900 + 100);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return `${pick(adj)}-${pick(noun)}-${n()}`;
}

export default function VideoCall() {
  const [me, setMe]               = useState(null);
  const [room, setRoom]           = useState("");
  const [identity, setIdentity]   = useState("");
  const [token, setToken]         = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError]         = useState("");
  /** lobby | prejoin | in-call */
  const [stage, setStage]         = useState("lobby");
  /** Captured by PreJoin: { videoEnabled, audioEnabled, videoDeviceId, audioDeviceId, username } */
  const [preJoinChoices, setPreJoinChoices] = useState(null);

  // ?room=<name> auto-fills the lobby
  const urlRoom = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("room") || "";
  }, []);

  useEffect(() => {
    User.me().then((u) => {
      setMe(u);
      setIdentity(u?.email || `guest-${Math.random().toString(36).slice(2, 8)}`);
    }).catch(() => {
      setIdentity(`guest-${Math.random().toString(36).slice(2, 8)}`);
    });
    if (urlRoom) setRoom(urlRoom);
  }, [urlRoom]);

  const requestToken = async () => {
    if (!LIVEKIT_URL) {
      setError("VITE_LIVEKIT_URL is not set. See setup checklist at top of src/pages/VideoCall.jsx.");
      return;
    }
    if (!room.trim())     { setError("Pick or paste a room name first."); return; }
    if (!identity.trim()) { setError("Set your display name."); return; }
    setError("");
    setConnecting(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("livekitToken", {
        body: {
          room:     room.trim(),
          identity,
          name:     me?.full_name || me?.email || identity,
        },
      });
      if (fnErr) throw new Error(fnErr.message || "Token request failed");
      if (!data?.token) throw new Error("Edge Function returned no token. Are LIVEKIT_API_KEY + LIVEKIT_API_SECRET set in Supabase secrets?");
      setToken(data.token);
      setStage("prejoin");
    } catch (e) {
      setError(e?.message || "Failed to start call");
    } finally {
      setConnecting(false);
    }
  };

  const leave = () => {
    setStage("lobby");
    setToken("");
    setPreJoinChoices(null);
  };

  const copyLink = () => {
    const link = `${window.location.origin}/VideoCall?room=${encodeURIComponent(room)}`;
    navigator.clipboard.writeText(link).then(() => {
      addNotification({ type: "success", title: "Link copied", message: "Share this with your participant." });
    });
  };

  // ── PreJoin (camera + mic preview, device picker, permission grant) ───────
  if (stage === "prejoin" && token) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-slate-950" data-lk-theme="default">
        <div className="w-full max-w-2xl">
          <PreJoin
            defaults={{ username: identity, videoEnabled: false, audioEnabled: true }}
            onSubmit={(values) => { setPreJoinChoices(values); setStage("in-call"); }}
            onError={(err) => setError(err.message)}
            joinLabel="Join Room"
            persistUserChoices={false}
          />
        </div>
      </div>
    );
  }

  // ── In-call view ──────────────────────────────────────────────────────────
  if (stage === "in-call" && token) {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-950">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-white">
          <div className="flex items-center gap-2 text-sm">
            <Video className="w-4 h-4" style={{ color: "#9333EA" }} />
            <span className="font-semibold">{room}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-300">{identity}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-white hover:bg-slate-800" onClick={copyLink}>
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy invite
            </Button>
            <Button size="sm" variant="destructive" onClick={leave}>
              <LogOut className="w-3.5 h-3.5 mr-1.5" /> Leave
            </Button>
          </div>
        </div>

        <div className="flex-1 relative" data-lk-theme="default">
          <LiveKitRoom
            token={token}
            serverUrl={LIVEKIT_URL}
            connect={true}
            video={preJoinChoices?.videoEnabled ?? false}
            audio={preJoinChoices?.audioEnabled ?? true}
            onDisconnected={leave}
            onError={(err) => {
              // "Requested device not found" / "Permission denied" / etc. shouldn't
              // crash the room — surface a hint, leave call intact (audio-only).
              const msg = err?.message || String(err);
              if (/not found|permission|notallowed|notfound/i.test(msg)) {
                addNotification({
                  type: "warning",
                  title: "Camera unavailable — joined audio-only",
                  message: msg + " · You can still talk and screen-share.",
                });
              } else {
                addNotification({ type: "error", title: "Call error", message: msg });
              }
            }}
            data-lk-theme="default"
            style={{ height: "100%" }}
          >
            <VideoConference />
            <RoomAudioRenderer />
            <MeetingToolbar room={room} identity={identity} />
          </LiveKitRoom>
        </div>
      </div>
    );
  }

  // ── Lobby (room picker) ───────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
      <PageHeader
        title="Video Call"
        subtitle="Run interviews, candidate screens, and team huddles inside Recruiter X."
      />

      {!LIVEKIT_URL && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2 text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">LiveKit not configured yet</p>
                <ol className="list-decimal pl-5 space-y-0.5 text-xs">
                  <li>Sign up at <code>cloud.livekit.io</code>.</li>
                  <li>Add <code>VITE_LIVEKIT_URL=wss://…</code> to <code>.env.local</code> and restart the dev server.</li>
                  <li>Set Supabase secrets <code>LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_URL</code>.</li>
                  <li>Deploy the <code>livekitToken</code> Edge Function (Verify JWT OFF).</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Start or join a room</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="room" className="text-sm text-slate-700">Room name</Label>
            <div className="flex gap-2">
              <Input
                id="room"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="interview-jane-doe"
                className="flex-1"
              />
              <Button variant="outline" onClick={() => setRoom(randomRoomName())} type="button">
                Suggest name
              </Button>
            </div>
            {room && (
              <button
                type="button"
                onClick={copyLink}
                className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 mt-1"
              >
                <Link2 className="w-3 h-3" /> Share link: {window.location.origin}/VideoCall?room={encodeURIComponent(room)}
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="identity" className="text-sm text-slate-700">Your display name</Label>
            <Input
              id="identity"
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          {error && (
            <div className="flex gap-2 text-red-800 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={requestToken}
              disabled={connecting || !room.trim() || !identity.trim()}
              className="gap-2 text-white"
              style={{ background: "linear-gradient(135deg,#9333EA 0%,#2563EB 100%)" }}
            >
              {connecting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
                : <><Video className="w-4 h-4" /> Next: device check</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What you'll get in the call</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-700 space-y-2">
          <p>• <strong>Device test</strong> before joining — fixes the no-camera-prompt issue.</p>
          <p>• <strong>Screenshot</strong> button captures the current frame as a PNG.</p>
          <p>• <strong>Record</strong> captures your screen + mic, uploads the .webm to Supabase Storage.</p>
          <p>• Once stopped, the recording is auto-transcribed by Whisper and the text is saved alongside it (read it later in the recordings list).</p>
        </CardContent>
      </Card>
    </div>
  );
}
