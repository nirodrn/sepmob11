import React, { useMemo, useState } from 'react';
import { useFirebaseData } from '../../../hooks/useFirebaseData';
import { useAuth } from '../../../context/AuthContext';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Badge } from '../../Common/Badge';
import { DisRefRequestForm } from './DisRefRequestForm';
import { FileText, Clock, CheckCircle, XCircle, Package, Plus } from 'lucide-react';

interface Request {
  id: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  distributorId: string;
  items: Record<string, { name: string; qty: number }>;
  status: 'pending' | 'approved' | 'rejected' | 'dispatched';
  priority: 'normal' | 'urgent';
  notes?: string;
  createdAt: number;
  updatedAt: number;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: number;
  approvalNotes?: string;
  dispatchedBy?: string;
  dispatchedByName?: string;
  dispatchedAt?: number;
  pricing?: Record<string, any>;
}

export function DistributorRepRequestHistory() {
  const { userData } = useAuth();
  const [showNewRequest, setShowNewRequest] = useState(false);

  const { data: allRequests, loading, error } = useFirebaseData<Record<string, any>>('disRefReqs');
  const { data: usersData } = useFirebaseData<Record<string, any>>('users');

  const myRequests = useMemo(() => {
    if (!allRequests || !userData?.distributorId || !userData?.id) return [];

    const requests: Request[] = [];
    const distributorData = allRequests[userData.distributorId];

    if (distributorData && typeof distributorData === 'object') {
      const repData = distributorData[userData.id];

      if (repData && typeof repData === 'object') {
        Object.entries(repData).forEach(([requestIdPrefix, nestedData]) => {
          if (nestedData && typeof nestedData === 'object') {
            Object.entries(nestedData).forEach(([id, data]: [string, any]) => {
              if (data && typeof data === 'object') {
                requests.push({
                  id,
                  ...data,
                  createdAt: typeof data.createdAt === 'string' ? new Date(data.createdAt).getTime() : data.createdAt
                });
              }
            });
          }
        });
      }
    }

    return requests.sort((a, b) => b.createdAt - a.createdAt);
  }, [allRequests, userData]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load request history." />;
  if (!userData) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'dispatched':
        return <Package className="w-5 h-5 text-blue-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'approved':
      case 'dispatched':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Request History
          </h1>
          <p className="text-gray-600 mt-1">
            View all your requests to the distributor
          </p>
        </div>
        <button
          onClick={() => setShowNewRequest(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          Add Request
        </button>
      </div>

      {myRequests.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Requests Yet
          </h3>
          <p className="text-gray-600">
            You haven't submitted any requests to your distributor yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {myRequests.map((request) => (
            <div key={request.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {getStatusIcon(request.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">
                        Request #{request.id.split('_').pop()}
                      </h3>
                      <Badge variant={getStatusVariant(request.status)}>
                        {request.status}
                      </Badge>
                      {request.priority === 'urgent' && (
                        <Badge variant="error">Urgent</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      To: {usersData?.[request.distributorId]?.name || 'Unknown Distributor'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(request.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-gray-900 text-sm mb-2">Requested Products:</h4>
                  <div className="space-y-2">
                    {Object.entries(request.items).map(([key, item]) => (
                      <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                        <span className="text-gray-700">
                          {item.name}
                        </span>
                        <span className="font-medium text-gray-900">Qty: {item.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {request.status === 'dispatched' && request.pricing && (
                  <div>
                    <h4 className="font-medium text-gray-900 text-sm mb-2">Dispatched with Pricing:</h4>
                    <div className="space-y-2">
                      {Object.entries(request.pricing).map(([key, pricingItem]: [string, any]) => (
                        <div key={key} className="p-2 bg-blue-50 rounded text-sm">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-700 font-medium">{pricingItem.productName}</span>
                            <span className="font-medium text-blue-900">Qty: {pricingItem.quantity}</span>
                          </div>
                          <div className="flex justify-between items-center mt-1 text-xs text-gray-600">
                            <span>Unit Price: Rs. {pricingItem.unitPrice}</span>
                            <span>Discount: {pricingItem.discountPercent}%</span>
                            <span className="font-semibold">Final: Rs. {pricingItem.finalPrice}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {request.dispatchedAt && (
                      <p className="text-xs text-gray-500 mt-2">
                        Dispatched on {new Date(request.dispatchedAt).toLocaleString()} by {request.dispatchedByName}
                      </p>
                    )}
                  </div>
                )}

                {request.notes && (
                  <div className="p-3 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Notes:</span> {request.notes}
                    </p>
                  </div>
                )}

                {request.status === 'approved' && request.approvedAt && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-800">
                      Approved on {new Date(request.approvedAt).toLocaleString()} by {request.approvedByName}
                    </p>
                    {request.approvalNotes && (
                      <p className="text-sm text-green-700 mt-1">
                        <span className="font-medium">Notes:</span> {request.approvalNotes}
                      </p>
                    )}
                  </div>
                )}

                {request.status === 'rejected' && request.approvedAt && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800 mb-1">
                      Rejected on {new Date(request.approvedAt).toLocaleString()} by {request.approvedByName}
                    </p>
                    {request.approvalNotes && (
                      <p className="text-sm text-red-700">
                        <span className="font-medium">Reason:</span> {request.approvalNotes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <DisRefRequestForm
        isOpen={showNewRequest}
        onClose={() => setShowNewRequest(false)}
        onSuccess={() => setShowNewRequest(false)}
      />
    </div>
  );
}
