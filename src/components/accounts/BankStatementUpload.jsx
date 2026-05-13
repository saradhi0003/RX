/**
 * Bank statement → Expenses bookkeeping flow.
 *
 *  1. User picks a PDF bank/credit-card statement.
 *  2. pdfjs-dist extracts the raw text in-browser (no server PDF parsing).
 *  3. LLM (via existing invokeLLMJson) classifies each transaction row and
 *     returns a JSON list shaped like Expense.create() payloads.
 *  4. User reviews the proposed expenses in a table, edits inline, removes
 *     anything they don't want, then clicks "Save N Expenses" which bulk-
 *     inserts via Expense.create().
 */
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Upload, X, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { invokeLLMJson } from "@/lib/llm";
import { Expense } from "@/entities/Expense";
import { addNotification } from "@/components/notifications/NotificationToast";

const EXPENSE_TYPES = ["salary", "maintenance", "travel", "utilities", "rent", "software", "marketing", "office", "other"];

const PARSE_SYSTEM = `You are a bookkeeping assistant. Given raw text extracted
from a bank or credit-card statement, return a JSON array of every debit
transaction (money out). For each row return:

  date: ISO date string YYYY-MM-DD
  description: cleaned merchant / payee name (strip codes, store numbers, ref ids)
  amount: positive number in the statement's currency
  currency: ISO 4217 code if visible, else "USD"
  type: one of [salary, maintenance, travel, utilities, rent, software, marketing, office, other]
  location: city or country if visible, else null
  raw: the original line as text

Skip credits (deposits, refunds, payments to the card, transfers in). Skip
opening/closing balances, fees that are already included in another line, and
summary totals. Return ONLY the JSON array, no prose.`;

async function extractPdfText(file) {
  // pdfjs-dist is large (~2MB). Lazy-load it only when needed.
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it) => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  return text;
}

