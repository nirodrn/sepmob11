import React, { useState } from 'react';
import { DistributorRepNewRequest } from '../../components/Distributor/DistributorRepNewRequest';
import { DistributorRepRequestHistory } from '../../components/Distributor/DistributorRepRequestHistory';
import { Plus } from 'lucide-react';

export function DistributorRepProductRequests() {
  const [showNewRequest, setShowNewRequest] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Requests</h1>
          <p className="text-gray-600 mt-1">Request products from your distributor.</p>
        </div>
        <button
          onClick={() => setShowNewRequest(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          New Request
        </button>
      </div>

      <DistributorRepRequestHistory />

      {showNewRequest && (
        <DistributorRepNewRequest
          isOpen={showNewRequest}
          onClose={() => setShowNewRequest(false)}
          onSuccess={() => {
            setShowNewRequest(false);
            // Optionally, you can add a toast notification here
          }}
        />
      )}
    </div>
  );
}