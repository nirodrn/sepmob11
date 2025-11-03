import React, { useState, useMemo } from 'react';
import { useFirebaseData, useFirebaseActions } from '../../hooks/useFirebaseData';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { ErrorMessage } from '../Common/ErrorMessage';
import { Badge } from '../Common/Badge';
import { Modal } from '../Common/Modal';
import { ref, get, set, update } from 'firebase/database';
import { database } from '../../config/firebase';
import { useRoleStockOperations } from '../../hooks/useRoleStockOperations';

interface Request {
  id: string;
  product: string;
  quantity: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'Approved';
  date: string;
  urgent: boolean;
  requestedBy: string;
  requestedByName: string;
  requestedByRole?: string;
  notes?: string;
}

interface DispatchItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  finalPrice: number;
}

export function DRRequestHistory() {
  const { userData } = useAuth();
  const { data: allRequests, loading, error } = useFirebaseData<Record<string, Omit<Request, 'id'>>>('drreqs');
  const { updateData: updateSalesApproval } = useFirebaseActions('salesApprovalHistory');
  const { data: salesApprovalHistory } = useFirebaseData('salesApprovalHistory');
  const { addStockEntry } = useRoleStockOperations('DirectRepresentative');

  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimData, setClaimData] = useState<{
    request: Request;
    dispatchItems: DispatchItem[];
    salesApprovalId: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canClaimRequest = (requestId: string): { canClaim: boolean; salesApprovalId: string | null } => {
    if (!salesApprovalHistory || !userData) {
      return { canClaim: false, salesApprovalId: null };
    }

    for (const [salesId, salesData] of Object.entries(salesApprovalHistory)) {
      if (salesData && typeof salesData === 'object') {
        const data = salesData as any;

        if (
          data.requestId === requestId &&
          data.requesterId === userData.id &&
          data.isCompletedByFG === true &&
          data.status === 'sent'
        ) {
          return { canClaim: true, salesApprovalId: salesId };
        }
      }
    }

    return { canClaim: false, salesApprovalId: null };
  };

  const handleClaimClick = async (request: Request) => {
    if (!userData) return;

    const { canClaim, salesApprovalId } = canClaimRequest(request.id);
    if (!canClaim || !salesApprovalId) {
      alert('This request cannot be claimed at the moment.');
      return;
    }

    try {
      const salesApprovalRef = ref(database, `salesApprovalHistory/${salesApprovalId}`);
      const salesSnapshot = await get(salesApprovalRef);

      if (!salesSnapshot.exists()) {
        alert('Sales approval data not found.');
        return;
      }

      const salesData = salesSnapshot.val();
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
    } catch (e) {
      console.error('Error fetching claim data:', e);
      alert('Failed to load claim data. Please try again.');
    }
  };

  const handleConfirmClaim = async () => {
    if (!userData || !claimData) return;

    setIsSubmitting(true);
    try {
      for (const item of claimData.dispatchItems) {
        await addStockEntry({
          userId: userData.id,
          userName: userData.name,
          userRole: userData.role,
          productId: item.productName.replace(/[.#$/\[\]]/g, '_'),
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          finalPrice: item.finalPrice,
          requestId: claimData.request.id,
          source: 'direct_representative_request',
          location: 'field'
        });
      }

      await updateSalesApproval(claimData.salesApprovalId, {
        status: 'claimed',
        claimedAt: new Date().toISOString(),
        claimedBy: userData.id,
        claimedByName: userData.name,
      });

      setIsClaimModalOpen(false);
      setClaimData(null);
      alert('Request claimed successfully and transferred to your stock!');
    } catch (e) {
      console.error('Error claiming request:', e);
      alert('Failed to claim the request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load request history." />;
  if (!userData) return <p>Please log in to see your request history.</p>;

  const userRequests: Request[] = allRequests
    ? Object.entries(allRequests)
        .reduce((acc: Request[], [id, data]) => {
          if (data && typeof data === 'object') {
            const requestItem = { id, ...data } as Request;
            if (requestItem.requestedBy === userData.id) {
              acc.push(requestItem);
            }
          }
          return acc;
        }, [])
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 p-4 border-b border-gray-200">Request History</h3>
        {userRequests.length === 0 ? (
          <p className="text-gray-600 p-4">You haven't made any requests yet.</p>
        ) : (
          <div className="divide-y divide-gray-200">
            {userRequests.map((request) => (
              <div key={request.id} className="p-4 hover:bg-gray-50">
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                  <div className="flex-1">
                    <p className="text-base font-semibold text-gray-800">{request.product}</p>
                    <p className="text-xs text-gray-500">ID: <span className="font-medium text-gray-700">{request.id}</span></p>
                    <p className="text-xs text-gray-500">{new Date(request.date).toLocaleString()}</p>
                  </div>
                  <div className="self-start sm:self-center">
                    <Badge
                      color={
                        request.status === 'pending' ? 'yellow' :
                        request.status === 'Approved' || request.status === 'approved' ? 'green' :
                        request.status === 'completed' ? 'blue' :
                        'red'
                      }
                    >
                      {request.status}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Quantity:</span> {request.quantity}
                    {request.urgent && <span className='text-red-600 font-bold ml-4'>(Urgent)</span>}
                  </p>
                  {request.notes && (
                    <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded-md">Notes: {request.notes}</p>
                  )}
                </div>
                {(request.status.toLowerCase() === 'approved') && canClaimRequest(request.id).canClaim && (
                  <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                    <button
                      onClick={() => handleClaimClick(request)}
                      className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Claim Request
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={isClaimModalOpen} onClose={() => setIsClaimModalOpen(false)} title="Confirm Claim Request">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Review the items before transferring to your stock:</p>

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
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmClaim}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : 'Confirm & Transfer to Stock'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
