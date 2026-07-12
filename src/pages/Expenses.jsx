
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Upload, RefreshCcw, Copy, FileText } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { DataTableProvider, SortableHead } from "@/components/common/DataTable";
import { useTableSort } from "@/hooks/useTableSort";
import { Expense } from "@/entities/Expense";
import ExpenseForm from "@/components/accounts/ExpenseForm";
import ImportModal from "@/components/common/ImportModal";
import BankStatementUpload from "@/components/accounts/BankStatementUpload";
import { usePermissions } from "@/components/common/PermissionsContext";
import { emitEntityChanged, useEntityAutoRefresh } from "@/components/common/refreshBus";

const typeColor = (t) => {
  const map = {
    salary: "bg-purple-100 text-purple-800",
    maintenance: "bg-orange-100 text-orange-800",
    travel: "bg-blue-100 text-blue-800",
    utilities: "bg-amber-100 text-amber-800",
    rent: "bg-green-100 text-green-800",
    software: "bg-cyan-100 text-cyan-800",
    other: "bg-gray-100 text-gray-800"
  };
  return map[t] || map.other;
};

export default function Expenses() {
  const [expenses, setExpenses] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [isCloning, setIsCloning] = React.useState(false);
  const [showImport, setShowImport] = React.useState(false);
  const [showBank, setShowBank] = React.useState(false);

  const { listFilterFor, can, scopeFor, me } = usePermissions();
  const canView = can("Expense", "view");
  const canCreate = can("Expense", "create");
  const canUpdate = can("Expense", "update");
  const canDelete = can("Expense", "delete");
  const withinExpenseScope = (ex) => {
    const s = scopeFor("Expense");
    return s === "all" || ex.created_by === (me?.email || "");
  };

  const sort = useTableSort(expenses, { defaultKey: "date", defaultOrder: "desc" });

  const load = React.useCallback(async () => {
    setLoading(true);
    const filter = listFilterFor("Expense");
    const list = filter ? await Expense.filter(filter, "-date") : await Expense.list("-date");
    setExpenses(list);
    setLoading(false);
  }, [listFilterFor]);

  React.useEffect(()=>{ 
    if (!canView) return;
    load(); 
  }, [load, canView]);

  // Ensure external refresh triggers work
  useEntityAutoRefresh("Expense", load);

  const saveExpense = async (data) => {
    if (editing && !isCloning) await Expense.update(editing.id, data);
    else await Expense.create(data);
    setShowForm(false);
    setEditing(null);
    setIsCloning(false);
    load();
    emitEntityChanged("Expense");
  };

  const deleteExpense = async (ex) => {
    if (!window.confirm(`Delete expense "${ex.name}" dated ${ex.date}? This cannot be undone.`)) return;
    await Expense.delete(ex.id);
    load();
    emitEntityChanged("Expense");
  };
  
  const cloneExpense = (ex) => {
    const cloned = { ...ex };
    delete cloned.id;
    cloned.date = new Date().toISOString().slice(0, 10);
    cloned.name = `${ex.name} (Copy)`;
    setEditing(cloned);
    setIsCloning(true);
    setShowForm(true);
  };

  // Render no-permission UI AFTER hooks are declared
  if (!canView) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader><CardTitle>Expenses</CardTitle></CardHeader>
          <CardContent>
            <p className="text-slate-700">You don't have permission to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Track salaries, maintenance, and other costs"
        right={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 bg-white text-blue-700 hover:bg-slate-50" onClick={load}>
              <RefreshCcw className="w-4 h-4" /> Refresh
            </Button>
            {canCreate && (
              <Button variant="outline" className="gap-2 bg-white text-blue-700 hover:bg-slate-50" onClick={()=>setShowImport(true)}>
                <Upload className="w-4 h-4" /> Import CSV
              </Button>
            )}
            {canCreate && (
              <Button
                variant="outline"
                className="gap-2 text-white"
                onClick={()=>setShowBank(true)}
                style={{ background: "linear-gradient(135deg,#9333EA 0%,#2563EB 100%)", border: "none" }}
              >
                <FileText className="w-4 h-4" /> Upload Bank Statement
              </Button>
            )}
            {canCreate && (
              <Button className="gap-2 bg-white text-blue-700 hover:bg-slate-50" onClick={()=>{ setEditing(null); setIsCloning(false); setShowForm(true); }}>
                <Plus className="w-4 h-4" /> New Expense
              </Button>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bank Connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm text-slate-700">
            Direct bank/credit card connections aren't available in this app. You can:
          </div>
          <ul className="list-disc pl-6 text-sm text-slate-700 space-y-1">
            <li>Import statements exported as CSV using the Import button.</li>
            <li>Or enable Backend Functions (Dashboard → Settings) to integrate a bank provider, then we can wire it up.</li>
            <li>Alternatively, request a native bank integration via the Feedback button.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">All Expenses</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DataTableProvider tableId="expenses" sort={sort}>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead columnKey="date">Date</SortableHead>
                  <SortableHead columnKey="name">Name</SortableHead>
                  <SortableHead columnKey="type">Type</SortableHead>
                  <SortableHead columnKey="amount_usd">Amount (USD)</SortableHead>
                  <SortableHead columnKey="amount">Amount (Original)</SortableHead>
                  <SortableHead columnKey="location">Location</SortableHead>
                  <SortableHead columnKey="source">Source</SortableHead>
                  <SortableHead columnKey="actions" sortable={false}>Actions</SortableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sort.sorted.map(ex => {
                  const canEditThis = canUpdate && withinExpenseScope(ex);
                  const canDeleteThis = canDelete && withinExpenseScope(ex);
                  const canCloneThis = canCreate && withinExpenseScope(ex);
                  
                  return (
                    <TableRow key={ex.id}>
                      <TableCell>{ex.date}</TableCell>
                      <TableCell className="font-medium flex items-center gap-2">
                        {ex.name}
                        {ex.is_recurring && <Badge variant="outline" className="text-blue-600 border-blue-200">Recurring</Badge>}
                      </TableCell>
                      <TableCell><Badge className={typeColor(ex.type)}>{ex.type}</Badge></TableCell>
                      <TableCell>${(ex.amount_usd || 0).toFixed(2)}</TableCell>
                      <TableCell>{ex.amount} {ex.currency}</TableCell>
                      <TableCell>{ex.location || "—"}</TableCell>
                      <TableCell className="capitalize">{ex.source || "manual"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {canCloneThis && (
                            <Button variant="outline" size="sm" onClick={() => cloneExpense(ex)}>
                              <Copy className="w-3 h-3 mr-1" /> Clone
                            </Button>
                          )}
                          {canEditThis && (
                            <Button variant="outline" size="sm" onClick={()=>{ setEditing(ex); setIsCloning(false); setShowForm(true); }}>Edit</Button>
                          )}
                          {canDeleteThis && (
                            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={()=>deleteExpense(ex)}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!loading && expenses.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-slate-500 py-6">No expenses yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
            </DataTableProvider>
          </div>
        </CardContent>
      </Card>

      {showImport && (
        <ImportModal
          open={showImport}
          onClose={()=>setShowImport(false)}
          entityName="Expenses"
          entitySdk={Expense}
          onImported={()=>{ setShowImport(false); load(); }}
        />
      )}

      <BankStatementUpload
        open={showBank}
        onClose={()=>setShowBank(false)}
        onSaved={()=>{ setShowBank(false); load(); emitEntityChanged("Expense"); }}
      />

      {showForm && (
        <ExpenseForm
          expense={editing}
          onSave={saveExpense}
          onCancel={()=>{ setShowForm(false); setEditing(null); setIsCloning(false); }}
          isClone={isCloning}
        />
      )}
    </div>
  );
}
