import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";

export default function EmailDraftReview({
  job,
  selectedCount,
  draft,
  loading,
  onGenerateDraft,
}) {
  const [draftType, setDraftType] = useState("client_submission");
  const [tone, setTone] = useState("professional");
  const [editedSubject, setEditedSubject] = useState(draft?.subject || "");
  const [editedBody, setEditedBody] = useState(draft?.body || "");

  const handleGenerate = () => {
    onGenerateDraft(draftType, tone);
  };

  const draftTypeDescriptions = {
    client_submission: "Email to hiring manager presenting candidate(s)",
    candidate_outreach: "Personalized email to candidate about opportunity",
    follow_up: "Brief follow-up email",
    internal_note: "Internal team note",
  };

  if (draft && draft.status !== "draft") {
    return (
      <Card className="p-6">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Draft {draft.status}</h3>
            <p className="text-sm text-muted-foreground">
              This draft has been {draft.status}. Generate a new draft to continue.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (!draft) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Step 3: Generate Email Draft</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email Type</label>
            <Select value={draftType} onValueChange={setDraftType} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client_submission">Client Submission</SelectItem>
                <SelectItem value="candidate_outreach">Candidate Outreach</SelectItem>
                <SelectItem value="follow_up">Follow-up Email</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {draftTypeDescriptions[draftType]}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Tone</label>
            <Select value={tone} onValueChange={setTone} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="concise">Concise</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <p className="text-blue-900">
              Generating email for {selectedCount} candidate{selectedCount !== 1 ? "s" : ""} applying to{" "}
              <strong>{job.title}</strong>
            </p>
          </div>

          <Button onClick={handleGenerate} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {loading ? "Generating..." : "Generate Draft with AI"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-bold mb-4">Step 4: Review & Edit Email</h2>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-900 flex gap-2">
        <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>This is an AI-generated draft. Please review before approving.</span>
      </div>

      <Tabs defaultValue="preview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="space-y-4 mt-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Subject</h4>
            <p className="font-semibold text-foreground">{draft.subject}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Body</h4>
            <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap text-foreground">
              {draft.body}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            <p>Draft Type: <span className="font-medium">{draft.draft_type}</span></p>
            <p>Model: <span className="font-medium">{draft.model_used}</span></p>
          </div>
        </TabsContent>

        <TabsContent value="edit" className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium mb-2">Subject</label>
            <Input
              value={editedSubject || draft.subject}
              onChange={(e) => setEditedSubject(e.target.value)}
              placeholder="Email subject"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Body</label>
            <Textarea
              value={editedBody || draft.body}
              onChange={(e) => setEditedBody(e.target.value)}
              placeholder="Email body"
              className="h-64 font-mono text-sm"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Changes here will be saved when you approve the draft.
          </p>
        </TabsContent>
      </Tabs>
    </Card>
  );
}