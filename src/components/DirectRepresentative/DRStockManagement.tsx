import React, { useState, useMemo, useEffect } from 'react';
import { useFirebaseData, useFirebaseActions } from '../../hooks/useFirebaseData';
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
  costPrice: number;
  sellingPrice: number;
}

export function DRStockManagement() {
  const { userData } = useAuth();
  const { data: drStockData, loading: drStockLoading } = useFirebaseData<any>('drstock');
  const { updateData } = useFirebaseActions();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [consolidationReport, setConsolidationReport] = useState<string>('');
  const [showReport, setShowReport] = useState(false);
  const [localStock, setLocalStock] = useState<DRStockSummary[]>([]);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  const drStockSummary = useMemo(() => {
    if (!drStockData || !userData) return [];
    const userEntriesData = drStockData.users?.[userData.id]?.entries;
    if (!userEntriesData) return [];

    const consolidatedByName: { [productName: string]: DRStockSummary & { entries: any[] } } = {};

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
          firstClaimedAt: new Date().toISOString(),
          lastUpdated: new Date(0).toISOString(),
          costPrice: entry.unitPrice || 0,
          sellingPrice: entry.finalPrice || entry.unitPrice || 0,
          entries: []
        };
      }
      consolidatedByName[productName].totalQuantity += entry.quantity || 0;
      consolidatedByName[productName].availableQuantity += entry.availableQuantity || 0;
      consolidatedByName[productName].usedQuantity += entry.usedQuantity || 0;
      consolidatedByName[productName].entryCount += 1;
      consolidatedByName[productName].entries.push(entry);

      if (new Date(entry.claimedAt || entry.receivedAt || 0) < new Date(consolidatedByName[productName].firstClaimedAt)) {
        consolidatedByName[productName].firstClaimedAt = entry.claimedAt || entry.receivedAt;
      }
      if (new Date(entry.lastUpdated || 0) > new Date(consolidatedByName[productName].lastUpdated)) {
        consolidatedByName[productName].lastUpdated = entry.lastUpdated;
        consolidatedByName[productName].sellingPrice = entry.finalPrice || entry.unitPrice || 0;
        consolidatedByName[productName].costPrice = entry.unitPrice || 0;
      }
    });

    return Object.values(consolidatedByName).map(({ entries, ...rest }) => rest);
  }, [drStockData, userData]);
  
  useEffect(() => {
    setLocalStock(drStockSummary);
  }, [drStockSummary]);
  
  const handlePriceChange = (productName: string, newPrice: number) => {
    setLocalStock(prev => prev.map(item => item.productName === productName ? { ...item, sellingPrice: newPrice } : item));
  };
  
  const handlePriceUpdate = async (productName: string) => {
    if (!userData || !drStockData) return;
    const product = localStock.find(p => p.productName === productName);
    if (!product) return;

    setIsSaving(productName);
    try {
      const userEntries = drStockData.users?.[userData.id]?.entries;
      if (!userEntries) throw new Error("Stock entries not found");

      const updates: { [path: string]: any } = {};
      Object.entries(userEntries).forEach(([entryId, entry]: [string, any]) => {
        if (entry.productName === productName) {
          updates[`users/${userData.id}/entries/${entryId}/finalPrice`] = product.sellingPrice;
        }
      });
      
      if (Object.keys(updates).length > 0) {
        await updateData('drstock', updates);
      }
    } catch (error) {
      console.error("Failed to update price:", error);
      alert(`Could not update price for ${productName}.`);
      setLocalStock(drStockSummary); // Revert on failure
    } finally {
      setIsSaving(null);
    }
  };

  const handleConsolidate = async () => {
    if (!window.confirm('This will merge duplicate products in your inventory. Continue?')) return;
    setIsConsolidating(true);
    try {
      const report = await consolidateDRStock();
      setConsolidationReport(formatConsolidationReport(report));
      setShowReport(true);
      setTimeout(() => window.location.reload(), 3000);
    } catch (error: any) {
      alert('Failed to consolidate stock: ' + error.message);
    } finally {
      setIsConsolidating(false);
    }
  };
  
  if (drStockLoading) return <LoadingSpinner text="Loading stock data..." />;

  const filteredDRSummary = localStock.filter(item =>
    item.productName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderPriceInput = (item: DRStockSummary) => (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">Rs</span>
      <input 
        type="number"
        value={item.sellingPrice}
        onChange={(e) => handlePriceChange(item.productName, parseFloat(e.target.value) || 0)}
        onBlur={() => handlePriceUpdate(item.productName)}
        className="pl-8 pr-2 py-1 border rounded-md w-32 text-sm"
        disabled={isSaving === item.productName}
      />
      {isSaving === item.productName && <span className="animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-sm">⟳</span>}
    </div>
  );

  return (
    <div className="space-y-4">
      {showReport && consolidationReport && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <h3 className="font-medium text-green-800">Consolidation Complete!</h3>
          <pre className="text-xs text-gray-700 mt-2 whitespace-pre-wrap">{consolidationReport}</pre>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">Consolidated Stock</h2>
          <p className="text-sm text-gray-600">Products grouped with combined quantities and prices.</p>
        </div>
        <button onClick={handleConsolidate} disabled={isConsolidating} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm">
          {isConsolidating ? 'Merging...' : <><Merge className="w-4 h-4" /> Merge Duplicates</>}
        </button>
      </div>

      <div className="relative"><Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="text" placeholder="Search products..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border rounded-lg w-full"/></div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {/* Desktop Table */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium text-gray-600">Product</th>
                <th className="text-center p-3 font-medium text-gray-600">Available</th>
                <th className="text-right p-3 font-medium text-gray-600">Cost Price</th>
                <th className="text-left p-3 font-medium text-gray-600">Selling Price</th>
                <th className="text-center p-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredDRSummary.map((item) => (
                <tr key={item.productName} className="hover:bg-gray-50">
                  <td className="p-3"><p className="font-medium">{item.productName}</p><p className="text-xs text-gray-500">First rcvd: {new Date(item.firstClaimedAt).toLocaleDateString()}</p></td>
                  <td className="p-3 text-center"><span className="font-semibold text-lg text-green-600">{item.availableQuantity}</span></td>
                  <td className="p-3 text-right">Rs {item.costPrice.toFixed(2)}</td>
                  <td className="p-3">{renderPriceInput(item)}</td>
                  <td className="p-3 text-center"><Badge variant={item.availableQuantity > 0 ? "success" : "warning"}>{item.availableQuantity > 0 ? "Available" : "Depleted"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="divide-y border-t md:hidden">
            {filteredDRSummary.map(item => (
                <div key={item.productName} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-gray-800">{item.productName}</p>
                            <p className="text-xs text-gray-500">First rcvd: {new Date(item.firstClaimedAt).toLocaleDateString()}</p>
                        </div>
                        <Badge variant={item.availableQuantity > 0 ? "success" : "warning"}>{item.availableQuantity > 0 ? "Available" : "Depleted"}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm items-center">
                        <div className="space-y-1">
                            <p className="text-gray-500">Available Qty</p>
                            <p className="font-semibold text-lg text-green-600">{item.availableQuantity}</p>
                        </div>
                         <div className="space-y-1">
                            <p className="text-gray-500">Cost Price</p>
                            <p className="font-medium">Rs {item.costPrice.toFixed(2)}</p>
                        </div>
                         <div className="space-y-1 col-span-2">
                            <p className="text-gray-500">Selling Price</p>
                            {renderPriceInput(item)}
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {filteredDRSummary.length === 0 && (
          <div className="p-8 text-center text-gray-500"><Package className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>No stock found.</p></div>
        )}
      </div>
    </div>
  );
}
