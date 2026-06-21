import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { EmailTemplate } from "@/entities/EmailTemplate";
import EmailTemplateBuilder from "@/components/emails/EmailTemplateBuilder";
import { Loader2 } from "lucide-react";
import { addNotification } from "@/components/notifications/NotificationToast";
import { createPageUrl } from "@/utils";

export default function EmailTemplateBuilderPage() {
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const templateId = query.get("id");

  useEffect(() => {
    if (!templateId) {
      // New template
      setTemplate({
        title: "Untitled Template",
        subject: "",
        category: "custom",
        blocks: [
          {
            id: 'block-1',
            type: 'text',
            content: 'Hello, this is a sample text block.'
          }
        ],
        is_active: true,
      });
      setLoading(false);
    } else {
      // Existing template
      EmailTemplate.get(templateId)
        .then(data => {
          // Ensure blocks is always an array
          if (!data.blocks) data.blocks = [];
          setTemplate(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to load template", err);
          addNotification({ title: "Error", message: "Could not load template.", type: "error" });
          navigate(createPageUrl("Playbooks"));
        });
    }
  }, [templateId, navigate]);

  const handleSave = async (templateData) => {
    try {
      let saved;
      if (templateId) {
        saved = await EmailTemplate.update(templateId, templateData);
      } else {
        const newTemplate = await EmailTemplate.create(templateData);
        // Navigate to the edit page of the newly created template
        navigate(createPageUrl(`EmailTemplateBuilder?id=${newTemplate.id}`), { replace: true });
      }
      addNotification({ title: "Success", message: "Template saved successfully!", type: "success" });
      // Don't navigate away after saving, stay on the page.
    } catch (err) {
      console.error("Failed to save template", err);
      addNotification({ title: "Error", message: "Failed to save template.", type: "error" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <EmailTemplateBuilder
      initialTemplate={template}
      onSave={handleSave}
      onExit={() => navigate(createPageUrl("Playbooks"), { state: { activeTab: 'templates' } })}
    />
  );
}