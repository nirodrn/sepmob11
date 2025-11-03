import React, { useState } from 'react';
import { FileText, History, ArrowLeft } from 'lucide-react';
import { DistributorManagerInvoiceGeneratorEnhanced } from '../../components/Distributor/Manager/DistributorManagerInvoiceGeneratorEnhanced';
import { DistributorInvoiceHistory } from '../../components/Distributor/Manager/DistributorInvoiceHistory';
import { useNavigate } from 'react-router-dom';

type TabType = 'create' | 'history';

export default function DistributorInvoicesMain() {
  const [activeTab, setActiveTab] = useState<TabType>('create');
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Distributor Invoices</h1>
          <p className="text-gray-600 mt-1">Manage invoices for customers and representatives</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('create')}
              className={`group inline-flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm ${
                activeTab === 'create'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="w-5 h-5" />
              Create Invoice
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`group inline-flex items-center gap-2 px-6 py-4 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <History className="w-5 h-5" />
              Invoice History
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'create' && <DistributorManagerInvoiceGeneratorEnhanced />}
          {activeTab === 'history' && <DistributorInvoiceHistory />}
        </div>
      </div>
    </div>
  );
}