export default function BankStatementUpload({ open, onClose, onSaved }) {
  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  if (!open) return null;

  const reset = () => {
    setFile(null); setRows([]); setError("");
    setExtracting(false); setParsing(false); setSaving(false);
  };

  const close = () => { reset(); onClose && onClose(); };

  const handleParse = async () => {
    if (!file) return;
    setError("");
    setExtracting(true);
    let text = "";
    try {
      text = await extractPdfText(file);
      if (!text.trim()) throw new Error("No text could be extracted from this PDF — it may be a scanned image. Try a digital statement.");
    } catch (e) {
      setError(e.message || "PDF extraction failed");
      setExtracting(false);
      return;
    }
    setExtracting(false);
    setParsing(true);
    try {
      // Cap the text we send to the LLM — most statements have <50 pages of
      // useful text. 60k chars ≈ 15k tokens which is safe across providers.
      const truncated = text.length > 60000 ? text.slice(0, 60000) + "\n...[truncated]" : text;
      const result = await invokeLLMJson({
        system: PARSE_SYSTEM,
        prompt: `Statement text follows. Return JSON array of debit transactions.\n\n${truncated}`,
        max_tokens: 4000,
        task: "bank_statement_parse",
      });
      const list = Array.isArray(result) ? result : (result?.transactions || []);
      if (!list.length) throw new Error("The LLM didn't find any debit transactions in this statement.");
      setRows(list.map((r, i) => ({ ...r, _id: `tx-${i}`, selected: true })));
    } catch (e) {
      setError(e.message || "Parsing failed");
    } finally {
      setParsing(false);
    }
  };

  const updateRow = (id, patch) =>
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, ...patch } : r)));

  const toggleRow = (id) =>
    setRows((rs) => rs.map((r) => (r._id === id ? { ...r, selected: !r.selected } : r)));

  const removeRow = (id) =>
    setRows((rs) => rs.filter((r) => r._id !== id));

  const handleSave = async () => {
    const selected = rows.filter((r) => r.selected);
    if (!selected.length) return;
    setSaving(true);
    let okCount = 0;
    try {
      for (const r of selected) {
        await Expense.create({
          date: r.date,
          name: r.description?.slice(0, 200) || "Bank statement entry",
          type: EXPENSE_TYPES.includes(r.type) ? r.type : "other",
          amount_usd: Number(r.amount) || 0,
          amount_original: Number(r.amount) || 0,
          currency_original: r.currency || "USD",
          location: r.location || null,
          source: "bank_statement",
          notes: r.raw ? `Imported from ${file.name}: ${r.raw}` : `Imported from ${file.name}`,
        });
        okCount++;
      }
      addNotification({ type: "success", title: "Saved", message: `Imported ${okCount} expenses from ${file.name}` });
      onSaved && onSaved(okCount);
      close();
    } catch (e) {
      setError(`Saved ${okCount}/${selected.length} — error on next row: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                 style={{ background: "linear-gradient(135deg,#FAF5FF 0%,#EFF6FF 100%)" }}>
              <FileText className="w-4 h-4" style={{ color: "#9333EA" }} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[.08em]" style={{ color: "#9333EA" }}>
                Bookkeeping
              </div>
              <h3 className="font-semibold text-slate-900 text-sm -mt-0.5">Upload Bank Statement</h3>
            </div>
          </div>
          <button onClick={close} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <CardContent className="flex-1 overflow-auto p-6 space-y-4">

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!rows.length && (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                Pick a bank or credit-card statement PDF. The text is extracted in your
                browser, then sent to the LLM to classify each transaction. Nothing
                else is uploaded.
              </p>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Statement PDF</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => { setFile(e.target.files?.[0] || null); setError(""); }}
                  className="block w-full mt-1.5 text-sm text-slate-700 file:mr-3 file:py-2 file:px-3
                             file:rounded-lg file:border-0 file:text-sm file:font-medium
                             file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </label>

              {file && (
                <div className="text-xs text-slate-600">
                  Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleParse}
                  disabled={!file || extracting || parsing}
                  className="gap-2"
                  style={{ background: "linear-gradient(135deg,#9333EA 0%,#2563EB 100%)", color: "#fff" }}
                >
                  {extracting ? <><Loader2 className="w-4 h-4 animate-spin" /> Extracting text…</> :
                   parsing    ? <><Loader2 className="w-4 h-4 animate-spin" /> Classifying transactions…</> :
                                <><Upload className="w-4 h-4" /> Extract Transactions</>}
                </Button>
              </div>
            </div>
          )}

          {rows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-slate-700">
                  <strong>{rows.filter((r) => r.selected).length}</strong> of {rows.length} selected
                </div>
                <button
                  onClick={() => setRows((rs) => rs.map((r) => ({ ...r, selected: !rs.every((x) => x.selected) })))}
                  className="text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Toggle all
                </button>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <tr>
                      <th className="px-2 py-2 w-8"></th>
                      <th className="px-2 py-2 text-left w-28">Date</th>
                      <th className="px-2 py-2 text-left">Description</th>
                      <th className="px-2 py-2 text-left w-28">Type</th>
                      <th className="px-2 py-2 text-right w-28">Amount</th>
                      <th className="px-2 py-2 text-left w-16">Cur.</th>
                      <th className="px-2 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r._id} className="border-t border-slate-100">
                        <td className="px-2 py-1.5">
                          <input type="checkbox" checked={!!r.selected} onChange={() => toggleRow(r._id)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="date" value={r.date || ""} onChange={(e) => updateRow(r._id, { date: e.target.value })} className="h-8 text-xs" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input value={r.description || ""} onChange={(e) => updateRow(r._id, { description: e.target.value })} className="h-8 text-xs" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Select value={r.type || "other"} onValueChange={(v) => updateRow(r._id, { type: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {EXPENSE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5">
                          <Input type="number" step="0.01" value={r.amount ?? ""} onChange={(e) => updateRow(r._id, { amount: e.target.value })} className="h-8 text-xs text-right" />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input value={r.currency || "USD"} onChange={(e) => updateRow(r._id, { currency: e.target.value.toUpperCase() })} className="h-8 text-xs uppercase" maxLength={3} />
                        </td>
                        <td className="px-2 py-1.5">
                          <button onClick={() => removeRow(r._id)} className="text-slate-400 hover:text-red-600" aria-label="Remove row">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </CardContent>

        {rows.length > 0 && (
          <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200">
            <Button variant="ghost" onClick={close} disabled={saving}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !rows.some((r) => r.selected)}
              className="gap-2"
              style={{ background: "linear-gradient(135deg,#9333EA 0%,#2563EB 100%)", color: "#fff" }}
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><CheckCircle2 className="w-4 h-4" /> Save {rows.filter((r) => r.selected).length} Expenses</>}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
