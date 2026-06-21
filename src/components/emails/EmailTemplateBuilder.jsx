
import { useState, useEffect, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  X,
  Plus,
  Save,
  Loader2,
  Sparkles,
  GripVertical,
  Type,
  Image as ImageIcon,
  MousePointerClick, // Changed from MousePointerSquare
  Minus,
  Heading1,
  Footprints,
  Trash2
} from 'lucide-react';
import { InvokeLLM } from '@/integrations/Core';
import { renderToHtml } from './renderToHtml';
import { addNotification } from "@/components/notifications/NotificationToast";

const BLOCK_TYPES = [
  { type: 'header', label: 'Header', icon: Heading1 },
  { type: 'text', label: 'Text', icon: Type },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'button', label: 'Button', icon: MousePointerClick }, // Changed from MousePointerSquare
  { type: 'spacer', label: 'Spacer', icon: Minus },
  { type: 'footer', label: 'Footer', icon: Footprints },
];

// Properties editor for a single block
const BlockProperties = ({ block, updateBlock, generateAIContent }) => {
  if (!block) return <div className="p-4 text-center text-slate-500">Select a block to edit its properties.</div>;

  const update = (key, value) => updateBlock(block.id, { ...block, [key]: value });

  const renderProps = () => {
    switch(block.type) {
      case 'header':
      case 'text':
      case 'footer':
        return (
          <>
            <Label>Content</Label>
            <Textarea value={block.content} onChange={e => update('content', e.target.value)} rows={6} />
             <Button variant="outline" size="sm" className="gap-2 mt-2" onClick={() => generateAIContent(block.id)}>
              <Sparkles className="w-4 h-4"/> AI Generate
            </Button>
          </>
        );
      case 'image':
        return (
          <>
            <Label>Image URL</Label>
            <Input value={block.src || ""} onChange={e => update('src', e.target.value)} placeholder="https://..." />
            <Label className="mt-2">Alt Text</Label>
            <Input value={block.alt || ""} onChange={e => update('alt', e.target.value)} placeholder="Descriptive text" />
          </>
        );
      case 'button':
        return (
          <>
            <Label>Button Text</Label>
            <Input value={block.text || ""} onChange={e => update('text', e.target.value)} placeholder="Click me" />
            <Label className="mt-2">Button URL</Label>
            <Input value={block.url || ""} onChange={e => update('url', e.target.value)} placeholder="https://..." />
            <Label className="mt-2">Button Color</Label>
            <Input type="color" value={block.color || "#007bff"} onChange={e => update('color', e.target.value)} />
          </>
        );
      case 'spacer':
        return (
           <>
            <Label>Height (px)</Label>
            <Input type="number" value={block.height || 20} onChange={e => update('height', parseInt(e.target.value, 10))} />
           </>
        );
      default:
        return <p>This block has no editable properties.</p>;
    }
  };

  return <div className="p-4 space-y-2">{renderProps()}</div>;
};


