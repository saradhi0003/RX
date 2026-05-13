import React, { useState, useEffect, memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Candidate, Job, Company, Application, Submission, Task } from "@/entities/all";
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Activity } from "lucide-react";

// Defined once at module level — never recreated
const ENTITY_MAP = {
  Candidate,
  Job,
  Company,
  Application,
  Submission,
  Task,
};

// Enhanced color palette with gradients
const BRAND = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#6C00FF", "#22c55e", "#f59e0b", "#ef4444", "#6366f1", "#ec4899", "#14b8a6", "#8b5cf6"];

// Gradient backgrounds for different widget types
const widgetBackgrounds = {
  kpi: "from-gradient-to-br from-blue-500 via-blue-600 to-blue-700",
  bar: "from-purple-50 via-pink-50 to-purple-50",
  pie: "from-emerald-50 via-teal-50 to-emerald-50",
  line: "from-orange-50 via-amber-50 to-orange-50",
  stacked: "from-indigo-50 via-blue-50 to-indigo-50"
};

const getWidgetIcon = (type) => {
  switch (type) {
    case "kpi": return TrendingUp;
    case "bar": return BarChart3;
    case "pie": return PieChartIcon;
    case "line": 
    case "stacked": return Activity;
    default: return BarChart3;
  }
};

