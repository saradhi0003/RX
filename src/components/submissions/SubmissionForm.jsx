import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { X, Calendar as CalendarIcon, Loader2, Save as SaveIcon, Search, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";

// Searchable Lookup Component
const SearchableLookup = ({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Search...", 
  displayField = "name",
  searchFields = ["name"],
  renderOption,
  emptyText = "No options found"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOptions = options.filter(option => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return searchFields.some(field => {
      const fieldValue = option[field];
      if (typeof fieldValue === 'string') {
        return fieldValue.toLowerCase().includes(query);
      }
      return false;
    });
  });

  const selectedOption = options.find(opt => opt.id === value);

  const handleSelect = (option) => {
    onChange(option.id);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-between"
        >
          {selectedOption ? (
            renderOption ? renderOption(selectedOption) : selectedOption[displayField]
          ) : (
            placeholder
          )}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <div className="p-2">
          <Input
            placeholder="Type to search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="max-h-60 overflow-auto">
          {filteredOptions.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">{emptyText}</div>
          ) : (
            filteredOptions.map((option) => (
              <div
                key={option.id}
                className={`cursor-pointer p-2 hover:bg-slate-100 ${
                  value === option.id ? 'bg-slate-100' : ''
                }`}
                onClick={() => handleSelect(option)}
              >
                <div className="flex items-center">
                  {value === option.id && <Check className="mr-2 h-4 w-4" />}
                  <div className="flex-1">
                    {renderOption ? renderOption(option) : option[displayField]}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default function SubmissionForm({ submission, candidates, jobs, onSuccess, onCancel }) {
  const [formData, setFormData] = React.useState(submission || {
    candidate_id: "",
    job_id: "",
    recruiter_id: "",
    status: "submitted",
    follow_up_date: "",
    notes: ""
  });
  const [me, setMe] = React.useState(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [__externalReload, setExternalReload] = React.useState(0);
  const [candidateOptions, setCandidateOptions] = React.useState(candidates || []);
  const [jobOptions, setJobOptions] = React.useState(jobs || []);
  const [userOptions, setUserOptions] = React.useState([]);

  useEffect(() => {
    setCandidateOptions(candidates || []);
  }, [candidates]);

  useEffect(() => {
    setJobOptions(jobs || []);
  }, [jobs]);

  // Fallback: if no jobs were provided (e.g., recruiter role), fetch open jobs
  useEffect(() => {
    (async () => {
      if ((!jobOptions || jobOptions.length === 0) && (!jobs || jobs.length === 0)) {
        try {
          const list = await base44.entities.Job.filter({ status: "open" }, "-created_date", 200);
          setJobOptions(list || []);
        } catch (_) { /* ignore */ }
      }
    })();
  }, [jobOptions, jobs]);

  useEffect(() => {
    base44.auth.me().then(setMe).catch(() => setMe(null));
  }, []);

  // Load users with Recruiter, Admin, or Accounts roles
  useEffect(() => {
    (async () => {
      try {
        const allUsers = await base44.entities.User.list();
        const filteredUsers = (allUsers || []).filter(user => {
          const role = (user.role || "").toLowerCase();
          const roleName = (user.role_name || "").toLowerCase();
          return role === "admin" || 
                 role === "recruiter" || 
                 roleName.includes("recruiter") || 
                 roleName.includes("accounts");
        });
        setUserOptions(filteredUsers);
      } catch (error) {
        console.error("Error loading users:", error);
      }
    })();
  }, []);

  useEffect(() => {
    if (me && !formData.recruiter_id) {
      setFormData(prev => ({ ...prev, recruiter_id: me.id }));
    }
  }, [me, formData.recruiter_id]);

  // Listen for candidate changes and refresh lookups
  useEffect(() => {
    const reload = () => setExternalReload((x) => x + 1);
    const onStorage = (e) => { if (e.key === "candidate_cache_bust") reload(); };
    window.addEventListener("candidate_cache_bust", reload);
    window.addEventListener("storage", onStorage);
    window.addEventListener("entity:Candidate:changed", reload);
    return () => {
      window.removeEventListener("candidate_cache_bust", reload);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("entity:Candidate:changed", reload);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.Candidate.list("-created_date", 100);
        setCandidateOptions(list);
      } catch (_) {
        // ignore refresh errors
      }
    })();
  }, [__externalReload]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const followDate = formData.follow_up_date
        ? (typeof formData.follow_up_date === "string"
            ? formData.follow_up_date
            : format(new Date(formData.follow_up_date), "yyyy-MM-dd"))
        : null;

      const payload = {
        candidate_id: formData.candidate_id,
        job_id: formData.job_id,
        status: formData.status || "submitted",
        follow_up_date: followDate,
        notes: formData.notes || "",
        recruiter_id: formData.recruiter_id || me?.id
      };

      if (submission?.id) {
        await base44.entities.Submission.update(submission.id, payload);
      } else {
        await base44.entities.Submission.create(payload);
      }

      onSuccess?.();
    } catch (error) {
      console.error("Error saving submission:", error);
      alert("Error saving submission. Please try again.");
    }
    
    setIsSubmitting(false);
  };

  const canSave = formData.candidate_id && formData.job_id && formData.recruiter_id;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="candidate_id">Candidate *</Label>
          <SearchableLookup
            options={candidateOptions}
            value={formData.candidate_id}
            onChange={(value) => setFormData({...formData, candidate_id: value})}
            placeholder="Search for candidate..."
            searchFields={["first_name", "last_name", "email", "current_title"]}
            renderOption={(candidate) => (
              <div>
                <div className="font-medium">
                  {candidate.first_name} {candidate.last_name}
                </div>
                <div className="text-sm text-slate-500">
                  {candidate.current_title} • {candidate.email}
                </div>
              </div>
            )}
            emptyText="No candidates found"
          />
        </div>

        <div>
          <Label htmlFor="job_id">Job *</Label>
          <SearchableLookup
            options={jobOptions}
            value={formData.job_id}
            onChange={(value) => setFormData({...formData, job_id: value})}
            placeholder="Search for job..."
            searchFields={["title", "location", "company_name"]}
            renderOption={(job) => (
              <div>
                <div className="font-medium">{job.title}</div>
                <div className="text-sm text-slate-500">
                  {job.location} • {job.employment_type?.replace('_', ' ')}
                </div>
              </div>
            )}
            emptyText="No jobs found"
          />
        </div>

        <div>
          <Label htmlFor="recruiter_id">Assigned Recruiter *</Label>
          <SearchableLookup
            options={userOptions}
            value={formData.recruiter_id}
            onChange={(value) => setFormData({...formData, recruiter_id: value})}
            placeholder="Select recruiter..."
            searchFields={["full_name", "email", "role_name"]}
            renderOption={(user) => (
              <div>
                <div className="font-medium">{user.full_name}</div>
                <div className="text-sm text-slate-500">
                  {user.email} • {user.role_name || user.role}
                </div>
              </div>
            )}
            emptyText="No recruiters found"
          />
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select 
            value={formData.status} 
            onValueChange={(value) => setFormData({...formData, status: value})}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="interviewing">Interviewing</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="hired">Hired</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Follow-up Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.follow_up_date ? format(new Date(formData.follow_up_date), 'PPP') : 'Set follow-up date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={formData.follow_up_date ? new Date(formData.follow_up_date) : undefined}
                onSelect={(date) => setFormData({...formData, follow_up_date: date})}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            placeholder="Submission notes"
            rows={4}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            type="submit"
            disabled={isSubmitting || !canSave}
            className="gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </Button>
        </div>
      </form>
    </div>
  );
}