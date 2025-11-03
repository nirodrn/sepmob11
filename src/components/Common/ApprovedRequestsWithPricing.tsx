import React, { useState, useMemo } from 'react';
import { useFirebaseData, useFirebaseActions } from '../../hooks/useFirebaseData';
import { useAuth } from '../../context/AuthContext';
import { useRoleStockOperations } from '../../hooks/useRoleStockOperations';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorMessage } from './ErrorMessage';
import { Badge } from './Badge';
import { Package, DollarSign, CheckCircle } from 'lucide-react';

interface DispatchItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  finalPrice: number;
}

interface ApprovalRecord {
  id: string;
  requestId: string;
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  approvedBy: string;
  approvedByName: string;
  approvedAt: string;
  dispatchItems: DispatchItem[];
  status: 'sent' | 'received';
  isCompletedByFG: boolean;
  completedByFGAt?: string;
  receivedAt?: string;
  receivedBy?: string;
  items: Record<string, { name: string; qty: number }>;
  notes?: string;
}

export function ApprovedRequestsWithPricing() {
  const { userData } = useAuth();
  const { data: approvals, loading, error } = useFirebaseData<Record<string, ApprovalRecord>>('salesApprovalHistory');
  const { updateData: updateApproval } = useFirebaseActions('salesApprovalHistory');
  const { addStockEntry, loading: stockLoading } = useRoleStockOperations(userData?.role || '');

  const [processing, setProcessing] = useState<string | null>(null);

  const userApprovals = useMemo(() => {
    if (!approvals || !userData) return [];

    return Object.entries(approvals)
      .filter(([_, approval]) => approval.requesterId === userData.id && approval.status === 'sent')
      .map(([id, approval]) => ({ ...approval, id }))
      .sort((a, b) => new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime());
  }, [approvals, userData]);

  if (loading) return <LoadingSpinner text="Loading approved requests..." />;
  if (error) return <ErrorMessage message="Failed to load approved requests." />;
  if (!userData) return null;

  const handleReceiveStock = async (approval: ApprovalRecord) => {
    if (!userData || !approval.dispatchItems || approval.dispatchItems.length === 0) {
      alert('Cannot receive stock: Missing required data');
      return;
    }

    setProcessing(approval.id);

    try {
      for (const item of approval.dispatchItems) {
        const productId = `${item.productName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

        await addStockEntry({
          userId: userData.id,
          userName: userData.name,
          userRole: userData.role,
          productId: productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercent: item.discountPercent,
          finalPrice: item.finalPrice,
          requestId: approval.requestId,
          source: 'HO_dispatch',
          location: userData.department || 'warehouse'
        });
      }

      await updateApproval(approval.id, {
        status: 'received',
        receivedAt: new Date().toISOString(),
        receivedBy: userData.id
      });

      alert('Stock received and added to your inventory successfully!');
    } catch (err: any) {
      console.error('Error receiving stock:', err);
      alert(`Failed to receive stock: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  };

  const calculateTotalValue = (items?: DispatchItem[]): number => {
    if (!items || items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
  };

  if (userApprovals.length === 0) {
    return (
      <div className="text-center p-8 bg-white rounded-lg shadow-sm border border-gray-200">
        <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-500">No approved requests waiting to be received.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Approved Requests - Ready to Receive</h2>
        <Badge color="green">{userApprovals.length} Pending</Badge>
      </div>

      <div className="space-y-4">
        {userApprovals.map((approval) => (
          <div key={approval.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="bg-green-50 border-b border-green-100 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-semibold text-gray-900">Request #{approval.requestId}</p>
                    <p className="text-sm text-gray-600">
                      Approved by {approval.approvedByName} on {new Date(approval.approvedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge color="green">Approved</Badge>
              </div>
            </div>

            <div className="p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Products with Pricing
              </h4>

              <div className="space-y-3 mb-4">
                {approval.dispatchItems?.map((item, index) => (
                  <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        <p className="text-sm text-gray-600">Quantity: {item.quantity} units</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600">Unit Price</p>
                        <p className="font-semibold text-gray-900">${item.unitPrice.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Discount</p>
                        <p className="font-semibold text-gray-900">{item.discountPercent}%</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Final Price/Unit</p>
                        <p className="font-semibold text-green-600">${item.finalPrice.toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-300">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Subtotal:</span>
                        <span className="text-lg font-bold text-gray-900">
                          ${(item.finalPrice * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-gray-900">Total Order Value:</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">
                    ${calculateTotalValue(approval.dispatchItems).toFixed(2)}
                  </span>
                </div>
              </div>

              {approval.notes && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Notes:</span> {approval.notes}
                  </p>
                </div>
              )}

              <button
                onClick={() => handleReceiveStock(approval)}
                disabled={processing === approval.id || stockLoading}
                className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
              >
                {processing === approval.id ? (
                  <>
                    <LoadingSpinner />
                    <span>Receiving Stock...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Receive Stock & Add to Inventory</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
