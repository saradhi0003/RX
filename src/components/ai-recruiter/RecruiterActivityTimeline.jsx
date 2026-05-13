import { useState, useEffect } from "react";
import { RecruiterActivity } from "@/entities/RecruiterActivity";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";

/** @type {Record<string, string>} */
const ICONS = {
  ai_job_parsed:           "📋",
  ai_candidates_matched:   "✅",
  ai_candidate_selected:   "📌",
  ai_email_draft_created:  "✉️",
  ai_email_draft_approved: "👍",
  ai_email_draft_rejected: "❌",
  ai_submission_created:   "📤",
  ai_task_created:         "✔️",
  ai_error:                "⚠️",
};

/** @type {Record<string, string>} */
const COLORS = {
  ai_job_parsed:           "bg-blue-50 border-blue-200",
  ai_candidates_matched:   "bg-green-50 border-green-200",
  ai_email_draft_created:  "bg-purple-50 border-purple-200",
  ai_email_draft_approved: "bg-green-50 border-green-200",
  ai_email_draft_rejected: "bg-red-50 border-red-200",
  ai_submission_created:   "bg-blue-50 border-blue-200",
  ai_task_created:         "bg-yellow-50 border-yellow-200",
  ai_error:                "bg-red-50 border-red-200",
};

/** @param {{ runId: string }} props */
export default function RecruiterActivityTimeline({ runId }) {
  const [activities, setActivities] = useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await RecruiterActivity.filter({ run_id: runId }, "-created_at", 50);
      setActivities(data);
    } catch (err) {
      console.error("Failed to load activities:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
   
  }, [runId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading activity…
      </div>
    );
  }

  if (activities.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Activity Timeline</h3>
        <button onClick={load} className="text-xs text-primary hover:underline">Refresh</button>
      </div>

      <div className="space-y-2.5">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`border rounded-lg p-3 ${COLORS[activity.activity_type] || "bg-gray-50 border-gray-200"}`}
          >
            <div className="flex gap-3">
              <span className="text-base leading-none mt-0.5" role="img" aria-hidden>
                {ICONS[activity.activity_type] || "•"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{activity.title}</p>
                {activity.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{activity.description}</p>
                )}
              </div>
              <time className="text-xs text-muted-foreground whitespace-nowrap self-start">
                {activity.created_date
                  ? format(new Date(activity.created_date), "HH:mm")
                  : ""}
              </time>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
