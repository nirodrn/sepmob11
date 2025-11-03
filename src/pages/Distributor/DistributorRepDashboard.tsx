import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardCards, getDashboardCards } from '../../components/Dashboard/DashboardCards';
import { RecentActivity } from '../../components/Dashboard/RecentActivity';
import { RepRequestForm } from '../../components/Distributor/Representative/RepRequestForm';
import { useAuth } from '../../context/AuthContext';
import { useFirebaseData } from '../../hooks/useFirebaseData';
import { Plus, FileText, TrendingUp, Package, Building2, CircleAlert as AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../../components/Common/LoadingSpinner';

export function DistributorRepDashboard() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [showNewRequest, setShowNewRequest] = useState(false);

  const { data: usersData, loading: usersLoading } = useFirebaseData('users');

  const distributorInfo = usersData && userData?.distributorId
    ? usersData[userData.distributorId]
    : null;

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
          Submit requests to your distributor and track sales
        </p>
      </div>

      {/* Assigned Distributor Info */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Your Assigned Distributor</h3>
            {usersLoading ? (
              <LoadingSpinner text="Loading distributor info..." />
            ) : !userData.distributorId ? (
              <div className="flex items-center gap-2 text-amber-700">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm">No distributor assigned. Please contact administrator.</p>
              </div>
            ) : distributorInfo ? (
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-2xl font-bold text-blue-900">{distributorInfo.name}</span>
                  <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">Distributor</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                    <p className="text-sm font-medium text-gray-900">{distributorInfo.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Department</p>
                    <p className="text-sm font-medium text-gray-900">{distributorInfo.department}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm">Distributor not found (ID: {userData.distributorId})</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <DashboardCards cards={cards} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivity activities={[]} />
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Representative Actions</h3>
          
          <div className="space-y-3">
            <button
              onClick={() => setShowNewRequest(true)}
              className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-4"
            >
              <Plus className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-900">Request Products</p>
                <p className="text-sm text-blue-700">Submit request to distributor</p>
              </div>
            </button>
            
            <button
              onClick={() => navigate('/distributor-rep/requests/history')}
              className="w-full text-left p-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors flex items-center gap-4"
            >
              <FileText className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-green-900">Request History</p>
                <p className="text-sm text-green-700">View all requests</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/distributor-rep/claim')}
              className="w-full text-left p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors flex items-center gap-4"
            >
              <Package className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-900">Claim Stock</p>
                <p className="text-sm text-amber-700">Claim dispatched items</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/distributor-rep/inventory')}
              className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-4"
            >
              <TrendingUp className="w-5 h-5 text-purple-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-purple-900">My Inventory</p>
                <p className="text-sm text-purple-700">View stock levels</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/distributor-rep/invoices/new')}
              className="w-full text-left p-3 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors flex items-center gap-4"
            >
              <FileText className="w-5 h-5 text-teal-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-teal-900">Generate Invoice</p>
                <p className="text-sm text-teal-700">Create customer invoice</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/distributor-rep/invoices')}
              className="w-full text-left p-3 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg transition-colors flex items-center gap-4"
            >
              <FileText className="w-5 h-5 text-cyan-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-cyan-900">My Invoices</p>
                <p className="text-sm text-cyan-700">View invoice history</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      <RepRequestForm
        isOpen={showNewRequest}
        onClose={() => setShowNewRequest(false)}
        onSuccess={handleRequestSuccess}
      />
    </div>
  );
}
