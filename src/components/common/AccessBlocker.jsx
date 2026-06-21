import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Lock, Clock, LogOut } from "lucide-react";
import { User as UserEntity } from "@/entities/User";

export default function AccessBlocker({ user }) {
  // Force logout on mount if user is blocked
  useEffect(() => {
    const forceLogout = async () => {
      if (user && (user.is_locked || user.status !== "active")) {
        console.warn("AccessBlocker: Forcing logout for blocked user");
        try {
          // Store reason before logout
          sessionStorage.setItem("access_denied_reason", JSON.stringify({
            is_locked: user.is_locked,
            status: user.status,
            email: user.email,
            full_name: user.full_name
          }));
          
          await UserEntity.logout();
          window.location.href = "/?error=access_denied";
        } catch (error) {
          console.error("Force logout failed:", error);
        }
      }
    };

    // Delay slightly to allow the component to render the message
    const timer = setTimeout(forceLogout, 2000);
    return () => clearTimeout(timer);
  }, [user]);

  const reason = (() => {
    if (user?.is_locked) return "Your account has been locked. Please contact an administrator.";
    if (user?.status === "inactive") return "Your account is inactive. Please contact an administrator to activate your account.";
    if (user?.status === "invited") return "Your account is pending approval by an administrator.";
    return "Your access is restricted. Please contact an administrator.";
  })();

  const details = (() => {
    if (user?.is_locked) return user?.lock_reason ? `Reason: ${user.lock_reason}` : "Your access has been restricted by an administrator.";
    if (user?.status === "inactive") return "Your account has been deactivated. You will be logged out shortly.";
    if (user?.status === "invited") return "An admin must approve your access before you can use the app. You will be logged out shortly.";
    return "Access is restricted. You will be logged out shortly.";
  })();

  const logout = async () => {
    try {
      sessionStorage.setItem("access_denied_reason", JSON.stringify({
        is_locked: user?.is_locked,
        status: user?.status,
        email: user?.email,
        full_name: user?.full_name
      }));
      
      await UserEntity.logout();
      window.location.href = "/?error=access_denied";
    } catch (error) {
      console.error("Logout failed:", error);
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white border-2 border-red-300 rounded-2xl shadow-lg p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          {user?.is_locked ? <Lock className="w-8 h-8 text-red-600" /> : <ShieldAlert className="w-8 h-8 text-red-600" />}
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            {user?.is_locked ? "Account Locked" : user?.status === "inactive" ? "Account Inactive" : "Access Restricted"}
          </h2>
          <p className="text-red-600 font-medium text-lg mb-3">{reason}</p>
          <p className="text-slate-600 text-sm">{details}</p>
        </div>

        <div className="flex items-center justify-center gap-2">
          {user?.status && (
            <Badge variant="secondary" className="capitalize text-base px-4 py-1">
              Status: {user.status}
            </Badge>
          )}
          {user?.is_locked && (
            <Badge className="bg-red-600 text-white text-base px-4 py-1">
              Locked
            </Badge>
          )}
        </div>

        <div className="pt-4 border-t">
          <Button 
            onClick={logout} 
            className="gap-2 bg-red-600 hover:bg-red-700 w-full"
            size="lg"
          >
            <LogOut className="w-5 h-5" /> 
            Sign Out Now
          </Button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2 justify-center pt-2">
          <Clock className="w-4 h-4" /> 
          You will be automatically logged out in a few seconds
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
          <p className="text-sm text-blue-900 font-medium mb-2">Need Help?</p>
          <p className="text-xs text-blue-800">
            Contact your system administrator to:
          </p>
          <ul className="text-xs text-blue-800 mt-2 space-y-1 ml-4 list-disc">
            <li>Unlock your account</li>
            <li>Activate your access</li>
            <li>Review your account status</li>
          </ul>
        </div>
      </div>
    </div>
  );
}