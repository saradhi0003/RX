
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Upload, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadFile, ExtractDataFromUploadedFile, InvokeLLM } from "@/integrations/Core";
import { Candidate } from "@/entities/all";
import { addNotification } from "@/components/notifications/NotificationToast";

export default function CandidateForm({ candidate, onSave, onCancel }) {
  const [formData, setFormData] = useState(candidate || {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    location: "",
    linkedin_url: "",
    current_title: "",
    current_company: "",
    experience_years: "",
    salary_expectation: "",
    availability: "negotiable",
    status: "active",
    work_authorization: "",
    skills: [],
    tags: [],
    notes: "",
    source: "",
    addedExperience: "" // NEW FIELD
  });

  const [newSkill, setNewSkill] = useState("");
  const [newTag, setNewTag] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateCandidate, setDuplicateCandidate] = useState(null);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill("");
    }
  };

  const removeSkill = (skillToRemove) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const checkForDuplicate = async (email) => {
    if (!email || !email.trim()) return null;
    
    try {
      const existing = await Candidate.filter({ email: email.trim().toLowerCase() });
      if (existing && existing.length > 0) {
        // If editing current candidate, don't flag as duplicate if it's the same candidate
        if (candidate && existing[0].id === candidate.id) {
          return null;
        }
        return existing[0];
      }
      return null;
    } catch (error) {
      console.error("Error checking for duplicate:", error);
      // In case of error, treat as no duplicate found to allow submission
      return null;
    }
  };

  // Check for duplicates when email changes (debounced)
  useEffect(() => {
    // Only check for new candidates, not when editing an existing one
    if (candidate) {
      setDuplicateCandidate(null); // Clear any previous duplicate state if we switch to editing
      return; 
    }

    const email = formData.email?.trim();
    if (!email) {
      setDuplicateCandidate(null);
      return;
    }
    
    setCheckingDuplicate(true);
    const timer = setTimeout(async () => {
      const duplicate = await checkForDuplicate(email);
      setDuplicateCandidate(duplicate);
      setCheckingDuplicate(false);
    }, 500); // Debounce
    
    return () => {
      clearTimeout(timer);
      setCheckingDuplicate(false); // Ensure loading state is cleared if component unmounts or email changes again quickly
    };
  }, [formData.email, candidate]);

  const handleResumeUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadError("");
    setIsUploading(true);
    setIsParsing(false); // default false; we only set true if we'll parse

    try {
      // Upload the file first so we always keep it
      const { file_url } = await UploadFile({ file });

      // Always attach the resume URL
      setFormData((prev) => ({ ...prev, resume_url: file_url }));

      // Determine extraction method based on file type
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const isPDF = ext === "pdf";
      const isImage = ["png", "jpg", "jpeg"].includes(ext);
      const isWordDoc = ["doc", "docx"].includes(ext);

      // IMPORTANT: Only PDFs and images support AI extraction
      // Word documents cannot be parsed by our AI integrations
      if (isWordDoc) {
        setUploadError("✅ Resume uploaded successfully. Word documents require manual data entry. For auto-fill, please upload a PDF version.");
        setIsUploading(false);
        return;
      }

      // Try AI extraction for PDFs and images only
      if (!isPDF && !isImage) {
        setUploadError("✅ Resume uploaded successfully. Auto-fill is only available for PDF and image files.");
        setIsUploading(false);
        return;
      }

      setIsParsing(true);
      let parseResult;
      let extractionFailed = false;

      try {
        // Only PDFs and images reach here for AI extraction
        const extractionPromise = ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
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
              work_authorization: { type: "string" }
            }
          }
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Extraction timeout')), 45000)
        );

        parseResult = await Promise.race([extractionPromise, timeoutPromise]);
      } catch (parseError) {
        extractionFailed = true;
        console.warn("AI extraction failed:", parseError.message);
      }

      setIsParsing(false);

      // If extraction failed or returned no data
      if (extractionFailed || !parseResult || parseResult?.status !== "success" || !parseResult.output) {
        setUploadError("✅ Resume uploaded successfully, but auto-fill extraction failed. Please fill in the details manually.");
        setIsUploading(false);
        return;
      }

      const parsedData = Array.isArray(parseResult.output)
        ? (parseResult.output[0] || {})
        : parseResult.output;

      // Auto-fill form with extracted data
      setFormData((prev) => ({
        ...prev,
        first_name: parsedData.first_name || prev.first_name,
        last_name: parsedData.last_name || prev.last_name,
        email: parsedData.email || prev.email,
        phone: parsedData.phone || prev.phone,
        location: parsedData.location || prev.location,
        current_title: parsedData.current_title || prev.current_title,
        current_company: parsedData.current_company || prev.current_company,
        experience_years: parsedData.experience_years || prev.experience_years,
        skills: Array.isArray(parsedData.skills) ? parsedData.skills : prev.skills,
        work_authorization: parsedData.work_authorization || prev.work_authorization,
      }));

      setUploadError(""); // Clear any previous errors on success
    } catch (error) {
      console.error("Error processing resume:", error);
      setUploadError("✅ Upload successful, but processing failed. Please fill in the details manually.");
    } finally {
      setIsParsing(false);
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Final duplicate check before saving (for new candidates only)
    if (!candidate && formData.email) {
      setIsSubmitting(true); // Set submitting state early to prevent double clicks during confirmation
      const duplicate = await checkForDuplicate(formData.email);
      if (duplicate) {
        const confirmUpdate = window.confirm(
          `A candidate with email "${formData.email}" already exists:\n\n` +
          `${duplicate.first_name} ${duplicate.last_name}\n` +
          `Status: ${duplicate.status?.replace(/_/g, ' ')}\n\n` +
          `Would you like to update the existing candidate instead?`
        );
        
        if (confirmUpdate) {
          // Update existing candidate
          try {
            await Candidate.update(duplicate.id, {
              ...formData,
              experience_years: formData.experience_years ? Number(formData.experience_years) : undefined,
              salary_expectation: formData.salary_expectation ? Number(formData.salary_expectation) : undefined,
              email: formData.email.trim().toLowerCase() // Ensure email is lowercased on update
            });
            addNotification({
              type: "success",
              title: "Candidate Updated",
              message: `${duplicate.first_name} ${duplicate.last_name} has been updated successfully.`
            });
            onSave(formData); // Notify parent component of the update
          } catch (error) {
            console.error("Error updating candidate:", error);
            addNotification({
              type: "error",
              title: "Error",
              message: "Failed to update candidate. Please try again."
            });
          }
          setIsSubmitting(false);
          return;
        } else {
          // User chose not to update, cancel submission
          setIsSubmitting(false);
          return;
        }
      }
    }
    
    setIsSubmitting(true);
    
    try {
      const cleanedData = {
        ...formData,
        experience_years: formData.experience_years ? Number(formData.experience_years) : undefined,
        salary_expectation: formData.salary_expectation ? Number(formData.salary_expectation) : undefined,
        email: formData.email.trim().toLowerCase() // Ensure email is lowercased on creation
      };
      
      await onSave(cleanedData);
      addNotification({
        type: "success",
        title: "Candidate Saved",
        message: `${cleanedData.first_name} ${cleanedData.last_name} has been saved successfully.`
      });
    } catch (error) {
      console.error("Error saving candidate:", error);
      addNotification({
        type: "error",
        title: "Error",
        message: "Error saving candidate. Please try again."
      });
    }
    
    setIsSubmitting(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] max-h-[90vh] overflow-hidden"
        >
          <div className="flex flex-col h-full">
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900">
                  {candidate ? "Edit Candidate" : "Add New Candidate"}
                </h2>
                <Button variant="ghost" size="icon" onClick={onCancel}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Resume Upload Section */}
                <Card className="border-dashed border-2 border-blue-200 bg-blue-50">
                  <CardContent className="p-6 text-center">
                    <input
                      type="file"
                      id="resume-upload"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.rtf,.txt,.png,.jpg,.jpeg"
                      onChange={handleResumeUpload}
                      disabled={isUploading}
                    />
                    <label
                      htmlFor="resume-upload"
                      className="cursor-pointer flex flex-col items-center gap-3"
                    >
                      {isUploading || isParsing ? (
                        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                      ) : (
                        <Upload className="w-8 h-8 text-blue-600" />
                      )}
                      <div>
                        <p className="font-medium text-slate-900">
                          {isUploading ? "Uploading..." : isParsing ? "Parsing resume..." : "Upload Resume"}
                        </p>
                        <p className="text-sm text-slate-600">
                          PDF and images supported with auto-fill. Word documents will be uploaded but require manual entry.
                        </p>
                        {uploadError && <p className="text-sm text-amber-600 mt-2">{uploadError}</p>}
                        {formData.resume_url && !isUploading && !isParsing && (
                          <p className="text-xs text-slate-600 mt-2">
                            Uploaded:{" "}
                            <a
                              href={formData.resume_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 underline"
                            >
                              View resume
                            </a>
                          </p>
                        )}
                      </div>
                    </label>
                  </CardContent>
                </Card>

                {/* Optional: paste URL fallback */}
                <div>
                  <Label htmlFor="resume_url">Resume URL (optional)</Label>
                  <Input
                    id="resume_url"
                    value={formData.resume_url || ""}
                    onChange={(e) => handleInputChange("resume_url", e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                {/* Duplicate Warning */}
                {duplicateCandidate && !candidate && (
                  <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="text-amber-600 mt-0.5">⚠️</div>
                      <div className="flex-1">
                        <p className="font-semibold text-amber-900 mb-1">
                          Potential Duplicate Detected
                        </p>
                        <p className="text-sm text-amber-800">
                          A candidate with email <strong>{formData.email}</strong> already exists:
                        </p>
                        <div className="mt-2 p-2 bg-white rounded border border-amber-200">
                          <p className="text-sm font-medium text-slate-900">
                            {duplicateCandidate.first_name} {duplicateCandidate.last_name}
                          </p>
                          <p className="text-xs text-slate-600">
                            Status: {duplicateCandidate.status?.replace(/_/g, " ")} • 
                            Added: {new Date(duplicateCandidate.created_date).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="text-xs text-amber-700 mt-2">
                          When you save, you'll be prompted to update the existing candidate instead of creating a duplicate.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange("first_name", e.target.value)}
                      placeholder="Enter first name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => handleInputChange("last_name", e.target.value)}
                      placeholder="Enter last name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <div className="relative">
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        placeholder="Enter email address"
                        required
                        className={duplicateCandidate && !candidate ? "border-amber-300" : ""}
                      />
                      {checkingDuplicate && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>

                {/* Professional Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="current_title">Current Title</Label>
                    <Input
                      id="current_title"
                      value={formData.current_title}
                      onChange={(e) => handleInputChange("current_title", e.target.value)}
                      placeholder="Current job title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="current_company">Current Company</Label>
                    <Input
                      id="current_company"
                      value={formData.current_company}
                      onChange={(e) => handleInputChange("current_company", e.target.value)}
                      placeholder="Current employer"
                    />
                  </div>
                  <div>
                    <Label htmlFor="experience_years">Years of Experience</Label>
                    <Input
                      id="experience_years"
                      type="number"
                      value={formData.experience_years}
                      onChange={(e) => handleInputChange("experience_years", e.target.value)}
                      placeholder="Years of experience"
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => handleInputChange("location", e.target.value)}
                      placeholder="City, State"
                    />
                  </div>
                </div>

                {/* Skills Section */}
                <div>
                  <Label>Skills</Label>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={newSkill}
                        onChange={(e) => setNewSkill(e.target.value)}
                        placeholder="Add a skill"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                      />
                      <Button type="button" onClick={addSkill} size="icon">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.skills.map((skill, index) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                          {skill}
                          <button type="button" onClick={() => removeSkill(skill)}>
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="availability">Availability</Label>
                    <Select value={formData.availability} onValueChange={(value) => handleInputChange("availability", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediately">Immediately</SelectItem>
                        <SelectItem value="2_weeks">2 Weeks</SelectItem>
                        <SelectItem value="1_month">1 Month</SelectItem>
                        <SelectItem value="negotiable">Negotiable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="our_bench">Our Bench</SelectItem>
                        <SelectItem value="placed">Placed</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="do_not_contact">Do Not Contact</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="work_authorization">Work Authorization</Label>
                    <Select value={formData.work_authorization} onValueChange={(value) => handleInputChange("work_authorization", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="citizen">US Citizen</SelectItem>
                        <SelectItem value="permanent_resident">Permanent Resident</SelectItem>
                        <SelectItem value="h1b">H1B</SelectItem>
                        <SelectItem value="opt">OPT</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* NEW: Added Experience + Source */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="addedExperience">Added Experience</Label>
                    <Input
                      id="addedExperience"
                      value={formData.addedExperience || ""}
                      onChange={(e) => handleInputChange("addedExperience", e.target.value)}
                      placeholder="e.g., Additional relevant experience summary"
                    />
                  </div>
                  <div>
                    <Label htmlFor="source">Source</Label>
                    <Input
                      id="source"
                      value={formData.source || ""}
                      onChange={(e) => handleInputChange("source", e.target.value)}
                      placeholder="e.g., LinkedIn, Referral, Job Board"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="salary_expectation">Salary Expectation ($)</Label>
                    <Input
                      id="salary_expectation"
                      type="number"
                      value={formData.salary_expectation}
                      onChange={(e) => handleInputChange("salary_expectation", e.target.value)}
                      placeholder="Annual salary expectation"
                    />
                  </div>
                  <div>
                    <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                    <Input
                      id="linkedin_url"
                      value={formData.linkedin_url}
                      onChange={(e) => handleInputChange("linkedin_url", e.target.value)}
                      placeholder="LinkedIn profile URL"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder="Internal notes about this candidate"
                    rows={3}
                  />
                </div>
              </form>
            </div>

            <div className="border-t border-slate-200 p-6">
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {candidate ? "Update Candidate" : "Add Candidate"}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
