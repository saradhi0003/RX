
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";

export default function CompanyForm({ company, onSave, onCancel }) {
  const [formData, setFormData] = useState(company || {
    name: "",
    industry: "",
    website: "",
    location: "",
    description: "",
    type: "client",
    status: "prospect",
    contacts: [],
    job_stack_access: false, // Added job_stack_access to initial state
  });
  
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "", title: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleContactChange = (field, value) => {
    setNewContact(prev => ({ ...prev, [field]: value }));
  };

  const addContact = () => {
    if (newContact.name && newContact.email) {
      setFormData(prev => ({
        ...prev,
        contacts: [...prev.contacts, newContact]
      }));
      setNewContact({ name: "", email: "", phone: "", title: "" });
    }
  };

  const removeContact = (index) => {
    setFormData(prev => ({
      ...prev,
      contacts: prev.contacts.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await onSave(formData);
    } catch (error) {
      console.error("Error saving company:", error);
      alert("Error saving company. Please try again.");
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
                  {company ? "Edit Connection" : "Add New Connection"}
                </h2>
                <Button variant="ghost" size="icon" onClick={onCancel}>
                  <X className="w-5 h-5 text-red-600" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="name">Company Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      placeholder="Enter company name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="industry">Industry</Label>
                    <Input
                      id="industry"
                      value={formData.industry}
                      onChange={(e) => handleInputChange("industry", e.target.value)}
                      placeholder="e.g. Technology, Healthcare"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={formData.website}
                      onChange={(e) => handleInputChange("website", e.target.value)}
                      placeholder="https://example.com"
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

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Brief description of the company"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => handleInputChange("status", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prospect">Prospect</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* New Checkbox for Job Stack Access */}
                  <div className="flex items-center space-x-2 pt-6">
                     <Checkbox 
                        id="job_stack_access" 
                        checked={formData.job_stack_access}
                        onCheckedChange={(checked) => handleInputChange("job_stack_access", checked)}
                      />
                      <Label htmlFor="job_stack_access" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        Jobs Stack Access
                      </Label>
                  </div>
                </div>

                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-lg">Contacts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                      <Input placeholder="Name" value={newContact.name} onChange={(e) => handleContactChange("name", e.target.value)} />
                      <Input placeholder="Email" value={newContact.email} onChange={(e) => handleContactChange("email", e.target.value)} />
                      <Input placeholder="Title" value={newContact.title} onChange={(e) => handleContactChange("title", e.target.value)} />
                      <div className="flex gap-2">
                        <Input placeholder="Phone" value={newContact.phone} onChange={(e) => handleContactChange("phone", e.target.value)} className="flex-1" />
                        <Button type="button" onClick={addContact} size="icon">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {formData.contacts.map((contact, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm">
                          <div>
                            <p className="font-medium">{contact.name} <span className="text-slate-500 font-normal">({contact.title})</span></p>
                            <p className="text-slate-600">{contact.email}</p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeContact(index)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

              </form>
            </div>

            <div className="border-t border-slate-200 p-6">
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {company ? "Update Connection" : "Add Connection"}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
