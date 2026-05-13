
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Candidate } from "@/entities/Candidate";
import * as Core from "@/integrations/Core";
import { Sparkles, User, MapPin, Briefcase, Award, TrendingUp, Loader2, RefreshCw, AlertCircle, Brain, Target, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function RecommendedCandidates({ job }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [analysisMetadata, setAnalysisMetadata] = useState(null);

  const fetchRecommendations = async () => {
    if (!job) return;
    
    setLoading(true);
    setError(null);

    try {
      // Get all active candidates
      const allCandidates = await Candidate.filter(
        { status: "active" },
        "-updated_date",
        300
      );

      if (!allCandidates || allCandidates.length === 0) {
        setRecommendations([]);
        setLoading(false);
        setHasLoaded(true);
        setAnalysisMetadata(null);
        return;
      }

      // ENHANCED PRE-FILTER: Intelligent skill-based filtering
      const requiredSkills = job.required_skills || [];
      let eligibleCandidates = allCandidates;
      
      if (requiredSkills.length > 0) {
        eligibleCandidates = allCandidates.filter(candidate => {
          const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase().trim());
          const reqSkillsLower = requiredSkills.map(s => s.toLowerCase().trim());
          
          // STRICT MATCHING: Must have at least ONE exact or very close match
          const hasStrictMatch = reqSkillsLower.some(reqSkill => {
            return candidateSkills.some(candSkill => {
              // Exact match
              if (candSkill === reqSkill) return true;
              
              // Very close variants only (e.g., "react" and "reactjs", "node" and "nodejs")
              const candNorm = candSkill.replace(/[.\-_\s]/g, '').toLowerCase();
              const reqNorm = reqSkill.replace(/[.\-_\s]/g, '').toLowerCase();
              
              if (candNorm === reqNorm) return true;
              if (candNorm.includes(reqNorm) && candNorm.length - reqNorm.length <= 2) return true;
              if (reqNorm.includes(candNorm) && reqNorm.length - candNorm.length <= 2) return true;
              
              return false;
            });
          });
          
          return hasStrictMatch;
        });

        if (eligibleCandidates.length === 0) {
          setRecommendations([]);
          setLoading(false);
          setHasLoaded(true);
          setAnalysisMetadata({
            ideal_profile: null,
            pool_insights: {
              average_match_score: 0,
              skill_supply_analysis: [],
              top_differentiators: [],
              hiring_difficulty_score: 100,
              recommended_sourcing_strategy: "No candidates in the database match the required skills with sufficient precision. The requirements may be too specific or the candidate pool needs expansion."
            },
            analyzed_count: allCandidates.length,
            timestamp: new Date().toISOString()
          });
          return;
        }
      }

      // Build comprehensive job context
      const jobContext = buildJobContext(job);
      
      // Build comprehensive candidate summaries (only for eligible candidates)
      const candidateSummaries = eligibleCandidates.map(c => buildCandidateSummary(c));

      // ENHANCED UNIVERSAL PROMPT - Works for ALL job titles and technologies
      const prompt = `You are a WORLD-CLASS technical recruiter and talent acquisition expert with 25+ years of experience across ALL technology domains and industries. Your specialty is PRECISE candidate-job matching using deep semantic understanding of roles, technologies, and career trajectories.

**CRITICAL PHILOSOPHY: ZERO FALSE POSITIVES**
Your reputation depends on ONLY recommending candidates who are GENUINELY qualified for THIS SPECIFIC role. A wrong recommendation wastes everyone's time and damages credibility.

**JOB REQUIREMENTS (MUST MATCH PRECISELY):**
${jobContext}

**CANDIDATE POOL (${eligibleCandidates.length} pre-filtered candidates with at least one required skill):**
${candidateSummaries.map((c, i) => `
[CANDIDATE ${i}]
${c}
`).join('\n---\n')}

**UNIVERSAL TECHNOLOGY DOMAIN INTELLIGENCE:**

You must understand the SEMANTIC MEANING and RELATIONSHIPS between technologies, not just exact string matching. Use your deep knowledge of:

**1. TECHNOLOGY ECOSYSTEMS & DOMAINS:**
- **Web Development:** Frontend (React, Angular, Vue, Svelte) vs Backend (Node.js, Django, Rails, Spring) vs Full Stack (both)
- **Mobile Development:** iOS (Swift, Objective-C) vs Android (Kotlin, Java) vs Cross-platform (React Native, Flutter)
- **Cloud Platforms:** AWS vs Azure vs GCP (fundamentally different despite similar services)
- **Enterprise Software:** Salesforce, SAP, Oracle, ServiceNow, Workday (siloed ecosystems, NOT general web dev)
- **Data Engineering:** Spark, Hadoop, Airflow, Kafka (specialized, NOT general backend)
- **DevOps/SRE:** Kubernetes, Docker, Terraform, Jenkins (infrastructure, NOT software development)
- **Data Science/ML:** Python (ML libraries), TensorFlow, PyTorch (specialized, NOT general programming)
- **Embedded/IoT:** C, C++, RTOS (low-level, NOT web development)
- **Game Development:** Unity, Unreal Engine (specialized, NOT web development)
- **Blockchain:** Solidity, Web3 (specialized, NOT general backend)

**2. TECHNOLOGY TRANSFERABILITY MATRIX:**

**Highly Transferable (80-100% overlap):**
- React ↔ React.js ↔ ReactJS (same technology, naming variants)
- Node.js ↔ NodeJS ↔ Node (same technology)
- JavaScript ↔ TypeScript (TypeScript is JS superset, 90% transferable)
- AWS EC2 ↔ Azure VMs ↔ GCP Compute (similar cloud compute concepts)
- SQL (MySQL, PostgreSQL, SQL Server) - fundamentally similar relational concepts

**Moderately Transferable (50-79% overlap):**
- React ↔ Vue ↔ Angular (different frameworks, similar frontend concepts)
- Python (general) ↔ Python (ML/Data Science) - same language, different domain
- Java (Backend) ↔ Kotlin (Backend) - JVM ecosystem
- .NET Core ↔ .NET Framework (evolution of same platform)

**Low Transferability (20-49% overlap):**
- Frontend (React) ↔ Backend (Node.js) - different layers, some JS overlap
- iOS (Swift) ↔ Android (Kotlin) - different platforms, similar mobile concepts
- SQL ↔ NoSQL (MongoDB, Cassandra) - fundamentally different data paradigms

**NOT Transferable (0-19% overlap) - AUTOMATIC DISQUALIFICATION:**
- Salesforce (Apex) ↔ Full Stack (React/Node) - completely different ecosystems ❌
- Data Engineering (Spark) ↔ Web Development (React) - completely different domains ❌
- DevOps (Kubernetes) ↔ Frontend Development - completely different focus ❌
- Game Development (Unity) ↔ Web Development - completely different domains ❌
- Embedded (C/RTOS) ↔ Web Development - completely different paradigm ❌

**3. ROLE TAXONOMY & SEMANTIC UNDERSTANDING:**

**Software Engineering Roles:**
- **Frontend Developer:** Client-side web (React, Angular, Vue, Svelte, HTML/CSS/JS)
- **Backend Developer:** Server-side logic (Node.js, Python, Java, Go, databases)
- **Full Stack Developer:** BOTH frontend AND backend (must have both skill sets)
- **Mobile Developer:** Native or cross-platform mobile apps
- **DevOps Engineer:** Infrastructure, CI/CD, deployment automation
- **Data Engineer:** ETL pipelines, data warehousing, big data processing
- **Data Scientist/ML Engineer:** Machine learning models, statistical analysis
- **QA/Test Engineer:** Testing frameworks, automation, quality assurance

**Enterprise Software Roles (Separate Ecosystem):**
- **Salesforce Developer:** Apex, Lightning, SOQL (NOT general web development)
- **SAP Consultant:** ABAP, SAP modules (NOT general programming)
- **ServiceNow Developer:** ServiceNow platform (NOT general web development)
- **Oracle Developer:** PL/SQL, Oracle Forms (NOT general web development)

**CRITICAL RULE: Enterprise Software ≠ General Software Development**
Salesforce Developers, SAP Consultants, ServiceNow Developers work in CLOSED, PROPRIETARY ecosystems. They are NOT Full Stack, Frontend, or Backend developers in the general sense.

**STRICT MATCHING PROTOCOL:**

**STEP 1: DOMAIN VERIFICATION (Pass/Fail)**
- Extract the PRIMARY TECHNOLOGY DOMAIN from the job title and required skills
- Extract the PRIMARY TECHNOLOGY DOMAIN from each candidate's experience
- **IF domains are NOT compatible (0-19% transferability):** SCORE = 0, REJECT immediately
- **ONLY proceed if domains match or are moderately/highly transferable (50%+ overlap)**

**STEP 2: SKILL MATCHING (0-50 points)**
For EACH required skill:
- **Exact Match** (same technology): 10 points
- **High Transfer Variant** (80%+ transferable): 8 points
- **Moderate Transfer** (50-79% transferable): 5 points
- **Low Transfer** (20-49% transferable): 2 points (still useful)
- **No Transfer** (0-19%): 0 points (missing skill)

**Recency Multiplier:**
- Used in last 12 months: Full points
- Used 1-2 years ago: 0.7x points
- Used 2+ years ago: 0.4x points
- No recent proof: 0.3x points

**DISQUALIFICATION RULES:**
- If candidate missing > 50% of required skills (ANY score level): MAX SCORE = 50 (not qualified)
- If ANY critical must-have skill is completely missing: MAX SCORE = 40

**STEP 3: EXPERIENCE ALIGNMENT (0-20 points)**
- **Seniority Match:**
  - Exact level (Senior for Senior): 12 points
  - One level off (Mid for Senior): 8 points
  - Two levels off: 4 points
  - Wrong track (Frontend for Backend): -15 points (major penalty)

- **Years of Experience:**
  - Matches requirement ±1 year: 8 points
  - Within 2 years: 5 points
  - Under-qualified by 3+ years: -10 points (penalty)
  - Over-qualified by 6+ years: -5 points (flight risk)

**STEP 4: DOMAIN EXPERTISE (0-15 points)**
- Same industry/domain: 12 points
- Adjacent industry: 7 points
- Transferable domain: 3 points
- No relevant domain: 0 points

**STEP 5: ADDITIONAL FACTORS (0-15 points)**
- Each preferred skill matched: +2 points (max 10)
- Modern tooling/practices: +3 points
- Leadership experience (if required): +2 points

**CONFIDENCE TIERS:**
- **90-100:** Perfect fit, interview immediately
- **75-89:** Strong fit, definitely interview
- **60-74:** Acceptable fit, phone screen
- **< 60:** Not qualified, DO NOT RECOMMEND

**YOUR TASK:**

1. **For EACH candidate:**
   - Step 1: Verify technology domain compatibility (Pass/Fail gate)
   - Step 2: Count EXACT and TRANSFERABLE skill matches with recency weighting
   - Step 3: Verify seniority and experience alignment
   - Step 4: Calculate strict score using rubric above
   - **IF score < 60: REJECT - they don't qualify**

2. **Be DOMAIN-AWARE:**
   - Understand that a "Python Developer" could be backend OR data science - check job context
   - Recognize that "Engineer" in Salesforce vs "Engineer" in React are DIFFERENT roles
   - Know when skills are complementary vs. mutually exclusive

3. **Only return candidates scoring 60+ (qualified threshold)**

4. **Rank by score (highest first), max 10 results**

5. **Be BRUTALLY HONEST:**
   - Better to return ZERO candidates than recommend wrong ones
   - Don't inflate scores to be helpful
   - Don't force matches that don't exist

**EXAMPLES OF CORRECT REASONING:**

**Example 1: Full Stack Job (React, Node.js, PostgreSQL)**
- ✅ Candidate with React + Express + MongoDB: Score ~85 (high transfer, similar stack)
- ✅ Candidate with Vue + Node.js + PostgreSQL: Score ~78 (Vue↔React moderate transfer)
- ❌ Candidate with Salesforce + Apex: Score 0 (wrong domain entirely)
- ❌ Candidate with React only: Score ~45 (missing backend, not full stack)

**Example 2: Salesforce Developer Job (Apex, Lightning, SOQL)**
- ✅ Candidate with Salesforce + Apex + Lightning: Score ~95 (perfect match)
- ✅ Candidate with Salesforce Admin + some Apex: Score ~72 (good match, junior level)
- ❌ Candidate with Java + Spring Boot: Score 0 (wrong domain, Java ≠ Apex)
- ❌ Candidate with React + Node.js: Score 0 (wrong domain entirely)

**Example 3: Data Engineer Job (Spark, Hadoop, Python, SQL)**
- ✅ Candidate with Spark + Python + SQL: Score ~88 (strong match)
- ✅ Candidate with ETL tools + SQL + some Python: Score ~70 (acceptable match)
- ❌ Candidate with Python (Django web apps): Score ~35 (wrong domain, Python web ≠ data)
- ❌ Candidate with React + TypeScript: Score 0 (wrong domain entirely)

**OUTPUT FORMAT (JSON):**

{
  "ideal_candidate_profile": {
    "must_have_skills": ["skill1", "skill2"],
    "technology_domain": "Primary domain (e.g., 'Full Stack Web Development', 'Enterprise Salesforce', 'Data Engineering')",
    "related_domains": ["Acceptable adjacent domains"],
    "incompatible_domains": ["Domains that are NOT compatible"],
    "nice_to_have_skills": ["bonus skills"],
    "ideal_background": "Description",
    "ideal_experience_years": number,
    "critical_requirements": ["requirement1", "requirement2"],
    "disqualifying_factors": ["What immediately disqualifies"]
  },
  "recommendations": [
    {
      "candidate_index": 0,
      "overall_score": 85,
      "required_skills_matched": 5,
      "required_skills_total": 6,
      "required_skills_percentage": 83,
      "exact_skill_matches": ["React", "Node.js", "PostgreSQL"],
      "transferable_skill_matches": [{"from": "MongoDB", "to": "PostgreSQL", "transfer_rate": 60}],
      "missing_skills": ["AWS"],
      "technology_domain_match": true,
      "domain_compatibility_score": 95,
      "match_breakdown": {
        "required_skills": 42,
        "experience_level": 16,
        "domain_fit": 12,
        "preferred_skills": 8,
        "logistics": 7
      },
      "strengths": [
        "5/6 required skills with proven hands-on experience",
        "Strong domain match (Full Stack Web → Full Stack Web)",
        "Recent experience (last 12 months)"
      ],
      "concerns": [
        "Missing AWS cloud platform (required)",
        "Has MongoDB instead of PostgreSQL (60% transferable)"
      ],
      "transferability_notes": "MongoDB → PostgreSQL: Both NoSQL/SQL databases, candidate shows database expertise which transfers well",
      "evidence": {
        "strongest_match_quote": "5 years React + Node.js full stack development",
        "biggest_gap": "No AWS experience, uses GCP instead"
      },
      "key_highlights": "83% exact skill match with strong full stack background, missing one cloud platform",
      "match_confidence": "high",
      "recommended_action": "interview",
      "semantic_similarity": 87,
      "disqualifying_factors": []
    }
  ],
  "pool_insights": {
    "average_match_score": 68,
    "qualified_candidates_count": 3,
    "technology_domain_distribution": {
      "full_stack": 12,
      "frontend": 8,
      "backend": 6,
      "salesforce": 15,
      "data_engineering": 4,
      "mobile": 3,
      "devops": 2,
      "other": 10
    },
    "skill_supply_analysis": [
      {
        "skill": "React",
        "required": true,
        "candidates_with_skill": 12,
        "candidates_with_recent_experience": 8,
        "transferable_alternatives": ["Vue: 3 candidates", "Angular: 2 candidates"],
        "average_proficiency": 75,
        "supply_status": "adequate"
      }
    ],
    "top_differentiators": ["Skills that separate top candidates from unqualified"],
    "hiring_difficulty_score": 65,
    "recommended_sourcing_strategy": "Based on gap analysis...",
    "critical_skill_gaps": ["Skills required but scarce"],
    "domain_mismatch_count": 25,
    "transferability_insights": "X candidates have transferable skills from Y domain"
  }
}

**FINAL REMINDERS:**
- Technology domain compatibility is THE MOST IMPORTANT factor
- Exact skill matching matters, but SEMANTIC understanding matters more
- Salesforce ≠ Full Stack, Data Engineering ≠ Web Development, DevOps ≠ Frontend
- If in doubt about domain compatibility, REJECT (false negatives > false positives)
- Return empty array if truly no qualified candidates exist`;

      const response = await Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            ideal_candidate_profile: {
              type: "object",
              properties: {
                must_have_skills: { type: "array", items: { type: "string" } },
                technology_domain: { type: "string" },
                related_domains: { type: "array", items: { type: "string" } },
                incompatible_domains: { type: "array", items: { type: "string" } },
                nice_to_have_skills: { type: "array", items: { type: "string" } },
                ideal_background: { type: "string" },
                ideal_experience_years: { type: "number" },
                critical_requirements: { type: "array", items: { type: "string" } },
                disqualifying_factors: { type: "array", items: { type: "string" } }
              },
              required: ["must_have_skills", "technology_domain", "ideal_background", "ideal_experience_years"]
            },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  candidate_index: { type: "number" },
                  overall_score: { type: "number" },
                  required_skills_matched: { type: "number" },
                  required_skills_total: { type: "number" },
                  required_skills_percentage: { type: "number" },
                  exact_skill_matches: { type: "array", items: { type: "string" } },
                  transferable_skill_matches: { 
                    type: "array", 
                    items: { 
                      type: "object",
                      properties: {
                        from: { type: "string" },
                        to: { type: "string" },
                        transfer_rate: { type: "number" }
                      }
                    }
                  },
                  missing_skills: { type: "array", items: { type: "string" } },
                  technology_domain_match: { type: "boolean" },
                  domain_compatibility_score: { type: "number" },
                  match_breakdown: {
                    type: "object",
                    properties: {
                      required_skills: { type: "number" },
                      experience_level: { type: "number" },
                      domain_fit: { type: "number" },
                      preferred_skills: { type: "number" },
                      logistics: { type: "number" }
                    },
                    required: ["required_skills", "experience_level", "domain_fit", "preferred_skills", "logistics"]
                  },
                  strengths: { type: "array", items: { type: "string" } },
                  concerns: { type: "array", items: { type: "string" } },
                  transferability_notes: { type: "string" },
                  evidence: {
                    type: "object",
                    properties: {
                      strongest_match_quote: { type: "string" },
                      biggest_gap: { type: "string" }
                    },
                    required: ["strongest_match_quote", "biggest_gap"]
                  },
                  key_highlights: { type: "string" },
                  match_confidence: { type: "string" },
                  recommended_action: { type: "string" },
                  semantic_similarity: { type: "number" },
                  disqualifying_factors: { type: "array", items: { type: "string" } }
                },
                required: ["candidate_index", "overall_score", "required_skills_matched", "required_skills_total", "technology_domain_match", "domain_compatibility_score", "match_breakdown", "strengths", "concerns", "evidence", "key_highlights", "match_confidence", "recommended_action"]
              }
            },
            pool_insights: {
              type: "object",
              properties: {
                average_match_score: { type: "number" },
                qualified_candidates_count: { type: "number" },
                technology_domain_distribution: {
                  type: "object",
                  additionalProperties: { type: "number" }
                },
                skill_supply_analysis: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      skill: { type: "string" },
                      required: { type: "boolean" },
                      candidates_with_skill: { type: "number" },
                      candidates_with_recent_experience: { type: "number" },
                      transferable_alternatives: { type: "array", items: { type: "string" } },
                      average_proficiency: { type: "number" },
                      supply_status: { type: "string" }
                    },
                    required: ["skill", "required", "candidates_with_skill", "candidates_with_recent_experience", "average_proficiency", "supply_status"]
                  }
                },
                top_differentiators: { type: "array", items: { type: "string" } },
                hiring_difficulty_score: { type: "number" },
                recommended_sourcing_strategy: { type: "string" },
                critical_skill_gaps: { type: "array", items: { type: "string" } },
                domain_mismatch_count: { type: "number" },
                transferability_insights: { type: "string" }
              },
              required: ["average_match_score", "qualified_candidates_count", "skill_supply_analysis", "hiring_difficulty_score", "recommended_sourcing_strategy"]
            }
          },
          required: ["ideal_candidate_profile", "recommendations", "pool_insights"]
        }
      });

      const results = response?.recommendations || [];
      
      // STRICT FILTER: Only candidates with score >= 60 AND domain match
      const rankedCandidates = results
        .filter(r => r.candidate_index >= 0 && r.candidate_index < eligibleCandidates.length)
        .filter(r => r.overall_score >= 60 && r.technology_domain_match === true)
        .map(r => ({
          ...eligibleCandidates[r.candidate_index],
          ai_score: r.overall_score,
          required_skills_matched: r.required_skills_matched || 0,
          required_skills_total: r.required_skills_total || 0,
          required_skills_percentage: r.required_skills_percentage || 0,
          exact_skill_matches: r.exact_skill_matches || [],
          transferable_skill_matches: r.transferable_skill_matches || [],
          missing_skills: r.missing_skills || [],
          technology_domain_match: r.technology_domain_match,
          domain_compatibility_score: r.domain_compatibility_score || 0,
          transferability_notes: r.transferability_notes || '',
          match_breakdown: r.match_breakdown,
          strengths: r.strengths || [],
          concerns: r.concerns || [],
          evidence: r.evidence || {},
          key_highlights: r.key_highlights || '',
          match_confidence: r.match_confidence || 'low',
          recommended_action: r.recommended_action || 'review',
          semantic_similarity: r.semantic_similarity || 0,
          disqualifying_factors: r.disqualifying_factors || []
        }))
        .sort((a, b) => b.ai_score - a.ai_score)
        .slice(0, 10);

      setRecommendations(rankedCandidates);
      setAnalysisMetadata({
        ideal_profile: response.ideal_candidate_profile,
        pool_insights: response.pool_insights,
        analyzed_count: allCandidates.length,
        pre_filtered_count: eligibleCandidates.length,
        timestamp: new Date().toISOString()
      });
      setHasLoaded(true);
    } catch (err) {
      console.error("Error fetching AI recommendations:", err);
      setError(err.message || "Failed to get recommendations");
      setHasLoaded(true);
      setAnalysisMetadata(null);
    } finally {
      setLoading(false);
    }
  };

  const buildJobContext = (job) => {
    const parts = [];
    
    parts.push(`**Job Title:** ${job.title}`);
    
    if (job.description) {
      parts.push(`**Description:** ${job.description}`);
    }
    
    if (job.requirements) {
      parts.push(`**Requirements:** ${job.requirements}`);
    }
    
    if (job.required_skills && job.required_skills.length > 0) {
      parts.push(`**Required Skills:** ${job.required_skills.join(', ')}`);
    }
    
    if (job.preferred_skills && job.preferred_skills.length > 0) {
      parts.push(`**Preferred Skills:** ${job.preferred_skills.join(', ')}`);
    }
    
    if (job.experience_required) {
      parts.push(`**Years of Experience:** ${job.experience_required}+ years`);
    }
    
    if (job.location) {
      parts.push(`**Location:** ${job.location}`);
    }
    
    if (job.remote_type) {
      parts.push(`**Work Type:** ${job.remote_type}`);
    }
    
    if (job.employment_type) {
      parts.push(`**Employment Type:** ${job.employment_type}`);
    }
    
    if (job.rate) {
      parts.push(`**Compensation:** ${job.rate}`);
    }

    if (job.visa_restrictions) {
      parts.push(`**Visa Requirements:** ${job.visa_restrictions}`);
    }

    if (job.location_preference) {
      parts.push(`**Location Details:** ${job.location_preference}`);
    }

    if (job.contract_type) {
      parts.push(`**Contract Type:** ${job.contract_type}`);
    }
    
    return parts.join('\n');
  };

  const buildCandidateSummary = (candidate) => {
    const parts = [];
    
    parts.push(`Name: ${candidate.first_name} ${candidate.last_name}`);
    
    if (candidate.email) {
      parts.push(`Email: ${candidate.email}`);
    }
    
    if (candidate.current_title) {
      parts.push(`Current Title: ${candidate.current_title}`);
    }
    
    if (candidate.current_company) {
      parts.push(`Current Company: ${candidate.current_company}`);
    }
    
    if (candidate.experience_years) {
      parts.push(`Total Experience: ${candidate.experience_years} years`);
    }
    
    if (candidate.skills && candidate.skills.length > 0) {
      parts.push(`Skills: ${candidate.skills.join(', ')}`);
    }
    
    if (candidate.location) {
      parts.push(`Location: ${candidate.location}`);
    }
    
    if (candidate.work_authorization) {
      parts.push(`Work Authorization: ${candidate.work_authorization}`);
    }
    
    if (candidate.availability) {
      parts.push(`Availability: ${candidate.availability}`);
    }
    
    if (candidate.salary_expectation) {
      parts.push(`Salary Expectation: $${candidate.salary_expectation.toLocaleString()}`);
    }
    
    if (candidate.linkedin_url) {
      parts.push(`LinkedIn: ${candidate.linkedin_url}`);
    }

    // Include additional fields that may contain relevant info
    if (candidate.addedExperience) {
      parts.push(`Additional Experience: ${candidate.addedExperience}`);
    }

    if (candidate.consultantVisaStatus) {
      parts.push(`Visa Status: ${candidate.consultantVisaStatus}`);
    }

    if (candidate.realTimeExperience) {
      parts.push(`Real-time Experience: ${candidate.realTimeExperience}`);
    }

    if (candidate.workLocationPreference) {
      parts.push(`Location Preference: ${candidate.workLocationPreference}`);
    }

    if (candidate.notes) {
      parts.push(`Notes: ${candidate.notes.substring(0, 200)}`);
    }
    
    return parts.join('\n');
  };

  const getScoreColor = (score) => {
    if (score >= 85) return "bg-green-100 text-green-800 border-green-300";
    if (score >= 70) return "bg-blue-100 text-blue-800 border-blue-300";
    if (score >= 55) return "bg-yellow-100 text-yellow-800 border-yellow-300";
    return "bg-orange-100 text-orange-800 border-orange-300";
  };

  const getConfidenceBadge = (confidence) => {
    const colors = {
      high: "bg-green-100 text-green-800",
      medium: "bg-blue-100 text-blue-800",
      low: "bg-orange-100 text-orange-800"
    };
    return colors[confidence] || colors.medium;
  };

  const getActionBadge = (action) => {
    const config = {
      interview: { color: "bg-green-100 text-green-800", label: "Interview", icon: "✅" },
      phone_screen: { color: "bg-blue-100 text-blue-800", label: "Phone Screen", icon: "📞" },
      pass: { color: "bg-red-100 text-red-800", label: "Pass", icon: "❌" },
      request_more_info: { color: "bg-yellow-100 text-yellow-800", label: "Need More Info", icon: "❓" },
      review: { color: "bg-slate-100 text-slate-800", label: "Review", icon: "👀" }
    };
    return config[action] || config.review;
  };

  const getSupplyStatusColor = (status) => {
    const colors = {
      abundant: "bg-green-100 text-green-800",
      adequate: "bg-blue-100 text-blue-800",
      scarce: "bg-yellow-100 text-yellow-800",
      critical_shortage: "bg-red-100 text-red-800"
    };
    return colors[status] || colors.adequate;
  };

  if (!job) return null;

  return (
    <Card id="ai-recommendations" className="scroll-mt-6">
      <CardHeader className="flex flex-row items-center justify-between border-b">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-purple-600" />
          <div>
            <CardTitle className="flex items-center gap-2">
              AI Recommended Candidates
              <Badge variant="outline" className="text-xs font-normal">
                Universal Matching • 60+ Score • Domain Intelligence
              </Badge>
            </CardTitle>
            <p className="text-sm text-slate-600 mt-1">
              Smart semantic matching across all technologies and domains
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchRecommendations} 
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {hasLoaded ? 'Refresh Analysis' : 'Analyze Candidates'}
        </Button>
      </CardHeader>

      <CardContent className="p-6">
        {!hasLoaded && !loading && (
          <div className="text-center py-12 bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-dashed border-purple-200">
            <Brain className="w-16 h-16 text-purple-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Advanced Semantic Matching Available
            </h3>
            <p className="text-slate-600 mb-4 max-w-md mx-auto text-sm">
              Our AI implements cutting-edge techniques from ConFit, Resume2Vec, and transformer research:
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-6 text-xs">
              <Badge variant="outline" className="gap-1">
                <Target className="w-3 h-3" />
                Semantic Understanding
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Zap className="w-3 h-3" />
                Contrastive Learning
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Brain className="w-3 h-3" />
                Multi-Dimensional Scoring
              </Badge>
              <Badge variant="outline" className="gap-1">
                <TrendingUp className="w-3 h-3" />
                Fairness & Bias Mitigation
              </Badge>
            </div>
            <Button onClick={fetchRecommendations} size="lg" className="gap-2">
              <Sparkles className="w-5 h-5" />
              Start Advanced Analysis
            </Button>
            <p className="text-xs text-slate-500 mt-3">
              Analysis typically takes 30-60 seconds for full semantic matching
            </p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
            <p className="text-slate-600 text-center">
              🧠 Running transformer-based semantic analysis on <strong>{job.title}</strong>...
              <br />
              <span className="text-sm text-slate-500">
                Mapping candidates into shared embedding space • Analyzing skill semantics • Applying contrastive learning
              </span>
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Analysis Failed</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchRecommendations} className="mt-3">
                Retry Analysis
              </Button>
            </div>
          </div>
        )}

        {!loading && !error && hasLoaded && recommendations.length === 0 && (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">No Qualified Candidates Found</h3>
            <p className="text-slate-600 mb-2">
              No candidates meet the strict 60+ match threshold for this role, or their technology domain does not match.
            </p>
            {analysisMetadata?.pool_insights?.critical_skill_gaps?.length > 0 && (
              <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg inline-block text-left">
                <p className="text-sm font-semibold text-orange-900 mb-2">Critical Skill Gaps:</p>
                <ul className="text-sm text-orange-800 space-y-1 list-disc list-inside">
                  {analysisMetadata.pool_insights.critical_skill_gaps.map((gap, i) => (
                    <li key={i}>• {gap}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-sm text-slate-500 mt-4">
              Tip: Review the Pool Insights below for sourcing recommendations
            </p>
          </div>
        )}

        {!loading && !error && recommendations.length > 0 && (
          <div className="space-y-6">
            {/* Enhanced Ideal Candidate Profile */}
            {analysisMetadata?.ideal_profile && (
              <Card className="bg-purple-50 border-purple-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    Ideal Candidate Profile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Technology Domain */}
                  {analysisMetadata.ideal_profile.technology_domain && (
                    <div className="p-3 bg-white rounded-lg border-2 border-purple-300">
                      <p className="text-sm font-semibold text-purple-900 mb-1">Primary Technology Domain:</p>
                      <p className="text-lg font-bold text-purple-700">
                        {analysisMetadata.ideal_profile.technology_domain}
                      </p>
                      {analysisMetadata.ideal_profile.related_domains?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-purple-600 mb-1">Related/Acceptable:</p>
                          <div className="flex flex-wrap gap-1">
                            {analysisMetadata.ideal_profile.related_domains.map((d, i) => (
                              <Badge key={i} className="bg-purple-100 text-purple-700 text-xs">
                                {d}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {analysisMetadata.ideal_profile.incompatible_domains?.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-red-600 mb-1">⛔ Incompatible:</p>
                          <div className="flex flex-wrap gap-1">
                            {analysisMetadata.ideal_profile.incompatible_domains.map((d, i) => (
                              <Badge key={i} className="bg-red-100 text-red-700 text-xs">
                                {d}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {analysisMetadata.ideal_profile.must_have_skills?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-purple-900 mb-2">Must-Have Skills (Exact Match Required):</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysisMetadata.ideal_profile.must_have_skills.map((skill, i) => (
                          <Badge key={i} className="bg-red-100 text-red-800 border-red-300">
                            ⚠️ {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysisMetadata.ideal_profile.critical_requirements?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-purple-900 mb-2">Critical Requirements:</h4>
                      <ul className="text-sm text-purple-800 list-disc list-inside space-y-1">
                        {analysisMetadata.ideal_profile.critical_requirements.map((req, i) => (
                          <li key={i}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysisMetadata.ideal_profile.disqualifying_factors?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-red-900 mb-2">🚫 Automatic Disqualifiers:</h4>
                      <ul className="text-sm text-red-800 space-y-1">
                        {analysisMetadata.ideal_profile.disqualifying_factors.map((factor, i) => (
                          <li key={i}>• {factor}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {analysisMetadata.ideal_profile.nice_to_have_skills?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-purple-900 mb-2">Nice-to-Have:</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysisMetadata.ideal_profile.nice_to_have_skills.map((skill, i) => (
                          <Badge key={i} variant="outline" className="text-purple-700 border-purple-300">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {analysisMetadata.ideal_profile.ideal_background && (
                    <p className="text-sm text-purple-800">
                      <strong>Background:</strong> {analysisMetadata.ideal_profile.ideal_background}
                    </p>
                  )}
                  {analysisMetadata.ideal_profile.ideal_experience_years !== undefined && (
                    <p className="text-sm text-purple-800">
                      <strong>Experience Level:</strong> {analysisMetadata.ideal_profile.ideal_experience_years}+ years
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Enhanced Pool Insights */}
            {analysisMetadata?.pool_insights && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Talent Pool Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div>
                      <div className="text-xs text-slate-500">Total Pool</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {analysisMetadata.analyzed_count}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Pre-Filtered</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {analysisMetadata.pre_filtered_count || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Qualified (60+)</div>
                      <div className="text-2xl font-bold text-green-600">
                        {analysisMetadata.pool_insights.qualified_candidates_count || recommendations.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Domain Match</div>
                      <div className="text-2xl font-bold text-purple-600">
                        {recommendations.filter(r => r.technology_domain_match).length}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Avg Score</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {Math.round(analysisMetadata.pool_insights.average_match_score || 0)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Wrong Domain</div>
                      <div className="text-2xl font-bold text-orange-600">
                        {analysisMetadata.pool_insights.domain_mismatch_count || 0}
                      </div>
                    </div>
                  </div>

                  {/* Technology Domain Distribution */}
                  {analysisMetadata.pool_insights.technology_domain_distribution && (
                    <div className="pt-2 border-t">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">Technology Domain Breakdown:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.entries(analysisMetadata.pool_insights.technology_domain_distribution).map(([domain, count]) => (
                          <div key={domain} className="p-2 bg-white rounded border">
                            <div className="text-xs text-slate-600 capitalize">{domain.replace(/_/g, ' ')}</div>
                            <div className="text-lg font-bold text-slate-900">{count}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Transferability Insights */}
                  {analysisMetadata.pool_insights.transferability_insights && (
                    <div className="p-3 bg-white rounded-lg border">
                      <p className="text-sm font-semibold text-blue-900 mb-2">💡 Transferability Analysis:</p>
                      <p className="text-sm text-blue-800">{analysisMetadata.pool_insights.transferability_insights}</p>
                    </div>
                  )}

                  {/* Enhanced Skill Supply with Transferable Alternatives */}
                  {analysisMetadata.pool_insights.skill_supply_analysis?.length > 0 && (
                    <div className="pt-2 border-t">
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">Skill Availability:</h4>
                      <div className="space-y-2">
                        {analysisMetadata.pool_insights.skill_supply_analysis.slice(0, 8).map((skill, i) => (
                          <div key={i} className="flex items-center justify-between text-sm p-2 bg-white rounded border">
                            <div className="flex-1">
                              <span className="font-medium">{skill.skill}</span>
                              {skill.transferable_alternatives && skill.transferable_alternatives.length > 0 && (
                                <div className="text-xs text-slate-600 mt-1">
                                  Transferable: {skill.transferable_alternatives.join(', ')}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-600">
                                {skill.candidates_with_recent_experience}/{skill.candidates_with_skill}
                              </span>
                              <Badge className={getSupplyStatusColor(skill.supply_status)}>
                                {skill.supply_status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysisMetadata.pool_insights.top_differentiators?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-blue-900 mb-2">Key Differentiators:</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysisMetadata.pool_insights.top_differentiators.map((diff, i) => (
                          <Badge key={i} variant="outline" className="text-blue-700 border-blue-300">
                            {diff}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysisMetadata.pool_insights.recommended_sourcing_strategy && (
                    <div className="pt-2 border-t mt-4">
                      <p className="text-sm text-slate-700">
                        <strong className="text-blue-900">Sourcing Strategy:</strong>{" "}
                        {analysisMetadata.pool_insights.recommended_sourcing_strategy}
                      </p>
                    </div>
                  )}

                  {analysisMetadata.pool_insights.critical_skill_gaps?.length > 0 && (
                    <div className="pt-2 border-t">
                      <h4 className="text-sm font-semibold text-red-700 mb-2">⚠️ Critical Skill Gaps:</h4>
                      <div className="flex flex-wrap gap-2">
                        {analysisMetadata.pool_insights.critical_skill_gaps.map((gap, i) => (
                          <Badge key={i} className="bg-red-100 text-red-800 border-red-300">
                            {gap}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Enhanced Candidate Cards with Transferability */}
            <div className="space-y-4">
              {recommendations.map((candidate, index) => {
                const actionConfig = getActionBadge(candidate.recommended_action);
                const skillMatchPercentage = candidate.required_skills_percentage || 0;
                const domainScore = candidate.domain_compatibility_score || 0;
                
                return (
                  <Card key={candidate.id} className="overflow-hidden hover:shadow-lg transition-shadow border-2 border-slate-200">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            #{index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <Link
                                to={createPageUrl(`CandidateDetails?id=${candidate.id}`)}
                                className="text-lg font-semibold text-blue-600 hover:underline"
                                data-no-preview="true"
                              >
                                {candidate.first_name} {candidate.last_name}
                              </Link>
                              <Badge className={getScoreColor(candidate.ai_score)}>
                                {candidate.ai_score}% Match
                              </Badge>
                              <Badge className={getConfidenceBadge(candidate.match_confidence)}>
                                {candidate.match_confidence} confidence
                              </Badge>
                              <Badge className={`${actionConfig.color} border-${actionConfig.color.split('-')[1]}-300`}>
                                {actionConfig.icon} {actionConfig.label}
                              </Badge>
                              {candidate.semantic_similarity > 0 && ( 
                                <Badge variant="outline" className="text-xs">
                                  Similarity: {Math.round(candidate.semantic_similarity)}%
                                </Badge>
                              )}
                            </div>

                            {/* Enhanced Domain Match Indicator */}
                            {candidate.technology_domain_match ? (
                              <div className="mb-4 p-3 bg-green-50 rounded-lg border-2 border-green-200">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-semibold text-green-900">
                                    ✅ Technology Domain: VERIFIED MATCH ({domainScore}% compatible)
                                  </span>
                                </div>
                                
                                {/* Exact Matches */}
                                {candidate.exact_skill_matches && candidate.exact_skill_matches.length > 0 && (
                                  <div className="mb-2">
                                    <span className="text-xs text-green-700 font-medium">Exact matches:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {candidate.exact_skill_matches.map((skill, i) => (
                                        <Badge key={i} className="bg-green-100 text-green-800 text-xs">
                                          ✓ {skill}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Transferable Matches */}
                                {candidate.transferable_skill_matches && candidate.transferable_skill_matches.length > 0 && (
                                  <div className="mb-2">
                                    <span className="text-xs text-blue-700 font-medium">Transferable skills:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {candidate.transferable_skill_matches.map((match, i) => (
                                        <Badge key={i} className="bg-blue-100 text-blue-800 text-xs" title={`${match.transfer_rate}% transferable`}>
                                          {match.from} → {match.to} ({match.transfer_rate}%)
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Missing Skills */}
                                {candidate.missing_skills && candidate.missing_skills.length > 0 && (
                                  <div>
                                    <span className="text-xs text-orange-700 font-medium">Missing:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {candidate.missing_skills.map((skill, i) => (
                                        <Badge key={i} className="bg-orange-100 text-orange-800 text-xs">
                                          {skill}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Transferability Notes */}
                                {candidate.transferability_notes && (
                                  <div className="mt-2 text-xs text-blue-700 bg-blue-50 p-2 rounded">
                                    💡 {candidate.transferability_notes}
                                  </div>
                                )}
                              </div>
                            ) : (
                                <div className="mb-4 p-3 bg-red-50 rounded-lg border-2 border-red-200">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-sm font-semibold text-red-900">
                                      ❌ Technology Domain: MISMATCH
                                    </span>
                                  </div>
                                  <p className="text-xs text-red-700">
                                    Candidate's primary technology domain does not align with the job's core requirements.
                                  </p>
                                </div>
                            )}

                            {/* Required Skills Match - PROMINENT DISPLAY */}
                            <div className="mb-3 p-3 bg-slate-50 rounded-lg border-2 border-slate-200">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-slate-700">Required Skills Match:</span>
                                <span className={`text-lg font-bold ${skillMatchPercentage >= 80 ? 'text-green-600' : skillMatchPercentage >= 60 ? 'text-orange-600' : 'text-red-600'}`}>
                                  {candidate.required_skills_matched || 0}/{candidate.required_skills_total || 0} ({skillMatchPercentage}%)
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${skillMatchPercentage >= 80 ? 'bg-green-500' : skillMatchPercentage >= 60 ? 'bg-orange-500' : 'bg-red-500'}`}
                                  style={{ width: `${skillMatchPercentage}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-3">
                              {candidate.current_title && (
                                <div className="flex items-center gap-1">
                                  <Briefcase className="w-4 h-4" />
                                  {candidate.current_title}
                                  {candidate.current_company && ` @ ${candidate.current_company}`}
                                </div>
                              )}
                              {candidate.location && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-4 h-4" />
                                  {candidate.location}
                                </div>
                              )}
                              {candidate.experience_years && (
                                <div className="flex items-center gap-1">
                                  <Award className="w-4 h-4" />
                                  {candidate.experience_years} years
                                </div>
                              )}
                            </div>

                            {candidate.key_highlights && (
                              <p className="text-sm text-slate-700 mb-3 bg-purple-50 p-3 rounded-lg border border-purple-200">
                                💡 <strong>Summary:</strong> {candidate.key_highlights}
                              </p>
                            )}

                            {candidate.evidence?.strongest_match_quote && (
                              <div className="mb-3 bg-green-50 p-3 rounded-lg border border-green-200">
                                <p className="text-xs text-green-800">
                                  <strong>🎯 Strongest Evidence:</strong> "{candidate.evidence.strongest_match_quote}"
                                </p>
                              </div>
                            )}

                            {candidate.evidence?.biggest_gap && (
                              <div className="mb-3 bg-orange-50 p-3 rounded-lg border border-orange-200">
                                <p className="text-xs text-orange-800">
                                  <strong>⚠️ Biggest Gap:</strong> {candidate.evidence.biggest_gap}
                                </p>
                              </div>
                            )}

                            {/* Match Breakdown */}
                            {candidate.match_breakdown && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                <div className="bg-slate-50 rounded p-2 text-center flex flex-col justify-center items-center">
                                  <div className="text-xs text-slate-500 mb-1">Req. Skills</div>
                                  <div className="font-semibold text-slate-900">
                                    {typeof candidate.match_breakdown.required_skills === 'number' ? `${candidate.match_breakdown.required_skills}/40` : 'N/A'}
                                  </div>
                                </div>
                                <div className="bg-slate-50 rounded p-2 text-center flex flex-col justify-center items-center">
                                  <div className="text-xs text-slate-500 mb-1">Experience</div>
                                  <div className="font-semibold text-slate-900">
                                    {typeof candidate.match_breakdown.experience_level === 'number' ? `${candidate.match_breakdown.experience_level}/20` : 'N/A'}
                                  </div>
                                </div>
                                <div className="bg-slate-50 rounded p-2 text-center flex flex-col justify-center items-center">
                                  <div className="text-xs text-slate-500 mb-1">Domain</div>
                                  <div className="font-semibold text-slate-900">
                                    {typeof candidate.match_breakdown.domain_fit === 'number' ? `${candidate.match_breakdown.domain_fit}/15` : 'N/A'}
                                  </div>
                                </div>
                                <div className="bg-slate-50 rounded p-2 text-center flex flex-col justify-center items-center">
                                  <div className="text-xs text-slate-500 mb-1">Preferred</div>
                                  <div className="font-semibold text-slate-900">
                                    {typeof candidate.match_breakdown.preferred_skills === 'number' ? `${candidate.match_breakdown.preferred_skills}/15` : 'N/A'}
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {candidate.strengths && candidate.strengths.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    Key Strengths ({candidate.strengths.length})
                                  </h4>
                                  <ul className="space-y-1 list-disc list-inside">
                                    {candidate.strengths.map((strength, i) => (
                                      <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                                        <span className="text-green-600">✓</span>
                                        <span>{strength}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {candidate.concerns && candidate.concerns.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Concerns ({candidate.concerns.length})
                                  </h4>
                                  <ul className="space-y-1 list-disc list-inside">
                                    {candidate.concerns.map((concern, i) => (
                                      <li key={i} className="text-xs text-slate-700 flex items-start gap-2">
                                        <span className="text-orange-600">⚠</span>
                                        <span>{concern}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>

                            {candidate.disqualifying_factors && candidate.disqualifying_factors.length > 0 && (
                              <div className="mt-3 p-3 bg-red-50 border-2 border-red-300 rounded-lg">
                                <p className="text-xs font-semibold text-red-900 mb-1">⛔ Disqualifying Factors:</p>
                                <ul className="text-xs text-red-800 space-y-1 list-disc list-inside">
                                  {candidate.disqualifying_factors.map((factor, i) => (
                                    <li key={i}>{factor}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t">
                        <Link to={createPageUrl(`CandidateDetails?id=${candidate.id}`)} data-no-preview="true">
                          <Button size="sm" variant="outline">
                            View Profile
                          </Button>
                        </Link>
                        {candidate.resume_url && (
                          <a href={candidate.resume_url} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline">
                              View Resume
                            </Button>
                          </a>
                        )}
                        {candidate.recommended_action === 'interview' && (
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1">
                            Schedule Interview
                          </Button>
                        )}
                        {(candidate.recommended_action === 'phone_screen' || candidate.recommended_action === 'request_more_info') && (
                          <Button size="sm" variant="secondary" className="gap-1">
                            Follow Up
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
