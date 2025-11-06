import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, AlertCircle, User, CheckCircle, XCircle, AlertTriangle, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { addNotification } from "@/components/notifications/NotificationToast";

export default function RecommendedCandidates({ job }) {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [narrativeAnalysis, setNarrativeAnalysis] = useState('');
  const [overallInsights, setOverallInsights] = useState('');
  const [analyzed, setAnalyzed] = useState(false);
  const [useXAI, setUseXAI] = useState(true); // Toggle between xAI and regular AI

  const analyzeMatches = async () => {
    if (!job?.id) {
      addNotification({ type: "error", title: "Error", message: "Job information is missing" });
      return;
    }

    setLoading(true);
    try {
      // Fetch candidates
      const candidatesList = await base44.entities.Candidate.list("-updated_date", 200);
      
      // Filter active candidates only
      const activeCandidates = candidatesList.filter(c => 
        c.status && !['inactive', 'do_not_contact'].includes(c.status.toLowerCase())
      );

      if (activeCandidates.length === 0) {
        addNotification({ type: "warning", title: "No Candidates", message: "No active candidates found to analyze" });
        setLoading(false);
        return;
      }

      if (useXAI) {
        // Use xAI Grok for enhanced matching
        const response = await base44.functions.invoke('xaiMatch', {
          job: job,
          candidates: activeCandidates,
          matchType: "comprehensive"
        });

        if (response.data?.success) {
          setMatches(response.data.structured_matches || []);
          setNarrativeAnalysis(response.data.narrative_analysis || '');
          setOverallInsights(response.data.overall_insights || '');
          setAnalyzed(true);
          
          addNotification({ 
            type: "success", 
            title: "Analysis Complete", 
            message: `Analyzed ${response.data.analyzed_count} candidates using xAI Grok` 
          });
        } else {
          throw new Error(response.data?.error || 'AI matching failed');
        }
      } else {
        // Fallback to regular AI matching
        const response = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a recruitment expert. Analyze these candidates for the following job:

Job: ${job.title}
Required Skills: ${job.required_skills?.join(', ') || 'N/A'}
Experience Required: ${job.experience_required || 'N/A'} years

Candidates:
${activeCandidates.slice(0, 20).map(c => `
- ${c.first_name} ${c.last_name}
  Skills: ${c.skills?.join(', ') || 'N/A'}
  Experience: ${c.experience_years || 'N/A'} years
  Current Title: ${c.current_title || 'N/A'}
`).join('\n')}

Provide a match score (0-100) and brief analysis for each candidate.`,
          response_json_schema: {
            type: "object",
            properties: {
              matches: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    candidate_id: { type: "string" },
                    match_score: { type: "number" },
                    strengths: { type: "array", items: { type: "string" } },
                    gaps: { type: "array", items: { type: "string" } },
                    recommendation: { type: "string" },
                    key_insight: { type: "string" }
                  }
                }
              }
            }
          }
        });

        setMatches(response.matches || []);
        setAnalyzed(true);
        
        addNotification({ 
          type: "success", 
          title: "Analysis Complete", 
          message: `Analyzed ${activeCandidates.length} candidates` 
        });
      }

    } catch (error) {
      console.error("Error analyzing candidates:", error);
      addNotification({ 
        type: "error", 
        title: "Analysis Failed", 
        message: error.message || "Failed to analyze candidates" 
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "bg-green-100 text-green-800 border-green-300";
    if (score >= 60) return "bg-blue-100 text-blue-800 border-blue-300";
    if (score >= 40) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-red-100 text-red-800 border-red-300";
  };

  const getRecommendationIcon = (recommendation) => {
    switch(recommendation?.toLowerCase()) {
      case 'strong_hire':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'hire':
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case 'maybe':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'pass':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <User className="w-5 h-5 text-slate-400" />;
    }
  };

  const getRecommendationLabel = (recommendation) => {
    switch(recommendation?.toLowerCase()) {
      case 'strong_hire':
        return 'Strong Hire';
      case 'hire':
        return 'Hire';
      case 'maybe':
        return 'Maybe';
      case 'pass':
        return 'Pass';
      default:
        return 'No Recommendation';
    }
  };

  const sortedMatches = [...matches].sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              onClick={analyzeMatches}
              disabled={loading}
              className={`gap-2 ${useXAI ? 'bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 hover:from-purple-700 hover:via-blue-700 hover:to-cyan-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing with {useXAI ? 'xAI Grok' : 'AI'}...
                </>
              ) : (
                <>
                  {useXAI ? <Zap className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                  Analyze with {useXAI ? 'xAI Grok' : 'AI'}
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUseXAI(!useXAI)}
              className="gap-2"
            >
              {useXAI ? (
                <>
                  <Zap className="w-4 h-4 text-purple-600" />
                  Using xAI Grok
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Using Standard AI
                </>
              )}
            </Button>
          </div>
        </div>
        
        {analyzed && (
          <Badge variant="outline" className="gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            {matches.length} candidates analyzed
          </Badge>
        )}
      </div>

      {overallInsights && (
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Overall Insights from {useXAI ? 'xAI Grok' : 'AI'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 leading-relaxed">{overallInsights}</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-3" />
            <p className="text-sm text-slate-600">Analyzing candidates with {useXAI ? 'xAI Grok' : 'AI'}...</p>
            <p className="text-xs text-slate-500 mt-1">This may take a moment</p>
          </div>
        </div>
      )}

      {!loading && !analyzed && (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">No Analysis Yet</h3>
            <p className="text-slate-600 mb-4">
              Click the "Analyze" button above to find the best candidate matches for this job using {useXAI ? 'xAI Grok\'s advanced AI' : 'our AI matching engine'}.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && analyzed && sortedMatches.length === 0 && (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">No Matches Found</h3>
            <p className="text-slate-600">
              No suitable candidates were found for this position.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && sortedMatches.length > 0 && (
        <div className="space-y-4">
          {sortedMatches.map((match, index) => {
            const candidate = match.candidate_id ? { id: match.candidate_id } : null;
            
            return (
              <Card key={match.candidate_id || index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white font-semibold text-lg">
                        #{index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {candidate && (
                            <Link 
                              to={createPageUrl(`CandidateDetails?id=${candidate.id}`)}
                              className="text-lg font-semibold text-blue-600 hover:underline"
                            >
                              Candidate #{match.candidate_id?.slice(-6)}
                            </Link>
                          )}
                          {getRecommendationIcon(match.recommendation)}
                          <Badge variant="outline" className="text-xs">
                            {getRecommendationLabel(match.recommendation)}
                          </Badge>
                        </div>
                        {match.key_insight && (
                          <p className="text-sm text-slate-600 mt-1">{match.key_insight}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-bold mb-1 ${match.match_score >= 80 ? 'text-green-600' : match.match_score >= 60 ? 'text-blue-600' : match.match_score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {Math.round(match.match_score || 0)}
                      </div>
                      <Badge className={`${getScoreColor(match.match_score || 0)} border`}>
                        Match Score
                      </Badge>
                      {match.cultural_fit_score !== undefined && (
                        <div className="text-xs text-slate-500 mt-1">
                          Cultural Fit: {Math.round(match.cultural_fit_score)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {match.strengths && match.strengths.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          Strengths
                        </h4>
                        <ul className="space-y-1">
                          {match.strengths.map((strength, idx) => (
                            <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                              <span className="text-green-600 mt-0.5">•</span>
                              <span>{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {match.gaps && match.gaps.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-orange-700 mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          Gaps & Concerns
                        </h4>
                        <ul className="space-y-1">
                          {match.gaps.map((gap, idx) => (
                            <li key={idx} className="text-sm text-slate-700 flex items-start gap-2">
                              <span className="text-orange-600 mt-0.5">•</span>
                              <span>{gap}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {match.risk_factors && match.risk_factors.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        Risk Factors
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {match.risk_factors.map((risk, idx) => (
                          <Badge key={idx} className="bg-red-100 text-red-800 border-red-300">
                            {risk}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {candidate && (
                    <div className="mt-4 pt-4 border-t">
                      <Link to={createPageUrl(`CandidateDetails?id=${candidate.id}`)}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <User className="w-4 h-4" />
                          View Full Profile
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {narrativeAnalysis && (
        <Card className="border-slate-200 bg-slate-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Detailed Analysis from {useXAI ? 'xAI Grok' : 'AI'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-slate-700 font-sans leading-relaxed">
                {narrativeAnalysis}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}