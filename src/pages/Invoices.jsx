
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Send, DollarSign, Check, Mail } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { DataTableProvider, SortableHead } from "@/components/common/DataTable";
import { useTableSort } from "@/hooks/useTableSort";
import { Invoice } from "@/entities/Invoice";
import { Company } from "@/entities/Company";
import InvoiceForm from "@/components/accounts/InvoiceForm";
import EmailComposerModal from "@/components/accounts/EmailComposerModal";
import { usePermissions } from "@/components/common/PermissionsContext";

const statusColor = (s) => {
  const map = {
    draft: "bg-slate-100 text-slate-800",
    sent: "bg-blue-100 text-blue-800",
    paid: "bg-green-100 text-green-800",
    overdue: "bg-red-100 text-red-800",
    void: "bg-gray-100 text-gray-800"
  };
  return map[s] || map.draft;
};

export default function Invoices() {
  const [invoices, setInvoices] = React.useState([]);
  const [companies, setCompanies] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [summary, setSummary] = React.useState({ pending: 0, received: 0 });
  const [emailingInvoice, setEmailingInvoice] = React.useState(null); // New state for email composer

  // Ensure permissions hooks are called before any conditional return
  const { listFilterFor, can, scopeFor, me } = usePermissions();
  const canView = can("Invoice", "view");
  const canCreate = can("Invoice", "create");
  const canUpdate = can("Invoice", "update");
  const canDelete = can("Invoice", "delete");
  const withinInvoiceScope = (inv) => {
    const s = scopeFor("Invoice");
    return s === "all" || inv.created_by === (me?.email || "");
  };

  // Sort: the Company column shows a joined name, so it needs an accessor.
  const sortAccessors = React.useMemo(
    () => ({
      company: (inv) => companies.find((c) => c.id === inv.company_id)?.name || "",
    }),
    [companies]
  );
  const sort = useTableSort(invoices, {
    defaultKey: "created_date",
    defaultOrder: "desc",
    accessors: sortAccessors,
  });

  // Define hooks unconditionally
  const load = React.useCallback(async () => {
    setLoading(true);
    const invFilter = listFilterFor("Invoice");
    const comFilter = listFilterFor("Company");
    const [inv, comps] = await Promise.all([
      invFilter ? Invoice.filter(invFilter, "-created_date") : Invoice.list("-created_date"),
      comFilter ? Company.filter(comFilter) : Company.list(),
    ]);
    setInvoices(inv);
    setCompanies(comps);
    const pendingStatuses = new Set(["sent", "overdue"]);
    const received = inv.filter(i => i.status === "paid").reduce((s,i)=>s+Number(i.total||0),0);
    const pending = inv.filter(i => pendingStatuses.has(i.status)).reduce((s,i)=>s+Number(i.total||0),0);
    setSummary({ pending, received });
    setLoading(false);
  }, [listFilterFor]);

  React.useEffect(() => {
    if (!canView) return; // guard effect when no permission
    load();
  }, [load, canView]);

  const saveInvoice = async (data) => {
    if (editing) await Invoice.update(editing.id, data);
    else await Invoice.create(data);
    setShowForm(false);
    setEditing(null);
    load();
  };

  const onEmailComposerClosed = async (sent) => {
    if (sent && emailingInvoice) {
      // Mark as sent if it was a draft
      if (emailingInvoice.status === "draft") {
        await Invoice.update(emailingInvoice.id, { status: "sent" });
      }
      load(); // Reload to reflect new status
    }
    setEmailingInvoice(null);
  };

  const markPaid = async (inv) => {
    await Invoice.update(inv.id, { status: "paid" });
    load();
  };

  const deleteInvoice = async (inv) => {
    if (!window.confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return;
    await Invoice.delete(inv.id);
    load();
  };

  // Render no-permission UI AFTER hooks are declared
  if (!canView) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
          <CardContent>
            <p className="text-slate-700">You don’t have permission to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Manage your billing"
        right={
          canCreate ? (
            <Button className="gap-2 bg-white text-blue-700 hover:bg-slate-50" onClick={()=>{ setEditing(null); setShowForm(true); }}>
              <Plus className="w-4 h-4" /> New Invoice
            </Button>
          ) : null
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Pending Amount</p>
              <p className="text-2xl font-bold text-blue-700">{summary.pending.toFixed(2)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-600" />
          </div>
          <div className="p-4 rounded-lg bg-green-50 border border-green-100 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Received (Paid)</p>
              <p className="text-2xl font-bold text-green-700">{summary.received.toFixed(2)}</p>
            </div>
            <Check className="w-8 h-8 text-green-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">All Invoices</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DataTableProvider tableId="invoices" sort={sort}>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead columnKey="invoice_number">#</SortableHead>
                  <SortableHead columnKey="company">Company</SortableHead>
                  <SortableHead columnKey="issue_date">Issue</SortableHead>
                  <SortableHead columnKey="due_date">Due</SortableHead>
                  <SortableHead columnKey="total">Total</SortableHead>
                  <SortableHead columnKey="status">Status</SortableHead>
                  <SortableHead columnKey="actions" sortable={false}>Actions</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sort.sorted.map(inv => {
                  const comp = companies.find(c => c.id === inv.company_id);
                  const canEditThis = canUpdate && withinInvoiceScope(inv);
                  const canDeleteThis = canDelete && withinInvoiceScope(inv);
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                      <TableCell>{comp?.name || "—"}</TableCell>
                      <TableCell>{inv.issue_date}</TableCell>
                      <TableCell>{inv.due_date}</TableCell>
                      <TableCell>{inv.total?.toFixed ? inv.total.toFixed(2) : inv.total}</TableCell>
                      <TableCell><Badge className={statusColor(inv.status)}>{inv.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {canEditThis && (
                            <Button variant="outline" size="sm" onClick={()=>{ setEditing(inv); setShowForm(true); }}>Edit</Button>
                          )}

                          {canEditThis && (
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => setEmailingInvoice(inv)}>
                              <Mail className="w-4 h-4" /> Send
                            </Button>
                          )}

                          {canEditThis && inv.status !== "paid" && (
                            <Button variant="outline" size="sm" onClick={()=>markPaid(inv)}>Mark Paid</Button>
                          )}

                          {canDeleteThis && (
                            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={()=>deleteInvoice(inv)}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && invoices.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-slate-500 py-6">No invoices yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </DataTableProvider>
          </div>
        </CardContent>
      </Card>

      {showForm && (
        <InvoiceForm
          invoice={editing}
          companies={companies}
          onSave={saveInvoice}
          onCancel={()=>{ setShowForm(false); setEditing(null); }}
        />
      )}
      
      <EmailComposerModal 
        open={!!emailingInvoice}
        onClose={onEmailComposerClosed}
        invoice={emailingInvoice}
        company={emailingInvoice ? companies.find(c => c.id === emailingInvoice.company_id) : null}
      />
    </div>
  );
}
