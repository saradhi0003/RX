import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Loader2, 
  Plus, 
  Save,
  Sparkles,
  CheckCircle2,
  Star,
  FileText,
  TrendingUp,
  BookOpen,
  Calculator
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InvokeLLM } from "@/integrations/Core";
import { InterviewSession } from "@/entities/InterviewSession";
import { addNotification } from "@/components/notifications/NotificationToast";
import { Slider } from "@/components/ui/slider";

export default function InterviewAssistant({ candidate, job, application }) {
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [session, setSession] = useState(null);
  const [interviewType, setInterviewType] = useState("phone_screen");
  const [interviewDate, setInterviewDate] = useState("");
  const [interviewer, setInterviewer] = useState("");
  const [questions, setQuestions] = useState([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [calculatedScore, setCalculatedScore] = useState(null);
  const [showQuestionLibrary, setShowQuestionLibrary] = useState(false);

  // Question Library - Common interview questions by category
  const questionLibrary = {
    technical: [
      { question: "Describe your experience with [specific technology/tool].", category: "technical", assessing: "Technical expertise" },
      { question: "How would you approach solving [specific technical problem]?", category: "technical", assessing: "Problem-solving ability" },
      { question: "Walk me through a challenging technical project you've worked on.", category: "technical", assessing: "Technical depth and complexity" },
      { question: "How do you stay updated with the latest technologies in your field?", category: "technical", assessing: "Learning mindset" },
      { question: "Explain [technical concept] to someone non-technical.", category: "technical", assessing: "Communication of technical concepts" }
    ],
    behavioral: [
      { question: "Tell me about a time you faced a significant challenge at work. How did you handle it?", category: "behavioral", assessing: "Resilience and problem-solving" },
      { question: "Describe a situation where you had to work with a difficult team member.", category: "behavioral", assessing: "Collaboration and conflict resolution" },
      { question: "Give an example of when you went above and beyond your job responsibilities.", category: "behavioral", assessing: "Initiative and ownership" },
      { question: "Tell me about a time you failed. What did you learn?", category: "behavioral", assessing: "Self-awareness and growth mindset" },
      { question: "Describe a situation where you had to meet a tight deadline.", category: "behavioral", assessing: "Time management and pressure handling" }
    ],
    situational: [
      { question: "How would you handle a situation where you disagree with your manager's approach?", category: "situational", assessing: "Communication and conflict management" },
      { question: "If you had multiple high-priority tasks, how would you prioritize them?", category: "situational", assessing: "Prioritization and decision-making" },
      { question: "What would you do if you discovered a critical bug right before a release?", category: "situational", assessing: "Critical thinking and judgment" },
      { question: "How would you approach learning a new technology required for a project?", category: "situational", assessing: "Adaptability and learning agility" },
      { question: "If a team member wasn't pulling their weight, what would you do?", category: "situational", assessing: "Team dynamics and leadership" }
    ],
    culture_fit: [
      { question: "What type of work environment do you thrive in?", category: "culture_fit", assessing: "Cultural alignment" },
      { question: "How do you prefer to receive feedback?", category: "culture_fit", assessing: "Openness to feedback" },
      { question: "What motivates you in your work?", category: "culture_fit", assessing: "Intrinsic motivation" },
      { question: "Describe your ideal team dynamic.", category: "culture_fit", assessing: "Team fit" },
      { question: "Where do you see yourself in 3-5 years?", category: "culture_fit", assessing: "Career goals alignment" }
    ]
  };

  useEffect(() => {
    // Auto-calculate score when questions are updated
    if (questions.length > 0) {
      calculateOverallScore();
    }
  }, [questions]);

  const calculateOverallScore = () => {
    const answeredQuestions = questions.filter(q => q.answer && q.answer.trim());
    if (answeredQuestions.length === 0) {
      setCalculatedScore(null);
      return;
    }

    // Calculate average score from 1-5 scale
    const avgScore = answeredQuestions.reduce((sum, q) => sum + q.score, 0) / answeredQuestions.length;
    
    // Convert to 0-100 scale
    const normalizedScore = ((avgScore - 1) / 4) * 100;
    
    // Calculate completion rate
    const completionRate = (answeredQuestions.length / questions.length) * 100;
    
    // Calculate category breakdown
    const categoryScores = {};
    answeredQuestions.forEach(q => {
      if (!categoryScores[q.category]) {
        categoryScores[q.category] = { total: 0, count: 0 };
      }
      categoryScores[q.category].total += q.score;
      categoryScores[q.category].count += 1;
    });

    const categoryAverages = {};
    Object.keys(categoryScores).forEach(cat => {
      categoryAverages[cat] = categoryScores[cat].total / categoryScores[cat].count;
    });

    setCalculatedScore({
      overall: Math.round(normalizedScore),
      avgRating: avgScore.toFixed(1),
      completion: Math.round(completionRate),
      categoryBreakdown: categoryAverages,
      answeredCount: answeredQuestions.length,
      totalCount: questions.length
    });
  };

  const addQuestionsFromLibrary = (category) => {
    const libraryQuestions = questionLibrary[category] || [];
    const newQuestions = libraryQuestions.map(q => ({
      ...q,
      good_answer_indicators: [],
      answer: "",
      score: 3,
      notes: ""
    }));
    setQuestions([...questions, ...newQuestions]);
    setShowQuestionLibrary(false);
    addNotification({ type: "success", title: "Added", message: `Added ${newQuestions.length} ${category} questions` });
  };

  const generateInterviewQuestions = async () => {
    if (!candidate || !job) {
      addNotification({ type: "error", title: "Error", message: "Candidate and job information required" });
      return;
    }

    setGeneratingQuestions(true);
    try {
      const candidateProfile = {
        name: `${candidate.first_name} ${candidate.last_name}`,
        current_title: candidate.current_title || "",
        experience_years: candidate.experience_years || 0,
        skills: candidate.skills || [],
        background: candidate.notes || ""
      };

      const jobInfo = {
        title: job.title,
        description: job.description || "",
        requirements: job.requirements || "",
        required_skills: job.required_skills || [],
        experience_required: job.experience_required || 0
      };

      const response = await InvokeLLM({
        prompt: `You are an expert technical recruiter and interviewer. Generate tailored interview questions for the following candidate and position:

**Candidate Profile:**
${JSON.stringify(candidateProfile, null, 2)}

**Job Position:**
${JSON.stringify(jobInfo, null, 2)}

**Interview Type:** ${interviewType.replace(/_/g, ' ')}

Generate 8-12 interview questions that:
1. Are tailored to the candidate's experience level
2. Assess key skills required for the role
3. Mix behavioral, technical, and situational questions
4. Progress from easier to more challenging
5. Include follow-up probes where appropriate

For each question, provide:
- The question itself
- Category (technical, behavioral, situational, culture_fit)
- What you're assessing (the competency or skill)
- Good answer indicators

Be thorough and professional.`,
        response_json_schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  category: { type: "string", enum: ["technical", "behavioral", "situational", "culture_fit", "experience"] },
                  assessing: { type: "string" },
                  good_answer_indicators: { type: "array", items: { type: "string" } }
                },
                required: ["question", "category", "assessing"]
              }
            }
          },
          required: ["questions"]
        }
      });

      const formattedQuestions = response.questions.map(q => ({
        question: q.question,
        category: q.category,
        assessing: q.assessing,
        good_answer_indicators: q.good_answer_indicators || [],
        answer: "",
        score: 3,
        notes: ""
      }));

      setQuestions(formattedQuestions);
      addNotification({ type: "success", title: "Success", message: `Generated ${formattedQuestions.length} interview questions` });
    } catch (error) {
      console.error("Error generating questions:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to generate interview questions" });
    }
    setGeneratingQuestions(false);
  };

  const updateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const addCustomQuestion = () => {
    setQuestions([...questions, {
      question: "",
      category: "custom",
      assessing: "",
      good_answer_indicators: [],
      answer: "",
      score: 3,
      notes: ""
    }]);
  };

  const generateAISummary = async () => {
    if (questions.length === 0) {
      addNotification({ type: "error", title: "Error", message: "No interview questions to summarize" });
      return;
    }

    setGeneratingSummary(true);
    try {
      const interviewData = {
        candidate: `${candidate.first_name} ${candidate.last_name}`,
        position: job.title,
        interview_type: interviewType,
        calculated_score: calculatedScore,
        questions_and_responses: questions.map(q => ({
          question: q.question,
          category: q.category,
          answer: q.answer || "Not answered",
          score: q.score,
          notes: q.notes || ""
        })),
        general_notes: notes
      };

      const response = await InvokeLLM({
        prompt: `You are an expert hiring manager. Analyze this interview session and provide a comprehensive summary:

**Interview Data:**
${JSON.stringify(interviewData, null, 2)}

Provide a thorough analysis including:
1. Overall interview performance assessment
2. Key strengths demonstrated
3. Areas of concern or weakness
4. Technical competency assessment
5. Cultural fit assessment
6. Hiring recommendation (strong_hire, hire, maybe, no_hire)
7. Detailed summary paragraph
8. Suggested next steps

Be honest, thorough, and constructive. The calculated score is ${calculatedScore?.overall || 0}/100.`,
        response_json_schema: {
          type: "object",
          properties: {
            strengths: { type: "array", items: { type: "string" } },
            concerns: { type: "array", items: { type: "string" } },
            technical_assessment: { type: "string" },
            cultural_fit: { type: "string" },
            recommendation: { type: "string", enum: ["strong_hire", "hire", "maybe", "no_hire"] },
            summary: { type: "string" },
            next_steps: { type: "string" }
          },
          required: ["recommendation", "summary"]
        }
      });

      setSession({
        ...session,
        ai_summary: response.summary,
        ai_analysis: response,
        overall_score: calculatedScore?.overall || 0,
        strengths: response.strengths || [],
        concerns: response.concerns || [],
        recommendation: response.recommendation,
        next_steps: response.next_steps || ""
      });

      addNotification({ type: "success", title: "Success", message: "Interview summary generated" });
    } catch (error) {
      console.error("Error generating summary:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to generate summary" });
    }
    setGeneratingSummary(false);
  };

  const saveInterviewSession = async () => {
    if (!candidate?.id || !job?.id) {
      addNotification({ type: "error", title: "Error", message: "Candidate and job required" });
      return;
    }

    if (!interviewDate) {
      addNotification({ type: "error", title: "Error", message: "Interview date required" });
      return;
    }

    setSaving(true);
    try {
      const sessionData = {
        candidate_id: candidate.id,
        job_id: job.id,
        application_id: application?.id || null,
        interview_date: interviewDate,
        interview_type: interviewType,
        interviewer: interviewer || "Not specified",
        status: "completed",
        questions,
        notes,
        ...session
      };

      if (session?.id) {
        await InterviewSession.update(session.id, sessionData);
        addNotification({ type: "success", title: "Updated", message: "Interview session updated" });
      } else {
        const created = await InterviewSession.create(sessionData);
        setSession(created);
        addNotification({ type: "success", title: "Saved", message: "Interview session saved" });
      }
    } catch (error) {
      console.error("Error saving interview:", error);
      addNotification({ type: "error", title: "Error", message: "Failed to save interview session" });
    }
    setSaving(false);
  };

  const getCategoryColor = (category) => {
    const colors = {
      technical: "bg-blue-100 text-blue-800",
      behavioral: "bg-purple-100 text-purple-800",
      situational: "bg-green-100 text-green-800",
      culture_fit: "bg-pink-100 text-pink-800",
      experience: "bg-yellow-100 text-yellow-800",
      custom: "bg-gray-100 text-gray-800"
    };
    return colors[category] || colors.custom;
  };

  const getRecommendationBadge = (rec) => {
    const colors = {
      strong_hire: "bg-green-100 text-green-800",
      hire: "bg-blue-100 text-blue-800",
      maybe: "bg-yellow-100 text-yellow-800",
      no_hire: "bg-red-100 text-red-800"
    };
    return colors[rec] || colors.maybe;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Interview Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Interview Type</label>
              <Select value={interviewType} onValueChange={setInterviewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone_screen">Phone Screen</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="behavioral">Behavioral</SelectItem>
                  <SelectItem value="culture_fit">Culture Fit</SelectItem>
                  <SelectItem value="panel">Panel Interview</SelectItem>
                  <SelectItem value="final">Final Round</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Interview Date</label>
              <Input 
                type="datetime-local"
                value={interviewDate} 
                onChange={(e) => setInterviewDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Interviewer</label>
              <Input 
                value={interviewer} 
                onChange={(e) => setInterviewer(e.target.value)}
                placeholder="Your name/email"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={generateInterviewQuestions} 
              disabled={generatingQuestions}
              className="flex-1 gap-2"
            >
              {generatingQuestions ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate AI Questions
                </>
              )}
            </Button>

            <Button 
              variant="outline"
              onClick={() => setShowQuestionLibrary(!showQuestionLibrary)}
              className="gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Question Library
            </Button>
          </div>

          {showQuestionLibrary && (
            <div className="p-4 border rounded-lg bg-slate-50 space-y-2">
              <p className="text-sm font-medium mb-2">Add questions from library:</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(questionLibrary).map(category => (
                  <Button 
                    key={category}
                    size="sm"
                    variant="outline"
                    onClick={() => addQuestionsFromLibrary(category)}
                  >
                    {category.replace(/_/g, ' ')} ({questionLibrary[category].length})
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Score Calculator */}
      {calculatedScore && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="w-5 h-5" />
              Live Interview Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold text-blue-700">{calculatedScore.overall}</div>
                <div className="text-xs text-slate-600">Overall Score</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-700">{calculatedScore.avgRating}/5</div>
                <div className="text-xs text-slate-600">Avg Rating</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-700">{calculatedScore.completion}%</div>
                <div className="text-xs text-slate-600">Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-700">{calculatedScore.answeredCount}/{calculatedScore.totalCount}</div>
                <div className="text-xs text-slate-600">Questions</div>
              </div>
            </div>
            
            {Object.keys(calculatedScore.categoryBreakdown).length > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs font-medium mb-2">Category Breakdown:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(calculatedScore.categoryBreakdown).map(([cat, score]) => (
                    <Badge key={cat} variant="outline" className="text-xs">
                      {cat}: {score.toFixed(1)}/5
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Interview Questions */}
      {questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Interview Questions ({questions.length})</span>
              <Button variant="outline" size="sm" onClick={addCustomQuestion}>
                <Plus className="w-4 h-4 mr-1" />
                Add Question
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {questions.map((q, idx) => (
              <div key={idx} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getCategoryColor(q.category)}>
                        {q.category.replace(/_/g, ' ')}
                      </Badge>
                      {q.assessing && (
                        <span className="text-xs text-slate-500">Assessing: {q.assessing}</span>
                      )}
                    </div>
                    {q.question ? (
                      <p className="font-medium text-slate-900">{q.question}</p>
                    ) : (
                      <Input 
                        placeholder="Enter custom question"
                        value={q.question}
                        onChange={(e) => updateQuestion(idx, 'question', e.target.value)}
                      />
                    )}
                  </div>
                </div>

                {q.good_answer_indicators && q.good_answer_indicators.length > 0 && (
                  <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                    <strong>Look for:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {q.good_answer_indicators.map((indicator, i) => (
                        <li key={i}>{indicator}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Textarea 
                  placeholder="Candidate's answer..."
                  value={q.answer}
                  onChange={(e) => updateQuestion(idx, 'answer', e.target.value)}
                  rows={3}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Score (1-5)</label>
                    <div className="flex items-center gap-3">
                      <Slider 
                        value={[q.score]}
                        onValueChange={(val) => updateQuestion(idx, 'score', val[0])}
                        min={1}
                        max={5}
                        step={1}
                        className="flex-1"
                      />
                      <div className="w-8 text-center">
                        <Badge variant="outline">{q.score}</Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium mb-1 block">Notes</label>
                    <Input 
                      placeholder="Quick notes..."
                      value={q.notes}
                      onChange={(e) => updateQuestion(idx, 'notes', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* General Notes */}
      {questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>General Interview Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea 
              placeholder="Overall impressions, soft skills observations, cultural fit notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
            />
          </CardContent>
        </Card>
      )}

      {/* AI Analysis & Summary */}
      {questions.length > 0 && (
        <div className="flex gap-3">
          <Button 
            onClick={generateAISummary} 
            disabled={generatingSummary}
            className="flex-1 gap-2"
            variant="outline"
          >
            {generatingSummary ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating Summary...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Generate AI Summary
              </>
            )}
          </Button>

          <Button 
            onClick={saveInterviewSession} 
            disabled={saving}
            className="flex-1 gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Interview
              </>
            )}
          </Button>
        </div>
      )}

      {/* AI Analysis Results */}
      {session?.ai_analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              AI Interview Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <div className="text-3xl font-bold text-slate-900">
                  {session.overall_score}
                </div>
                <div className="text-sm text-slate-600">Final Score</div>
              </div>
              <Badge className={getRecommendationBadge(session.ai_analysis.recommendation)}>
                {session.ai_analysis.recommendation.replace(/_/g, ' ').toUpperCase()}
              </Badge>
            </div>

            <div>
              <h4 className="font-medium mb-2">Summary</h4>
              <p className="text-sm text-slate-700">{session.ai_analysis.summary}</p>
            </div>

            {session.ai_analysis.strengths && session.ai_analysis.strengths.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-green-700">Key Strengths</h4>
                <ul className="space-y-1">
                  {session.ai_analysis.strengths.map((strength, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {session.ai_analysis.concerns && session.ai_analysis.concerns.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-red-700">Areas of Concern</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                  {session.ai_analysis.concerns.map((concern, idx) => (
                    <li key={idx}>{concern}</li>
                  ))}
                </ul>
              </div>
            )}

            {session.ai_analysis.technical_assessment && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <h4 className="font-medium mb-1 text-sm">Technical Assessment</h4>
                <p className="text-sm text-slate-700">{session.ai_analysis.technical_assessment}</p>
              </div>
            )}

            {session.ai_analysis.cultural_fit && (
              <div className="p-3 bg-purple-50 rounded-lg">
                <h4 className="font-medium mb-1 text-sm">Cultural Fit</h4>
                <p className="text-sm text-slate-700">{session.ai_analysis.cultural_fit}</p>
              </div>
            )}

            {session.ai_analysis.next_steps && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-medium mb-1 text-sm text-green-800">Recommended Next Steps</h4>
                <p className="text-sm text-slate-700">{session.ai_analysis.next_steps}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}