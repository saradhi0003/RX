
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, MapPin, ExternalLink, Edit, ArrowUpRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Candidate } from "@/entities/Candidate";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

const statusOptions = [
  { value: "our_bench", label: "Our Bench" },
  { value: "active", label: "Active" },
  { value: "placed", label: "Placed" },
  { value: "inactive", label: "Inactive" },
  { value: "do_not_contact", label: "Do Not Contact" }
];

const getStatusBadge = (s) => {
  switch ((s || "").toLowerCase()) {
    case "our_bench": return "bg-purple-100 text-purple-800";
    case "active": return "bg-green-100 text-green-800";
    case "placed": return "bg-blue-100 text-blue-800";
    case "inactive": return "bg-slate-100 text-slate-800";
    case "do_not_contact": return "bg-red-100 text-red-800";
    default: return "bg-slate-100 text-slate-700";
  }
};

export default function CandidatePreview({ candidate, onEdit, onUpdated }) {
  const [updating, setUpdating] = React.useState(false);
  const [status, setStatus] = React.useState(candidate.status);

  React.useEffect(() => setStatus(candidate.status), [candidate.status]);

  const updateStatus = async (val) => {
    if (!val || val === status) return;
    setUpdating(true);
    await Candidate.update(candidate.id, { status: val });
    setUpdating(false);
    setStatus(val);
    onUpdated?.();
  };

  const initials = `${(candidate.first_name || "?").charAt(0)}${(candidate.last_name || "").charAt(0)}`.toUpperCase();

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center justify-center">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-900 truncate">
                  {candidate.first_name} {candidate.last_name}
                </h2>
                <Link to={createPageUrl(`CandidateDetails?id=${candidate.id}`)} title="Open full details">
                  <ArrowUpRight className="w-4 h-4 text-slate-500" />
                </Link>
              </div>
              <p className="text-sm text-slate-600">{candidate.current_title || "Not specified"}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              data-intent="edit"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Close the preview and navigate to the edit page
                try { window.dispatchEvent(new Event("preview:close")); } catch (error) {
                    console.error("Failed to dispatch preview:close event:", error);
                }
                const url = createPageUrl(`CandidateDetails?id=${candidate.id}&mode=edit`);
                window.location.href = url;
              }}
              className="ml-auto gap-2"
              aria-label="Edit (opens full edit page)"
            >
              <Edit className="w-4 h-4" /> Edit
            </Button>
          </div>
          {/* Contact info, links */}
          <div className="mt-3 space-y-2 text-sm">
            {candidate.email && (
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="w-4 h-4 text-slate-500" /> {candidate.email}
              </div>
            )}
            {candidate.phone && (
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="w-4 h-4 text-slate-500" /> {candidate.phone}
              </div>
            )}
            {(candidate.location || candidate.salary_expectation) && (
              <div className="flex items-center gap-2 text-slate-700">
                <MapPin className="w-4 h-4 text-slate-500" />
                <span>{candidate.location || "—"}</span>
                {candidate.salary_expectation ? <span className="text-slate-400">•</span> : null}
                {candidate.salary_expectation ? <span>${Number(candidate.salary_expectation).toLocaleString()}</span> : null}
              </div>
            )}
            {candidate.linkedin_url && (
              <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:text-blue-800">
                <ExternalLink className="w-4 h-4" />
                LinkedIn Profile
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current status */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Current Status</p>
            <Badge className={getStatusBadge(status)}>{(status || "").replace(/_/g, " ")}</Badge>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Update Status</p>
            <Select value={status} onValueChange={updateStatus} disabled={updating}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Change status..." />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Additional info */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium text-slate-700">Additional Information</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-slate-500">Experience</p>
              <p className="font-medium">{candidate.experience_years ? `${candidate.experience_years} years` : "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">Source</p>
              <p className="font-medium">{candidate.source || "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">Work Auth</p>
              <p className="font-medium">{candidate.work_authorization || "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">Added</p>
              <p className="font-medium">{new Date(candidate.created_date).toLocaleDateString()}</p>
            </div>
          </div>
          {Array.isArray(candidate.skills) && candidate.skills.length > 0 && (
            <div className="mt-2">
              <p className="text-slate-500 text-sm mb-1">Skills</p>
              <div className="flex flex-wrap gap-1">
                {candidate.skills.slice(0, 10).map((s, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                ))}
                {candidate.skills.length > 10 && (
                  <Badge variant="outline" className="text-xs">+{candidate.skills.length - 10}</Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
