
import React from "react";
export function PermissionsProvider({ children }) { return <>{children}</>; }
export function usePermissions() {
  return { me:null, role:null, isAdmin:true, can:()=>true, scopeFor:()=>"all", listFilterFor:()=>null };
}
