import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  Sparkles,
  TrendingUp,
  Star,
  ThumbsUp,
  ThumbsDown,
  Settings,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
  Award,
  Target,
  Zap,
  Users,
  Mail,
  Phone,
  MapPin,
  Briefcase
} from "lucide-react";
import { Candidate } from "@/entities/Candidate";
import { MatchFeedback } from "@/entities/MatchFeedback";
import { MatchingProfile } from "@/entities/MatchingProfile";
import * as Core from "@/integrations/Core";
import { addNotification } from "@/components/notifications/NotificationToast";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

// AI Model selector with reasoning capabilities
const AI_MODELS = [
  { value: "o1", label: "OpenAI o1 (Reasoning)", description: "Best for complex analysis", icon: Brain },
  { value: "claude-4.5", label: "Claude 4.5 Opus", description: "Balanced performance", icon: Sparkles },
  { value: "gpt-5", label: "GPT-5 (Preview)", description: "Latest capabilities", icon: Zap },
  { value: "gpt-4o", label: "GPT-4o", description: "Fast & reliable", icon: TrendingUp },
  { value: "auto", label: "Auto-select", description: "Best model for task", icon: Target }
];

export default function AdvancedCandidateMatching({ job, onMatchComplete }) {
  const [matchingProfile, setMatchingProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [matchedCandidates, setMatchedCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedCandidate, setExpandedCandidate] = useState(null);
  const [feedbackMode, setFeedbackMode] = useState(null);

  // Load matching profiles
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const data = await MatchingProfile.list("-created_date");
        setProfiles(data || []);
        
        const defaultProfile = data.find(p => p.is_default && p.is_active);
        if (defaultProfile) {
          setSelectedProfileId(defaultProfile.id);
          setMatchingProfile(defaultProfile);
        }
      } catch (error) {
        console.error("Error loading matching profiles:", error);
      }
    };
    loadProfiles();
  }, []);

  // Load candidates
  useEffect(() => {
    const loadCandidates = async () => {
      try {
        const data = await Candidate.list("-updated_date", 200);
        setCandidates(data || []);
      } catch (error) {
        console.error("Error loading candidates:", error);
      }
    };
    loadCandidates();
  }, []);

  const createDefaultProfile = () => {
    return {
      name: `Match Profile for ${job?.title || "Position"}`,
      job_id: job?.id,
      job_type: "general",
      criteria_weights: {
        technical_skills: 30,
        experience_years: 20,
        role_seniority: 15,
        domain_expertise: 15,
        soft_skills: 10,
        education: 5,
        location_fit: 5
      },
      required_skills: (job?.required_skills || []).map(skill => ({
        skill,
        importance: "must_have",
        min_years: 0
      })),
      soft_skills_keywords: ["leadership", "collaboration", "communication", "problem-solving", "adaptability"],
      ai_model: "auto",
      matching_strategy: "balanced",
      learning_enabled: true,
      is_active: true,
      is_default: false
    };
  };

  const runAdvancedMatching = async () => {
    if (!matchingProfile && !selectedProfileId) {
      addNotification({
        type: "warning",
        title: "No Profile Selected",
        message: "Please select or create a matching profile first"
      });
      return;
    }

    setAnalyzing(true);
    const startTime = Date.now();

    try {
      const profile = matchingProfile || profiles.find(p => p.id === selectedProfileId);
      const modelToUse = profile.ai_model === "auto" ? "o1" : profile.ai_model;

      // Build comprehensive matching prompt with reasoning focus
      const prompt = `You are an expert AI talent matcher with advanced reasoning capabilities. Analyze candidates for the following position using multi-dimensional weighted criteria.

**JOB DETAILS:**
- Title: ${job.title}
- Description: ${job.description}
- Required Skills: ${(job.required_skills || []).join(", ")}
- Experience Required: ${job.experience_required || "Not specified"} years
- Location: ${job.location || "Not specified"}

**MATCHING CRITERIA WEIGHTS (Total: 100%):**
${Object.entries(profile.criteria_weights || {})
  .map(([key, weight]) => `- ${key.replace(/_/g, " ")}: ${weight}%`)
  .join("\n")}

**REQUIRED SKILLS WITH IMPORTANCE:**
${(profile.required_skills || [])
  .map(s => `- ${s.skill} (${s.importance}) - Min ${s.min_years || 0} years`)
  .join("\n")}

**SOFT SKILLS TO EVALUATE:**
${(profile.soft_skills_keywords || []).join(", ")}

**MATCHING STRATEGY:** ${profile.matching_strategy}

**CANDIDATES TO ANALYZE:**
${candidates.slice(0, 50).map((c, idx) => `
Candidate ${idx + 1}:
- Name: ${c.first_name} ${c.last_name}
- Title: ${c.current_title || "Not specified"}
- Experience: ${c.experience_years || 0} years
- Skills: ${(c.skills || []).join(", ")}
- Location: ${c.location || "Not specified"}
- Status: ${c.status}
- Notes: ${c.notes || "None"}
`).join("\n")}

**YOUR TASK:**
Use advanced reasoning to:
1. Analyze each candidate against weighted criteria
2. Extract soft skills from notes/profiles using NLP
3. Calculate weighted match scores (0-100)
4. Provide detailed explanations for top matches
5. Identify hidden strengths and red flags
6. Rank candidates by overall fit

Return JSON with this structure:
{
  "model_used": "${modelToUse}",
  "reasoning_steps": ["step 1", "step 2", "..."],
  "matches": [
    {
      "candidate_index": 0,
      "candidate_name": "...",
      "overall_score": 0-100,
      "criteria_scores": {
        "technical_skills": 0-100,
        "experience_years": 0-100,
        "role_seniority": 0-100,
        "domain_expertise": 0-100,
        "soft_skills": 0-100,
        "education": 0-100,
        "location_fit": 0-100
      },
      "weighted_score": 0-100,
      "strengths": ["..."],
      "concerns": ["..."],
      "extracted_soft_skills": ["..."],
      "recommendation": "strong_match | good_match | potential_match | poor_match",
      "reasoning": "Detailed explanation..."
    }
  ]
}`;

      const response = await Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            model_used: { type: "string" },
            reasoning_steps: { type: "array", items: { type: "string" } },
            matches: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  candidate_index: { type: "number" },
                  candidate_name: { type: "string" },
                  overall_score: { type: "number" },
                  criteria_scores: {
                    type: "object",
                    additionalProperties: { type: "number" }
                  },
                  weighted_score: { type: "number" },
                  strengths: { type: "array", items: { type: "string" } },
                  concerns: { type: "array", items: { type: "string" } },
                  extracted_soft_skills: { type: "array", items: { type: "string" } },
                  recommendation: { type: "string" },
                  reasoning: { type: "string" }
                }
              }
            }
          }
        }
      });

      const processingTime = Date.now() - startTime;

      // Enrich matches with full candidate data
      const enrichedMatches = (response.matches || [])
        .map(match => ({
          ...match,
          candidate: candidates[match.candidate_index],
          processing_time_ms: processingTime,
          ai_model_used: response.model_used
        }))
        .filter(m => m.candidate)
        .sort((a, b) => b.weighted_score - a.weighted_score);

      setMatchedCandidates(enrichedMatches);

      // Update profile performance metrics
      if (profile.id) {
        await MatchingProfile.update(profile.id, {
          performance_metrics: {
            ...profile.performance_metrics,
            total_matches: (profile.performance_metrics?.total_matches || 0) + enrichedMatches.length
          }
        });
      }

      addNotification({
        type: "success",
        title: "Matching Complete",
        message: `Found ${enrichedMatches.length} candidate matches in ${(processingTime / 1000).toFixed(1)}s`
      });

      if (onMatchComplete) {
        onMatchComplete(enrichedMatches);
      }
    } catch (error) {
      console.error("Error running advanced matching:", error);
      addNotification({
        type: "error",
        title: "Matching Failed",
        message: error.message || "Failed to analyze candidates"
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const submitFeedback = async (match, rating, action, feedbackText = "", criteriaAccuracy = {}) => {
    try {
      const feedback = {
        matching_profile_id: matchingProfile?.id || selectedProfileId,
        candidate_id: match.candidate.id,
        job_id: job.id,
        match_score: match.weighted_score,
        match_details: match,
        user_rating: rating,
        user_action: action,
        feedback_text: feedbackText,
        criteria_accuracy: criteriaAccuracy,
        ai_model_used: match.ai_model_used,
        processing_time_ms: match.processing_time_ms,
        was_helpful: rating >= 4
      };

      await MatchFeedback.create(feedback);

      // Update profile metrics if learning enabled
      if (matchingProfile?.learning_enabled) {
        const profile = matchingProfile || profiles.find(p => p.id === selectedProfileId);
        const newFeedbackCount = (profile.feedback_count || 0) + 1;
        const currentAvg = profile.avg_feedback_score || 0;
        const newAvg = ((currentAvg * (newFeedbackCount - 1)) + rating) / newFeedbackCount;

        const updates = {
          feedback_count: newFeedbackCount,
          avg_feedback_score: newAvg,
          performance_metrics: {
            ...profile.performance_metrics,
            accepted_matches: action === "hired" || action === "interviewed" || action === "contacted" 
              ? (profile.performance_metrics?.accepted_matches || 0) + 1
              : profile.performance_metrics?.accepted_matches,
            rejected_matches: action === "rejected" || action === "skipped"
              ? (profile.performance_metrics?.rejected_matches || 0) + 1
              : profile.performance_metrics?.rejected_matches
          }
        };

        await MatchingProfile.update(profile.id, updates);
      }

      addNotification({
        type: "success",
        title: "Feedback Submitted",
        message: "Thank you! This helps improve future matches."
      });

      setFeedbackMode(null);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      addNotification({
        type: "error",
        title: "Feedback Failed",
        message: "Could not save feedback"
      });
    }
  };

  const saveProfile = async (profileData) => {
    try {
      if (profileData.id) {
        await MatchingProfile.update(profileData.id, profileData);
        addNotification({ type: "success", title: "Profile Updated", message: "Matching profile updated successfully" });
      } else {
        const created = await MatchingProfile.create(profileData);
        setProfiles([created, ...profiles]);
        setSelectedProfileId(created.id);
        setMatchingProfile(created);
        addNotification({ type: "success", title: "Profile Created", message: "New matching profile created" });
      }
      setShowProfileEditor(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      addNotification({ type: "error", title: "Save Failed", message: "Could not save matching profile" });
    }
  };

  const getRecommendationColor = (rec) => {
    const colors = {
      strong_match: "bg-green-100 text-green-800 border-green-300",
      good_match: "bg-blue-100 text-blue-800 border-blue-300",
      potential_match: "bg-yellow-100 text-yellow-800 border-yellow-300",
      poor_match: "bg-red-100 text-red-800 border-red-300"
    };
    return colors[rec] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            Advanced AI Candidate Matching
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Matching Profile</label>
              <Select value={selectedProfileId || ""} onValueChange={setSelectedProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select profile..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.is_default && "(Default)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">AI Model</label>
              <Select 
                value={matchingProfile?.ai_model || "auto"} 
                onValueChange={(val) => setMatchingProfile({...matchingProfile, ai_model: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map(model => (
                    <SelectItem key={model.value} value={model.value}>
                      <div className="flex items-center gap-2">
                        <model.icon className="w-4 h-4" />
                        <div>
                          <div className="font-medium">{model.label}</div>
                          <div className="text-xs text-slate-500">{model.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Strategy</label>
              <Select 
                value={matchingProfile?.matching_strategy || "balanced"}
                onValueChange={(val) => setMatchingProfile({...matchingProfile, matching_strategy: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="strict">Strict (High bar)</SelectItem>
                  <SelectItem value="lenient">Lenient (Inclusive)</SelectItem>
                  <SelectItem value="learning">Learning (AI adapts)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={runAdvancedMatching} 
              disabled={analyzing || !candidates.length}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Run Advanced Matching
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setMatchingProfile(createDefaultProfile());
                setShowProfileEditor(true);
              }}
              className="gap-2"
            >
              <Settings className="w-4 h-4" />
              Configure Profile
            </Button>
          </div>

          {matchingProfile?.feedback_count > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <TrendingUp className="w-4 h-4" />
                <span className="font-medium">Learning Active:</span>
                <span>{matchingProfile.feedback_count} feedback entries • Avg rating: {matchingProfile.avg_feedback_score?.toFixed(1)}/5</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Matched Candidates */}
      {matchedCandidates.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Top Matches ({matchedCandidates.length})</h3>
            <div className="text-sm text-slate-600">
              Analyzed by: {matchedCandidates[0]?.ai_model_used || "AI"} • 
              Time: {((matchedCandidates[0]?.processing_time_ms || 0) / 1000).toFixed(1)}s
            </div>
          </div>

          {matchedCandidates.map((match, idx) => (
            <Card key={idx} className={`${
              match.recommendation === "strong_match" ? "border-2 border-green-500" : ""
            }`}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Candidate Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 text-white flex items-center justify-center text-xl font-bold">
                        {match.candidate.first_name?.[0]}{match.candidate.last_name?.[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Link
                            to={createPageUrl(`CandidateDetails?id=${match.candidate.id}`)}
                            className="text-lg font-bold text-blue-600 hover:underline"
                          >
                            {match.candidate.first_name} {match.candidate.last_name}
                          </Link>
                          <Badge className={getRecommendationColor(match.recommendation)}>
                            {match.recommendation.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-600 mt-1">
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3 h-3" />
                            {match.candidate.current_title}
                          </span>
                          {match.candidate.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {match.candidate.email}
                            </span>
                          )}
                          {match.candidate.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {match.candidate.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Match Score */}
                    <div className="text-right">
                      <div className="text-3xl font-bold text-purple-600">
                        {Math.round(match.weighted_score)}
                      </div>
                      <div className="text-xs text-slate-500">Match Score</div>
                    </div>
                  </div>

                  {/* Criteria Breakdown */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(match.criteria_scores || {}).map(([key, score]) => (
                      <div key={key} className="bg-slate-50 rounded-lg p-3">
                        <div className="text-xs text-slate-600 mb-1">
                          {key.replace(/_/g, " ")}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                score >= 80 ? "bg-green-500" :
                                score >= 60 ? "bg-blue-500" :
                                score >= 40 ? "bg-yellow-500" :
                                "bg-red-500"
                              }`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold">{Math.round(score)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Strengths & Concerns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                        <Award className="w-4 h-4" />
                        Strengths
                      </div>
                      <ul className="space-y-1">
                        {(match.strengths || []).map((s, i) => (
                          <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                            <span className="text-green-500">•</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-orange-700 mb-2 flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        Concerns
                      </div>
                      <ul className="space-y-1">
                        {(match.concerns || []).map((c, i) => (
                          <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                            <span className="text-orange-500">•</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Extracted Soft Skills */}
                  {match.extracted_soft_skills?.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-slate-700 mb-2">Soft Skills Identified:</div>
                      <div className="flex flex-wrap gap-2">
                        {match.extracted_soft_skills.map((skill, i) => (
                          <Badge key={i} variant="outline" className="bg-purple-50">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Reasoning */}
                  <Button
                    variant="ghost"
                    onClick={() => setExpandedCandidate(expandedCandidate === idx ? null : idx)}
                    className="w-full gap-2"
                  >
                    {expandedCandidate === idx ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {expandedCandidate === idx ? "Hide" : "Show"} AI Reasoning
                  </Button>

                  {expandedCandidate === idx && (
                    <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700">
                      {match.reasoning}
                    </div>
                  )}

                  {/* Feedback Actions */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => submitFeedback(match, 5, "contacted")}
                        className="gap-2"
                      >
                        <ThumbsUp className="w-4 h-4" />
                        Great Match
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => submitFeedback(match, 2, "skipped")}
                        className="gap-2"
                      >
                        <ThumbsDown className="w-4 h-4" />
                        Poor Match
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFeedbackMode(feedbackMode === idx ? null : idx)}
                        className="gap-2"
                      >
                        <Star className="w-4 h-4" />
                        Detailed Feedback
                      </Button>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <a href={`mailto:${match.candidate.email}`}>
                          <Mail className="w-4 h-4 mr-1" />
                          Email
                        </a>
                      </Button>
                      <Button size="sm" asChild>
                        <Link to={createPageUrl(`CandidateDetails?id=${match.candidate.id}`)}>
                          View Profile
                        </Link>
                      </Button>
                    </div>
                  </div>

                  {/* Detailed Feedback Form */}
                  {feedbackMode === idx && (
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4 space-y-3">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Rate this match (1-5 stars)</label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map(rating => (
                              <Button
                                key={rating}
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  submitFeedback(match, rating, "viewed", "", {});
                                }}
                              >
                                <Star className="w-4 h-4 fill-current" />
                                {rating}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}