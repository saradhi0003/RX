import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";
import { format, subDays } from "date-fns";

import EmptyState from "@/components/common/EmptyState";
import { LlmUsage } from "@/entities/LlmUsage";
import { useEntityList } from "@/hooks/useEntityList";

/**
 * LLM spend & usage over the last 30 days, read from the llm_usage table
 * (written by src/lib/llm.js and supabase/functions/_shared/llm.ts).
 * Aggregation is client-side — the row count is small; move to a Postgres RPC
 * if a workspace ever exceeds the fetch limit below.
 *
 * Charts follow the dataviz method: single-hue sequential (brand purple,
 * validated ≥3:1 on the light surface), thin marks, recessive grid, tooltips,
 * direct labels on the bar ends, no legend for single-series plots.
 */

// Validated on the light surface: contrast 3:1+, lightness band, chroma floor.
const SERIES = "#9333EA";
const GRID = "#E2E8F0";
const INK_MUTED = "#94A3B8";

const fmtUsd = (v) => `$${Number(v || 0).toFixed(v >= 100 ? 0 : 2)}`;

function StatTile({ label, value, sub }) {
  return (
    <div className="p-4 rounded-lg border bg-white">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function LLMCostDashboard() {
  const thirtyDaysAgo = useMemo(() => subDays(new Date(), 30).toISOString(), []);
  const { data: rows, loading, error, reload } = useEntityList(
    () => LlmUsage.filter({ created_at: { $gte: thirtyDaysAgo } }, "-created_at", 1000),
    [thirtyDaysAgo]
  );

  const agg = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7).toISOString();
    let cost30 = 0, cost7 = 0, tokens30 = 0, latTotal = 0, latCount = 0;
    const byDay = new Map();
    const byModel = new Map();
    const byTask = new Map();

    for (const r of rows) {
      const cost = Number(r.cost_usd || 0);
      cost30 += cost;
      if (r.created_at >= sevenDaysAgo) cost7 += cost;
      tokens30 += (r.prompt_tokens || 0) + (r.completion_tokens || 0);
      if (r.latency_ms) { latTotal += r.latency_ms; latCount += 1; }

      const day = (r.created_at || "").slice(0, 10);
      byDay.set(day, (byDay.get(day) || 0) + cost);

      const modelKey = r.model || r.provider || "unknown";
      byModel.set(modelKey, (byModel.get(modelKey) || 0) + cost);

      const t = byTask.get(r.task || "unknown") || { calls: 0, latTotal: 0, cost: 0 };
      t.calls += 1; t.latTotal += r.latency_ms || 0; t.cost += cost;
      byTask.set(r.task || "unknown", t);
    }

    // Truthful time axis: every one of the last 30 days, zero-filled.
    const daily = Array.from({ length: 30 }, (_, i) => {
      const d = subDays(new Date(), 29 - i);
      const key = format(d, "yyyy-MM-dd");
      return { day: format(d, "MMM d"), cost: +(byDay.get(key) || 0).toFixed(4) };
    });

    // ≤ 8 magnitude bars; the tail folds into "Other" (never more marks).
    const models = [...byModel.entries()].sort((a, b) => b[1] - a[1]);
    const top = models.slice(0, 7).map(([model, cost]) => ({ model, cost: +cost.toFixed(4) }));
    const tail = models.slice(7).reduce((s, [, c]) => s + c, 0);
    if (tail > 0) top.push({ model: "Other", cost: +tail.toFixed(4) });

    const slowest = [...byTask.entries()]
      .map(([task, t]) => ({ task, calls: t.calls, avgMs: Math.round(t.latTotal / t.calls), cost: t.cost }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 5);

    return {
      cost30, cost7, tokens30,
      avgLatency: latCount ? Math.round(latTotal / latCount) : 0,
      daily, models: top, slowest,
    };
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <DollarSign className="w-4 h-4 text-purple-600" />
          LLM Cost & Usage (30 days)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <EmptyState error={error} action={{ label: "Retry", fn: reload }} />
        ) : !loading && rows.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title="No LLM usage recorded yet"
            description="Rows appear here as soon as the backend logs calls to llm_usage (requires the Supabase project to be live)"
          />
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile label="Spend — 30 days" value={fmtUsd(agg.cost30)} />
              <StatTile label="Spend — 7 days" value={fmtUsd(agg.cost7)} />
              <StatTile label="Tokens — 30 days" value={agg.tokens30.toLocaleString()} />
              <StatTile label="Avg latency" value={`${agg.avgLatency} ms`} sub={`${rows.length} calls`} />
            </div>

            {/* Daily spend trend — single series, no legend needed */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Daily spend (USD)</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={agg.daily} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} interval={6} />
                  <YAxis tick={{ fontSize: 11, fill: INK_MUTED }} tickLine={false} axisLine={false} width={44} tickFormatter={fmtUsd} />
                  <Tooltip formatter={(v) => [fmtUsd(v), "Spend"]} cursor={{ stroke: INK_MUTED, strokeDasharray: "3 3" }} />
                  <Area type="monotone" dataKey="cost" stroke={SERIES} strokeWidth={2} fill={SERIES} fillOpacity={0.08} dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Cost by model — magnitude, one hue, direct labels on data ends */}
            {agg.models.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Cost by model (USD)</p>
                <ResponsiveContainer width="100%" height={Math.max(120, agg.models.length * 36)}>
                  <BarChart data={agg.models} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 8 }}>
                    <CartesianGrid stroke={GRID} horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="model" width={170} tick={{ fontSize: 11, fill: "#475569" }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v) => [fmtUsd(v), "Cost"]} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
                    <Bar dataKey="cost" fill={SERIES} barSize={16} radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="cost" position="right" formatter={fmtUsd} style={{ fontSize: 11, fill: "#475569" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Slowest tasks — a table, not a chart */}
            {agg.slowest.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Slowest tasks (avg latency)</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-slate-500">
                        <th className="py-2 pr-4 font-medium">Task</th>
                        <th className="py-2 pr-4 font-medium">Calls</th>
                        <th className="py-2 pr-4 font-medium">Avg latency</th>
                        <th className="py-2 font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agg.slowest.map((t) => (
                        <tr key={t.task} className="border-b last:border-0">
                          <td className="py-2 pr-4 text-slate-900">{t.task}</td>
                          <td className="py-2 pr-4 text-slate-600">{t.calls}</td>
                          <td className="py-2 pr-4 text-slate-600">{t.avgMs} ms</td>
                          <td className="py-2 text-slate-600">{fmtUsd(t.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
