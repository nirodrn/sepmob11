import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../../Common/Modal';
import { DollarSign, Package, Calendar, TriangleAlert as AlertTriangle } from 'lucide-react';
import { ref, get } from 'firebase/database';
import { database } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';

interface StockEntry {
  id: string;
  productId: string;
  productName: string;
  availableQuantity: number;
  claimedAt: string;
  requestId: string;
}

interface DispatchItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  finalPrice: number;
  selectedEntries: { entryId: string; quantity: number; claimedAt: string }[];
}

interface DistributorDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestItems: Record<string, { productId: string; productName: string; quantity: number }>;
  onConfirm: (items: DispatchItem[]) => Promise<void>;
}

export function DistributorDispatchModal({
  isOpen,
  onClose,
  requestItems,
  onConfirm
}: DistributorDispatchModalProps) {
  console.log('DistributorDispatchModal render - isOpen:', isOpen, 'requestItems:', requestItems);
  const { userData } = useAuth();
  const [items, setItems] = useState<DispatchItem[]>(() =>
    Object.values(requestItems).map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: 0,
      discountPercent: 0,
      finalPrice: 0,
      selectedEntries: []
    }))
  );
  const [stockEntries, setStockEntries] = useState<Record<string, StockEntry[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadingStock, setLoadingStock] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [showAllProducts, setShowAllProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && userData?.id) {
      loadStockEntries();
    }
  }, [isOpen, userData]);

  const extractProductName = (productId: string): string => {
    const parts = productId.split('_');
    return parts.slice(1, -1).join(' ');
  };

  const findSimilarProducts = (productName: string, exactMatches: StockEntry[]): StockEntry[] => {
    const searchTerm = productName.trim().toLowerCase();
    const mainWords = searchTerm.split(/\s+/).filter(word =>
      word.length > 1 && !word.match(/^(q\d+|-|_)$/)
    );
    const allEntries = Object.values(stockEntries).flat();

    return allEntries.filter(entry => {
      if (!entry || !entry.productName) return false;
      const entryName = entry.productName.trim().toLowerCase();
      const hasQty = (Number(entry.availableQuantity) || 0) > 0;
      const isExactMatch = entryName === searchTerm;
      const isInExactMatches = exactMatches.some(e => e.id === entry.id);

      if (isExactMatch || isInExactMatches) return false;

      const containsSomeMainWords = mainWords.length > 0 &&
        mainWords.some(word => entryName.includes(word));

      return containsSomeMainWords && hasQty;
    });
  };

  const loadStockEntries = async () => {
    if (!userData?.id) return;

    setLoadingStock(true);
    try {
      console.log('Loading stock for user:', userData.id, 'Role:', userData.role);
      const entriesRef = ref(database, `distributorStock/users/${userData.id}/entries`);
      const snapshot = await get(entriesRef);

      const groupedByProduct: Record<string, StockEntry[]> = {};

      if (snapshot.exists()) {
        const allEntries = snapshot.val();
        console.log('Found entries in distributorStock:', Object.keys(allEntries).length);

        Object.entries(allEntries).forEach(([entryId, entry]: [string, any]) => {
          if (entry.availableQuantity > 0 && entry.status === 'available') {
            const productId = entry.productId;
            if (!groupedByProduct[productId]) {
              groupedByProduct[productId] = [];
            }
            groupedByProduct[productId].push({
              id: entryId,
              productId: entry.productId,
              productName: entry.productName,
              availableQuantity: entry.availableQuantity,
              claimedAt: entry.receivedAt || entry.claimedAt || entry.lastUpdated || new Date().toISOString(),
              requestId: entry.requestId
            });
          }
        });
      }

      const oldInventoryRef = ref(database, 'distributorInventory');
      const oldInventorySnapshot = await get(oldInventoryRef);

      if (oldInventorySnapshot.exists()) {
        const oldInventory = oldInventorySnapshot.val();
        console.log('Checking old distributorInventory:', Object.keys(oldInventory).length, 'entries');

        Object.entries(oldInventory).forEach(([key, item]: [string, any]) => {
          if (item.stock > 0 && item.userId === userData.id) {
            const productId = item.productId || `legacy_${item.productName}`;

            if (!groupedByProduct[productId]) {
              groupedByProduct[productId] = [];
            }

            groupedByProduct[productId].push({
              id: `legacy_${key}`,
              productId: productId,
              productName: item.productName,
              availableQuantity: item.stock,
              claimedAt: item.lastUpdated || new Date().toISOString(),
              requestId: 'legacy_inventory'
            });
          }
        });
      }

      Object.keys(groupedByProduct).forEach(productId => {
        groupedByProduct[productId].sort((a, b) =>
          new Date(a.claimedAt).getTime() - new Date(b.claimedAt).getTime()
        );
      });

      console.log('Final grouped products:', Object.keys(groupedByProduct));
      Object.entries(groupedByProduct).forEach(([pid, entries]) => {
        console.log(`Product ${pid}:`, entries.length, 'entries, total available:',
          entries.reduce((sum, e) => sum + e.availableQuantity, 0));
      });

      setStockEntries(groupedByProduct);
    } catch (error) {
      console.error('Error loading stock entries:', error);
    } finally {
      setLoadingStock(false);
    }
  };

  const updateItem = (index: number, field: keyof DispatchItem, value: number) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    if (field === 'unitPrice' || field === 'discountPercent') {
      const unitPrice = field === 'unitPrice' ? value : updatedItems[index].unitPrice;
      const discountPercent = field === 'discountPercent' ? value : updatedItems[index].discountPercent;
      updatedItems[index].finalPrice = unitPrice * (1 - discountPercent / 100);
    }

    setItems(updatedItems);
  };

  const toggleEntrySelection = (itemIndex: number, entry: StockEntry, quantity: number) => {
    const updatedItems = [...items];
    const item = updatedItems[itemIndex];
    const existingIndex = item.selectedEntries.findIndex(e => e.entryId === entry.id);

    if (existingIndex >= 0) {
      item.selectedEntries.splice(existingIndex, 1);
    } else {
      const maxQty = Math.min(quantity, entry.availableQuantity);
      item.selectedEntries.push({
        entryId: entry.id,
        quantity: maxQty,
        claimedAt: entry.claimedAt
      });
    }

    setItems(updatedItems);
  };

  const updateEntryQuantity = (itemIndex: number, entryId: string, quantity: number) => {
    const updatedItems = [...items];
    const item = updatedItems[itemIndex];
    const entry = item.selectedEntries.find(e => e.entryId === entryId);

    if (entry) {
      const stockEntry = stockEntries[item.productId]?.find(e => e.id === entryId);
      if (stockEntry) {
        entry.quantity = Math.min(quantity, stockEntry.availableQuantity);
      }
    }

    setItems(updatedItems);
  };

  const getSelectedQuantityForItem = (itemIndex: number): number => {
    return items[itemIndex].selectedEntries.reduce((sum, e) => sum + e.quantity, 0);
  };

  const totalValue = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const allPriced = items.every(item => item.unitPrice > 0);
    if (!allPriced) {
      alert('Please set unit price for all items');
      return;
    }

    const allSelected = items.every((item, index) => {
      const selectedQty = getSelectedQuantityForItem(index);
      return selectedQty === item.quantity;
    });

    if (!allSelected) {
      alert('Please select stock entries that match the requested quantities for all items');
      return;
    }

    setLoading(true);
    try {
      console.log('Confirming dispatch with items:', items);
      await onConfirm(items);
      onClose();
    } catch (error: any) {
      console.error('Error dispatching:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error';
      alert(`Failed to dispatch: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dispatch with Pricing" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
          <p className="font-medium text-blue-900 mb-1">Set pricing and select stock batches</p>
          <p>Select which stock entries to use for each product, then set pricing details.</p>
        </div>

        {loadingStock ? (
          <div className="text-center py-8 text-gray-500">Loading available stock...</div>
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => {
              let availableEntries: StockEntry[] = [];
              const allEntries = Object.values(stockEntries).flat();

              // Extract product name from ID if ID looks like "m_productname_timestamp"
              const productNameFromId = item.productId.includes('_') ? extractProductName(item.productId) : '';

              // Step 1: Try exact match by product name (case insensitive)
              const normalizedRequestName = item.productName.trim().toLowerCase().replace(/\s+/g, ' ');
              availableEntries = allEntries.filter(e =>
                e.productName && e.productName.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedRequestName
              );

              // Step 2: If no match and we extracted a name from ID, try that
              if (availableEntries.length === 0 && productNameFromId) {
                const normalizedIdName = productNameFromId.trim().toLowerCase().replace(/\s+/g, ' ');
                availableEntries = allEntries.filter(e =>
                  e.productName && e.productName.trim().toLowerCase().replace(/\s+/g, ' ') === normalizedIdName
                );
                console.log(`Trying product name from ID: "${productNameFromId}", found: ${availableEntries.length}`);
              }

              // Step 3: Try matching by productId
              if (availableEntries.length === 0) {
                availableEntries = allEntries.filter(e => e.productId === item.productId);
              }

              // Step 4: Try with legacy prefix
              if (availableEntries.length === 0) {
                const legacyKey = `legacy_${item.productName}`;
                availableEntries = allEntries.filter(e => e.productId === legacyKey);
              }

              console.log(`Search for "${item.productName}" (ID: ${item.productId}):`, availableEntries.length, 'exact matches found');

              const selectedQty = getSelectedQuantityForItem(index);
              const isExpanded = expandedProduct === item.productId;
              const isComplete = selectedQty === item.quantity;
              const showingAllProducts = showAllProducts.has(item.productId);

              const similarProducts = findSimilarProducts(item.productName, availableEntries);
              const allAvailableEntries = Object.values(stockEntries).flat();
              const otherProducts = allAvailableEntries.filter(entry => {
                if (!entry || !entry.productName) return false;
                const hasQty = (Number(entry.availableQuantity) || 0) > 0;
                const isNotInExactMatches = !availableEntries.some(e => e.id === entry.id);
                const isNotInSimilar = !similarProducts.some(s => s.id === entry.id);
                return isNotInExactMatches && isNotInSimilar && hasQty;
              });

              return (
                <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
                  <Package className="w-4 h-4 text-gray-500" />
                  <h4 className="font-medium text-gray-900">{item.productName}</h4>
                  <span className="ml-auto text-sm text-gray-600">Need: {item.quantity}</span>
                  <span className={`ml-2 text-sm font-medium ${
                    isComplete ? 'text-green-600' : selectedQty > item.quantity ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    Selected: {selectedQty}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="bg-gray-100 border border-gray-300 p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-semibold text-gray-900">
                        {availableEntries.length > 0
                          ? `Select Stock Batches (${availableEntries.length} available)`
                          : 'No Exact Match Found'
                        }
                      </h5>
                      <button
                        type="button"
                        onClick={() => setExpandedProduct(isExpanded ? null : item.productId)}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        {isExpanded ? '▼ Hide' : '▶ Show'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="space-y-2">
                        {availableEntries.length === 0 ? (
                          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium mb-1">No exact match found for "{item.productName}"</p>
                              <p className="text-xs">Consider using an alternative product from the suggestions below.</p>
                            </div>
                          </div>
                        ) : (
                          availableEntries.map((entry) => {
                            const isSelected = item.selectedEntries.some(e => e.entryId === entry.id);
                            const selectedEntry = item.selectedEntries.find(e => e.entryId === entry.id);
                            const remainingNeeded = item.quantity - selectedQty;

                            return (
                              <div
                                key={entry.id}
                                className={`p-3 rounded border ${
                                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleEntrySelection(index, entry, remainingNeeded)}
                                        className="rounded border-gray-300"
                                      />
                                      <Calendar className="w-3 h-3 text-gray-500" />
                                      <span className="text-xs text-gray-600">
                                        {new Date(entry.claimedAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 ml-5">
                                      ID: {entry.id.slice(-8)}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900">
                                      Available: {entry.availableQuantity}
                                    </p>
                                    {isSelected && selectedEntry && (
                                      <input
                                        type="number"
                                        min="1"
                                        max={entry.availableQuantity}
                                        value={selectedEntry.quantity}
                                        onChange={(e) => updateEntryQuantity(index, entry.id, parseInt(e.target.value) || 0)}
                                        className="mt-1 w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {isExpanded && similarProducts.length > 0 && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-4 h-4 text-blue-600" />
                        <p className="text-xs font-semibold text-blue-900">Alternative Products Available in Your Inventory:</p>
                      </div>
                      <p className="text-xs text-blue-700 mb-2 italic">
                        Note: These alternatives contain similar keywords. You may coordinate with the requester to use these products instead.
                      </p>
                      <div className="space-y-2">
                        {similarProducts.map((entry) => {
                          const isSelected = item.selectedEntries.some(e => e.entryId === entry.id);
                          const selectedEntry = item.selectedEntries.find(e => e.entryId === entry.id);
                          const remainingNeeded = item.quantity - selectedQty;

                          return (
                            <div
                              key={entry.id}
                              className={`p-3 rounded border ${
                                isSelected ? 'border-blue-500 bg-blue-100' : 'border-blue-300 bg-white'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleEntrySelection(index, entry, remainingNeeded)}
                                      className="rounded border-gray-300"
                                    />
                                    <span className="text-sm font-medium text-gray-900">{entry.productName}</span>
                                  </div>
                                  <div className="flex items-center gap-2 ml-5">
                                    <Calendar className="w-3 h-3 text-gray-500" />
                                    <span className="text-xs text-gray-600">
                                      {new Date(entry.claimedAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 ml-5 mt-1">
                                    ID: {entry.id.slice(-8)}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium text-gray-900">
                                    Available: {entry.availableQuantity}
                                  </p>
                                  {isSelected && selectedEntry && (
                                    <input
                                      type="number"
                                      min="1"
                                      max={entry.availableQuantity}
                                      value={selectedEntry.quantity}
                                      onChange={(e) => updateEntryQuantity(index, entry.id, parseInt(e.target.value) || 0)}
                                      className="mt-1 w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Unit Price (Rs.)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice || ''}
                        onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Discount (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={item.discountPercent || ''}
                      onChange={(e) => updateItem(index, 'discountPercent', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Final Price (Rs.)
                    </label>
                    <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-md text-sm font-semibold text-green-800">
                      {item.finalPrice.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Total Value:</span>
                    <span className="font-semibold text-gray-900">
                      Rs. {(item.finalPrice * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>

                {otherProducts.length > 0 && (
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-300 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-800">Browse All Other Products ({otherProducts.length})</p>
                      <button
                        type="button"
                        onClick={() => {
                          const newSet = new Set(showAllProducts);
                          if (newSet.has(item.productId)) {
                            newSet.delete(item.productId);
                          } else {
                            newSet.add(item.productId);
                          }
                          setShowAllProducts(newSet);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        {showingAllProducts ? '▼ Hide' : '▶ Show'}
                      </button>
                    </div>
                    {showingAllProducts && (
                      <div className="space-y-2">
                        {(() => {
                          const productSummary = otherProducts.reduce((acc, entry) => {
                            const key = entry.productName;
                            if (!acc[key]) {
                              acc[key] = { name: entry.productName, totalQty: 0, entries: [] };
                            }
                            acc[key].totalQty += Number(entry.availableQuantity) || 0;
                            acc[key].entries.push(entry);
                            return acc;
                          }, {} as Record<string, { name: string; totalQty: number; entries: StockEntry[] }>);

                          return Object.values(productSummary).map((product, idx) => (
                            <div key={idx} className="bg-white p-2 rounded border border-gray-300">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{product.name}</p>
                                  <p className="text-xs text-gray-600">Available: {product.totalQty} units ({product.entries.length} batch{product.entries.length > 1 ? 'es' : ''})</p>
                                </div>
                                <Package className="w-4 h-4 text-gray-600" />
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                    <p className="text-xs text-gray-600 mt-2 italic">These are all other products in your inventory.</p>
                  </div>
                )}
              </div>
            );})}
          </div>
        )}

        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium text-gray-900">Grand Total:</span>
            <span className="text-xl font-bold text-blue-600">
              Rs. {totalValue.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              'Dispatching...'
            ) : (
              <>
                <Package size={18} />
                Dispatch Order
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
