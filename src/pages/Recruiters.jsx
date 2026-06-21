
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Search, Plus, Calendar, Clock, MoreHorizontal, Eye, Edit, Upload, Trash } from "lucide-react";
import { Recruiter, Timesheet, LeaveRequest, Job, User as UserEntity } from "@/entities/all";
import { Role } from "@/entities/Role";
import RecruiterForm from "../components/recruiters/RecruiterForm";
import LeaveForm from "../components/recruiters/LeaveForm";
import TimesheetForm from "../components/recruiters/TimesheetForm";
import PermissionGate from "@/components/common/PermissionGate";
import ImportModal from "@/components/common/ImportModal";
import RecruiterDetails from "../components/recruiters/RecruiterDetails";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import TransferOwnershipModal from "../components/recruiters/TransferOwnershipModal";
import InviteUserModal from "@/components/common/InviteUserModal";
import { getRolesCached } from "@/components/utils/rolesCache"; // UPDATED PATH

export default function RecruitersPage() {
  const [recruiters, setRecruiters] = useState([]);
  const [search, setSearch] = useState("");
  const [showRecruiterForm, setShowRecruiterForm] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [showTimesheetForm, setShowTimesheetForm] = useState(false);
  const [editingRecruiter, setEditingRecruiter] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [me, setMe] = useState(null);
  const [myLeaves, setMyLeaves] = useState([]);
  const [myTimesheets, setMyTimesheets] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedRecruiter, setSelectedRecruiter] = useState(null);
  const [usersAll, setUsersAll] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [recruiterToDelete, setRecruiterToDelete] = useState(null);
  // NEW STATE FOR INVITE MODAL
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");

  useEffect(() => {
    const load = async () => {
      const [r, j, rolesList] = await Promise.all([
        Recruiter.list("-created_date"),
        Job.list(),
        getRolesCached() // CACHED
      ]);
      setRecruiters(r);
      setJobs(j);
      setRoles(rolesList);
      try {
        const u = await UserEntity.me();
        setMe(u);
        const [le, ts, allUsers] = await Promise.all([
          LeaveRequest.filter({ user_id: u.email }, "-created_date", 20),
          Timesheet.filter({ user_id: u.email }, "-date", 50),
          UserEntity.list()
        ]);
        setMyLeaves(le);
        setMyTimesheets(ts);
        setUsersAll(allUsers);
      } catch (e) {
        // not logged-in public scenario
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recruiters;
    return recruiters.filter(r =>
      `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
      (r.email || "").toLowerCase().includes(q) ||
      (r.territory || "").toLowerCase().includes(q) ||
      (r.specializations || []).some(s => s.toLowerCase().includes(q))
    );
  }, [search, recruiters]);

  const handleCreateRecruiter = async (data, accessRoleIdParam) => {
    const accessRoleId = accessRoleIdParam || "";
    const fullName = `${data.first_name} ${data.last_name}`.trim();

    if (editingRecruiter) {
      await Recruiter.update(editingRecruiter.id, data);
      setEditingRecruiter(null);
      setShowRecruiterForm(false);

      // Update access level for existing user, if present
      if (data.email && accessRoleId) {
        const existing = await UserEntity.filter({ email: data.email });
        if (existing.length && existing[0].role_id !== accessRoleId) {
          await UserEntity.update(existing[0].id, { role_id: accessRoleId });
        }
      }
    } else {
      await Recruiter.create(data);
      setShowRecruiterForm(false);

      // If a user already exists, update access level immediately
      if (data.email && accessRoleId) {
        const existing = await UserEntity.filter({ email: data.email });
        if (existing.length && existing[0].role_id !== accessRoleId) {
          await UserEntity.update(existing[0].id, { role_id: accessRoleId, status: existing[0].status || "invited" });
        }
      }

      // Open invite modal to send instructions (Share-like flow)
      setInviteEmail(data.email || "");
      setInviteName(fullName || "");
      setInviteRoleId(accessRoleId || "");
      setShowInvite(true);
    }

    const r = await Recruiter.list("-created_date");
    setRecruiters(r);
  };

  const submitLeave = async (payload) => {
    await LeaveRequest.create({ ...payload, user_id: me?.email || "anonymous" });
    setShowLeaveForm(false);
    const le = await LeaveRequest.filter({ user_id: me?.email }, "-created_date", 20);
    setMyLeaves(le);
  };

  const submitTimesheet = async (payload) => {
    await Timesheet.create({ ...payload, user_id: me?.email || "anonymous" });
    setShowTimesheetForm(false);
    const ts = await Timesheet.filter({ user_id: me?.email }, "-date", 50);
    setMyTimesheets(ts);
  };

  const statusBadge = (status) => {
    const map = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
      on_leave: "bg-yellow-100 text-yellow-800"
    };
    return map[status] || "bg-gray-100 text-gray-800";
  };

  const requestDeleteRecruiter = (r) => {
    setRecruiterToDelete(r);
    setShowTransfer(true);
  };

  const afterTransfer = async () => {
    const r = await Recruiter.list("-created_date");
    setRecruiters(r);
    // After successful transfer/deletion, close the modals and clear state
    setShowTransfer(false);
    setRecruiterToDelete(null);
    setShowDetails(false); // Close details if open
    setSelectedRecruiter(null); // Clear selected recruiter
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Gradient header */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 text-white p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Recruiters</h1>
            <p className="opacity-90">Directory and team operations</p>
          </div>
          <div className="flex gap-2">
            <PermissionGate entity="LeaveRequest" action="create">
              <Button variant="secondary" className="gap-2" onClick={() => setShowLeaveForm(true)}>
                <Calendar className="w-4 h-4" /> Apply Leave
              </Button>
            </PermissionGate>
            <PermissionGate entity="Timesheet" action="create">
              <Button variant="secondary" className="gap-2" onClick={() => setShowTimesheetForm(true)}>
                <Clock className="w-4 h-4" /> Log Time
              </Button>
            </PermissionGate>
            <PermissionGate entity="Recruiter" action="create">
              <Button className="gap-2 bg-white text-indigo-700 hover:bg-slate-50" onClick={() => setShowRecruiterForm(true)}>
                <UserPlus className="w-4 h-4" /> Add Recruiter
              </Button>
            </PermissionGate>
          </div>
        </div>
      </div>

      <Tabs defaultValue="directory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          {/* Removed My Work tab from Recruiters */}
        </TabsList>

        <TabsContent value="directory" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input className="pl-10" placeholder="Search recruiters by name, email, specialization..." value={search} onChange={(e)=>setSearch(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Access Level</TableHead>
                    <TableHead>Territory</TableHead>
                    <TableHead>Specializations</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => {
                    const roleName = roles.find(role => role.id === r.role_id)?.name || r.role;
                    return (
                      <TableRow key={r.id} className="hover:bg-slate-50">
                        <TableCell className="font-medium">
                          <button
                            className="text-blue-600 hover:underline"
                            onClick={() => { setSelectedRecruiter(r); setShowDetails(true); }}
                            title="Open recruiter"
                          >
                            {r.first_name} {r.last_name}
                          </button>
                        </TableCell>
                        <TableCell>{r.email}</TableCell>
                        <TableCell className="capitalize">{roleName}</TableCell>
                        <TableCell>{r.territory || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(r.specializations || []).slice(0, 3).map(s => <Badge key={s} variant="outline" className="text-xs">{s}</Badge>)}
                            {(r.specializations || []).length > 3 && <Badge variant="outline" className="text-xs">+{r.specializations.length - 3}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell><Badge className={statusBadge(r.status)}>{r.status}</Badge></TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingRecruiter(r); setShowRecruiterForm(true); }}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <PermissionGate entity="Recruiter" action="delete">
                                <DropdownMenuItem className="text-red-600" onClick={() => requestDeleteRecruiter(r)}>
                                  <Trash className="w-4 h-4 mr-2" />
                                  Delete & Transfer…
                                </DropdownMenuItem>
                              </PermissionGate>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Removed: TabsContent value="mywork" section as per requirements */}
      </Tabs>

      {/* Details modal */}
      {showDetails && (
        <RecruiterDetails
          recruiter={selectedRecruiter}
          onClose={() => { setShowDetails(false); setSelectedRecruiter(null); }}
          onDelete={() => requestDeleteRecruiter(selectedRecruiter)}
        />
      )}

      {showRecruiterForm && (
        <RecruiterForm
          recruiter={editingRecruiter}
          onSave={handleCreateRecruiter}
          onCancel={()=>{ setShowRecruiterForm(false); setEditingRecruiter(null); }}
          roles={roles}
          users={usersAll}
        />
      )}
      {showLeaveForm && (
        <LeaveForm onSave={submitLeave} onCancel={()=>setShowLeaveForm(false)} />
      )}
      {showTimesheetForm && (
        <TimesheetForm onSave={submitTimesheet} onCancel={()=>setShowTimesheetForm(false)} jobs={jobs} />
      )}

      <div className="fixed bottom-6 right-6 z-50">
        <PermissionGate entity="Recruiter" action="create">
          <Button variant="outline" className="gap-2" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4" /> Import Recruiters
          </Button>
        </PermissionGate>
      </div>

      {showImport && (
        <ImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          entityName="Recruiters"
          entitySdk={Recruiter}
          onImported={() => { setShowImport(false); Recruiter.list("-created_date").then(setRecruiters); }}
        />
      )}

      {showTransfer && recruiterToDelete && (
        <TransferOwnershipModal
          open={showTransfer}
          onClose={() => { setShowTransfer(false); setRecruiterToDelete(null); }}
          recruiter={recruiterToDelete}
          recruiters={recruiters}
          users={usersAll}
          onTransferred={afterTransfer}
        />
      )}

      {/* NEW INVITE MODAL */}
      {showInvite && (
        <InviteUserModal
          open={showInvite}
          onClose={() => setShowInvite(false)}
          email={inviteEmail}
          name={inviteName}
          roles={roles}
          defaultRoleId={inviteRoleId}
          onInvited={() => setShowInvite(false)}
        />
      )}
    </div>
  );
}
