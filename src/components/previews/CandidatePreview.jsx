import React from "react";
import { Loader2, Mail, Phone, MapPin, LinkedinIcon, ArrowUpRight, Edit, Briefcase, Calendar, Code2, Zap } from "lucide-react";
import { Candidate } from "@/entities/Candidate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const STATUS_OPTS = [
  { value: "active", label: "Active", bg: "rgba(48,161,78,.10)", c: "#16A34A" },
  { value: "on_bench", label: "On Bench", bg: "rgba(99,102,241,.10)", c: "#6366F1" },
  { value: "our_bench", label: "Our Bench", bg: "rgba(139,92,246,.10)", c: "#8B5CF6" },
  { value: "placed", label: "Placed", bg: "rgba(59,130,246,.10)", c: "#2563EB" },
  { value: "screened", label: "Screened", bg: "rgba(34,197,94,.10)", c: "#22C55E" },
  { value: "inactive", label: "Inactive", bg: "rgba(107,114,128,.10)", c: "#6B7280" },
  { value: "do_not_contact", label: "Do Not Contact", bg: "rgba(239,68,68,.10)", c: "#DC2626" }
];

function avatarGrad(name) {
  const colors = [
    "#EC4899,#DB2777", // pink
    "#F59E0B,#EA580C", // orange
    "#3B82F6,#1E40AF", // blue
    "#10B981,#059669", // green
    "#8B5CF6,#7C3AED", // purple
    "#EF4444,#DC2626"  // red
  ];
  const [a, b] = colors[(name?.charCodeAt(0)||0) % colors.length].split(",");
  return `linear-gradient(135deg,${a},${b})`;
}

export default function CandidatePreview({ id }) {
  const [candidate, setCandidate] = React.useState(null);
  const [status, setStatus] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await Candidate.filter({ id }, "-created_date", 1);
        const c = res?.[0] || null;
        if (!mounted) return;
        setCandidate(c);
        setStatus(c?.status || "active");
      } catch (e) { console.warn(e); }
    })();
    return () => { mounted = false; };
  }, [id]);

  const updateStatus = async (val) => {
    if (!val || val === status) return;
    setSaving(true);
    await Candidate.update(candidate.id, { status: val }).catch(() => {});
    setSaving(false);
    setStatus(val);
  };

  if (!candidate) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 80, color: "#94A3B8" }}>
      <Loader2 style={{ width: 16, height: 16, marginRight: 6 }} className="animate-spin" /> Loading candidate…
    </div>
  );

  const sb = STATUS_OPTS.find(s => s.value === (status || candidate.status)) || STATUS_OPTS[0];
  const initials = `${(candidate.first_name || "?").charAt(0)}${(candidate.last_name || "").charAt(0)}`.toUpperCase();
  const fullName = `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim();

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" }}>

      {/* Header */}
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #F2F2F7" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: avatarGrad(fullName), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullName}</h2>
              <Link to={createPageUrl(`CandidateDetails?id=${candidate.id}`)} title="Open full details">
                <ArrowUpRight style={{ width: 14, height: 14, color: "#94A3B8" }} />
              </Link>
            </div>
            <div style={{ fontSize: 13, color: "#94A3B8" }}>{candidate.current_title || candidate.current_company || "—"}</div>
          </div>
          <Link to={createPageUrl(`CandidateDetails?id=${candidate.id}&edit=true`)} data-intent="edit"
            style={{ fontSize: 12, fontWeight: 600, color: "#9333EA", padding: "5px 12px", borderRadius: 20, border: "1px solid #9333EA", textDecoration: "none", flexShrink: 0 }}>
            <Edit style={{ width: 12, height: 12, display: "inline", marginRight: 4, verticalAlign: "middle" }} />Edit
          </Link>
        </div>

        {/* Badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: sb.bg, color: sb.c }}>{sb.label}</span>
          {candidate.experience_years && (
            <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "rgba(0,0,0,.05)", color: "#64748B" }}>
              {candidate.experience_years}+ yrs exp
            </span>
          )}
          {candidate.work_authorization && (
            <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "rgba(0,113,227,.08)", color: "#9333EA" }}>
              {candidate.work_authorization.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          )}
          {candidate.availability && candidate.availability !== "negotiable" && (
            <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "rgba(0,0,0,.05)", color: "#64748B" }}>
              {candidate.availability.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          )}
        </div>
      </div>

      {/* Status control */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #F2F2F7" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Status</div>
        <Select value={status || candidate.status} onValueChange={updateStatus} disabled={saving}>
          <SelectTrigger style={{ fontSize: 13, borderRadius: 8 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Contact info */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #F2F2F7" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>Contact</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {candidate.email && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#0F172A" }}>
              <Mail style={{ width: 14, height: 14, color: "#94A3B8", flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{candidate.email}</span>
            </div>
          )}
          {candidate.phone && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#0F172A" }}>
              <Phone style={{ width: 14, height: 14, color: "#94A3B8", flexShrink: 0 }} />
              {candidate.phone}
            </div>
          )}
          {candidate.location && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#0F172A" }}>
              <MapPin style={{ width: 14, height: 14, color: "#94A3B8", flexShrink: 0 }} />
              {candidate.location}
            </div>
          )}
          {candidate.linkedin_url && (
            <a href={candidate.linkedin_url} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9333EA", textDecoration: "none" }}>
              <LinkedinIcon style={{ width: 14, height: 14, flexShrink: 0 }} />
              LinkedIn
            </a>
          )}
        </div>
      </div>

      {/* Professional details */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #F2F2F7" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>Profile</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {candidate.current_company && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#0F172A" }}>
              <Briefcase style={{ width: 14, height: 14, color: "#94A3B8", flexShrink: 0 }} />
              {candidate.current_company}
            </div>
          )}
          {candidate.experience_years != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#0F172A" }}>
              <Zap style={{ width: 14, height: 14, color: "#94A3B8", flexShrink: 0 }} />
              {candidate.experience_years}+ years
            </div>
          )}
          {candidate.salary_expectation && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#0F172A" }}>
              <Calendar style={{ width: 14, height: 14, color: "#94A3B8", flexShrink: 0 }} />
              ${candidate.salary_expectation.toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Skills */}
      {Array.isArray(candidate.skills) && candidate.skills.length > 0 && (
        <div style={{ padding: "14px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Skills</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {candidate.skills.slice(0, 12).map((s, i) => (
              <span key={i} style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 20, background: "rgba(0,113,227,.08)", color: "#9333EA", fontWeight: 500 }}>{s}</span>
            ))}
            {candidate.skills.length > 12 && <span style={{ fontSize: 11.5, color: "#94A3B8" }}>+{candidate.skills.length - 12} more</span>}
          </div>
        </div>
      )}
    </div>
  );
}