/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, ReactNode, useContext } from "react";

export const RBAC_STORAGE_KEY = "sar_guardian_rbac";

// Role Definitions
export type Role = "admin" | "compliance_officer" | "reviewer" | "analyst" | "viewer";

export interface RolePermissions {
  canViewReviewQueue: boolean;
  canApproveReports: boolean;
  canEditReports: boolean;
  canDeleteReports: boolean;
  canViewLawComparison: boolean;
  canViewLawAdaptation: boolean;
  canAccessAuditTrail: boolean;
  canExportReports: boolean;
  canManageUsers: boolean;
  canConfigureLaws: boolean;
  canViewAnalytics: boolean;
  canViewSARElements: boolean;
  canAccessFlaggedTransactions: boolean;
  canRunAnalysis: boolean;
  canCalibrateThresholds: boolean;
  canScheduleReports: boolean;
  canAccessArchive: boolean;
}

// Role Permission Mappings
const ROLE_PERMISSIONS: Record<Role, RolePermissions> = {
  admin: {
    canViewReviewQueue: true,
    canApproveReports: true,
    canEditReports: true,
    canDeleteReports: true,
    canViewLawComparison: true,
    canViewLawAdaptation: true,
    canAccessAuditTrail: true,
    canExportReports: true,
    canManageUsers: true,
    canConfigureLaws: true,
    canViewAnalytics: true,
    canViewSARElements: true,
    canAccessFlaggedTransactions: true,
    canRunAnalysis: true,
    canCalibrateThresholds: true,
    canScheduleReports: true,
    canAccessArchive: true,
  },
  compliance_officer: {
    canViewReviewQueue: true,
    canApproveReports: true,
    canEditReports: true,
    canDeleteReports: false,
    canViewLawComparison: true,
    canViewLawAdaptation: true,
    canAccessAuditTrail: true,
    canExportReports: true,
    canManageUsers: false,
    canConfigureLaws: false,
    canViewAnalytics: true,
    canViewSARElements: true,
    canAccessFlaggedTransactions: true,
    canRunAnalysis: true,
    canCalibrateThresholds: false,
    canScheduleReports: true,
    canAccessArchive: true,
  },
  reviewer: {
    canViewReviewQueue: true,
    canApproveReports: false,
    canEditReports: false,
    canDeleteReports: false,
    canViewLawComparison: true,
    canViewLawAdaptation: true,
    canAccessAuditTrail: false,
    canExportReports: true,
    canManageUsers: false,
    canConfigureLaws: false,
    canViewAnalytics: true,
    canViewSARElements: true,
    canAccessFlaggedTransactions: true,
    canRunAnalysis: false,
    canCalibrateThresholds: false,
    canScheduleReports: false,
    canAccessArchive: false,
  },
  analyst: {
    canViewReviewQueue: true,
    canApproveReports: false,
    canEditReports: false,
    canDeleteReports: false,
    canViewLawComparison: true,
    canViewLawAdaptation: false,
    canAccessAuditTrail: false,
    canExportReports: false,
    canManageUsers: false,
    canConfigureLaws: false,
    canViewAnalytics: true,
    canViewSARElements: true,
    canAccessFlaggedTransactions: true,
    canRunAnalysis: true,
    canCalibrateThresholds: false,
    canScheduleReports: false,
    canAccessArchive: false,
  },
  viewer: {
    canViewReviewQueue: false,
    canApproveReports: false,
    canEditReports: false,
    canDeleteReports: false,
    canViewLawComparison: false,
    canViewLawAdaptation: false,
    canAccessAuditTrail: false,
    canExportReports: false,
    canManageUsers: false,
    canConfigureLaws: false,
    canViewAnalytics: false,
    canViewSARElements: true,
    canAccessFlaggedTransactions: false,
    canRunAnalysis: false,
    canCalibrateThresholds: false,
    canScheduleReports: false,
    canAccessArchive: false,
  },
};

export interface RBACUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  isActive: boolean;
}

export const DEFAULT_RBAC_USER: RBACUser = {
  id: "user-001",
  name: "J. Morrison",
  email: "j.morrison@barclays.com",
  role: "compliance_officer",
  department: "Financial Crimes Compliance",
  isActive: true,
};

export interface RBACContextValue {
  currentUser: RBACUser;
  setCurrentUser: (user: RBACUser) => void;
  saveUser: (user: RBACUser) => void;
  permissions: RolePermissions;
  hasPermission: (permission: keyof RolePermissions) => boolean;
  canAccess: (requiredPermissions: (keyof RolePermissions)[]) => boolean;
  switchRole: (role: Role) => void;
}

export const RBACContext = createContext<RBACContextValue>({
  currentUser: DEFAULT_RBAC_USER,
  setCurrentUser: () => {},
  saveUser: () => {},
  permissions: ROLE_PERMISSIONS.compliance_officer,
  hasPermission: () => false,
  canAccess: () => false,
  switchRole: () => {},
});

export function RBACProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<RBACUser>(() => {
    try {
      const stored = localStorage.getItem(RBAC_STORAGE_KEY);
      return stored ? { ...DEFAULT_RBAC_USER, ...JSON.parse(stored) } : DEFAULT_RBAC_USER;
    } catch {
      return DEFAULT_RBAC_USER;
    }
  });

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === RBAC_STORAGE_KEY && e.newValue) {
        try {
          setCurrentUserState({ ...DEFAULT_RBAC_USER, ...JSON.parse(e.newValue) });
        } catch (error) {
          console.error("Failed to parse stored RBAC user:", error);
        }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setCurrentUser = (user: RBACUser) => setCurrentUserState(user);

  const saveUser = (user: RBACUser) => {
    localStorage.setItem(RBAC_STORAGE_KEY, JSON.stringify(user));
    setCurrentUserState(user);
  };

  const permissions = ROLE_PERMISSIONS[currentUser.role];

  const hasPermission = (permission: keyof RolePermissions): boolean => {
    return permissions[permission] || false;
  };

  const canAccess = (requiredPermissions: (keyof RolePermissions)[]): boolean => {
    return requiredPermissions.every((perm) => hasPermission(perm));
  };

  const switchRole = (role: Role) => {
    const newUser = { ...currentUser, role };
    saveUser(newUser);
  };

  return (
    <RBACContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        saveUser,
        permissions,
        hasPermission,
        canAccess,
        switchRole,
      }}
    >
      {children}
    </RBACContext.Provider>
  );
}

// Hook to use RBAC context
export function useRBAC(): RBACContextValue {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error("useRBAC must be used within RBACProvider");
  }
  return context;
}
