import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Download, Save, Zap } from "lucide-react";
import { Candidate, Resume } from "@/entities/all";
import ResumeFormLeft from "../components/resume/ResumeFormLeft";
import ResumePreview from "../components/resume/ResumePreview";

export default function ResumeBuilder() {
  const [candidates, setCandidates] = useState([]);
  const [data, setData] = useState({
    name: "John Doe",
    headline: "Software engineer obsessed with building exceptional products that people love",
    email: "hello@example.com",
    phone: "123-456-7890",
    location: "NYC, NY",
    linkedin: "linkedin.com/in/johndoe",
    summary: "",
    experiences: [],
    education: [],
    projects: [],
    skills: [],
    theme_color: "#3b82f6"
  });
  const [zoom, setZoom] = useState(0.72);
  const [autoscale, setAutoscale] = useState(true);
  const containerRef = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      const cands = await Candidate.list("-updated_date", 50);
      setCandidates(cands);
    };
    load();
  }, []);

  useEffect(() => {
    if (!autoscale) return;
    const resize = () => {
      if (!containerRef.current) return;
      const available = containerRef.current.clientWidth - 24; // padding
      const baseWidth = 816;
      const s = Math.max(0.4, Math.min(1.1, available / baseWidth));
      setZoom(Number(s.toFixed(2)));
    };
    resize();
    const obs = new ResizeObserver(resize);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [autoscale]);

  const saveResume = async () => {
    if (data.id) {
      await Resume.update(data.id, data);
    } else {
      const created = await Resume.create(data);
      setData(prev => ({ ...prev, id: created.id }));
    }
    alert("Resume saved.");
  };

  const downloadPDF = () => {
    // Open a print window for the preview content
    const html = previewRef.current?.outerHTML;
    if (!html) return;
    const w = window.open("", "PRINT", "width=900,height=1200");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Resume</title>
          <style>
            @page { size: letter; margin: 0; }
            body { margin: 0; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 300);
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Resume Builder</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={saveResume}>
            <Save className="w-4 h-4 mr-2" /> Save
          </Button>
          <Button onClick={downloadPDF}>
            <Download className="w-4 h-4 mr-2" /> Download Resume
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Form */}
        <div className="space-y-4">
          <ResumeFormLeft candidates={candidates} data={data} setData={setData} />
        </div>

        {/* Right: Preview + controls */}
        <div className="space-y-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <Label className="text-sm">Zoom</Label>
                  <div className="w-40">
                    <input
                      type="range"
                      min={40}
                      max={110}
                      value={Math.round(zoom * 100)}
                      onChange={(e) => {
                        setZoom(Number(e.target.value) / 100);
                      }}
                      disabled={autoscale}
                      className="w-full"
                    />
                  </div>
                  <span className="text-sm text-slate-600">{Math.round(zoom * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="autoscale"
                    type="checkbox"
                    checked={autoscale}
                    onChange={(e) => setAutoscale(e.target.checked)}
                  />
                  <Label htmlFor="autoscale" className="text-sm">Autoscale</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card ref={containerRef}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-700">Live Preview</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto">
              <ResumePreview ref={previewRef} data={data} scale={zoom} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}