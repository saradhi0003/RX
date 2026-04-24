import React from "react";
import { Loader2, Briefcase, Building2, MapPin, Calendar, ExternalLink, Edit, ArrowUpRight, DollarSign, Clock, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const STATUS_OPTS = [
  { value: "draft",      label: "Draft",      bg: "rgba(107,114,128,.10)", c: "#6B7280" },
  { value: "open",       label: "Open",       bg: "rgba(48,161,78,.10)",   c: "#16A34A" },
  { value: "on_hold",    label: "On Hold",    bg: "rgba(245,158,11,.10)",  c: "#D97706" },
  { value: "filled",     label: "Filled",     bg: "rgba(59,130,246,.10)",  c: "#2563EB" },
  { value: "cancelled",  label: "Cancelled",  bg: "rgba(239,68,68,.10)",   c: "#DC2626" },
];

const PRIORITY_COLOR = { low: "#6B7280", medium: "#D97706", high: "#EA580C", urgent: "#DC2626" };
const REMOTE_COLOR   = { onsite: "#2563EB", remote: "#16A34A", hybrid: "#7C3AED" };

function avatarGrad(name) {
  const p = ["#3B82F6,#6366F1","#F59E0B,#EA580C","#8B5CF6,#7C3AED","#10B981,#059669","#0EA5E9,#0284C7"];
  const [a, b] = p[(name?.charCodeAt(0)||0) % p.length].split(",");
  return `linear-gradient(135deg,${a},${b})`;
}

export default function JobPreview({ id }) {
  const [job, setJob]         = React.useState(null);
  const [company, setCompany] = React.useState(null);
  const [status, setStatus]   = React.useState(null);
  const [saving, setSaving]   = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await base44.entities.Job.filter({ id }, "-created_date", 1);
        const j = res?.[0] || null;
        if (!mounted) return;
        setJob(j);
        setStatus(j?.status || "draft");
        if (j?.company_id) {
          const co = await base44.entities.Company.filter({ id: j.company_id }, "-created_date", 1).catch(() => []);
          if (mounted) setCompany(co?.[0] || null);
        }
      } catch (e) { console.warn(e); }
    })();
    return () => { mounted = false; };
  }, [id]);

  const updateStatus = async (val) => {
    if (!val || val === status) return;
    setSaving(true);
    await base44.entities.Job.update(job.id, { status: val }).catch(() => {});
    setSaving(false);
    setStatus(val);
  };

  if (!job) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 80, color: "#86868B" }}>
      <Loader2 style={{ width: 16, height: 16, marginRight: 6 }} className="animate-spin" /> Loading job…
    </div>
  );

  const sb = STATUS_OPTS.find(s => s.value === (status || job.status)) || STATUS_OPTS[0];
  const coLetter = (company?.name || job.title || "J").charAt(0).toUpperCase();

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" }}>

      {/* Header */}
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #F2F2F7" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: avatarGrad(company?.name || job.title), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            {coLetter}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1D1D1F", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.title}</h2>
              <Link to={createPageUrl(`JobDetails?id=${job.id}`)} title="Open full details">
                <ArrowUpRight style={{ width: 14, height: 14, color: "#86868B" }} />
              </Link>
            </div>
            <div style={{ fontSize: 13, color: "#86868B" }}>{company?.name || "—"}</div>
          </div>
          <Link to={createPageUrl(`JobDetails?id=${job.id}&edit=true`)} data-intent="edit"
            style={{ fontSize: 12, fontWeight: 600, color: "#0071E3", padding: "5px 12px", borderRadius: 20, border: "1px solid #0071E3", textDecoration: "none", flexShrink: 0 }}>
            <Edit style={{ width: 12, height: 12, display: "inline", marginRight: 4, verticalAlign: "middle" }} />Edit
          </Link>
        </div>

        {/* Status + badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: sb.bg, color: sb.c }}>
            {sb.label}
          </span>
          {job.priority && (
            <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "rgba(0,0,0,.05)", color: PRIORITY_COLOR[job.priority] || "#86868B" }}>
              {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)} Priority
            </span>
          )}
          {job.remote_type && (
            <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "rgba(0,0,0,.05)", color: REMOTE_COLOR[job.remote_type] || "#86868B" }}>
              {job.remote_type.charAt(0).toUpperCase() + job.remote_type.slice(1)}
            </span>
          )}
          {job.employment_type && (
            <span style={{ fontSize: 11.5, fontWeight: 500, padding: "3px 10px", borderRadius: 20, background: "rgba(0,0,0,.05)", color: "#6E6E73" }}>
              {job.employment_type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          )}
        </div>
      </div>

      {/* Quick status update */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #F2F2F7" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#86868B", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Update Status</div>
        <Select value={status || job.status} onValueChange={updateStatus} disabled={saving}>
          <SelectTrigger style={{ fontSize: 13, borderRadius: 10 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Key details */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #F2F2F7" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#86868B", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>Details</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {job.location && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1D1D1F" }}>
              <MapPin style={{ width: 14, height: 14, color: "#86868B", flexShrink: 0 }} />
              {job.location}
            </div>
          )}
          {job.rate && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1D1D1F" }}>
              <DollarSign style={{ width: 14, height: 14, color: "#86868B", flexShrink: 0 }} />
              {job.rate}
            </div>
          )}
          {job.experience_required != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1D1D1F" }}>
              <Clock style={{ width: 14, height: 14, color: "#86868B", flexShrink: 0 }} />
              {job.experience_required}+ years experience
            </div>
          )}
          {job.positions_available != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1D1D1F" }}>
              <Users style={{ width: 14, height: 14, color: "#86868B", flexShrink: 0 }} />
              {job.positions_available} position{job.positions_available !== 1 ? "s" : ""} open
            </div>
          )}
          {job.due_date && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1D1D1F" }}>
              <Calendar style={{ width: 14, height: 14, color: "#86868B", flexShrink: 0 }} />
              Target fill: {new Date(job.due_date).toLocaleDateString()}
            </div>
          )}
          {job.hiring_manager && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1D1D1F" }}>
              <Briefcase style={{ width: 14, height: 14, color: "#86868B", flexShrink: 0 }} />
              HM: {job.hiring_manager}
            </div>
          )}
          {company?.website && (
            <a href={company.website} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#0071E3", textDecoration: "none" }}>
              <ExternalLink style={{ width: 14, height: 14, flexShrink: 0 }} />
              Company website
            </a>
          )}
        </div>
      </div>

      {/* Required skills */}
      {Array.isArray(job.required_skills) && job.required_skills.length > 0 && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #F2F2F7" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#86868B", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Required Skills</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {job.required_skills.slice(0, 15).map((s, i) => (
              <span key={i} style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 20, background: "rgba(0,113,227,.08)", color: "#0071E3", fontWeight: 500 }}>{s}</span>
            ))}
            {job.required_skills.length > 15 && <span style={{ fontSize: 11.5, color: "#86868B" }}>+{job.required_skills.length - 15} more</span>}
          </div>
        </div>
      )}

      {/* Preferred skills */}
      {Array.isArray(job.preferred_skills) && job.preferred_skills.length > 0 && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #F2F2F7" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#86868B", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Preferred Skills</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {job.preferred_skills.slice(0, 10).map((s, i) => (
              <span key={i} style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 20, background: "rgba(0,0,0,.05)", color: "#6E6E73", fontWeight: 500 }}>{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Description snippet */}
      {job.description && (
        <div style={{ padding: "14px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#86868B", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Description</div>
          <p style={{ fontSize: 13, color: "#3D3D3F", lineHeight: 1.6, margin: 0 }}>{job.description.slice(0, 300)}{job.description.length > 300 ? "…" : ""}</p>
        </div>
      )}
    </div>
  );
}