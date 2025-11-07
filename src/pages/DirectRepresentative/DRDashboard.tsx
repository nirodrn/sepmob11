import React, { useState } from 'react';
import { DashboardCards, getDashboardCards } from '../../components/Dashboard/DashboardCards';
import { RecentActivity } from '../../components/Dashboard/RecentActivity';
import { NewProductRequest } from '../../components/DirectRepresentative/NewProductRequest';
import { DRInvoiceGenerator } from '../../components/DirectRepresentative/DRInvoiceGenerator';
import { ApprovedRequestsWithPricing } from '../../components/Common/ApprovedRequestsWithPricing';
import { useAuth } from '../../context/AuthContext';
import { Plus, FileText, TrendingUp, ArrowLeft } from 'lucide-react';

export function DRDashboard() {
  const { userData } = useAuth();
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [showInvoiceGenerator, setShowInvoiceGenerator] = useState(false);

  if (!userData) return null;

  // If user clicks "Generate Invoice", show the correct component
  if (showInvoiceGenerator) {
    return (
      <div>
        <button 
          onClick={() => setShowInvoiceGenerator(false)}
          className="mb-4 flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <DRInvoiceGenerator />
      </div>
    );
  }

  const cards = getDashboardCards(userData.role);

  const handleRequestSuccess = () => {
    console.log('Request created successfully');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Welcome back, {userData.name}
        </h1>
        <p className="text-gray-600 mt-1">
          Manage your shop orders and track sales performance
        </p>
      </div>

      <DashboardCards cards={cards} />

      <ApprovedRequestsWithPricing />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivity activities={[]} />
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          
          <div className="space-y-3">
            <button
              onClick={() => setShowNewRequest(true)}
              className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-4"
            >
              <Plus className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-900">New Product Request</p>
                <p className="text-sm text-blue-700">Request products from HO</p>
              </div>
            </button>
            
            <button
              onClick={() => setShowInvoiceGenerator(true)}
              className="w-full text-left p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors flex items-center gap-4"
            >
              <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-900">Generate Invoice</p>
                <p className="text-sm text-green-700">Create invoice for shop</p>
              </div>
            </button>
            
            <button className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-4">
              <TrendingUp className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-purple-900">View Sales Report</p>
                <p className="text-sm text-purple-700">Check performance metrics</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      <NewProductRequest
        isOpen={showNewRequest}
        onClose={() => setShowNewRequest(false)}
        onSuccess={handleRequestSuccess}
      />

      {/* The incorrect InvoiceGenerator has been removed */}
    </div>
  );
}
