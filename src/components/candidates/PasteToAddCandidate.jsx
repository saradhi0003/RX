
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Loader2, ClipboardPaste, Sparkles } from "lucide-react";
import { Candidate } from "@/entities/Candidate";
import * as Core from "@/integrations/Core";
import { addNotification } from "@/components/notifications/NotificationToast";

export default function PasteToAddCandidate({ open, onClose, onSuccess }) {
  const [pastedText, setPastedText] = useState("");
  const [parsing, setParsing] = useState(false);

  const handleParse = async () => {
    if (!pastedText.trim()) {
      addNotification({
        type: "error",
        title: "Empty Text",
        message: "Please paste some candidate information first"
      });
      return;
    }

    setParsing(true);

    try {
      // Use AI to parse the pasted text into candidate fields
      const response = await Core.InvokeLLM({
        prompt: `You are an expert recruiter assistant. Parse the following candidate information and extract structured data.

CANDIDATE TEXT:
${pastedText}

Extract and return a JSON object with these fields:
- first_name (required)
- last_name (required)
- email (if mentioned)
- phone (if mentioned)
- location (current location/city)
- current_title (current job title)
- current_company (current employer)
- experience_years (estimate based on years of experience mentioned)
- skills (array of technical skills mentioned)
- summary (professional summary or bio)
- linkedin_url (if mentioned)
- work_authorization (US Citizen, H1B, etc. if mentioned)

Be intelligent about extracting:
- Names from the beginning of the text
- Email addresses and phone numbers
- Years of experience (e.g., "11+ years" → 11)
- Technical skills (languages, frameworks, tools)
- Current role and company
- Professional summary

If information is not available, omit the field or use null.`,
        response_json_schema: {
          type: "object",
          properties: {
            first_name: { type: "string" },
            last_name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            location: { type: "string" },
            current_title: { type: "string" },
            current_company: { type: "string" },
            experience_years: { type: "number" },
            skills: { type: "array", items: { type: "string" } },
            summary: { type: "string" },
            linkedin_url: { type: "string" },
            work_authorization: { type: "string" },
            status: { type: "string" }
          },
          required: ["first_name", "last_name"]
        }
      });

      // Check for duplicate by email before creating
      if (response.email) {
        const existing = await Candidate.filter({ 
          email: response.email.trim().toLowerCase() 
        });
        
        if (existing && existing.length > 0) {
          const duplicate = existing[0];
          const shouldUpdate = window.confirm(
            `A candidate with email "${response.email}" already exists:\n\n` +
            `${duplicate.first_name} ${duplicate.last_name}\n` +
            `Status: ${duplicate.status}\n` +
            `Added: ${new Date(duplicate.created_date).toLocaleDateString()}\n\n` +
            `Would you like to update the existing candidate with the new information?`
          );
          
          if (shouldUpdate) {
            // Update existing candidate
            await Candidate.update(duplicate.id, {
              ...response,
              notes: `${duplicate.notes || ""}\n\nUpdated from pasted text (${new Date().toLocaleString()}):\n${pastedText}`.trim()
            });
            
            addNotification({
              type: "success",
              title: "Candidate Updated",
              message: `${duplicate.first_name} ${duplicate.last_name} has been updated successfully`
            });
            
            onSuccess?.(duplicate);
            onClose();
            setParsing(false);
            return;
          } else {
            setParsing(false);
            return; // User cancelled
          }
        }
      }

      // Create new candidate (no duplicate found or user opted not to update)
      const candidateData = {
        ...response,
        notes: `Original pasted text:\n\n${pastedText}`,
        status: response.status || "active",
        source: "Pasted Text"
      };

      const newCandidate = await Candidate.create(candidateData);

      addNotification({
        type: "success",
        title: "Candidate Added",
        message: `${newCandidate.first_name} ${newCandidate.last_name} has been added successfully`
      });

      onSuccess?.(newCandidate);
      onClose();
    } catch (error) {
      console.error("Error parsing candidate text:", error);
      addNotification({
        type: "error",
        title: "Parsing Failed",
        message: "Could not parse candidate information. Please check the text and try again."
      });
    } finally {
      setParsing(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPastedText(text);
      addNotification({
        type: "success",
        title: "Text Pasted",
        message: "Clipboard content pasted successfully"
      });
    } catch (error) {
      addNotification({
        type: "error",
        title: "Paste Failed",
        message: "Could not read from clipboard. Please paste manually."
      });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Paste to Add Candidate</CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  Paste resume, bio, or candidate information and AI will extract the details
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto p-6 space-y-6">
          {/* Example */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-900 mb-2">💡 Example:</p>
            <p className="text-xs text-blue-800">
              Paste candidate information like: "John Doe is a Senior Software Engineer with 8+ years of experience in React, Node.js, and AWS. 
              Email: john@example.com, Phone: 555-1234. Currently working at Tech Corp in San Francisco..."
            </p>
          </div>

          {/* Paste Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Candidate Information
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePasteFromClipboard}
                className="gap-2"
              >
                <ClipboardPaste className="w-4 h-4" />
                Paste from Clipboard
              </Button>
            </div>
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste candidate resume, bio, or profile text here..."
              className="min-h-[300px] font-mono text-sm"
            />
            <p className="text-xs text-slate-500">
              {pastedText.length} characters • AI will automatically extract: name, email, phone, skills, experience, and more
            </p>
          </div>

          {/* Preview what will be extracted */}
          {pastedText && (
            <div className="p-4 bg-slate-50 border rounded-lg">
              <p className="text-sm font-medium text-slate-700 mb-2">
                ✨ AI will extract:
              </p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Contact Information (name, email, phone)</li>
                <li>• Current Role & Company</li>
                <li>• Years of Experience</li>
                <li>• Technical Skills</li>
                <li>• Professional Summary</li>
                <li>• Location & Work Authorization</li>
              </ul>
            </div>
          )}
        </CardContent>

        {/* Footer Actions */}
        <div className="border-t p-6">
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={parsing}>
              Cancel
            </Button>
            <Button
              onClick={handleParse}
              disabled={!pastedText.trim() || parsing}
              className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {parsing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Parsing with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Parse & Add Candidate
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
