import React, { useMemo, useState } from 'react';
import { useFirebaseData, useFirebaseActions } from '../../../hooks/useFirebaseData';
import { ref, get, set, update } from 'firebase/database';
import { database } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Badge } from '../../Common/Badge';
import { Modal } from '../../Common/Modal';
import { Clock, CheckCircle, XCircle, Truck, Package } from 'lucide-react';

interface DispatchItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  finalPrice: number;
}

interface SalesApprovalItem {
  requestId: string;
  status: 'Approved' | 'sent' | 'claimed';
  items: Record<string, { name: string; qty: number }>;
  dispatchItems?: DispatchItem[];
  isCompletedByFG?: boolean;
  requesterId?: string;
  claimedAt?: string;
  claimedBy?: string;
  claimedByName?: string;
}

interface DistributorRequest {
  id: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  items: Record<string, { name: string; qty: number }>;
  status: 'pending' | 'approved' | 'rejected' | 'dispatched';
  priority: 'normal' | 'urgent';
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export function DistributorRequestHistory() {
  const { userData } = useAuth();
  const { data: allRequests, loading, error } = useFirebaseData<Record<string, Omit<DistributorRequest, 'id'>>>('distributorReqs');
  const { data: salesApprovalHistory, loading: salesLoading } = useFirebaseData<Record<string, SalesApprovalItem>>('salesApprovalHistory');
  const { updateData: updateSalesApproval } = useFirebaseActions('salesApprovalHistory');
  const [claimingRequestId, setClaimingRequestId] = useState<string | null>(null);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimData, setClaimData] = useState<{
    request: DistributorRequest;
    dispatchItems: DispatchItem[];
    salesApprovalId: string;
  } | null>(null);

  const userRequests = useMemo(() => {
    if (!allRequests || !userData) return [];
    
    return Object.entries(allRequests)
      .map(([id, data]) => ({ id, ...data }))
      .filter(request => request.requestedBy === userData.id)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [allRequests, userData]);

  const canBeClaimed = (requestId: string) => {
    if (!salesApprovalHistory || !userData) return false;

    const approvalEntry = Object.values(salesApprovalHistory).find(
      entry => entry.requestId === requestId &&
               entry.requesterId === userData.id &&
               entry.isCompletedByFG === true &&
               entry.status === 'sent'
    );

    return !!approvalEntry;
  };

  const handleClaimRequest = async (request: DistributorRequest) => {
    if (!userData || !salesApprovalHistory) return;

    try {
      const approvalEntry = Object.entries(salesApprovalHistory).find(
        ([key, entry]) => entry.requestId === request.id &&
               entry.requesterId === userData.id &&
               entry.isCompletedByFG === true &&
               entry.status === 'sent'
      );

      if (!approvalEntry) {
        alert('No approved dispatch found for this request.');
        return;
      }

      const [salesApprovalId, salesData] = approvalEntry;
      const dispatchItems = salesData.dispatchItems || [];

      if (dispatchItems.length === 0) {
        alert('No dispatch items found in this request.');
        return;
      }

      setClaimData({
        request,
        dispatchItems,
        salesApprovalId
      });
      setIsClaimModalOpen(true);
    } catch (error) {
      console.error('Error preparing claim:', error);
      alert('Failed to prepare claim. Please try again.');
    }
  };

  const handleConfirmClaim = async () => {
    if (!userData || !claimData) return;

    setClaimingRequestId(claimData.request.id);

    try {
      for (const item of claimData.dispatchItems) {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const stockEntryId = `${timestamp}_${randomId}`;
        const productId = `${item.productName.toLowerCase().replace(/\s+/g, '_')}`;

        const stockRef = ref(database, `distributorStock/users/${userData.id}/entries/${stockEntryId}`);

        await set(stockRef, {
          id: stockEntryId,
          userId: userData.id,
          userName: userData.name,
          userRole: userData.role,
          productId: productId,
          productName: item.productName,
          quantity: item.quantity,
          availableQuantity: item.quantity,
          usedQuantity: 0,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          finalPrice: item.finalPrice,
          totalValue: item.finalPrice * item.quantity,
          receivedAt: new Date().toISOString(),
          requestId: claimData.request.id,
          status: 'available',
          source: 'HO_dispatch',
          location: userData.department || 'warehouse',
          lastUpdated: new Date().toISOString()
        });

        const summaryRef = ref(database, `distributorStock/users/${userData.id}/summary/${productId}`);
        const summarySnapshot = await get(summaryRef);

        if (summarySnapshot.exists()) {
          const existingSummary = summarySnapshot.val();
          const newTotalQuantity = existingSummary.totalQuantity + item.quantity;
          const newTotalValue = existingSummary.totalValue + (item.finalPrice * item.quantity);
          await set(summaryRef, {
            ...existingSummary,
            totalQuantity: newTotalQuantity,
            availableQuantity: existingSummary.availableQuantity + item.quantity,
            totalValue: newTotalValue,
            averageUnitPrice: newTotalValue / newTotalQuantity,
            entryCount: existingSummary.entryCount + 1,
            lastUpdated: new Date().toISOString()
          });
        } else {
          const totalValue = item.finalPrice * item.quantity;
          await set(summaryRef, {
            productId: productId,
            productName: item.productName,
            totalQuantity: item.quantity,
            availableQuantity: item.quantity,
            usedQuantity: 0,
            totalValue: totalValue,
            averageUnitPrice: item.finalPrice,
            entryCount: 1,
            firstReceivedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          });
        }
      }

      await updateSalesApproval(claimData.salesApprovalId, {
        status: 'claimed',
        claimedAt: new Date().toISOString(),
        claimedBy: userData.id,
        claimedByName: userData.name
      });

      setIsClaimModalOpen(false);
      setClaimData(null);
      alert('Items successfully claimed and added to your stock!');

    } catch (error) {
      console.error('Error claiming request:', error);
      alert('Failed to claim request. Please try again.');
    } finally {
      setClaimingRequestId(null);
    }
  };

  if (loading || salesLoading) return <LoadingSpinner text="Loading request history..." />;
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
        <p className="text-sm text-gray-500 mt-1">Track your product requests to Head Office</p>
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
              </div>

              {request.status === 'approved' && canBeClaimed(request.id) && (
                <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                  <button
                    onClick={() => handleClaimRequest(request)}
                    disabled={claimingRequestId === request.id}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Package className="w-4 h-4" />
                    {claimingRequestId === request.id ? 'Claiming...' : 'Claim Items'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isClaimModalOpen} onClose={() => setIsClaimModalOpen(false)} title="Confirm Claim Request">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Review the items before transferring to inventory:</p>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">Product</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-700">Qty</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-700">Unit Price</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-700">Discount</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-700">Final Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {claimData?.dispatchItems.map((item, index) => (
                  <tr key={index}>
                    <td className="py-2 px-3 text-sm text-gray-900">{item.productName}</td>
                    <td className="py-2 px-3 text-sm text-gray-900 text-right">{item.quantity}</td>
                    <td className="py-2 px-3 text-sm text-gray-900 text-right">${item.unitPrice}</td>
                    <td className="py-2 px-3 text-sm text-gray-900 text-right">{item.discountPercent}%</td>
                    <td className="py-2 px-3 text-sm text-gray-900 text-right">${item.finalPrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsClaimModalOpen(false);
                setClaimData(null);
              }}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
              disabled={claimingRequestId !== null}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmClaim}
              disabled={claimingRequestId !== null}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {claimingRequestId !== null ? 'Processing...' : 'Confirm & Transfer to Inventory'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}