import React, { useState, useMemo } from 'react';
import { useFirebaseData, useFirebaseActions } from '../../hooks/useFirebaseData';
import { ref, get, set } from 'firebase/database';
import { database } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { ErrorMessage } from '../Common/ErrorMessage';
import { Badge } from '../Common/Badge';
import { Package } from 'lucide-react';

interface DistributorRequest {
  id: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  items: Record<string, { name: string; qty: number }>;
  status: 'pending' | 'Approved' | 'rejected';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  notes: string;
  createdAt: number;
  updatedAt: number;
  approvedAt?: number;
  approvedBy?: string;
  approverName?: string;
  approverRole?: string;
  distributorId?: string;
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

export function DistributorRequestHistory() {
  const { userData } = useAuth();
  const { data: allRequests, loading, error } = useFirebaseData<Record<string, DistributorRequest>>('distributorReqs');
  const { data: salesApprovalHistory, loading: salesLoading } = useFirebaseData<Record<string, SalesApprovalItem>>('salesApprovalHistory');
  const { updateData: updateSalesApproval } = useFirebaseActions('salesApprovalHistory');
  const [claimingRequestId, setClaimingRequestId] = useState<string | null>(null);

  // Function to check if a request can be claimed
  const canBeClaimed = (requestId: string) => {
    if (!salesApprovalHistory) return false;
    
    const approvalEntry = Object.values(salesApprovalHistory).find(
      entry => entry.requestId === requestId && 
               entry.status === 'sent' && 
               entry.requestType === 'distributor'
    );
    
    return !!approvalEntry;
  };

  // Function to get claimable items for a request
  const getClaimableItems = (requestId: string) => {
    if (!salesApprovalHistory) return null;
    
    const approvalEntry = Object.values(salesApprovalHistory).find(
      entry => entry.requestId === requestId && 
               entry.status === 'sent' && 
               entry.requestType === 'distributor'
    );
    
    return approvalEntry?.items || null;
  };

  const handleClaimRequest = async (request: DistributorRequest) => {
    if (!userData || !salesApprovalHistory) return;
    
    setClaimingRequestId(request.id);
    
    try {
      const claimableItems = getClaimableItems(request.id);
      if (!claimableItems) {
        alert('No claimable items found for this request.');
        return;
      }

      // Add items to distributorStock with better structure for scalability
      const stockPromises = Object.entries(claimableItems).map(async ([productId, item]) => {
        // Generate unique stock entry ID with timestamp for better distribution
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const stockEntryId = `${timestamp}_${randomId}`;
        
        // Create new stock entry with hierarchical structure
        const stockRef = ref(database, `distributorStock/users/${userData.id}/entries/${stockEntryId}`);
        
        // Create stock entry with better structure
        await set(stockRef, {
          id: stockEntryId,
          userId: userData.id,
          userName: userData.name,
          userRole: userData.role,
          productId: productId,
          productName: item.name,
          quantity: item.qty,
          availableQuantity: item.qty, // Track available vs used quantity
          usedQuantity: 0,
          claimedAt: new Date().toISOString(),
          requestId: request.id,
          status: 'available',
          source: 'distributor_request',
          location: userData.department || 'warehouse',
          expiryDate: null, // Can be set if products have expiry
          batchNumber: null, // Can be set if needed
          notes: `Claimed from distributor request ${request.id}`,
          lastUpdated: new Date().toISOString()
        });

        // Update user's product summary for quick lookups
        const summaryRef = ref(database, `distributorStock/users/${userData.id}/summary/${productId}`);
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

      // Update the sales approval history to mark as claimed
      const approvalEntryKey = Object.keys(salesApprovalHistory).find(
        key => salesApprovalHistory[key].requestId === request.id && 
               salesApprovalHistory[key].status === 'sent' &&
               salesApprovalHistory[key].requestType === 'distributor'
      );

      if (approvalEntryKey) {
        await updateSalesApproval(approvalEntryKey, {
          status: 'claimed',
          claimedAt: new Date().toISOString(),
          claimedBy: userData.id,
          claimedByName: userData.name
        });
      }

      alert('Items successfully claimed and added to your stock!');
      
    } catch (error) {
      console.error('Error claiming request:', error);
      alert('Failed to claim request. Please try again.');
    } finally {
      setClaimingRequestId(null);
    }
  };

  if (loading || salesLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load request history." />;
  if (!userData) return <p>Please log in to see your request history.</p>;

  const userRequests: DistributorRequest[] = allRequests
    ? Object.entries(allRequests)
        .reduce((acc: DistributorRequest[], [id, data]) => {
          if (data && typeof data === 'object') {
            const requestItem = { id, ...data } as DistributorRequest;
            if (
              (userData.role === 'DistributorRepresentative' && requestItem.requestedBy === userData.id) ||
              (userData.role === 'Distributor' && requestItem.distributorId === userData.id) ||
              (userData.role === 'Admin')
            ) {
              acc.push(requestItem);
            }
          }
          return acc;
        }, [])
        .sort((a, b) => b.createdAt - a.createdAt)
    : [];

  return (
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
                  <p className="text-xs text-gray-500">ID: <span className="font-medium text-gray-700">{request.id}</span></p>
                  <p className="text-xs text-gray-500">{new Date(request.createdAt).toLocaleString()}</p>
                  {request.approvedAt && (
                    <p className="text-xs text-green-600">
                      Approved: {new Date(request.approvedAt).toLocaleString()} by {request.approverName}
                    </p>
                  )}
                  <div className="mt-2">
                    <Badge variant={request.priority === 'urgent' ? 'danger' : request.priority === 'high' ? 'warning' : 'default'}>
                      {request.priority}
                    </Badge>
                  </div>
                </div>
                <div className="self-start sm:self-center">
                  <Badge
                    variant={
                      request.status === 'pending' ? 'warning' :
                      request.status === 'Approved' ? 'success' :
                      'danger'
                    }
                  >
                    {request.status}
                  </Badge>
                  {request.status === 'Approved' && canBeClaimed(request.id) && (
                    <div className="mt-2">
                      <Badge variant="info">Ready to Claim</Badge>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Requested Items:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {Object.entries(request.items).map(([productId, item]) => (
                      <li key={productId} className="text-sm text-gray-600">
                        <span className="font-medium">{item.name}</span> - Qty: {item.qty}
                      </li>
                    ))}
                  </ul>
                </div>
                
                {request.notes && (
                  <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded-md">
                    Notes: {request.notes}
                  </p>
                )}
              </div>

              {request.status === 'Approved' && canBeClaimed(request.id) && (
                <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                  <button
                    onClick={() => handleClaimRequest(request)}
                    disabled={claimingRequestId === request.id}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 flex items-center justify-center gap-2"
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