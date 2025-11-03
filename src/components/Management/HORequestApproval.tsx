import React, { useState, useMemo } from 'react';
import { useFirebaseData, useFirebaseActions } from '../../hooks/useFirebaseData';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../Common/Modal';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { ErrorMessage } from '../Common/ErrorMessage';
import { Badge } from '../Common/Badge';
import { PricingDispatchModal } from './PricingDispatchModal';
import { Check, X, DollarSign } from 'lucide-react';

interface DispatchItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  finalPrice: number;
}

interface Request {
  id: string;
  customId?: string;
  requestedAt?: string;
  requestedBy?: string;
  requestedByName?: string;
  requestedByRole?: string;
  items?: any;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected' | 'Approved';
  priority?: string;
  createdAt?: number;
  product?: string;
  quantity?: number;
  urgent?: boolean;
  date?: string;
  requestType?: string;
}

export function HORequestApproval() {
  const { userData } = useAuth();
  const { data: dsRequests, loading: dsLoading } = useFirebaseData<Record<string, Request>>('dsreqs');
  const { data: drRequests, loading: drLoading } = useFirebaseData<Record<string, Request>>('drreqs');
  const { data: distributorRequests, loading: distLoading } = useFirebaseData<Record<string, Request>>('distributorReqs');

  const { updateData: updateDSRequest } = useFirebaseActions('dsreqs');
  const { updateData: updateDRRequest } = useFirebaseActions('drreqs');
  const { updateData: updateDistributorRequest } = useFirebaseActions('distributorReqs');
  const { addData: addSalesApproval } = useFirebaseActions('salesApprovalHistory');
  const { addData: addActivity } = useFirebaseActions('activities');

  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const pendingRequests = useMemo(() => {
    const allRequests: Request[] = [];

    if (dsRequests) {
      Object.entries(dsRequests)
        .filter(([_, r]) => r.status === 'pending')
        .forEach(([id, r]) => {
          allRequests.push({ ...r, id, requestType: 'direct_showroom' });
        });
    }

    if (drRequests) {
      Object.entries(drRequests)
        .filter(([_, r]) => r.status === 'pending')
        .forEach(([id, r]) => {
          allRequests.push({ ...r, id, requestType: 'direct_representative' });
        });
    }

    if (distributorRequests) {
      Object.entries(distributorRequests)
        .filter(([_, r]) => r.status === 'pending')
        .forEach(([id, r]) => {
          allRequests.push({ ...r, id, requestType: 'distributor' });
        });
    }

    return allRequests.sort((a, b) => {
      const aTime = a.createdAt || new Date(a.requestedAt || a.date || 0).getTime();
      const bTime = b.createdAt || new Date(b.requestedAt || b.date || 0).getTime();
      return bTime - aTime;
    });
  }, [dsRequests, drRequests, distributorRequests]);

  const loading = dsLoading || drLoading || distLoading;
  if (loading) return <LoadingSpinner />;
  if (!userData) return null;

  const handleApprovalAction = (request: Request, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setApprovalAction(action);

    if (action === 'approve') {
      setShowPricingModal(true);
    } else {
      setShowApprovalModal(true);
    }
  };

  const processApproval = async () => {
    if (!selectedRequest) return;
    setProcessing(true);

    try {
      const updateData = {
        status: 'rejected',
        approvedBy: userData.id,
        approvedByName: userData.name,
        approvedAt: new Date().toISOString(),
        approvalNotes: approvalNotes,
      };

      if (selectedRequest.requestType === 'direct_showroom') {
        await updateDSRequest(selectedRequest.id, updateData);
      } else if (selectedRequest.requestType === 'direct_representative') {
        await updateDRRequest(selectedRequest.id, updateData);
      } else if (selectedRequest.requestType === 'distributor') {
        await updateDistributorRequest(selectedRequest.id, updateData);
      }

      await addActivity(null, {
        type: 'request_rejected',
        timestamp: new Date().toISOString(),
        userId: userData.id,
        userName: userData.name,
        userRole: userData.role,
        details: {
          requestId: selectedRequest.customId || selectedRequest.id,
          requestedBy: selectedRequest.requestedByName,
          requestType: selectedRequest.requestType,
          notes: approvalNotes,
        },
      });

      setShowApprovalModal(false);
      setSelectedRequest(null);
      setApprovalNotes('');
    } catch (error) {
      console.error('Error processing rejection:', error);
      alert('Failed to process rejection. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDispatchConfirm = async (dispatchItems: DispatchItem[]) => {
    if (!selectedRequest || !userData) return;

    setProcessing(true);
    try {
      const updateData = {
        status: 'Approved',
        approvedBy: userData.id,
        approvedByName: userData.name,
        approvedAt: new Date().toISOString(),
        approvalNotes: approvalNotes,
      };

      if (selectedRequest.requestType === 'direct_showroom') {
        await updateDSRequest(selectedRequest.id, updateData);
      } else if (selectedRequest.requestType === 'direct_representative') {
        await updateDRRequest(selectedRequest.id, updateData);
      } else if (selectedRequest.requestType === 'distributor') {
        await updateDistributorRequest(selectedRequest.id, updateData);
      }

      await addSalesApproval(null, {
        requestId: selectedRequest.id,
        requesterId: selectedRequest.requestedBy,
        requesterName: selectedRequest.requestedByName,
        requesterRole: selectedRequest.requestedByRole || selectedRequest.requestType?.replace(/_/g, ' ') || 'Unknown',
        requestType: selectedRequest.requestType,
        approvedBy: userData.id,
        approvedByName: userData.name,
        approvedAt: new Date().toISOString(),
        dispatchItems: dispatchItems,
        status: 'sent',
        isCompletedByFG: true,
        completedByFGAt: new Date().toISOString(),
        items: selectedRequest.items,
        notes: approvalNotes,
      });

      await addActivity(null, {
        type: 'request_approved_dispatched',
        timestamp: new Date().toISOString(),
        userId: userData.id,
        userName: userData.name,
        userRole: userData.role,
        details: {
          requestId: selectedRequest.customId || selectedRequest.id,
          requestedBy: selectedRequest.requestedByName,
          requestType: selectedRequest.requestType,
          dispatchItems: dispatchItems,
        },
      });

      setShowPricingModal(false);
      setSelectedRequest(null);
      setApprovalNotes('');
      alert('Request approved and dispatched successfully!');
    } catch (error) {
      console.error('Error processing dispatch:', error);
      alert('Failed to process dispatch. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const getRequestItems = (request: Request) => {
    if (request.items) {
      if (Array.isArray(request.items)) {
        return request.items;
      } else {
        return Object.entries(request.items).map(([key, item]: [string, any]) => ({
          name: item.name || item.productName,
          qty: item.qty || item.quantity
        }));
      }
    }
    return [];
  };

  const formatRequestItems = (request: Request) => {
    if (request.items) {
      if (Array.isArray(request.items)) {
        return request.items.reduce((acc, item, index) => ({
          ...acc,
          [`prod${String(index + 1).padStart(3, '0')}`]: { name: item.productName || item.name, qty: item.quantity || item.qty }
        }), {});
      } else {
        return request.items;
      }
    }
    return { prod001: { name: request.product || 'Unknown', qty: request.quantity || 0 } };
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Approve Product Requests</h1>
      {pendingRequests.length === 0 ? (
        <div className="text-center p-8 bg-white rounded-lg shadow-sm border border-gray-200">
          <p className="text-gray-500">There are no pending requests to review.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="divide-y divide-gray-200">
            {pendingRequests.map((request) => (
              <div key={request.id} className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">
                      ID: <span className="font-medium text-gray-800">{request.customId || request.id}</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      From <span className="font-medium text-gray-800">{request.requestedByName}</span>
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(request.requestedAt || request.date || request.createdAt).toLocaleString()}
                    </p>
                    <div className="mt-1">
                      <Badge variant="info">{request.requestType?.replace(/_/g, ' ')}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <Badge color={request.status === 'pending' ? 'yellow' : 'gray'}>
                      {request.status}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="font-medium text-gray-800 text-sm">Requested Items:</h4>
                  {getRequestItems(request).length > 0 ? (
                    <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-gray-700">
                      {getRequestItems(request).map((item, index) => (
                        <li key={index}>
                          <span>{item.name} - <strong>Qty: {item.qty}</strong></span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-700 mt-2">
                      {request.product} - <strong>Qty: {request.quantity}</strong>
                    </p>
                  )}
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
                    <DollarSign size={16} /> Approve & Set Pricing
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
        </div>
      )}

      {selectedRequest && (
        <>
          <Modal
            isOpen={showApprovalModal}
            onClose={() => setShowApprovalModal(false)}
            title="Confirm Request Rejection"
          >
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                Are you sure you want to reject this request from <span className="font-semibold">{selectedRequest.requestedByName}</span>?
              </p>
              <textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Add rejection reason (optional)..."
                className="w-full p-2 border border-gray-300 rounded-md text-sm"
              />
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button onClick={() => setShowApprovalModal(false)} className="w-full sm:w-auto px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm">
                  Cancel
                </button>
                <button
                  onClick={processApproval}
                  disabled={processing}
                  className="w-full sm:w-auto px-4 py-2 text-white rounded-md text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {processing ? 'Processing...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </Modal>

          <PricingDispatchModal
            isOpen={showPricingModal}
            onClose={() => setShowPricingModal(false)}
            requestItems={formatRequestItems(selectedRequest)}
            onConfirm={handleDispatchConfirm}
            requestType={selectedRequest.requestType as any}
          />
        </>
      )}
    </div>
  );
}
