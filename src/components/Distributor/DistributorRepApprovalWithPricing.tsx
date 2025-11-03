import React, { useState, useMemo } from 'react';
import { useFirebaseData } from '../../hooks/useFirebaseData';
import { ref, get, set, update } from 'firebase/database';
import { database } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../Common/Modal';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { ErrorMessage } from '../Common/ErrorMessage';
import { Badge } from '../Common/Badge';
import { Check, X, Package, DollarSign, Percent } from 'lucide-react';

interface DistributorRepRequest {
  id: string;
  distributorId: string;
  disRefId: string;
  disRefName?: string;
  requestIdPrefix: string;
  status: 'pending' | 'approved' | 'rejected' | 'dispatched';
  requestDate: string;
  products: Record<string, number>;
  notes?: string;
  priority?: string;
  approvedAt?: number;
  approvedBy?: string;
  approverName?: string;
  dispatchedAt?: number;
  dispatchedBy?: string;
  dispatcherName?: string;
  pricing?: Record<string, { adjustmentType: 'fixed' | 'percentage'; adjustmentValue: number; finalPrice: number }>;
}

export function DistributorRepApprovalWithPricing() {
  const { userData } = useAuth();
  const { data: allRequests, loading, error } = useFirebaseData<Record<string, DistributorRepRequest>>('disRefReqs');
  const { data: usersData } = useFirebaseData<Record<string, any>>('users');
  const { data: inventoryData } = useFirebaseData<Record<string, any>>('finishedGoodsPackagedInventory');

  const [selectedRequest, setSelectedRequest] = useState<DistributorRepRequest | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState<'approve' | 'reject' | 'dispatch'>('approve');
  const [actionNotes, setActionNotes] = useState('');
  const [dispatchQuantities, setDispatchQuantities] = useState<Record<string, number>>({});
  const [pricingAdjustments, setPricingAdjustments] = useState<Record<string, { type: 'fixed' | 'percentage'; value: number }>>({});
  const [processing, setProcessing] = useState(false);

  const productNameMap = useMemo(() => {
    if (!inventoryData) return new Map();

    const map = new Map();
    Object.values(inventoryData).forEach((item: any) => {
      if (item.productId && item.productName && !map.has(item.productId)) {
        map.set(item.productId, `${item.productName} - ${item.variantName || 'Standard'}`);
      }
    });
    return map;
  }, [inventoryData]);

  const distributorRequests = useMemo(() => {
    if (!allRequests || !userData) {
      console.log('[DistributorRepApprovalWithPricing] No allRequests or userData:', { allRequests, userData });
      return [];
    }

    console.log('[DistributorRepApprovalWithPricing] userData.id:', userData.id);
    console.log('[DistributorRepApprovalWithPricing] allRequests keys:', Object.keys(allRequests));

    const requests: DistributorRepRequest[] = [];

    const distributorData = allRequests[userData.id];
    console.log('[DistributorRepApprovalWithPricing] distributorData:', distributorData);

    if (distributorData && typeof distributorData === 'object') {
      Object.entries(distributorData).forEach(([repId, repData]) => {
        console.log('[DistributorRepApprovalWithPricing] Processing repId:', repId, 'repData:', repData);
        if (repData && typeof repData === 'object') {
          Object.entries(repData).forEach(([requestIdPrefix, requestGroup]: [string, any]) => {
            console.log('[DistributorRepApprovalWithPricing] Processing requestIdPrefix:', requestIdPrefix, 'requestGroup:', requestGroup);
            if (requestGroup && typeof requestGroup === 'object') {
              Object.entries(requestGroup).forEach(([requestId, requestData]: [string, any]) => {
                console.log('[DistributorRepApprovalWithPricing] Processing requestId:', requestId, 'requestData:', requestData);
                if (requestData && typeof requestData === 'object' && requestData.requestedBy) {
                  console.log('[DistributorRepApprovalWithPricing] Adding request:', requestId);
                  requests.push({
                    id: requestId,
                    distributorId: userData.id,
                    disRefId: requestData.requestedBy,
                    disRefName: requestData.requestedByName,
                    requestIdPrefix: requestIdPrefix,
                    status: requestData.status,
                    requestDate: requestData.createdAt,
                    products: requestData.items || {},
                    notes: requestData.notes,
                    priority: requestData.priority,
                    approvedAt: requestData.approvedAt,
                    approvedBy: requestData.approvedBy,
                    approverName: requestData.approverName,
                    dispatchedAt: requestData.dispatchedAt,
                    dispatchedBy: requestData.dispatchedBy,
                    dispatcherName: requestData.dispatcherName,
                    pricing: requestData.pricing
                  });
                }
              });
            }
          });
        }
      });
    }

    console.log('[DistributorRepApprovalWithPricing] Total requests found:', requests.length);
    return requests.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }, [allRequests, userData]);

  const pendingRequests = distributorRequests.filter(r => r.status === 'pending');
  const approvedRequests = distributorRequests.filter(r => r.status === 'approved');

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load requests." />;
  if (!userData) return null;

  const handleAction = (request: DistributorRepRequest, action: 'approve' | 'reject' | 'dispatch') => {
    setSelectedRequest(request);
    setModalAction(action);

    if (action === 'dispatch') {
      const initialQuantities: Record<string, number> = {};
      const initialPricing: Record<string, { type: 'fixed' | 'percentage'; value: number }> = {};

      Object.entries(request.products).forEach(([itemKey, item]) => {
        const quantity = typeof item === 'number' ? item : item.qty;
        initialQuantities[itemKey] = quantity;
        initialPricing[itemKey] = { type: 'percentage', value: 0 };
      });

      setDispatchQuantities(initialQuantities);
      setPricingAdjustments(initialPricing);
    }

    setShowModal(true);
  };

  const processAction = async () => {
    if (!selectedRequest) return;
    setProcessing(true);

    try {
      const timestamp = Date.now();
      const requestPath = `${selectedRequest.distributorId}/${selectedRequest.disRefId}/${selectedRequest.requestIdPrefix}/${selectedRequest.id}`;
      const requestRef = ref(database, `disRefReqs/${requestPath}`);

      // Check current status before updating
      const snapshot = await get(requestRef);
      if (!snapshot.exists()) {
        alert('Request not found.');
        setProcessing(false);
        return;
      }

      const currentRequest = snapshot.val();
      if (modalAction === 'approve' && currentRequest.status !== 'pending') {
        alert(`Cannot approve this request. It has already been ${currentRequest.status}.`);
        setShowModal(false);
        setSelectedRequest(null);
        setProcessing(false);
        return;
      }

      if (modalAction === 'dispatch' && currentRequest.status !== 'approved') {
        alert(`Cannot dispatch this request. It must be approved first. Current status: ${currentRequest.status}.`);
        setShowModal(false);
        setSelectedRequest(null);
        setProcessing(false);
        return;
      }

      if (modalAction === 'approve') {
        await update(requestRef, {
          status: 'approved',
          approvedAt: timestamp,
          approvedBy: userData.id,
          approverName: userData.name,
          ...(actionNotes && { approvalNotes: actionNotes })
        });
      } else if (modalAction === 'reject') {
        await update(requestRef, {
          status: 'rejected',
          rejectedAt: timestamp,
          rejectedBy: userData.id,
          rejectorName: userData.name,
          rejectionReason: actionNotes || 'No reason provided'
        });
      } else if (modalAction === 'dispatch') {
        const pricingData: Record<string, { adjustmentType: string; adjustmentValue: number; finalPrice: number }> = {};

        Object.entries(pricingAdjustments).forEach(([productId, adjustment]) => {
          pricingData[productId] = {
            adjustmentType: adjustment.type,
            adjustmentValue: adjustment.value,
            finalPrice: adjustment.type === 'percentage' ? adjustment.value : adjustment.value
          };
        });

        await update(requestRef, {
          status: 'dispatched',
          dispatchedAt: timestamp,
          dispatchedBy: userData.id,
          dispatcherName: userData.name,
          dispatchedQuantities: dispatchQuantities,
          pricing: pricingData,
          ...(actionNotes && { dispatchNotes: actionNotes })
        });

        const stockUpdates: Record<string, any> = {};
        for (const [productId, quantity] of Object.entries(dispatchQuantities)) {
          const distributorStockRef = ref(database, `distributorStock/users/${userData.id}/summary/${productId}`);
          const stockSnapshot = await get(distributorStockRef);

          if (stockSnapshot.exists()) {
            const currentStock = stockSnapshot.val();
            const newAvailableQuantity = Math.max(0, currentStock.availableQuantity - quantity);
            const newUsedQuantity = currentStock.usedQuantity + Math.min(quantity, currentStock.availableQuantity);

            stockUpdates[`distributorStock/users/${userData.id}/summary/${productId}/availableQuantity`] = newAvailableQuantity;
            stockUpdates[`distributorStock/users/${userData.id}/summary/${productId}/usedQuantity`] = newUsedQuantity;
            stockUpdates[`distributorStock/users/${userData.id}/summary/${productId}/lastUpdated`] = new Date().toISOString();
          }
        }

        if (Object.keys(stockUpdates).length > 0) {
          await update(ref(database), stockUpdates);
        }

        const itemsForApproval = Object.entries(dispatchQuantities).reduce((acc, [itemKey, quantity]) => {
          const item = selectedRequest.products[itemKey];
          const name = typeof item === 'object' && item.name ? item.name : (productNameMap.get(itemKey) || `Product ID: ${itemKey}`);
          acc[itemKey] = {
            name: name,
            qty: quantity,
            pricing: pricingData[itemKey]
          };
          return acc;
        }, {} as Record<string, any>);

        const approvalHistoryRef = ref(database, `salesApprovalHistory/${selectedRequest.id}`);
        await set(approvalHistoryRef, {
          requestId: selectedRequest.id,
          status: 'sent',
          items: itemsForApproval,
          sentAt: timestamp,
          requestType: 'distributor_representative',
          requesterId: selectedRequest.disRefId,
          requesterName: selectedRequest.disRefName || usersData?.[selectedRequest.disRefId]?.name || 'Unknown',
          requesterRole: 'DistributorRepresentative',
          distributorId: userData.id,
          distributorName: userData.name,
          totalQuantity: Object.values(dispatchQuantities).reduce((sum, qty) => sum + qty, 0)
        });
      }

      setShowModal(false);
      setSelectedRequest(null);
      setActionNotes('');
      setDispatchQuantities({});
      setPricingAdjustments({});
    } catch (error) {
      console.error('Error processing action:', error);
      alert('Failed to process request. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Representative Requests</h1>
        <p className="text-gray-600 mt-1">Manage requests from your distributor representatives</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Pending Requests ({pendingRequests.length})</h2>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="text-center p-8">
            <p className="text-gray-500">No pending requests to review.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pendingRequests.map((request) => (
              <div key={request.id} className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">
                      ID: <span className="font-medium text-gray-800">{request.id}</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      From <span className="font-medium text-gray-800">
                        {request.disRefName || usersData?.[request.disRefId]?.name || 'Unknown Representative'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">{new Date(request.requestDate).toLocaleString()}</p>
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <Badge variant="warning">Pending</Badge>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="font-medium text-gray-800 text-sm">Requested Products:</h4>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-gray-700">
                    {Object.entries(request.products).map(([itemKey, item]) => {
                      const quantity = typeof item === 'number' ? item : item.qty;
                      const name = typeof item === 'object' && item.name ? item.name : (productNameMap.get(itemKey) || `Product ID: ${itemKey}`);
                      return (
                        <li key={itemKey}>
                          <span className="font-medium">
                            {name}
                          </span> - Qty: {quantity}
                        </li>
                      );
                    })}
                  </ul>
                  {request.notes && (
                    <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                      <span className="font-medium">Notes:</span> {request.notes}
                    </p>
                  )}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => handleAction(request, 'approve')}
                    className="w-full sm:w-auto flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center gap-2 text-sm"
                  >
                    <Check size={16} /> Approve
                  </button>
                  <button
                    onClick={() => handleAction(request, 'reject')}
                    className="w-full sm:w-auto flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center gap-2 text-sm"
                  >
                    <X size={16} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Ready for Dispatch ({approvedRequests.length})</h2>
        </div>

        {approvedRequests.length === 0 ? (
          <div className="text-center p-8">
            <p className="text-gray-500">No approved requests ready for dispatch.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {approvedRequests.map((request) => (
              <div key={request.id} className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">
                      ID: <span className="font-medium text-gray-800">{request.id}</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      To <span className="font-medium text-gray-800">
                        {request.disRefName || usersData?.[request.disRefId]?.name || 'Unknown Representative'}
                      </span>
                    </p>
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <Badge variant="success">Approved</Badge>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="font-medium text-gray-800 text-sm">Products to Dispatch:</h4>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-gray-700">
                    {Object.entries(request.products).map(([itemKey, item]) => {
                      const quantity = typeof item === 'number' ? item : item.qty;
                      const name = typeof item === 'object' && item.name ? item.name : (productNameMap.get(itemKey) || `Product ID: ${itemKey}`);
                      return (
                        <li key={itemKey}>
                          <span className="font-medium">
                            {name}
                          </span> - Qty: {quantity}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => handleAction(request, 'dispatch')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm"
                  >
                    <Package size={16} /> Dispatch with Pricing
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedRequest && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={`${modalAction === 'approve' ? 'Approve' : modalAction === 'reject' ? 'Reject' : 'Dispatch'} Request`}
          size={modalAction === 'dispatch' ? 'xl' : 'lg'}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              {modalAction === 'dispatch' ? 'Set pricing and dispatch quantities:' : `Are you sure you want to ${modalAction} this request?`}
            </p>

            {modalAction === 'dispatch' ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {Object.entries(selectedRequest.products).map(([itemKey, item]) => {
                  const originalQuantity = typeof item === 'number' ? item : item.qty;
                  const name = typeof item === 'object' && item.name ? item.name : (productNameMap.get(itemKey) || `Product ID: ${itemKey}`);
                  return (
                  <div key={itemKey} className="p-4 border border-gray-200 rounded-lg space-y-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {name}
                      </p>
                      <p className="text-sm text-gray-600">Requested: {originalQuantity}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Dispatch Qty
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={originalQuantity}
                          value={dispatchQuantities[itemKey] || originalQuantity}
                          onChange={(e) => setDispatchQuantities(prev => ({
                            ...prev,
                            [itemKey]: parseInt(e.target.value) || 0
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Price Adjustment
                        </label>
                        <select
                          value={pricingAdjustments[itemKey]?.type || 'percentage'}
                          onChange={(e) => setPricingAdjustments(prev => ({
                            ...prev,
                            [itemKey]: { ...prev[itemKey], type: e.target.value as 'fixed' | 'percentage' }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed Price</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {pricingAdjustments[itemKey]?.type === 'percentage' ? 'Markup %' : 'Price'}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={pricingAdjustments[itemKey]?.value || 0}
                            onChange={(e) => setPricingAdjustments(prev => ({
                              ...prev,
                              [itemKey]: { ...prev[itemKey], value: parseFloat(e.target.value) || 0 }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                          />
                          {pricingAdjustments[itemKey]?.type === 'percentage' ? (
                            <Percent className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                          ) : (
                            <DollarSign className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <h4 className="font-medium text-gray-800 text-sm mb-2">Products:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  {Object.entries(selectedRequest.products).map(([itemKey, item]) => {
                    const quantity = typeof item === 'number' ? item : item.qty;
                    const name = typeof item === 'object' && item.name ? item.name : (productNameMap.get(itemKey) || itemKey);
                    return (
                      <li key={itemKey}>
                        {name} - Qty: {quantity}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <textarea
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              placeholder={`Add ${modalAction} notes (optional)...`}
              className="w-full p-2 border border-gray-300 rounded-md text-sm"
              rows={3}
            />

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="w-full sm:w-auto px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={processAction}
                disabled={processing}
                className={`w-full sm:w-auto px-4 py-2 text-white rounded-md text-sm ${
                  modalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                  modalAction === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {processing ? 'Processing...' : `Confirm ${modalAction}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
