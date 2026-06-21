import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileText, 
  BrainCircuit, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  Target,
  BarChart3,
  Loader2
} from "lucide-react";
import { InvokeLLM, UploadFile, ExtractDataFromUploadedFile } from "@/integrations/Core";

export default function AdvancedScoring({ onScoreGenerated }) {
  const [jobDescription, setJobDescription] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [isScoring, setIsScoring] = useState(false);
  const [results, setResults] = useState(null);

  const handleResumeUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setResumeFile(file);
    setIsScoring(true);

    try {
      const { file_url } = await UploadFile({ file });
      
      // Extract text from resume
      const parseResult = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            full_text: { type: "string", description: "Complete resume text content" },
            skills: { type: "array", items: { type: "string" }, description: "Extracted skills" },
            education: { type: "string", description: "Education information" },
            experience: { type: "string", description: "Work experience" },
            job_titles: { type: "array", items: { type: "string" }, description: "Previous job titles" }
          }
        }
      });
      
      if (parseResult.status === "success") {
        setResumeText(parseResult.output.full_text || "");
      }
    } catch (error) {
      console.error("Error processing resume:", error);
      alert("Error processing resume. Please try again.");
    }
    
    setIsScoring(false);
  };

  const performAdvancedScoring = async () => {
    if (!jobDescription.trim() || (!resumeText && !resumeFile)) {
      alert("Please provide both a job description and resume.");
      return;
    }

    setIsScoring(true);

    try {
      const prompt = `
        You are an expert ATS (Applicant Tracking System) analyzer. Perform a comprehensive resume-to-job match analysis following industry best practices.

        **JOB DESCRIPTION:**
        ${jobDescription}

        **RESUME CONTENT:**
        ${resumeText}

        **ANALYSIS REQUIREMENTS:**
        1. **Keyword Matching & Weighting**: Analyze hard skills (40%), soft skills (20%), education (20%), job titles (10%), other keywords (10%)
        2. **Skill Frequency**: Count how often each skill appears in JD vs resume
        3. **ATS Compatibility**: Check for ATS-friendly formatting and parsing
        4. **Target Score**: Aim for 75-80% match rate as optimal

        Provide detailed scoring breakdown with actionable recommendations.
      `;

      const response = await InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            overall_score: { 
              type: "number", 
              description: "Overall match score (0-100)" 
            },
            target_met: {
              type: "boolean",
              description: "Whether score meets 75-80% target range"
            },
            category_scores: {
              type: "object",
              properties: {
                hard_skills: { type: "number", description: "Hard skills match (0-100)" },
                soft_skills: { type: "number", description: "Soft skills match (0-100)" },
                education: { type: "number", description: "Education alignment (0-100)" },
                job_titles: { type: "number", description: "Job title relevance (0-100)" },
                other_keywords: { type: "number", description: "Other keywords match (0-100)" }
              }
            },
            skill_analysis: {
              type: "object",
              properties: {
                matched_skills: {
                  type: "array",
                  items: { 
                    type: "object",
                    properties: {
                      skill: { type: "string" },
                      jd_frequency: { type: "number" },
                      resume_frequency: { type: "number" },
                      importance: { type: "string", enum: ["high", "medium", "low"] }
                    }
                  }
                },
                missing_skills: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      skill: { type: "string" },
                      importance: { type: "string", enum: ["critical", "important", "nice_to_have"] },
                      suggestion: { type: "string" }
                    }
                  }
                },
                overrepresented_skills: {
                  type: "array",
                  items: { type: "string" }
                }
              }
            },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["add", "modify", "remove", "format"] },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  description: { type: "string" },
                  impact: { type: "string", description: "Expected score improvement" }
                }
              }
            },
            ats_insights: {
              type: "object",
              properties: {
                formatting_score: { type: "number", description: "ATS parsing friendliness (0-100)" },
                parsing_issues: { type: "array", items: { type: "string" } },
                optimization_tips: { type: "array", items: { type: "string" } }
              }
            },
            summary: {
              type: "string",
              description: "Executive summary of the analysis"
            }
          },
          required: ["overall_score", "category_scores", "skill_analysis", "recommendations", "summary"]
        }
      });

      if (response) {
        setResults(response);
        if (onScoreGenerated) {
          onScoreGenerated(response);
        }
      }
    } catch (error) {
      console.error("Error performing analysis:", error);
      alert("Error performing analysis. Please try again.");
    }

    setIsScoring(false);
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Job Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste the complete job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="min-h-[200px]"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Resume Upload
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="file"
              id="resume-upload-advanced"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleResumeUpload}
              disabled={isScoring}
            />
            <label
              htmlFor="resume-upload-advanced"
              className="cursor-pointer flex flex-col items-center gap-3 p-6 border-2 border-dashed border-blue-200 rounded-lg hover:border-blue-400 transition-colors"
            >
              {isScoring ? (
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              ) : (
                <Upload className="w-8 h-8 text-blue-600" />
              )}
              <div className="text-center">
                <p className="font-medium text-slate-900">
                  {isScoring ? "Processing..." : resumeFile ? resumeFile.name : "Upload Resume"}
                </p>
                <p className="text-sm text-slate-600">
                  PDF, DOC, DOCX, TXT supported
                </p>
              </div>
            </label>
            
            {resumeText && (
              <div className="p-3 bg-slate-50 rounded text-sm">
                <p className="font-medium mb-1">Extracted Content Preview:</p>
                <p className="text-slate-700 line-clamp-3">{resumeText.substring(0, 200)}...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Button */}
      <div className="flex justify-center">
        <Button
          onClick={performAdvancedScoring}
          disabled={isScoring || !jobDescription.trim() || !resumeText}
          className="gap-2 px-8 py-3 text-lg"
          size="lg"
        >
          {isScoring ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <BrainCircuit className="w-5 h-5" />
              Analyze Resume Match
            </>
          )}
        </Button>
      </div>

      {/* Results Section */}
      {results && (
        <div className="space-y-6">
          {/* Overall Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Overall Match Score
                </span>
                <div className="flex items-center gap-2">
                  {results.target_met ? (
                    <Badge className="bg-green-100 text-green-800 gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Target Met
                    </Badge>
                  ) : (
                    <Badge className="bg-orange-100 text-orange-800 gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Below Target
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="text-4xl font-bold text-slate-900">
                  {Math.round(results.overall_score)}%
                </div>
                <div className="flex-1">
                  <Progress value={results.overall_score} className="h-3" />
                  <p className="text-sm text-slate-600 mt-1">
                    Target: 75-80% • Current: {Math.round(results.overall_score)}%
                  </p>
                </div>
              </div>
              <p className="text-slate-700">{results.summary}</p>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Category Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(results.category_scores).map(([category, score]) => (
                  <div key={category} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium capitalize">
                        {category.replace('_', ' ')}
                      </h4>
                      <Badge variant="outline">{Math.round(score)}%</Badge>
                    </div>
                    <Progress value={score} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Skills Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">Matched Skills</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.skill_analysis.matched_skills?.slice(0, 8).map((skill, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-green-50 rounded">
                    <span className="font-medium">{skill.skill}</span>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge className={
                        skill.importance === 'high' ? 'bg-red-100 text-red-800' :
                        skill.importance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }>
                        {skill.importance}
                      </Badge>
                      <span className="text-slate-600">
                        JD: {skill.jd_frequency} | Resume: {skill.resume_frequency}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-red-700">Missing Skills</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {results.skill_analysis.missing_skills?.slice(0, 8).map((skill, index) => (
                  <div key={index} className="p-3 bg-red-50 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">{skill.skill}</span>
                      <Badge className={
                        skill.importance === 'critical' ? 'bg-red-500 text-white' :
                        skill.importance === 'important' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }>
                        {skill.importance}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">{skill.suggestion}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {results.recommendations?.map((rec, index) => (
                  <div key={index} className={`p-4 rounded-lg border-l-4 ${
                    rec.priority === 'high' ? 'border-red-500 bg-red-50' :
                    rec.priority === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                    'border-blue-500 bg-blue-50'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <Badge className={
                        rec.type === 'add' ? 'bg-green-100 text-green-800' :
                        rec.type === 'modify' ? 'bg-blue-100 text-blue-800' :
                        rec.type === 'remove' ? 'bg-red-100 text-red-800' :
                        'bg-purple-100 text-purple-800'
                      }>
                        {rec.type.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">{rec.impact}</Badge>
                    </div>
                    <p className="text-slate-700">{rec.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ATS Insights */}
          {results.ats_insights && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  ATS Compatibility Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Formatting Score</span>
                      <Badge variant="outline">{Math.round(results.ats_insights.formatting_score)}%</Badge>
                    </div>
                    <Progress value={results.ats_insights.formatting_score} className="h-2" />
                  </div>
                  
                  {results.ats_insights.parsing_issues?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-red-700 mb-2">Parsing Issues</h4>
                      <ul className="space-y-1">
                        {results.ats_insights.parsing_issues.map((issue, index) => (
                          <li key={index} className="text-sm text-red-600 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {results.ats_insights.optimization_tips?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-blue-700 mb-2">Optimization Tips</h4>
                      <ul className="space-y-1">
                        {results.ats_insights.optimization_tips.map((tip, index) => (
                          <li key={index} className="text-sm text-blue-600 flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}