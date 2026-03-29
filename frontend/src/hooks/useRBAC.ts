import { useContext } from "react";
import { RBACContext, RBACContextValue } from "@/context/RBACContext";

export function useRBAC(): RBACContextValue {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error("useRBAC must be used within RBACProvider");
  }
  return context;
}
