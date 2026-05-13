import React from "react";
import { Loader2, MapPin, Globe, Phone, Mail, Building2, ArrowUpRight, Edit, Briefcase, Users, CheckCircle } from "lucide-react";
import { Company } from "@/entities/Company";
import { Job } from "@/entities/Job";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const STATUS_OPTS = [
  { value: "active",    label: "Active",    bg: "rgba(48,161,78,.10)",  c: "#16A34A" },
  { value: "prospect",  label: "Prospect",  bg: "rgba(0,113,227,.10)", c: "#9333EA" },
  { value: "inactive",  label: "Inactive",  bg: "rgba(107,114,128,.10)",c: "#6B7280" },
];

function avatarGrad(name) {
  const p = ["#3B82F6,#6366F1","#F59E0B,#EA580C","#8B5CF6,#7C3AED","#10B981,#059669","#0EA5E9,#0284C7","#EC4899,#DB2777"];
  const [a, b] = p[(name?.charCodeAt(0)||0) % p.length].split(",");
  return `linear-gradient(135deg,${a},${b})`;
}

export default function CompanyPreview({ id }) {
  const [company, setCompany] = React.useState(null);
  const [jobs, setJobs]       = React.useState([]);
  const [status, setStatus]   = React.useState(null);
  const [saving, setSaving]   = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await Company.filter({ id }, "-created_date", 1);
        const c = res?.[0] || null;
        if (!mounted) return;
        setCompany(c);
        setStatus(c?.status || "prospect");
        if (c?.id) {
          const jRes = await Job.filter({ company_id: c.id }, "-created_date", 5).catch(() => []);
          if (mounted) setJobs(jRes || []);
        }
      } catch (e) { console.warn(e); }
    })();
    return () => { mounted = false; };
  }, [id]);

  const updateStatus = async (val) => {
    if (!val || val === status) return;
    setSaving(true);
    await Company.update(company.id, { status: val }).catch(() => {});
    setSaving(false);
    setStatus(val);
  };

  if (!company) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 80, color: "#94A3B8" }}>
      <Loader2 style={{ width: 16, height: 16, marginRight: 6 }} className="animate-spin" /> Loading connection…
    </div>
  );

  const sb = STATUS_OPTS.find(s => s.value === (status || company.status)) || STATUS_OPTS[1];
  const primary = (company.contacts || []).find(c => c.is_primary) || company.contacts?.[0];
  const letter  = (company.name || "C").charAt(0).toUpperCase();
  const openJobs = jobs.filter(j => j.status === "open");

  return (
    <div style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif" }}>

      {/* Header */}
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #F2F2F7" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: avatarGrad(company.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            {letter}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{company.name}</h2>
              <Link to={createPageUrl(`CompanyDetails?id=${company.id}`)} title="Open full details">
                <ArrowUpRight style={{ width: 14, height: 14, color: "#94A3B8" }} />
              </Link>
            </div>
            <div style={{ fontSize: 13, color: "#94A3B8" }}>{company.industry || "—"}</div>
          </div>
          <Link to={createPageUrl(`CompanyDetails?id=${company.id}&edit=true`)} data-intent="edit"
            style={{ fontSize: 12, fontWeight: 600, color: "#9333EA", padding: "5px 12px", borderRadius: 20, border: "1px solid #9333EA", textDecoration: "none", flexShrink: 0 }}>
            <Edit style={{ width: 12, height: 12, display: "inline", marginRight: 4, verticalAlign: "middle" }} />Edit
          </Link>
        </div>

        {/* Badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: sb.bg, color: sb.c }}>{sb.label}</span>
          {company.type && (
            <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "rgba(99,102,241,.08)", color: "#6366F1" }}>
              {company.type.charAt(0).toUpperCase() + company.type.slice(1)}
            </span>
          )}
          {openJobs.length > 0 && (
            <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "rgba(48,161,78,.08)", color: "#16A34A" }}>
              {openJobs.length} Open Role{openJobs.length !== 1 ? "s" : ""}
            </span>
          )}
          {company.job_stack_access && (
            <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: "rgba(0,113,227,.08)", color: "#9333EA" }}>
              Job Stack
            </span>
          )}
        </div>
      </div>

      {/* Quick status */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #F2F2F7" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Update Status</div>
        <Select value={status || company.status} onValueChange={updateStatus} disabled={saving}>
          <SelectTrigger style={{ fontSize: 13, borderRadius: 10 }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Contact info */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #F2F2F7" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>Contact Info</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {company.location && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#0F172A" }}>
              <MapPin style={{ width: 14, height: 14, color: "#94A3B8", flexShrink: 0 }} /> {company.location}
            </div>
          )}
          {company.website && (
            <a href={company.website} target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9333EA", textDecoration: "none" }}>
              <Globe style={{ width: 14, height: 14, flexShrink: 0 }} /> {company.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          {primary?.email && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#0F172A" }}>
              <Mail style={{ width: 14, height: 14, color: "#94A3B8", flexShrink: 0 }} /> {primary.email}
            </div>
          )}
          {primary?.phone && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#0F172A" }}>
              <Phone style={{ width: 14, height: 14, color: "#94A3B8", flexShrink: 0 }} /> {primary.phone}
            </div>
          )}
          {primary?.name && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#0F172A" }}>
              <Users style={{ width: 14, height: 14, color: "#94A3B8", flexShrink: 0 }} />
              <span>{primary.name}{primary.title ? ` · ${primary.title}` : ""}</span>
            </div>
          )}
        </div>
      </div>

      {/* All contacts */}
      {(company.contacts || []).length > 1 && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #F2F2F7" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>All Contacts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {company.contacts.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarGrad(c.name || "?"), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  {(c.name || "?").charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                    {c.name || "—"} {c.is_primary && <span style={{ fontSize: 10, color: "#9333EA" }}>★</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#94A3B8" }}>{c.title || ""} {c.email ? `· ${c.email}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent jobs */}
      {jobs.length > 0 && (
        <div style={{ padding: "14px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>Active Roles</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {jobs.map(j => {
              const jb = { open:{bg:"rgba(48,161,78,.10)",c:"#16A34A"}, draft:{bg:"rgba(107,114,128,.10)",c:"#6B7280"}, on_hold:{bg:"rgba(245,158,11,.10)",c:"#D97706"}, filled:{bg:"rgba(59,130,246,.10)",c:"#2563EB"}, cancelled:{bg:"rgba(239,68,68,.10)",c:"#DC2626"} }[j.status] || {bg:"rgba(0,0,0,.05)",c:"#94A3B8"};
              return (
                <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "#F9F9FB" }}>
                  <Briefcase style={{ width: 14, height: 14, color: "#94A3B8", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#0F172A", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{j.title}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: jb.bg, color: jb.c, flexShrink: 0 }}>{j.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Description */}
      {company.description && (
        <div style={{ padding: "0 20px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>About</div>
          <p style={{ fontSize: 13, color: "#3D3D3F", lineHeight: 1.6, margin: 0 }}>{company.description.slice(0, 300)}{company.description.length > 300 ? "…" : ""}</p>
        </div>
      )}
    </div>
  );
}