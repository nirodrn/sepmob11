import React, { useState } from 'react';
import { useFirebaseData, useFirebaseActions } from '../../../hooks/useFirebaseData';
import { ref, get, set, update } from 'firebase/database';
import { database } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Badge } from '../../Common/Badge';
import { Package } from 'lucide-react';

interface DSRequest {
  id: string;
  product: string;
  quantity: number;
  status: 'pending' | 'Approved' | 'rejected';
  date: string;
  urgent: boolean;
  requestedBy: string;
  requestedByName: string;
  notes?: string;
  approvedAt?: number;
  approvedBy?: string;
  approverName?: string;
  approverRole?: string;
}

interface SalesApprovalItem {
  requestId: string;
  status: 'Approved' | 'sent' | 'claimed';
  items: Record<string, { name: string; qty: number }>;
  sentAt?: number;
  completedByFGAt?: number;
  isCompletedByFG?: boolean;
  requestType?: string;
  type?: string;
  claimedAt?: string;
  claimedBy?: string;
  claimedByName?: string;
  requesterId?: string;
  requesterName?: string;
  requesterRole?: string;
  totalQuantity?: number;
}

export function DSStaffRequestHistory() {
  const { userData } = useAuth();
  const { data: salesApprovalHistory, loading: salesLoading } = useFirebaseData<Record<string, SalesApprovalItem>>('salesApprovalHistory');
  const { updateData: updateSalesApproval } = useFirebaseActions('salesApprovalHistory');
  const [claimingRequestId, setClaimingRequestId] = useState<string | null>(null);

  const canBeClaimed = (requestId: string) => {
    if (!salesApprovalHistory || !userData) return false;

    const approvalEntry = Object.values(salesApprovalHistory).find(
      entry => entry.requestId === requestId &&
               entry.status === 'sent' &&
               (entry.requestType === 'direct_shop' || entry.type === 'direct_shop_sale') &&
               entry.requesterId === userData.id
    );

    return !!approvalEntry;
  };

  const getClaimableItems = (requestId: string) => {
    if (!salesApprovalHistory || !userData) return null;

    const approvalEntry = Object.values(salesApprovalHistory).find(
      entry => entry.requestId === requestId &&
               entry.status === 'sent' &&
               (entry.requestType === 'direct_shop' || entry.type === 'direct_shop_sale') &&
               entry.requesterId === userData.id
    );

    return approvalEntry?.items || null;
  };

  const handleClaimRequest = async (requestId: string, items: Record<string, { name: string; qty: number }>) => {
    if (!userData || !salesApprovalHistory) return;

    setClaimingRequestId(requestId);

    try {
      const claimableItems = getClaimableItems(requestId);
      if (!claimableItems) {
        alert('No claimable items found for this request.');
        return;
      }

      const stockPromises = Object.entries(claimableItems).map(async ([productId, item]) => {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const stockEntryId = `${timestamp}_${randomId}`;

        const stockRef = ref(database, `dsstock/users/${userData.id}/entries/${stockEntryId}`);

        await set(stockRef, {
          id: stockEntryId,
          userId: userData.id,
          userName: userData.name,
          userRole: userData.role,
          productId: productId,
          productName: item.name,
          quantity: item.qty,
          availableQuantity: item.qty,
          usedQuantity: 0,
          claimedAt: new Date().toISOString(),
          requestId: requestId,
          status: 'available',
          source: 'direct_shop_request',
          location: userData.department || 'showroom',
          expiryDate: null,
          batchNumber: null,
          notes: `Claimed from Direct Shop request ${requestId}`,
          lastUpdated: new Date().toISOString()
        });

        const summaryRef = ref(database, `dsstock/users/${userData.id}/summary/${productId}`);
        const summarySnapshot = await get(summaryRef);

        if (summarySnapshot.exists()) {
          const existingSummary = summarySnapshot.val();
          await set(summaryRef, {
            ...existingSummary,
            totalQuantity: existingSummary.totalQuantity + item.qty,
            availableQuantity: existingSummary.availableQuantity + item.qty,
            lastUpdated: new Date().toISOString(),
            entryCount: existingSummary.entryCount + 1
          });
        } else {
          await set(summaryRef, {
            productId: productId,
            productName: item.name,
            totalQuantity: item.qty,
            availableQuantity: item.qty,
            usedQuantity: 0,
            entryCount: 1,
            firstClaimedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          });
        }
      });

      await Promise.all(stockPromises);

      const showroomsRef = ref(database, 'direct_showrooms');
      const showroomsSnapshot = await get(showroomsRef);
      let showroomId = null;

      if (showroomsSnapshot.exists()) {
        const showrooms = showroomsSnapshot.val();
        for (const [id, showroom] of Object.entries(showrooms)) {
          if ((showroom as any).manager_id === userData.id) {
            showroomId = id;
            break;
          }
        }
      }

      if (!showroomId) {
        console.warn('No showroom found for manager, falling back to global inventory');
      }

      await Promise.all(
        Object.entries(claimableItems).map(async ([productId, item]) => {
          const inventoryPath = showroomId
            ? `direct_showrooms/${showroomId}/inventory/${productId}`
            : `dsinventory/${productId}`;

          const inventoryRef = ref(database, inventoryPath);
          const inventorySnapshot = await get(inventoryRef);

          if (inventorySnapshot.exists()) {
            const existingInventory = inventorySnapshot.val();
            await update(inventoryRef, {
              quantity: (existingInventory.quantity || 0) + item.qty,
              lastUpdated: new Date().toISOString()
            });
          } else {
            await set(inventoryRef, {
              id: productId,
              product: item.name,
              quantity: item.qty,
              status: 'in-inventory',
              date: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
              price: 0,
              showroomId: showroomId || 'global'
            });
          }
        })
      );

      const approvalEntryKey = Object.keys(salesApprovalHistory).find(
        key => salesApprovalHistory[key].requestId === requestId &&
               salesApprovalHistory[key].status === 'sent' &&
               (salesApprovalHistory[key].requestType === 'direct_shop' || salesApprovalHistory[key].type === 'direct_shop_sale') &&
               salesApprovalHistory[key].requesterId === userData.id
      );

      if (approvalEntryKey) {
        await updateSalesApproval(approvalEntryKey, {
          status: 'claimed',
          claimedAt: new Date().toISOString(),
          claimedBy: userData.id,
          claimedByName: userData.name
        });
      }

      alert('Items successfully claimed and added to showroom inventory!');

    } catch (error) {
      console.error('Error claiming request:', error);
      alert('Failed to claim request. Please try again.');
    } finally {
      setClaimingRequestId(null);
    }
  };

  if (salesLoading) return <LoadingSpinner />;
  if (!userData) return <p>Please log in to see your request history.</p>;

  const userClaimableRequests = salesApprovalHistory
    ? Object.entries(salesApprovalHistory)
        .reduce((acc: Array<{ id: string; data: SalesApprovalItem; entryKey: string }>, [entryKey, data]) => {
          if (data && typeof data === 'object') {
            if (
              data.requesterId === userData.id &&
              data.status === 'sent' &&
              (data.requestType === 'direct_shop' || data.type === 'direct_shop_sale')
            ) {
              acc.push({ id: data.requestId, data, entryKey });
            }
          }
          return acc;
        }, [])
        .sort((a, b) => (b.data.sentAt || 0) - (a.data.sentAt || 0))
    : [];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-medium text-gray-900 p-4 border-b border-gray-200">Approved Requests - Ready to Claim</h3>
      {userClaimableRequests.length === 0 ? (
        <p className="text-gray-600 p-4">No approved requests available to claim.</p>
      ) : (
        <div className="divide-y divide-gray-200">
          {userClaimableRequests.map(({ id, data, entryKey }) => (
            <div key={entryKey} className="p-4 hover:bg-gray-50">
              <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                <div className="flex-1">
                  <p className="text-xs text-gray-500">Request ID: <span className="font-medium text-gray-700">{id}</span></p>
                  {data.sentAt && (
                    <p className="text-xs text-green-600">
                      Approved & Ready: {new Date(data.sentAt).toLocaleString()}
                    </p>
                  )}
                  <div className="mt-2">
                    <Badge variant="success">Ready to Claim</Badge>
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Items to Claim:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {Object.entries(data.items).map(([productId, item]) => (
                      <li key={productId} className="text-sm text-gray-600">
                        <span className="font-medium">{item.name}</span> - Qty: {item.qty}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                <button
                  onClick={() => handleClaimRequest(id, data.items)}
                  disabled={claimingRequestId === id}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  {claimingRequestId === id ? 'Claiming...' : 'Claim Items'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
