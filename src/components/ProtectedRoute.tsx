import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { LoadingSpinner } from './Common/LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { currentUser, userData, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner text="Authenticating..." fullPage />;
  }

  if (!currentUser || !userData) {
    return <Navigate to="/login" replace />;
  }
  
  // Check if user has access to sales system roles
  const salesRoles: UserRole[] = [
    'DirectRepresentative',
    'DirectShowroomManager', 
    'DirectShowroomStaff',
    'Distributor',
    'DistributorRepresentative',
    'HeadOfOperations',
    'MainDirector',
    'Admin',
    // Add existing system roles for testing
    'WarehouseStaff',
    'ProductionManager',
    'FinishedGoodsStoreManager',
    'PackingAreaManager'
  ];

  if (!salesRoles.includes(userData.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to access the sales system.
          </p>
          <div className="bg-gray-100 p-4 rounded-lg mb-4 text-left">
            <p className="text-sm text-gray-700">
              <strong>Current Role:</strong> {userData.role}
            </p>
            <p className="text-sm text-gray-700">
              <strong>Email:</strong> {userData.email}
            </p>
            <p className="text-sm text-gray-700">
              <strong>Name:</strong> {userData.name}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(userData.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Insufficient Permissions</h2>
          <p className="text-gray-600">
            You don't have permission to access this section.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}