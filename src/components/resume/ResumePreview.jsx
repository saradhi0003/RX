import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const SectionTitle = ({ children, color }) => (
  <div className="mt-5 mb-2">
    <div className="flex items-center gap-3">
      <div className="h-0.5 flex-1" style={{ backgroundColor: color }} />
      <h3 className="text-sm font-semibold tracking-wide uppercase text-slate-700">{children}</h3>
      <div className="h-0.5 flex-1" style={{ backgroundColor: color }} />
    </div>
  </div>
);

function formatRange(a, b) {
  if (!a && !b) return "";
  if (a && !b) return a;
  if (!a && b) return b;
  return `${a} - ${b}`;
}

const ResumePreview = forwardRef(function ResumePreview({ data, scale = 1 }, ref) {
  const color = data?.theme_color || "#3b82f6";
  return (
    <div className="w-full overflow-auto flex items-start justify-center">
      <div
        ref={ref}
        className="bg-white shadow ring-1 ring-slate-200"
        style={{
          width: 816,   // ~8.5in at 96dpi
          height: 1056, // ~11in
          transform: `scale(${scale})`,
          transformOrigin: "top left"
        }}
      >
        <div className="p-8">
          {/* Header */}
          <div className="border-b pb-3" style={{ borderColor: color }}>
            <h1 className="text-3xl font-bold text-slate-900">{data?.name || "John Doe"}</h1>
            {data?.headline && <p className="text-slate-700 mt-1">{data.headline}</p>}
            <div className="text-xs text-slate-700 mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {data?.email && <span>{data.email}</span>}
              {data?.phone && <span>{data.phone}</span>}
              {data?.location && <span>{data.location}</span>}
              {data?.website && <span>{data.website}</span>}
              {data?.linkedin && <span>{data.linkedin}</span>}
            </div>
          </div>

          {/* Summary */}
          {data?.summary && (
            <>
              <SectionTitle color={color}>Summary</SectionTitle>
              <p className="text-sm text-slate-800">{data.summary}</p>
            </>
          )}

          {/* Experience */}
          {data?.experiences?.length > 0 && (
            <>
              <SectionTitle color={color}>Work Experience</SectionTitle>
              <div className="space-y-3">
                {data.experiences.map((exp, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between">
                      <div className="font-semibold text-slate-900 text-sm">
                        {exp.role} {exp.company ? "• " + exp.company : ""}
                      </div>
                      <div className="text-xs text-slate-600">
                        {formatRange(exp.start_date, exp.end_date)}
                      </div>
                    </div>
                    {exp.location && <div className="text-xs text-slate-600">{exp.location}</div>}
                    {exp.bullets?.length > 0 && (
                      <ul className="list-disc ml-5 mt-1 text-sm text-slate-800 space-y-1">
                        {exp.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Education */}
          {data?.education?.length > 0 && (
            <>
              <SectionTitle color={color}>Education</SectionTitle>
              <div className="space-y-3">
                {data.education.map((ed, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-sm">
                      <div className="font-semibold text-slate-900">
                        {ed.school}
                        {ed.degree && ` • ${ed.degree}`}
                        {ed.major && ` in ${ed.major}`}
                        {ed.gpa && ` • GPA ${ed.gpa}`}
                      </div>
                      <div className="text-xs text-slate-600">
                        {formatRange(ed.start_date, ed.end_date)}
                      </div>
                    </div>
                    {ed.details?.length > 0 && (
                      <ul className="list-disc ml-5 mt-1 text-sm text-slate-800 space-y-1">
                        {ed.details.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Projects */}
          {data?.projects?.length > 0 && (
            <>
              <SectionTitle color={color}>Projects</SectionTitle>
              <div className="space-y-3">
                {data.projects.map((pr, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-sm">
                      <div className="font-semibold text-slate-900">{pr.name}</div>
                      <div className="text-xs text-slate-600">{pr.date}</div>
                    </div>
                    {pr.description?.length > 0 && (
                      <ul className="list-disc ml-5 mt-1 text-sm text-slate-800 space-y-1">
                        {pr.description.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Skills */}
          {data?.skills?.length > 0 && (
            <>
              <SectionTitle color={color}>Skills</SectionTitle>
              <div className="text-sm text-slate-800">
                {data.skills.join(" • ")}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default ResumePreview;