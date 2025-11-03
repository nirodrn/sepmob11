import React, { useState, useMemo, useEffect } from 'react';
import { useFirebaseData } from '../../hooks/useFirebaseData';
import { useAuth } from '../../context/AuthContext';
import { recalculateDistributorStockSummary, fixDistributorStockEntries } from '../../utils/stockSummaryReconciliation';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { ErrorMessage } from '../Common/ErrorMessage';
import { Badge } from '../Common/Badge';
import { Package, Search, RefreshCw } from 'lucide-react';

interface DistributorStockItem {
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

interface DistributorStockSummary {
  productId: string;
  productName: string;
  totalQuantity: number;
  availableQuantity: number;
  usedQuantity: number;
  entryCount: number;
  firstClaimedAt: string;
  lastUpdated: string;
}

export function DistributorStockManagement() {
  const { userData } = useAuth();
  const { data: distributorStockData, loading: distributorStockLoading } = useFirebaseData<any>('distributorStock');
  const { data: disrepStockData, loading: disrepStockLoading } = useFirebaseData<any>('disrepstock');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'entries' | 'representatives'>('summary');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeInventory = async () => {
      if (!userData?.id) return;

      try {
        console.log('[DistributorStockManagement] Fixing entries on page load...');
        await fixDistributorStockEntries(userData.id);
        console.log('[DistributorStockManagement] Entries fixed successfully');
      } catch (error) {
        console.error('[DistributorStockManagement] Error fixing entries:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeInventory();
  }, [userData?.id]);

  const handleRecalculateSummary = async () => {
    if (!userData?.id) return;

    setIsRecalculating(true);
    try {
      await recalculateDistributorStockSummary(userData.id);
      alert('Stock data refreshed successfully!');
      window.location.reload();
    } catch (error) {
      console.error('Error refreshing stock data:', error);
      alert('Failed to refresh stock data. Please try again.');
    } finally {
      setIsRecalculating(false);
    }
  };

  // Get distributor stock items for current user from new structure
  const distributorStockItems = useMemo(() => {
    if (!distributorStockData || !userData) return [];
    
    const userStockData = distributorStockData.users?.[userData.id]?.entries;
    if (!userStockData) return [];
    
    return Object.entries(userStockData).map(([id, item]) => ({ id, ...(item as DistributorStockItem) }));
  }, [distributorStockData, userData]);

  // Get distributor stock summary for current user
  const distributorStockSummary = useMemo(() => {
    if (!distributorStockData || !userData) return [];
    
    const userSummaryData = distributorStockData.users?.[userData.id]?.summary;
    if (!userSummaryData) return [];
    
    return Object.entries(userSummaryData).map(([productId, summary]) => ({ 
      productId, 
      ...(summary as DistributorStockSummary) 
    }));
  }, [distributorStockData, userData]);

  // Get all distributor representatives' stock for current distributor
  const distributorRepStockSummary = useMemo(() => {
    if (!disrepStockData || !userData) return [];
    
    const allRepStock: any[] = [];
    
    // Iterate through all users in disrepstock
    Object.entries(disrepStockData.users || {}).forEach(([userId, userStock]: [string, any]) => {
      if (userStock.summary) {
        Object.entries(userStock.summary).forEach(([productId, summary]: [string, any]) => {
          // Check if this rep belongs to current distributor
          const entries = userStock.entries || {};
          const firstEntry = Object.values(entries)[0] as any;
          
          if (firstEntry && firstEntry.distributorId === userData.id) {
            allRepStock.push({
              userId,
              userName: firstEntry.userName,
              productId,
              productName: summary.productName,
              totalQuantity: summary.totalQuantity,
              availableQuantity: summary.availableQuantity,
              usedQuantity: summary.usedQuantity,
              entryCount: summary.entryCount,
              lastUpdated: summary.lastUpdated
            });
          }
        });
      }
    });
    
    return allRepStock;
  }, [disrepStockData, userData]);

  if (distributorStockLoading || disrepStockLoading || isInitializing) {
    return <LoadingSpinner text="Loading stock data..." />;
  }

  const filteredDistributorStock = distributorStockItems.filter(item =>
    item.productName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDistributorSummary = distributorStockSummary.filter(item =>
    item.productName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredRepStock = distributorRepStockSummary.filter(item =>
    item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.userName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex-1"></div>
        <button
          onClick={handleRecalculateSummary}
          disabled={isRecalculating}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          title="Fix all stock entries and recalculate summary"
        >
          <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} />
          {isRecalculating ? 'Refreshing...' : 'Refresh Stock'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 py-2 px-1 text-xs sm:text-sm font-medium rounded-md transition-colors ${
            activeTab === 'summary'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          My Stock ({distributorStockSummary.length})
        </button>
        <button
          onClick={() => setActiveTab('entries')}
          className={`flex-1 py-2 px-1 text-xs sm:text-sm font-medium rounded-md transition-colors ${
            activeTab === 'entries'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          My Entries ({distributorStockItems.length})
        </button>
        <button
          onClick={() => setActiveTab('representatives')}
          className={`flex-1 py-2 px-1 text-xs sm:text-sm font-medium rounded-md transition-colors ${
            activeTab === 'representatives'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Rep Stock ({distributorRepStockSummary.length})
        </button>
      </div>

      <div className="relative">
        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
        <input
          type="text"
          placeholder={
            activeTab === 'summary' ? "Search my stock..." : 
            activeTab === 'entries' ? "Search my entries..." :
            "Search rep stock..."
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
                {activeTab === 'representatives' && <th className="text-left py-3 px-4 font-medium text-gray-900">Representative</th>}
                <th className="text-left py-3 px-4 font-medium text-gray-900">Quantity</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                {(activeTab === 'summary' || activeTab === 'representatives') && <th className="text-left py-3 px-4 font-medium text-gray-900">Available</th>}
                {(activeTab === 'summary' || activeTab === 'representatives') && <th className="text-left py-3 px-4 font-medium text-gray-900">Used</th>}
                {(activeTab === 'summary' || activeTab === 'representatives') && <th className="text-left py-3 px-4 font-medium text-gray-900">Entries</th>}
                {activeTab === 'entries' && <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>}
                {activeTab === 'entries' && <th className="text-left py-3 px-4 font-medium text-gray-900">Source</th>}
                {activeTab === 'entries' && <th className="text-left py-3 px-4 font-medium text-gray-900">Location</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeTab === 'representatives' ? (
                filteredRepStock.map((item, index) => (
                  <tr key={`${item.userId}-${item.productId}-${index}`} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        <p className="text-sm text-gray-500">Product ID: {item.productId}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{item.userName}</p>
                        <p className="text-sm text-gray-500">ID: {item.userId}</p>
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
              ) : activeTab === 'summary' ? (
                filteredDistributorSummary.map((item) => (
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
                filteredDistributorStock.map((item) => (
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
                        {item.source === 'distributor_request' ? 'Distributor Request' : item.source}
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
        {((activeTab === 'summary' && filteredDistributorSummary.length === 0) ||
          (activeTab === 'entries' && filteredDistributorStock.length === 0) ||
          (activeTab === 'representatives' && filteredRepStock.length === 0)) && (
          <div className="p-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {activeTab === 'summary' ? 'No stock summary found.' : 
               activeTab === 'entries' ? 'No distributor stock items found.' :
               'No representative stock found.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}