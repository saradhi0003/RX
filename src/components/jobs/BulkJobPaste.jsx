import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Loader2, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { Company } from "@/entities/Company";
import { Job } from "@/entities/Job";
import { addNotification } from "@/components/notifications/NotificationToast";

// Extract emails from text
function extractEmails(text) {
  const emailRegex = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,})/gi;
  const matches = text.match(emailRegex);
  return matches ? [...new Set(matches.map(e => e.toLowerCase()))] : [];
}

// Extract name from "send resumes to:" pattern
function extractContactName(text) {
  const namePattern = /(?:send\s+resumes?\s+to|contact|reach\s+out\s+to)[:\s]+([^@\n,]+?)(?=[@\n,]|$)/i;
  const match = text.match(namePattern);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

// Parse job requirement text using patterns
function parseJobRequirement(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  const job = {
    title: "",
    location: "",
    experience_required: null,
    description: text, // Store complete text as description
    requirements: text, // Also store in requirements
    employment_type: "full_time",
    remote_type: "onsite",
    status: "draft",
    priority: "medium",
    requester_email: null,
    requester_name: null,
    required_skills: [],
    rate: ""
  };

  // Extract emails and contact info
  const emails = extractEmails(text);
  if (emails.length > 0) {
    job.requester_email = emails[0]; // Use first email found
    const contactName = extractContactName(text);
    if (contactName) {
      job.requester_name = contactName;
    }
  }

  // Parse title (usually first line or "Job Title:" pattern)
  const titlePattern = /(?:job\s+title|position|role)[:\s]+(.+)/i;
  const titleMatch = text.match(titlePattern);
  if (titleMatch) {
    job.title = titleMatch[1].trim();
  } else if (lines.length > 0) {
    // Use first non-empty line as title if no pattern found
    job.title = lines[0].replace(/^[:\-–—]\s*/, '').trim();
  }

  // Parse location
  const locationPattern = /(?:location|place)[:\s]+(.+?)(?=\n|$|\.)/i;
  const locationMatch = text.match(locationPattern);
  if (locationMatch) {
    job.location = locationMatch[1].trim();
    
    // Detect remote type from location
    const locLower = job.location.toLowerCase();
    if (locLower.includes('remote')) job.remote_type = 'remote';
    else if (locLower.includes('hybrid')) job.remote_type = 'hybrid';
  }

  // Parse years of experience
  const expPattern = /(?:experience|years?)[:\s]+(\d+)/i;
  const expMatch = text.match(expPattern);
  if (expMatch) {
    job.experience_required = parseInt(expMatch[1]);
  }

  // Parse rate/salary
  const ratePattern = /(?:rate|salary|compensation|pay)[:\s]+([^\n]+)/i;
  const rateMatch = text.match(ratePattern);
  if (rateMatch) {
    job.rate = rateMatch[1].trim();
  }

  // Extract skills (look for common keywords)
  const skillKeywords = [
    'java', 'python', 'javascript', 'react', 'angular', 'vue', 'node',
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'sql', 'nosql',
    'workday', 'salesforce', 'sap', 'oracle', 'finance', 'hr', 'scrum',
    'agile', 'devops', 'ci/cd', 'microservices', 'rest', 'api'
  ];
  
  const textLower = text.toLowerCase();
  const foundSkills = skillKeywords.filter(skill => 
    textLower.includes(skill.toLowerCase())
  );
  
  if (foundSkills.length > 0) {
    job.required_skills = foundSkills.map(s => 
      s.charAt(0).toUpperCase() + s.slice(1)
    );
  }

  return job;
}

export default function BulkJobPaste({ open, onClose, onSuccess, companies }) {
  const [pastedText, setPastedText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState(null);

  const handleParse = () => {
    if (!pastedText.trim()) {
      addNotification({ type: "warning", message: "Please paste job requirement text" });
      return;
    }

    try {
      const parsed = parseJobRequirement(pastedText);
      setPreview(parsed);
    } catch (error) {
      console.error("Error parsing job:", error);
      addNotification({ type: "error", message: "Failed to parse job requirement" });
    }
  };

  const handleCreate = async () => {
    if (!preview) return;

    setProcessing(true);
    try {
      // Find or create default company
      let companyId = null;
      if (companies && companies.length > 0) {
        const defaultCompany = companies.find(c => 
          c.name.toLowerCase().includes('talentstack') || 
          c.name.toLowerCase().includes('default')
        );
        if (defaultCompany) {
          companyId = defaultCompany.id;
        } else {
          companyId = companies[0].id; // Use first company
        }
      }

      if (!companyId) {
        // Create default company if none exists
        const newCompany = await Company.create({
          name: "TalentStack",
          status: "active",
          type: "internal"
        });
        companyId = newCompany.id;
      }

      const jobData = {
        ...preview,
        company_id: companyId
      };

      // Create the job
      const createdJob = await Job.create(jobData);

      // If we have requester email, create/update company contact
      if (preview.requester_email && companyId) {
        try {
          const company = await Company.get(companyId);
          const existingContacts = company.contacts || [];
          
          // Check if contact already exists
          const existingContact = existingContacts.find(c => 
            c.email?.toLowerCase() === preview.requester_email.toLowerCase()
          );

          if (!existingContact) {
            // Add new contact
            const newContact = {
              name: preview.requester_name || preview.requester_email.split('@')[0],
              email: preview.requester_email,
              is_primary: existingContacts.length === 0
            };
            
            await Company.update(companyId, {
              contacts: [...existingContacts, newContact]
            });

            addNotification({ 
              type: "success", 
              message: `Contact ${newContact.name} added to company` 
            });
          }
        } catch (error) {
          console.error("Error updating company contacts:", error);
          // Don't fail job creation if contact update fails
        }
      }

      addNotification({ 
        type: "success", 
        title: "Job Created", 
        message: `"${createdJob.title}" has been created successfully` 
      });

      onSuccess?.();
      handleReset();
    } catch (error) {
      console.error("Error creating job:", error);
      addNotification({ 
        type: "error", 
        message: "Failed to create job: " + error.message 
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setPastedText("");
    setPreview(null);
    onClose?.();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Bulk Job Requirements Upload
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleReset}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {!preview ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Paste Job Requirement
                </label>
                <Textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste complete job requirement here...&#10;&#10;Example:&#10;Job Title: Sr. Workday Solution Architect&#10;Location: Atlanta, Georgia (Hybrid)&#10;Year of experience - 15 Years&#10;Description...&#10;&#10;Please send resumes to: email@example.com"
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleReset}>
                  Cancel
                </Button>
                <Button onClick={handleParse} className="gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Parse & Preview
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div className="flex-1">
                    <p className="font-medium text-green-900">Job Parsed Successfully</p>
                    <p className="text-sm text-green-700">Review the extracted information below</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-slate-50">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Job Title</label>
                    <p className="text-sm font-medium text-slate-900">{preview.title || "—"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Location</label>
                    <p className="text-sm text-slate-900">{preview.location || "—"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Experience Required</label>
                    <p className="text-sm text-slate-900">
                      {preview.experience_required ? `${preview.experience_required} years` : "—"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Remote Type</label>
                    <Badge>{preview.remote_type}</Badge>
                  </div>
                  {preview.rate && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Rate/Salary</label>
                      <p className="text-sm text-slate-900">{preview.rate}</p>
                    </div>
                  )}
                  {preview.requester_email && (
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-slate-600">Contact Information</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-blue-100 text-blue-800">
                          {preview.requester_name || "Contact"}
                        </Badge>
                        <span className="text-sm text-slate-600">{preview.requester_email}</span>
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        ✓ Will be added as company contact
                      </p>
                    </div>
                  )}
                  {preview.required_skills?.length > 0 && (
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-slate-600">Detected Skills</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {preview.required_skills.map((skill, idx) => (
                          <Badge key={idx} variant="outline">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600">Full Description</label>
                  <div className="mt-1 p-3 border rounded bg-white text-sm text-slate-700 max-h-48 overflow-auto whitespace-pre-wrap">
                    {preview.description}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    ✓ Complete requirement saved to description field
                  </p>
                </div>

                {!preview.requester_email && (
                  <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <p className="text-sm text-yellow-800">
                      No email address detected. Consider adding contact information manually.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setPreview(null)}>
                  Back to Edit
                </Button>
                <Button 
                  onClick={handleCreate} 
                  disabled={processing}
                  className="gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Job...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Create Job
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}