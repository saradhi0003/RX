
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge"; // Added import for Badge
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Loader2, Eye, Search, Check } from "lucide-react";
import { EmailTemplate } from "@/entities/EmailTemplate";
import InvoicePreview from "@/components/accounts/InvoicePreview";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

// Searchable Company Lookup Component
const CompanyLookup = ({ companies = [], value, onChange, placeholder = "Search companies..." }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredCompanies = companies.filter(company => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      company.name?.toLowerCase().includes(query) ||
      company.industry?.toLowerCase().includes(query) ||
      company.location?.toLowerCase().includes(query)
    );
  });

  const selectedCompany = companies.find(comp => comp.id === value);

  const handleSelect = (company) => {
    onChange(company.id);
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
          className="w-full justify-between h-10"
        >
          {selectedCompany ? selectedCompany.name : placeholder}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <div className="p-3 border-b">
          <Input
            placeholder="Type to search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="max-h-60 overflow-auto">
          {filteredCompanies.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">No companies found</div>
          ) : (
            filteredCompanies.map((company) => (
              <div
                key={company.id}
                className={`cursor-pointer p-3 hover:bg-slate-100 border-b border-slate-50 ${
                  value === company.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => handleSelect(company)}
              >
                <div className="flex items-center">
                  {value === company.id && <Check className="mr-2 h-4 w-4 text-blue-600" />}
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">{company.name}</div>
                    {(company.industry || company.location) && (
                      <div className="text-sm text-slate-500">
                        {[company.industry, company.location].filter(Boolean).join(" • ")}
                      </div>
                    )}
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

export default function InvoiceForm({ invoice, companies = [], onSave, onCancel }) {
  const genNumber = () => {
    const d = new Date();
    return `INV-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${Math.floor(Math.random()*9000+1000)}`;
  };
  
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState(invoice || {
    invoice_number: genNumber(),
    company_id: "",
    bill_to_name: "",
    bill_to_email: "",
    bill_to_address: "",
    issue_date: new Date().toISOString().slice(0,10),
    due_date: new Date(Date.now()+30*86400000).toISOString().slice(0,10), // 30 days from now
    currency: "USD",
    items: [{ description: "", quantity: 1, unit_price: 0, amount: 0 }],
    tax_rate: 0,
    subtotal: 0,
    tax_amount: 0,
    total: 0,
    status: "draft",
    notes: "",
    email_template_id: null,
    brand_logo_url: "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/291ea5029_TalentStackCorporateImages-1.png",
    from_company: "Talent Stack Talent & Acquisitions",
    from_address: "123 Main Street, Suite 400\nNew York, NY 10001",
    payment_instructions: "All fees are listed in USD and may be subject to applicable taxes."
  });
  
  const [templates, setTemplates] = React.useState([]);
  const [showPreview, setShowPreview] = React.useState(false);

  const recalc = (draft) => {
    const items = (draft.items || []).map(it => ({ ...it, amount: Number(it.quantity || 0) * Number(it.unit_price || 0) }));
    const subtotal = items.reduce((s, it) => s + Number(it.amount || 0), 0);
    const tax_amount = subtotal * (Number(draft.tax_rate || 0) / 100);
    const total = subtotal + tax_amount;
    return { ...draft, items, subtotal, tax_amount, total };
  };

  const updateField = (k, v) => setForm(prev => recalc({ ...prev, [k]: v }));
  const updateItem = (idx, k, v) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [k]: v };
    setForm(prev => recalc({ ...prev, items }));
  };
  const addItem = () => setForm(prev => recalc({ ...prev, items: [...prev.items, { description: "", quantity: 1, unit_price: 0, amount: 0 }] }));
  const removeItem = (idx) => setForm(prev => recalc({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(recalc(form));
    setSaving(false);
  };

  // Auto-populate bill-to info when company changes
  React.useEffect(() => {
    if (form.company_id && (!form.bill_to_name || !form.bill_to_email || !form.bill_to_address)) {
      const comp = companies.find(c => c.id === form.company_id);
      if (comp) {
        const contact = comp.contacts?.find(c => c.is_primary) || comp.contacts?.[0];
        setForm(prev => ({
          ...prev,
          bill_to_name: contact?.name || comp.name || prev.bill_to_name,
          bill_to_email: contact?.email || prev.bill_to_email,
          bill_to_address: comp.address || prev.bill_to_address
        }));
      }
    }
  }, [form.company_id, form.bill_to_name, form.bill_to_email, form.bill_to_address, companies]); // Updated dependencies

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const list = await EmailTemplate.list("-updated_date");
      const inv = (list || []).filter(t => (t.category || "custom") === "invoice" && t.is_active !== false);
      if (mounted) setTemplates(inv);
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex" onClick={(e)=>e.stopPropagation()}>
        
        {/* Left Panel - Form */}
        <div className="w-1/2 flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{invoice ? "Edit Invoice" : "Create Invoice"}</h2>
              <p className="text-sm text-slate-600 mt-1">Fill in the details below to generate your invoice</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={onSubmit} className="space-y-6">
              
              {/* Invoice Details */}
              <Card className="border-2 border-blue-100">
                <CardHeader className="bg-blue-50 rounded-t-lg">
                  <CardTitle className="text-lg text-blue-900">Invoice Details</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-semibold text-slate-700">Invoice Number <span className="text-red-500" aria-hidden="true">*</span></Label>
                      <Input 
                        value={form.invoice_number} 
                        onChange={(e)=>updateField("invoice_number", e.target.value)} 
                        className="mt-1 border-2 focus:border-blue-400"
                        required 
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-slate-700">Currency</Label>
                      <Select value={form.currency} onValueChange={(v)=>updateField("currency", v)}>
                        <SelectTrigger className="mt-1 border-2 focus:border-blue-400">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-semibold text-slate-700">Issue Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left mt-1 border-2 focus:border-blue-400">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {form.issue_date ? format(new Date(form.issue_date), 'PPP') : 'Select date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={form.issue_date ? new Date(form.issue_date) : undefined}
                            onSelect={(date) => updateField("issue_date", date?.toISOString().slice(0,10))}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-slate-700">Due Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left mt-1 border-2 focus:border-blue-400">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {form.due_date ? format(new Date(form.due_date), 'PPP') : 'Select date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={form.due_date ? new Date(form.due_date) : undefined}
                            onSelect={(date) => updateField("due_date", date?.toISOString().slice(0,10))}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bill To */}
              <Card className="border-2 border-green-100">
                <CardHeader className="bg-green-50 rounded-t-lg">
                  <CardTitle className="text-lg text-green-900">Bill To</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">Company</Label>
                    <div className="mt-1">
                      <CompanyLookup 
                        companies={companies}
                        value={form.company_id}
                        onChange={(id) => updateField("company_id", id)}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-semibold text-slate-700">Contact Name</Label>
                      <Input 
                        value={form.bill_to_name} 
                        onChange={(e)=>updateField("bill_to_name", e.target.value)} 
                        className="mt-1 border-2 focus:border-green-400"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-slate-700">Email</Label>
                      <Input 
                        type="email"
                        value={form.bill_to_email} 
                        onChange={(e)=>updateField("bill_to_email", e.target.value)} 
                        className="mt-1 border-2 focus:border-green-400"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">Billing Address</Label>
                    <Input 
                      value={form.bill_to_address} 
                      onChange={(e)=>updateField("bill_to_address", e.target.value)} 
                      className="mt-1 border-2 focus:border-green-400"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Line Items */}
              <Card className="border-2 border-purple-100">
                <CardHeader className="bg-purple-50 rounded-t-lg">
                  <CardTitle className="text-lg text-purple-900 flex items-center justify-between">
                    Line Items
                    <Button type="button" onClick={addItem} size="sm" className="bg-purple-600 hover:bg-purple-700">
                      <Plus className="w-4 h-4 mr-1" /> Add Item
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                        <div className="grid grid-cols-12 gap-3 items-end">
                          <div className="col-span-5">
                            <Label className="text-xs font-semibold text-slate-600">Description</Label>
                            <Input 
                              value={item.description}
                              onChange={(e)=>updateItem(idx, "description", e.target.value)}
                              placeholder="Service description"
                              className="mt-1"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs font-semibold text-slate-600">Qty</Label>
                            <Input 
                              type="number"
                              step="0.01"
                              value={item.quantity}
                              onChange={(e)=>updateItem(idx, "quantity", Number(e.target.value))}
                              className="mt-1"
                            />
                          </div>
                          <div className="col-span-3">
                            <Label className="text-xs font-semibold text-slate-600">Unit Price</Label>
                            <Input 
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e)=>updateItem(idx, "unit_price", Number(e.target.value))}
                              className="mt-1"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs font-semibold text-slate-600">Amount</Label>
                            <div className="mt-1 p-2 bg-slate-100 rounded border text-right font-mono">
                              ${item.amount.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        {form.items.length > 1 && (
                          <div className="mt-2 flex justify-end">
                            <Button 
                              type="button" 
                              variant="outline" 
                              size="sm" 
                              onClick={() => removeItem(idx)}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Totals & Tax */}
              <Card className="border-2 border-orange-100">
                <CardHeader className="bg-orange-50 rounded-t-lg">
                  <CardTitle className="text-lg text-orange-900">Calculations</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-semibold text-slate-700">Subtotal</Label>
                      <div className="mt-1 p-3 bg-slate-100 rounded border text-right font-mono text-lg">
                        ${form.subtotal.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-slate-700">Tax Rate (%)</Label>
                      <Input 
                        type="number" 
                        step="0.01" 
                        value={form.tax_rate} 
                        onChange={(e)=>updateField("tax_rate", Number(e.target.value))} 
                        className="mt-1 border-2 focus:border-orange-400"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold text-slate-700">Total Due</Label>
                      <div className="mt-1 p-3 bg-blue-100 rounded border text-right font-mono text-xl font-bold text-blue-900">
                        ${form.total.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card className="border-2 border-slate-100">
                <CardHeader className="bg-slate-50 rounded-t-lg">
                  <CardTitle className="text-lg text-slate-900">Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">Notes</Label>
                    <Input 
                      value={form.notes} 
                      onChange={(e)=>updateField("notes", e.target.value)} 
                      placeholder="Payment terms, special instructions..."
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm font-semibold text-slate-700">Email Template</Label>
                    <Select value={form.email_template_id || ""} onValueChange={(v)=>updateField("email_template_id", v === "" ? null : v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select template (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>No template</SelectItem>
                        {templates.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between items-center pt-6 border-t">
                <Button type="button" variant="outline" onClick={onCancel} size="lg">
                  Cancel
                </Button>
                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowPreview(true)} 
                    size="lg"
                    className="gap-2"
                  >
                    <Eye className="w-4 h-4" /> Preview
                  </Button>
                  <Button type="submit" disabled={saving} size="lg" className="gap-2 bg-blue-600 hover:bg-blue-700">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Invoice
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Right Panel - Live Preview */}
        <div className="w-1/2 bg-slate-50 border-l border-slate-200 overflow-y-auto">
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Live Preview</h3>
              <Badge className="bg-blue-100 text-blue-800">Auto-updating</Badge>
            </div>
            <div className="bg-white rounded-lg shadow-lg">
              <InvoicePreview invoice={form} />
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={()=>setShowPreview(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-auto p-6" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Invoice Preview</h3>
              <Button variant="ghost" size="icon" onClick={()=>setShowPreview(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <InvoicePreview invoice={form} />
          </div>
        </div>
      )}
    </div>
  );
}
