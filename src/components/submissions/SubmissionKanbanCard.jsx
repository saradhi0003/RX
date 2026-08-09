import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock } from "lucide-react";
import { personName } from "@/lib/names";

export default function SubmissionKanbanCard({ submission, candidate, job, recruiter, onClick }) {
  const statusColors = {
    submitted: "bg-blue-100 text-blue-800",
    under_review: "bg-yellow-100 text-yellow-800",
    interviewing: "bg-purple-100 text-purple-800",
    rejected: "bg-red-100 text-red-800",
    hired: "bg-green-100 text-green-800",
    withdrawn: "bg-gray-100 text-gray-800",
  };

  const needsFollowUp =
    submission.follow_up_date &&
    new Date(submission.follow_up_date) <= new Date() &&
    !submission.follow_up_completed;

  return (
    <Card className="shadow-sm hover:shadow-md transition cursor-pointer" onClick={onClick}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">
              {personName(candidate, "Unknown Candidate")}
            </p>
            <p className="text-xs text-slate-600 truncate">{job?.title || "—"}</p>
          </div>
          <Badge className={statusColors[submission.status] || statusColors.submitted}>
            {submission.status?.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Calendar className="w-3 h-3" />
          <span>Subm: {new Date(submission.submitted_date || submission.created_date).toLocaleDateString()}</span>
        </div>
        {submission.follow_up_date && (
          <div className={`flex items-center gap-2 text-xs ${needsFollowUp ? "text-orange-600 font-medium" : "text-slate-600"}`}>
            <Clock className="w-3 h-3" />
            <span>Follow-up: {new Date(submission.follow_up_date).toLocaleDateString()}</span>
          </div>
        )}
        <p className="text-xs text-slate-500 truncate">{recruiter ? `${recruiter.first_name} ${recruiter.last_name}` : ""}</p>
      </CardContent>
    </Card>
  );
}