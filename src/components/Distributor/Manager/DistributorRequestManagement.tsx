import React, { useState, useMemo } from 'react';
import { useFirebaseData } from '../../../hooks/useFirebaseData';
import { ref, update, get } from 'firebase/database';
import { database } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { Modal } from '../../Common/Modal';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Badge } from '../../Common/Badge';
import { DistributorDispatchModal } from './DistributorDispatchModal';
import { Check, X, Package, Clock, FileText } from 'lucide-react';

interface RepRequest {
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
}

export function DistributorRequestManagement() {
  const { userData } = useAuth();
  const { data: allRequests, loading, error } = useFirebaseData<Record<string, any>>('distributorRepRequests');
  const { data: distributorInventory } = useFirebaseData<Record<string, { productName: string; stock: number }>>('distributorInventory');
  const { data: usersData } = useFirebaseData<Record<string, any>>('users');

  const [selectedRequest, setSelectedRequest] = useState<RepRequest | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const pendingRequests = useMemo(() => {
    if (!allRequests || !userData?.id) return [];
    const flatRequests: RepRequest[] = [];

    const distributorData = allRequests[userData.id];
    if (distributorData && typeof distributorData === 'object') {
      Object.entries(distributorData).forEach(([requestId, data]: [string, any]) => {
        if (data && typeof data === 'object' && data.status === 'pending') {
          flatRequests.push({
            id: requestId,
            ...data,
          });
        }
      });
    }

    return flatRequests.sort((a, b) => b.createdAt - a.createdAt);
  }, [allRequests, userData]);

  const approvedRequests = useMemo(() => {
    if (!allRequests || !userData?.id) return [];
    const flatRequests: RepRequest[] = [];

    const distributorData = allRequests[userData.id];
    if (distributorData && typeof distributorData === 'object') {
      Object.entries(distributorData).forEach(([requestId, data]: [string, any]) => {
        if (data && typeof data === 'object' && data.status === 'approved') {
          flatRequests.push({
            id: requestId,
            ...data,
          });
        }
      });
    }

    return flatRequests.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [allRequests, userData]);

  if (loading) return <LoadingSpinner text="Loading requests..." />;
  if (error) return <ErrorMessage message="Failed to load requests." />;
  if (!userData || userData.role !== 'Distributor') {
    return <ErrorMessage message="Access denied. Only distributors can manage requests." />;
  }

  const handleApprovalAction = (request: RepRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setApprovalAction(action);
    setShowApprovalModal(true);
  };

  const handleDispatchAction = (request: RepRequest) => {
    console.log('Dispatch button clicked for request:', request.id);
    setSelectedRequest(request);
    setShowDispatchModal(true);
    console.log('Modal state set to true');
  };

  const checkInventoryAvailability = (request: RepRequest): { available: boolean; shortages: string[] } => {
    const shortages: string[] = [];
    let available = true;

    Object.entries(request.items).forEach(([key, item]) => {
      const inventoryItem = distributorInventory && Object.values(distributorInventory).find(
        inv => inv.productName === item.productName
      );
      const currentStock = inventoryItem?.stock || 0;

      if (currentStock < item.quantity) {
        available = false;
        shortages.push(`${item.productName}: Need ${item.quantity}, Have ${currentStock}`);
      }
    });

    return { available, shortages };
  };

  const processApproval = async () => {
    if (!selectedRequest) return;
    setProcessing(true);

    try {
      const requestRef = ref(database, `distributorRepRequests/${userData.id}/${selectedRequest.id}`);

      const snapshot = await get(requestRef);
      if (!snapshot.exists()) {
        alert('Request not found.');
        return;
      }

      const currentRequest = snapshot.val();
      if (currentRequest.status !== 'pending') {
        alert(`Cannot ${approvalAction} this request. Current status: ${currentRequest.status}.`);
        setShowApprovalModal(false);
        setSelectedRequest(null);
        return;
      }

      const timestamp = Date.now();
      const updateData: any = {
        status: approvalAction === 'approve' ? 'approved' : 'rejected',
        approvedBy: userData.id,
        approvedByName: userData.name,
        approvedAt: timestamp,
        updatedAt: timestamp,
      };

      if (approvalAction === 'approve') {
        updateData.approvalNotes = approvalNotes;
      } else {
        updateData.rejectedReason = approvalNotes;
      }

      await update(requestRef, updateData);

      setShowApprovalModal(false);
      setSelectedRequest(null);
      setApprovalNotes('');

      const actionText = approvalAction === 'approve' ? 'approved' : 'rejected';
      alert(`Request ${actionText} successfully!`);
    } catch (error) {
      console.error('Error processing approval:', error);
      alert('Failed to process request. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDispatchWithPricing = async (dispatchItems: any[]) => {
    if (!selectedRequest) return;

    const requestRef = ref(database, `distributorRepRequests/${userData.id}/${selectedRequest.id}`);

    try {
      console.log('Starting dispatch process for request:', selectedRequest.id);
      console.log('Dispatch items:', dispatchItems);

      const snapshot = await get(requestRef);
      if (!snapshot.exists()) {
        alert('Request not found.');
        return;
      }

      const currentRequest = snapshot.val();
      if (currentRequest.status !== 'approved') {
        alert(`Cannot dispatch this request. Current status: ${currentRequest.status}.`);
        setShowDispatchModal(false);
        setSelectedRequest(null);
        return;
      }

      const timestamp = Date.now();

      const pricingData = dispatchItems.reduce((acc, item, index) => {
        acc[`item${String(index + 1).padStart(3, '0')}`] = {
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          finalPrice: item.finalPrice,
          totalValue: item.finalPrice * item.quantity,
          selectedEntries: item.selectedEntries
        };
        return acc;
      }, {} as Record<string, any>);

      await update(requestRef, {
        status: 'dispatched',
        dispatchedBy: userData.id,
        dispatchedByName: userData.name,
        dispatchedAt: timestamp,
        updatedAt: timestamp,
        pricing: pricingData
      });

      for (const item of dispatchItems) {
        for (const selectedEntry of item.selectedEntries) {
          if (selectedEntry.entryId.startsWith('legacy_')) {
            const inventoryKey = selectedEntry.entryId.replace('legacy_', '');
            const inventoryRef = ref(database, `distributorInventory/${inventoryKey}`);
            const inventorySnapshot = await get(inventoryRef);

            if (inventorySnapshot.exists()) {
              const inventoryItem = inventorySnapshot.val();
              await update(inventoryRef, {
                stock: inventoryItem.stock - selectedEntry.quantity,
                lastUpdated: timestamp,
                updatedBy: userData.id
              });
            }
          } else {
            const entryRef = ref(database, `distributorStock/users/${userData.id}/entries/${selectedEntry.entryId}`);
            const entrySnapshot = await get(entryRef);

            if (entrySnapshot.exists()) {
              const entry = entrySnapshot.val();
              const newAvailableQuantity = entry.availableQuantity - selectedEntry.quantity;
              const newUsedQuantity = entry.usedQuantity + selectedEntry.quantity;

              await update(entryRef, {
                availableQuantity: newAvailableQuantity,
                usedQuantity: newUsedQuantity,
                status: newAvailableQuantity === 0 ? 'depleted' : 'available',
                lastUpdated: new Date().toISOString(),
                notes: `${entry.notes || ''}\nDispatched ${selectedEntry.quantity} units to ${selectedRequest.requestedByName} on ${new Date().toLocaleDateString()}`.trim()
              });
            }

            const summaryRef = ref(database, `distributorStock/users/${userData.id}/summary/${item.productId}`);
            const summarySnapshot = await get(summaryRef);

            if (summarySnapshot.exists()) {
              const summary = summarySnapshot.val();
              await update(summaryRef, {
                availableQuantity: summary.availableQuantity - selectedEntry.quantity,
                usedQuantity: summary.usedQuantity + selectedEntry.quantity,
                lastUpdated: new Date().toISOString()
              });
            }
          }
        }
      }

      console.log('Dispatch completed successfully');
      setShowDispatchModal(false);
      setSelectedRequest(null);
      alert('Request dispatched successfully! Representative can now claim the items.');
    } catch (error: any) {
      console.error('Error dispatching with pricing:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      alert(`Failed to dispatch request: ${errorMessage}\n\nPlease check the console for more details.`);
      throw error;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'approved': return <Check className="w-4 h-4 text-green-500" />;
      case 'dispatched': return <Package className="w-4 h-4 text-blue-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Representative Requests</h1>
        <p className="text-gray-600 mt-1">Manage stock requests from your representatives</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Pending Requests ({pendingRequests.length})</h2>
        </div>

        {pendingRequests.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>No pending requests from representatives.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {pendingRequests.map((request) => (
              <div key={request.id} className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(request.status)}
                      <p className="text-sm font-medium text-gray-800">Request #{request.id.split('_').pop()}</p>
                      {request.priority === 'urgent' && (
                        <Badge variant="error">Urgent</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      From <span className="font-medium text-gray-800">{request.requestedByName}</span>
                    </p>
                    <p className="text-xs text-gray-500">{new Date(request.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <Badge variant="warning">Pending</Badge>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="font-medium text-gray-800 text-sm mb-2">Requested Items:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(request.items).map(([key, item]) => {
                      const inventoryItem = distributorInventory && Object.values(distributorInventory).find(
                        inv => inv.productName === item.productName
                      );
                      const currentStock = inventoryItem?.stock || 0;
                      const hasStock = currentStock >= item.quantity;

                      return (
                        <div key={key} className={`flex justify-between items-center p-2 rounded ${hasStock ? 'bg-green-50' : 'bg-red-50'}`}>
                          <span className="text-sm text-gray-700">{item.productName}</span>
                          <div className="text-right">
                            <span className="text-sm font-medium text-gray-900">Qty: {item.quantity}</span>
                            <p className={`text-xs ${hasStock ? 'text-green-600' : 'text-red-600'}`}>
                              Stock: {currentStock}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

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

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Ready for Dispatch ({approvedRequests.length})</h2>
        </div>

        {approvedRequests.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>No approved requests ready for dispatch.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {approvedRequests.map((request) => (
              <div key={request.id} className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(request.status)}
                      <p className="text-sm font-medium text-gray-800">Request #{request.id.split('_').pop()}</p>
                      {request.priority === 'urgent' && (
                        <Badge variant="error">Urgent</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      From <span className="font-medium text-gray-800">{request.requestedByName}</span>
                    </p>
                    <p className="text-xs text-gray-500">Approved: {new Date(request.updatedAt).toLocaleString()}</p>
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <Badge variant="success">Approved</Badge>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="font-medium text-gray-800 text-sm mb-2">Items to Dispatch:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(request.items).map(([key, item]) => {
                      const inventoryItem = distributorInventory && Object.values(distributorInventory).find(
                        inv => inv.productName === item.productName
                      );
                      const currentStock = inventoryItem?.stock || 0;
                      const hasStock = currentStock >= item.quantity;

                      return (
                        <div key={key} className={`flex justify-between items-center p-2 rounded ${hasStock ? 'bg-green-50' : 'bg-red-50'}`}>
                          <span className="text-sm text-gray-700">{item.productName}</span>
                          <div className="text-right">
                            <span className="text-sm font-medium text-gray-900">Qty: {item.quantity}</span>
                            <p className={`text-xs ${hasStock ? 'text-green-600' : 'text-red-600'}`}>
                              Stock: {currentStock}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    onClick={() => handleDispatchAction(request)}
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center justify-center gap-2 text-sm"
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
          isOpen={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
          title={`${approvalAction === 'approve' ? 'Approve' : 'Reject'} Request`}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Are you sure you want to {approvalAction} this request from <span className="font-semibold">{selectedRequest.requestedByName}</span>?
            </p>

            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder={approvalAction === 'approve' ? 'Add notes (optional)...' : 'Reason for rejection...'}
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
                  'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {processing ? 'Processing...' : `Confirm ${approvalAction}`}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedRequest && (
        <DistributorDispatchModal
          isOpen={showDispatchModal}
          onClose={() => setShowDispatchModal(false)}
          requestItems={selectedRequest.items}
          onConfirm={handleDispatchWithPricing}
        />
      )}
    </div>
  );
}
