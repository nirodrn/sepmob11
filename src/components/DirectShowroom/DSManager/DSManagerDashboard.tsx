import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { DashboardCards, getDashboardCards } from '../../Dashboard/DashboardCards';
import { DSStockManagement } from '../DSManager/DSStockManagement';
import { ApprovedRequestsWithPricing } from '../../Common/ApprovedRequestsWithPricing';
import { FileText, PlusCircle, FileCheck } from 'lucide-react';

export function DSManagerDashboard() {
  const { userData } = useAuth();

  if (!userData) return null;

  const cards = getDashboardCards(userData.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {userData.name}</h1>
        <p className="text-gray-600 mt-1">Manage showroom operations and customer sales</p>
      </div>

      <DashboardCards cards={cards} />

      <ApprovedRequestsWithPricing />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Showroom Stock</h3>
          {/* Use the shared component with manager privileges */}
          <DSStockManagement isManager={true} />
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Manager Actions</h3>
          <div className="space-y-3">
             <Link to="requests/history" className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors block">
                <div className="flex items-center gap-3">
                    <FileCheck className="w-5 h-5 text-blue-600" />
                    <div>
                        <p className="font-medium text-blue-900">Product Request History</p>
                        <p className="text-sm text-blue-700">View past requests</p>
                    </div>
                </div>
            </Link>
            <Link to="requests" className="w-full text-left p-3 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors block">
                <div className="flex items-center gap-3">
                    <PlusCircle className="w-5 h-5 text-teal-600" />
                    <div>
                        <p className="font-medium text-teal-900">New Product Request</p>
                        <p className="text-sm text-teal-700">Create a new request</p>
                    </div>
                </div>
            </Link>
            <Link to="invoices" className="w-full text-left p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors block">
                <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-green-600" />
                    <div>
                        <p className="font-medium text-green-900">New Invoice</p>
                        <p className="text-sm text-green-700">Generate customer invoice</p>
                    </div>
                </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
