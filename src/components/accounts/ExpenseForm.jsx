
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

export default function ExpenseForm({ expense, onSave, onCancel, isClone }) {
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState(
    expense || {
      date: new Date().toISOString().slice(0, 10),
      name: "",
      type: "other",
      amount: "",
      location: "",
      payment_method: "other",
      vendor: "",
      source: "manual",
      notes: "",
      is_recurring: false,
      recurrence_frequency: "monthly",
      recurrence_end_date: "",
      currency: "USD",
      exchange_rate_to_usd: 1,
      amount_usd: 0,
    }
  );

  const update = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
  
  React.useEffect(() => {
    if (form.currency === "USD") {
      update("exchange_rate_to_usd", 1);
    }
  }, [form.currency]);

  React.useEffect(() => {
    const amountNum = parseFloat(form.amount) || 0;
    const rateNum = parseFloat(form.exchange_rate_to_usd) || 0;
    update("amount_usd", amountNum * rateNum);
  }, [form.amount, form.exchange_rate_to_usd]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, amount: form.amount ? Number(form.amount) : 0 };
    if (!payload.is_recurring) {
        payload.recurrence_frequency = null;
        payload.recurrence_end_date = null;
    }
    await onSave(payload);
    setSaving(false);
  };
  
  const title = isClone ? "Clone Expense" : (expense?.id ? "Edit Expense" : "New Expense");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <Card className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex items-center justify-between flex-row">
          <CardTitle>{title}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} required />
              </div>
              <div>
                <Label>Name <span className="text-red-500" aria-hidden="true">*</span></Label>
                <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v)=>update("type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salary">Salary</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="utilities">Utilities</SelectItem>
                    <SelectItem value="rent">Rent</SelectItem>
                    <SelectItem value="software">Software</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment Method</Label>
                <Select value={form.payment_method} onValueChange={(v)=>update("payment_method", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="debit_card">Debit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Card className="p-4 bg-slate-50">
              <p className="font-medium mb-3">Currency Information</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1">
                  <Label>Amount <span className="text-red-500" aria-hidden="true">*</span></Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={(e) => update("amount", e.target.value)} required />
                </div>
                 <div className="md:col-span-1">
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => update("currency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="INR">INR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.currency !== "USD" && (
                  <div className="md:col-span-1">
                    <Label>Exchange Rate to USD</Label>
                    <Input type="number" step="0.0001" value={form.exchange_rate_to_usd} onChange={(e) => update("exchange_rate_to_usd", e.target.value)} />
                  </div>
                )}
                <div className="md:col-span-1">
                  <Label>Amount (USD)</Label>
                  <Input value={(form.amount_usd || 0).toFixed(2)} readOnly className="bg-slate-100" />
                </div>
              </div>
            </Card>

            <div className="flex items-center gap-2 pt-2">
              <Checkbox id="is_recurring" checked={form.is_recurring} onCheckedChange={(c) => update("is_recurring", c)} />
              <Label htmlFor="is_recurring">This is a recurring expense</Label>
            </div>

            {form.is_recurring && (
              <Card className="p-4 bg-slate-50">
                <p className="font-medium mb-3">Recurrence Details</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Frequency</Label>
                     <Select value={form.recurrence_frequency} onValueChange={(v)=>update("recurrence_frequency", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>End Date (optional)</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {form.recurrence_end_date ? format(new Date(form.recurrence_end_date), 'PPP') : 'No end date'}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={form.recurrence_end_date ? new Date(form.recurrence_end_date) : undefined}
                                onSelect={(d) => update("recurrence_end_date", d ? d.toISOString().slice(0,10) : "")}
                            />
                        </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => update("location", e.target.value)} />
              </div>
              <div>
                <Label>Vendor</Label>
                <Input value={form.vendor} onChange={(e) => update("vendor", e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => update("notes", e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Expense
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
