import React from 'react';
import { DashboardCards, getDashboardCards } from '../components/Dashboard/DashboardCards';
import { RecentActivity } from '../components/Dashboard/RecentActivity';
import { useAuth } from '../context/AuthContext';

export function Dashboard() {
  const { userData } = useAuth();

  if (!userData) return null;

  const cards = getDashboardCards(userData.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Welcome back, {userData.name}
        </h1>
        <p className="text-gray-600 mt-1">
          Here's what's happening with your sales activities
        </p>
      </div>

      <DashboardCards cards={cards} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivity activities={[]} />
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          
          <div className="space-y-3">
            <button className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-4">
              <div>
                <p className="font-medium text-blue-900">New Product Request</p>
                <p className="text-sm text-blue-700">Submit a new request for products</p>
              </div>
            </button>
            
            <button className="w-full text-left p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors flex items-center gap-4">
              <div>
                <p className="font-medium text-green-900">Generate Invoice</p>
                <p className="text-sm text-green-700">Create invoice for customer</p>
              </div>
            </button>
            
            <button className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-4">
              <div>
                <p className="font-medium text-purple-900">View Sales Report</p>
                <p className="text-sm text-purple-700">Check your sales performance</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}