import React, { useState, useMemo, useEffect } from 'react';
import { useFirebaseData, useFirebaseActions } from '../../../hooks/useFirebaseData';
import { ref, update, set, get, push } from 'firebase/database';
import { database } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { useDistributorStockOperations } from '../../../hooks/useDistributorStockOperations';
import { recalculateDistributorStockSummary } from '../../../utils/stockSummaryReconciliation';
import { Modal } from '../../Common/Modal';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Badge } from '../../Common/Badge';
import { DisRefPricingDispatchModal } from './DisRefPricingDispatchModal';
import { Check, X, Package, Clock } from 'lucide-react';

interface DisRefRequest {
  id: string;
  repId?: string;
  requestIdPrefix?: string;
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
}

export function DisRefRequestApproval() {
  const { userData } = useAuth();
  const { data: allRequests, loading, error } = useFirebaseData<Record<string, any>>('disRefReqs');
  const { data: usersData } = useFirebaseData<Record<string, any>>('users');
  const { useStock, getUserStockEntries } = useDistributorStockOperations();
  const [distributorStock, setDistributorStock] = useState<Record<string, any>>({});
  const [distributorStockEntries, setDistributorStockEntries] = useState<any[]>([]);
  
  const [selectedRequest, setSelectedRequest] = useState<DisRefRequest | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | 'dispatch'>('approve');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (userData?.id) {
      loadDistributorStock();
    }
  }, [userData, allRequests]);

  const loadDistributorStock = async () => {
    if (!userData?.id) return;
    try {
      const summaryRef = ref(database, `distributorStock/users/${userData.id}/summary`);
      const snapshot = await get(summaryRef);
      if (snapshot.exists()) {
        const summary = snapshot.val();
        console.log('Loaded distributor stock summary:', summary);
        setDistributorStock(summary);
      } else {
        console.log('No distributor stock summary found');
      }

      const entries = await getUserStockEntries(userData.id);
      console.log('Loaded distributor stock entries:', entries);
      console.log('Entries with available qty > 0:', entries.filter(e => e.availableQuantity > 0));
      setDistributorStockEntries(entries);
    } catch (error) {
      console.error('Error loading distributor stock:', error);
    }
  };

  const pendingRequests = useMemo(() => {
    if (!allRequests || !userData?.id) return [];
    const flatRequests: (DisRefRequest & { id: string; repId: string; requestIdPrefix: string })[] = [];

    const distributorData = allRequests[userData.id];
    if (distributorData && typeof distributorData === 'object') {
      Object.entries(distributorData).forEach(([repId, repRequests]) => {
        if (repRequests && typeof repRequests === 'object') {
          Object.entries(repRequests).forEach(([requestIdPrefix, nestedData]) => {
            if (nestedData && typeof nestedData === 'object') {
              Object.entries(nestedData).forEach(([id, r]: [string, any]) => {
                if (r && typeof r === 'object') {
                  flatRequests.push({
                    ...r,
                    id,
                    repId,
                    requestIdPrefix,
                    createdAt: typeof r.createdAt === 'string' ? new Date(r.createdAt).getTime() : r.createdAt
                  });
                }
              });
            }
          });
        }
      });
    }

    return flatRequests
      .filter(r => r.status === 'pending')
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [allRequests, userData]);

  const approvedRequests = useMemo(() => {
    if (!allRequests || !userData?.id) return [];
    const flatRequests: (DisRefRequest & { id: string; repId: string; requestIdPrefix: string })[] = [];

    const distributorData = allRequests[userData.id];
    if (distributorData && typeof distributorData === 'object') {
      Object.entries(distributorData).forEach(([repId, repRequests]) => {
        if (repRequests && typeof repRequests === 'object') {
          Object.entries(repRequests).forEach(([requestIdPrefix, nestedData]) => {
            if (nestedData && typeof nestedData === 'object') {
              Object.entries(nestedData).forEach(([id, r]: [string, any]) => {
                if (r && typeof r === 'object') {
                  flatRequests.push({
                    ...r,
                    id,
                    repId,
                    requestIdPrefix,
                    createdAt: typeof r.createdAt === 'string' ? new Date(r.createdAt).getTime() : r.createdAt
                  });
                }
              });
            }
          });
        }
      });
    }

    return flatRequests
      .filter(r => r.status === 'approved')
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [allRequests, userData]);

  if (loading) return <LoadingSpinner text="Loading DisRef requests..." />;
  if (error) return <ErrorMessage message="Failed to load requests." />;
  if (!userData || userData.role !== 'Distributor') {
    return <ErrorMessage message="Access denied. Only distributors can approve DisRef requests." />;
  }

  const handleApprovalAction = async (request: DisRefRequest, action: 'approve' | 'reject' | 'dispatch') => {
    setSelectedRequest(request);
    setApprovalAction(action);
    if (action === 'dispatch') {
      await loadDistributorStock();
      setShowPricingModal(true);
    } else {
      setShowApprovalModal(true);
    }
  };

  const checkInventoryAvailability = (request: DisRefRequest): { available: boolean; shortages: string[] } => {
    const shortages: string[] = [];
    let available = true;

    console.log('[checkInventoryAvailability] Checking request items:', request.items);
    console.log('[checkInventoryAvailability] Distributor stock summary:', distributorStock);

    Object.entries(request.items).forEach(([key, item]) => {
      const stockItem = Object.values(distributorStock).find(
        (stock: any) => stock.productName?.trim().toLowerCase() === item.name?.trim().toLowerCase()
      ) as any;
      const currentStock = stockItem?.availableQuantity || 0;

      console.log(`[checkInventoryAvailability] Item "${item.name}" - Found stock: ${currentStock}`);

      if (currentStock < item.qty) {
        available = false;
        shortages.push(`${item.name}: Need ${item.qty}, Have ${currentStock}`);
      }
    });

    return { available, shortages };
  };

  const processApproval = async () => {
    if (!selectedRequest || !selectedRequest.repId || !selectedRequest.requestIdPrefix) return;
    setProcessing(true);

    try {
      const requestRef = ref(database, `disRefReqs/${userData.id}/${selectedRequest.repId}/${selectedRequest.requestIdPrefix}/${selectedRequest.id}`);

      // Check current status before updating
      const snapshot = await get(requestRef);
      if (!snapshot.exists()) {
        alert('Request not found.');
        return;
      }

      const currentRequest = snapshot.val();
      if (currentRequest.status !== 'pending') {
        alert(`Cannot ${approvalAction} this request. It has already been ${currentRequest.status}.`);
        setShowApprovalModal(false);
        setSelectedRequest(null);
        return;
      }

      const timestamp = Date.now();
      let updateData: any = {
        status: approvalAction === 'approve' ? 'approved' : 'rejected',
        approvedBy: userData.id,
        approvedByName: userData.name,
        approvedAt: timestamp,
        updatedAt: timestamp,
        approvalNotes: approvalNotes,
      };

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

  const handleDispatchWithPricing = async (dispatchItems: any[], generateInvoice: boolean = false) => {
    if (!selectedRequest || !selectedRequest.repId || !selectedRequest.requestIdPrefix) return;

    const requestRef = ref(database, `disRefReqs/${userData.id}/${selectedRequest.repId}/${selectedRequest.requestIdPrefix}/${selectedRequest.id}`);

    try {
      const snapshot = await get(requestRef);
      if (!snapshot.exists()) {
        alert('Request not found.');
        return;
      }

      const currentRequest = snapshot.val();
      if (currentRequest.status !== 'approved') {
        alert(`Cannot dispatch this request. It must be approved first. Current status: ${currentRequest.status}.`);
        setShowPricingModal(false);
        setSelectedRequest(null);
        return;
      }

      const timestamp = Date.now();

      const pricingData = dispatchItems.reduce((acc, item, index) => {
        acc[`prod${String(index + 1).padStart(3, '0')}`] = {
          productName: item.productName,
          quantity: item.requestedQuantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          finalPrice: item.finalPrice,
          totalValue: item.finalPrice * item.requestedQuantity,
          batchAllocations: item.batchAllocations
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

      const summaryUpdates: Record<string, { availableQuantityDelta: number; usedQuantityDelta: number }> = {};

      for (const item of dispatchItems) {
        for (const allocation of item.batchAllocations) {
          const entryRef = ref(database, `distributorStock/users/${userData.id}/entries/${allocation.entryId}`);
          const entrySnapshot = await get(entryRef);

          if (entrySnapshot.exists()) {
            const entry = entrySnapshot.val();
            const newAvailableQuantity = entry.availableQuantity - allocation.quantity;
            const newUsedQuantity = entry.usedQuantity + allocation.quantity;

            await update(entryRef, {
              availableQuantity: newAvailableQuantity,
              usedQuantity: newUsedQuantity,
              status: newAvailableQuantity === 0 ? 'depleted' : 'available',
              lastUpdated: new Date().toISOString(),
              notes: `${entry.notes || ''}\nDispatched ${allocation.quantity} units to Distributor Representatives on ${new Date().toLocaleDateString()}`.trim()
            });

            if (!summaryUpdates[entry.productId]) {
              summaryUpdates[entry.productId] = { availableQuantityDelta: 0, usedQuantityDelta: 0 };
            }
            summaryUpdates[entry.productId].availableQuantityDelta -= allocation.quantity;
            summaryUpdates[entry.productId].usedQuantityDelta += allocation.quantity;
          }
        }
      }

      for (const [productId, deltas] of Object.entries(summaryUpdates)) {
        const summaryRef = ref(database, `distributorStock/users/${userData.id}/summary/${productId}`);
        const summarySnapshot = await get(summaryRef);
        if (summarySnapshot.exists()) {
          const summary = summarySnapshot.val();
          await update(summaryRef, {
            availableQuantity: Math.max(0, summary.availableQuantity + deltas.availableQuantityDelta),
            usedQuantity: (summary.usedQuantity || 0) + deltas.usedQuantityDelta,
            lastUpdated: new Date().toISOString()
          });
        }
      }

      await recalculateDistributorStockSummary(userData.id);
      await loadDistributorStock();

      if (generateInvoice) {
        try {
          const repUser = usersData && selectedRequest.requestedBy ? usersData[selectedRequest.requestedBy] : null;
          const invoiceNumber = `DIST-REP-${timestamp}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

          const invoiceItems = dispatchItems.map((item, index) => ({
            productId: item.productName.toLowerCase().replace(/\s+/g, '_'),
            productName: item.productName,
            itemCode: `ITEM-${String(index + 1).padStart(3, '0')}`,
            quantity: item.requestedQuantity,
            unitPrice: item.unitPrice,
            amount: item.finalPrice * item.requestedQuantity
          }));

          const subtotal = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
          const totalDiscount = dispatchItems.reduce((sum, item) =>
            sum + (item.unitPrice * item.requestedQuantity * (item.discountPercent / 100)), 0
          );

          const invoiceRef = ref(database, `distributorinvoices/${userData.id}`);
          const newInvoiceRef = push(invoiceRef);

          await set(newInvoiceRef, {
            invoiceId: newInvoiceRef.key,
            invoiceNumber,
            orderNumber: `ORD-${selectedRequest.id}`,
            distributorId: userData.id,
            distributorName: userData.name,
            recipientType: 'representative',
            recipientId: selectedRequest.requestedBy,
            recipientName: selectedRequest.requestedByName,
            recipientPhone: repUser?.phone || '',
            recipientAddress: '',
            requestId: selectedRequest.id,
            items: invoiceItems,
            subtotal: subtotal + totalDiscount,
            discount: 0,
            discountAmount: totalDiscount,
            total: subtotal,
            paymentMethod: 'Credit',
            status: 'issued',
            createdAt: new Date().toISOString(),
            createdTimestamp: timestamp,
            notes: `Dispatch invoice for request ${selectedRequest.id}`
          });
        } catch (invoiceError) {
          console.error('Error creating invoice:', invoiceError);
          alert('Request dispatched but invoice generation failed. You can create it manually from the invoices page.');
        }
      }

      setShowPricingModal(false);
      setSelectedRequest(null);
      alert('Request dispatched successfully! Representative can now claim the items.' +
        (generateInvoice ? ' Invoice has been generated.' : ''));
    } catch (error) {
      console.error('Error dispatching with pricing:', error);
      alert('Failed to dispatch request. Please try again.');
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
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">DisRef Request Management</h1>
        <p className="text-gray-600 mt-1">Approve and dispatch requests from your representatives</p>
      </div>

      {/* Pending Requests */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Pending Requests ({pendingRequests.length})</h2>
        </div>
        
        {pendingRequests.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
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
                      <p className="text-sm font-medium text-gray-800">Request #{request.id}</p>
                      {request.priority === 'urgent' && (
                        <Badge color="red">Urgent</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      From <span className="font-medium text-gray-800">{request.requestedByName}</span>
                    </p>
                    <p className="text-xs text-gray-500">{new Date(request.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <Badge color="yellow">Pending</Badge>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="font-medium text-gray-800 text-sm mb-2">Requested Items:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(request.items).map(([key, item]) => {
                      const stockItem = Object.values(distributorStock).find(
                        (stock: any) => stock.productName?.trim().toLowerCase() === item.name?.trim().toLowerCase()
                      ) as any;
                      const currentStock = stockItem?.availableQuantity || 0;
                      const hasStock = currentStock >= item.qty;

                      return (
                        <div key={key} className={`flex justify-between items-center p-2 rounded ${hasStock ? 'bg-green-50' : 'bg-red-50'}`}>
                          <span className="text-sm text-gray-700">{item.name}</span>
                          <div className="text-right">
                            <span className="text-sm font-medium text-gray-900">Qty: {item.qty}</span>
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

      {/* Approved Requests Ready for Dispatch */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Ready for Dispatch ({approvedRequests.length})</h2>
        </div>
        
        {approvedRequests.length === 0 ? (
          <div className="text-center p-8 text-gray-500">
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
                      <p className="text-sm font-medium text-gray-800">Request #{request.id}</p>
                      {request.priority === 'urgent' && (
                        <Badge color="red">Urgent</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      From <span className="font-medium text-gray-800">{request.requestedByName}</span>
                    </p>
                    <p className="text-xs text-gray-500">Approved: {new Date(request.updatedAt).toLocaleString()}</p>
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <Badge color="green">Approved</Badge>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="font-medium text-gray-800 text-sm mb-2">Items to Dispatch:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(request.items).map(([key, item]) => {
                      const stockItem = Object.values(distributorStock).find(
                        (stock: any) => stock.productName?.trim().toLowerCase() === item.name?.trim().toLowerCase()
                      ) as any;
                      const currentStock = stockItem?.availableQuantity || 0;
                      const hasStock = currentStock >= item.qty;

                      return (
                        <div key={key} className={`flex justify-between items-center p-2 rounded ${hasStock ? 'bg-green-50' : 'bg-red-50'}`}>
                          <span className="text-sm text-gray-700">{item.name}</span>
                          <div className="text-right">
                            <span className="text-sm font-medium text-gray-900">Qty: {item.qty}</span>
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
                  {(() => {
                    const { available, shortages } = checkInventoryAvailability(request);
                    return (
                      <div>
                        {!available && (
                          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm font-medium text-red-800 mb-1">Insufficient Stock:</p>
                            <ul className="list-disc list-inside text-sm text-red-700">
                              {shortages.map((shortage, idx) => (
                                <li key={idx}>{shortage}</li>
                              ))}
                            </ul>
                            <p className="text-xs text-red-600 mt-2">
                              Please request and receive stock from HO before dispatching.
                            </p>
                          </div>
                        )}
                        <button
                          onClick={() => handleApprovalAction(request, 'dispatch')}
                          disabled={!available}
                          className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
                        >
                          <Package size={16} /> Dispatch Order
                        </button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval/Rejection Modal */}
      {selectedRequest && (
        <Modal
          isOpen={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
          title={`Confirm Request ${approvalAction === 'approve' ? 'Approval' : 'Rejection'}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Are you sure you want to {approvalAction} this request from <span className="font-semibold">{selectedRequest.requestedByName}</span>?
            </p>

            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Add notes (optional)..."
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

      {/* Pricing & Dispatch Modal */}
      {selectedRequest && (
        <DisRefPricingDispatchModal
          isOpen={showPricingModal}
          onClose={() => setShowPricingModal(false)}
          requestItems={selectedRequest.items}
          stockEntries={distributorStockEntries.filter(e => (Number(e.availableQuantity) || 0) > 0)}
          onConfirm={handleDispatchWithPricing}
        />
      )}
    </div>
  );
}