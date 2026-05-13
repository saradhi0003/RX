import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import * as Core from "@/integrations/Core";
import { 
  Sparkles, 
  Loader2, 
  TrendingUp, 
  Brain, 
  Users, 
  Target,
  BookOpen,
  Lightbulb,
  ArrowRight,
  Briefcase
} from "lucide-react";

export default function CandidateAIEnrichment({ candidate, onEnrichmentComplete }) {
  const [enriching, setEnriching] = useState(false);
  const [enrichmentData, setEnrichmentData] = useState(null);

  const enrichProfile = async () => {
    setEnriching(true);
    try {
      const candidateContext = `
**Candidate: ${candidate.first_name} ${candidate.last_name}**

**Professional Details:**
- Current Title: ${candidate.current_title || 'N/A'}
- Current Company: ${candidate.current_company || 'N/A'}
- Years of Experience: ${candidate.experience_years || 0}
- Location: ${candidate.location || 'N/A'}
- Work Authorization: ${candidate.work_authorization || 'N/A'}

**Skills:**
${(candidate.skills || []).join(', ') || 'None listed'}

**Additional Experience:**
${candidate.addedExperience || 'N/A'}

**Real-time Experience:**
${candidate.realTimeExperience || 'N/A'}

**Notes:**
${candidate.notes || 'N/A'}

**Resume URL:**
${candidate.resume_url || 'Not provided'}
`;

      const prompt = `You are an expert career advisor and talent analyst with deep expertise in candidate profiling, skill taxonomy mapping, and career development.

**CANDIDATE TO ANALYZE:**
${candidateContext}

**YOUR COMPREHENSIVE ANALYSIS TASKS:**

**1. PROFESSIONAL SUMMARY (2-3 sentences):**
Create a concise, compelling professional summary that captures:
- Core expertise and technical strengths
- Years of experience and seniority level
- Key differentiators and unique value proposition
- Industry focus or domain specialization

**2. STANDARDIZED SKILL TAXONOMY MAPPING:**
Map the candidate's skills to standardized taxonomies (ESCO/ONET concepts):
- Technical Skills: Programming languages, frameworks, tools (normalize versions)
- Domain Skills: Industry knowledge, methodologies, certifications
- Soft Skills: Extracted from context (leadership, communication, problem-solving)
- Emerging Skills: Newer technologies or trends (AI/ML, cloud-native, DevOps)

For each skill provide:
- Normalized name (e.g., "React.js" → "React")
- ESCO/ONET category (e.g., "Software Development", "Data Analysis")
- Proficiency level: Beginner (1) | Intermediate (2) | Advanced (3) | Expert (4)
- Evidence: Quote or context showing this skill

**3. SOFT SKILLS ASSESSMENT:**
Based on resume language, job titles, and context, infer soft skills with confidence levels:

Analyze for indicators of:
- **Leadership & Management:** Team size mentions, "led", "managed", promotions, mentoring
- **Communication:** "presented", "documented", "collaborated", cross-functional work
- **Problem Solving:** "solved", "optimized", "improved", quantified results
- **Teamwork & Collaboration:** "cross-functional", "partnered", "contributed"
- **Initiative & Ownership:** "drove", "founded", "pioneered", "took ownership"
- **Adaptability:** Multiple domains, learning new tech, role changes
- **Analytical Thinking:** Data-driven decisions, metrics, A/B testing
- **Project Management:** "delivered", timelines, milestones, coordinated

For each soft skill provide:
- Skill name
- Confidence level: High (strong evidence) | Medium (some indicators) | Low (inferred)
- Evidence: Specific phrases or context supporting this assessment

**4. CAREER PATH RECOMMENDATIONS:**
Based on current position, experience, and skills, suggest 3-5 potential career paths:

For each path provide:
- Role title (e.g., "Senior Software Engineer", "Engineering Manager", "Solutions Architect")
- Rationale: Why this is a good fit
- Current readiness: Ready now | 6-12 months | 1-2 years | 2+ years
- Skills to develop: What's missing for this path
- Estimated market demand: High | Medium | Low

**5. JOB MATCH RECOMMENDATIONS:**
Suggest 3-5 job archetypes that would be excellent matches:

For each recommendation:
- Job title/type (e.g., "Full-Stack Engineer at Series A Startup")
- Match strength: Excellent (90%+) | Strong (75-89%) | Good (60-74%)
- Why it fits: Key alignment factors
- Ideal company stage: Startup | Growth | Enterprise
- Remote/Hybrid/Onsite preference based on location/profile

**6. PROFILE STRENGTH ASSESSMENT:**
Rate the candidate's profile completeness and market competitiveness:
- Profile completeness: 0-100 (resume quality, detail level, clarity)
- Market competitiveness: 0-100 (skill demand, experience level, uniqueness)
- Improvement areas: Top 3 things to strengthen profile

**7. ACTIONABLE INSIGHTS:**
Provide 3-5 specific, actionable recommendations:
- What to add to resume/profile
- Skills to highlight more prominently
- Certifications or training to pursue
- Experience gaps to address
- Networking or positioning strategies

**OUTPUT FORMAT (JSON ONLY, NO MARKDOWN):**

{
  "professional_summary": "string",
  "standardized_skills": [
    {
      "skill_name": "React",
      "normalized_name": "React",
      "category": "Frontend Development",
      "proficiency_level": 3,
      "proficiency_label": "Advanced",
      "evidence": "Built production React applications for 3+ years"
    }
  ],
  "soft_skills": [
    {
      "skill_name": "Leadership",
      "confidence": "high",
      "evidence": "Led team of 5 engineers, promoted to senior role",
      "score": 85
    }
  ],
  "career_paths": [
    {
      "role_title": "Engineering Manager",
      "rationale": "Strong technical background with demonstrated leadership",
      "readiness": "6-12 months",
      "skills_to_develop": ["People management", "Budgeting", "Strategic planning"],
      "market_demand": "high"
    }
  ],
  "job_recommendations": [
    {
      "job_title": "Senior Full-Stack Engineer",
      "match_strength": "excellent",
      "match_percentage": 92,
      "why_it_fits": "Skills align perfectly with full-stack requirements",
      "ideal_company_stage": "growth",
      "work_mode": "remote"
    }
  ],
  "profile_assessment": {
    "completeness_score": 75,
    "competitiveness_score": 82,
    "improvement_areas": [
      "Add quantified achievements",
      "Include more recent projects",
      "Highlight leadership experience"
    ]
  },
  "actionable_insights": [
    "Add metrics to job descriptions (e.g., 'Improved performance by 40%')",
    "Pursue AWS certification to strengthen cloud expertise",
    "Emphasize leadership in current role description"
  ]
}`;

      const response = await Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            professional_summary: { type: "string" },
            standardized_skills: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  skill_name: { type: "string" },
                  normalized_name: { type: "string" },
                  category: { type: "string" },
                  proficiency_level: { type: "number" },
                  proficiency_label: { type: "string" },
                  evidence: { type: "string" }
                }
              }
            },
            soft_skills: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  skill_name: { type: "string" },
                  confidence: { type: "string" },
                  evidence: { type: "string" },
                  score: { type: "number" }
                }
              }
            },
            career_paths: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  role_title: { type: "string" },
                  rationale: { type: "string" },
                  readiness: { type: "string" },
                  skills_to_develop: { type: "array", items: { type: "string" } },
                  market_demand: { type: "string" }
                }
              }
            },
            job_recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  job_title: { type: "string" },
                  match_strength: { type: "string" },
                  match_percentage: { type: "number" },
                  why_it_fits: { type: "string" },
                  ideal_company_stage: { type: "string" },
                  work_mode: { type: "string" }
                }
              }
            },
            profile_assessment: {
              type: "object",
              properties: {
                completeness_score: { type: "number" },
                competitiveness_score: { type: "number" },
                improvement_areas: { type: "array", items: { type: "string" } }
              }
            },
            actionable_insights: { type: "array", items: { type: "string" } }
          }
        }
      });

      setEnrichmentData(response);

      if (onEnrichmentComplete) {
        onEnrichmentComplete(response);
      }

    } catch (error) {
      console.error("Error enriching candidate profile:", error);
      alert("Failed to enrich profile. Please try again.");
    } finally {
      setEnriching(false);
    }
  };

  const getProficiencyColor = (level) => {
    if (level >= 4) return "bg-green-600 text-white";
    if (level >= 3) return "bg-green-400 text-white";
    if (level >= 2) return "bg-yellow-400 text-slate-900";
    return "bg-orange-400 text-white";
  };

  const getConfidenceColor = (confidence) => {
    if (confidence === "high") return "bg-green-100 text-green-800";
    if (confidence === "medium") return "bg-yellow-100 text-yellow-800";
    return "bg-orange-100 text-orange-800";
  };

  const getMatchColor = (strength) => {
    if (strength === "excellent") return "bg-green-100 text-green-800";
    if (strength === "strong") return "bg-blue-100 text-blue-800";
    return "bg-yellow-100 text-yellow-800";
  };

  const getReadinessColor = (readiness) => {
    if (readiness === "Ready now") return "bg-green-100 text-green-800";
    if (readiness === "6-12 months") return "bg-blue-100 text-blue-800";
    if (readiness === "1-2 years") return "bg-yellow-100 text-yellow-800";
    return "bg-orange-100 text-orange-800";
  };

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-600" />
            AI-Powered Profile Enrichment
          </CardTitle>
          <Button 
            onClick={enrichProfile} 
            disabled={enriching}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            {enriching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Enrich Profile
              </>
            )}
          </Button>
        </div>
        <p className="text-sm text-slate-600 mt-2">
          AI analysis with skill taxonomy mapping, soft skills assessment, and career recommendations
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {!enrichmentData && !enriching && (
          <div className="text-center py-8">
            <Brain className="w-12 h-12 text-purple-400 mx-auto mb-3" />
            <p className="text-slate-600 mb-4">
              Click "Enrich Profile" to generate comprehensive AI insights including:
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto text-sm">
              <div className="flex items-center gap-2 text-left">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span>Professional Summary</span>
              </div>
              <div className="flex items-center gap-2 text-left">
                <Target className="w-4 h-4 text-purple-600" />
                <span>Skill Taxonomy Mapping</span>
              </div>
              <div className="flex items-center gap-2 text-left">
                <Users className="w-4 h-4 text-purple-600" />
                <span>Soft Skills Assessment</span>
              </div>
              <div className="flex items-center gap-2 text-left">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span>Career Path Recommendations</span>
              </div>
              <div className="flex items-center gap-2 text-left">
                <Briefcase className="w-4 h-4 text-purple-600" />
                <span>Job Match Suggestions</span>
              </div>
              <div className="flex items-center gap-2 text-left">
                <Lightbulb className="w-4 h-4 text-purple-600" />
                <span>Actionable Insights</span>
              </div>
            </div>
          </div>
        )}

        {enriching && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
            <p className="text-slate-600">
              Running comprehensive AI analysis on {candidate.first_name}'s profile...
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Mapping skills to ESCO/ONET taxonomy • Assessing soft skills • Identifying career paths
            </p>
          </div>
        )}

        {enrichmentData && (
          <div className="space-y-6">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  Professional Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 leading-relaxed">
                  {enrichmentData.professional_summary}
                </p>
              </CardContent>
            </Card>

            {enrichmentData.profile_assessment && (
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    Profile Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Profile Completeness</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600 transition-all"
                            style={{ width: `${enrichmentData.profile_assessment.completeness_score}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {enrichmentData.profile_assessment.completeness_score}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Market Competitiveness</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-600 transition-all"
                            style={{ width: `${enrichmentData.profile_assessment.competitiveness_score}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-slate-900">
                          {enrichmentData.profile_assessment.competitiveness_score}%
                        </span>
                      </div>
                    </div>
                  </div>
                  {enrichmentData.profile_assessment.improvement_areas?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2">Key Improvement Areas:</h4>
                      <ul className="space-y-1">
                        {enrichmentData.profile_assessment.improvement_areas.map((area, i) => (
                          <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                            <ArrowRight className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                            <span>{area}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {enrichmentData.standardized_skills?.length > 0 && (
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-green-600" />
                    Standardized Skill Taxonomy (ESCO/ONET)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {enrichmentData.standardized_skills.map((skill, i) => (
                      <div key={i} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-slate-900">{skill.skill_name}</h4>
                            <p className="text-xs text-slate-500">{skill.category}</p>
                          </div>
                          <Badge className={getProficiencyColor(skill.proficiency_level)}>
                            {skill.proficiency_label}
                          </Badge>
                        </div>
                        {skill.evidence && (
                          <p className="text-xs text-slate-600 italic">
                            💡 {skill.evidence}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {enrichmentData.soft_skills?.length > 0 && (
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    Soft Skills Assessment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {enrichmentData.soft_skills.map((skill, i) => (
                      <div key={i} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-slate-900">{skill.skill_name}</h4>
                          <Badge className={getConfidenceColor(skill.confidence)}>
                            {skill.confidence}
                          </Badge>
                        </div>
                        {skill.score && (
                          <div className="mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-600"
                                  style={{ width: `${skill.score}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-slate-600">{skill.score}%</span>
                            </div>
                          </div>
                        )}
                        {skill.evidence && (
                          <p className="text-xs text-slate-600 italic">
                            {skill.evidence}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {enrichmentData.career_paths?.length > 0 && (
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    Recommended Career Paths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {enrichmentData.career_paths.map((path, i) => (
                      <div key={i} className="p-4 border-2 rounded-lg hover:border-purple-300 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-slate-900 text-lg">{path.role_title}</h4>
                          <Badge className={getReadinessColor(path.readiness)}>
                            {path.readiness}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-700 mb-3">{path.rationale}</p>
                        {path.skills_to_develop?.length > 0 && (
                          <div className="mb-2">
                            <span className="text-xs font-semibold text-slate-600">Skills to Develop:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {path.skills_to_develop.map((skill, j) => (
                                <Badge key={j} variant="outline" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {path.market_demand && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-500">Market Demand:</span>
                            <Badge variant="outline" className={
                              path.market_demand === "high" ? "border-green-500 text-green-700" :
                              path.market_demand === "medium" ? "border-blue-500 text-blue-700" :
                              "border-orange-500 text-orange-700"
                            }>
                              {path.market_demand}
                            </Badge>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {enrichmentData.job_recommendations?.length > 0 && (
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    Job Match Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {enrichmentData.job_recommendations.map((job, i) => (
                      <div key={i} className="p-4 border rounded-lg hover:border-blue-300 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-slate-900">{job.job_title}</h4>
                          <div className="flex items-center gap-2">
                            {job.match_percentage && (
                              <Badge className="bg-blue-100 text-blue-800">
                                {job.match_percentage}%
                              </Badge>
                            )}
                            <Badge className={getMatchColor(job.match_strength)}>
                              {job.match_strength}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-sm text-slate-700 mb-2">{job.why_it_fits}</p>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {job.ideal_company_stage && (
                            <Badge variant="outline">
                              {job.ideal_company_stage}
                            </Badge>
                          )}
                          {job.work_mode && (
                            <Badge variant="outline">
                              {job.work_mode}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {enrichmentData.actionable_insights?.length > 0 && (
              <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-amber-600" />
                    Actionable Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {enrichmentData.actionable_insights.map((insight, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-700">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}