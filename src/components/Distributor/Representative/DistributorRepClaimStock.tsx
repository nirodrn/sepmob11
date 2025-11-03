import React, { useState, useMemo } from 'react';
import { useFirebaseData, useFirebaseActions } from '../../../hooks/useFirebaseData';
import { ref, get, update } from 'firebase/database';
import { database } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { useDistributorRepStockOperations } from '../../../hooks/useDistributorRepStockOperations';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Badge } from '../../Common/Badge';
import { Package, CheckCircle, DollarSign, Percent } from 'lucide-react';

interface DispatchedStock {
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  distributorId: string;
  items: Record<string, { name: string; qty: number; productId?: string }>;
  status: 'pending' | 'approved' | 'rejected' | 'dispatched' | 'claimed';
  priority: 'normal' | 'urgent';
  notes?: string;
  createdAt: number;
  updatedAt: number;
  dispatchedAt?: number;
  dispatchedBy?: string;
  dispatchedByName?: string;
  dispatchedAtTimestamp?: number;
  pricing?: Record<string, any>;
  requestIdPrefix?: string;
}

export function DistributorRepClaimStock() {
  const { userData } = useAuth();
  const { data: allRequests, loading, error } = useFirebaseData<Record<string, any>>('disRefReqs');
  const { data: usersData } = useFirebaseData<Record<string, any>>('users');
  const { addStockEntry } = useDistributorRepStockOperations();
  const [claiming, setClaiming] = useState<Record<string, boolean>>({});

  const myDispatchedRequests = useMemo(() => {
    if (!allRequests || !userData?.distributorId || !userData?.id) return [];

    const requests: (DispatchedStock & { id: string; requestIdPrefix: string })[] = [];
    const distributorData = allRequests[userData.distributorId];

    if (distributorData && typeof distributorData === 'object') {
      const repData = distributorData[userData.id];

      if (repData && typeof repData === 'object') {
        Object.entries(repData).forEach(([requestIdPrefix, nestedData]) => {
          if (nestedData && typeof nestedData === 'object') {
            Object.entries(nestedData).forEach(([id, data]: [string, any]) => {
              if (data && typeof data === 'object' && data.status === 'dispatched') {
                requests.push({
                  id,
                  requestIdPrefix,
                  ...data,
                  createdAt: typeof data.createdAt === 'string' ? new Date(data.createdAt).getTime() : data.createdAt
                });
              }
            });
          }
        });
      }
    }

    return requests.sort((a, b) => (b.dispatchedAt || b.updatedAt || 0) - (a.dispatchedAt || a.updatedAt || 0));
  }, [allRequests, userData]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load dispatched requests." />;
  if (!userData) return null;

  const handleClaim = async (request: DispatchedStock & { id: string; requestIdPrefix: string }) => {
    if (!userData?.distributorId || !request.requestIdPrefix) return;

    setClaiming(prev => ({ ...prev, [request.id]: true }));

    try {
      const distributorInfo = usersData?.[userData.distributorId];

      for (const [key, item] of Object.entries(request.items)) {
        const productId = (item as any).productId || key;

        const pricingKey = Object.keys(request.pricing || {}).find((pk, idx) =>
          Object.keys(request.items)[idx] === key
        );
        const pricingInfo = pricingKey ? request.pricing?.[pricingKey] : null;

        await addStockEntry(
          userData.id,
          userData.distributorId,
          productId,
          item.name,
          item.qty,
          request.id,
          'distributor_dispatch',
          {
            name: userData.name,
            role: userData.role,
            distributorName: distributorInfo?.name || 'Unknown Distributor',
            location: 'field'
          },
          pricingInfo ? {
            unitPrice: pricingInfo.unitPrice,
            discountPercent: pricingInfo.discountPercent,
            finalPrice: pricingInfo.finalPrice,
            totalValue: pricingInfo.totalValue
          } : undefined
        );
      }

      const requestRef = ref(database, `disRefReqs/${userData.distributorId}/${userData.id}/${request.requestIdPrefix}/${request.id}`);
      await update(requestRef, {
        status: 'claimed',
        claimedAt: Date.now(),
        claimedBy: userData.id,
        claimedByName: userData.name
      });

      alert('Stock claimed successfully!');
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
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">From:</span> {usersData?.[request.distributorId]?.name || 'Unknown Distributor'}
                    </p>
                    <p>
                      <span className="font-medium">Dispatched:</span>{' '}
                      {new Date(request.dispatchedAt || request.updatedAt).toLocaleString()}
                    </p>
                    <p>
                      <span className="font-medium">Total Items:</span>{' '}
                      {Object.values(request.items).reduce((sum, item) => sum + item.qty, 0)} units
                    </p>
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
                      <div key={key} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Quantity: <span className="font-semibold">{item.qty}</span>
                          </p>
                          {pricingInfo && (
                            <div className="mt-2 space-y-1 text-sm">
                              <div className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-1 rounded">
                                <DollarSign size={14} />
                                <span>Unit Price: ${pricingInfo.unitPrice?.toFixed(2)}</span>
                              </div>
                              {pricingInfo.discountPercent > 0 && (
                                <div className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-1 rounded">
                                  <Percent size={14} />
                                  <span>Discount: {pricingInfo.discountPercent}%</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1 text-green-700 bg-green-50 px-2 py-1 rounded font-semibold">
                                <DollarSign size={14} />
                                <span>Final Price: ${pricingInfo.finalPrice?.toFixed(2)}</span>
                              </div>
                              <div className="text-gray-700 bg-gray-100 px-2 py-1 rounded font-semibold">
                                Total: ${pricingInfo.totalValue?.toFixed(2)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
