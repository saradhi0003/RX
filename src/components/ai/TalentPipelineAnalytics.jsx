import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown,
  Users,
  Briefcase,
  Target,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  BarChart3,
  PieChart,
  LineChart,
  Sparkles
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart as RePieChart, Pie, Cell,
  LineChart as ReLineChart, Line
} from "recharts";
import { InvokeLLM } from "@/integrations/Core";
import { Candidate, Job, Application, Submission } from "@/entities/all";
import { addNotification } from "@/components/notifications/NotificationToast";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function TalentPipelineAnalytics() {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [insights, setInsights] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cands, jbs, apps, subs] = await Promise.all([
        Candidate.list("-created_date", 500),
        Job.list("-created_date", 200),
        Application.list("-created_date", 500),
        Submission.list("-created_date", 500)
      ]);
      setCandidates(cands || []);
      setJobs(jbs || []);
      setApplications(apps || []);
      setSubmissions(subs || []);
    } catch (error) {
      console.error("Error loading data:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to load data" });
    }
    setLoading(false);
  };

  const runAIAnalysis = async () => {
    setAnalyzing(true);
    try {
      // Prepare data summary
      const dataSummary = {
        candidate_stats: {
          total: candidates.length,
          by_status: candidates.reduce((acc, c) => {
            acc[c.status] = (acc[c.status] || 0) + 1;
            return acc;
          }, {}),
          by_source: candidates.reduce((acc, c) => {
            const source = c.source || "unknown";
            acc[source] = (acc[source] || 0) + 1;
            return acc;
          }, {}),
          top_skills: getTopSkills(candidates, 20),
          average_experience: candidates.reduce((sum, c) => sum + (c.experience_years || 0), 0) / candidates.length
        },
        job_stats: {
          total: jobs.length,
          by_status: jobs.reduce((acc, j) => {
            acc[j.status] = (acc[j.status] || 0) + 1;
            return acc;
          }, {}),
          open_positions: jobs.filter(j => j.status === "open").length,
          top_required_skills: getTopJobSkills(jobs, 20),
          average_experience_required: jobs.reduce((sum, j) => sum + (j.experience_required || 0), 0) / jobs.length
        },
        application_stats: {
          total: applications.length,
          by_status: applications.reduce((acc, a) => {
            acc[a.status] = (acc[a.status] || 0) + 1;
            return acc;
          }, {}),
          conversion_rates: calculateConversionRates(applications)
        },
        time_trends: getTimeTrends(candidates, jobs, applications)
      };

      const response = await InvokeLLM({
        prompt: `You are an expert talent acquisition analyst. Analyze the following recruitment pipeline data and provide strategic insights:

**Data Summary:**
${JSON.stringify(dataSummary, null, 2)}

Provide a comprehensive analysis including:

1. **Skill Gap Analysis:**
   - Compare candidate skills vs. job requirements
   - Identify critical skill shortages
   - Suggest sourcing priorities

2. **Hiring Forecast:**
   - Predict hiring needs for next 3 months based on pipeline trends
   - Identify roles that will be hardest to fill
   - Recommend proactive measures

3. **Sourcing Effectiveness:**
   - Analyze which sourcing channels are most effective
   - Calculate quality metrics per source
   - Suggest optimization strategies

4. **Pipeline Health:**
   - Assess overall pipeline health (healthy/at_risk/critical)
   - Identify bottlenecks in hiring process
   - Recommend improvements

5. **Competitive Insights:**
   - Based on market data, assess competitive positioning
   - Suggest adjustments to attract top talent

6. **Action Items:**
   - Prioritized list of immediate actions to take
   - Strategic recommendations for next quarter

Be specific, data-driven, and actionable.`,
        response_json_schema: {
          type: "object",
          properties: {
            skill_gaps: {
              type: "object",
              properties: {
                critical_gaps: { type: "array", items: { type: "string" } },
                emerging_needs: { type: "array", items: { type: "string" } },
                oversupplied_skills: { type: "array", items: { type: "string" } },
                recommendations: { type: "string" }
              }
            },
            hiring_forecast: {
              type: "object",
              properties: {
                predicted_hires_next_month: { type: "number" },
                predicted_hires_quarter: { type: "number" },
                hardest_to_fill_roles: { type: "array", items: { type: "string" } },
                recommendations: { type: "string" }
              }
            },
            sourcing_effectiveness: {
              type: "object",
              properties: {
                best_channels: { type: "array", items: { type: "object", properties: { channel: { type: "string" }, effectiveness_score: { type: "number" } } } },
                worst_channels: { type: "array", items: { type: "string" } },
                recommendations: { type: "string" }
              }
            },
            pipeline_health: {
              type: "object",
              properties: {
                overall_status: { type: "string", enum: ["healthy", "at_risk", "critical"] },
                bottlenecks: { type: "array", items: { type: "string" } },
                strengths: { type: "array", items: { type: "string" } },
                recommendations: { type: "string" }
              }
            },
            action_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  action: { type: "string" },
                  expected_impact: { type: "string" }
                }
              }
            },
            executive_summary: { type: "string" }
          },
          required: ["skill_gaps", "hiring_forecast", "pipeline_health", "action_items", "executive_summary"]
        }
      });

      setInsights(response);
      addNotification({ type: "success", title: "Analysis Complete", message: "AI insights generated" });
    } catch (error) {
      console.error("Error running AI analysis:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to generate insights" });
    }
    setAnalyzing(false);
  };

  const getTopSkills = (candidates, limit) => {
    const skillsCount = {};
    candidates.forEach(c => {
      (c.skills || []).forEach(skill => {
        skillsCount[skill] = (skillsCount[skill] || 0) + 1;
      });
    });
    return Object.entries(skillsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([skill, count]) => ({ skill, count }));
  };

  const getTopJobSkills = (jobs, limit) => {
    const skillsCount = {};
    jobs.forEach(j => {
      (j.required_skills || []).forEach(skill => {
        skillsCount[skill] = (skillsCount[skill] || 0) + 1;
      });
    });
    return Object.entries(skillsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([skill, count]) => ({ skill, count }));
  };

  const calculateConversionRates = (apps) => {
    const stages = ["applied", "screening", "interviewing", "offered", "hired"];
    const counts = {};
    stages.forEach(stage => {
      counts[stage] = apps.filter(a => a.status === stage).length;
    });
    return counts;
  };

  const getTimeTrends = (cands, jbs, apps) => {
    const months = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months[key] = { candidates: 0, jobs: 0, applications: 0 };
    }

    cands.forEach(c => {
      const d = new Date(c.created_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (months[key]) months[key].candidates++;
    });

    jbs.forEach(j => {
      const d = new Date(j.created_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (months[key]) months[key].jobs++;
    });

    apps.forEach(a => {
      const d = new Date(a.created_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (months[key]) months[key].applications++;
    });

    return Object.entries(months).map(([key, data]) => ({
      month: new Date(key).toLocaleString(undefined, { month: "short" }),
      ...data
    }));
  };

  // Calculate quick stats
  const candidatesByStatus = candidates.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  const jobsByStatus = jobs.reduce((acc, j) => {
    acc[j.status] = (acc[j.status] || 0) + 1;
    return acc;
  }, {});

  const statusData = Object.entries(candidatesByStatus).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value
  }));

  const jobStatusData = Object.entries(jobsByStatus).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value
  }));

  const timeTrends = getTimeTrends(candidates, jobs, applications);

  const getPriorityBadge = (priority) => {
    const colors = {
      high: "bg-red-100 text-red-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-blue-100 text-blue-800"
    };
    return colors[priority] || colors.medium;
  };

  const getHealthBadge = (status) => {
    const colors = {
      healthy: "bg-green-100 text-green-800",
      at_risk: "bg-yellow-100 text-yellow-800",
      critical: "bg-red-100 text-red-800"
    };
    return colors[status] || colors.at_risk;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & AI Analysis Trigger */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Talent Pipeline Analytics
            </span>
            <Button 
              onClick={runAIAnalysis} 
              disabled={analyzing}
              className="gap-2"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Run AI Analysis
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-slate-600">Total Candidates</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{candidates.length}</div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="w-4 h-4 text-green-600" />
                <span className="text-sm text-slate-600">Open Jobs</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {jobs.filter(j => j.status === "open").length}
              </div>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-slate-600">Applications</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{applications.length}</div>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-orange-600" />
                <span className="text-sm text-slate-600">Hired (All Time)</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {applications.filter(a => a.status === "hired").length}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Candidates by Status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {statusData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jobs by Status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={jobStatusData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="Jobs" fill="#0088FE" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Trends Over Time */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline Trends (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={timeTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="candidates" stroke="#8884d8" strokeWidth={2} name="Candidates" />
              <Line type="monotone" dataKey="jobs" stroke="#82ca9d" strokeWidth={2} name="Jobs" />
              <Line type="monotone" dataKey="applications" stroke="#ffc658" strokeWidth={2} name="Applications" />
            </ReLineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* AI Insights */}
      {insights && (
        <div className="space-y-6">
          {/* Executive Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 leading-relaxed">{insights.executive_summary}</p>
            </CardContent>
          </Card>

          {/* Pipeline Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Pipeline Health</span>
                <Badge className={getHealthBadge(insights.pipeline_health.overall_status)}>
                  {insights.pipeline_health.overall_status.replace(/_/g, " ").toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {insights.pipeline_health.strengths && insights.pipeline_health.strengths.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-green-700">Strengths</h4>
                  <ul className="space-y-1">
                    {insights.pipeline_health.strengths.map((strength, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insights.pipeline_health.bottlenecks && insights.pipeline_health.bottlenecks.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-red-700">Bottlenecks</h4>
                  <ul className="space-y-1">
                    {insights.pipeline_health.bottlenecks.map((bottleneck, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>{bottleneck}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-lg">
                <h4 className="font-medium mb-1 text-sm">Recommendations</h4>
                <p className="text-sm text-slate-700">{insights.pipeline_health.recommendations}</p>
              </div>
            </CardContent>
          </Card>

          {/* Skill Gaps */}
          <Card>
            <CardHeader>
              <CardTitle>Skill Gap Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2 text-red-700">Critical Gaps</h4>
                <div className="flex flex-wrap gap-2">
                  {insights.skill_gaps.critical_gaps.map((skill, idx) => (
                    <Badge key={idx} className="bg-red-100 text-red-800">{skill}</Badge>
                  ))}
                </div>
              </div>

              {insights.skill_gaps.emerging_needs && insights.skill_gaps.emerging_needs.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-yellow-700">Emerging Needs</h4>
                  <div className="flex flex-wrap gap-2">
                    {insights.skill_gaps.emerging_needs.map((skill, idx) => (
                      <Badge key={idx} className="bg-yellow-100 text-yellow-800">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-blue-50 rounded-lg">
                <h4 className="font-medium mb-1 text-sm">Recommendations</h4>
                <p className="text-sm text-slate-700">{insights.skill_gaps.recommendations}</p>
              </div>
            </CardContent>
          </Card>

          {/* Hiring Forecast */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Hiring Forecast
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                  <div className="text-sm text-slate-600 mb-1">Next Month</div>
                  <div className="text-3xl font-bold text-blue-700">
                    {insights.hiring_forecast.predicted_hires_next_month}
                  </div>
                  <div className="text-xs text-slate-600">Predicted Hires</div>
                </div>

                <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                  <div className="text-sm text-slate-600 mb-1">Next Quarter</div>
                  <div className="text-3xl font-bold text-purple-700">
                    {insights.hiring_forecast.predicted_hires_quarter}
                  </div>
                  <div className="text-xs text-slate-600">Predicted Hires</div>
                </div>
              </div>

              {insights.hiring_forecast.hardest_to_fill_roles && insights.hiring_forecast.hardest_to_fill_roles.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-orange-700">Hardest to Fill Roles</h4>
                  <div className="flex flex-wrap gap-2">
                    {insights.hiring_forecast.hardest_to_fill_roles.map((role, idx) => (
                      <Badge key={idx} className="bg-orange-100 text-orange-800">{role}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-lg">
                <h4 className="font-medium mb-1 text-sm">Recommendations</h4>
                <p className="text-sm text-slate-700">{insights.hiring_forecast.recommendations}</p>
              </div>
            </CardContent>
          </Card>

          {/* Sourcing Effectiveness */}
          {insights.sourcing_effectiveness && (
            <Card>
              <CardHeader>
                <CardTitle>Sourcing Effectiveness</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {insights.sourcing_effectiveness.best_channels && insights.sourcing_effectiveness.best_channels.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-green-700">Top Performing Channels</h4>
                    <div className="space-y-2">
                      {insights.sourcing_effectiveness.best_channels.map((ch, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-green-50 rounded">
                          <span className="text-sm font-medium">{ch.channel}</span>
                          <Badge className="bg-green-100 text-green-800">
                            Score: {ch.effectiveness_score}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-lg">
                  <h4 className="font-medium mb-1 text-sm">Recommendations</h4>
                  <p className="text-sm text-slate-700">{insights.sourcing_effectiveness.recommendations}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Items */}
          <Card>
            <CardHeader>
              <CardTitle>Recommended Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {insights.action_items.map((item, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-slate-900">{item.action}</h4>
                      <Badge className={getPriorityBadge(item.priority)}>
                        {item.priority.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">
                      <strong>Expected Impact:</strong> {item.expected_impact}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}