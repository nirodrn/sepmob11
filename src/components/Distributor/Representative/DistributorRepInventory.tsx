import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useDistributorRepStockOperations } from '../../../hooks/useDistributorRepStockOperations';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Badge } from '../../Common/Badge';
import {
  Package,
  TrendingDown,
  Clock,
  MapPin,
  AlertCircle,
  DollarSign,
  Search,
  Filter,
  Grid,
  List,
  ChevronDown,
  Eye,
  Archive,
  Percent
} from 'lucide-react';

type ViewMode = 'grid' | 'list';
type FilterStatus = 'all' | 'available' | 'low-stock' | 'depleted';

interface StockEntry {
  id: string;
  productId: string;
  productName: string;
  distributorName: string;
  quantity: number;
  availableQuantity: number;
  usedQuantity: number;
  claimedAt: string;
  status: 'available' | 'depleted' | 'reserved';
  location: string;
  unitPrice?: number;
  discountPercent?: number;
  finalPrice?: number;
  totalValue?: number;
  notes?: string;
}

interface StockSummary {
  productId: string;
  productName: string;
  totalQuantity: number;
  availableQuantity: number;
  usedQuantity: number;
  entryCount: number;
  lastUpdated: string;
}

export function DistributorRepInventory() {
  const { userData } = useAuth();
  const { getUserStockSummary, getUserStockEntries, loading, error } = useDistributorRepStockOperations();
  const [stockSummary, setStockSummary] = useState<StockSummary[]>([]);
  const [allStockEntries, setAllStockEntries] = useState<StockEntry[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (userData?.id) {
      loadInventoryData();
    }
  }, [userData]);

  const loadInventoryData = async () => {
    if (!userData?.id) return;
    try {
      const [summary, entries] = await Promise.all([
        getUserStockSummary(userData.id),
        getUserStockEntries(userData.id)
      ]);
      setStockSummary(summary);
      setAllStockEntries(entries);
    } catch (err) {
      console.error('Error loading inventory:', err);
    }
  };

  const filteredSummary = useMemo(() => {
    let filtered = stockSummary;

    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.productName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => {
        if (filterStatus === 'available') return item.availableQuantity > 0;
        if (filterStatus === 'depleted') return item.availableQuantity === 0;
        if (filterStatus === 'low-stock')
          return item.availableQuantity > 0 && item.availableQuantity < item.totalQuantity * 0.2;
        return true;
      });
    }

    return filtered;
  }, [stockSummary, searchQuery, filterStatus]);

  const selectedProductEntries = useMemo(() => {
    if (!selectedProduct) return [];
    return allStockEntries.filter(entry => entry.productId === selectedProduct);
  }, [allStockEntries, selectedProduct]);

  const getStockStatus = (item: StockSummary): { label: string; variant: 'success' | 'warning' | 'error' | 'default' } => {
    if (item.availableQuantity === 0) return { label: 'Depleted', variant: 'error' };
    if (item.availableQuantity < item.totalQuantity * 0.2) return { label: 'Low Stock', variant: 'warning' };
    return { label: 'In Stock', variant: 'success' };
  };

  const stats = useMemo(() => ({
    totalProducts: stockSummary.length,
    totalAvailable: stockSummary.reduce((sum, item) => sum + item.availableQuantity, 0),
    totalUsed: stockSummary.reduce((sum, item) => sum + item.usedQuantity, 0),
    lowStockCount: stockSummary.filter(item =>
      item.availableQuantity > 0 && item.availableQuantity < item.totalQuantity * 0.2
    ).length
  }), [stockSummary]);

  if (loading && stockSummary.length === 0) return <LoadingSpinner />;
  if (error) return <ErrorMessage message="Failed to load inventory." />;
  if (!userData) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Inventory</h1>
          <p className="text-gray-600 mt-1">Manage your claimed stock from distributor</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Products</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-lg">
              <Package className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Available Stock</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalAvailable}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 rounded-lg">
              <TrendingDown className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Used Stock</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsed}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-50 rounded-lg">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-gray-900">{stats.lowStockCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>

              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'all'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterStatus('available')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'available'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Available
                </button>
                <button
                  onClick={() => setFilterStatus('low-stock')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'low-stock'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Low Stock
                </button>
                <button
                  onClick={() => setFilterStatus('depleted')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    filterStatus === 'depleted'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Depleted
                </button>
              </div>
            </div>
          )}
        </div>

        {filteredSummary.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || filterStatus !== 'all' ? 'No products found' : 'No Inventory Yet'}
            </h3>
            <p className="text-gray-600">
              {searchQuery || filterStatus !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Claim dispatched stock from your distributor to see it here'}
            </p>
          </div>
        ) : (
          <div className="p-4">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSummary.map((item) => {
                  const status = getStockStatus(item);
                  const usagePercent = item.totalQuantity > 0
                    ? Math.round((item.usedQuantity / item.totalQuantity) * 100)
                    : 0;

                  return (
                    <div
                      key={item.productId}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all cursor-pointer bg-white"
                      onClick={() => setSelectedProduct(selectedProduct === item.productId ? null : item.productId)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate mb-1">{item.productName}</h3>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Available</p>
                            <p className="text-lg font-bold text-green-600">{item.availableQuantity}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Used</p>
                            <p className="text-lg font-bold text-gray-900">{item.usedQuantity}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 mb-1">Total</p>
                            <p className="text-lg font-bold text-gray-900">{item.totalQuantity}</p>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>Usage</span>
                            <span>{usagePercent}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-200">
                          <div className="flex items-center gap-1">
                            <Archive className="w-3 h-3" />
                            <span>{item.entryCount} entries</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(item.lastUpdated).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {selectedProduct === item.productId && (
                        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 max-h-64 overflow-y-auto">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Stock Entries</h4>
                          {selectedProductEntries.map((entry) => (
                            <div key={entry.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-medium text-gray-900">{entry.distributorName}</span>
                                <Badge variant={entry.status === 'available' ? 'success' : 'error'} size="sm">
                                  {entry.status}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                                <div>
                                  <span className="block text-gray-500">Total</span>
                                  <span className="font-semibold text-gray-900">{entry.quantity}</span>
                                </div>
                                <div>
                                  <span className="block text-gray-500">Available</span>
                                  <span className="font-semibold text-green-600">{entry.availableQuantity}</span>
                                </div>
                                <div>
                                  <span className="block text-gray-500">Used</span>
                                  <span className="font-semibold text-gray-900">{entry.usedQuantity}</span>
                                </div>
                              </div>
                              {entry.unitPrice && (
                                <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
                                  <div className="flex items-center gap-1 text-xs">
                                    <DollarSign className="w-3 h-3 text-green-600" />
                                    <span className="text-gray-600">Unit:</span>
                                    <span className="font-semibold text-gray-900">${entry.unitPrice.toFixed(2)}</span>
                                  </div>
                                  {entry.discountPercent && entry.discountPercent > 0 && (
                                    <div className="flex items-center gap-1 text-xs text-amber-600">
                                      <Percent className="w-3 h-3" />
                                      <span className="font-semibold">{entry.discountPercent}% off</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSummary.map((item) => {
                  const status = getStockStatus(item);
                  const usagePercent = item.totalQuantity > 0
                    ? Math.round((item.usedQuantity / item.totalQuantity) * 100)
                    : 0;

                  return (
                    <div key={item.productId} className="border border-gray-200 rounded-lg bg-white">
                      <button
                        onClick={() => setSelectedProduct(selectedProduct === item.productId ? null : item.productId)}
                        className="w-full p-4 hover:bg-gray-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0 p-3 bg-blue-50 rounded-lg">
                            <Package className="w-6 h-6 text-blue-600" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="font-semibold text-gray-900 mb-1">{item.productName}</h3>
                                <Badge variant={status.variant}>{status.label}</Badge>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-600">Last Updated</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {new Date(item.lastUpdated).toLocaleDateString()}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4 mt-3">
                              <div>
                                <p className="text-xs text-gray-600 mb-1">Available</p>
                                <p className="text-xl font-bold text-green-600">{item.availableQuantity}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600 mb-1">Used</p>
                                <p className="text-xl font-bold text-gray-900">{item.usedQuantity}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600 mb-1">Total</p>
                                <p className="text-xl font-bold text-gray-900">{item.totalQuantity}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600 mb-1">Entries</p>
                                <p className="text-xl font-bold text-gray-900">{item.entryCount}</p>
                              </div>
                            </div>

                            <div className="mt-3">
                              <div className="flex justify-between text-xs text-gray-600 mb-1">
                                <span>Usage</span>
                                <span>{usagePercent}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${usagePercent}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <ChevronDown
                            className={`w-5 h-5 text-gray-400 transition-transform ${
                              selectedProduct === item.productId ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {selectedProduct === item.productId && (
                        <div className="px-4 pb-4 border-t border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mt-4 mb-3">Stock Entries</h4>
                          <div className="space-y-3">
                            {selectedProductEntries.map((entry) => (
                              <div key={entry.id} className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <h5 className="font-medium text-gray-900 mb-1">{entry.distributorName}</h5>
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <MapPin className="w-4 h-4" />
                                      <span>{entry.location}</span>
                                    </div>
                                  </div>
                                  <Badge variant={entry.status === 'available' ? 'success' : 'error'}>
                                    {entry.status}
                                  </Badge>
                                </div>

                                <div className="grid grid-cols-4 gap-3 mb-3">
                                  <div>
                                    <p className="text-xs text-gray-600">Total</p>
                                    <p className="text-lg font-semibold text-gray-900">{entry.quantity}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-600">Available</p>
                                    <p className="text-lg font-semibold text-green-600">{entry.availableQuantity}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-600">Used</p>
                                    <p className="text-lg font-semibold text-gray-900">{entry.usedQuantity}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-600">Claimed</p>
                                    <p className="text-sm font-medium text-gray-700">
                                      {new Date(entry.claimedAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>

                                {entry.unitPrice && (
                                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <h6 className="text-xs font-semibold text-green-900 mb-2 flex items-center gap-1">
                                      <DollarSign className="w-4 h-4" />
                                      Pricing Information
                                    </h6>
                                    <div className="grid grid-cols-4 gap-3 text-sm">
                                      <div>
                                        <p className="text-gray-600 text-xs">Unit Price</p>
                                        <p className="font-semibold text-gray-900">${entry.unitPrice.toFixed(2)}</p>
                                      </div>
                                      {entry.discountPercent && entry.discountPercent > 0 && (
                                        <div>
                                          <p className="text-gray-600 text-xs">Discount</p>
                                          <p className="font-semibold text-amber-600">{entry.discountPercent}%</p>
                                        </div>
                                      )}
                                      <div>
                                        <p className="text-gray-600 text-xs">Final Price</p>
                                        <p className="font-semibold text-green-700">${entry.finalPrice?.toFixed(2)}</p>
                                      </div>
                                      <div>
                                        <p className="text-gray-600 text-xs">Total Value</p>
                                        <p className="font-semibold text-green-900">${entry.totalValue?.toFixed(2)}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {entry.notes && (
                                  <div className="mt-3 p-2 bg-white border border-gray-200 rounded text-sm text-gray-700">
                                    <p className="text-xs text-gray-500 mb-1">Notes:</p>
                                    {entry.notes}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
