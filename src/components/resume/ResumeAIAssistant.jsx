import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import * as Core from "@/integrations/Core";
import { Sparkles, Loader2, Wand2, Plus, Copy, CheckCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ResumeAIAssistant({ currentData, onApplyContent }) {
  const [activeMode, setActiveMode] = useState("summary");
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [applied, setApplied] = useState(false);

  // Summary generation inputs
  const [summaryInputs, setSummaryInputs] = useState({
    current_title: currentData?.headline || "",
    years_experience: "",
    key_skills: (currentData?.skills || []).join(", "),
    industry: "",
    tone: "professional"
  });

  // Experience generation inputs
  const [experienceInputs, setExperienceInputs] = useState({
    job_title: "",
    company: "",
    duration: "",
    key_achievements: "",
    tone: "professional"
  });

  // Project generation inputs
  const [projectInputs, setProjectInputs] = useState({
    project_name: "",
    technologies: "",
    your_role: "",
    impact: "",
    tone: "professional"
  });

  const generateSummary = async () => {
    setGenerating(true);
    setApplied(false);
    try {
      const prompt = `You are an expert resume writer specializing in compelling professional summaries.

**CANDIDATE DETAILS:**
- Current Title: ${summaryInputs.current_title}
- Years of Experience: ${summaryInputs.years_experience}
- Key Skills: ${summaryInputs.key_skills}
- Industry: ${summaryInputs.industry}
- Desired Tone: ${summaryInputs.tone}

**YOUR TASK:**
Write a compelling 3-4 sentence professional summary that:
1. Opens with a strong statement about their expertise/title
2. Highlights ${summaryInputs.years_experience} years of experience and core competencies
3. Emphasizes key technical/domain skills
4. Ends with their value proposition or career focus

**TONE GUIDELINES:**
- ${summaryInputs.tone === "formal" ? "Use formal, traditional corporate language. Avoid contractions." : ""}
- ${summaryInputs.tone === "professional" ? "Balanced professional tone. Clear and confident." : ""}
- ${summaryInputs.tone === "dynamic" ? "Use action-oriented, energetic language. Show enthusiasm." : ""}
- ${summaryInputs.tone === "technical" ? "Focus on technical depth. Use industry-specific terminology." : ""}

**EXAMPLE STRUCTURE (adapt to their details):**
"[Title] with [X] years of experience specializing in [key areas]. Proven expertise in [technical skills], with a track record of [value delivered]. Passionate about [career focus/goal]."

**OUTPUT FORMAT:**
{
  "summary": "Your 3-4 sentence summary here",
  "alternative_versions": [
    "Alternative version 1 with slightly different emphasis",
    "Alternative version 2 with different opening"
  ]
}`;

      const response = await Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            alternative_versions: { type: "array", items: { type: "string" } }
          }
        }
      });

      setGeneratedContent(response);
    } catch (error) {
      console.error("Error generating summary:", error);
      alert("Failed to generate summary. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const generateExperience = async () => {
    setGenerating(true);
    setApplied(false);
    try {
      const prompt = `You are an expert resume writer crafting impactful job experience descriptions.

**JOB DETAILS:**
- Job Title: ${experienceInputs.job_title}
- Company: ${experienceInputs.company}
- Duration: ${experienceInputs.duration}
- Key Achievements: ${experienceInputs.key_achievements}
- Desired Tone: ${experienceInputs.tone}

**YOUR TASK:**
Create a compelling job experience entry with 4-6 achievement-focused bullet points.

**BULLET POINT GUIDELINES:**
1. Start with strong action verbs (Led, Architected, Implemented, Drove, Optimized, Spearheaded)
2. Include quantified results whenever possible (%, $, time saved, users impacted)
3. Use the STAR format: Situation/Task + Action + Result
4. Focus on impact and outcomes, not just responsibilities
5. Highlight technical skills and leadership where applicable

**TONE ADAPTATION:**
- ${experienceInputs.tone === "formal" ? "Professional, traditional language. Third-person perspective." : ""}
- ${experienceInputs.tone === "leadership" ? "Emphasize team leadership, strategic decisions, stakeholder management." : ""}
- ${experienceInputs.tone === "technical" ? "Deep-dive into technical implementations, architectures, and technologies." : ""}
- ${experienceInputs.tone === "results" ? "Heavy focus on metrics, ROI, and quantified business impact." : ""}

**EXAMPLE BULLETS (adapt to their role):**
- "Led cross-functional team of 8 engineers to deliver [project], resulting in 40% performance improvement"
- "Architected and implemented [system] using [technologies], reducing latency by 60% and supporting 2M+ users"
- "Drove adoption of [practice/tool], improving team velocity by 35% and reducing bugs by 25%"

**OUTPUT FORMAT:**
{
  "bullets": [
    "First bullet point with strong action verb and quantified result",
    "Second bullet point focusing on technical achievement",
    "Third bullet point highlighting leadership or collaboration",
    "Fourth bullet point with business impact",
    "Fifth bullet point (optional)",
    "Sixth bullet point (optional)"
  ],
  "alternative_openers": [
    "Alternative opening for first bullet",
    "Another alternative opening"
  ]
}`;

      const response = await Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            bullets: { type: "array", items: { type: "string" } },
            alternative_openers: { type: "array", items: { type: "string" } }
          }
        }
      });

      setGeneratedContent(response);
    } catch (error) {
      console.error("Error generating experience:", error);
      alert("Failed to generate experience. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const generateProject = async () => {
    setGenerating(true);
    setApplied(false);
    try {
      const prompt = `You are an expert resume writer creating impactful project descriptions.

**PROJECT DETAILS:**
- Project Name: ${projectInputs.project_name}
- Technologies Used: ${projectInputs.technologies}
- Your Role: ${projectInputs.your_role}
- Impact/Results: ${projectInputs.impact}
- Desired Tone: ${projectInputs.tone}

**YOUR TASK:**
Create a compelling project description with 3-4 bullet points that showcase technical depth and impact.

**GUIDELINES:**
1. First bullet: Brief project overview and your role
2. Subsequent bullets: Technical implementation details, challenges solved, technologies used
3. Final bullet: Quantified impact or results
4. Emphasize: Architecture decisions, scale, complexity, innovation

**TONE ADAPTATION:**
- ${projectInputs.tone === "technical" ? "Deep technical details. Architecture, algorithms, system design." : ""}
- ${projectInputs.tone === "business" ? "Focus on business value, user impact, ROI." : ""}
- ${projectInputs.tone === "innovation" ? "Highlight novel approaches, cutting-edge tech, creative solutions." : ""}

**OUTPUT FORMAT:**
{
  "description": [
    "Brief project overview highlighting role and scope",
    "Technical implementation details with specific technologies",
    "Key challenge solved or innovative approach taken",
    "Quantified impact or results delivered"
  ],
  "suggested_skills": ["Skill1", "Skill2", "Skill3"]
}`;

      const response = await Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            description: { type: "array", items: { type: "string" } },
            suggested_skills: { type: "array", items: { type: "string" } }
          }
        }
      });

      setGeneratedContent(response);
    } catch (error) {
      console.error("Error generating project:", error);
      alert("Failed to generate project. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const applySummary = () => {
    if (generatedContent?.summary) {
      onApplyContent({ summary: generatedContent.summary });
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    }
  };

  const applyExperience = () => {
    if (generatedContent?.bullets) {
      const newExp = {
        role: experienceInputs.job_title,
        company: experienceInputs.company,
        start_date: experienceInputs.duration.split("-")[0]?.trim() || "",
        end_date: experienceInputs.duration.split("-")[1]?.trim() || "Present",
        bullets: generatedContent.bullets
      };
      onApplyContent({ 
        experiences: [...(currentData.experiences || []), newExp] 
      });
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    }
  };

  const applyProject = () => {
    if (generatedContent?.description) {
      const newProject = {
        name: projectInputs.project_name,
        date: new Date().getFullYear().toString(),
        description: generatedContent.description
      };
      onApplyContent({ 
        projects: [...(currentData.projects || []), newProject],
        skills: [...new Set([...(currentData.skills || []), ...(generatedContent.suggested_skills || [])])]
      });
      setApplied(true);
      setTimeout(() => setApplied(false), 2000);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="w-6 h-6 text-blue-600" />
          AI Resume Content Generator
        </CardTitle>
        <p className="text-sm text-slate-600 mt-2">
          Generate professional resume content with AI assistance
        </p>
      </CardHeader>

      <CardContent>
        <Tabs value={activeMode} onValueChange={setActiveMode} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="experience">Experience</TabsTrigger>
            <TabsTrigger value="project">Project</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Current Title</Label>
                <Input 
                  value={summaryInputs.current_title}
                  onChange={(e) => setSummaryInputs({...summaryInputs, current_title: e.target.value})}
                  placeholder="e.g., Senior Software Engineer"
                />
              </div>
              <div>
                <Label>Years of Experience</Label>
                <Input 
                  value={summaryInputs.years_experience}
                  onChange={(e) => setSummaryInputs({...summaryInputs, years_experience: e.target.value})}
                  placeholder="e.g., 5+"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Key Skills (comma-separated)</Label>
                <Input 
                  value={summaryInputs.key_skills}
                  onChange={(e) => setSummaryInputs({...summaryInputs, key_skills: e.target.value})}
                  placeholder="e.g., React, Node.js, AWS, Microservices"
                />
              </div>
              <div>
                <Label>Industry/Domain</Label>
                <Input 
                  value={summaryInputs.industry}
                  onChange={(e) => setSummaryInputs({...summaryInputs, industry: e.target.value})}
                  placeholder="e.g., FinTech, Healthcare, E-commerce"
                />
              </div>
              <div>
                <Label>Tone</Label>
                <select 
                  className="w-full border rounded px-3 py-2"
                  value={summaryInputs.tone}
                  onChange={(e) => setSummaryInputs({...summaryInputs, tone: e.target.value})}
                >
                  <option value="professional">Professional</option>
                  <option value="formal">Formal</option>
                  <option value="dynamic">Dynamic</option>
                  <option value="technical">Technical</option>
                </select>
              </div>
            </div>

            <Button 
              onClick={generateSummary} 
              disabled={generating || !summaryInputs.current_title}
              className="w-full gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Professional Summary
                </>
              )}
            </Button>

            {generatedContent?.summary && activeMode === "summary" && (
              <div className="space-y-3 mt-4">
                <div className="p-4 bg-white rounded-lg border-2 border-blue-300">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-slate-900">Generated Summary</h4>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(generatedContent.summary)}>
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button size="sm" onClick={applySummary} className="gap-1">
                        {applied ? <CheckCircle className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        {applied ? "Applied!" : "Apply"}
                      </Button>
                    </div>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{generatedContent.summary}</p>
                </div>

                {generatedContent.alternative_versions?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Alternative Versions:</h4>
                    <div className="space-y-2">
                      {generatedContent.alternative_versions.map((alt, i) => (
                        <div key={i} className="p-3 bg-white rounded border">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-slate-700 flex-1">{alt}</p>
                            <Button size="sm" variant="ghost" onClick={() => copyToClipboard(alt)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Experience Tab */}
          <TabsContent value="experience" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Job Title</Label>
                <Input 
                  value={experienceInputs.job_title}
                  onChange={(e) => setExperienceInputs({...experienceInputs, job_title: e.target.value})}
                  placeholder="e.g., Senior Backend Engineer"
                />
              </div>
              <div>
                <Label>Company</Label>
                <Input 
                  value={experienceInputs.company}
                  onChange={(e) => setExperienceInputs({...experienceInputs, company: e.target.value})}
                  placeholder="e.g., Tech Corp"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Duration</Label>
                <Input 
                  value={experienceInputs.duration}
                  onChange={(e) => setExperienceInputs({...experienceInputs, duration: e.target.value})}
                  placeholder="e.g., Jan 2020 - Present"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Key Achievements (brief notes)</Label>
                <Textarea 
                  rows={3}
                  value={experienceInputs.key_achievements}
                  onChange={(e) => setExperienceInputs({...experienceInputs, key_achievements: e.target.value})}
                  placeholder="e.g., Led team of 5, built microservices platform, reduced costs by 30%"
                />
              </div>
              <div>
                <Label>Emphasis</Label>
                <select 
                  className="w-full border rounded px-3 py-2"
                  value={experienceInputs.tone}
                  onChange={(e) => setExperienceInputs({...experienceInputs, tone: e.target.value})}
                >
                  <option value="professional">Balanced</option>
                  <option value="leadership">Leadership</option>
                  <option value="technical">Technical</option>
                  <option value="results">Results-Driven</option>
                </select>
              </div>
            </div>

            <Button 
              onClick={generateExperience} 
              disabled={generating || !experienceInputs.job_title}
              className="w-full gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Experience Bullets
                </>
              )}
            </Button>

            {generatedContent?.bullets && activeMode === "experience" && (
              <div className="space-y-3 mt-4">
                <div className="p-4 bg-white rounded-lg border-2 border-blue-300">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-semibold text-slate-900">Generated Bullets</h4>
                    <Button size="sm" onClick={applyExperience} className="gap-1">
                      {applied ? <CheckCircle className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {applied ? "Applied!" : "Add to Resume"}
                    </Button>
                  </div>
                  <ul className="space-y-2">
                    {generatedContent.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-600 font-bold">•</span>
                        <span className="flex-1 text-slate-700">{bullet}</span>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(bullet)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>

                {generatedContent.alternative_openers?.length > 0 && (
                  <div className="p-3 bg-white rounded border">
                    <h4 className="text-xs font-semibold text-slate-600 mb-2">Alternative Openers:</h4>
                    <div className="space-y-1">
                      {generatedContent.alternative_openers.map((alt, i) => (
                        <p key={i} className="text-xs text-slate-600">• {alt}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Project Tab */}
          <TabsContent value="project" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label>Project Name</Label>
                <Input 
                  value={projectInputs.project_name}
                  onChange={(e) => setProjectInputs({...projectInputs, project_name: e.target.value})}
                  placeholder="e.g., Real-time Analytics Dashboard"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Technologies Used</Label>
                <Input 
                  value={projectInputs.technologies}
                  onChange={(e) => setProjectInputs({...projectInputs, technologies: e.target.value})}
                  placeholder="e.g., React, Node.js, PostgreSQL, Redis, AWS"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Your Role</Label>
                <Input 
                  value={projectInputs.your_role}
                  onChange={(e) => setProjectInputs({...projectInputs, your_role: e.target.value})}
                  placeholder="e.g., Lead Developer, Full-Stack Engineer"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Impact/Results</Label>
                <Textarea 
                  rows={2}
                  value={projectInputs.impact}
                  onChange={(e) => setProjectInputs({...projectInputs, impact: e.target.value})}
                  placeholder="e.g., Improved query speed by 10x, supported 100k users"
                />
              </div>
              <div>
                <Label>Focus</Label>
                <select 
                  className="w-full border rounded px-3 py-2"
                  value={projectInputs.tone}
                  onChange={(e) => setProjectInputs({...projectInputs, tone: e.target.value})}
                >
                  <option value="technical">Technical Depth</option>
                  <option value="business">Business Impact</option>
                  <option value="innovation">Innovation</option>
                </select>
              </div>
            </div>

            <Button 
              onClick={generateProject} 
              disabled={generating || !projectInputs.project_name}
              className="w-full gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Project Description
                </>
              )}
            </Button>

            {generatedContent?.description && activeMode === "project" && (
              <div className="space-y-3 mt-4">
                <div className="p-4 bg-white rounded-lg border-2 border-blue-300">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-semibold text-slate-900">Generated Project</h4>
                    <Button size="sm" onClick={applyProject} className="gap-1">
                      {applied ? <CheckCircle className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {applied ? "Applied!" : "Add to Resume"}
                    </Button>
                  </div>
                  <ul className="space-y-2">
                    {generatedContent.description.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-600 font-bold">•</span>
                        <span className="flex-1 text-slate-700">{bullet}</span>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(bullet)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>

                {generatedContent.suggested_skills?.length > 0 && (
                  <div className="p-3 bg-white rounded border">
                    <h4 className="text-xs font-semibold text-slate-600 mb-2">Suggested Skills to Add:</h4>
                    <div className="flex flex-wrap gap-2">
                      {generatedContent.suggested_skills.map((skill, i) => (
                        <Badge key={i} variant="outline">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}