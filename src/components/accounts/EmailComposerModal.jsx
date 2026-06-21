import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Send, Loader2, Sparkles, Paperclip } from "lucide-react";
import InvoicePreview from "@/components/accounts/InvoicePreview";
import { sendAppEmail } from "@/components/utils/email";
import { addNotification } from "@/components/notifications/NotificationToast";
import { User } from "@/entities/User";
import { EmailTemplate } from "@/entities/EmailTemplate";

const renderTpl = (s, vars) => s.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => String(vars[k] ?? ""));

export default function EmailComposerModal({ open, onClose, invoice, company }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);
  const [appUsers, setAppUsers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const possibleRecipients = useMemo(() => {
    const emails = new Set();
    if (invoice?.bill_to_email) emails.add(invoice.bill_to_email);
    if (company?.contacts) {
      company.contacts.forEach(c => c.email && emails.add(c.email));
    }
    return Array.from(emails);
  }, [invoice, company]);

  const baseVars = useMemo(() => {
    if (!invoice) return {};
    const itemsList = (invoice.items || [])
      .map(it => `- ${it.description}: ${it.quantity} x ${it.unit_price} = ${it.amount}`)
      .join("\n");
      
    return {
      company_name: company?.name || invoice?.bill_to_name || "",
      invoice_number: invoice.invoice_number,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      currency: invoice.currency || "USD",
      subtotal: invoice.subtotal,
      tax_amount: invoice.tax_amount,
      total: invoice.total,
      notes: invoice.notes || "",
      items_bullets: itemsList
    };
  }, [invoice, company]);
  
  useEffect(() => {
    if (!open) return;
    
    // Set initial state when modal opens
    setRecipient(possibleRecipients[0] || "");
    const initialSubject = `Invoice ${invoice.invoice_number} from ${invoice.from_company || "Recruiter X"}`;
    const initialBody = `Hello ${invoice.bill_to_name || ""},\n\nPlease find your invoice attached.\n\nTotal Due: ${invoice.total} ${invoice.currency || 'USD'}\nDue Date: ${invoice.due_date}\n\nThank you,\n${invoice.from_company || "Recruiter X"}`;
    setSubject(initialSubject);
    setBody(initialBody);

    (async () => {
      const [users, templates] = await Promise.all([
        User.list(),
        EmailTemplate.filter({ category: "invoice", is_active: true })
      ]);
      setAppUsers((users || []).map(u => u.email));
      setTemplates(templates || []);
    })();
    
  }, [open, invoice, company, possibleRecipients]);
  
  useEffect(() => {
    const template = templates.find(t => t.id === selectedTemplateId);
    if (template) {
      setSubject(renderTpl(template.subject, baseVars));
      setBody(renderTpl(template.body, baseVars));
    }
  }, [selectedTemplateId, templates, baseVars]);

  const handleSend = async () => {
    if (!recipient) {
      addNotification({ title: "Recipient missing", message: "Please select a recipient.", type: "error" });
      return;
    }
    
    // Platform limitation check
    if (!appUsers.includes(recipient)) {
      addNotification({
        title: "Cannot Send Email",
        message: `For security, emails can only be sent to registered app users. '${recipient}' is not a user.`,
        type: "warning",
        duration: 8000
      });
      return;
    }

    setSending(true);
    try {
      await sendAppEmail({
        to: recipient,
        subject,
        body
      });
      addNotification({ title: "Email Sent", message: `Invoice sent to ${recipient}`, type: "success" });
      onClose(true); // pass true to indicate success
    } catch (e) {
      console.error("Failed to send email:", e);
      addNotification({ title: "Send Failed", message: e.message || "Could not send email.", type: "error" });
    } finally {
      setSending(false);
    }
  };

  if (!open || !invoice) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => onClose(false)}>
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex" onClick={(e) => e.stopPropagation()}>
        
        {/* Left - Composer */}
        <div className="w-1/2 flex flex-col">
          <div className="p-6 border-b bg-white">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Send Invoice</h2>
              <Button variant="ghost" size="icon" onClick={() => onClose(false)} className="rounded-full"><X className="w-5 h-5" /></Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div>
              <Label>To</Label>
              <Select value={recipient} onValueChange={setRecipient}>
                <SelectTrigger><SelectValue placeholder="Select recipient..." /></SelectTrigger>
                <SelectContent>
                  {possibleRecipients.map(email => <SelectItem key={email} value={email}>{email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From</Label>
              <Input readOnly value={invoice.from_company || "Recruiter X"} className="bg-slate-100" />
            </div>
             <div>
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger><SelectValue placeholder="Select a template (optional)..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>No Template</SelectItem>
                  {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <Label>Body</Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} rows={10} />
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Paperclip className="w-4 h-4" />
              <span>A PDF of the invoice will be attached automatically.</span>
            </div>
          </div>
          <div className="p-6 border-t bg-white flex justify-end">
            <Button onClick={handleSend} disabled={sending} className="gap-2 bg-blue-600 hover:bg-blue-700 min-w-[120px]">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send Email</>}
            </Button>
          </div>
        </div>

        {/* Right - Preview */}
        <div className="w-1/2 bg-slate-100 border-l p-6 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg">
            <InvoicePreview invoice={invoice} />
          </div>
        </div>
      </div>
    </div>
  );
}