import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, AlertCircle, CheckCircle, HelpCircle } from "lucide-react";
import MatchExplanationCard from "./MatchExplanationCard";

export default function CandidateMatchQueue({ matches, selectedMatches, onSelectionChange, loading }) {
  const [expandedId, setExpandedId] = useState(null);

  const handleSelect = (candidateId) => {
    const newSelected = new Set(selectedMatches);
    if (newSelected.has(candidateId)) {
      newSelected.delete(candidateId);
    } else {
      newSelected.add(candidateId);
    }
    onSelectionChange(newSelected);
  };

  const recommendationColor = (rec) => {
    switch (rec) {
      case "strong_submit":
        return "bg-green-100 text-green-800";
      case "maybe":
        return "bg-yellow-100 text-yellow-800";
      case "not_recommended":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const recommendationIcon = (rec) => {
    switch (rec) {
      case "strong_submit":
        return <CheckCircle className="w-4 h-4" />;
      case "maybe":
        return <HelpCircle className="w-4 h-4" />;
      case "not_recommended":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="text-center py-8">Matching candidates...</div>;
  }

  if (matches.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <p>No candidates matched yet. Click "Find Candidates" to search.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">
          Found {matches.length} candidate{matches.length !== 1 ? "s" : ""}
        </h3>
        <span className="text-sm text-muted-foreground">
          {selectedMatches.size} selected
        </span>
      </div>

      {matches.map((match) => (
        <Card key={match.candidate_id} className="overflow-hidden hover:shadow-md transition-shadow">
          <div
            className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setExpandedId(expandedId === match.candidate_id ? null : match.candidate_id)}
          >
            <div className="flex items-start gap-4">
              {/* Checkbox */}
              <Checkbox
                checked={selectedMatches.has(match.candidate_id)}
                onChange={() => handleSelect(match.candidate_id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
              />

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <div>
                    <h4 className="font-semibold text-foreground">{match.candidate_name}</h4>
                    <p className="text-sm text-muted-foreground">{match.candidate_title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={recommendationColor(match.recommendation)}>
                      {recommendationIcon(match.recommendation) && (
                        <span className="mr-1">{recommendationIcon(match.recommendation)}</span>
                      )}
                      {match.recommendation?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>

                {/* Score bar */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        match.score >= 80
                          ? "bg-green-500"
                          : match.score >= 60
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{ width: `${match.score}%` }}
                    />
                  </div>
                  <span className="font-semibold text-sm w-8">{match.score}%</span>
                </div>

                {/* Quick info */}
                <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                  {match.location && <span>📍 {match.location}</span>}
                  {match.experience && <span>💼 {match.experience} years</span>}
                  {match.availability && <span>⏰ {match.availability}</span>}
                </div>

                {/* Skills preview */}
                {match.matched_skills?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-green-700 mb-1">Matched skills:</p>
                    <div className="flex flex-wrap gap-1">
                      {match.matched_skills.slice(0, 3).map((skill, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {match.matched_skills.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{match.matched_skills.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Expand icon */}
              <ChevronDown
                className={`w-5 h-5 text-muted-foreground transition-transform ${
                  expandedId === match.candidate_id ? "rotate-180" : ""
                }`}
              />
            </div>
          </div>

          {/* Expanded explanation */}
          {expandedId === match.candidate_id && (
            <div className="border-t bg-muted/30 p-4">
              <MatchExplanationCard match={match} />
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}