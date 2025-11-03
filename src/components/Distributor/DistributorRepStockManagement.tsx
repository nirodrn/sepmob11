import React, { useState, useMemo, useEffect } from 'react';
import { useFirebaseData } from '../../hooks/useFirebaseData';
import { useDistributorRepStockOperations } from '../../hooks/useDistributorRepStockOperations';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { ErrorMessage } from '../Common/ErrorMessage';
import { Badge } from '../Common/Badge';
import { Package, Search } from 'lucide-react';

interface DistributorRepStockItem {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  productId: string;
  productName: string;
  quantity: number;
  availableQuantity: number;
  usedQuantity: number;
  claimedAt: string;
  requestId: string;
  status: string;
  source: string;
  location: string;
  lastUpdated: string;
}

interface DistributorRepStockSummary {
  productId: string;
  productName: string;
  totalQuantity: number;
  availableQuantity: number;
  usedQuantity: number;
  entryCount: number;
  firstClaimedAt: string;
  lastUpdated: string;
}

export function DistributorRepStockManagement() {
  const { userData } = useAuth();
  const { data: disrepStockData, loading: disrepStockLoading } = useFirebaseData<any>('disrepstock');
  const { getUserStockSummary, getUserStockEntries } = useDistributorRepStockOperations();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'entries'>('summary');
  const [stockSummary, setStockSummary] = useState<DistributorRepStockSummary[]>([]);
  const [stockEntries, setStockEntries] = useState<DistributorRepStockItem[]>([]);

  // Load stock data using the hook
  useEffect(() => {
    if (userData) {
      loadStockData();
    }
  }, [userData]);

  const loadStockData = async () => {
    if (!userData) return;
    
    try {
      const [summary, entries] = await Promise.all([
        getUserStockSummary(userData.id),
        getUserStockEntries(userData.id)
      ]);
      
      setStockSummary(summary);
      setStockEntries(entries);
    } catch (err) {
      console.error('Error loading stock data:', err);
    }
  };

  // Get distributor rep stock items for current user from new structure
  const distributorRepStockItems = useMemo(() => {
    if (!disrepStockData || !userData) return stockEntries;
    
    const userStockData = disrepStockData.users?.[userData.id]?.entries;
    if (!userStockData) return stockEntries;
    
    return Object.entries(userStockData).map(([id, item]) => ({ id, ...(item as DistributorRepStockItem) }));
  }, [disrepStockData, userData, stockEntries]);

  // Get distributor rep stock summary for current user
  const distributorRepStockSummary = useMemo(() => {
    if (!disrepStockData || !userData) return stockSummary;
    
    const userSummaryData = disrepStockData.users?.[userData.id]?.summary;
    if (!userSummaryData) return stockSummary;
    
    return Object.entries(userSummaryData).map(([productId, summary]) => ({ 
      productId, 
      ...(summary as DistributorRepStockSummary) 
    }));
  }, [disrepStockData, userData, stockSummary]);

  if (disrepStockLoading) {
    return <LoadingSpinner text="Loading stock data..." />;
  }

  const filteredDistributorRepStock = distributorRepStockItems.filter(item =>
    item.productName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDistributorRepSummary = distributorRepStockSummary.filter(item =>
    item.productName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 py-2 px-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'summary'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Stock Summary ({distributorRepStockSummary.length})
        </button>
        <button
          onClick={() => setActiveTab('entries')}
          className={`flex-1 py-2 px-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'entries'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Stock Entries ({distributorRepStockItems.length})
        </button>
      </div>

      <div className="relative">
        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
        <input
          type="text"
          placeholder={
            activeTab === 'summary' ? "Search stock summary..." : "Search stock entries..."
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Product</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Quantity</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                {activeTab === 'summary' && <th className="text-left py-3 px-4 font-medium text-gray-900">Available</th>}
                {activeTab === 'summary' && <th className="text-left py-3 px-4 font-medium text-gray-900">Used</th>}
                {activeTab === 'summary' && <th className="text-left py-3 px-4 font-medium text-gray-900">Entries</th>}
                {activeTab === 'entries' && <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>}
                {activeTab === 'entries' && <th className="text-left py-3 px-4 font-medium text-gray-900">Source</th>}
                {activeTab === 'entries' && <th className="text-left py-3 px-4 font-medium text-gray-900">Location</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeTab === 'summary' ? (
                filteredDistributorRepSummary.map((item) => (
                  <tr key={item.productId} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        <p className="text-sm text-gray-500">
                          First claimed: {new Date(item.firstClaimedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-gray-900">{item.totalQuantity}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={item.availableQuantity > 0 ? "success" : "warning"}>
                        {item.availableQuantity > 0 ? "Available" : "Depleted"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-green-600">{item.availableQuantity}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-red-600">{item.usedQuantity}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="info">{item.entryCount}</Badge>
                    </td>
                  </tr>
                ))
              ) : (
                filteredDistributorRepStock.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        <p className="text-sm text-gray-500">Entry ID: {item.id}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-semibold text-gray-900">{item.availableQuantity}</span>
                        <span className="text-gray-500">/{item.quantity}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={item.availableQuantity > 0 ? "success" : "warning"}>
                        {item.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(item.claimedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="default">
                        {item.source === 'distributor_representative_request' ? 'Distributor Dispatch' : item.source}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {item.location}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {((activeTab === 'summary' && filteredDistributorRepSummary.length === 0) ||
          (activeTab === 'entries' && filteredDistributorRepStock.length === 0)) && (
          <div className="p-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {activeTab === 'summary' ? 'No stock summary found.' : 'No distributor rep stock items found.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}