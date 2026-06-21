
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Upload, Target, CheckCircle2, Loader2, Plus, X } from "lucide-react";
import { InvokeLLM, UploadFile, ExtractDataFromUploadedFile } from "@/integrations/Core";
import { computeScore } from "@/components/common/scoring";
import JDResumeCompare from "./JDResumeCompare";
import ResumeLLMBuilder from "./ResumeLLMBuilder";

export default function ResumeScorer({ data, setData }) {
  const [jdText, setJdText] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [requiredSkills, setRequiredSkills] = useState([]);
  const [excluded, setExcluded] = useState([]);
  const [loadingExtract, setLoadingExtract] = useState(false);
  const [loadingJD, setLoadingJD] = useState(false);
  const [resumeNotice, setResumeNotice] = useState("");
  const [jdNotice, setJdNotice] = useState("");

  const filteredRequired = useMemo(
    () => requiredSkills.filter(s => !excluded.includes(s)),
    [requiredSkills, excluded]
  );

  const score = useMemo(() => {
    return computeScore({ resumeData: data, resumeText, jdText, requiredSkills: filteredRequired });
  }, [data, resumeText, jdText, filteredRequired]);

  useEffect(() => {
    // If user edits skills inline, rescore automatically (handled by useMemo)
  }, [data]);

  // Helper to use current editor content for scoring clarity
  const useEditorForScoring = () => {
    const combined = [
      data?.headline,
      data?.summary,
      (data?.skills || []).join(" "),
      ...(data?.experiences || []).map(e => [e.role, e.company, (e.bullets || []).join(" ")].filter(Boolean).join(" ")),
      ...(data?.education || []).map(e => [e.school, e.degree, e.major].filter(Boolean).join(" ")),
      ...(data?.projects || []).map(p => [p.name, (p.description || []).join(" ")].filter(Boolean).join(" "))
    ].filter(Boolean).join("\n\n"); // Use double newline for better separation
    setResumeText(combined);
  };

  const addMultipleSkills = (skills) => {
    if (!skills?.length) return;
    const currentSkills = new Set(data.skills || []);
    const toAdd = skills.filter(s => !currentSkills.has(s));
    if (!toAdd.length) return;
    setData(prev => ({ ...prev, skills: [ ...(prev.skills || []), ...toAdd ] }));
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const canParse = ["pdf", "png", "jpg", "jpeg"].includes(ext);

    if (!canParse) {
      setResumeNotice("Uploaded file detected as DOC/DOCX/TXT. Auto-extract is supported for PDF/images only. Please paste text manually.");
      // Clear the file input value to allow re-uploading the same file after an error
      e.target.value = ''; 
      return;
    }

    setResumeNotice(""); // Clear previous notice if a valid file type is selected
    setLoadingExtract(true);
    try {
      const { file_url } = await UploadFile({ file });
      const parsed = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: { full_text: { type: "string" } }
        }
      });
      if (parsed.status === "success" && parsed.output?.full_text) {
        setResumeText(parsed.output.full_text);
        setResumeNotice(""); // Clear notice on successful extraction
      } else {
        setResumeNotice("Upload succeeded but text could not be extracted. Please paste text manually.");
      }
    } catch (error) {
      console.error("Resume upload/extraction error:", error);
      setResumeNotice("An error occurred during text extraction. Please try again or paste text manually.");
    } finally {
      setLoadingExtract(false);
      e.target.value = ''; // Clear the file input value after processing
    }
  };

  const handleJDUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const canParse = ["pdf", "png", "jpg", "jpeg"].includes(ext);

    if (!canParse) {
      setJdNotice("Uploaded file detected as DOC/DOCX/TXT. Auto-extract is supported for PDF/images only. Please paste JD text manually.");
      // Clear the file input value to allow re-uploading the same file after an error
      e.target.value = '';
      return;
    }

    setJdNotice(""); // Clear previous notice if a valid file type is selected
    setLoadingJD(true);
    try {
      const { file_url } = await UploadFile({ file });
      const parsed = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: { full_text: { type: "string" } }
        }
      });
      if (parsed.status === "success" && parsed.output?.full_text) {
        setJdText(parsed.output.full_text);
        setJdNotice(""); // Clear notice on successful extraction
      } else {
        setJdNotice("Upload succeeded but text could not be extracted. Please paste JD text manually.");
      }
    } catch (error) {
      console.error("JD upload/extraction error:", error);
      setJdNotice("An error occurred during text extraction. Please try again or paste JD text manually.");
    } finally {
      setLoadingJD(false);
      e.target.value = ''; // Clear the file input value after processing
    }
  };

  const extractRequiredFromJD = async () => {
    if (!jdText.trim()) return;
    const res = await InvokeLLM({
      prompt: `From the following job description, list the top 20 required hard skills/technologies as an array of strings only, no explanations.\n\nJD:\n${jdText}\n\nReturn JSON.`,
      response_json_schema: {
        type: "object",
        properties: { skills: { type: "array", items: { type: "string" } } }
      }
    });
    const skills = (res?.skills || []).map(s => s.trim()).filter(Boolean);
    setRequiredSkills(Array.from(new Set(skills)));
  };

  const addSkillToResume = (skill) => {
    if (!skill) return;
    if ((data.skills || []).includes(skill)) return;
    setData(prev => ({ ...prev, skills: [ ...(prev.skills || []), skill ] }));
  };

  return (
    <div className="space-y-4">
      {/* Inputs section: much taller to cover screen vertically */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Job Description & Resume Inputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Job Description</span>
                <label className="text-xs text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleJDUpload} />
                  Upload JD
                </label>
              </div>
              {jdNotice && <p className="text-xs text-amber-600 mt-1">{jdNotice}</p>}
              <Textarea
                rows={18}
                className="min-h-[40vh] md:min-h-[60vh]"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                placeholder="Paste job description..."
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Resume (Text extraction for scoring)</span>
                <label className="text-xs text-blue-600 hover:underline cursor-pointer flex items-center gap-1">
                  <Upload className="w-3 h-3" />
                  <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleResumeUpload} />
                  Upload Resume
                </label>
              </div>
              {resumeNotice && <p className="text-xs text-amber-600 mt-1">{resumeNotice}</p>}
              <Textarea
                rows={18}
                className="min-h-[40vh] md:min-h-[60vh]"
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Optional: paste resume text; the visual resume editor is on the left."
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={extractRequiredFromJD} disabled={!jdText.trim()}>
              {loadingJD ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Target className="w-4 h-4 mr-2" />}
              Extract Required Skills
            </Button>
            <Badge variant="outline">Required: {requiredSkills.length}</Badge>
            <Badge variant="outline">Excluded: {excluded.length}</Badge>
            <div className="flex-1" />
            <Button size="sm" variant="outline" onClick={useEditorForScoring}>
              Use editor content for scoring
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setJdText(""); setResumeText(""); }}>
              Clear inputs
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live Score and JD vs Resume side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Live Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold">{score.overall_score}</div>
              <div className="flex-1">
                <Progress value={score.overall_score} />
                <p className="text-xs text-slate-500 mt-1">Target 75–80%+</p>
              </div>
              {score.overall_score >= 75 ? (
                <Badge className="bg-green-100 text-green-800">Good Fit</Badge>
              ) : (
                <Badge className="bg-yellow-100 text-yellow-800">Needs Improvement</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Breakdown label="Hard Skills" value={score.category_scores.hard_skills} />
              <Breakdown label="Soft Skills" value={score.category_scores.soft_skills} />
              <Breakdown label="Education" value={score.category_scores.education} />
              <Breakdown label="Job Title" value={score.category_scores.job_titles} />
              <Breakdown label="Other" value={score.category_scores.other_keywords} />
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Missing High-Priority Skills</p>
              <div className="flex flex-wrap gap-2">
                {score.missing_hard_skills.length === 0 && <span className="text-xs text-slate-500">No high-priority gaps detected.</span>}
                {score.missing_hard_skills.map((s) => (
                  <div key={s} className="flex items-center gap-1 border rounded-full pl-2 pr-1 py-1">
                    <span className="text-xs">{s}</span>
                    <Button size="xs" variant="secondary" onClick={() => addSkillToResume(s)}>
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => setExcluded(prev => [...prev, s])}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {filteredRequired.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Required Skill Set (click to add/remove)</p>
                <div className="flex flex-wrap gap-2">
                  {filteredRequired.map((s) => {
                    const has = (data.skills || []).includes(s);
                    return (
                      <Button
                        key={s}
                        variant={has ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => has ? setData(prev => ({ ...prev, skills: prev.skills.filter(x => x !== s) })) : addSkillToResume(s)}
                      >
                        {has ? <CheckCircle2 className="w-3 h-3 mr-1" /> : null}{s}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <JDResumeCompare
          jdText={jdText}
          resumeText={resumeText}
          data={data}
          requiredSkills={filteredRequired}
          onAddSkill={addMultipleSkills}
        />
      </div>

      {/* AI Resume Builder remains below */}
      <ResumeLLMBuilder
        jdText={jdText}
        resumeText={resumeText}
        currentData={data}
        onApply={(draft) => setData(prev => ({ ...prev, ...draft }))}
      />
    </div>
  );
}

function Breakdown({ label, value }) {
  return (
    <div className="p-2 rounded border">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold">{value}%</div>
      <Progress className="h-1 mt-1" value={value} />
    </div>
  );
}
