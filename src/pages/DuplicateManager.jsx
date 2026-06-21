
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Candidate } from "@/entities/Candidate";
import * as Core from "@/integrations/Core";
import {
  Loader2,
  AlertTriangle,
  CheckCircle,
  Users,
  Sparkles,
  Merge,
  Trash2,
  Eye,
  RefreshCcw,
  Mail,
  Phone,
  Briefcase,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "@/components/common/PageHeader";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import { addNotification } from "@/components/notifications/NotificationToast";

export default function DuplicateManager() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [merging, setMerging] = useState(false);

  const [matchCriteria, setMatchCriteria] = useState({
    email: true,
    phone: true,
    name: true,
    current_title: false
  });

  useEffect(() => {
    loadCandidates();
  }, []);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const data = await Candidate.list("-created_date", 1000);
      setCandidates(data || []);
    } catch (error) {
      console.error("Error loading candidates:", error);
      addNotification({
        type: "error",
        title: "Error",
        message: "Failed to load candidates"
      });
    }
    setLoading(false);
  };

  const normalizePhone = (phone) => {
    if (!phone) return "";
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, "");
    // Return last 10 digits (US format)
    return digits.slice(-10);
  };

  const normalizeEmail = (email) => {
    if (!email) return "";
    return email.toLowerCase().trim();
  };

  const normalizeName = (name) => {
    if (!name) return "";
    return name.toLowerCase().trim()
      .replace(/[^a-z0-9\s]/g, "") // Remove special characters
      .replace(/\s+/g, " "); // Normalize spaces
  };

  const findDuplicatesWithAI = async () => {
    if (candidates.length === 0) {
      alert("No candidates to analyze");
      return;
    }

    setAnalyzing(true);
    setDuplicateGroups([]);
    setSelectedGroups(new Set());

    try {
      // Prepare candidate data for AI with enhanced normalization
      const candidateContext = candidates.map(c => ({
        id: c.id,
        first_name: c.first_name || "",
        last_name: c.last_name || "",
        full_name: `${c.first_name || ""} ${c.last_name || ""}`.trim(),
        normalized_name: normalizeName(`${c.first_name || ""} ${c.last_name || ""}`),
        email: normalizeEmail(c.email || ""),
        email_username: (c.email || "").split("@")[0]?.toLowerCase() || "",
        email_domain: (c.email || "").split("@")[1]?.toLowerCase() || "",
        phone: c.phone || "",
        normalized_phone: normalizePhone(c.phone || ""),
        current_title: (c.current_title || "").toLowerCase().trim(),
        current_company: (c.current_company || "").toLowerCase().trim(),
        location: (c.location || "").toLowerCase().trim(),
        created_date: c.created_date,
        resume_url: c.resume_url || ""
      }));

      const prompt = `You are an expert data quality analyst specializing in duplicate detection and data deduplication for a recruitment platform.

**YOUR TASK:**
Analyze the following ${candidateContext.length} candidate records and identify duplicate entries using sophisticated multi-field matching logic.

**MATCHING CRITERIA (user preferences):**
- Email matching: ${matchCriteria.email ? "ENABLED ✓" : "DISABLED ✗"}
- Phone matching: ${matchCriteria.phone ? "ENABLED ✓" : "DISABLED ✗"}
- Name matching: ${matchCriteria.name ? "ENABLED ✓" : "DISABLED ✗"}
- Current title matching: ${matchCriteria.current_title ? "ENABLED ✓" : "DISABLED ✗"}

**CANDIDATES DATA:**
${JSON.stringify(candidateContext.slice(0, 500), null, 2)}

**ENHANCED DUPLICATE DETECTION RULES:**

**1. EXACT MATCHES (100% confidence) - AUTOMATIC DUPLICATES:**
- ✓ Identical email address (when non-empty)
- ✓ Identical normalized phone (last 10 digits match)
- ✓ Same full name + same email domain
- ✓ Same email_username + very similar full name (1-2 char diff)

**2. HIGH CONFIDENCE (90-99%) - VERY LIKELY DUPLICATES:**
- ✓ Same normalized_phone + similar names (Levenshtein distance ≤ 3)
- ✓ Same full name + same current_company
- ✓ Same last name + first initial + same email_domain
- ✓ Similar names (typos, case differences) + same phone
- ✓ Same full name + same location + similar job titles
- ✓ Same email_domain + very similar names + same company

**3. MEDIUM CONFIDENCE (70-89%) - LIKELY DUPLICATES:**
- ✓ Very similar full names (edit distance ≤ 4) + same company
- ✓ Same last name + different first name + same phone
- ✓ Same first name + same last initial + same company
- ✓ Similar names + same location + same title
- ✓ Same phone + very similar names (possible data entry error)

**4. LOW CONFIDENCE (50-69%) - POSSIBLE DUPLICATES (review manually):**
- ✓ Similar names + similar titles + same city
- ✓ Same company + same title + moderately similar names
- ✓ Same location + very similar names + similar experience

**SMART NORMALIZATION & MATCHING:**
- **Phone:** Compare last 10 digits only (ignore formatting, country codes)
- **Email:** Case-insensitive, trim whitespace
- **Names:** 
  - Ignore case, special chars (O'Brien = obrien)
  - Handle nicknames: Bob=Robert, Mike=Michael, Bill=William, etc.
  - Fuzzy match: Levenshtein/edit distance for typos
  - Handle maiden names, middle names, suffixes (Jr., Sr., III)
- **Titles:** Normalize abbreviations (Sr. = Senior, Jr. = Junior)
- **Company:** Handle Inc, LLC, Corp variations

**ANTI-PATTERNS (NOT duplicates unless other fields match):**
- Same name but completely different email domains → different people
- Same email domain but significantly different names (≥5 chars) → different people  
- Same phone area code but different last 7 digits → different people
- Same last name only with no other matches → common surname

**EDGE CASES TO HANDLE:**
- Empty/null values: Do not match on empty fields
- Recently created duplicates: Flag if created within 24 hours of each other
- Resume URL: If same resume file URL → very strong duplicate signal

**PRIMARY RECORD SELECTION:**
- Choose oldest record (earliest created_date) as primary
- Prefer record with most complete data (more non-null fields)
- If tie: prefer record with resume_url

**OUTPUT FORMAT:**
Return JSON with duplicate groups, each containing:
- All candidate IDs in the duplicate cluster
- Confidence score (0-100)
- Which fields matched (matching_fields array)
- Primary candidate ID (to keep)
- Human-readable explanation
- Data conflicts between records

IMPORTANT: Only group candidates that are actually duplicates based on enabled criteria. Don't force groupings.

Example output structure:
{
  "duplicate_groups": [
    {
      "group_id": "dup_1",
      "candidate_ids": ["abc123", "xyz789", "def456"],
      "confidence": 98,
      "matching_fields": ["email", "phone", "name"],
      "primary_candidate_id": "abc123",
      "explanation": "All three records share the exact same email (john@example.com) and normalized phone number (5551234567). Names are 'John Smith', 'John Smith', and 'Jon Smith' (typo). Oldest record selected as primary.",
      "merge_strategy": "keep_primary",
      "conflicts": {
        "current_title": ["Senior Engineer", "Staff Engineer", "Sr. Engineer"],
        "location": ["New York, NY", "NYC", "New York"]
      },
      "data_quality_notes": "Record xyz789 has most complete profile data"
    }
  ],
  "summary": {
    "total_candidates_analyzed": ${candidateContext.length},
    "duplicate_groups_found": 0,
    "total_duplicate_records": 0,
    "high_confidence_groups": 0,
    "medium_confidence_groups": 0,
    "low_confidence_groups": 0,
    "potential_savings": "0 duplicate records can be safely merged"
  }
}`;

      const response = await Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            duplicate_groups: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  group_id: { type: "string" },
                  candidate_ids: { type: "array", items: { type: "string" } },
                  confidence: { type: "number" },
                  matching_fields: { type: "array", items: { type: "string" } },
                  primary_candidate_id: { type: "string" },
                  explanation: { type: "string" },
                  merge_strategy: { type: "string" },
                  conflicts: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } },
                  data_quality_notes: { type: "string" }
                }
              }
            },
            summary: {
              type: "object",
              properties: {
                total_candidates_analyzed: { type: "number" },
                duplicate_groups_found: { type: "number" },
                total_duplicate_records: { type: "number" },
                high_confidence_groups: { type: "number" },
                medium_confidence_groups: { type: "number" },
                low_confidence_groups: { type: "number" },
                potential_savings: { type: "string" }
              }
            }
          }
        }
      });

      // Enrich groups with full candidate data
      const enrichedGroups = response.duplicate_groups.map(group => {
        const candidatesInGroup = group.candidate_ids
          .map(id => candidates.find(c => c.id === id))
          .filter(Boolean);

        return {
          ...group,
          candidates: candidatesInGroup,
          primary: candidates.find(c => c.id === group.primary_candidate_id)
        };
      });

      setDuplicateGroups(enrichedGroups);

      if (enrichedGroups.length > 0) {
        addNotification({
          type: "warning",
          title: "Duplicates Found",
          message: `Found ${response.duplicate_groups.length} duplicate group(s) affecting ${response.summary.total_duplicate_records} record(s)`
        });
      } else {
        addNotification({
          type: "success",
          title: "Clean Data",
          message: "No duplicates found! Your candidate database is clean."
        });
      }

    } catch (error) {
      console.error("Error finding duplicates:", error);
      addNotification({
        type: "error",
        title: "Analysis Failed",
        message: error.message || "Failed to analyze duplicates. Please try again."
      });
    }

    setAnalyzing(false);
  };

  const toggleGroupSelection = (groupId) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleGroupExpansion = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const mergeSelectedGroups = async () => {
    if (selectedGroups.size === 0) {
      addNotification({
        type: "warning",
        title: "No Selection",
        message: "Please select at least one duplicate group to merge"
      });
      return;
    }

    const totalDuplicates = Array.from(selectedGroups)
      .map(groupId => {
        const group = duplicateGroups.find(g => g.group_id === groupId);
        return group ? group.candidates.length - 1 : 0;
      })
      .reduce((sum, count) => sum + count, 0);

    const confirmed = window.confirm(
      `⚠️ MERGE CONFIRMATION\n\n` +
      `You are about to merge ${selectedGroups.size} duplicate group(s).\n` +
      `This will delete ${totalDuplicates} duplicate record(s).\n\n` +
      `What will happen:\n` +
      `✓ Primary (oldest) record in each group will be kept\n` +
      `✓ All data from duplicates will be merged into primary\n` +
      `✓ Skills, tags, and notes will be combined\n` +
      `✓ Missing fields will be filled from duplicates\n` +
      `✓ Duplicate records will be permanently deleted\n\n` +
      `⚠️ This action CANNOT be undone!\n\n` +
      `Continue with merge?`
    );

    if (!confirmed) return;

    setMerging(true);

    try {
      let mergedCount = 0;
      let deletedCount = 0;
      const errors = [];

      for (const groupId of selectedGroups) {
        const group = duplicateGroups.find(g => g.group_id === groupId);
        if (!group || !group.primary) {
          errors.push(`Group ${groupId}: Primary record not found`);
          continue;
        }

        const primary = group.primary;
        const duplicates = group.candidates.filter(c => c.id !== primary.id);

        try {
          // Build merged data object
          const mergedData = { ...primary };

          duplicates.forEach(dup => {
            // Merge arrays: skills, tags
            if (Array.isArray(dup.skills) && dup.skills.length > 0) {
              const existingSkills = mergedData.skills || [];
              mergedData.skills = [...new Set([...existingSkills, ...dup.skills])];
            }

            if (Array.isArray(dup.tags) && dup.tags.length > 0) {
              const existingTags = mergedData.tags || [];
              mergedData.tags = [...new Set([...existingTags, ...dup.tags])];
            }

            // Fill missing fields from duplicates
            Object.keys(dup).forEach(key => {
              const skipFields = ['id', 'created_date', 'updated_date', 'created_by', 'skills', 'tags', 'notes'];
              
              if (!skipFields.includes(key) && 
                  (!mergedData[key] || mergedData[key] === "") && 
                  dup[key] && dup[key] !== "") {
                mergedData[key] = dup[key];
              }
            });

            // Merge notes with attribution
            if (dup.notes && dup.notes.trim() !== "" && dup.notes !== primary.notes) {
              const existingNotes = mergedData.notes || "";
              mergedData.notes = [
                existingNotes,
                `\n\n--- Merged from duplicate (ID: ${dup.id}, Created: ${new Date(dup.created_date).toLocaleString()}) ---`,
                dup.notes
              ].filter(Boolean).join("\n").trim();
            }
          });

          // Update primary record with merged data
          await Candidate.update(primary.id, mergedData);
          mergedCount++;

          // Delete duplicate records
          for (const dup of duplicates) {
            try {
              await Candidate.delete(dup.id);
              deletedCount++;
            } catch (delError) {
              errors.push(`Failed to delete ${dup.first_name} ${dup.last_name} (${dup.id}): ${delError.message}`);
            }
          }
        } catch (groupError) {
          errors.push(`Group ${groupId}: ${groupError.message}`);
        }
      }

      // Show results
      if (errors.length > 0) {
        console.error("Merge errors:", errors);
        addNotification({
          type: "warning",
          title: "Partial Success",
          message: `Merged ${mergedCount} group(s), deleted ${deletedCount} record(s). ${errors.length} error(s) occurred.`
        });
      } else {
        addNotification({
          type: "success",
          title: "Merge Complete ✓",
          message: `Successfully merged ${mergedCount} group(s) and removed ${deletedCount} duplicate record(s)`
        });
      }

      // Reload data
      await loadCandidates();
      setDuplicateGroups([]);
      setSelectedGroups(new Set());
      setExpandedGroups(new Set());

    } catch (error) {
      console.error("Error merging duplicates:", error);
      addNotification({
        type: "error",
        title: "Merge Failed",
        message: error.message || "Failed to merge duplicates. Please try again."
      });
    }

    setMerging(false);
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 90) return "bg-red-100 text-red-800 border-red-300";
    if (confidence >= 70) return "bg-orange-100 text-orange-800 border-orange-300";
    return "bg-yellow-100 text-yellow-800 border-yellow-300";
  };

  const getConfidenceLabel = (confidence) => {
    if (confidence >= 90) return "High Confidence";
    if (confidence >= 70) return "Likely Duplicate";
    return "Possible Duplicate";
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Breadcrumbs items={[{ label: "Duplicate Manager", icon: Users }]} />

      <PageHeader
        title="Duplicate Data Manager"
        subtitle="AI-powered duplicate detection and merge tool"
        right={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadCandidates} disabled={loading} className="gap-2">
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </Button>
            <Button 
              onClick={findDuplicatesWithAI} 
              disabled={analyzing || loading}
              className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Find Duplicates with AI
                </>
              )}
            </Button>
          </div>
        }
      />

      {/* Stats Card */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Candidates</p>
                <p className="text-2xl font-bold text-slate-900">{candidates.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Duplicate Groups</p>
                <p className="text-2xl font-bold text-slate-900">{duplicateGroups.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Duplicate Records</p>
                <p className="text-2xl font-bold text-slate-900">
                  {duplicateGroups.reduce((sum, g) => sum + (g.candidates.length - 1), 0)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Selected</p>
                <p className="text-2xl font-bold text-slate-900">{selectedGroups.size}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Matching Criteria */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Duplicate Detection Criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox 
                checked={matchCriteria.email}
                onCheckedChange={(checked) => setMatchCriteria({...matchCriteria, email: checked})}
              />
              <Mail className="w-4 h-4 text-slate-500" />
              <span className="text-sm">Match by Email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox 
                checked={matchCriteria.phone}
                onCheckedChange={(checked) => setMatchCriteria({...matchCriteria, phone: checked})}
              />
              <Phone className="w-4 h-4 text-slate-500" />
              <span className="text-sm">Match by Phone</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox 
                checked={matchCriteria.name}
                onCheckedChange={(checked) => setMatchCriteria({...matchCriteria, name: checked})}
              />
              <Users className="w-4 h-4 text-slate-500" />
              <span className="text-sm">Match by Name</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox 
                checked={matchCriteria.current_title}
                onCheckedChange={(checked) => setMatchCriteria({...matchCriteria, current_title: checked})}
              />
              <Briefcase className="w-4 h-4 text-slate-500" />
              <span className="text-sm">Match by Current Title</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {duplicateGroups.length > 0 && (
        <Card className="bg-slate-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-700">
                {selectedGroups.size > 0 
                  ? `${selectedGroups.size} group(s) selected`
                  : "Select groups to merge or delete"
                }
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedGroups.size === duplicateGroups.length) {
                      setSelectedGroups(new Set());
                    } else {
                      setSelectedGroups(new Set(duplicateGroups.map(g => g.group_id)));
                    }
                  }}
                  className="text-sm"
                >
                  {selectedGroups.size === duplicateGroups.length ? "Deselect All" : "Select All"}
                </Button>
                <Button
                  onClick={mergeSelectedGroups}
                  disabled={selectedGroups.size === 0 || merging}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                >
                  {merging ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Merging...
                    </>
                  ) : (
                    <>
                      <Merge className="w-4 h-4" />
                      Merge Selected ({selectedGroups.size})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Duplicate Groups */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      )}

      {!loading && duplicateGroups.length === 0 && !analyzing && (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {candidates.length === 0 ? "No Candidates" : "No Duplicates Found"}
            </h3>
            <p className="text-slate-600 mb-6">
              {candidates.length === 0 
                ? "Load candidates to start duplicate detection"
                : "Click 'Find Duplicates with AI' to scan for duplicate records"
              }
            </p>
          </CardContent>
        </Card>
      )}

      {duplicateGroups.length > 0 && (
        <div className="space-y-4">
          {duplicateGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.group_id);
            const isSelected = selectedGroups.has(group.group_id);

            return (
              <Card 
                key={group.group_id} 
                className={`border-2 ${isSelected ? "border-blue-500 bg-blue-50" : "border-slate-200"}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleGroupSelection(group.group_id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="w-5 h-5 text-orange-600" />
                          <CardTitle className="text-base">
                            Duplicate Group: {group.candidates.length} records
                          </CardTitle>
                          <Badge className={getConfidenceColor(group.confidence)}>
                            {group.confidence}% - {getConfidenceLabel(group.confidence)}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{group.explanation}</p>
                        <div className="flex flex-wrap gap-2">
                          {group.matching_fields.map((field, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              Matched: {field}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleGroupExpansion(group.group_id)}
                      className="gap-1"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          Hide
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          Show
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent>
                    <div className="space-y-4">
                      {group.candidates.map((candidate) => {
                        const isPrimary = candidate.id === group.primary_candidate_id;

                        return (
                          <div
                            key={candidate.id}
                            className={`p-4 rounded-lg border-2 ${
                              isPrimary 
                                ? "border-green-500 bg-green-50" 
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-slate-900">
                                  {candidate.first_name} {candidate.last_name}
                                </h4>
                                {isPrimary && (
                                  <Badge className="bg-green-600 text-white">
                                    Primary (Keep)
                                  </Badge>
                                )}
                                {!isPrimary && (
                                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                                    Duplicate (Delete)
                                  </Badge>
                                )}
                              </div>
                              <Link
                                to={createPageUrl(`CandidateDetails?id=${candidate.id}`)}
                                target="_blank"
                              >
                                <Button variant="outline" size="sm" className="gap-1">
                                  <Eye className="w-3 h-3" />
                                  View
                                </Button>
                              </Link>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-700">{candidate.email || "—"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-700">{candidate.phone || "—"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-slate-400" />
                                <span className="text-slate-700">{candidate.current_title || "—"}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                Created: {new Date(candidate.created_date).toLocaleDateString()}
                              </div>
                            </div>

                            {candidate.skills && candidate.skills.length > 0 && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-xs text-slate-500 mb-2">Skills:</p>
                                <div className="flex flex-wrap gap-1">
                                  {candidate.skills.slice(0, 5).map((skill, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {skill}
                                    </Badge>
                                  ))}
                                  {candidate.skills.length > 5 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{candidate.skills.length - 5}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Conflicts Display */}
                      {group.conflicts && Object.keys(group.conflicts).length > 0 && (
                        <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                          <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Data Conflicts
                          </h4>
                          <p className="text-sm text-yellow-800 mb-2">
                            These fields have different values across duplicates. Primary record values will be kept, but you can manually review:
                          </p>
                          <div className="space-y-2">
                            {Object.entries(group.conflicts).map(([field, values]) => (
                              <div key={field} className="text-sm">
                                <span className="font-medium text-yellow-900">{field}:</span>
                                <ul className="ml-4 mt-1">
                                  {Array.isArray(values) && values.map((value, i) => (
                                    <li key={i} className="text-yellow-800">• {value || "(empty)"}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
