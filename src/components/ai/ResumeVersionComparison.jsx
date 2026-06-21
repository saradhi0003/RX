import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  GitCompare, 
  TrendingUp, 
  TrendingDown,
  Plus,
  X,
  BarChart3
} from "lucide-react";

export default function ResumeVersionComparison() {
  const [versions, setVersions] = useState([]);
  const [jobDescription, setJobDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [comparisonResults, setComparisonResults] = useState(null);

  const handleVersionUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Process uploaded files
    const newVersions = await Promise.all(
      files.map(async (file, index) => ({
        id: Date.now() + index,
        name: file.name,
        file: file,
        score: null,
        analysis: null
      }))
    );

    setVersions(prev => [...prev, ...newVersions]);
  };

  const removeVersion = (versionId) => {
    setVersions(prev => prev.filter(v => v.id !== versionId));
  };

  const performComparison = async () => {
    if (versions.length < 2 || !jobDescription.trim()) {
      alert("Please upload at least 2 resume versions and provide a job description.");
      return;
    }

    setIsAnalyzing(true);
    // Here you would implement the actual comparison logic
    // For now, we'll simulate with mock data
    
    setTimeout(() => {
      const mockResults = {
        winner: versions[0],
        improvement: 15,
        comparison_matrix: versions.map((version, index) => ({
          ...version,
          score: Math.floor(Math.random() * 30) + 70,
          strengths: ["Technical skills", "Education alignment", "Experience match"],
          weaknesses: ["Missing soft skills", "Formatting issues"]
        }))
      };
      
      setComparisonResults(mockResults);
      setIsAnalyzing(false);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="w-5 h-5" />
            Resume Version Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Job Description</label>
            <textarea
              className="w-full p-3 border rounded-lg min-h-[100px]"
              placeholder="Paste job description for comparison baseline..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Upload Resume Versions</label>
            <input
              type="file"
              id="versions-upload"
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx"
              onChange={handleVersionUpload}
            />
            <label
              htmlFor="versions-upload"
              className="cursor-pointer flex items-center gap-3 p-4 border-2 border-dashed border-blue-200 rounded-lg hover:border-blue-400 transition-colors"
            >
              <Upload className="w-5 h-5 text-blue-600" />
              <span>Upload Multiple Resume Versions</span>
            </label>
          </div>

          {/* Uploaded Versions */}
          {versions.length > 0 && (
            <div>
              <h4 className="font-medium mb-3">Uploaded Versions ({versions.length})</h4>
              <div className="space-y-2">
                {versions.map((version) => (
                  <div key={version.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="font-medium">{version.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVersion(version.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={performComparison}
            disabled={versions.length < 2 || !jobDescription.trim() || isAnalyzing}
            className="w-full gap-2"
          >
            {isAnalyzing ? "Analyzing..." : "Compare Versions"}
          </Button>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {comparisonResults && (
        <div className="space-y-6">
          {/* Winner Announcement */}
          <Card>
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center gap-2 mb-4">
                <TrendingUp className="w-6 h-6 text-green-600" />
                <h3 className="text-xl font-bold">Best Performing Version</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900 mb-2">
                {comparisonResults.winner.name}
              </p>
              <Badge className="bg-green-100 text-green-800">
                +{comparisonResults.improvement}% improvement over lowest scorer
              </Badge>
            </CardContent>
          </Card>

          {/* Detailed Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Detailed Comparison Matrix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {comparisonResults.comparison_matrix.map((version, index) => (
                  <div key={version.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-semibold">{version.name}</h4>
                        <p className="text-sm text-slate-600">Version {index + 1}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{version.score}%</div>
                        <Progress value={version.score} className="w-24 h-2 mt-1" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-medium text-green-700 mb-2">Strengths</h5>
                        <ul className="space-y-1">
                          {version.strengths.map((strength, i) => (
                            <li key={i} className="text-sm text-green-600 flex items-start gap-2">
                              <TrendingUp className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              {strength}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium text-red-700 mb-2">Areas for Improvement</h5>
                        <ul className="space-y-1">
                          {version.weaknesses.map((weakness, i) => (
                            <li key={i} className="text-sm text-red-600 flex items-start gap-2">
                              <TrendingDown className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              {weakness}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}