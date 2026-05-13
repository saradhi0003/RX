import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Job } from "@/entities/Job";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

/** @param {{ onJobParsed: Function, currentRun: any }} props */
export default function JobIntakePanel({ onJobParsed, currentRun }) {
  const [method, setMethod] = useState("existing");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobText, setJobText] = useState("");
  const [jobs, setJobs] = useState(/** @type {any[]} */ ([]));
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  useEffect(() => {
    Job.list("-created_at", 100).then(setJobs).catch(console.error);
  }, []);

  const handleParseJob = async () => {
    setParseError("");

    if (method === "existing") {
      if (!selectedJobId) { setParseError("Please select a job"); return; }
      const job = jobs.find((j) => j.id === selectedJobId);
      onJobParsed({ id: null, job });
      return;
    }

    if (!jobText.trim()) { setParseError("Please paste a job description"); return; }

    setParsing(true);
    try {
      const { data, error } = await supabase.functions.invoke("aiRecruiterParseJob", {
        body: { job_description: jobText, source: "manual" },
      });
      if (error) throw error;

      // Build a synthetic job object from the parsed data for immediate use
      const syntheticJob = { id: data.job_id, ...data.parsed };
      onJobParsed({ id: data.run_id, job: syntheticJob });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Parsing failed");
    } finally {
      setParsing(false);
    }
  };

  if (currentRun) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
            ✓
          </div>
          <div>
            <p className="font-semibold">{currentRun.job?.title}</p>
            <p className="text-sm text-muted-foreground">{currentRun.job?.location}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">Step 1: Select or Import Job</h2>

      <div className="space-y-4">
        <div className="flex gap-2">
          <Button variant={method === "existing" ? "default" : "outline"} size="sm" onClick={() => setMethod("existing")}>
            Existing Job
          </Button>
          <Button variant={method === "paste" ? "default" : "outline"} size="sm" onClick={() => setMethod("paste")}>
            Paste Description
          </Button>
        </div>

        {method === "existing" ? (
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger><SelectValue placeholder="Choose a job..." /></SelectTrigger>
            <SelectContent>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.title} • {job.location || "Remote"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div>
            <Textarea
              placeholder="Paste your job description here — AI will extract title, skills, requirements, salary…"
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              className="h-40"
            />
            <p className="text-xs text-muted-foreground mt-1">
              AI will structure this into a job record automatically.
            </p>
          </div>
        )}

        {parseError && <p className="text-sm text-red-600">{parseError}</p>}

        <Button
          onClick={handleParseJob}
          disabled={parsing || (method === "existing" ? !selectedJobId : !jobText.trim())}
          className="w-full"
        >
          {parsing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {parsing ? "Parsing…" : method === "existing" ? "Use Selected Job" : "Parse Job with AI"}
        </Button>
      </div>
    </Card>
  );
}
