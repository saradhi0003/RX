import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  UserCheck,
  Star,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { InvokeLLM } from "@/integrations/Core";
import { Candidate } from "@/entities/Candidate";
import { Job } from "@/entities/Job";

export default function CandidateScreening({ candidate, job, onScreeningComplete }) {
  const [screening, setScreening] = useState(false);
  const [results, setResults] = useState(candidate?.screening_details || null);
  const [score, setScore] = useState(candidate?.screening_score || null);

  const performScreening = async () => {
    if (!candidate || !job) return;
    
    setScreening(true);
    try {
      // Build candidate profile
      const candidateProfile = {
        name: `${candidate.first_name} ${candidate.last_name}`,
        current_title: candidate.current_title || "Not specified",
        experience_years: candidate.experience_years || 0,
        skills: candidate.skills || [],
        work_authorization: candidate.work_authorization || "Not specified",
        location: candidate.location || "Not specified",
        availability: candidate.availability || "Not specified",
        notes: candidate.notes || ""
      };

      // Build job requirements
      const jobRequirements = {
        title: job.title,
        description: job.description || "",
        requirements: job.requirements || "",
        required_skills: job.required_skills || [],
        preferred_skills: job.preferred_skills || [],
        experience_required: job.experience_required || 0,
        location: job.location || "",
        remote_type: job.remote_type || "onsite",
        work_authorization: job.visa_restrictions || ""
      };

      // Call AI for screening
      const response = await InvokeLLM({
        prompt: `You are an expert technical recruiter. Screen the following candidate against the job requirements and provide a detailed analysis.

**Candidate Profile:**
${JSON.stringify(candidateProfile, null, 2)}

**Job Requirements:**
${JSON.stringify(jobRequirements, null, 2)}

Analyze:
1. Overall fit score (0-100)
2. Matching qualifications (list key matches)
3. Missing qualifications (list gaps)
4. Experience alignment (does years of experience match?)
5. Skills match (required vs. preferred)
6. Location/remote compatibility
7. Work authorization fit
8. Recommendation (Strong Fit, Good Fit, Potential Fit, Poor Fit)
9. Key strengths for this role
10. Areas of concern or development needs

Be thorough, honest, and constructive.`,
        response_json_schema: {
          type: "object",
          properties: {
            fit_score: { type: "number", minimum: 0, maximum: 100 },
            recommendation: { 
              type: "string", 
              enum: ["Strong Fit", "Good Fit", "Potential Fit", "Poor Fit"] 
            },
            matching_qualifications: {
              type: "array",
              items: { 
                type: "object",
                properties: {
                  qualification: { type: "string" },
                  evidence: { type: "string" }
                }
              }
            },
            missing_qualifications: {
              type: "array",
              items: { 
                type: "object",
                properties: {
                  qualification: { type: "string" },
                  severity: { type: "string", enum: ["Critical", "Important", "Nice to Have"] }
                }
              }
            },
            experience_alignment: {
              type: "object",
              properties: {
                match: { type: "boolean" },
                details: { type: "string" }
              }
            },
            skills_analysis: {
              type: "object",
              properties: {
                required_match_percentage: { type: "number", minimum: 0, maximum: 100 },
                preferred_match_percentage: { type: "number", minimum: 0, maximum: 100 },
                details: { type: "string" }
              }
            },
            location_fit: {
              type: "object",
              properties: {
                compatible: { type: "boolean" },
                details: { type: "string" }
              }
            },
            authorization_fit: {
              type: "object",
              properties: {
                compatible: { type: "boolean" },
                details: { type: "string" }
              }
            },
            key_strengths: { type: "array", items: { type: "string" } },
            concerns: { type: "array", items: { type: "string" } },
            summary: { type: "string" }
          },
          required: ["fit_score", "recommendation", "matching_qualifications", "missing_qualifications", "summary"]
        }
      });

      // Save screening results
      await Candidate.update(candidate.id, {
        screening_score: response.fit_score,
        screening_date: new Date().toISOString(),
        screening_details: response,
        status: "screened"
      });

      setScore(response.fit_score);
      setResults(response);
      
      if (onScreeningComplete) {
        onScreeningComplete(response);
      }
    } catch (error) {
      console.error("Screening error:", error);
      alert("Failed to perform screening. Please try again.");
    }
    setScreening(false);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-blue-600";
    if (score >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBgColor = (score) => {
    if (score >= 80) return "bg-green-100";
    if (score >= 60) return "bg-blue-100";
    if (score >= 40) return "bg-yellow-100";
    return "bg-red-100";
  };

  const getRecommendationBadge = (rec) => {
    const colors = {
      "Strong Fit": "bg-green-100 text-green-800",
      "Good Fit": "bg-blue-100 text-blue-800",
      "Potential Fit": "bg-yellow-100 text-yellow-800",
      "Poor Fit": "bg-red-100 text-red-800"
    };
    return colors[rec] || colors["Potential Fit"];
  };

  return (
    <div className="space-y-4">
      {!results ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              AI Candidate Screening
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-4">
              Screen this candidate against the job requirements using AI analysis. 
              Get a detailed fit score and qualification assessment.
            </p>
            <Button 
              onClick={performScreening} 
              disabled={screening || !job}
              className="w-full gap-2"
            >
              {screening ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Screening in progress...
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  Run AI Screening
                </>
              )}
            </Button>
            {!job && (
              <p className="text-xs text-red-600 mt-2">
                Job information required for screening
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Overall Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Screening Results
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={performScreening}
                  disabled={screening}
                >
                  {screening ? <Loader2 className="w-4 h-4 animate-spin" /> : "Re-screen"}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`text-4xl font-bold ${getScoreColor(score)}`}>
                      {Math.round(score)}
                    </div>
                    <div>
                      <Badge className={getRecommendationBadge(results.recommendation)}>
                        {results.recommendation}
                      </Badge>
                      <p className="text-xs text-slate-500 mt-1">
                        Screened: {candidate.screening_date ? new Date(candidate.screening_date).toLocaleString() : "Just now"}
                      </p>
                    </div>
                  </div>
                  <Progress value={score} className="h-2" />
                </div>
              </div>

              {results.summary && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-700">{results.summary}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Matching Qualifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-5 h-5" />
                Matching Qualifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results.matching_qualifications && results.matching_qualifications.length > 0 ? (
                <div className="space-y-3">
                  {results.matching_qualifications.map((item, idx) => (
                    <div key={idx} className="flex gap-3 p-3 bg-green-50 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{item.qualification}</p>
                        <p className="text-sm text-slate-600 mt-1">{item.evidence}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No matching qualifications identified</p>
              )}
            </CardContent>
          </Card>

          {/* Missing Qualifications */}
          {results.missing_qualifications && results.missing_qualifications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <XCircle className="w-5 h-5" />
                  Missing Qualifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {results.missing_qualifications.map((item, idx) => {
                    const severityColor = {
                      "Critical": "bg-red-50 border-red-200",
                      "Important": "bg-yellow-50 border-yellow-200",
                      "Nice to Have": "bg-blue-50 border-blue-200"
                    }[item.severity] || "bg-gray-50";

                    const severityIcon = {
                      "Critical": <XCircle className="w-5 h-5 text-red-600" />,
                      "Important": <AlertCircle className="w-5 h-5 text-yellow-600" />,
                      "Nice to Have": <AlertCircle className="w-5 h-5 text-blue-600" />
                    }[item.severity] || <AlertCircle className="w-5 h-5" />;

                    return (
                      <div key={idx} className={`flex gap-3 p-3 rounded-lg border ${severityColor}`}>
                        {severityIcon}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-slate-900">{item.qualification}</p>
                            <Badge variant="outline" className="text-xs">
                              {item.severity}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detailed Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Skills Analysis */}
              {results.skills_analysis && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Skills Match</h4>
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Required Skills</span>
                        <span className="font-medium">{Math.round(results.skills_analysis.required_match_percentage)}%</span>
                      </div>
                      <Progress value={results.skills_analysis.required_match_percentage} className="h-2" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Preferred Skills</span>
                        <span className="font-medium">{Math.round(results.skills_analysis.preferred_match_percentage)}%</span>
                      </div>
                      <Progress value={results.skills_analysis.preferred_match_percentage} className="h-2" />
                    </div>
                    <p className="text-xs text-slate-600 mt-2">{results.skills_analysis.details}</p>
                  </div>
                </div>
              )}

              {/* Experience Alignment */}
              {results.experience_alignment && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    {results.experience_alignment.match ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-yellow-600" />
                    )}
                    <h4 className="font-medium text-sm">Experience</h4>
                  </div>
                  <p className="text-xs text-slate-600">{results.experience_alignment.details}</p>
                </div>
              )}

              {/* Location Fit */}
              {results.location_fit && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    {results.location_fit.compatible ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <h4 className="font-medium text-sm">Location/Remote</h4>
                  </div>
                  <p className="text-xs text-slate-600">{results.location_fit.details}</p>
                </div>
              )}

              {/* Authorization Fit */}
              {results.authorization_fit && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    {results.authorization_fit.compatible ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    <h4 className="font-medium text-sm">Work Authorization</h4>
                  </div>
                  <p className="text-xs text-slate-600">{results.authorization_fit.details}</p>
                </div>
              )}

              {/* Key Strengths */}
              {results.key_strengths && results.key_strengths.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 text-green-700">Key Strengths</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {results.key_strengths.map((strength, idx) => (
                      <li key={idx} className="text-sm text-slate-700">{strength}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Concerns */}
              {results.concerns && results.concerns.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 text-red-700">Areas of Concern</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {results.concerns.map((concern, idx) => (
                      <li key={idx} className="text-sm text-slate-700">{concern}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}