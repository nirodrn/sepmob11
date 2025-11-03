import React, { useMemo, useState } from 'react';
import { useFirebaseData } from '../../../hooks/useFirebaseData';
import { useAuth } from '../../../context/AuthContext';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Badge } from '../../Common/Badge';
import { RepRequestForm } from './RepRequestForm';
import { FileText, Clock, CheckCircle, XCircle, Package, Plus, DollarSign } from 'lucide-react';

interface Request {
  id: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  distributorId: string;
  items: Record<string, { productId: string; productName: string; quantity: number }>;
  status: 'pending' | 'approved' | 'rejected' | 'dispatched' | 'claimed';
  priority: 'normal' | 'urgent';
  notes?: string;
  createdAt: number;
  updatedAt: number;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: number;
  approvalNotes?: string;
  rejectedReason?: string;
  dispatchedBy?: string;
  dispatchedByName?: string;
  dispatchedAt?: number;
  pricing?: Record<string, {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    finalPrice: number;
    totalValue: number;
  }>;
  claimedAt?: number;
  claimedBy?: string;
  claimedByName?: string;
}

export function RepRequestHistory() {
  const { userData } = useAuth();
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'approved' | 'dispatched' | 'rejected' | 'claimed'>('all');

  const { data: allRequests, loading, error } = useFirebaseData<Record<string, any>>('distributorRepRequests');
  const { data: usersData } = useFirebaseData<Record<string, any>>('users');

  const myRequests = useMemo(() => {
    if (!allRequests || !userData?.distributorId || !userData?.id) return [];

    const requests: Request[] = [];
    const distributorData = allRequests[userData.distributorId];

    if (distributorData && typeof distributorData === 'object') {
      Object.entries(distributorData).forEach(([requestId, data]: [string, any]) => {
        if (data && typeof data === 'object' && data.requestedBy === userData.id) {
          requests.push({
            id: requestId,
            ...data,
          });
        }
      });
    }

    return requests.sort((a, b) => b.createdAt - a.createdAt);
  }, [allRequests, userData]);

  const filteredRequests = useMemo(() => {
    if (selectedStatus === 'all') return myRequests;
    return myRequests.filter(req => req.status === selectedStatus);
  }, [myRequests, selectedStatus]);

  const statusCounts = useMemo(() => {
    const counts = {
      all: myRequests.length,
      pending: 0,
      approved: 0,
      dispatched: 0,
      rejected: 0,
      claimed: 0
    };

    myRequests.forEach(req => {
      if (req.status in counts) {
        counts[req.status as keyof typeof counts]++;
      }
    });

    return counts;
  }, [myRequests]);

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
      case 'claimed':
        return <CheckCircle className="w-5 h-5 text-green-700" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'dispatched':
      case 'claimed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'dispatched': return 'Ready to Claim';
      case 'claimed': return 'Claimed';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            My Stock Requests
          </h1>
          <p className="text-gray-600 mt-1">
            Track your requests to the distributor
          </p>
        </div>
        <button
          onClick={() => setShowNewRequest(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          New Request
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'approved', 'dispatched', 'rejected', 'claimed'] as const).map(status => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedStatus === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status]})
          </button>
        ))}
      </div>

      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No {selectedStatus !== 'all' ? selectedStatus : ''} Requests
          </h3>
          <p className="text-gray-600">
            {selectedStatus === 'all'
              ? "You haven't submitted any requests yet."
              : `You don't have any ${selectedStatus} requests.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredRequests.map((request) => (
            <div key={request.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {getStatusIcon(request.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-900">
                        Request #{request.id.split('_').pop()}
                      </h3>
                      <Badge variant={getStatusVariant(request.status)}>
                        {getStatusText(request.status)}
                      </Badge>
                      {request.priority === 'urgent' && (
                        <Badge variant="error">Urgent</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      To: {usersData?.[request.distributorId]?.name || 'Unknown Distributor'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Submitted: {new Date(request.createdAt).toLocaleString()}
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
                          {item.productName}
                        </span>
                        <span className="font-medium text-gray-900">Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {request.status === 'dispatched' && request.pricing && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 text-sm mb-2 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Ready to Claim - Pricing Details:
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(request.pricing).map(([key, pricingItem]) => (
                        <div key={key} className="p-2 bg-white rounded border border-blue-200">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-gray-800 font-medium">{pricingItem.productName}</span>
                            <span className="font-medium text-blue-900">Qty: {pricingItem.quantity}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              Unit: Rs. {pricingItem.unitPrice.toFixed(2)}
                            </div>
                            <div>Discount: {pricingItem.discountPercent}%</div>
                            <div className="font-semibold text-green-700">
                              Final: Rs. {pricingItem.finalPrice.toFixed(2)}
                            </div>
                            <div className="font-semibold text-gray-800">
                              Total: Rs. {pricingItem.totalValue.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {request.dispatchedAt && (
                      <p className="text-xs text-blue-700 mt-2">
                        Dispatched on {new Date(request.dispatchedAt).toLocaleString()} by {request.dispatchedByName}
                      </p>
                    )}
                  </div>
                )}

                {request.status === 'claimed' && request.claimedAt && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-800">
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      Stock claimed on {new Date(request.claimedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {request.notes && (
                  <div className="p-3 bg-gray-50 rounded-md">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Your Notes:</span> {request.notes}
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
                    {request.rejectedReason && (
                      <p className="text-sm text-red-700">
                        <span className="font-medium">Reason:</span> {request.rejectedReason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <RepRequestForm
        isOpen={showNewRequest}
        onClose={() => setShowNewRequest(false)}
        onSuccess={() => setShowNewRequest(false)}
      />
    </div>
  );
}
