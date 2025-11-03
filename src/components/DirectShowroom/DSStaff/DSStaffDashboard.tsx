import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardCards, getDashboardCards } from '../../Dashboard/DashboardCards';
import { DSStockManagement } from '../DSManager/DSStockManagement';
import { DSStaffRequestHistory } from './DSStaffRequestHistory';
import { useAuth } from '../../../context/AuthContext';
import { FileText, Eye } from 'lucide-react';

export function DSStaffDashboard() {
  const { userData } = useAuth();

  if (!userData) return null;

  const cards = getDashboardCards(userData.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {userData.name}
        </h1>
        <p className="text-gray-600 mt-1">
          Assist customers and process sales transactions
        </p>
      </div>

      <DashboardCards cards={cards} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Showroom Stock</h3>
            <DSStockManagement />
          </div>

          <DSStaffRequestHistory />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Staff Actions</h3>

          <div className="space-y-3">
            <Link to="/direct-showroom/invoices" className="w-full text-left p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors block">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">New Invoice</p>
                  <p className="text-sm text-green-700">Generate customer invoice</p>
                </div>
              </div>
            </Link>

            <button className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">View Sales</p>
                  <p className="text-sm text-blue-700">Check today's transactions</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
