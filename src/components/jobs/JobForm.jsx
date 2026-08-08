
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X, Loader2 } from "lucide-react";
import { Company } from "@/entities/Company";
import { JobStack } from "@/entities/JobStack";
import { addNotification } from "@/components/notifications/NotificationToast";
import { User as UserEntity } from "@/entities/User";
import { InvokeLLM } from "@/integrations/Core";
import { sendAppEmail } from "@/components/utils/email";
import { createRoot } from 'react-dom/client';
import JobNotificationEmail from "./JobNotificationEmail";
import { createPageUrl } from "@/utils";

export default function JobForm({ job, onSave, onCancel }) {
  const [companies, setCompanies] = useState([]);
  const [saving, setSaving] = useState(false);
  const [sendingNotifications, setSendingNotifications] = useState(false);
  const [data, setData] = useState(job || {
    title: "",
    company_id: "",
    location: "",
    remote_type: "onsite",
    employment_type: "full_time",
    rate: "",
    priority: "medium",
    status: "draft",
    due_date: "",
    description: "",
    requirements: "",
    required_skills: [],
    preferred_skills: []
  });

  React.useEffect(() => { Company.list().then(setCompanies); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Assuming 'formData' in the outline refers to the 'data' state.
      // Assuming 'salaryMin' and 'salaryMax' refer to potential 'salary_min' and 'salary_max' properties within the 'data' object,
      // which might be present if the 'job' prop contained them (e.g., when editing).
      // If not present in `data`, they will be `undefined` and cleaned up later.
      const salaryMinFromData = data.salary_min; // This relies on `data` already having salary_min if editing
      const salaryMaxFromData = data.salary_max; // This relies on `data` already having salary_max if editing

      const payload = {
        ...data, // Use existing 'data' state as the base
        salary_min: salaryMinFromData ? parseFloat(salaryMinFromData) : undefined,
        salary_max: salaryMaxFromData ? parseFloat(salaryMaxFromData) : undefined,
        // Ensure required_skills and preferred_skills are arrays before filtering
        required_skills: (data.required_skills || []).filter(s => s.trim()),
        preferred_skills: (data.preferred_skills || []).filter(s => s.trim())
      };

      // Clean up undefined values
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      const savedJob = await onSave(payload);
      
      if (savedJob) {
        addNotification({
          type: 'success',
          title: `Job ${job ? 'Updated' : 'Posted'} Successfully`,
          message: 'Your job listing is now live.',
          duration: 6000
        });

        // Show additional message if job was published to careers
        if (savedJob?.status === 'open') {
          addNotification({
            type: "info",
            title: "Publishing to Careers",
            message: "Job is being published to talentstack.org/careers...",
            duration: 3000
          });
        }

        // If this is a new job (not editing), send notifications and clone to JobStack
        if (!job) {
          setSendingNotifications(true);
          const company = companies.find(c => c.id === savedJob.company_id);
          try {
            await cloneToJobStackAndNotify(savedJob, company);
          } catch (notificationError) {
            console.error("Error during cloneToJobStackAndNotify:", notificationError);
            addNotification({
                type: 'warning',
                title: 'Notification/Cloning Error',
                message: 'Job was created, but post-creation actions failed during notifications.',
                duration: 8000
            });
          } finally {
            setSendingNotifications(false); // Ensure sendingNotifications is reset
          }
        }
      }
    } catch (error) {
      console.error("Error saving job:", error);
      addNotification({ 
        type: "error", 
        title: "Error", 
        message: error.message || "Failed to save job" 
      });
    } finally {
      setSaving(false);
    }
  };

  const cloneToJobStackAndNotify = async (newJob, company) => {
    try {
      // 1. Clone to JobStack
      const stackData = {
        title: newJob.title,
        description: newJob.description,
        rate: newJob.rate,
        due_date: newJob.due_date,
        employment_type: newJob.employment_type,
        status: newJob.status,
        client: company?.name || "N/A",
        original_job_id: newJob.id
      };
      await JobStack.create(stackData);
      addNotification({ title: 'Cloned to Jobs Stack', message: 'A version has been added to the Jobs Stack portal.', type: 'info' });

      // 2. Find connections with 'Jobs Stack Access'
      const allCompanies = await Company.list();
      const interestedCompanies = allCompanies.filter(c => c.job_stack_access);

      if (interestedCompanies.length === 0) return;

      // 3. Prepare and send emails
      const jobUrl = `${window.location.origin}${createPageUrl("JobStack")}`;
      
      for (const comp of interestedCompanies) {
        const contact = comp.contacts?.find(c => c.is_primary) || comp.contacts?.[0];
        if (contact?.email) {
          const emailSubject = `New Opportunity on Jobs Stack: ${newJob.title}`;
          const emailBody = `
            <p>Hello ${contact.name || comp.name},</p>
            <p>A new job opportunity has been posted to our Jobs Stack that may interest you:</p>
            <br>
            <p><b>Title:</b> ${newJob.title}</p>
            <p><b>Client:</b> ${company?.name || "N/A"}</p>
            <p><b>Rate:</b> ${newJob.rate || "Not specified"}</p>
            <br>
            <p>You can view more details on our Jobs Stack portal.</p>
            <p><a href="${jobUrl}">View Jobs Stack</a></p>
            <br>
            <p>Regards,</p>
            <p>Recruiter X Team</p>
          `;
          sendAppEmail({
            to: contact.email,
            subject: emailSubject,
            body: emailBody
          }).catch(err => console.error(`Failed to email ${contact.email}:`, err));
        }
      }
      addNotification({ title: 'Notified Connections', message: `Sent job alerts to ${interestedCompanies.length} connections.`, type: 'success' });

    } catch (error) {
      console.error("Error during Job Stack cloning/notification:", error);
      // Re-throw the error so the calling `handleSubmit` can catch it and update UI state.
      throw error; 
    }
  };


  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{job ? "Edit Job" : "Post Job"}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title <span className="text-red-500" aria-hidden="true">*</span></Label>
                <Input id="title" value={data.title} onChange={(e)=>setData({...data, title: e.target.value})} required />
              </div>
              <div>
                <Label htmlFor="company">Company</Label>
                <Select value={data.company_id} onValueChange={(v)=>setData({...data, company_id: v})}>
                  <SelectTrigger id="company"><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={data.location} onChange={(e)=>setData({...data, location: e.target.value})} />
              </div>
              <div>
                <Label htmlFor="remote_type">Remote Type</Label>
                <Select value={data.remote_type} onValueChange={(v)=>setData({...data, remote_type: v})}>
                  <SelectTrigger id="remote_type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onsite">Onsite</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="employment_type">Employment</Label>
                <Select value={data.employment_type} onValueChange={(v)=>setData({...data, employment_type: v})}>
                  <SelectTrigger id="employment_type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full-time</SelectItem>
                    <SelectItem value="part_time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="contract_to_hire">Contract to Hire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={data.priority} onValueChange={(v)=>setData({...data, priority: v})}>
                  <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={data.status} onValueChange={(v)=>setData({...data, status: v})}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="filled">Filled</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rate">Rate</Label>
                <Input id="rate" value={data.rate} onChange={(e)=>setData({...data, rate: e.target.value})} placeholder="e.g., $75/hr or 120k-140k" />
              </div>
              <div>
                <Label htmlFor="due_date">Due Date</Label>
                <Input id="due_date" type="date" value={data.due_date || ""} onChange={(e)=>setData({...data, due_date: e.target.value})} />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" rows={3} value={data.description} onChange={(e)=>setData({...data, description: e.target.value})} />
            </div>
            <div>
              <Label htmlFor="requirements">Requirements</Label>
              <Textarea id="requirements" rows={3} value={data.requirements} onChange={(e)=>setData({...data, requirements: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
              <Button type="submit" className="gap-2" disabled={saving || sendingNotifications}>
                {(saving || sendingNotifications) && <Loader2 className="w-4 h-4 animate-spin" />}
                {sendingNotifications ? "Notifying..." : (job ? "Update Job" : "Create Job")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
