
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Save, GitCompare } from "lucide-react";
import { computeScore } from "@/components/common/scoring";

export default function VersionsCompare({ currentData, resumeText, jdText }) {
  const [snapshots, setSnapshots] = useState([]);
  const [aIdx, setAIdx] = useState(null);
  const [bIdx, setBIdx] = useState(null);

  const saveSnapshot = () => {
    const s = computeScore({ resumeData: currentData, resumeText, jdText });
    const snap = {
      id: Date.now(),
      when: new Date().toLocaleString(),
      data: JSON.parse(JSON.stringify(currentData)),
      score: s.overall_score
    };
    setSnapshots(prev => [snap, ...prev]);
  };

  const a = aIdx != null ? snapshots[aIdx] : null;
  const b = bIdx != null ? snapshots[bIdx] : null;

  const diffSkills = () => {
    if (!a || !b) return [];
    const setA = new Set(a.data.skills || []);
    const setB = new Set(b.data.skills || []);
    const added = [...setB].filter(x => !setA.has(x));
    const removed = [...setA].filter(x => !setB.has(x));
    return { added, removed };
    };

  const diff = diffSkills();

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <GitCompare className="w-5 h-5" /> Version Snapshots & Comparison
        </CardTitle>
        <Button size="sm" onClick={saveSnapshot}><Save className="w-4 h-4 mr-1" /> Save Snapshot</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Key Title</TableHead>
              <TableHead>Skills</TableHead>
              <TableHead className="w-28 text-right">Score</TableHead>
              <TableHead className="w-12 text-right">Pick</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshots.map((s, idx) => (
              <TableRow key={s.id}>
                <TableCell>{s.when}</TableCell>
                <TableCell>{s.data.headline || s.data.experiences?.[0]?.role || "—"}</TableCell>
                <TableCell className="text-xs text-slate-600 truncate max-w-[240px]">{(s.data.skills || []).join(", ")}</TableCell>
                <TableCell className="text-right font-semibold">{s.score}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <input type="radio" name="pickA" onChange={() => setAIdx(idx)} title="Pick A" />
                    <input type="radio" name="pickB" onChange={() => setBIdx(idx)} title="Pick B" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {a && b && (
          <div className="mt-3">
            <p className="text-sm font-medium">Comparing:</p>
            <p className="text-xs text-slate-600">A: {a.when} (Score {a.score}) vs B: {b.when} (Score {b.score})</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div>
                <p className="text-sm font-medium">Skills Added in B</p>
                <ul className="list-disc ml-5 text-sm">
                  {diff.added.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium">Skills Removed in B</p>
                <ul className="list-disc ml-5 text-sm">
                  {diff.removed.map((x, i) => <li key={i}>{x}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
