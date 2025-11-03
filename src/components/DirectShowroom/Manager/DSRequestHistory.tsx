import React, { useMemo, useState } from 'react';
import { useFirebaseData, useFirebaseActions } from '../../../hooks/useFirebaseData';
import { ref, get, set, update } from 'firebase/database';
import { database } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Badge } from '../../Common/Badge';
import { Clock, CheckCircle, XCircle, Truck, Package } from 'lucide-react';

interface DSRequest {
  id: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  items: Record<string, { name: string; qty: number }>;
  status: 'pending' | 'approved' | 'Approved' | 'rejected' | 'dispatched';
  priority: 'normal' | 'urgent';
  notes?: string;
  createdAt: number;
  updatedAt: number;
  product?: string;
  quantity?: number;
  urgent?: boolean;
  date?: string;
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

export function DSRequestHistory() {
  const { userData } = useAuth();
  const { data: allRequests, loading, error } = useFirebaseData<Record<string, Omit<DSRequest, 'id'>>>('dsreqs');
  const { data: salesApprovalHistory, loading: salesLoading } = useFirebaseData<Record<string, SalesApprovalItem>>('salesApprovalHistory');
  const { updateData: updateSalesApproval } = useFirebaseActions('salesApprovalHistory');
  const [claimingRequestId, setClaimingRequestId] = useState<string | null>(null);

  const userRequests = useMemo(() => {
    if (!allRequests || !userData) return [];

    return Object.entries(allRequests)
      .map(([id, data]) => {
        const request = { id, ...data } as DSRequest;

        if (request.product && request.quantity && !request.items) {
          request.items = {
            [request.product]: {
              name: request.product,
              qty: request.quantity
            }
          };
        }

        return request;
      })
      .filter(request => request.requestedBy === userData.id)
      .sort((a, b) => {
        const aTime = a.createdAt || new Date(a.date || 0).getTime();
        const bTime = b.createdAt || new Date(b.date || 0).getTime();
        return bTime - aTime;
      });
  }, [allRequests, userData]);

  const canBeClaimed = (requestId: string) => {
    if (!salesApprovalHistory || !userData) return false;

    const approvalEntry = Object.values(salesApprovalHistory).find(
      entry => entry.requestId === requestId &&
               entry.status === 'sent' &&
               (entry.requestType === 'direct_shop' || entry.type === 'direct_shop_sale') &&
               entry.requesterId === userData.id
    );

    console.log('Checking claim for request:', requestId, {
      found: !!approvalEntry,
      approvalEntry,
      userId: userData.id,
      allApprovals: salesApprovalHistory
    });

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

  const handleClaimRequest = async (request: DSRequest) => {
    if (!userData || !salesApprovalHistory) return;

    setClaimingRequestId(request.id);

    try {
      const claimableItems = getClaimableItems(request.id);
      if (!claimableItems) {
        alert('No claimable items found for this request.');
        return;
      }

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
        alert('No showroom found for your account. Please contact support.');
        setClaimingRequestId(null);
        return;
      }

      const stockPromises = Object.entries(claimableItems).map(async ([productId, item]) => {
        const inventoryPath = `direct_showrooms/${showroomId}/inventory/${productId}`;
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
            showroomId: showroomId
          });
        }
      });

      await Promise.all(stockPromises);

      const approvalEntryKey = Object.keys(salesApprovalHistory).find(
        key => salesApprovalHistory[key].requestId === request.id &&
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
                    {(request.priority === 'urgent' || request.urgent === true) && (
                      <Badge color="red">Urgent</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    Created: {new Date(request.createdAt || new Date(request.date || 0).getTime()).toLocaleString()}
                  </p>
                </div>
                <div className="self-start sm:self-center">
                  <Badge color={getStatusColor(request.status)}>
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </Badge>
                  {(request.status === 'approved' || request.status === 'Approved') && canBeClaimed(request.id) && (
                    <div className="mt-2">
                      <Badge color="blue">Ready to Claim</Badge>
                    </div>
                  )}
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

              {(request.status === 'approved' || request.status === 'Approved') && canBeClaimed(request.id) && (
                <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                  <button
                    onClick={() => handleClaimRequest(request)}
                    disabled={claimingRequestId === request.id}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 flex items-center justify-center gap-2"
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
    </div>
  );
}