import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save } from "lucide-react";

export default function MatchingProfileEditor({ profile, onSave, onCancel }) {
  const [editedProfile, setEditedProfile] = useState(profile || {
    name: "",
    job_type: "general",
    criteria_weights: {
      technical_skills: 30,
      experience_years: 20,
      role_seniority: 15,
      domain_expertise: 15,
      soft_skills: 10,
      education: 5,
      location_fit: 5
    },
    required_skills: [],
    soft_skills_keywords: [],
    ai_model: "auto",
    matching_strategy: "balanced",
    learning_enabled: true,
    is_active: true
  });

  const [newSkill, setNewSkill] = useState("");
  const [newKeyword, setNewKeyword] = useState("");

  const updateWeight = (key, value) => {
    setEditedProfile({
      ...editedProfile,
      criteria_weights: {
        ...editedProfile.criteria_weights,
        [key]: value[0]
      }
    });
  };

  const addSkill = () => {
    if (!newSkill.trim()) return;
    setEditedProfile({
      ...editedProfile,
      required_skills: [
        ...(editedProfile.required_skills || []),
        { skill: newSkill, importance: "preferred", min_years: 0 }
      ]
    });
    setNewSkill("");
  };

  const removeSkill = (index) => {
    setEditedProfile({
      ...editedProfile,
      required_skills: editedProfile.required_skills.filter((_, i) => i !== index)
    });
  };

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    setEditedProfile({
      ...editedProfile,
      soft_skills_keywords: [...(editedProfile.soft_skills_keywords || []), newKeyword]
    });
    setNewKeyword("");
  };

  const removeKeyword = (index) => {
    setEditedProfile({
      ...editedProfile,
      soft_skills_keywords: editedProfile.soft_skills_keywords.filter((_, i) => i !== index)
    });
  };

  const totalWeight = Object.values(editedProfile.criteria_weights || {}).reduce((sum, val) => sum + val, 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <Card className="w-full max-w-4xl my-8">
        <CardHeader>
          <CardTitle>Configure Matching Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Profile Name</Label>
              <Input
                value={editedProfile.name}
                onChange={(e) => setEditedProfile({...editedProfile, name: e.target.value})}
                placeholder="e.g., Senior Engineer Match"
              />
            </div>
            <div>
              <Label>Job Type</Label>
              <Select
                value={editedProfile.job_type}
                onValueChange={(val) => setEditedProfile({...editedProfile, job_type: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="executive">Executive</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Criteria Weights */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label>Criteria Weights</Label>
              <div className={`text-sm ${totalWeight === 100 ? "text-green-600" : "text-red-600"}`}>
                Total: {totalWeight}% {totalWeight !== 100 && "(Should equal 100%)"}
              </div>
            </div>
            <div className="space-y-4">
              {Object.entries(editedProfile.criteria_weights || {}).map(([key, value]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="text-sm font-semibold">{value}%</span>
                  </div>
                  <Slider
                    value={[value]}
                    onValueChange={(val) => updateWeight(key, val)}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Required Skills */}
          <div>
            <Label className="mb-2 block">Required Skills</Label>
            <div className="flex gap-2 mb-3">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Add skill..."
                onKeyPress={(e) => e.key === "Enter" && addSkill()}
              />
              <Button onClick={addSkill} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(editedProfile.required_skills || []).map((skill, idx) => (
                <Badge key={idx} variant="secondary" className="gap-2">
                  {skill.skill} ({skill.importance})
                  <button onClick={() => removeSkill(idx)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Soft Skills Keywords */}
          <div>
            <Label className="mb-2 block">Soft Skills Keywords</Label>
            <div className="flex gap-2 mb-3">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Add keyword..."
                onKeyPress={(e) => e.key === "Enter" && addKeyword()}
              />
              <Button onClick={addKeyword} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(editedProfile.soft_skills_keywords || []).map((keyword, idx) => (
                <Badge key={idx} variant="outline" className="gap-2">
                  {keyword}
                  <button onClick={() => removeKeyword(idx)}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* AI Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>AI Model</Label>
              <Select
                value={editedProfile.ai_model}
                onValueChange={(val) => setEditedProfile({...editedProfile, ai_model: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-select</SelectItem>
                  <SelectItem value="o1">OpenAI o1 (Reasoning)</SelectItem>
                  <SelectItem value="claude-4.5">Claude 4.5 Opus</SelectItem>
                  <SelectItem value="gpt-5">GPT-5 (Preview)</SelectItem>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Matching Strategy</Label>
              <Select
                value={editedProfile.matching_strategy}
                onValueChange={(val) => setEditedProfile({...editedProfile, matching_strategy: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="strict">Strict</SelectItem>
                  <SelectItem value="lenient">Lenient</SelectItem>
                  <SelectItem value="learning">Learning (AI Adapts)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              onClick={() => onSave(editedProfile)}
              disabled={totalWeight !== 100 || !editedProfile.name}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}