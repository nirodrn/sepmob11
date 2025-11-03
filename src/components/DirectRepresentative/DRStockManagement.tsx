import React, { useState, useMemo } from 'react';
import { useFirebaseData } from '../../hooks/useFirebaseData';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { Badge } from '../Common/Badge';
import { Package, Search, Merge } from 'lucide-react';
import { consolidateDRStock, formatConsolidationReport } from '../../utils/consolidateDRStock';

interface DRStockSummary {
  productId: string;
  productName: string;
  totalQuantity: number;
  availableQuantity: number;
  usedQuantity: number;
  entryCount: number;
  firstClaimedAt: string;
  lastUpdated: string;
}

export function DRStockManagement() {
  const { userData } = useAuth();
  const { data: drStockData, loading: drStockLoading } = useFirebaseData<any>('drstock');
  const [searchTerm, setSearchTerm] = useState('');
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [consolidationReport, setConsolidationReport] = useState<string>('');
  const [showReport, setShowReport] = useState(false);

  // Get DR stock summary for current user - consolidated by product name
  const drStockSummary = useMemo(() => {
    if (!drStockData || !userData) return [];

    const userEntriesData = drStockData.users?.[userData.id]?.entries;
    if (!userEntriesData) return [];

    // Group by product name instead of product ID
    const consolidatedByName: { [productName: string]: DRStockSummary } = {};

    Object.values(userEntriesData).forEach((entry: any) => {
      const productName = entry.productName;

      if (!consolidatedByName[productName]) {
        consolidatedByName[productName] = {
          productId: entry.productId,
          productName: productName,
          totalQuantity: 0,
          availableQuantity: 0,
          usedQuantity: 0,
          entryCount: 0,
          firstClaimedAt: entry.claimedAt || entry.receivedAt || new Date().toISOString(),
          lastUpdated: entry.lastUpdated || new Date().toISOString()
        };
      }

      consolidatedByName[productName].totalQuantity += entry.quantity || 0;
      consolidatedByName[productName].availableQuantity += entry.availableQuantity || 0;
      consolidatedByName[productName].usedQuantity += entry.usedQuantity || 0;
      consolidatedByName[productName].entryCount += 1;

      // Keep earliest claimedAt
      const entryDate = new Date(entry.claimedAt || entry.receivedAt || 0);
      const currentDate = new Date(consolidatedByName[productName].firstClaimedAt);
      if (entryDate < currentDate) {
        consolidatedByName[productName].firstClaimedAt = entry.claimedAt || entry.receivedAt;
      }

      // Keep latest lastUpdated
      const entryUpdateDate = new Date(entry.lastUpdated || 0);
      const currentUpdateDate = new Date(consolidatedByName[productName].lastUpdated);
      if (entryUpdateDate > currentUpdateDate) {
        consolidatedByName[productName].lastUpdated = entry.lastUpdated;
      }
    });

    return Object.values(consolidatedByName);
  }, [drStockData, userData]);

  if (drStockLoading) {
    return <LoadingSpinner text="Loading stock data..." />;
  }

  const filteredDRSummary = drStockSummary.filter(item =>
    item.productName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConsolidate = async () => {
    if (!window.confirm('This will merge duplicate products in your inventory. Continue?')) {
      return;
    }

    setIsConsolidating(true);
    setConsolidationReport('');
    setShowReport(false);

    try {
      const report = await consolidateDRStock();
      const formattedReport = formatConsolidationReport(report);
      setConsolidationReport(formattedReport);
      setShowReport(true);

      // Reload the page after a short delay to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error: any) {
      alert('Failed to consolidate stock: ' + error.message);
      console.error('Consolidation error:', error);
    } finally {
      setIsConsolidating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Consolidation Report Modal */}
      {showReport && consolidationReport && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-medium text-green-800">Consolidation Complete!</h3>
            <button
              onClick={() => setShowReport(false)}
              className="text-green-600 hover:text-green-800"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-green-700 mb-3">
            Duplicate products have been merged. Page will reload shortly.
          </p>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono overflow-auto max-h-48 bg-white p-3 rounded border border-green-200">
            {consolidationReport}
          </pre>
        </div>
      )}

      {/* Header with consolidate button */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">Consolidated Stock</h2>
          <p className="text-sm text-gray-600">Products grouped with combined quantities</p>
        </div>

        <button
          onClick={handleConsolidate}
          disabled={isConsolidating}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isConsolidating ? (
            <>
              <span className="animate-spin">⟳</span>
              <span className="text-sm">Merging...</span>
            </>
          ) : (
            <>
              <Merge className="w-4 h-4" />
              <span className="text-sm">Merge Duplicates</span>
            </>
          )}
        </button>
      </div>

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

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Product</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Total Stock</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Available</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Used</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Entries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredDRSummary.map((item) => (
                <tr key={item.productName} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-900">{item.productName}</p>
                      <p className="text-sm text-gray-500">
                        First received: {new Date(item.firstClaimedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-lg text-gray-900">{item.totalQuantity}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-green-600">{item.availableQuantity}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-orange-600">{item.usedQuantity}</span>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={item.availableQuantity > 0 ? "success" : "warning"}>
                      {item.availableQuantity > 0 ? "Available" : "Depleted"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="info">{item.entryCount} {item.entryCount === 1 ? 'entry' : 'entries'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredDRSummary.length === 0 && (
          <div className="p-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No stock found. Stock from approved requests will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}