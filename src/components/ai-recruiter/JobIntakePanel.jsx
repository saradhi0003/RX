import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";

export default function JobIntakePanel({ onJobParsed, loading, currentRun }) {
  const [method, setMethod] = useState("existing"); // existing | paste | file
  const [selectedJobId, setSelectedJobId] = useState("");
  const [jobText, setJobText] = useState("");
  const [jobs, setJobs] = useState([]);
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const data = await base44.entities.Job.list("-created_date", 50);
      setJobs(data);
    } catch (error) {
      console.error("Failed to load jobs:", error);
    }
  };

  const handleParseJob = async () => {
    const text = method === "existing" ? "" : jobText;
    const jobId = method === "existing" ? selectedJobId : null;

    if (!text && !jobId) {
      alert("Please select or paste a job description");
      return;
    }

    setParsing(true);
    try {
      const response = await base44.functions.invoke("aiRecruiterParseJob", {
        source: method === "existing" ? "app" : "manual",
        raw_text: text || "",
        job_id: jobId || null,
      });

      if (!response.success) {
        alert(`Error: ${response.error}`);
        return;
      }

      onJobParsed(response);
    } catch (error) {
      alert(`Error: ${error.message}`);
      console.error("Parse error:", error);
    } finally {
      setParsing(false);
    }
  };

  if (currentRun) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
            <span className="text-lg font-bold text-blue-600">✓</span>
          </div>
          <div>
            <h3 className="font-semibold">{currentRun.job?.title}</h3>
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
        {/* Method selector */}
        <div className="flex gap-2">
          <Button
            variant={method === "existing" ? "default" : "outline"}
            onClick={() => setMethod("existing")}
            size="sm"
          >
            Existing Job
          </Button>
          <Button
            variant={method === "paste" ? "default" : "outline"}
            onClick={() => setMethod("paste")}
            size="sm"
          >
            Paste Description
          </Button>
        </div>

        {/* Content */}
        {method === "existing" ? (
          <div>
            <label className="block text-sm font-medium mb-2">Select Job</label>
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a job..." />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title} • {job.location || "Remote"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-2">Paste Job Description</label>
            <Textarea
              placeholder="Paste your job description, email, or JD text here..."
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              className="h-40"
            />
            <p className="text-xs text-muted-foreground mt-2">
              AI will extract title, skills, requirements, location, rate, and more.
            </p>
          </div>
        )}

        {/* Parse button */}
        <Button
          onClick={handleParseJob}
          disabled={parsing || (method === "existing" ? !selectedJobId : !jobText.trim())}
          className="w-full"
        >
          {parsing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {parsing ? "Parsing..." : "Parse Job with AI"}
        </Button>
      </div>
    </Card>
  );
}