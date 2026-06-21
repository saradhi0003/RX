import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ConsultantForm({ consultant, onSave, onCancel }) {
  const [formData, setFormData] = useState(consultant || {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company: "",
    specialization: [],
    rate_min: "",
    rate_max: "",
    rate_type: "hourly",
    availability: "available",
    location: "",
    linkedin_url: "",
    portfolio_url: "",
    rating: "",
    notes: "",
    tags: []
  });

  const [newSpecialization, setNewSpecialization] = useState("");
  const [newTag, setNewTag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addSpecialization = () => {
    if (newSpecialization.trim() && !formData.specialization.includes(newSpecialization.trim())) {
      setFormData(prev => ({
        ...prev,
        specialization: [...prev.specialization, newSpecialization.trim()]
      }));
      setNewSpecialization("");
    }
  };

  const removeSpecialization = (specToRemove) => {
    setFormData(prev => ({
      ...prev,
      specialization: prev.specialization.filter(spec => spec !== specToRemove)
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
      const cleanedData = {
        ...formData,
        rate_min: formData.rate_min ? Number(formData.rate_min) : undefined,
        rate_max: formData.rate_max ? Number(formData.rate_max) : undefined,
        rating: formData.rating ? Number(formData.rating) : undefined
      };
      
      await onSave(cleanedData);
    } catch (error) {
      console.error("Error saving consultant:", error);
      alert("Error saving consultant. Please try again.");
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
          className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          <div className="flex flex-col h-full">
            <div className="border-b border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900">
                  {consultant ? "Edit Consultant" : "Add New Consultant"}
                </h2>
                <Button variant="ghost" size="icon" onClick={onCancel}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="first_name">First Name *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => handleInputChange("first_name", e.target.value)}
                      placeholder="Enter first name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => handleInputChange("last_name", e.target.value)}
                      placeholder="Enter last name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="Enter email address"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>

                {/* Company & Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => handleInputChange("company", e.target.value)}
                      placeholder="Consulting company name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => handleInputChange("location", e.target.value)}
                      placeholder="City, State"
                    />
                  </div>
                </div>

                {/* Specializations */}
                <div>
                  <Label>Specializations</Label>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        value={newSpecialization}
                        onChange={(e) => setNewSpecialization(e.target.value)}
                        placeholder="Add specialization"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecialization())}
                      />
                      <Button type="button" onClick={addSpecialization} size="icon">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.specialization.map((spec, index) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                          {spec}
                          <button type="button" onClick={() => removeSpecialization(spec)}>
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Rate Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="rate_min">Min Rate ($)</Label>
                    <Input
                      id="rate_min"
                      type="number"
                      value={formData.rate_min}
                      onChange={(e) => handleInputChange("rate_min", e.target.value)}
                      placeholder="Minimum rate"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rate_max">Max Rate ($)</Label>
                    <Input
                      id="rate_max"
                      type="number"
                      value={formData.rate_max}
                      onChange={(e) => handleInputChange("rate_max", e.target.value)}
                      placeholder="Maximum rate"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rate_type">Rate Type</Label>
                    <Select value={formData.rate_type} onValueChange={(value) => handleInputChange("rate_type", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="project">Project</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Status & Rating */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="availability">Availability</Label>
                    <Select value={formData.availability} onValueChange={(value) => handleInputChange("availability", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="busy">Busy</SelectItem>
                        <SelectItem value="unavailable">Unavailable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="rating">Rating (1-5)</Label>
                    <Input
                      id="rating"
                      type="number"
                      min="1"
                      max="5"
                      value={formData.rating}
                      onChange={(e) => handleInputChange("rating", e.target.value)}
                      placeholder="Performance rating"
                    />
                  </div>
                </div>

                {/* URLs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                    <Input
                      id="linkedin_url"
                      value={formData.linkedin_url}
                      onChange={(e) => handleInputChange("linkedin_url", e.target.value)}
                      placeholder="LinkedIn profile URL"
                    />
                  </div>
                  <div>
                    <Label htmlFor="portfolio_url">Portfolio URL</Label>
                    <Input
                      id="portfolio_url"
                      value={formData.portfolio_url}
                      onChange={(e) => handleInputChange("portfolio_url", e.target.value)}
                      placeholder="Portfolio website URL"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder="Internal notes about this consultant"
                    rows={3}
                  />
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
                  {consultant ? "Update Consultant" : "Add Consultant"}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}