const WidgetRendererImpl = ({ widget, refreshKey = 0 }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seriesKeys, setSeriesKeys] = useState([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const Sdk = ENTITY_MAP[widget.entity];
        if (!Sdk) {
          setLoading(false);
          return;
        }
        let rows = [];
        if (widget.filter && Object.keys(widget.filter).length) {
          rows = await Sdk.filter(widget.filter);
        } else {
          rows = await Sdk.list();
        }
        if (!mounted) return;

        if (widget.widget_type === "kpi") {
          setData([{ name: widget.title, value: rows.length }]);
        } else if (widget.widget_type === "bar" || widget.widget_type === "pie") {
          const by = widget.group_by || "status";
          const m = {};
          rows.forEach(r => {
            const key = (r[by] ?? "unknown");
            const name = String(key).replaceAll("_", " ");
            m[name] = (m[name] || 0) + 1;
          });
          const agg = Object.entries(m).map(([name, value]) => ({ name, value }));
          setData(agg);
        } else if (widget.widget_type === "line") {
          const field = widget.date_field || "created_date";
          const months = {};
          rows.forEach(r => {
            const d = r[field] ? new Date(r[field]) : null;
            if (!d || isNaN(d)) return;
            const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            months[k] = (months[k] || 0) + 1;
          });
          const arr = Object.entries(months)
            .sort(([a],[b]) => a.localeCompare(b))
            .map(([k, v]) => {
              const [y,m] = k.split("-");
              const date = new Date(Number(y), Number(m)-1, 1);
              return { name: date.toLocaleString(undefined, { month: "short", year: "numeric" }), value: v };
            });
          setData(arr);
        } else if (widget.widget_type === "stacked") {
          const by = widget.group_by || "technologyText";
          const field = widget.date_field || "submissionDate";
          const altField = field === "submissionDate" ? "submitted_date" : "created_date";

          const monthsBack = Number(widget.months || 8);
          const now = new Date();
          const buckets = [];
          for (let i = monthsBack - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
            buckets.push({ key, label: d.toLocaleString(undefined, { month: "short", year: "numeric" }) });
          }
          const bucketIndex = Object.fromEntries(buckets.map((b, i) => [b.key, i]));

          const catTotals = {};
          const matrix = {};
          rows.forEach(r => {
            let dt = r[field] || r[altField] || r.created_date;
            const d = dt ? new Date(dt) : null;
            if (!d || isNaN(d)) return;
            const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
            if (!(k in bucketIndex)) return;

            const rawCat = r[by];
            const cat = String(rawCat || "unknown").trim() || "unknown";

            matrix[k] = matrix[k] || {};
            matrix[k][cat] = (matrix[k][cat] || 0) + 1;
            catTotals[cat] = (catTotals[cat] || 0) + 1;
          });

          const topCats = Object.entries(catTotals)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 12)
            .map(([c]) => c);
          const cats = topCats;

          const out = buckets.map(b => {
            const row = { name: b.label };
            const mm = matrix[b.key] || {};
            let other = 0;
            Object.entries(mm).forEach(([c, v]) => {
              if (cats.includes(c)) row[c] = v;
              else other += v;
            });
            if (other > 0) row["Other"] = other;
            return row;
          });

          const otherIncluded = (arr) => arr.some(r => typeof r["Other"] === "number");
          setSeriesKeys(otherIncluded(out) ? [...cats, "Other"] : cats);
          setData(out);
        }
        setLoading(false);
      } catch (err) {
        console.error('Widget load error:', err);
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [widget, refreshKey]);

  const Icon = useMemo(() => getWidgetIcon(widget.widget_type), [widget.widget_type]);
  const bgGradient = useMemo(() => widgetBackgrounds[widget.widget_type] || widgetBackgrounds.bar, [widget.widget_type]);

  return (
    <Card className={`${widget.cols === 2 ? "col-span-2" : ""} border-0 shadow-xl overflow-hidden`}>
      {/* Gradient header */}
      <div className={`h-2 bg-gradient-to-r ${
        widget.widget_type === "kpi" ? "from-blue-500 to-blue-600" :
        widget.widget_type === "bar" ? "from-purple-500 to-purple-600" :
        widget.widget_type === "pie" ? "from-emerald-500 to-emerald-600" :
        widget.widget_type === "line" ? "from-orange-500 to-orange-600" :
        "from-indigo-500 to-indigo-600"
      }`} />
      
      <div className={`bg-gradient-to-br ${bgGradient} p-4`}>
        <CardHeader className="p-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className={`p-2 rounded-lg ${
                widget.widget_type === "kpi" ? "bg-blue-100 text-blue-700" :
                widget.widget_type === "bar" ? "bg-purple-100 text-purple-700" :
                widget.widget_type === "pie" ? "bg-emerald-100 text-emerald-700" :
                widget.widget_type === "line" ? "bg-orange-100 text-orange-700" :
                "bg-indigo-100 text-indigo-700"
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-slate-900">{widget.title}</span>
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {widget.entity}
            </Badge>
          </div>
        </CardHeader>
      </div>

      <CardContent className="h-64 bg-white p-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : widget.widget_type === "kpi" ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="text-6xl font-bold bg-gradient-to-br from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {data[0]?.value ?? 0}
            </div>
            <div className="text-sm text-slate-500 mt-2">{widget.title}</div>
          </div>
        ) : widget.widget_type === "bar" ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.7}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis allowDecimals={false} stroke="#64748b" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              />
              <Legend />
              <Bar dataKey="value" name="Count" fill="url(#barGradient)" radius={[8,8,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : widget.widget_type === "pie" ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                data={data} 
                dataKey="value" 
                nameKey="name" 
                outerRadius={80} 
                label={(entry) => entry.name}
                labelLine={{ stroke: '#64748b' }}
              >
                {data.map((_, i) => <Cell key={i} fill={BRAND[i % BRAND.length]} />)}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : widget.widget_type === "line" ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ea580c" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis allowDecimals={false} stroke="#64748b" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="value" 
                name="Count" 
                stroke="url(#lineGradient)" 
                strokeWidth={3} 
                dot={{ fill: '#f97316', r: 4 }} 
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis allowDecimals={false} stroke="#64748b" style={{ fontSize: '12px' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
              />
              <Legend />
              {seriesKeys.map((k, i) => (
                <Bar 
                  key={k} 
                  dataKey={k} 
                  stackId="a" 
                  name={k} 
                  fill={BRAND[i % BRAND.length]}
                  radius={i === seriesKeys.length - 1 ? [8,8,0,0] : [0,0,0,0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default memo(WidgetRendererImpl);