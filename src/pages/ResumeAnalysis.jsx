import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Upload, 
  BrainCircuit, 
  BarChart3, 
  Users, 
  FileText,
  TrendingUp,
  Award,
  Zap,
  Loader2,
  GitCompare,
  Target
} from "lucide-react";
import { Candidate, Job, Application } from "@/entities/all";
import { InvokeLLM } from "@/integrations/Core";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ScoreDisplay from "../components/ai/ScoreDisplay";
import BulkScoring from "../components/ai/BulkScoring";
import ResumeComparison from "../components/ai/ResumeComparison";
import AdvancedScoring from "../components/ai/AdvancedScoring";
import ResumeVersionComparison from "../components/ai/ResumeVersionComparison";

export default function ResumeAnalysis() {
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [scoringProgress, setScoringProgress] = useState({ total: 0, completed: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [candidatesData, jobsData, applicationsData] = await Promise.all([
        Candidate.list("-created_date"),
        Job.list("-created_date"),
        Application.list("-created_date")
      ]);
      
      setCandidates(candidatesData);
      setJobs(jobsData);
      setApplications(applicationsData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const getJobApplications = (jobId) => {
    return applications.filter(app => app.job_id === jobId);
  };

  const getCandidateById = (candidateId) => {
    return candidates.find(c => c.id === candidateId);
  };

  const getTopScoredCandidates = () => {
    return applications
      .filter(app => app.match_score !== undefined && app.match_score !== null)
      .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
      .slice(0, 10);
  };

  const getAverageScore = () => {
    const scoredApps = applications.filter(app => app.match_score !== undefined);
    if (scoredApps.length === 0) return 0;
    return scoredApps.reduce((sum, app) => sum + app.match_score, 0) / scoredApps.length;
  };

  const getTotalScored = () => {
    return applications.filter(app => app.match_score !== undefined).length;
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Resume Analysis & Scoring</h1>
          <p className="text-slate-600 mt-1">AI-powered candidate evaluation and comparison with industry best practices</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <BrainCircuit className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{getTotalScored()}</p>
                <p className="text-sm text-slate-600">Candidates Scored</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{getAverageScore().toFixed(1)}</p>
                <p className="text-sm text-slate-600">Average Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Target className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {applications.filter(app => app.match_score >= 75).length}
                </p>
                <p className="text-sm text-slate-600">Target Met (75%+)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Zap className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{jobs.length}</p>
                <p className="text-sm text-slate-600">Active Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="advanced-scoring">Advanced Scoring</TabsTrigger>
          <TabsTrigger value="version-comparison">Version Comparison</TabsTrigger>
          <TabsTrigger value="bulk-scoring">Bulk Scoring</TabsTrigger>
          <TabsTrigger value="candidate-comparison">Candidate Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  Top Scored Candidates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Candidate</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Job</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getTopScoredCandidates().slice(0, 5).map(app => {
                      const candidate = getCandidateById(app.candidate_id);
                      const job = jobs.find(j => j.id === app.job_id);
                      if (!candidate) return null;
                      return (
                        <TableRow key={app.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{candidate.first_name} {candidate.last_name}</p>
                              <p className="text-sm text-slate-500">{candidate.current_title}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <ScoreDisplay score={app.match_score} details={app.score_details} />
                          </TableCell>
                          <TableCell className="text-sm">{job?.title || 'Unknown Job'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  Score Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span>Excellent Match (80-100%)</span>
                    <Badge className="bg-green-100 text-green-800">
                      {applications.filter(app => app.match_score >= 80).length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span>Good Match (75-79%)</span>
                    <Badge className="bg-blue-100 text-blue-800">
                      {applications.filter(app => app.match_score >= 75 && app.match_score < 80).length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                    <span>Fair Match (60-74%)</span>
                    <Badge className="bg-yellow-100 text-yellow-800">
                      {applications.filter(app => app.match_score >= 60 && app.match_score < 75).length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span>Poor Match (Below 60%)</span>
                    <Badge className="bg-red-100 text-red-800">
                      {applications.filter(app => app.match_score < 60).length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="advanced-scoring">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-600" />
                Advanced ATS Resume Scoring
              </CardTitle>
              <p className="text-slate-600 mt-2">
                Industry-standard resume analysis following Jobscan methodology with 75-80% target scoring
              </p>
            </CardHeader>
            <CardContent>
              <AdvancedScoring onScoreGenerated={loadData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="version-comparison">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-indigo-600" />
                Resume Version A/B Testing
              </CardTitle>
              <p className="text-slate-600 mt-2">
                Compare multiple resume versions to identify the best performing format
              </p>
            </CardHeader>
            <CardContent>
              <ResumeVersionComparison />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk-scoring">
          <BulkScoring 
            jobs={jobs} 
            candidates={candidates} 
            applications={applications}
            onUpdate={loadData}
          />
        </TabsContent>

        <TabsContent value="candidate-comparison">
          <ResumeComparison 
            candidates={candidates}
            jobs={jobs}
            applications={applications}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}