import React, { useState, useMemo, useEffect } from 'react';
import { useFirebaseData } from '../../../hooks/useFirebaseData';
import { useAuth } from '../../../context/AuthContext';
import { recalculateDistributorStockSummary, fixDistributorStockEntries } from '../../../utils/stockSummaryReconciliation';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Badge } from '../../Common/Badge';
import { Package, Search, AlertTriangle, RefreshCw } from 'lucide-react';

interface StockSummary {
  productId: string;
  productName: string;
  totalQuantity: number;
  availableQuantity: number;
  usedQuantity: number;
  totalValue: number;
  averageUnitPrice: number;
  entryCount: number;
  firstReceivedAt: string;
  lastUpdated: string;
}

interface InventoryItem {
  productId: string;
  productName: string;
  totalQuantity: number;
  availableQuantity: number;
  usedQuantity: number;
  totalValue: number;
  averageUnitPrice: number;
  entryCount: number;
  lastUpdated: string;
}

export function DistributorInventoryManagement() {
  const { userData } = useAuth();
  const { data: distributorStockData, loading, error } = useFirebaseData<any>('distributorStock');

  const [searchTerm, setSearchTerm] = useState('');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeInventory = async () => {
      if (!userData?.id) return;

      try {
        console.log('[DistributorInventoryManagement] Fixing entries on page load...');
        await fixDistributorStockEntries(userData.id);
        console.log('[DistributorInventoryManagement] Entries fixed successfully');
      } catch (error) {
        console.error('[DistributorInventoryManagement] Error fixing entries:', error);
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

  const inventoryItems = useMemo(() => {
    if (!distributorStockData || !userData) return [];

    const userSummaryData = distributorStockData.users?.[userData.id]?.summary;
    if (!userSummaryData) return [];

    return Object.entries(userSummaryData)
      .map(([productId, summary]) => ({
        productId,
        ...(summary as StockSummary)
      }))
      .filter(item =>
        item.productName.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.productName.localeCompare(b.productName));
  }, [distributorStockData, userData, searchTerm]);

  const lowStockItems = useMemo(() => {
    return inventoryItems.filter(item => item.availableQuantity <= 10);
  }, [inventoryItems]);

  if (loading || isInitializing) return <LoadingSpinner text="Loading inventory..." />;
  if (error) return <ErrorMessage message="Failed to load inventory." />;
  if (!userData || userData.role !== 'Distributor') {
    return <ErrorMessage message="Access denied. Only distributors can manage inventory." />;
  }

  const getStockStatus = (item: InventoryItem) => {
    const available = item.availableQuantity || 0;
    if (available === 0) return { color: 'red', text: 'Out of Stock' };
    if (available <= 10) return { color: 'yellow', text: 'Low Stock' };
    return { color: 'green', text: 'In Stock' };
  };

  const totalItems = inventoryItems.length;
  const totalStock = inventoryItems.reduce((sum, item) => sum + (item.totalQuantity || 0), 0);
  const totalValue = inventoryItems.reduce((sum, item) => sum + (item.totalValue || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Distributor Inventory</h1>
          <p className="text-gray-600 mt-1">View your claimed stock levels and track inventory</p>
        </div>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Products</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{totalItems}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Stock Units</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{totalStock.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <Package className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Stock Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">${totalValue.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-full bg-amber-100">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Product</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Total Qty</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Available</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Used</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Avg Price</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Total Value</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Entries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {inventoryItems.map((item) => {
                const status = getStockStatus(item);
                return (
                  <tr key={item.productId} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{item.productName}</p>
                      <p className="text-xs text-gray-500">ID: {item.productId}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{(item.totalQuantity || 0).toLocaleString()}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-green-600">{(item.availableQuantity || 0).toLocaleString()}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-red-600">{(item.usedQuantity || 0).toLocaleString()}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-gray-900">${(item.averageUnitPrice || 0).toFixed(2)}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">${(item.totalValue || 0).toLocaleString()}</p>
                    </td>
                    <td className="py-3 px-4">
                      <Badge color={status.color as any}>
                        {status.text}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="info">{item.entryCount}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {inventoryItems.length === 0 && (
          <div className="p-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No stock items found. Claim requests to add inventory.</p>
          </div>
        )}
      </div>
    </div>
  );
}