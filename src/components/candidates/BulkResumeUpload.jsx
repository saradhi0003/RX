
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { X, Upload, CheckCircle, AlertCircle, Loader2, FileText } from "lucide-react";
import { Candidate } from "@/entities/Candidate";
import * as Core from "@/integrations/Core";
import { addNotification } from "@/components/notifications/NotificationToast";

// Candidate schema for AI extraction
const CANDIDATE_SCHEMA = {
  type: "object",
  properties: {
    first_name: { type: "string", description: "First name" },
    last_name: { type: "string", description: "Last name" },
    email: { type: "string", description: "Email address" },
    phone: { type: "string", description: "Phone number" },
    location: { type: "string", description: "Current location" },
    linkedin_url: { type: "string", description: "LinkedIn profile URL" },
    skills: { type: "array", items: { type: "string" }, description: "Technical and professional skills" },
    experience_years: { type: "number", description: "Years of experience" },
    current_title: { type: "string", description: "Current job title" },
    current_company: { type: "string", description: "Current employer" },
    work_authorization: { type: "string", description: "Work authorization status" }
  },
  required: ["first_name", "last_name"]
};

export default function BulkResumeUpload({ open, onClose, onComplete }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState(false);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      return ['pdf', 'doc', 'docx'].includes(ext);
    });

    if (validFiles.length < selectedFiles.length) {
      addNotification({
        type: "warning",
        title: "Some files skipped",
        message: "Only PDF and Word documents are supported"
      });
    }

    setFiles(prevFiles => [...prevFiles, ...validFiles]);
  };

  const removeFile = (index) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const checkDuplicate = async (email) => {
    if (!email) return null;
    try {
      const existing = await Candidate.filter({ email });
      return existing && existing.length > 0 ? existing[0] : null;
    } catch (e) {
      return null;
    }
  };

  const processResumes = async () => {
    if (files.length === 0) return;

    setProcessing(true);
    setUploading(true);
    setProgress(0);
    const processResults = [];

    // Process in batches of 3 to avoid overwhelming the API
    const BATCH_SIZE = 3;
    
    for (let batchStart = 0; batchStart < files.length; batchStart += BATCH_SIZE) {
      const batch = files.slice(batchStart, batchStart + BATCH_SIZE);
      
      // Process batch in parallel
      const batchPromises = batch.map(async (file, batchIndex) => {
        const globalIndex = batchStart + batchIndex;
        const fileExt = file.name.split('.').pop().toLowerCase();
        const fileResult = {
          fileName: file.name,
          status: 'processing',
          message: '',
          candidateId: null
        };

        try {
          // Upload file first
          const { file_url } = await Core.UploadFile({ file });
          fileResult.resumeUrl = file_url;

          // CRITICAL: Only PDFs support AI extraction via ExtractDataFromUploadedFile
          // Word documents (.doc, .docx) are NOT supported by any of our AI integrations
          if (fileExt !== 'pdf') {
            fileResult.status = 'warning';
            fileResult.message = `Resume uploaded. ${fileExt.toUpperCase()} files cannot be auto-parsed. Please add candidate details manually or convert to PDF.`;
            return fileResult;
          }

          // Try AI extraction for PDFs only
          let parseResult;
          let extractionFailed = false;
          
          try {
            const extractionPromise = Core.ExtractDataFromUploadedFile({
              file_url,
              json_schema: CANDIDATE_SCHEMA
            });
            
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Extraction timeout')), 45000)
            );
            
            parseResult = await Promise.race([extractionPromise, timeoutPromise]);
          } catch (parseError) {
            extractionFailed = true;
            console.warn(`AI extraction failed for ${file.name}:`, parseError.message);
          }

          // If extraction failed or returned no data, mark as warning but continue
          if (extractionFailed || !parseResult || parseResult?.status !== "success" || !parseResult.output) {
            fileResult.status = 'warning';
            fileResult.message = 'Resume uploaded successfully. AI extraction incomplete - please add candidate details manually.';
            return fileResult;
          }

          const parsedData = Array.isArray(parseResult.output) 
            ? parseResult.output[0] 
            : parseResult.output;

          // Check for duplicate by email
          if (parsedData.email) {
            const duplicate = await checkDuplicate(parsedData.email);
            if (duplicate) {
              fileResult.status = 'duplicate';
              fileResult.message = `Candidate already exists: ${duplicate.first_name} ${duplicate.last_name}`;
              fileResult.candidateId = duplicate.id;
              return fileResult;
            }
          }

          // Validate required fields
          if (!parsedData.first_name || !parsedData.last_name) {
            fileResult.status = 'warning';
            fileResult.message = 'Resume uploaded but missing required fields (name). Resume saved - please complete candidate details manually.';
            return fileResult;
          }

          // Create candidate
          const candidateData = {
            ...parsedData,
            resume_url: file_url,
            status: parsedData.status || 'active',
            source: 'bulk_upload'
          };

          const newCandidate = await Candidate.create(candidateData);

          fileResult.status = 'success';
          fileResult.message = `Created: ${newCandidate.first_name} ${newCandidate.last_name}`;
          fileResult.candidateId = newCandidate.id;
          fileResult.candidateData = newCandidate;
          return fileResult;

        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
          fileResult.status = 'error';
          fileResult.message = error.message || 'Failed to process file';
          return fileResult;
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      processResults.push(...batchResults);
      
      // Update progress and results after each batch
      setProgress(((batchStart + batch.length) / files.length) * 100);
      setResults([...processResults]);
      
      // Small delay between batches to avoid rate limiting
      if (batchStart + BATCH_SIZE < files.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setProcessing(false);
    setUploading(false);

    const successCount = processResults.filter(r => r.status === 'success').length;
    const duplicateCount = processResults.filter(r => r.status === 'duplicate').length;
    const errorCount = processResults.filter(r => r.status === 'error').length;
    const warningCount = processResults.filter(r => r.status === 'warning').length;

    if (successCount > 0) {
      addNotification({
        type: "success",
        title: "Upload Complete",
        message: `Successfully created ${successCount} candidate(s). ${warningCount > 0 ? `${warningCount} resume(s) need manual review. ` : ''}${duplicateCount} duplicate(s). ${errorCount} error(s).`
      });
    } else if (warningCount > 0) {
      addNotification({
        type: "warning",
        title: "Resumes Uploaded",
        message: `${warningCount} resume(s) uploaded but need manual review. ${duplicateCount} duplicate(s). ${errorCount} error(s).`
      });
    } else if (errorCount > 0) {
      addNotification({
        type: "error",
        title: "Upload Issues",
        message: `${errorCount} file(s) failed to upload. ${duplicateCount} duplicate(s).`
      });
    }

    try { localStorage.setItem("candidate_cache_bust", String(Date.now())); } catch (_) {}
    window.dispatchEvent(new Event("candidate_cache_bust"));
    window.dispatchEvent(new CustomEvent("entity:Candidate:changed"));

    if (onComplete) onComplete();
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'duplicate': return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      case 'processing': return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      default: return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800 border-green-300';
      case 'error': return 'bg-red-100 text-red-800 border-red-300';
      case 'duplicate': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle>Bulk Resume Upload</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={uploading}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>

        <CardContent className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {!processing && results.length === 0 && (
            <div className="mb-6">
              <input
                type="file"
                id="bulk-resume-upload"
                className="hidden"
                multiple
                accept=".pdf,.doc,.docx"
                onChange={handleFileSelect}
                disabled={uploading}
              />
              <label
                htmlFor="bulk-resume-upload"
                className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  uploading ? 'border-slate-300 bg-slate-50' : 'border-blue-300 bg-blue-50 hover:bg-blue-100'
                }`}
              >
                <Upload className="w-12 h-12 text-blue-600 mb-4" />
                <p className="text-lg font-medium text-slate-900 mb-2">
                  Choose resumes or drag & drop
                </p>
                <p className="text-sm text-slate-600 text-center">
                  <strong>PDF recommended</strong> - AI auto-extracts candidate data<br />
                  DOC/DOCX will be uploaded but require manual data entry
                </p>
              </label>
            </div>
          )}

          {files.length > 0 && !processing && results.length === 0 && (
            <div className="space-y-2 mb-6">
              <h3 className="font-semibold text-slate-900 mb-3">
                Selected Files ({files.length})
              </h3>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                <p className="text-xs text-blue-800">
                  ℹ️ Processing in batches of 3 files. AI will extract data from all file types.
                </p>
              </div>
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 text-sm">{file.name}</p>
                      <p className="text-xs text-slate-500">
                        {(file.size / 1024).toFixed(1)} KB • AI extraction enabled
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {uploading && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">
                  Processing resumes... ({results.length}/{files.length})
                </span>
                <span className="text-sm text-slate-600">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-slate-500 mt-2">
                Processing in batches to ensure reliability. Please wait...
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 mb-3">
                Processing Results
              </h3>
              {results.map((result, index) => (
                <div key={index} className="p-4 bg-slate-50 rounded-lg border">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(result.status)}
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 text-sm mb-1">
                          {result.fileName}
                        </p>
                        <p className="text-sm text-slate-600">{result.message}</p>
                        {result.candidateId && result.status !== 'duplicate' && (
                          <a
                            href={`#/CandidateDetails?id=${result.candidateId}`}
                            className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                          >
                            View candidate →
                          </a>
                        )}
                        {result.resumeUrl && result.status === 'warning' && (
                          <a
                            href={result.resumeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline mt-1 inline-block ml-3"
                          >
                            View resume →
                          </a>
                        )}
                      </div>
                    </div>
                    <Badge className={getStatusColor(result.status)}>
                      {result.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!processing && results.length === 0 && files.length === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li><strong>PDF files:</strong> Fast AI extraction - auto-creates candidates with all details</li>
                <li><strong>Word documents:</strong> Uploaded and saved, but require manual data entry</li>
                <li><strong>Recommendation:</strong> Convert Word docs to PDF for best results</li>
                <li>Duplicate candidates are automatically detected by email</li>
              </ul>
            </div>
          )}
        </CardContent>

        <div className="border-t p-4 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            {files.length > 0 && !processing && results.length === 0 && (
              <span>{files.length} file(s) ready to upload</span>
            )}
            {results.length > 0 && (
              <span>
                {results.filter(r => r.status === 'success').length} created, 
                {' '}{results.filter(r => r.status === 'duplicate').length} duplicates, 
                {' '}{results.filter(r => r.status === 'warning').length} saved (manual review),
                {' '}{results.filter(r => r.status === 'error').length} errors
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {results.length > 0 ? (
              <>
                <Button variant="outline" onClick={() => { setFiles([]); setResults([]); setProgress(0); }}>
                  Upload More
                </Button>
                <Button onClick={onClose}>
                  Done
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose} disabled={uploading}>
                  Cancel
                </Button>
                <Button 
                  onClick={processResumes} 
                  disabled={files.length === 0 || uploading}
                  className="gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload & Process ({files.length})
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
