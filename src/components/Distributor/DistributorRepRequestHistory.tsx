import React, { useState, useMemo } from 'react';
import { useFirebaseData, useFirebaseActions } from '../../hooks/useFirebaseData';
import { ref, get, set } from 'firebase/database';
import { database } from '../../config/firebase';
import { useDistributorRepStockOperations } from '../../hooks/useDistributorRepStockOperations';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { ErrorMessage } from '../Common/ErrorMessage';
import { Badge } from '../Common/Badge';
import { Package } from 'lucide-react';

interface DistributorRepRequest {
  id: string;
  distributorId: string;
  status: 'pending' | 'approved' | 'rejected' | 'dispatched';
  items: Record<string, { name: string; qty: number }>;
  notes?: string;
  priority?: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: string;
  createdAt: number;
  updatedAt: number;
  approvedAt?: number;
  approvedBy?: string;
  approverName?: string;
  dispatchedAt?: number;
  dispatchedBy?: string;
  dispatcherName?: string;
  dispatchedQuantities?: Record<string, number>;
}

interface SalesApprovalItem {
  requestId: string;
  status: 'Approved' | 'sent' | 'claimed';
  items: Record<string, { name: string; qty: number }>;
  sentAt?: number;
  requestType?: string;
  requesterId?: string;
  requesterName?: string;
  requesterRole?: string;
  distributorId?: string;
  distributorName?: string;
  totalQuantity?: number;
  claimedAt?: string;
  claimedBy?: string;
  claimedByName?: string;
}

export function DistributorRepRequestHistory() {
  const { userData } = useAuth();
  const { data: allRequests, loading, error } = useFirebaseData<Record<string, any>>('disRefReqs');
  const { data: salesApprovalHistory, loading: salesLoading } = useFirebaseData<Record<string, SalesApprovalItem>>('salesApprovalHistory');
  const { data: usersData } = useFirebaseData<Record<string, any>>('users');
  const { data: inventoryData } = useFirebaseData<Record<string, any>>('finishedGoodsPackagedInventory');
  const { addStockEntry } = useDistributorRepStockOperations();
  const { updateData: updateSalesApproval } = useFirebaseActions('salesApprovalHistory');
  const [claimingRequestId, setClaimingRequestId] = useState<string | null>(null);

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

  // Function to check if a request can be claimed
  const canBeClaimed = (requestId: string) => {
    if (!salesApprovalHistory) return false;
    
    const approvalEntry = Object.values(salesApprovalHistory).find(
      entry => entry.requestId === requestId && 
               entry.status === 'sent' && 
               entry.requestType === 'distributor_representative'
    );
    
    return !!approvalEntry;
  };

  // Function to get claimable items for a request
  const getClaimableItems = (requestId: string) => {
    if (!salesApprovalHistory) return null;
    
    const approvalEntry = Object.values(salesApprovalHistory).find(
      entry => entry.requestId === requestId && 
               entry.status === 'sent' && 
               entry.requestType === 'distributor_representative'
    );
    
    return approvalEntry?.items || null;
  };

  const handleClaimRequest = async (request: DistributorRepRequest) => {
    if (!userData || !salesApprovalHistory || !usersData) return;
    
    setClaimingRequestId(request.id);
    
    try {
      const claimableItems = getClaimableItems(request.id);
      if (!claimableItems) {
        alert('No claimable items found for this request.');
        return;
      }

      const distributorInfo = usersData[userData.distributorId || ''];
      
      // Add items to disrepstock with better structure for scalability
      const stockPromises = Object.entries(claimableItems).map(async ([productId, item]) => {
        await addStockEntry(
          userData.id,
          userData.distributorId || '',
          productId,
          item.name,
          item.qty,
          request.id,
          'distributor_representative_request',
          {
            name: userData.name,
            role: userData.role,
            distributorName: distributorInfo?.name || 'Unknown Distributor',
            location: userData.department || 'field'
          }
        );
      });

      await Promise.all(stockPromises);

      // Update the sales approval history to mark as claimed
      const approvalEntryKey = Object.keys(salesApprovalHistory).find(
        key => salesApprovalHistory[key].requestId === request.id && 
               salesApprovalHistory[key].status === 'sent' &&
               salesApprovalHistory[key].requestType === 'distributor_representative'
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

  const userRequests: DistributorRepRequest[] = useMemo(() => {
    if (!allRequests || !userData) return [];

    const requests: any[] = [];
    const distributorData = allRequests[userData.distributorId || ''];
    if (distributorData && typeof distributorData === 'object') {
      const repData = distributorData[userData.id];
      if (repData && typeof repData === 'object') {
        // Iterate through request ID prefixes
        Object.entries(repData).forEach(([requestIdPrefix, nestedData]) => {
          if (nestedData && typeof nestedData === 'object') {
            // Iterate through actual requests
            Object.entries(nestedData).forEach(([id, data]) => {
              if (data && typeof data === 'object') {
                requests.push({ id, ...data });
              }
            });
          }
        });
      }
    }

    return requests
      .filter(request => request.requestedBy === userData.id)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [allRequests, userData]);

  if (loading || salesLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load request history." />;
  if (!userData) return <p>Please log in to see your request history.</p>;

  // Get distributor name
  const distributorName = usersData && userData.distributorId 
    ? usersData[userData.distributorId]?.name || 'Unknown Distributor'
    : 'No Distributor Assigned';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Request History</h3>
        <p className="text-sm text-gray-600">Requests sent to: <span className="font-medium">{distributorName}</span></p>
      </div>
      
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
                  {request.priority && (
                    <div className="mt-2">
                      <Badge variant={request.priority === 'urgent' ? 'danger' : request.priority === 'high' ? 'warning' : 'default'}>
                        {request.priority}
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="self-start sm:self-center">
                  <Badge
                    variant={
                      request.status === 'pending' ? 'warning' :
                      request.status === 'approved' ? 'success' :
                      request.status === 'dispatched' ? 'info' :
                      request.status === 'fulfilled' ? 'info' :
                      'danger'
                    }
                  >
                    {request.status}
                  </Badge>
                  {request.status === 'dispatched' && canBeClaimed(request.id) && (
                    <div className="mt-2">
                      <Badge variant="info">Ready to Claim</Badge>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Requested Products:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {Object.entries(request.items).map(([key, item]) => (
                      <li key={key} className="text-sm text-gray-600">
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
                
                {request.dispatchedAt && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-md">
                    <p className="text-xs text-blue-700">
                      <strong>Dispatched:</strong> {new Date(request.dispatchedAt).toLocaleString()} by {request.dispatcherName}
                    </p>
                  </div>
                )}
              </div>

              {request.status === 'dispatched' && canBeClaimed(request.id) && (
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