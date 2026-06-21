import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Playbook } from "@/entities/Playbook";
import * as Core from "@/integrations/Core";
import { Sparkles, Loader2, BookOpen, ExternalLink, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ContextualSuggestions({ context, autoLoad = true }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (autoLoad && context) {
      loadSuggestions();
    }
  }, [autoLoad, context]);

  const loadSuggestions = async () => {
    if (!context) return;

    setLoading(true);
    try {
      const playbooks = await Playbook.filter({ is_active: true });

      const prompt = `You are an expert recruitment process advisor. Analyze the given context and suggest the most relevant playbooks.

**CONTEXT:**
${JSON.stringify(context, null, 2)}

**AVAILABLE PLAYBOOKS:**
${JSON.stringify(playbooks.map(p => ({
  id: p.id,
  title: p.title,
  description: p.description,
  category: p.category,
  subcategory: p.subcategory,
  tags: p.tags || [],
  applicable_to: p.applicable_to || {},
  steps: (p.steps || []).map(s => ({ title: s.title, description: s.description })),
  usage_count: p.usage_count || 0,
  effectiveness_rating: p.effectiveness_rating || 0
})), null, 2)}

**YOUR TASK:**
Based on the context provided, suggest 3-5 most relevant playbooks that would help the user:

1. **Context Analysis:**
   - If it's a Job: Consider the role type, seniority, industry, required skills
   - If it's a Candidate: Consider their experience level, skills, current status
   - If it's a general workflow: Consider the stage in recruitment process

2. **Relevance Scoring (0-100):**
   - How well does the playbook match the current context?
   - Consider applicability, usage history, effectiveness ratings

3. **Actionable Recommendations:**
   - Suggest specific sections or steps that are most relevant
   - Explain why this playbook is useful now
   - Provide next steps or actions the user should take

4. **Prioritization:**
   - Order by relevance and immediate usefulness
   - Top suggestion should be most actionable right now

**OUTPUT FORMAT:**
{
  "suggestions": [
    {
      "playbook_id": "id",
      "relevance_score": 95,
      "why_relevant": "This playbook covers technical screening which matches the job requirements",
      "recommended_sections": [
        "Section 1: Technical phone screen",
        "Step 3: Coding assessment"
      ],
      "next_actions": [
        "Review the screening questions",
        "Customize the coding test"
      ],
      "priority": "high"
    }
  ],
  "context_insights": {
    "identified_needs": ["Need screening process", "Technical role"],
    "workflow_stage": "early_screening",
    "recommended_flow": "Start with technical phone screen, then move to on-site"
  }
}

Return 3-5 suggestions, prioritized by relevance.`;

      const response = await Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  playbook_id: { type: "string" },
                  relevance_score: { type: "number" },
                  why_relevant: { type: "string" },
                  recommended_sections: { type: "array", items: { type: "string" } },
                  next_actions: { type: "array", items: { type: "string" } },
                  priority: { type: "string", enum: ["high", "medium", "low"] }
                },
                required: ["playbook_id", "relevance_score", "why_relevant"]
              }
            },
            context_insights: {
              type: "object",
              properties: {
                identified_needs: { type: "array", items: { type: "string" } },
                workflow_stage: { type: "string" },
                recommended_flow: { type: "string" }
              }
            }
          }
        }
      });

      const enrichedSuggestions = (response.suggestions || [])
        .map(s => {
          const pb = playbooks.find(p => p.id === s.playbook_id);
          return pb ? { ...pb, ...s } : null;
        })
        .filter(Boolean);

      setSuggestions(enrichedSuggestions);

    } catch (error) {
      console.error("Error loading suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    if (priority === "high") return "bg-red-100 text-red-800 border-red-300";
    if (priority === "medium") return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-blue-100 text-blue-800 border-blue-300";
  };

  const handlePlaybookClick = async (playbook) => {
    try {
      await Playbook.update(playbook.id, {
        usage_count: (playbook.usage_count || 0) + 1,
        last_used: new Date().toISOString()
      });
    } catch (error) {
      console.error("Failed to track usage:", error);
    }
  };

  if (!context) return null;

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Suggested Playbooks
          </CardTitle>
          {!autoLoad && (
            <Button
              size="sm"
              onClick={loadSuggestions}
              disabled={loading}
              variant="outline"
              className="gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Get Suggestions
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600 mr-2" />
            <span className="text-slate-600">Analyzing context and finding relevant playbooks...</span>
          </div>
        )}

        {!loading && suggestions.length === 0 && (
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 text-sm">
              No specific playbook suggestions for this context yet
            </p>
          </div>
        )}

        {!loading && suggestions.length > 0 && (
          <div className="space-y-4">
            {suggestions.map((playbook, index) => (
              <div
                key={playbook.id}
                className="p-4 bg-white rounded-lg border-2 hover:border-purple-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-purple-100 text-purple-800">
                        #{index + 1}
                      </Badge>
                      <Badge className={getPriorityColor(playbook.priority)}>
                        {playbook.priority} priority
                      </Badge>
                      <Badge className="bg-green-100 text-green-800">
                        {playbook.relevance_score}% relevant
                      </Badge>
                    </div>

                    <Link
                      to={createPageUrl(`PlaybookDetails?id=${playbook.id}`)}
                      className="font-semibold text-blue-600 hover:underline flex items-center gap-2"
                      onClick={() => handlePlaybookClick(playbook)}
                    >
                      <BookOpen className="w-4 h-4" />
                      {playbook.title}
                    </Link>

                    <p className="text-sm text-slate-700 mt-2">
                      <strong>Why this is relevant:</strong> {playbook.why_relevant}
                    </p>
                  </div>

                  <Link
                    to={createPageUrl(`PlaybookDetails?id=${playbook.id}`)}
                    className="text-blue-600 hover:text-blue-700"
                    onClick={() => handlePlaybookClick(playbook)}
                  >
                    <ExternalLink className="w-5 h-5" />
                  </Link>
                </div>

                {playbook.recommended_sections && playbook.recommended_sections.length > 0 && (
                  <div className="mb-3 p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-xs font-semibold text-blue-900 mb-2">📖 Focus on these sections:</p>
                    <ul className="space-y-1">
                      {playbook.recommended_sections.map((section, i) => (
                        <li key={i} className="text-xs text-blue-800">• {section}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {playbook.next_actions && playbook.next_actions.length > 0 && (
                  <div className="p-3 bg-green-50 rounded border border-green-200">
                    <p className="text-xs font-semibold text-green-900 mb-2">✅ Next actions:</p>
                    <ul className="space-y-1">
                      {playbook.next_actions.map((action, i) => (
                        <li key={i} className="text-xs text-green-800">• {action}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                  <Badge variant="secondary" className="text-xs capitalize">
                    {playbook.category}
                  </Badge>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {playbook.usage_count || 0} views
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}