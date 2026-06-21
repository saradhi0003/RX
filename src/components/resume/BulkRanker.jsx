
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2 } from "lucide-react";
import { UploadFile, ExtractDataFromUploadedFile } from "@/integrations/Core";
import { computeScore } from "@/components/common/scoring";

export default function BulkRanker({ jdText, resumeDataTemplate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setLoading(true);
    try {
      const processed = [];
      for (const file of files) {
        const { file_url } = await UploadFile({ file });
        const parsed = await ExtractDataFromUploadedFile({
          file_url,
          json_schema: { type: "object", properties: { full_text: { type: "string" } } }
        });
        const full = parsed.status === "success" ? (parsed.output?.full_text || "") : "";
        const score = computeScore({ resumeData: resumeDataTemplate, resumeText: full, jdText });
        processed.push({ name: file.name, score: score.overall_score });
      }
      processed.sort((a, b) => b.score - a.score);
      setRows(processed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Bulk Resume Ranking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="text-sm text-blue-600 hover:underline cursor-pointer inline-flex items-center gap-2">
          <Upload className="w-4 h-4" />
          <input type="file" className="hidden" accept=".pdf,.doc,.docx,.txt" multiple onChange={handleUpload} />
          Upload multiple resumes
        </label>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-600"><Loader2 className="w-4 h-4 animate-spin" /> Scoring...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resume</TableHead>
                <TableHead className="w-32 text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={`${r.name}-${i}`}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-right font-semibold">{r.score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
