import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Users, 
  BrainCircuit,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { InvokeLLM } from "@/integrations/Core";
import { Application } from "@/entities/all";
import ScoreDisplay from "./ScoreDisplay";

export default function BulkScoring({ jobs, candidates, applications, onUpdate }) {
  const [selectedJob, setSelectedJob] = useState("");
  const [isScoring, setIsScoring] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState([]);

  const getJobApplications = (jobId) => {
    return applications.filter(app => app.job_id === jobId);
  };

  const getCandidateById = (candidateId) => {
    return candidates.find(c => c.id === candidateId);
  };

  const handleBulkScore = async () => {
    if (!selectedJob) return;
    
    const job = jobs.find(j => j.id === selectedJob);
    const jobApplications = getJobApplications(selectedJob);
    
    if (!job || jobApplications.length === 0) return;
    
    setIsScoring(true);
    setProgress({ current: 0, total: jobApplications.length });
    setResults([]);
    
    const newResults = [];
    
    for (let i = 0; i < jobApplications.length; i++) {
      const application = jobApplications[i];
      const candidate = getCandidateById(application.candidate_id);
      
      if (!candidate) continue;
      
      try {
        setProgress({ current: i + 1, total: jobApplications.length });
        
        const prompt = `
          You are an expert AI recruiting assistant. Analyze the following candidate's profile against the provided job description.
          Provide a comprehensive analysis and a match score from 0 to 100.

          **Job Description:**
          Title: ${job.title}
          Description: ${job.description}
          Required Skills: ${job.required_skills?.join(", ") || "Not specified"}
          Experience Required: ${job.experience_required || "Not specified"} years
          Location: ${job.location}

          **Candidate Profile:**
          Name: ${candidate.first_name} ${candidate.last_name}
          Current Title: ${candidate.current_title}
          Current Company: ${candidate.current_company}
          Experience: ${candidate.experience_years} years
          Skills: ${candidate.skills?.join(", ") || "Not specified"}
          Location: ${candidate.location}

          Analyze their fit comprehensively and provide actionable insights.
        `;

        const response = await InvokeLLM({
          prompt,
          response_json_schema: {
            type: "object",
            properties: {
              match_score: { type: "number", description: "Overall score from 0-100" },
              summary: { type: "string", description: "A brief summary of the candidate's fit" },
              strengths: { 
                type: "array", 
                items: { type: "string" }, 
                description: "List of key strengths and positive matches" 
              },
              gaps: { 
                type: "array", 
                items: { type: "string" }, 
                description: "List of gaps or missing requirements" 
              },
              recommendations: {
                type: "array",
                items: { type: "string" },
                description: "Actionable recommendations for this candidate"
              }
            },
            required: ["match_score", "summary", "strengths", "gaps"]
          }
        });

        if (response && response.match_score !== undefined) {
          await Application.update(application.id, {
            match_score: response.match_score,
            score_details: response
          });
          
          newResults.push({
            candidate,
            application,
            score: response.match_score,
            details: response
          });
        }
      } catch (error) {
        console.error(`Error scoring candidate ${candidate.first_name} ${candidate.last_name}:`, error);
      }
    }
    
    setResults(newResults.sort((a, b) => (b.score || 0) - (a.score || 0)));
    setIsScoring(false);
    onUpdate();
  };

  const selectedJobData = jobs.find(j => j.id === selectedJob);
  const jobApplications = selectedJob ? getJobApplications(selectedJob) : [];
  const unscoredCount = jobApplications.filter(app => !app.match_score).length;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-blue-600" />
            Bulk Resume Scoring
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Select value={selectedJob} onValueChange={setSelectedJob}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a job to score candidates..." />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map(job => {
                    const appCount = getJobApplications(job.id).length;
                    return (
                      <SelectItem key={job.id} value={job.id}>
                        {job.title} ({appCount} candidates)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={handleBulkScore} 
              disabled={!selectedJob || isScoring || jobApplications.length === 0}
              className="gap-2"
            >
              {isScoring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scoring...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Score All Candidates
                </>
              )}
            </Button>
          </div>

          {selectedJobData && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold">{selectedJobData.title}</h4>
                <div className="flex gap-2">
                  <Badge variant="outline">{jobApplications.length} total</Badge>
                  <Badge className="bg-orange-100 text-orange-800">{unscoredCount} unscored</Badge>
                </div>
              </div>
              <p className="text-sm text-slate-600">{selectedJobData.description}</p>
              {selectedJobData.required_skills && (
                <div className="mt-2">
                  <span className="text-xs font-medium text-slate-500">Required Skills: </span>
                  <span className="text-xs text-slate-700">{selectedJobData.required_skills.join(", ")}</span>
                </div>
              )}
            </div>
          )}

          {isScoring && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Scoring Progress</span>
                <span className="text-sm text-slate-600">{progress.current} / {progress.total}</span>
              </div>
              <Progress value={(progress.current / progress.total) * 100} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Scoring Results - Ranked by Match Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Top Strengths</TableHead>
                  <TableHead>Key Gaps</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((result, index) => (
                  <TableRow key={result.application.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">#{index + 1}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{result.candidate.first_name} {result.candidate.last_name}</p>
                        <p className="text-sm text-slate-500">{result.candidate.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{result.candidate.current_title || "Not specified"}</p>
                        <p className="text-xs text-slate-500">{result.candidate.current_company}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ScoreDisplay score={result.score} details={result.details} />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {result.details.strengths?.slice(0, 2).map((strength, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-green-50 text-green-700 block">
                            {strength.length > 30 ? strength.substring(0, 30) + "..." : strength}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {result.details.gaps?.slice(0, 2).map((gap, i) => (
                          <Badge key={i} variant="outline" className="text-xs bg-red-50 text-red-700 block">
                            {gap.length > 30 ? gap.substring(0, 30) + "..." : gap}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}