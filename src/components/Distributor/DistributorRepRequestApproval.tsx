import React, { useState, useMemo } from 'react';
import { useFirebaseData, useFirebaseActions } from '../../hooks/useFirebaseData';
import { ref, get, set, update } from 'firebase/database';
import { database } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../Common/Modal';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { ErrorMessage } from '../Common/ErrorMessage';
import { Badge } from '../Common/Badge';
import { Check, X, Package } from 'lucide-react';

interface DistributorRepRequest {
  id: string;
  distributorId: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  status: 'pending' | 'approved' | 'rejected' | 'dispatched';
  createdAt: string;
  items: Record<string, { name: string; qty: number }>;
  notes?: string;
  priority?: string;
  approvedAt?: number;
  approvedBy?: string;
  approverName?: string;
  dispatchedAt?: number;
  dispatchedBy?: string;
  dispatcherName?: string;
  updatedAt: number;
}

export function DistributorRepRequestApproval() {
  const { userData } = useAuth();
  const { data: allRequests, loading, error } = useFirebaseData<Record<string, DistributorRepRequest>>('disRefReqs');
  const { data: usersData } = useFirebaseData<Record<string, any>>('users');
  const { data: inventoryData } = useFirebaseData<Record<string, any>>('finishedGoodsPackagedInventory');
  const { updateData: updateRequest } = useFirebaseActions('disRefReqs');
  const { addData: addToSalesApproval } = useFirebaseActions('salesApprovalHistory');
  
  const [selectedRequest, setSelectedRequest] = useState<DistributorRepRequest | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | 'dispatch'>('approve');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});
  const [processing, setProcessing] = useState(false);

  // Create a map of productId to productName for quick lookup
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

  // Get requests for current distributor
  const distributorRequests = useMemo(() => {
    if (!allRequests || !userData) {
      console.log('[DistributorRepRequestApproval] No allRequests or userData:', { allRequests, userData });
      return [];
    }

    console.log('[DistributorRepRequestApproval] userData.id:', userData.id);
    console.log('[DistributorRepRequestApproval] allRequests keys:', Object.keys(allRequests));

    const requests: DistributorRepRequest[] = [];

    const distributorData = allRequests[userData.id];
    console.log('[DistributorRepRequestApproval] distributorData:', distributorData);

    if (distributorData && typeof distributorData === 'object') {
      Object.entries(distributorData).forEach(([repId, repData]) => {
        console.log('[DistributorRepRequestApproval] Processing repId:', repId, 'repData:', repData);
        if (repData && typeof repData === 'object') {
          Object.entries(repData).forEach(([requestIdPrefix, requestGroup]: [string, any]) => {
            console.log('[DistributorRepRequestApproval] Processing requestIdPrefix:', requestIdPrefix, 'requestGroup:', requestGroup);
            if (requestGroup && typeof requestGroup === 'object') {
              Object.entries(requestGroup).forEach(([requestId, requestData]: [string, any]) => {
                console.log('[DistributorRepRequestApproval] Processing requestId:', requestId, 'requestData:', requestData);
                if (requestData && typeof requestData === 'object' && requestData.requestedBy) {
                  console.log('[DistributorRepRequestApproval] Adding request:', requestId);
                  requests.push({
                    id: requestId,
                    ...requestData as Omit<DistributorRepRequest, 'id'>
                  });
                }
              });
            }
          });
        }
      });
    }

    console.log('[DistributorRepRequestApproval] Total requests found:', requests.length);
    return requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allRequests, userData]);

  const pendingRequests = distributorRequests.filter(r => r.status === 'pending');
  const approvedRequests = distributorRequests.filter(r => r.status === 'approved');

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load requests." />;
  if (!userData) return null;

  const handleApprovalAction = (request: DistributorRepRequest, action: 'approve' | 'reject' | 'dispatch') => {
    setSelectedRequest(request);
    setApprovalAction(action);
    // Initialize custom quantities with original quantities
    if (action === 'dispatch') {
      const initialQuantities: Record<string, number> = {};
      Object.entries(request.items).forEach(([itemKey, item]) => {
        initialQuantities[itemKey] = item.qty;
      });
      setCustomQuantities(initialQuantities);
    }
    setShowApprovalModal(true);
  };

  const processApproval = async () => {
    if (!selectedRequest) return;
    setProcessing(true);

    try {
      const timestamp = Date.now();
      
      if (approvalAction === 'approve') {
        const requestPath = `${selectedRequest.distributorId}/${selectedRequest.requestedBy}/${selectedRequest.id}`;
        await updateRequest(requestPath, {
          status: 'approved',
          approvedAt: timestamp,
          approvedBy: userData.id,
          approverName: userData.name,
          ...(approvalNotes && { approvalNotes })
        });
      } else if (approvalAction === 'reject') {
        const requestPath = `${selectedRequest.distributorId}/${selectedRequest.requestedBy}/${selectedRequest.id}`;
        await updateRequest(requestPath, {
          status: 'rejected',
          rejectedAt: timestamp,
          rejectedBy: userData.id,
          rejectorName: userData.name,
          rejectionReason: approvalNotes || 'No reason provided'
        });
      } else if (approvalAction === 'dispatch') {
        // Update request status to dispatched
        const requestPath = `${selectedRequest.distributorId}/${selectedRequest.requestedBy}/${selectedRequest.id}`;
        await updateRequest(requestPath, {
          status: 'dispatched',
          dispatchedAt: timestamp,
          dispatchedBy: userData.id,
          dispatcherName: userData.name,
          dispatchedQuantities: customQuantities,
          ...(approvalNotes && { dispatchNotes: approvalNotes })
        });

        // Add to sales approval history for claiming
        const itemsForApproval = Object.entries(customQuantities).reduce((acc, [itemKey, quantity]) => {
          const item = selectedRequest.items[itemKey];
          if (item) {
            acc[itemKey] = {
              name: item.name,
              qty: quantity
            };
          }
          return acc;
        }, {} as Record<string, { name: string; qty: number }>);

        await addToSalesApproval('', {
          requestId: selectedRequest.id,
          status: 'sent',
          items: itemsForApproval,
          sentAt: timestamp,
          requestType: 'distributor_representative',
          requesterId: selectedRequest.requestedBy,
          requesterName: selectedRequest.requestedByName || usersData?.[selectedRequest.requestedBy]?.name || 'Unknown',
          requesterRole: 'DistributorRepresentative',
          distributorId: userData.id,
          distributorName: userData.name,
          totalQuantity: Object.values(customQuantities).reduce((sum, qty) => sum + qty, 0)
        });
      }

      setShowApprovalModal(false);
      setSelectedRequest(null);
      setApprovalNotes('');
      setCustomQuantities({});
    } catch (error) {
      console.error('Error processing approval:', error);
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

      {/* Pending Requests */}
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
                        {request.requestedByName || usersData?.[request.requestedBy]?.name || 'Unknown Representative'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">{new Date(request.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <Badge variant="warning">Pending</Badge>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="font-medium text-gray-800 text-sm">Requested Products:</h4>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-gray-700">
                    {Object.entries(request.items).map(([itemKey, item]) => (
                      <li key={itemKey}>
                        <span className="font-medium">
                          {item.name}
                        </span> - Qty: {item.qty}
                      </li>
                    ))}
                  </ul>
                  {request.notes && (
                    <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                      <span className="font-medium">Notes:</span> {request.notes}
                    </p>
                  )}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => handleApprovalAction(request, 'approve')}
                    className="w-full sm:w-auto flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center gap-2 text-sm"
                  >
                    <Check size={16} /> Approve
                  </button>
                  <button
                    onClick={() => handleApprovalAction(request, 'reject')}
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

      {/* Approved Requests Ready for Dispatch */}
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
                        {request.requestedByName || usersData?.[request.requestedBy]?.name || 'Unknown Representative'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500">
                      Approved: {new Date(request.approvedAt!).toLocaleString()}
                    </p>
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <Badge variant="success">Approved</Badge>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="font-medium text-gray-800 text-sm">Products to Dispatch:</h4>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-gray-700">
                    {Object.entries(request.items).map(([itemKey, item]) => (
                      <li key={itemKey}>
                        <span className="font-medium">
                          {item.name}
                        </span> - Qty: {item.qty}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-2">
                  <button
                    onClick={() => handleApprovalAction(request, 'dispatch')}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-2 text-sm"
                  >
                    <Package size={16} /> Dispatch Items
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {selectedRequest && (
        <Modal
          isOpen={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
          title={`${approvalAction === 'approve' ? 'Approve' : approvalAction === 'reject' ? 'Reject' : 'Dispatch'} Request`}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Are you sure you want to {approvalAction} this request from{' '}
              <span className="font-semibold">
                {selectedRequest.requestedByName || usersData?.[selectedRequest.requestedBy]?.name || 'Unknown Representative'}
              </span>?
            </p>
            
            <div>
              <h4 className="font-medium text-gray-800 text-sm mb-2">Products:</h4>
              {approvalAction === 'dispatch' ? (
                <div className="space-y-3">
                  {Object.entries(selectedRequest.items).map(([itemKey, item]) => (
                    <div key={itemKey} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-800">
                          {item.name}
                        </p>
                        <p className="text-sm text-gray-600">Requested: {item.qty}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Dispatch:</label>
                        <input
                          type="number"
                          min="0"
                          max={item.qty}
                          value={customQuantities[itemKey] !== undefined ? customQuantities[itemKey] : item.qty}
                          onChange={(e) => setCustomQuantities(prev => ({
                            ...prev,
                            [itemKey]: parseInt(e.target.value) || 0
                          }))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  {Object.entries(selectedRequest.items).map(([itemKey, item]) => (
                    <li key={itemKey}>
                      <span className="font-medium">
                        {item.name}
                      </span> - Qty: {item.qty}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder={`Add ${approvalAction} notes (optional)...`}
              className="w-full p-2 border border-gray-300 rounded-md text-sm"
              rows={3}
            />
            
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button 
                onClick={() => setShowApprovalModal(false)} 
                className="w-full sm:w-auto px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={processApproval}
                disabled={processing}
                className={`w-full sm:w-auto px-4 py-2 text-white rounded-md text-sm ${
                  approvalAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 
                  approvalAction === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {processing ? 'Processing...' : `Confirm ${approvalAction}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}