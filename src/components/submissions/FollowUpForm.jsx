
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SendEmail } from "@/integrations/Core";

export default function FollowUpForm({ submission, candidate, job, onSave, onCancel }) {
  const [followUpData, setFollowUpData] = useState({
    notes: "",
    new_status: submission.status,
    send_email: false,
    email_content: ""
  });
  
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      // Send email if requested
      if (followUpData.send_email && followUpData.email_content && candidate?.email) {
        await SendEmail({
          to: candidate.email,
          subject: `Follow-up: ${job?.title} Position`,
          body: followUpData.email_content
        });
      }

      // Update submission
      await onSave({
        ...followUpData,
        new_status: followUpData.new_status
      });
    } catch (error) {
      console.error("Error processing follow-up:", error);
      alert("Error processing follow-up. Please try again.");
    }
    
    setIsSaving(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[90vh] max-h-[90vh] overflow-hidden"
        >
          <div className="flex flex-col h-full">
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Follow-up</h2>
                  <p className="text-slate-600">
                    {candidate?.first_name} {candidate?.last_name} - {job?.title}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onCancel}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="new_status">Update Status</Label>
                  <Select 
                    value={followUpData.new_status} 
                    onValueChange={(value) => setFollowUpData({...followUpData, new_status: value})}
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
                  <Label htmlFor="notes">Follow-up Notes *</Label>
                  <Textarea
                    id="notes"
                    value={followUpData.notes}
                    onChange={(e) => setFollowUpData({...followUpData, notes: e.target.value})}
                    placeholder="What happened in this follow-up?"
                    rows={4}
                    required
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="send_email"
                      checked={followUpData.send_email}
                      onChange={(e) => setFollowUpData({...followUpData, send_email: e.target.checked})}
                      className="rounded"
                    />
                    <Label htmlFor="send_email">Send follow-up email to candidate</Label>
                  </div>

                  {followUpData.send_email && (
                    <div>
                      <Label htmlFor="email_content">Email Content</Label>
                      <Textarea
                        id="email_content"
                        value={followUpData.email_content}
                        onChange={(e) => setFollowUpData({...followUpData, email_content: e.target.value})}
                        placeholder="Email message to send to candidate"
                        rows={6}
                      />
                    </div>
                  )}
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
                  disabled={isSaving}
                  className="gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <Send className="w-4 h-4" />
                  Complete Follow-up
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
