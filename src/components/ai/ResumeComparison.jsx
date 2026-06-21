import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  GitCompare, 
  TrendingUp, 
  Award,
  Plus,
  X
} from "lucide-react";
import ScoreDisplay from "./ScoreDisplay";

export default function ResumeComparison({ candidates, jobs, applications }) {
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");

  const addCandidate = (candidateId) => {
    if (!selectedCandidates.includes(candidateId) && selectedCandidates.length < 5) {
      setSelectedCandidates([...selectedCandidates, candidateId]);
    }
  };

  const removeCandidate = (candidateId) => {
    setSelectedCandidates(selectedCandidates.filter(id => id !== candidateId));
  };

  const getCandidateById = (id) => candidates.find(c => c.id === id);
  const getJobById = (id) => jobs.find(j => j.id === id);
  
  const getCandidateApplication = (candidateId, jobId) => {
    return applications.find(app => app.candidate_id === candidateId && app.job_id === jobId);
  };

  const selectedJobData = selectedJob ? getJobById(selectedJob) : null;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-purple-600" />
            Resume Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Job Position</label>
              <Select value={selectedJob} onValueChange={setSelectedJob}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a job for comparison..." />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map(job => (
                    <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Add Candidates (max 5)</label>
              <Select onValueChange={addCandidate}>
                <SelectTrigger>
                  <SelectValue placeholder="Add candidate to compare..." />
                </SelectTrigger>
                <SelectContent>
                  {candidates
                    .filter(c => !selectedCandidates.includes(c.id))
                    .map(candidate => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.first_name} {candidate.last_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedJobData && (
            <div className="p-4 bg-slate-50 rounded-lg">
              <h4 className="font-semibold mb-2">{selectedJobData.title}</h4>
              <p className="text-sm text-slate-600 mb-2">{selectedJobData.description}</p>
              {selectedJobData.required_skills && (
                <div>
                  <span className="text-xs font-medium text-slate-500">Required Skills: </span>
                  <span className="text-xs text-slate-700">{selectedJobData.required_skills.join(", ")}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Candidates Pills */}
      {selectedCandidates.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {selectedCandidates.map(candidateId => {
                const candidate = getCandidateById(candidateId);
                return (
                  <Badge key={candidateId} variant="secondary" className="gap-2">
                    {candidate.first_name} {candidate.last_name}
                    <button onClick={() => removeCandidate(candidateId)}>
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Results */}
      {selectedCandidates.length > 1 && selectedJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-gold-500" />
              Side-by-Side Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {selectedCandidates.map(candidateId => {
                const candidate = getCandidateById(candidateId);
                const application = getCandidateApplication(candidateId, selectedJob);
                
                return (
                  <Card key={candidateId} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{candidate.first_name} {candidate.last_name}</h4>
                          <p className="text-sm text-slate-600">{candidate.current_title}</p>
                        </div>
                        {application && application.match_score && (
                          <ScoreDisplay score={application.match_score} details={application.score_details} />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h5 className="font-medium text-xs text-slate-500 mb-2">EXPERIENCE</h5>
                        <p className="text-sm">{candidate.experience_years} years</p>
                        <p className="text-xs text-slate-600">{candidate.current_company}</p>
                      </div>
                      
                      <div>
                        <h5 className="font-medium text-xs text-slate-500 mb-2">LOCATION</h5>
                        <p className="text-sm">{candidate.location || "Not specified"}</p>
                      </div>
                      
                      <div>
                        <h5 className="font-medium text-xs text-slate-500 mb-2">SKILLS</h5>
                        <div className="flex flex-wrap gap-1">
                          {candidate.skills?.slice(0, 4).map((skill, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {candidate.skills?.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{candidate.skills.length - 4}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {application && application.score_details && (
                        <div>
                          <h5 className="font-medium text-xs text-slate-500 mb-2">TOP STRENGTHS</h5>
                          <div className="space-y-1">
                            {application.score_details.strengths?.slice(0, 2).map((strength, index) => (
                              <p key={index} className="text-xs text-green-700 bg-green-50 p-1 rounded">
                                {strength}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {application && application.score_details && (
                        <div>
                          <h5 className="font-medium text-xs text-slate-500 mb-2">KEY GAPS</h5>
                          <div className="space-y-1">
                            {application.score_details.gaps?.slice(0, 2).map((gap, index) => (
                              <p key={index} className="text-xs text-red-700 bg-red-50 p-1 rounded">
                                {gap}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCandidates.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">No Candidates Selected</h3>
            <p className="text-slate-600">Select a job position and add candidates to start comparing resumes.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}