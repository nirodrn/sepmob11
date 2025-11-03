import React from 'react';
import { useFirebaseData, useFirebaseActions } from '../../../hooks/useFirebaseData';
import { useAuth } from '../../../context/AuthContext';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';

interface RequestItem {
  productName: string;
  quantity: number;
  location: string;
  urgent: boolean;
}

interface Request {
  id: string;
  customId: string;
  requestedAt: string;
  requestedBy: string;
  requestedByName: string;
  status: 'pending' | 'approved' | 'rejected';
  items: RequestItem[];
  notes: string;
}

export function DSRequestApproval() {
  const { userData } = useAuth();
  const { data: requests, loading, error } = useFirebaseData<Record<string, Request>>('dsreqs');
  const { updateData } = useFirebaseActions('dsreqs');

  const handleUpdateRequest = async (id: string, status: 'approved' | 'rejected') => {
    if (!userData) return;
    try {
      await updateData(id, {
        status: status,
        approvedBy: userData.id,
        approvedByName: userData.name,
        approvedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to update request", e);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load requests." />;

  const pendingRequests = requests
    ? Object.entries(requests)
        .map(([id, r]) => ({ ...r, id }))
        .filter(r => r.status === 'pending')
    : [];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-medium text-gray-900 p-4 border-b border-gray-200">Approve New Requests</h3>
      {pendingRequests.length === 0 ? (
        <p className="text-gray-600 p-4">No pending requests.</p>
      ) : (
        <div className="divide-y divide-gray-200">
          {pendingRequests.map((request) => (
            <div key={request.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                  <div>
                      <p className="text-sm text-gray-500">Request ID: <span className="font-medium text-gray-800">{request.customId}</span></p>
                      <p className="text-sm text-gray-500">Requested By: <span className="font-medium text-gray-800">{request.requestedByName}</span></p>
                      <p className="text-sm text-gray-500">On: {new Date(request.requestedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => handleUpdateRequest(request.id, 'approved')} className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600">Approve</button>
                    <button onClick={() => handleUpdateRequest(request.id, 'rejected')} className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600">Reject</button>
                  </div>
              </div>
              
              <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
                  {request.items.map((item, index) => (
                      <li key={index}>
                          <span className="font-semibold">{item.productName}</span> (Qty: {item.quantity}) - Location: {item.location}
                          {item.urgent && <span className='text-red-600 font-bold ml-2'>Urgent</span>}
                      </li>
                  ))}
              </ul>
              {request.notes && <p className="mt-2 text-xs text-gray-500 italic">Notes: {request.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
