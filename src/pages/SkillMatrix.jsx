
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Candidate } from "@/entities/Candidate";
import { Job } from "@/entities/Job";
import * as Core from "@/integrations/Core";
import PageHeader from "@/components/common/PageHeader";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import {
  Grid3x3,
  Loader2,
  Download,
  Filter,
  TrendingUp,
  Search,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Award
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function SkillMatrix() {
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("matrix"); // matrix, trends, gaps
  const [proficiencyFilter, setProficiencyFilter] = useState("all"); // all, high, medium, low

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsData, candidatesData] = await Promise.all([
        Job.filter({ status: "open" }, "-created_date", 100),
        Candidate.filter({ status: "active" }, "-updated_date", 300)
      ]);
      setJobs(jobsData || []);
      setCandidates(candidatesData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const toggleJobSelection = (jobId) => {
    setSelectedJobs(prev => 
      prev.includes(jobId) 
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  const analyzeSkillMatrix = async () => {
    if (selectedJobs.length === 0) {
      alert("Please select at least one job to analyze");
      return;
    }

    setAnalyzing(true);
    try {
      const selectedJobDetails = jobs.filter(j => selectedJobs.includes(j.id));

      const jobsContext = selectedJobDetails.map(job => `
**Job: ${job.title}**
- Description: ${job.description || 'N/A'}
- Required Skills: ${(job.required_skills || []).join(', ')}
- Preferred Skills: ${(job.preferred_skills || []).join(', ')}
- Requirements: ${job.requirements || 'N/A'}
- Experience Required: ${job.experience_required || 'N/A'} years
      `).join('\n---\n');

      const candidatesContext = candidates.map(c => `
**Candidate: ${c.first_name} ${c.last_name}**
- Current Title: ${c.current_title || 'N/A'}
- Experience: ${c.experience_years || 0} years
- Skills: ${(c.skills || []).join(', ')}
- Additional Experience: ${c.addedExperience || 'N/A'}
- Real-time Experience: ${c.realTimeExperience || 'N/A'}
- Location: ${c.location || 'N/A'}
- Work Auth: ${c.work_authorization || 'N/A'}
      `).join('\n---\n');

      const prompt = `You are an expert technical recruiter analyzing skill requirements and candidate proficiencies.

**JOBS TO ANALYZE:**
${jobsContext}

**CANDIDATES TO EVALUATE:**
${candidatesContext}

**YOUR TASK:**
1. Extract and normalize all technical skills from the jobs (e.g., "React.js" = "ReactJS" = "React")
2. For each candidate, score their proficiency in each skill on a scale of 0-100:
   - 90-100: Expert (deep experience, recent use, senior-level work)
   - 70-89: Proficient (solid experience, regular use)
   - 50-69: Intermediate (some experience, learning or past use)
   - 30-49: Beginner (minimal experience, needs training)
   - 0-29: No evidence (skill not demonstrated)

3. Consider:
   - Years of experience with the technology
   - Recency of use (recent = higher score)
   - Job title seniority (senior roles = higher proficiency)
   - Similar/related technologies (e.g., Vue.js helps with React)
   - Project complexity indicators

4. Identify skill gaps for each candidate
5. Rank top 5 candidates for each job
6. Calculate aggregate skill demand across all jobs

**OUTPUT FORMAT (JSON only):**
{
  "skills": ["skill1", "skill2", ...],
  "candidates_matrix": [
    {
      "candidate_id": "id",
      "candidate_name": "name",
      "skills_proficiency": {
        "skill1": 85,
        "skill2": 70
      },
      "overall_score": 75,
      "top_skills": ["skill", "skill", ...],
      "skill_gaps": ["skill", "skill", ...]
    }
  ],
  "job_rankings": {
    "job_id": {
      "job_title": "title",
      "top_candidates": [
        {
          "candidate_id": "id",
          "candidate_name": "name",
          "match_score": 85,
          "strengths": ["skill", ...],
          "gaps": ["skill", ...]
        }
      ]
    }
  },
  "skill_demand": [
    {
      "skill": "skill_name",
      "jobs_requiring": 3,
      "avg_proficiency": 65,
      "supply_gap": 35
    }
  ],
  "insights": {
    "most_demanded_skills": ["skill", ...],
    "hardest_to_fill_skills": ["skill", ...],
    "abundant_skills": ["skill", ...]
  }
}`;

      const response = await Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            skills: { type: "array", items: { type: "string" } },
            candidates_matrix: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  candidate_id: { type: "string" },
                  candidate_name: { type: "string" },
                  skills_proficiency: { type: "object", additionalProperties: { type: "number" } },
                  overall_score: { type: "number" },
                  top_skills: { type: "array", items: { type: "string" } },
                  skill_gaps: { type: "array", items: { type: "string" } }
                }
              }
            },
            job_rankings: { type: "object", additionalProperties: true },
            skill_demand: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  skill: { type: "string" },
                  jobs_requiring: { type: "number" },
                  avg_proficiency: { type: "number" },
                  supply_gap: { type: "number" }
                }
              }
            },
            insights: {
              type: "object",
              properties: {
                most_demanded_skills: { type: "array", items: { type: "string" } },
                hardest_to_fill_skills: { type: "array", items: { type: "string" } },
                abundant_skills: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      });

      setMatrixData({
        ...response,
        selectedJobs: selectedJobDetails
      });
    } catch (error) {
      console.error("Error analyzing skill matrix:", error);
      alert("Failed to analyze skill matrix. Please try again.");
    }
    setAnalyzing(false);
  };

  const getProficiencyColor = (score) => {
    if (score >= 90) return "bg-green-600";
    if (score >= 70) return "bg-green-400";
    if (score >= 50) return "bg-yellow-400";
    if (score >= 30) return "bg-orange-400";
    return "bg-red-400";
  };

  const getProficiencyLabel = (score) => {
    if (score >= 90) return "Expert";
    if (score >= 70) return "Proficient";
    if (score >= 50) return "Intermediate";
    if (score >= 30) return "Beginner";
    return "None";
  };

  const getOverallScoreBadgeClass = (score) => {
    if (score >= 70) return "bg-green-100 text-green-800";
    if (score >= 40) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const exportToCSV = () => {
    if (!matrixData) return;

    const headers = ["Candidate", ...matrixData.skills, "Overall Score"];
    const rows = matrixData.candidates_matrix.map(c => [
      c.candidate_name,
      ...matrixData.skills.map(skill => c.skills_proficiency[skill] || 0),
      c.overall_score
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skill-matrix-${Date.now()}.csv`;
    a.click();
  };

  const filteredCandidates = matrixData?.candidates_matrix.filter(c => {
    const matchesSearch = c.candidate_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (proficiencyFilter === "all") return matchesSearch;
    
    const avgScore = Object.values(c.skills_proficiency).reduce((a, b) => a + b, 0) / 
                     Object.values(c.skills_proficiency).length;
    
    if (proficiencyFilter === "high") return matchesSearch && avgScore >= 70;
    if (proficiencyFilter === "medium") return matchesSearch && avgScore >= 40 && avgScore < 70;
    if (proficiencyFilter === "low") return matchesSearch && avgScore < 40;
    
    return matchesSearch;
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Breadcrumbs items={[{ label: "AI Skill Matrix", icon: Grid3x3 }]} />
      
      <PageHeader
        title="AI Skill Matrix"
        subtitle="Analyze candidate skills across multiple roles with AI-powered proficiency scoring"
        right={
          <div className="flex items-center gap-2">
            {matrixData && (
              <Button variant="outline" onClick={exportToCSV} className="gap-2">
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            )}
            <Button onClick={analyzeSkillMatrix} disabled={analyzing || selectedJobs.length === 0} className="gap-2">
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyze Skills
                </>
              )}
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Jobs to Analyze</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {loading ? (
              <div className="col-span-full flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="col-span-full text-center py-8 text-slate-500">
                No open jobs available
              </div>
            ) : (
              jobs.map(job => (
                <button
                  key={job.id}
                  onClick={() => toggleJobSelection(job.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedJobs.includes(job.id)
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-slate-900">{job.title}</h4>
                    {selectedJobs.includes(job.id) && (
                      <CheckCircle className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2">{job.description}</p>
                  {job.required_skills && job.required_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {job.required_skills.slice(0, 3).map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {job.required_skills.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{job.required_skills.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
          {selectedJobs.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-slate-600">
                <strong>{selectedJobs.length}</strong> job(s) selected
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {matrixData && (
        <>
          <div className="flex items-center gap-2 border-b">
            <Button
              variant={viewMode === "matrix" ? "default" : "ghost"}
              onClick={() => setViewMode("matrix")}
              className="gap-2"
            >
              <Grid3x3 className="w-4 h-4" />
              Skill Matrix
            </Button>
            <Button
              variant={viewMode === "trends" ? "default" : "ghost"}
              onClick={() => setViewMode("trends")}
              className="gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Trends & Demand
            </Button>
            <Button
              variant={viewMode === "gaps" ? "default" : "ghost"}
              onClick={() => setViewMode("gaps")}
              className="gap-2"
            >
              <AlertCircle className="w-4 h-4" />
              Skill Gaps
            </Button>
          </div>

          {viewMode === "matrix" && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Candidate Skill Proficiency Matrix</CardTitle>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          placeholder="Search candidates..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 w-64"
                        />
                      </div>
                      <select
                        value={proficiencyFilter}
                        onChange={(e) => setProficiencyFilter(e.target.value)}
                        className="border rounded px-3 py-2 text-sm"
                      >
                        <option value="all">All Levels</option>
                        <option value="high">High Proficiency (70+)</option>
                        <option value="medium">Medium Proficiency (40-69)</option>
                        <option value="low">Low Proficiency (&lt;40)</option>
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2">
                          <th className="text-left p-3 sticky left-0 bg-white z-10 font-semibold">
                            Candidate
                          </th>
                          {matrixData.skills.map((skill, idx) => (
                            <th key={idx} className="text-center p-3 font-semibold min-w-[100px]">
                              {skill}
                            </th>
                          ))}
                          <th className="text-center p-3 font-semibold">
                            Overall
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCandidates?.map((candidate, idx) => {
                          const candidateData = candidates.find(c => c.id === candidate.candidate_id);
                          return (
                            <tr key={idx} className="border-b hover:bg-slate-50">
                              <td className="p-3 sticky left-0 bg-white">
                                <Link
                                  to={createPageUrl(`CandidateDetails?id=${candidate.candidate_id}`)}
                                  className="font-medium text-blue-600 hover:underline"
                                >
                                  {candidate.candidate_name}
                                </Link>
                                <div className="text-xs text-slate-500">
                                  {candidateData?.current_title || 'N/A'}
                                </div>
                              </td>
                              {matrixData.skills.map((skill, skillIdx) => {
                                const score = candidate.skills_proficiency[skill] || 0;
                                return (
                                  <td key={skillIdx} className="p-3">
                                    <div className="flex flex-col items-center gap-1">
                                      <div className={`w-full h-2 rounded-full ${getProficiencyColor(score)}`} />
                                      <span className="text-xs font-medium">{score}</span>
                                      <span className="text-xs text-slate-500">
                                        {getProficiencyLabel(score)}
                                      </span>
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="p-3">
                                <div className="flex flex-col items-center gap-1">
                                  <Badge className={getOverallScoreBadgeClass(candidate.overall_score)}>
                                    {Math.round(candidate.overall_score)}
                                  </Badge>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 pt-4 border-t flex items-center justify-center gap-6 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-green-600" />
                      <span>Expert (90+)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-green-400" />
                      <span>Proficient (70-89)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-yellow-400" />
                      <span>Intermediate (50-69)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-orange-400" />
                      <span>Beginner (30-49)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-red-400" />
                      <span>None (&lt;30)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.entries(matrixData.job_rankings || {}).map(([jobId, ranking]) => (
                  <Card key={jobId}>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Award className="w-5 h-5 text-yellow-600" />
                        Top Candidates: {ranking.job_title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {ranking.top_candidates?.slice(0, 5).map((candidate, idx) => (
                          <div key={idx} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <Link
                                to={createPageUrl(`CandidateDetails?id=${candidate.candidate_id}`)}
                                className="font-medium text-blue-600 hover:underline"
                              >
                                #{idx + 1} {candidate.candidate_name}
                              </Link>
                              <Badge className={candidate.match_score >= 80 ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}>
                                {candidate.match_score}% match
                              </Badge>
                            </div>
                            {candidate.strengths && candidate.strengths.length > 0 && (
                              <div className="text-xs mb-1">
                                <span className="text-green-700 font-medium">Strengths:</span>{" "}
                                <span className="text-slate-600">{candidate.strengths.join(", ")}</span>
                              </div>
                            )}
                            {candidate.gaps && candidate.gaps.length > 0 && (
                              <div className="text-xs">
                                <span className="text-orange-700 font-medium">Gaps:</span>{" "}
                                <span className="text-slate-600">{candidate.gaps.join(", ")}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {viewMode === "trends" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Skill Demand Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={matrixData.skill_demand?.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="skill" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="jobs_requiring" fill="#3b82f6" name="Jobs Requiring" />
                      <Bar dataKey="avg_proficiency" fill="#10b981" name="Avg Proficiency" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Supply vs Demand Gap</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={matrixData.skill_demand?.slice(0, 8).map(s => ({
                          name: s.skill,
                          value: s.supply_gap
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {matrixData.skill_demand?.slice(0, 8).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Key Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        Most Demanded Skills
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {matrixData.insights?.most_demanded_skills?.map((skill, idx) => (
                          <Badge key={idx} className="bg-blue-100 text-blue-800">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        Hardest to Fill
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {matrixData.insights?.hardest_to_fill_skills?.map((skill, idx) => (
                          <Badge key={idx} className="bg-red-100 text-red-800">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        Abundant Skills
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {matrixData.insights?.abundant_skills?.map((skill, idx) => (
                          <Badge key={idx} className="bg-green-100 text-green-800">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {viewMode === "gaps" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {matrixData.candidates_matrix
                ?.filter(c => c.skill_gaps && c.skill_gaps.length > 0)
                .map((candidate, idx) => {
                  const candidateData = candidates.find(c => c.id === candidate.candidate_id);
                  return (
                    <Card key={idx}>
                      <CardHeader>
                        <CardTitle className="text-base">
                          <Link
                            to={createPageUrl(`CandidateDetails?id=${candidate.candidate_id}`)}
                            className="text-blue-600 hover:underline"
                          >
                            {candidate.candidate_name}
                          </Link>
                        </CardTitle>
                        <p className="text-sm text-slate-600">
                          {candidateData?.current_title || 'N/A'}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-semibold text-green-700 mb-2">
                              Top Skills
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {candidate.top_skills?.map((skill, i) => (
                                <Badge key={i} className="bg-green-100 text-green-800">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-red-700 mb-2">
                              Skill Gaps
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {candidate.skill_gaps?.map((skill, i) => (
                                <Badge key={i} className="bg-red-100 text-red-800">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </>
      )}

      {!matrixData && !analyzing && (
        <Card>
          <CardContent className="p-12 text-center">
            <Grid3x3 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No Analysis Yet
            </h3>
            <p className="text-slate-600 mb-6">
              Select one or more jobs above and click "Analyze Skills" to generate<br />
              AI-powered skill matrix with candidate proficiency scoring.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
