
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ShieldCheck, Save, Users, Settings2, Lock, Unlock, MailIcon } from "lucide-react";
import { User } from "@/entities/User";
import { Role } from "@/entities/Role";
import { usePermissions } from "@/components/common/PermissionsContext";
import { AuditLog } from "@/entities/AuditLog";
import { getRolesCached, invalidateRolesCache } from "@/components/utils/rolesCache";
import InviteUserModal from "@/components/common/InviteUserModal"; // New import
import { DataTableProvider, SortableHead } from "@/components/common/DataTable";
import { useTableSort } from "@/hooks/useTableSort";

// Replace ENTITIES with a comprehensive list used across the app
const ENTITIES = [
  "Candidate", "Company", "Job", "Application", "Submission", "Task",
  "Playbook", "Consultant", "Recruiter", "Resume", "EmailTemplate",
  "SubmissionView", "TaskView", "JobStack",
  "Invoice", "Expense", "LeaveRequest", "Timesheet",
  "Role", "User",
  "AppSettings", "DashboardConfig", "EmailIntegrationSettings", "InboundEmail", "AuditLog",
  "SitePage"
];

// Helper to ensure a role has a permission row for every entity (so all columns incl. Create are visible)
const defaultPerm = { view: false, create: false, update: false, delete: false, scope: "own" }; // CHANGED: view now false by default
function ensureFullPermissions(roleObj) {
  if (!roleObj) return null;
  const perms = { ...(roleObj.permissions || {}) };
  ENTITIES.forEach(e => {
    if (!perms[e]) perms[e] = { ...defaultPerm };
  });
  return { ...roleObj, permissions: perms };
}

