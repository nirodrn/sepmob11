import React, { useMemo } from 'react';
import { useFirebaseData } from '../../../hooks/useFirebaseData';
import { useAuth } from '../../../context/AuthContext';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Badge } from '../../Common/Badge';
import { Clock, CheckCircle, XCircle, Truck } from 'lucide-react';

interface DisRefRequest {
  id: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  distributorId: string;
  items: Record<string, { name: string; qty: number }>;
  status: 'pending' | 'approved' | 'rejected' | 'dispatched';
  priority: 'normal' | 'urgent';
  notes?: string;
  createdAt: string;
  updatedAt: number;
}

interface DisRefRequestHistoryProps {
}

export function DisRefRequestHistory() {
  const { userData } = useAuth();
  const distributorId = userData?.distributorId;
  const repId = userData?.id;
  const { data: allRequests, loading, error } = useFirebaseData<Record<string, Omit<DisRefRequest, 'id'>>>(
    distributorId && repId ? `disRefReqs/${distributorId}/${repId}` : 'disRefReqs/unknown'
  );

  const userRequests = useMemo(() => {
    if (!allRequests || !userData) return [];

    const requests: DisRefRequest[] = [];

    Object.entries(allRequests).forEach(([requestIdKey, requestData]) => {
      Object.entries(requestData as Record<string, any>).forEach(([innerKey, innerData]) => {
        if (innerData && typeof innerData === 'object') {
          requests.push({ id: innerKey, ...innerData as Omit<DisRefRequest, 'id'> });
        }
      });
    });

    return requests
      .filter(request => request.requestedBy === userData.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allRequests, userData]);


  if (loading) return <LoadingSpinner text="Loading request history..." />;
  if (error) return <ErrorMessage message="Failed to load request history." />;
  if (!userData) return <ErrorMessage message="Please log in to view requests." />;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'dispatched': return <Truck className="w-4 h-4 text-blue-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'yellow';
      case 'approved': return 'green';
      case 'rejected': return 'red';
      case 'dispatched': return 'blue';
      default: return 'gray';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">My Request History</h3>
        <p className="text-sm text-gray-500 mt-1">Track your product requests to distributor</p>
      </div>
      
      {userRequests.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>You haven't made any requests yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {userRequests.map((request) => (
            <div key={request.id} className="p-4 hover:bg-gray-50">
              <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(request.status)}
                    <p className="text-sm font-medium text-gray-800">Request #{request.id}</p>
                    {request.priority === 'urgent' && (
                      <Badge color="red">Urgent</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Created: {new Date(request.createdAt).toLocaleString()}
                    {request.status === 'dispatched' && (
                      <span className="block text-green-600 font-medium">✓ Order Fulfilled</span>
                    )}
                  </p>
                </div>
                <div className="self-start sm:self-center">
                  <Badge color={getStatusColor(request.status)}>
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </Badge>
                </div>
              </div>

              <div className="mt-3">
                <h4 className="font-medium text-gray-800 text-sm mb-2">Requested Items:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(request.items).map(([key, item]) => (
                    <div key={key} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                      <span className="text-sm text-gray-700">{item.name}</span>
                      <span className="text-sm font-medium text-gray-900">Qty: {item.qty}</span>
                    </div>
                  ))}
                </div>
                
                {request.notes && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-md">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">Notes:</span> {request.notes}
                    </p>
                  </div>
                )}
                
                {request.status === 'dispatched' && (
                  <div className="mt-3">
                    <div className="p-3 bg-green-50 rounded-md border border-green-200">
                      <p className="text-sm text-green-800">
                        <span className="font-medium">✓ Order Complete:</span> Your request has been fulfilled and dispatched. Go to the "Claim Stock" page to claim your items.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}