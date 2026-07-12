import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCcw, Check, X, Loader2, Mail, Bot, Clock } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import { EmailDraft } from "@/entities/EmailDraft";
import { ApprovalItem } from "@/entities/ApprovalItem";
import { useEntityList } from "@/hooks/useEntityList";
import { InvokeFunction } from "@/integrations/Core";
import { addNotification } from "@/components/notifications/NotificationToast";
import DraftListItem from "@/components/approval-queue/DraftListItem";
import DraftEditor from "@/components/approval-queue/DraftEditor";
import { formatDistanceToNow } from "date-fns";

const REJECT_REASONS = ["Wrong tone", "Wrong recipient", "Not needed", "Other"];

const TABS = [
  { key: "all", label: "All" },
  { key: "client_submission", label: "Submissions" },
  { key: "candidate_outreach", label: "Outreach" },
  { key: "recruiter_clarification", label: "Clarifications" },
  { key: "followup", label: "Follow-ups" },
  { key: "items", label: "Agent Actions" },
];

const RISK_BADGE = {
  low: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

export default function ApprovalQueue() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("Wrong tone");
  const [rejectNote, setRejectNote] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Edit modal
  const [editTarget, setEditTarget] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  // Bulk confirm modal
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await EmailDraft.filter({ status: "draft" }, "-created_date", 200);
      setDrafts(data || []);
    } catch {
      addNotification({ type: "error", title: "Error", message: "Could not load approval queue" });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Generic approval items (agent actions, automation steps, bulk outreach).
  // Table lands with migration 018; until it's applied this shows the error state.
  const {
    data: items,
    error: itemsError,
    reload: reloadItems,
  } = useEntityList(() => ApprovalItem.filter({ status: "pending" }, "due_at", 200));
  const [decidingItem, setDecidingItem] = useState(null);

  const decideItem = async (item, decision, reason = null) => {
    setDecidingItem(item.id);
    try {
      await ApprovalItem.update(item.id, {
        status: decision,
        decision,
        decision_reason: reason,
        decided_at: new Date().toISOString(),
      });
      await reloadItems();
      addNotification({
        type: decision === "approved" ? "success" : "info",
        title: decision === "approved" ? "Approved" : "Rejected",
        message: item.title,
      });
    } catch (err) {
      addNotification({ type: "error", title: "Error", message: err?.message || "Could not update item" });
    }
    setDecidingItem(null);
  };

  const lowRiskItems = items.filter((i) => i.risk_tier === "low");
  const bulkApproveLowRisk = async () => {
    for (const item of lowRiskItems) await decideItem(item, "approved", "bulk low-risk approval");
  };

  const visibleDrafts = activeTab === "all"
    ? drafts
    : drafts.filter(d =>
        activeTab === "followup"
          ? d.draft_type === "followup" || d.draft_type === "follow_up"
          : d.draft_type === activeTab
      );

  function getCount(type) {
    if (type === "all") return drafts.length;
    if (type === "items") return items.length;
    if (type === "followup") return drafts.filter(d => d.draft_type === "followup" || d.draft_type === "follow_up").length;
    return drafts.filter(d => d.draft_type === type).length;
  }

  const approveDraft = async (draft, edits = null) => {
    setApproving(draft.id);
    try {
      await InvokeFunction({
        function_name: "aiRecruiterApproveDraft",
        payload: {
          draft_id: draft.id,
          action: "approve",
          ...(edits?.subject ? { edited_subject: edits.subject } : {}),
          ...(edits?.body ? { edited_body: edits.body } : {}),
        },
      });
      setDrafts(prev => prev.filter(d => d.id !== draft.id));
      addNotification({ type: "success", title: "Approved", message: `"${draft.subject}" approved and sending` });
    } catch {
      addNotification({ type: "error", title: "Error", message: "Could not approve draft" });
    }
    setApproving(null);
  };

  const handleSaveAndApprove = async (edits) => {
    setEditSaving(true);
    await approveDraft(editTarget, edits);
    setEditSaving(false);
    setEditTarget(null);
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await InvokeFunction({
        function_name: "aiRecruiterApproveDraft",
        payload: { draft_id: rejectTarget.id, action: "reject" },
      });
      setDrafts(prev => prev.filter(d => d.id !== rejectTarget.id));
      addNotification({ type: "info", title: "Rejected", message: `Draft rejected: ${rejectReason}` });
    } catch {
      addNotification({ type: "error", title: "Error", message: "Could not reject draft" });
    }
    setRejecting(false);
    setRejectTarget(null);
    setRejectReason("Wrong tone");
    setRejectNote("");
  };

  const handleBulkApprove = async () => {
    setBulkApproving(true);
    setShowBulkConfirm(false);
    setBulkProgress(0);
    let i = 0;
    for (const draft of visibleDrafts) {
      await approveDraft(draft);
      i++;
      setBulkProgress(i);
    }
    setBulkApproving(false);
    setBulkProgress(0);
    addNotification({ type: "success", title: "Done", message: `Approved ${i} draft${i !== 1 ? "s" : ""}` });
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Approval Queue"
        subtitle="Review and approve AI-generated email drafts before they send"
        right={
          <div className="flex items-center gap-2">
            {visibleDrafts.length > 1 && !bulkApproving && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkConfirm(true)}
                className="gap-2"
              >
                <Check className="w-3.5 h-3.5" />
                Approve All ({visibleDrafts.length})
              </Button>
            )}
            {bulkApproving && (
              <div className="flex items-center gap-2 text-sm text-[#64748B]">
                <Loader2 className="w-4 h-4 animate-spin" />
                {bulkProgress}/{visibleDrafts.length + bulkProgress} approved…
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => { load(); reloadItems(); }} className="gap-2">
              <RefreshCcw className="w-3.5 h-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="gap-1">
          {TABS.map(t => (
            <TabsTrigger key={t.key} value={t.key} className="gap-2">
              {t.label}
              {getCount(t.key) > 0 && (
                <Badge className="bg-[#9333EA] text-white text-[10px] py-0 h-4 px-1.5 min-w-4">
                  {getCount(t.key)}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.filter(t => t.key !== "items").map(t => (
          <TabsContent key={t.key} value={t.key} className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-[#94A3B8]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading drafts…
              </div>
            ) : visibleDrafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8] gap-3">
                <Mail className="w-10 h-10 opacity-20" />
                <p className="text-sm">No drafts waiting for approval</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleDrafts.map(draft => (
                  <DraftListItem
                    key={draft.id}
                    draft={draft}
                    onApprove={approveDraft}
                    onEdit={setEditTarget}
                    onReject={d => { setRejectTarget(d); }}
                    approving={approving}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}

        {/* Generic approval items — agent actions, automation steps, bulk outreach */}
        <TabsContent value="items" className="mt-4">
          {itemsError ? (
            <EmptyState error={itemsError} action={{ label: "Retry", fn: reloadItems }} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No agent actions waiting"
              description="Actions queued by agents and automations will appear here for review"
            />
          ) : (
            <div className="space-y-3">
              {lowRiskItems.length > 1 && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={bulkApproveLowRisk} className="gap-2">
                    <Check className="w-3.5 h-3.5" />
                    Approve all low-risk ({lowRiskItems.length})
                  </Button>
                </div>
              )}
              {items.map(item => (
                <div key={item.id} className="border rounded-lg p-4 bg-white flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-[#0F172A] truncate">{item.title}</span>
                      <Badge className={RISK_BADGE[item.risk_tier] || RISK_BADGE.medium}>{item.risk_tier} risk</Badge>
                      <Badge variant="outline" className="text-xs">{(item.type || "").replace(/_/g, " ")}</Badge>
                      {item.ai_confidence != null && (
                        <span className="text-xs text-[#94A3B8]">AI confidence {(Number(item.ai_confidence) * 100).toFixed(0)}%</span>
                      )}
                    </div>
                    {item.diff_summary && (
                      <p className="text-sm text-[#64748B] mt-1 whitespace-pre-wrap">{item.diff_summary}</p>
                    )}
                    {item.due_at && (
                      <p className="text-xs text-[#94A3B8] mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        due {formatDistanceToNow(new Date(item.due_at), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      disabled={decidingItem === item.id}
                      onClick={() => decideItem(item, "approved")}
                      className="gap-1 bg-[#9333EA] hover:bg-[#A855F7]"
                    >
                      {decidingItem === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={decidingItem === item.id}
                      onClick={() => decideItem(item, "rejected")}
                      className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit & approve modal */}
      <DraftEditor
        draft={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSaveAndApprove={handleSaveAndApprove}
        saving={editSaving}
      />

      {/* Reject modal */}
      <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Draft</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-[#94A3B8] block mb-1.5">Reason</label>
              <Select value={rejectReason} onValueChange={setRejectReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REJECT_REASONS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#94A3B8] block mb-1.5">Notes (optional)</label>
              <Textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="Additional context…"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejecting}
              className="gap-2"
            >
              {rejecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk approve confirm */}
      <Dialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Approve {visibleDrafts.length} Drafts?</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2 max-h-64 overflow-y-auto">
            {visibleDrafts.map(d => (
              <div key={d.id} className="text-sm text-[#0F172A] truncate">• {d.subject || "(No subject)"}</div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkConfirm(false)}>Cancel</Button>
            <Button onClick={handleBulkApprove} className="bg-[#9333EA] hover:bg-[#A855F7] gap-2">
              <Check className="w-3.5 h-3.5" />
              Approve All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
