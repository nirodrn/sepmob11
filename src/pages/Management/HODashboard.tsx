import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardCards, getDashboardCards } from '../../components/Dashboard/DashboardCards';
import { RecentActivity } from '../../components/Dashboard/RecentActivity';
import { useAuth } from '../../context/AuthContext';
import { useFirebaseData } from '../../hooks/useFirebaseData';
import { CheckCircle, XCircle, Clock, Users, TrendingUp, Package, FileCheck } from 'lucide-react';
import { LoadingSpinner } from '../../components/Common/LoadingSpinner';
import { ErrorMessage } from '../../components/Common/ErrorMessage';

export function HODashboard() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const { data: salesRequests, loading, error } = useFirebaseData('salesRequests');
  const [selectedTab, setSelectedTab] = useState('pending');

  if (!userData) return <LoadingSpinner text="Finalizing session..." />;

  const cards = getDashboardCards(userData.role);

  if (loading) return <LoadingSpinner text="Loading dashboard data..." />;
  if (error) return <ErrorMessage message={`Failed to load sales requests: ${error.message || 'Unknown error'}`} />;

  const requestsArray = (salesRequests && typeof salesRequests === 'object')
    ? Object.entries(salesRequests).map(([id, data]) => {
        const requestData = (data && typeof data === 'object') ? data : {};
        return { id, ...requestData };
      })
    : [];

  const pendingRequests = requestsArray.filter(req => req.status === 'pending');
  const approvedRequests = requestsArray.filter(req => req.status === 'approved');
  const rejectedRequests = requestsArray.filter(req => req.status === 'rejected');

  const getCurrentRequests = () => {
    if (selectedTab === 'approved') return approvedRequests;
    if (selectedTab === 'rejected') return rejectedRequests;
    return pendingRequests;
  };

  const renderIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
      default: return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Head of Operations Dashboard</h1>
        <p className="text-gray-600 mt-1">Monitor and approve sales requests across all channels</p>
      </div>
      <DashboardCards cards={cards} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Sales Requests</h2>
              <div className="flex flex-wrap items-center border-b border-gray-200">
                <button onClick={() => setSelectedTab('pending')} className={`px-4 py-2 text-sm font-medium ${selectedTab === 'pending' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Pending ({pendingRequests.length})</button>
                <button onClick={() => setSelectedTab('approved')} className={`px-4 py-2 text-sm font-medium ${selectedTab === 'approved' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Approved ({approvedRequests.length})</button>
                <button onClick={() => setSelectedTab('rejected')} className={`px-4 py-2 text-sm font-medium ${selectedTab === 'rejected' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Rejected ({rejectedRequests.length})</button>
              </div>
            </div>
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {getCurrentRequests().length === 0 ? (
                <div className="p-8 text-center text-gray-500">No {selectedTab} requests found</div>
              ) : (
                getCurrentRequests().map((request) => (
                  <div key={request.id} className="p-4 hover:bg-gray-50 flex flex-col sm:flex-row sm:justify-between sm:items-center">
                    <div className="flex items-center gap-3">
                      {renderIcon(request.status)}
                      <div>
                        <p className="text-sm font-medium text-gray-800">{request.product || 'N/A'}</p>
                        <p className="text-xs text-gray-500">By: {request.requestedByName || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mt-2 sm:mt-0">
                      <span className="font-medium">Qty:</span> {request.quantity || 0}
                    </div>
                  </div>
                ))
              )}
            </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Management Actions</h3>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/ho/product-requests')}
              className="w-full text-left p-3 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg transition-colors flex items-center gap-4"
            >
              <FileCheck className="w-5 h-5 text-cyan-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-cyan-900">Product Requests</p>
                <p className="text-sm text-cyan-700">View and approve requests</p>
              </div>
            </button>
          </div>
        </div>
      </div>
      <RecentActivity activities={[]} />
    </div>
  );
}
