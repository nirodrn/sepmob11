import React, { useState } from 'react';
import { DistributorRepInvoiceRelease } from '../../components/Distributor/Representative/DistributorRepInvoiceRelease';
import { DistributorRepInvoiceHistory } from '../../components/Distributor/Representative/DistributorRepInvoiceHistory';
import { FileText, History } from 'lucide-react';

type Tab = 'create' | 'history';

export default function DistributorRepInvoicesMain() {
  const [activeTab, setActiveTab] = useState<Tab>('create');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'create'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <FileText className="w-5 h-5" />
              Create Invoice
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <History className="w-5 h-5" />
              Invoice History
            </button>
          </div>
        </div>
      </div>

      <div>
        {activeTab === 'create' && <DistributorRepInvoiceRelease />}
        {activeTab === 'history' && <DistributorRepInvoiceHistory />}
      </div>
    </div>
  );
}