export default function AccessControl() {
  const { user, role } = usePermissions();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  const [search, setSearch] = useState("");
  const [auditLogs, setAuditLogs] = useState([]);
  const [inviteModalOpen, setInviteModalOpen] = useState(false); // New state

  // Hooks must be called unconditionally: compute filteredUsers before any early return
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q));
  }, [users, search]);

  const usersSortAccessors = useMemo(
    () => ({ role: (u) => roles.find((r) => r.id === u.role_id)?.name || "" }),
    [roles]
  );
  const usersSort = useTableSort(filteredUsers, {
    defaultKey: "created_date",
    defaultOrder: "desc",
    accessors: usersSortAccessors,
  });
  const auditSort = useTableSort(auditLogs, {
    defaultKey: "created_date",
    defaultOrder: "desc",
  });

  const isAdmin = (user?.role === "admin") || (role?.name === "Admin");

  useEffect(() => {
    const load = async () => {
      try {
        // Use cached roles to reduce calls, then ensure full matrix rows
        const [u, rRaw] = await Promise.all([
          User.list("-created_date", 100),
          getRolesCached()
        ]);
        setUsers(u);
        const r = rRaw.map(ensureFullPermissions);
        setRoles(r);
        // Prefer selecting a Recruiter role by default if present
        const preferred = r.find(x => (x.name || "").toLowerCase().includes("recruiter")) || r[0] || null;
        setEditingRole(preferred ? ensureFullPermissions(preferred) : null);
      } catch (e) {
        console.warn("AccessControl bootstrap failed (users/roles):", e);
        setUsers([]);
        setRoles([]);
        setEditingRole(null);
      }

      // Load last year of audit logs (reduced cap)
      try {
        const logs = await AuditLog.list("-created_date", 150);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        setAuditLogs(logs.filter(l => new Date(l.created_date) >= oneYearAgo));
      } catch (e) {
        console.warn("Audit logs load failed:", e);
        setAuditLogs([]);
      }
    };
    load();
  }, []);

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Control</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700">You don't have permission to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAssignRole = async (u, roleId) => {
    await User.update(u.id, { role_id: roleId });
    const next = await User.list(); // Re-fetch all users to ensure consistency
    setUsers(next);
    // Invalidate roles cache and notify other tabs/sessions
    invalidateRolesCache();
    try { localStorage.setItem("roles_cache_bust", String(Date.now())); } catch (_) { /* localStorage may be unavailable */ }
  };

  const handleUpdateStatus = async (u, newStatus) => {
    await User.update(u.id, { status: newStatus });
    const next = await User.list(); // Re-fetch all users to ensure consistency
    setUsers(next);
  };

  const handleToggleLock = async (u) => {
    await User.update(u.id, { is_locked: !u.is_locked });
    const next = await User.list(); // Re-fetch all users to ensure consistency
    setUsers(next);
  };

  const handleSendReset = async (u) => {
    // Password reset is handled by the Base44 platform authentication system
    // Users can reset their password through the login page
    alert(`Password reset instructions:\n\n1. User should go to the login page\n2. Click "Forgot Password"\n3. Enter their email (${u.email})\n4. Follow the reset link sent to their email\n\nNote: Password resets are handled by the platform's authentication system.`);
  };

  const startNewRole = () => {
    const blank = {
      name: "New Role",
      description: "Custom role",
      permissions: Object.fromEntries(ENTITIES.map(e => [e, { view: false, create: false, update: false, delete: false, scope: "own" }]))
    };
    setEditingRole(blank);
  };

  const saveRole = async () => {
    const payload = ensureFullPermissions(editingRole);
    if (!payload.id) {
      const created = await Role.create(payload);
      const ensured = ensureFullPermissions(created);
      setRoles([ensured, ...roles]);
      setEditingRole(ensured);
    } else {
      const updated = await Role.update(payload.id, payload);
      const ensured = ensureFullPermissions(updated);
      setRoles(roles.map(r => r.id === ensured.id ? ensured : r));
      setEditingRole(ensured);
    }
    // Invalidate cache and broadcast so PermissionsContext updates immediately app-wide
    invalidateRolesCache();
    try { localStorage.setItem("roles_cache_bust", String(Date.now())); } catch (_) { /* localStorage may be unavailable */ }
  };

  // New handler for successful user invitation
  const handleInviteSuccess = async (newUser) => {
    // Reload users list
    const updatedUsers = await User.list("-created_date", 100);
    setUsers(updatedUsers);
    setInviteModalOpen(false); // Close the modal
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Access Control</h1>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setInviteModalOpen(true)}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Invite User
          </Button>
          <Badge className="bg-indigo-100 text-indigo-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Admin Center
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> Users</TabsTrigger>
          <TabsTrigger value="roles" className="gap-2"><Settings2 className="w-4 h-4" /> Access Levels & Permissions</TabsTrigger>
          <TabsTrigger value="audit" className="gap-2"><ShieldCheck className="w-4 h-4" /> Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
              <Input placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />
              <div className="text-sm text-slate-600">Total users: {users.length}</div> {/* Changed from Recent to Total */}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTableProvider tableId="access-users" sort={usersSort}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead columnKey="full_name">Name</SortableHead>
                    <SortableHead columnKey="email">Email</SortableHead>
                    <SortableHead columnKey="seat">Seat</SortableHead>
                    <SortableHead columnKey="role">Access Level</SortableHead>
                    <SortableHead columnKey="status">Status</SortableHead>
                    <SortableHead columnKey="actions" sortable={false}>Actions</SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersSort.sorted.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>{u.full_name || "—"}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell className="capitalize">{u.seat || "core"}</TableCell>
                      <TableCell>
                        <Select value={u.role_id || ""} onValueChange={(val) => handleAssignRole(u, val)}>
                          <SelectTrigger className="w-56">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={u.status || "invited"} onValueChange={(val) => handleUpdateStatus(u, val)}>
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="invited">Invited</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleToggleLock(u)} className="gap-1">
                            {u.is_locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            {u.is_locked ? "Unlock" : "Lock"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleSendReset(u)} className="gap-1">
                            <MailIcon className="w-3 h-3" /> Send Reset Email
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </DataTableProvider>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Select
                value={editingRole?.id || "new"}
                onValueChange={(val) => {
                  if (val === "new") startNewRole();
                  else setEditingRole(ensureFullPermissions(roles.find(r => r.id === val) || null));
                }}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Pick a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  <SelectItem value="new">+ New Role</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="w-52"
                value={editingRole?.name || ""}
                onChange={(e) => setEditingRole({ ...(editingRole || {}), name: e.target.value })}
                placeholder="Access level name"
              />
            </div>
            <Button onClick={saveRole} className="gap-2"><Save className="w-4 h-4" /> Save Access Level</Button>
          </div>

          {editingRole && (
            <Card>
              <CardHeader>
                <CardTitle>Permissions Matrix</CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Object</TableHead>
                      <TableHead>View</TableHead>
                      <TableHead>Create</TableHead>
                      <TableHead>Edit</TableHead>
                      <TableHead>Delete</TableHead>
                      <TableHead>Scope</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ENTITIES.map(entity => {
                      const row = editingRole.permissions?.[entity] || { view: false, create: false, update: false, delete: false, scope: "own" };
                      return (
                        <TableRow key={entity}>
                          <TableCell className="font-medium">{entity}</TableCell>
                          {["view", "create", "update", "delete"].map(k => (
                            <TableCell key={k}>
                              <input
                                type="checkbox"
                                checked={!!row[k]}
                                onChange={(e) => {
                                  const next = { ...(editingRole.permissions || {}) };
                                  next[entity] = { ...row, [k]: e.target.checked };
                                  setEditingRole({ ...editingRole, permissions: next });
                                }}
                              />
                            </TableCell>
                          ))}
                          <TableCell>
                            <Select
                              value={row.scope || "own"}
                              onValueChange={(val) => {
                                const next = { ...(editingRole.permissions || {}) };
                                next[entity] = { ...row, scope: val };
                                setEditingRole({ ...editingRole, permissions: next });
                              }}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="own">Own</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Login Audit (Last 12 Months)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DataTableProvider tableId="access-audit" sort={auditSort}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead columnKey="created_date">When</SortableHead>
                    <SortableHead columnKey="user_email">User</SortableHead>
                    <SortableHead columnKey="ip">IP</SortableHead>
                    <SortableHead columnKey="user_agent">Device / Agent</SortableHead>
                    <SortableHead columnKey="app">App</SortableHead>
                    <SortableHead columnKey="action">Action</SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditSort.sorted.map(l => (
                    <TableRow key={l.id}>
                      <TableCell>{new Date(l.created_date).toLocaleString()}</TableCell>
                      <TableCell className="truncate">{l.user_email}</TableCell>
                      <TableCell>{l.ip || "unknown"}</TableCell>
                      <TableCell className="truncate max-w-[280px]" title={l.user_agent}>{l.user_agent || "—"}</TableCell>
                      <TableCell>{l.app || "Recruiter X"}</TableCell>
                      <TableCell className="capitalize">{(l.action || "login").replace("_", " ")}</TableCell>
                    </TableRow>
                  ))}
                  {auditLogs.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-6">No audit records.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </DataTableProvider>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite User Modal */}
      <InviteUserModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        roles={roles}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
}
