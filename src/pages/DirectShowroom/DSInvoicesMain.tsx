import React, { useState } from 'react';
import { FileText, History } from 'lucide-react';
import { DSManagerInvoiceGenerator } from '../../components/DirectShowroom/DSManager/DSManagerInvoiceGenerator';
import DSInvoiceHistory from './DSInvoiceHistory';

export default function DSInvoicesMain() {
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 bg-white rounded-t-lg shadow-sm">
        <div className="flex gap-2 px-6 pt-4">
          <button
            onClick={() => setActiveTab('generate')}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'generate'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <FileText className="w-5 h-5" />
            Generate Invoice
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
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

      <div>
        {activeTab === 'generate' && <DSManagerInvoiceGenerator />}
        {activeTab === 'history' && <DSInvoiceHistory />}
      </div>
    </div>
  );
}
