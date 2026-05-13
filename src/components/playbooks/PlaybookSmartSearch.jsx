import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Playbook } from "@/entities/Playbook";
import * as Core from "@/integrations/Core";
import { Search, Loader2, BookOpen, Star, TrendingUp, Clock, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PlaybookSmartSearch({ context = null, onSelect = null }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setSearching(true);
    try {
      // Get all playbooks
      const playbooks = await Playbook.filter({ is_active: true });
      
      // Prepare context for AI search
      const searchContext = {
        query: query.trim(),
        context: context || {},
        playbooks: playbooks.map(p => ({
          id: p.id,
          title: p.title,
          description: p.description,
          category: p.category,
          subcategory: p.subcategory,
          tags: p.tags || [],
          keywords: p.keywords || [],
          applicable_to: p.applicable_to || {},
          steps: (p.steps || []).map(s => s.title),
          usage_count: p.usage_count || 0,
          effectiveness_rating: p.effectiveness_rating || 0
        }))
      };

      const prompt = `You are an expert knowledge base search assistant for recruitment operations.

**SEARCH QUERY:** "${query}"

**CONTEXT (if provided):**
${JSON.stringify(context, null, 2)}

**AVAILABLE PLAYBOOKS:**
${JSON.stringify(searchContext.playbooks, null, 2)}

**YOUR TASK:**
Analyze the search query and context, then:

1. **Semantic Matching:**
   - Find playbooks that match the query semantically (not just keyword matching)
   - Consider synonyms and related concepts
   - Match based on intent, not just exact words

2. **Context-Aware Ranking:**
   - If context is provided (job type, industry, candidate stage), prioritize relevant playbooks
   - Consider effectiveness ratings and usage counts as quality signals
   - Factor in applicability based on job_types, industries, experience_levels

3. **Relevance Scoring (0-100):**
   - 90-100: Perfect match, directly answers the query
   - 70-89: Strong match, highly relevant
   - 50-69: Good match, somewhat relevant
   - Below 50: Don't include

4. **Explain Relevance:**
   - Provide a brief explanation of why each playbook matches
   - Highlight specific aspects that are relevant

**OUTPUT FORMAT:**
{
  "results": [
    {
      "playbook_id": "id",
      "relevance_score": 95,
      "match_reason": "Direct match for candidate screening process",
      "key_highlights": ["Step-by-step guide", "Interview templates", "Scoring rubrics"],
      "suggested_sections": ["Steps 2-5 cover phone screening", "FAQ #3 addresses this"]
    }
  ],
  "search_insights": {
    "query_intent": "User wants guidance on...",
    "related_topics": ["topic1", "topic2"],
    "suggested_refinements": ["Try searching for...", "Related: ..."]
  }
}

Return only playbooks with relevance_score >= 50, sorted by score descending.`;

      const response = await Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  playbook_id: { type: "string" },
                  relevance_score: { type: "number" },
                  match_reason: { type: "string" },
                  key_highlights: { type: "array", items: { type: "string" } },
                  suggested_sections: { type: "array", items: { type: "string" } }
                },
                required: ["playbook_id", "relevance_score", "match_reason"]
              }
            },
            search_insights: {
              type: "object",
              properties: {
                query_intent: { type: "string" },
                related_topics: { type: "array", items: { type: "string" } },
                suggested_refinements: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      });

      // Map results back to full playbook objects
      const rankedResults = (response.results || [])
        .map(r => {
          const pb = playbooks.find(p => p.id === r.playbook_id);
          return pb ? { ...pb, ...r } : null;
        })
        .filter(Boolean);

      setResults(rankedResults);
      setSuggestions(response.search_insights || {});

    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };

  const getRelevanceColor = (score) => {
    if (score >= 90) return "text-green-600 bg-green-50";
    if (score >= 70) return "text-blue-600 bg-blue-50";
    if (score >= 50) return "text-orange-600 bg-orange-50";
    return "text-slate-600 bg-slate-50";
  };

  const handlePlaybookClick = async (playbook) => {
    // Track usage
    try {
      await Playbook.update(playbook.id, {
        usage_count: (playbook.usage_count || 0) + 1,
        last_used: new Date().toISOString()
      });
    } catch (error) {
      console.error("Failed to track usage:", error);
    }

    if (onSelect) {
      onSelect(playbook);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search playbooks... (e.g., 'how to screen technical candidates')"
                className="pl-10"
              />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={searching || !query.trim()}
              className="gap-2"
            >
              {searching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Search
                </>
              )}
            </Button>
          </div>

          {suggestions.query_intent && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>Understanding your query:</strong> {suggestions.query_intent}
              </p>
            </div>
          )}

          {suggestions.related_topics && suggestions.related_topics.length > 0 && (
            <div className="mt-3">
              <p className="text-sm text-slate-600 mb-2">Related topics:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.related_topics.map((topic, i) => (
                  <Badge key={i} variant="outline" className="text-xs cursor-pointer hover:bg-slate-100" onClick={() => setQuery(topic)}>
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Search Results ({results.length})</h3>
            <p className="text-sm text-slate-600">Sorted by relevance</p>
          </div>

          {results.map((playbook) => (
            <Card key={playbook.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handlePlaybookClick(playbook)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      <Link
                        to={createPageUrl(`PlaybookDetails?id=${playbook.id}`)}
                        className="font-semibold text-lg text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {playbook.title}
                      </Link>
                      <Badge className={getRelevanceColor(playbook.relevance_score)}>
                        {playbook.relevance_score}% Match
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-slate-700 mb-2">{playbook.match_reason}</p>
                    
                    {playbook.description && (
                      <p className="text-sm text-slate-600 mb-3">{playbook.description}</p>
                    )}

                    {playbook.key_highlights && playbook.key_highlights.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-slate-700 mb-1">Key Highlights:</p>
                        <ul className="space-y-1">
                          {playbook.key_highlights.map((highlight, i) => (
                            <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                              <span className="text-green-600">✓</span>
                              <span>{highlight}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {playbook.suggested_sections && playbook.suggested_sections.length > 0 && (
                      <div className="mb-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                        <p className="text-xs font-semibold text-yellow-900 mb-1">💡 Suggested Sections:</p>
                        <ul className="space-y-1">
                          {playbook.suggested_sections.map((section, i) => (
                            <li key={i} className="text-xs text-yellow-800">{section}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {playbook.usage_count || 0} views
                      </span>
                      {playbook.effectiveness_rating && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          {playbook.effectiveness_rating.toFixed(1)}
                        </span>
                      )}
                      {playbook.last_used && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last used {new Date(playbook.last_used).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    to={createPageUrl(`PlaybookDetails?id=${playbook.id}`)}
                    className="text-blue-600 hover:text-blue-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-5 h-5" />
                  </Link>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="text-xs capitalize">
                    {playbook.category}
                  </Badge>
                  {playbook.tags && playbook.tags.slice(0, 5).map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {suggestions.suggested_refinements && suggestions.suggested_refinements.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">💡 Suggestions to refine your search:</p>
            <ul className="space-y-1">
              {suggestions.suggested_refinements.map((suggestion, i) => (
                <li key={i} className="text-sm text-blue-600 hover:underline cursor-pointer" onClick={() => setQuery(suggestion)}>
                  {suggestion}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {!searching && results.length === 0 && query && (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">No playbooks found</h3>
            <p className="text-slate-600 text-sm">
              Try refining your search or browsing by category
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}