import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardCards, getDashboardCards } from '../../components/Dashboard/DashboardCards';
import { RecentActivity } from '../../components/Dashboard/RecentActivity';
import { NewProductRequest } from '../../components/DirectRepresentative/NewProductRequest';
import { ApprovedRequestsWithPricing } from '../../components/Common/ApprovedRequestsWithPricing';
import { useAuth } from '../../context/AuthContext';
import { Plus, Users, Package, TrendingUp, Truck } from 'lucide-react';

export function DistributorDashboard() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [showNewRequest, setShowNewRequest] = useState(false);

  if (!userData) return null;

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
          Manage distribution network and representative orders
        </p>
      </div>

      <DashboardCards cards={cards} />

      <ApprovedRequestsWithPricing />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivity activities={[]} />
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Distributor Actions</h3>
          
          <div className="space-y-3">
            <button
              onClick={() => setShowNewRequest(true)}
              className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-4"
            >
              <Plus className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-900">Request Stock</p>
                <p className="text-sm text-blue-700">Request products from HO</p>
              </div>
            </button>
            
            <button
              onClick={() => navigate('/distributor/representatives')}
              className="w-full text-left p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors flex items-center gap-4"
            >
              <Users className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-900">Manage Representatives</p>
                <p className="text-sm text-green-700">View assigned representatives</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/distributor/rep-requests')}
              className="w-full text-left p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors flex items-center gap-4"
            >
              <Package className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-900">Rep Requests</p>
                <p className="text-sm text-amber-700">Approve & dispatch orders</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/distributor/rep-dispatch')}
              className="w-full text-left p-3 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors flex items-center gap-4"
            >
              <Truck className="w-5 h-5 text-teal-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-teal-900">Dispatch with Pricing</p>
                <p className="text-sm text-teal-700">Dispatch approved orders to reps</p>
              </div>
            </button>

            <button className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors flex items-center gap-4">
              <TrendingUp className="w-5 h-5 text-gray-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Network Performance</p>
                <p className="text-sm text-gray-700">View distribution metrics</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      <NewProductRequest
        isOpen={showNewRequest}
        onClose={() => setShowNewRequest(false)}
        onSuccess={handleRequestSuccess}
        databaseTable="distributorReqs"
      />
    </div>
  );
}
