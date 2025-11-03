import React, { useState, useMemo } from 'react';
import { useFirebaseData, useFirebaseActions } from '../../../hooks/useFirebaseData';
import { useAuth } from '../../../context/AuthContext';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Badge } from '../../Common/Badge';
import { Modal } from '../../Common/Modal';
import { ref, get, set, update } from 'firebase/database';
import { database } from '../../../config/firebase';
import { useDirectShowroomStockOperations } from '../../../hooks/useDirectShowroomStockOperations';

interface Request {
  id: string;
  product: string;
  quantity: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  date: string;
  urgent: boolean;
  requestedBy: string;
  requestedByName: string;
  notes?: string;
}

interface Customer {
  id: string;
  name: string;
  contact: string;
}

interface DispatchItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  finalPrice: number;
}

export function DSRequestHistory() {
  const { userData } = useAuth();
  const { data: allRequests, loading, error } = useFirebaseData<Record<string, Omit<Request, 'id'>>>('dsreqs');
  const { data: inventory } = useFirebaseData('dsinventory');
  const { addData: addToInventory, updateData: updateInventory } = useFirebaseActions('dsinventory');
  const { deleteData: deleteRequest } = useFirebaseActions('dsreqs');
  const { addData: addInvoice } = useFirebaseActions('invoices');
  const { updateData: updateSalesApproval } = useFirebaseActions('salesApprovalHistory');

  const { data: customersData, loading: customersLoading } = useFirebaseData('customers');
  const { data: salesApprovalHistory } = useFirebaseData('salesApprovalHistory');
  const { addStockEntry } = useDirectShowroomStockOperations();

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [invoicePrice, setInvoicePrice] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimData, setClaimData] = useState<{
    request: Request;
    dispatchItems: DispatchItem[];
    salesApprovalId: string;
  } | null>(null);

  const customers = useMemo(() => {
    if (!customersData || typeof customersData !== 'object') return [];
    return Object.entries(customersData).map(([id, data]) => ({ id, ...(data as any) }));
  }, [customersData]);

  const canClaimRequest = (requestId: string): { canClaim: boolean; salesApprovalId: string | null } => {
    if (!salesApprovalHistory || !userData) {
      console.log('No sales history or userData', { salesApprovalHistory, userData });
      return { canClaim: false, salesApprovalId: null };
    }

    console.log('Checking claim for requestId:', requestId, 'userId:', userData.id);

    for (const [salesId, salesData] of Object.entries(salesApprovalHistory)) {
      if (salesData && typeof salesData === 'object') {
        const data = salesData as any;
        console.log('Checking salesId:', salesId, {
          requestIdMatch: data.requestId === requestId,
          requesterIdMatch: data.requesterId === userData.id,
          isCompletedByFG: data.isCompletedByFG,
          status: data.status,
          data: data
        });

        if (
          data.requestId === requestId &&
          data.requesterId === userData.id &&
          data.isCompletedByFG === true &&
          data.status === 'sent'
        ) {
          console.log('Found claimable request!', salesId);
          return { canClaim: true, salesApprovalId: salesId };
        }
      }
    }

    console.log('No claimable request found for:', requestId);
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
      // Get dispatch items from sales approval history
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

      // Open confirmation modal with dispatch items
      setClaimData({
        request,
        dispatchItems,
        salesApprovalId
      });
      setIsClaimModalOpen(true);
    } catch (e) {
      console.error("Error fetching claim data: ", e);
      alert('Failed to load claim data. Please try again.');
    }
  };

  const handleConfirmClaim = async () => {
    if (!userData || !claimData) return;

    setIsSubmitting(true);
    try {
      const showroomsRef = ref(database, 'direct_showrooms');
      const showroomsSnapshot = await get(showroomsRef);
      let showroomId = null;
      let showroomName = null;

      if (showroomsSnapshot.exists()) {
        const showrooms = showroomsSnapshot.val();
        for (const [id, showroom] of Object.entries(showrooms)) {
          if ((showroom as any).manager_id === userData.id) {
            showroomId = id;
            showroomName = (showroom as any).name || 'Unknown Showroom';
            break;
          }
        }
      }

      if (!showroomId) {
        alert('No showroom found for your account. Please contact support.');
        return;
      }

      // Transfer each dispatch item to new stock system and old inventory
      for (const item of claimData.dispatchItems) {
        const productKey = item.productName.replace(/[.#$/\[\]]/g, '_');

        // Add to new stock system (dsstock)
        await addStockEntry(
          userData.id,
          showroomId,
          productKey,
          item.productName,
          item.quantity,
          claimData.request.id,
          'direct_showroom_request',
          {
            unitPrice: item.unitPrice,
            finalPrice: item.finalPrice,
            discountPercent: item.discountPercent
          },
          {
            name: userData.name,
            role: userData.role,
            showroomName: showroomName,
            location: 'showroom'
          }
        );

        // Also update old inventory system for backward compatibility
        const inventoryPath = `direct_showrooms/${showroomId}/inventory/${productKey}`;
        const inventoryRef = ref(database, inventoryPath);
        const inventorySnapshot = await get(inventoryRef);

        if (inventorySnapshot.exists()) {
          const existingInventory = inventorySnapshot.val();
          await update(inventoryRef, {
            quantity: (existingInventory.quantity || 0) + item.quantity,
            lastUpdated: new Date().toISOString()
          });
        } else {
          await set(inventoryRef, {
            id: productKey,
            product: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            finalPrice: item.finalPrice,
            discountPercent: item.discountPercent,
            status: 'in-inventory',
            date: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            location: '',
            showroomId: showroomId,
            requestId: claimData.request.id
          });
        }
      }

      // Update sales approval history
      await updateSalesApproval(claimData.salesApprovalId, {
        status: 'claimed',
        claimedAt: new Date().toISOString(),
        claimedBy: userData.id,
        claimedByName: userData.name,
      });

      setIsClaimModalOpen(false);
      setClaimData(null);
      alert('Request claimed successfully and transferred to inventory!');
    } catch (e) {
      console.error("Error claiming request: ", e);
      alert('Failed to claim the request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccept = async (request: Request) => {
    if (!userData) return;

    try {
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
        return;
      }

      const productId = request.id;
      const inventoryPath = `direct_showrooms/${showroomId}/inventory/${productId}`;
      const inventoryRef = ref(database, inventoryPath);
      const inventorySnapshot = await get(inventoryRef);

      if (inventorySnapshot.exists()) {
        const existingInventory = inventorySnapshot.val();
        await update(inventoryRef, {
          quantity: (existingInventory.quantity || 0) + request.quantity,
          lastUpdated: new Date().toISOString()
        });
      } else {
        await set(inventoryRef, {
          id: productId,
          product: request.product,
          quantity: request.quantity,
          status: 'in-inventory',
          date: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          price: 0,
          showroomId: showroomId
        });
      }

      await deleteRequest(request.id);

      alert('Request accepted and transferred to showroom inventory!');

    } catch (e) {
      console.error("Error accepting request: ", e);
      alert('Failed to accept the request. Please try again.');
    }
  };

  const openInvoiceModal = (request: Request) => {
    setSelectedRequest(request);
    setIsInvoiceModalOpen(true);
    setSelectedCustomer('');
    setInvoicePrice(0);
  }

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !selectedCustomer || invoicePrice <= 0 || !userData) return;

    setIsSubmitting(true);
    try {
      const customerDetails = customers.find(c => c.id === selectedCustomer);
      if (!customerDetails) throw new Error('Customer not found');

      const invoice = {
        requestId: selectedRequest.id,
        product: selectedRequest.product,
        quantity: selectedRequest.quantity,
        price: invoicePrice,
        total: invoicePrice * selectedRequest.quantity,
        customerId: selectedCustomer,
        customerName: customerDetails.name,
        issuedBy: userData.id,
        issuedByName: userData.name,
        issuedAt: new Date().toISOString(),
        status: 'unpaid',
      };
      await addInvoice(undefined, invoice);
      alert('Invoice created successfully!');
      setIsInvoiceModalOpen(false);
    } catch (error) {
      console.error("Error creating invoice: ", error);
      alert('Failed to create invoice.');
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
                        request.status === 'approved' ? 'green' :
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
                {request.status.toLowerCase() === 'approved' && canClaimRequest(request.id).canClaim && (
                  <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                    <button
                      onClick={() => handleClaimClick(request)}
                      className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Claim Request
                    </button>
                  </div>
                )}
                {request.status === 'completed' && (
                  <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                     <button
                      onClick={() => openInvoiceModal(request)}
                      className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Create Customer Invoice
                    </button>
                    <button
                      onClick={() => handleAccept(request)}
                      className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Accept & Move to Inventory
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
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmClaim}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Processing...' : 'Confirm & Transfer to Inventory'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isInvoiceModalOpen} onClose={() => setIsInvoiceModalOpen(false)} title="Create Customer Invoice">
        <form onSubmit={handleCreateInvoice} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Product</label>
                <p className="mt-1 text-gray-900 font-semibold">{selectedRequest?.product} (x{selectedRequest?.quantity})</p>
            </div>
          <div>
            <label htmlFor="customer" className="block text-sm font-medium text-gray-700">Customer</label>
            <select 
                id="customer"
                value={selectedCustomer}
                onChange={e => setSelectedCustomer(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                required
            >
                <option value="" disabled>Select a customer</option>
                {customersLoading ? (
                    <option disabled>Loading customers...</option>
                ) : (
                    customers.map(c => <option key={c.id} value={c.id}>{c.name} - {c.contact}</option>)
                )}
            </select>
          </div>
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700">Price (per item)</label>
            <input 
                type="number"
                id="price"
                value={invoicePrice}
                onChange={e => setInvoicePrice(Number(e.target.value))}
                className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                required
                min="1"
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={() => setIsInvoiceModalOpen(false)} className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50">
                {isSubmitting ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
