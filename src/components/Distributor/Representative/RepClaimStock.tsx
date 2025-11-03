import React, { useState, useMemo } from 'react';
import { useFirebaseData } from '../../../hooks/useFirebaseData';
import { ref, update } from 'firebase/database';
import { database } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { useDistributorRepStockOperations } from '../../../hooks/useDistributorRepStockOperations';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Badge } from '../../Common/Badge';
import { Package, CheckCircle, DollarSign } from 'lucide-react';

interface DispatchedRequest {
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
  dispatchedAt?: number;
  dispatchedBy?: string;
  dispatchedByName?: string;
  pricing?: Record<string, {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    finalPrice: number;
    totalValue: number;
  }>;
}

export function RepClaimStock() {
  const { userData } = useAuth();
  const { data: allRequests, loading, error } = useFirebaseData<Record<string, any>>('distributorRepRequests');
  const { data: usersData } = useFirebaseData<Record<string, any>>('users');
  const { addStockEntry } = useDistributorRepStockOperations();
  const [claiming, setClaiming] = useState<Record<string, boolean>>({});

  const myDispatchedRequests = useMemo(() => {
    if (!allRequests || !userData?.distributorId || !userData?.id) return [];

    const requests: DispatchedRequest[] = [];
    const distributorData = allRequests[userData.distributorId];

    if (distributorData && typeof distributorData === 'object') {
      Object.entries(distributorData).forEach(([requestId, data]: [string, any]) => {
        if (data && typeof data === 'object' && data.status === 'dispatched' && data.requestedBy === userData.id) {
          requests.push({
            id: requestId,
            ...data,
          });
        }
      });
    }

    return requests.sort((a, b) => (b.dispatchedAt || b.updatedAt || 0) - (a.dispatchedAt || a.updatedAt || 0));
  }, [allRequests, userData]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load dispatched requests." />;
  if (!userData) return null;

  const handleClaim = async (request: DispatchedRequest) => {
    if (!userData?.distributorId) return;

    setClaiming(prev => ({ ...prev, [request.id]: true }));

    try {
      const distributorInfo = usersData?.[userData.distributorId];

      for (const [key, item] of Object.entries(request.items)) {
        await addStockEntry(
          userData.id,
          userData.distributorId,
          item.productId,
          item.productName,
          item.quantity,
          request.id,
          'distributor_dispatch',
          {
            name: userData.name,
            role: userData.role,
            distributorName: distributorInfo?.name || 'Unknown Distributor',
            location: 'field'
          }
        );
      }

      const requestRef = ref(database, `distributorRepRequests/${userData.distributorId}/${request.id}`);
      await update(requestRef, {
        status: 'claimed',
        claimedAt: Date.now(),
        claimedBy: userData.id,
        claimedByName: userData.name
      });

      alert('Stock claimed successfully and added to your inventory!');
    } catch (error) {
      console.error('Error claiming stock:', error);
      alert('Failed to claim stock. Please try again.');
    } finally {
      setClaiming(prev => ({ ...prev, [request.id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Claim Dispatched Stock
        </h1>
        <p className="text-gray-600 mt-1">
          View and claim stock dispatched by your distributor
        </p>
      </div>

      {myDispatchedRequests.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No Dispatched Stock Available
          </h3>
          <p className="text-gray-600">
            You don't have any dispatched stock to claim at the moment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {myDispatchedRequests.map((request) => (
            <div key={request.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Request #{request.id.split('_').pop()}
                    </h3>
                    <Badge variant="success">Ready to Claim</Badge>
                    {request.priority === 'urgent' && (
                      <Badge variant="error">Urgent</Badge>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">From:</span> {usersData?.[request.distributorId]?.name || 'Unknown Distributor'}
                    </p>
                    <p>
                      <span className="font-medium">Dispatched:</span>{' '}
                      {new Date(request.dispatchedAt || request.updatedAt).toLocaleString()}
                    </p>
                    {request.dispatchedByName && (
                      <p>
                        <span className="font-medium">By:</span> {request.dispatchedByName}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleClaim(request)}
                  disabled={claiming[request.id]}
                  className="mt-4 sm:mt-0 w-full sm:w-auto px-6 py-2.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                >
                  {claiming[request.id] ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      Claim Stock
                    </>
                  )}
                </button>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium text-gray-900 mb-3">Items to Claim:</h4>
                <div className="space-y-3">
                  {Object.entries(request.items).map(([key, item]) => {
                    const pricingKey = Object.keys(request.pricing || {}).find((pk, idx) =>
                      Object.keys(request.items)[idx] === key
                    );
                    const pricingInfo = pricingKey ? request.pricing?.[pricingKey] : null;

                    return (
                      <div key={key} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{item.productName}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              Quantity: <span className="font-semibold text-gray-900">{item.quantity} units</span>
                            </p>
                          </div>
                        </div>

                        {pricingInfo && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-gray-200">
                            <div className="bg-blue-50 px-3 py-2 rounded">
                              <div className="text-xs text-blue-600 mb-1">Unit Price</div>
                              <div className="flex items-center gap-1 text-sm font-semibold text-blue-900">
                                <DollarSign size={14} />
                                {pricingInfo.unitPrice.toFixed(2)}
                              </div>
                            </div>
                            <div className="bg-amber-50 px-3 py-2 rounded">
                              <div className="text-xs text-amber-600 mb-1">Discount</div>
                              <div className="text-sm font-semibold text-amber-900">
                                {pricingInfo.discountPercent}%
                              </div>
                            </div>
                            <div className="bg-green-50 px-3 py-2 rounded">
                              <div className="text-xs text-green-600 mb-1">Final Price</div>
                              <div className="flex items-center gap-1 text-sm font-semibold text-green-900">
                                <DollarSign size={14} />
                                {pricingInfo.finalPrice.toFixed(2)}
                              </div>
                            </div>
                            <div className="bg-gray-100 px-3 py-2 rounded">
                              <div className="text-xs text-gray-600 mb-1">Total Value</div>
                              <div className="flex items-center gap-1 text-sm font-bold text-gray-900">
                                <DollarSign size={14} />
                                {pricingInfo.totalValue.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {request.pricing && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-blue-900">Order Total:</span>
                      <span className="text-lg font-bold text-blue-900">
                        Rs. {Object.values(request.pricing).reduce((sum, item) => sum + item.totalValue, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {request.notes && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Notes:</span> {request.notes}
                    </p>
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
