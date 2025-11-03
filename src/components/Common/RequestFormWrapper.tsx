import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { validateRequestPermission } from '../../utils/requestValidation';
import { UserRole } from '../../types';

interface RequestFormWrapperProps {
  children: React.ReactNode;
  requiredRole: UserRole | UserRole[];
  targetTable: string;
  onUnauthorized?: () => void;
}

/**
 * Wrapper component that validates user permissions before allowing request creation
 */
export function RequestFormWrapper({ 
  children, 
  requiredRole, 
  targetTable, 
  onUnauthorized 
}: RequestFormWrapperProps) {
  const { userData } = useAuth();

  if (!userData) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">You must be logged in to create requests.</p>
      </div>
    );
  }

  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const hasValidRole = allowedRoles.includes(userData.role);
  const hasTablePermission = validateRequestPermission(userData.role, targetTable);

  if (!hasValidRole || !hasTablePermission) {
    if (onUnauthorized) {
      onUnauthorized();
    }
    
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">
          You don't have permission to create requests in this section.
        </p>
        <p className="text-red-600 text-sm mt-1">
          Your role: {userData.role} | Required: {allowedRoles.join(' or ')}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}