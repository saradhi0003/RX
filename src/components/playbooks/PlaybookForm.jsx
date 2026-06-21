
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PlaybookForm({ playbook, onSave, onCancel }) {
  const [formData, setFormData] = useState(playbook ? {
    ...playbook,
    access_level: playbook.access_level || "public" // Ensure access_level is present and defaulted
  } : {
    title: "",
    description: "",
    category: "procedures",
    documents: [],
    steps: [],
    tags: [],
    is_active: true,
    access_level: "public" // Default for new playbook
  });

  // keep form state in sync with the selected playbook (prevents clearing docs/steps on edit)
  useEffect(() => {
    if (playbook) {
      setFormData({
        ...playbook,
        documents: Array.isArray(playbook.documents) ? playbook.documents : [],
        steps: Array.isArray(playbook.steps) ? playbook.steps : [],
        tags: Array.isArray(playbook.tags) ? playbook.tags : [],
        is_active: typeof playbook.is_active === "boolean" ? playbook.is_active : true,
        access_level: playbook.access_level || "public" // Ensure access_level is set, default to public
      });
    } else {
      setFormData({
        title: "",
        description: "",
        category: "procedures",
        documents: [],
        steps: [],
        tags: [],
        is_active: true,
        access_level: "public" // Default for new playbook
      });
    }
  }, [playbook]);

  const [newDocument, setNewDocument] = useState({ name: "", url: "", description: "", type: "pdf" });
  const [newStep, setNewStep] = useState({ title: "", description: "", order: 1 });
  const [newTag, setNewTag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addDocument = () => {
    if (newDocument.name.trim() && newDocument.url.trim()) {
      setFormData(prev => ({
        ...prev,
        documents: [...prev.documents, { ...newDocument, order: prev.documents.length + 1 }]
      }));
      setNewDocument({ name: "", url: "", description: "", type: "pdf" });
    }
  };

  const removeDocument = (index) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index)
    }));
  };

  const addStep = () => {
    if (newStep.title.trim()) {
      setFormData(prev => ({
        ...prev,
        steps: [...prev.steps, { ...newStep, order: prev.steps.length + 1 }]
      }));
      setNewStep({ title: "", description: "", order: 1 });
    }
  };

  const removeStep = (index) => {
    setFormData(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onSave(formData);
    } catch (error) {
      console.error("Error saving playbook:", error);
      alert("Error saving playbook. Please try again.");
    }
    
    setIsSubmitting(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[90vh] max-h-[90vh] overflow-hidden"
        >
          <div className="flex flex-col h-full">
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900">
                  {playbook ? "Edit Playbook" : "New Playbook"}
                </h2>
                <Button variant="ghost" size="icon" onClick={onCancel}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6"> {/* Changed to md:grid-cols-3 */}
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      placeholder="Playbook title"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category *</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="onboarding">Onboarding</SelectItem>
                        <SelectItem value="recruiting">Recruiting</SelectItem>
                        <SelectItem value="client_management">Client Management</SelectItem>
                        <SelectItem value="procedures">Procedures</SelectItem>
                        <SelectItem value="templates">Templates</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* NEW Access Level Field */}
                  <div>
                    <Label htmlFor="access_level">Access Level</Label>
                    <Select value={formData.access_level} onValueChange={(v) => setFormData(prev => ({...prev, access_level: v}))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="recruiter">Recruiter</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Describe this playbook"
                    rows={3}
                  />
                </div>

                {/* Documents Section */}
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-lg">Documents & Resources</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Input
                        placeholder="Document name"
                        value={newDocument.name}
                        onChange={(e) => setNewDocument({...newDocument, name: e.target.value})}
                      />
                      <Input
                        placeholder="Document URL"
                        value={newDocument.url}
                        onChange={(e) => setNewDocument({...newDocument, url: e.target.value})}
                      />
                      <Input
                        placeholder="Description (optional)"
                        value={newDocument.description}
                        onChange={(e) => setNewDocument({...newDocument, description: e.target.value})}
                      />
                      <div className="flex gap-2">
                        <Select value={newDocument.type} onValueChange={(value) => setNewDocument({...newDocument, type: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pdf">PDF</SelectItem>
                            <SelectItem value="doc">Document</SelectItem>
                            <SelectItem value="video">Video</SelectItem>
                            <SelectItem value="link">Link</SelectItem>
                            <SelectItem value="template">Template</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button type="button" onClick={addDocument} size="icon">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {formData.documents.length > 0 && (
                      <div className="space-y-2">
                        {formData.documents.map((doc, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{doc.name}</p>
                              <p className="text-xs text-slate-600">{doc.type} • {doc.description}</p>
                            </div>
                            <div className="flex items-center gap-1"> {/* Adjusted gap here for action icons */}
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded-md hover:bg-slate-100 transition-colors">
                                <ExternalLink className="w-4 h-4 text-blue-600" />
                              </a>
                              <Button 
                                type="button"
                                variant="ghost" 
                                size="icon"
                                onClick={() => removeDocument(index)}
                                className="w-6 h-6" // Smaller icon button
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Steps Section */}
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-lg">Process Steps</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      <Input
                        placeholder="Step title"
                        value={newStep.title}
                        onChange={(e) => setNewStep({...newStep, title: e.target.value})}
                      />
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Step description"
                          value={newStep.description}
                          onChange={(e) => setNewStep({...newStep, description: e.target.value})}
                          rows={2}
                          className="flex-1"
                        />
                        <Button type="button" onClick={addStep} size="icon" className="mt-auto">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {formData.steps.length > 0 && (
                      <div className="space-y-2">
                        {formData.steps.map((step, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{index + 1}. {step.title}</p>
                              {step.description && (
                                <p className="text-xs text-slate-600">{step.description}</p>
                              )}
                            </div>
                            <Button 
                              type="button"
                              variant="ghost" 
                              size="icon"
                              onClick={() => removeStep(index)}
                              className="w-6 h-6" // Smaller icon button
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Tags */}
                <div>
                  <Label>Tags</Label>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Add tag"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      />
                      <Button type="button" onClick={addTag} size="icon">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                          {tag}
                          <button type="button" onClick={() => removeTag(tag)}>
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <div className="border-t border-slate-200 p-6">
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {playbook ? "Update Playbook" : "Create Playbook"}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
