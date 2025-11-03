import React, { useMemo } from 'react';
import { useFirebaseData } from '../../hooks/useFirebaseData';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../../components/Common/LoadingSpinner';
import { ErrorMessage } from '../../components/Common/ErrorMessage';
import { Badge } from '../../components/Common/Badge';
import { Users, Mail, Calendar, Shield } from 'lucide-react';

export function DistributorRepManagement() {
  const { userData } = useAuth();
  const { data: usersData, loading, error } = useFirebaseData<Record<string, any>>('users');

  const myRepresentatives = useMemo(() => {
    if (!usersData || !userData) return [];

    return Object.entries(usersData)
      .map(([id, user]) => ({ id, ...user }))
      .filter(user =>
        user.role === 'DistributorRepresentative' &&
        user.distributorId === userData.id
      )
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [usersData, userData]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load representatives." />;
  if (!userData) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Distributor Representatives Management
        </h1>
        <p className="text-gray-600 mt-1">
          Manage your assigned distributor representatives
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                My Representatives ({myRepresentatives.length})
              </h2>
              <p className="text-sm text-gray-600">
                Representatives assigned to your distribution network
              </p>
            </div>
          </div>
        </div>

        {myRepresentatives.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Representatives Assigned
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              You don't have any distributor representatives assigned to you yet.
              Contact your administrator to assign representatives to your account.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myRepresentatives.map((rep) => (
              <div
                key={rep.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {rep.name}
                    </h3>
                    <Badge variant={rep.status === 'active' ? 'success' : 'default'}>
                      {rep.status}
                    </Badge>
                  </div>
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Shield className="w-5 h-5 text-gray-600" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{rep.email}</span>
                  </div>

                  {rep.department && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Department:</span> {rep.department}
                    </div>
                  )}

                  {rep.createdAt && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span>
                        Joined {new Date(rep.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors">
                      View Requests
                    </button>
                    <button className="flex-1 px-3 py-2 text-sm bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors">
                      View Stock
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