export default function EmailTemplateBuilder({ initialTemplate, onSave, onExit }) {
  const [template, setTemplate] = useState(initialTemplate);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [htmlPreview, setHtmlPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    setTemplate(initialTemplate);
  }, [initialTemplate]);

  useEffect(() => {
    const rendered = renderToHtml(template.blocks);
    const previewText = template.blocks?.find(b => b.type === 'text')?.content?.slice(0, 150) || '';
    setTemplate(prev => ({ ...prev, preview_text: previewText, html_body: rendered }));
    setHtmlPreview(rendered);
  }, [template.blocks]);

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(template.blocks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setTemplate(prev => ({ ...prev, blocks: items }));
    setSelectedBlockId(reorderedItem.id);
  };
  
  const addBlock = (type) => {
    const newBlock = { id: `block-${Date.now()}`, type, content: '' };
    if (type === 'button') {
      newBlock.text = "Click Here";
      newBlock.url = "https://";
      newBlock.color = "#3b82f6";
    }
    if (type === 'image') newBlock.src = "https://via.placeholder.com/400x200";
    if (type === 'spacer') newBlock.height = 20;

    const newBlocks = [...template.blocks, newBlock];
    setTemplate(prev => ({ ...prev, blocks: newBlocks }));
    setSelectedBlockId(newBlock.id);
  };
  
  const updateBlock = (id, updatedBlock) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => b.id === id ? updatedBlock : b)
    }));
  };

  const deleteBlock = (id) => {
    if (!window.confirm("Delete this block?")) return;
    setTemplate(prev => ({ ...prev, blocks: prev.blocks.filter(b => b.id !== id) }));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(template);
    setSaving(false);
  };

  const generateAIContent = useCallback(async (blockId) => {
    const block = template.blocks.find(b => b.id === blockId);
    if (!block || (block.type !== 'text' && block.type !== 'header' && block.type !== 'footer')) return;

    setAiLoading(true);
    try {
      const prompt = `Generate a short paragraph for an email. The email template is for "${template.category.replace(/_/g, ' ')}" and has the title "${template.title}". The existing text in the block is: "${block.content}". Please improve or expand upon it based on the context. Keep it concise.`;

      const result = await InvokeLLM({ prompt });
      if (typeof result === "string") {
        updateBlock(blockId, { ...block, content: result });
        addNotification({ title: "AI Content Generated", message: "Block updated successfully.", type: "success" });
      } else {
        throw new Error("Unexpected AI response format");
      }
    } catch (e) {
      console.error("AI generation failed:", e);
      addNotification({ title: "AI Error", message: "Could not generate content.", type: "error" });
    }
    setAiLoading(false);
  }, [template.title, template.category, template.blocks]);

  const selectedBlock = template.blocks.find(b => b.id === selectedBlockId);

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50">
      {/* Header */}
      <header className="p-4 bg-white border-b flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
           <Input value={template.title} onChange={e => setTemplate(t => ({...t, title: e.target.value}))} className="text-lg font-bold" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onExit}>Exit</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
            <span className="ml-2">Save Template</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Blocks */}
        <aside className="w-64 bg-white border-r p-4 space-y-4 overflow-y-auto">
          <h3 className="font-semibold">Add Blocks</h3>
          {BLOCK_TYPES.map(bt => (
            <Button key={bt.type} variant="outline" className="w-full justify-start gap-2" onClick={() => addBlock(bt.type)}>
              <bt.icon className="w-4 h-4" />
              {bt.label}
            </Button>
          ))}
        </aside>

        {/* Center Panel: Builder */}
        <main className="flex-1 p-8 overflow-y-auto">
           <Card className="max-w-3xl mx-auto shadow-lg">
             <CardContent className="p-4">
                 <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input value={template.subject} onChange={e => setTemplate(t => ({...t, subject: e.target.value}))} />
                    <Label>Category</Label>
                    <Select value={template.category} onValueChange={v => setTemplate(t => ({...t, category: v}))}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="candidate_outreach">Candidate Outreach</SelectItem>
                            <SelectItem value="job_marketing">Job Marketing</SelectItem>
                            <SelectItem value="invoice">Invoice</SelectItem>
                            <SelectItem value="follow_up">Follow Up</SelectItem>
                            <SelectItem value="internal_announcement">Internal Announcement</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
              
              <hr className="my-6"/>

              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="email-blocks">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                      {template.blocks.map((block, index) => (
                        <Draggable key={block.id} draggableId={block.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => setSelectedBlockId(block.id)}
                              className={`p-2 border rounded-md transition flex items-start gap-2 ${selectedBlockId === block.id ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-slate-400'}`}
                            >
                               <GripVertical className="w-5 h-5 text-slate-400 mt-1 flex-shrink-0" />
                               <div className="flex-1">
                                 <p className="text-xs font-bold text-slate-500">{BLOCK_TYPES.find(b=>b.type===block.type)?.label}</p>
                                 <p className="text-sm truncate">{block.content || block.src || block.text}</p>
                               </div>
                               <Button variant="ghost" size="icon" onClick={(e) => {e.stopPropagation(); deleteBlock(block.id);}} className="text-red-500 hover:text-red-700">
                                   <Trash2 className="w-4 h-4"/>
                               </Button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
             </CardContent>
           </Card>
        </main>

        {/* Right Panel: Properties & Preview */}
        <aside className="w-[500px] bg-white border-l flex flex-col">
           <div className="p-4 border-b">
             <h3 className="font-semibold">Block Properties</h3>
           </div>
           <div className="flex-shrink-0">
             <BlockProperties block={selectedBlock} updateBlock={updateBlock} generateAIContent={generateAIContent} />
           </div>
           <div className="p-4 border-t">
              <h3 className="font-semibold">Live Preview</h3>
           </div>
           <div className="flex-1 bg-slate-200 p-4 overflow-hidden">
             <iframe
               title="Email Preview"
               srcDoc={htmlPreview}
               className="w-full h-full bg-white border"
             />
           </div>
        </aside>
      </div>

       {aiLoading && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
            <div className="bg-white p-4 rounded-lg flex items-center gap-4 shadow-xl">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600"/>
                <p>Generating AI content...</p>
            </div>
        </div>
      )}
    </div>
  );
}
