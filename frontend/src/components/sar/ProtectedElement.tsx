import React from "react";
import { useRBAC } from "@/hooks/useRBAC";
import { RolePermissions } from "@/context/RBACContext";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProtectedElementProps {
  requiredPermissions: (keyof RolePermissions)[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLockedMessage?: boolean;
}

export function ProtectedElement({
  requiredPermissions,
  children,
  fallback,
  showLockedMessage = true,
}: ProtectedElementProps) {
  const { canAccess, currentUser } = useRBAC();

  if (!canAccess(requiredPermissions)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showLockedMessage) {
      return (
        <Card className="border-orange-500/40 bg-orange-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-foreground">Access Restricted</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your role ({currentUser.role.replace(/_/g, " ")}) does not have permission to access this content.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return null;
  }

  return <>{children}</>;
}

interface RoleBasedAccessProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLockedMessage?: boolean;
}

export function RoleBasedAccess({
  allowedRoles,
  children,
  fallback,
  showLockedMessage = true,
}: RoleBasedAccessProps) {
  const { currentUser } = useRBAC();

  if (!allowedRoles.includes(currentUser.role)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showLockedMessage) {
      return (
        <Card className="border-orange-500/40 bg-orange-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-foreground">Role Restricted</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your role ({currentUser.role.replace(/_/g, " ")}) cannot access this feature. Allowed roles:{" "}
                  {allowedRoles.join(", ").replace(/_/g, " ")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return null;
  }

  return <>{children}</>;
}

interface AccessControlBadgeProps {
  requiredPermissions?: (keyof RolePermissions)[];
  allowedRoles?: string[];
  label?: string;
}

export function AccessControlBadge({
  requiredPermissions,
  allowedRoles,
  label = "Restricted Access",
}: AccessControlBadgeProps) {
  const { canAccess, currentUser } = useRBAC();

  let hasAccess = true;

  if (requiredPermissions) {
    hasAccess = canAccess(requiredPermissions);
  } else if (allowedRoles) {
    hasAccess = allowedRoles.includes(currentUser.role);
  }

  if (!hasAccess) {
    return (
      <Badge variant="secondary" className="text-xs flex items-center gap-1">
        <Lock className="w-3 h-3" />
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-xs flex items-center gap-1">
      ✓ Accessible
    </Badge>
  );
}
