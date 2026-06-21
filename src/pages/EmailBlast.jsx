import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  Copy, 
  Send, 
  Users, 
  Building2, 
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Download
} from "lucide-react";
import { Company } from "@/entities/Company";
import * as Core from "@/integrations/Core";
import { addNotification } from "@/components/notifications/NotificationToast";
import PageHeader from "@/components/common/PageHeader";
import Breadcrumbs from "@/components/common/Breadcrumbs";

export default function EmailBlast() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailList, setEmailList] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [stats, setStats] = useState({
    totalCompanies: 0,
    totalContacts: 0,
    uniqueEmails: 0
  });
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const data = await Company.list("-updated_date");
      setCompanies(data || []);
      
      // Select all by default
      setSelectedCompanies(data.map(c => c.id));
      
      // Calculate stats
      const emails = new Set();
      let contactCount = 0;
      
      data.forEach(company => {
        if (company.contacts && Array.isArray(company.contacts)) {
          company.contacts.forEach(contact => {
            if (contact.email) {
              emails.add(contact.email.toLowerCase());
              contactCount++;
            }
          });
        }
      });
      
      setStats({
        totalCompanies: data.length,
        totalContacts: contactCount,
        uniqueEmails: emails.size
      });
      
      // Generate email list
      updateEmailList(data, data.map(c => c.id));
    } catch (error) {
      console.error("Error loading companies:", error);
      addNotification({
        type: "error",
        title: "Load Failed",
        message: "Failed to load companies"
      });
    }
    setLoading(false);
  };

  const updateEmailList = (allCompanies, selectedIds) => {
    const emails = new Set();
    
    allCompanies
      .filter(c => selectedIds.includes(c.id))
      .forEach(company => {
        if (company.contacts && Array.isArray(company.contacts)) {
          company.contacts.forEach(contact => {
            if (contact.email) {
              emails.add(contact.email.toLowerCase());
            }
          });
        }
      });
    
    setEmailList(Array.from(emails).join(", "));
  };

  const toggleCompany = (companyId) => {
    const newSelected = selectedCompanies.includes(companyId)
      ? selectedCompanies.filter(id => id !== companyId)
      : [...selectedCompanies, companyId];
    
    setSelectedCompanies(newSelected);
    updateEmailList(companies, newSelected);
  };

  const selectAll = () => {
    setSelectedCompanies(companies.map(c => c.id));
    updateEmailList(companies, companies.map(c => c.id));
  };

  const deselectAll = () => {
    setSelectedCompanies([]);
    setEmailList("");
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(emailList);
    addNotification({
      type: "success",
      title: "Copied",
      message: "Email addresses copied to clipboard"
    });
  };

  const generateAIMessage = async () => {
    if (!subject) {
      addNotification({
        type: "warning",
        title: "Subject Required",
        message: "Please enter a subject first"
      });
      return;
    }

    setGenerating(true);
    try {
      const response = await Core.InvokeLLM({
        prompt: `You are a professional business email writer for a recruitment agency.

Write a compelling email blast for the following purpose:
Subject: ${subject}

Requirements:
- Professional and engaging tone
- Clear value proposition
- Brief introduction of our recruitment services
- Call-to-action to respond or schedule a call
- 3-4 short paragraphs maximum
- Include bullet points highlighting our key services:
  * AI-powered candidate matching
  * Technical and non-technical recruiting
  * Flexible engagement models (contract, full-time, contract-to-hire)
  * Fast turnaround times
- Professional signature template

Write the email body:`,
        response_json_schema: {
          type: "object",
          properties: {
            email_body: { type: "string" }
          }
        }
      });

      setMessage(response.email_body || response);
      addNotification({
        type: "success",
        title: "Email Generated",
        message: "AI-generated email is ready"
      });
    } catch (error) {
      console.error("Error generating email:", error);
      addNotification({
        type: "error",
        title: "Generation Failed",
        message: "Failed to generate email"
      });
    }
    setGenerating(false);
  };

  const exportToCSV = () => {
    const emails = emailList.split(", ");
    const csv = "Email\n" + emails.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "email-list.csv";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    
    addNotification({
      type: "success",
      title: "Exported",
      message: "Email list exported to CSV"
    });
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <Breadcrumbs items={[{ label: "Email Blast" }]} />
        <PageHeader title="Email Blast" subtitle="Construct email campaigns for connections" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Breadcrumbs items={[{ label: "Email Blast" }]} />
      
      <PageHeader
        title="Email Blast"
        subtitle="Construct email campaigns for your connections"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Building2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Companies</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalCompanies}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Contacts</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalContacts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Mail className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Unique Emails</p>
                <p className="text-2xl font-bold text-slate-900">{stats.uniqueEmails}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Select Companies</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  All
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  None
                </Button>
              </div>
            </div>
            <p className="text-sm text-slate-600 mt-2">
              {selectedCompanies.length} of {companies.length} selected
            </p>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            <div className="space-y-2">
              {companies.map(company => {
                const contactCount = (company.contacts || []).filter(c => c.email).length;
                return (
                  <label
                    key={company.id}
                    className="flex items-start gap-3 p-3 rounded-lg border hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCompanies.includes(company.id)}
                      onChange={() => toggleCompany(company.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{company.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {company.industry && (
                          <Badge variant="outline" className="text-xs">
                            {company.industry}
                          </Badge>
                        )}
                        <span className="text-xs text-slate-500">
                          {contactCount} contact{contactCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Email Construction */}
        <div className="lg:col-span-2 space-y-6">
          {/* Email List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Email List (Comma-Separated)</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    disabled={!emailList}
                    className="gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToCSV}
                    disabled={!emailList}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={emailList}
                onChange={(e) => setEmailList(e.target.value)}
                className="min-h-32 font-mono text-sm"
                placeholder="Selected email addresses will appear here..."
              />
              <p className="text-xs text-slate-500 mt-2">
                {emailList.split(", ").filter(e => e).length} email addresses
              </p>
            </CardContent>
          </Card>

          {/* Email Composer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compose Email</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Subject</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject line..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Message</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateAIMessage}
                    disabled={generating || !subject}
                    className="gap-2"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate with AI
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-64"
                  placeholder="Write your email message or use AI to generate..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Next Steps:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Copy the email list above</li>
                      <li>Open your email client (Gmail, Outlook, etc.)</li>
                      <li>Paste emails into BCC field for privacy</li>
                      <li>Copy the subject and message</li>
                      <li>Send the email blast!</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button
                  className="w-full gap-2"
                  onClick={() => {
                    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
                    window.location.href = mailtoLink;
                  }}
                  disabled={!emailList || !subject || !message}
                >
                  <Mail className="w-4 h-4" />
                  Open in Email Client
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}