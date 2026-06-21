import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Trash2, Save, Brain } from "lucide-react";

const ENTITIES = ["Candidate", "Job", "Company", "Application", "Submission", "Task"];
const TRIGGER_TYPES = [
  { value: "entity_trigger", label: "Entity Event" },
  { value: "scheduled", label: "Scheduled" },
  { value: "manual", label: "Manual" }
];
const ENTITY_EVENTS = ["created", "updated", "deleted"];
const ACTION_TYPES = [
  { value: "ai_analysis", label: "AI Analysis" },
  { value: "create_entity", label: "Create Entity" },
  { value: "update_entity", label: "Update Entity" },
  { value: "send_email", label: "Send Email" },
  { value: "create_task", label: "Create Task" },
  { value: "query_entities", label: "Query Entities" }
];
const AI_MODELS = ["o1", "gpt-4o", "claude-4.5", "gpt-5"];

export default function AIAgentBuilder({ agent, onClose, onSave }) {
  const [formData, setFormData] = useState(agent || {
    name: "",
    description: "",
    type: "entity_trigger",
    trigger: {
      entity: "Candidate",
      event: "created",
      conditions: {}
    },
    actions: [],
    enabled: true
  });

  const [newAction, setNewAction] = useState({
    type: "ai_analysis",
    model: "o1",
    prompt: ""
  });

  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, { ...newAction, id: Date.now() }]
    }));
    setNewAction({
      type: "ai_analysis",
      model: "o1",
      prompt: ""
    });
  };

  const removeAction = (index) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
  };

  const handleSave = () => {
    if (!formData.name || !formData.description) {
      alert("Please fill in all required fields");
      return;
    }
    if (formData.actions.length === 0) {
      alert("Please add at least one action");
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card 
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Brain className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>{agent ? "Edit Agent" : "Create AI Agent"}</CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  Define triggers, actions, and AI logic for your automation
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="overflow-y-auto flex-1 space-y-6 py-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Agent Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Auto Job Matcher"
                />
              </div>
              <div>
                <Label>Agent Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => setFormData({...formData, type: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Describe what this agent does..."
                rows={2}
              />
            </div>
          </div>

          {/* Trigger Configuration */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="font-semibold text-slate-900">Trigger Configuration</h3>
            
            {formData.type === "entity_trigger" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Entity</Label>
                  <Select
                    value={formData.trigger.entity}
                    onValueChange={(val) => setFormData({
                      ...formData,
                      trigger: {...formData.trigger, entity: val}
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITIES.map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Event</Label>
                  <Select
                    value={formData.trigger.event}
                    onValueChange={(val) => setFormData({
                      ...formData,
                      trigger: {...formData.trigger, event: val}
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_EVENTS.map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {formData.type === "scheduled" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Schedule</Label>
                  <Select
                    value={formData.trigger.schedule}
                    onValueChange={(val) => setFormData({
                      ...formData,
                      trigger: {...formData.trigger, schedule: val}
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select schedule..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={formData.trigger.time || "09:00"}
                    onChange={(e) => setFormData({
                      ...formData,
                      trigger: {...formData.trigger, time: e.target.value}
                    })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-4 border-t pt-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Actions ({formData.actions.length})</h3>
            </div>

            {formData.actions.map((action, idx) => (
              <div key={idx} className="p-4 border rounded-lg bg-slate-50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-100 text-blue-800">Step {idx + 1}</Badge>
                    <span className="text-sm font-medium">{action.type.replace(/_/g, " ")}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAction(idx)}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                {action.type === "ai_analysis" && (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">Model: <strong>{action.model}</strong></p>
                    {action.prompt && (
                      <p className="text-xs text-slate-500 bg-white rounded p-2">
                        {action.prompt}
                      </p>
                    )}
                  </div>
                )}
                {action.entity && (
                  <p className="text-sm text-slate-600">Entity: <strong>{action.entity}</strong></p>
                )}
              </div>
            ))}

            {/* Add New Action */}
            <div className="p-4 border-2 border-dashed rounded-lg space-y-4">
              <h4 className="text-sm font-medium text-slate-700">Add New Action</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Action Type</Label>
                  <Select
                    value={newAction.type}
                    onValueChange={(val) => setNewAction({...newAction, type: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newAction.type === "ai_analysis" && (
                  <div>
                    <Label>AI Model</Label>
                    <Select
                      value={newAction.model}
                      onValueChange={(val) => setNewAction({...newAction, model: val})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_MODELS.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(newAction.type === "create_entity" || newAction.type === "update_entity" || newAction.type === "query_entities") && (
                  <div>
                    <Label>Entity</Label>
                    <Select
                      value={newAction.entity || "Candidate"}
                      onValueChange={(val) => setNewAction({...newAction, entity: val})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ENTITIES.map(e => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {newAction.type === "ai_analysis" && (
                <div>
                  <Label>AI Prompt</Label>
                  <Textarea
                    value={newAction.prompt}
                    onChange={(e) => setNewAction({...newAction, prompt: e.target.value})}
                    placeholder="Enter the prompt for AI analysis..."
                    rows={3}
                  />
                </div>
              )}

              <Button onClick={addAction} variant="outline" className="w-full gap-2">
                <Plus className="w-4 h-4" />
                Add Action
              </Button>
            </div>
          </div>
        </CardContent>

        <div className="border-t p-4 flex justify-end gap-3 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="gap-2 bg-purple-600 hover:bg-purple-700">
            <Save className="w-4 h-4" />
            Save Agent
          </Button>
        </div>
      </Card>
    </div>
  );
}