import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User } from "@/entities/User";
import { Loader2, UserPlus, AlertCircle, CheckCircle, Mail, Shield, Copy } from "lucide-react";
import { addNotification } from "@/components/notifications/NotificationToast";

export default function InviteUserModal({ open, onClose, roles, onSuccess }) {
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [seat, setSeat] = useState("core");
  const [loading, setLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleInvite = async (e) => {
    e.preventDefault();

    if (!email || !roleId) {
      addNotification({
        type: "error",
        title: "Missing Information",
        message: "Please fill in all required fields"
      });
      return;
    }

    setLoading(true);

    try {
      // Check if user already exists in the app
      const existingUsers = await User.list();
      const userExists = existingUsers.find(u => u.email === email);

      if (userExists) {
        // Update existing user's role and seat
        await User.update(userExists.id, {
          role_id: roleId,
          seat: seat,
          status: "active"
        });

        addNotification({
          type: "success",
          title: "User Updated",
          message: `${email} has been granted access with the selected role`
        });

        onSuccess && onSuccess(userExists);
        handleClose();
      } else {
        // User doesn't exist yet — show how to invite via Supabase Auth.
        setShowInstructions(true);
        addNotification({
          type: "info",
          title: "Send the user an invite link",
          message: "Follow the instructions to invite this user."
        });
      }

    } catch (error) {
      console.error("Error inviting user:", error);
      addNotification({
        type: "error",
        title: "Error",
        message: error.message || "Failed to process user invitation"
      });
    }

    setLoading(false);
  };

  const handleClose = () => {
    setEmail("");
    setRoleId("");
    setSeat("core");
    setShowInstructions(false);
    onClose();
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(email);
    addNotification({
      type: "success",
      title: "Copied",
      message: "Email copied to clipboard"
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border-2 border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Invite User</h3>
                <p className="text-sm text-slate-600">Add a new user to the application</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {!showInstructions ? (
          <form onSubmit={handleInvite} className="p-6 space-y-6">
            {/* Important Notice */}
            <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">
                    Send the user an invite link
                  </h4>
                  <p className="text-xs text-blue-800">
                    Enter the user's email and role. If they don't exist yet, we'll show you the
                    Supabase Auth invite steps.
                  </p>
                </div>
              </div>
            </div>

            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-500" />
                Email Address *
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="w-full"
              />
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label htmlFor="role" className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-500" />
                Access Level *
              </Label>
              <Select value={roleId} onValueChange={setRoleId} required>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select access level" />
                </SelectTrigger>
                <SelectContent>
                  {roles && roles.map(role => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seat Type */}
            <div className="space-y-2">
              <Label htmlFor="seat">Seat Type</Label>
              <Select value={seat} onValueChange={setSeat}>
                <SelectTrigger id="seat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="core">Core User</SelectItem>
                  <SelectItem value="collaborator">Collaborator</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Core users have full access. Collaborators have limited permissions.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !roleId}
                className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Grant Access
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-6">
            {/* Success/Info Header */}
            <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-green-900 mb-1">
                    Role Configuration Saved
                  </h4>
                  <p className="text-xs text-green-800">
                    Their role and seat are queued. Now send them an invite from the
                    Supabase Auth dashboard so they can sign in.
                  </p>
                </div>
              </div>
            </div>

            {/* User Email Display */}
            <div className="p-4 bg-slate-50 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Email to invite:</p>
                  <p className="font-mono text-sm font-semibold text-slate-900">{email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyEmail}
                  className="gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-900">Invite via Supabase Auth</h4>

              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">Open the Supabase dashboard for this project.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">Go to <strong>Authentication → Users → Invite user</strong>.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">
                      Paste email: <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">{email}</code> and send.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold flex-shrink-0">✓</div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">
                      On first sign-in their <code>user_profile</code> row is created with the role
                      <strong> {roles.find(r => r.id === roleId)?.name || ""}</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* What happens next */}
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h5 className="text-sm font-semibold text-purple-900 mb-2">What happens next?</h5>
              <ul className="text-xs text-purple-800 space-y-1 ml-4 list-disc">
                <li>Supabase emails the user a magic invite link.</li>
                <li>They click it, set a password, and land in Recruiter X.</li>
                <li>Their role is set to <strong>{roles.find(r => r.id === roleId)?.name}</strong>.</li>
              </ul>
            </div>

            {/* Action button */}
            <div className="flex items-center gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}