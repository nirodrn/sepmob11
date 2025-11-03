import React, { useState, useEffect } from 'react';
import { Modal } from '../../Common/Modal';
import { DollarSign, Percent, Package, Calendar, Hash, TriangleAlert as AlertTriangle } from 'lucide-react';

interface StockEntry {
  id: string;
  productId: string;
  productName: string;
  availableQuantity: number;
  claimedAt: string;
  batchNumber?: string;
  expiryDate?: string;
  status?: string;
}

interface BatchAllocation {
  entryId: string;
  productName: string;
  quantity: number;
  batchNumber?: string;
  claimedAt: string;
}

interface DispatchItem {
  productName: string;
  requestedQuantity: number;
  batchAllocations: BatchAllocation[];
  unitPrice: number;
  discountPercent: number;
  finalPrice: number;
}

interface DisRefPricingDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestItems: Record<string, { name: string; qty: number }>;
  stockEntries: StockEntry[];
  onConfirm: (dispatchItems: DispatchItem[], generateInvoice: boolean) => Promise<void>;
}

export function DisRefPricingDispatchModal({
  isOpen,
  onClose,
  requestItems,
  stockEntries,
  onConfirm
}: DisRefPricingDispatchModalProps) {
  const [dispatchItems, setDispatchItems] = useState<DispatchItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [showAllProducts, setShowAllProducts] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [generateInvoice, setGenerateInvoice] = useState(true);

  const extractProductName = (productId: string): string => {
    const parts = productId.split('_');
    return parts.slice(1, -1).join(' ');
  };

  const findSimilarProducts = (productName: string): StockEntry[] => {
    const searchTerm = productName.trim().toLowerCase();
    const mainWords = searchTerm.split(/\s+/).filter(word =>
      word.length > 1 && !word.match(/^(q\d+|-|_)$/)
    );

    const results = stockEntries.filter(entry => {
      if (!entry || !entry.productName) return false;
      const entryName = entry.productName.trim().toLowerCase();
      const hasQty = (Number(entry.availableQuantity) || 0) > 0;
      const isAvailable = entry.status === 'available' || !entry.status;
      const isExactMatch = entryName === searchTerm;

      if (isExactMatch) return false;

      const containsSomeMainWords = mainWords.length > 0 &&
        mainWords.some(word => entryName.includes(word));

      return containsSomeMainWords && hasQty && isAvailable;
    });

    return results;
  };

  useEffect(() => {
    console.log('=== DisRefPricingDispatchModal Debug ===');
    console.log('Total stock entries received:', stockEntries.length);
    console.log('Request items:', JSON.stringify(requestItems, null, 2));

    const items = Object.entries(requestItems).map(([key, item], index) => {
      console.log(`\nProcessing product: "${item.name}" with key: "${key}"`);

      // Extract product name from key if key looks like "m_productname_timestamp"
      const productNameFromKey = key.includes('_') ? extractProductName(key) : '';

      // Step 1: Try exact match by product name (case insensitive)
      let matchingEntries = stockEntries.filter(entry => {
        if (!entry || !entry.productName) return false;
        const trimmedEntryName = entry.productName.trim().toLowerCase().replace(/\s+/g, ' ');
        const trimmedItemName = item.name.trim().toLowerCase().replace(/\s+/g, ' ');
        const hasQty = (Number(entry.availableQuantity) || 0) > 0;
        const isAvailable = entry.status === 'available' || !entry.status;
        return trimmedEntryName === trimmedItemName && hasQty && isAvailable;
      });

      // Step 2: If no match and we extracted a name from key, try that
      if (matchingEntries.length === 0 && productNameFromKey) {
        console.log(`  Trying product name from key: "${productNameFromKey}"`);
        const normalizedKeyName = productNameFromKey.trim().toLowerCase().replace(/\s+/g, ' ');
        matchingEntries = stockEntries.filter(entry => {
          if (!entry || !entry.productName) return false;
          const trimmedEntryName = entry.productName.trim().toLowerCase().replace(/\s+/g, ' ');
          const hasQty = (Number(entry.availableQuantity) || 0) > 0;
          const isAvailable = entry.status === 'available' || !entry.status;
          return trimmedEntryName === normalizedKeyName && hasQty && isAvailable;
        });
      }

      // Step 3: Try matching by productId from key
      if (matchingEntries.length === 0) {
        matchingEntries = stockEntries.filter(entry => {
          if (!entry) return false;
          const hasQty = (Number(entry.availableQuantity) || 0) > 0;
          const isAvailable = entry.status === 'available' || !entry.status;
          return entry.productId === key && hasQty && isAvailable;
        });
      }

      console.log(`  => Found ${matchingEntries.length} matching entries`);

      return {
        productName: item.name,
        requestedQuantity: item.qty,
        batchAllocations: [],
        unitPrice: 0,
        discountPercent: 0,
        finalPrice: 0
      };
    });
    setDispatchItems(items);

    // Auto-expand all items to show batches by default
    const allIndices = new Set(items.map((_, index) => index));
    setExpandedItems(allIndices);
  }, [requestItems, stockEntries]);

  const calculateFinalPrice = (unitPrice: number, discountPercent: number): number => {
    const discount = (unitPrice * discountPercent) / 100;
    return unitPrice - discount;
  };

  const handlePriceChange = (index: number, field: 'unitPrice' | 'discountPercent', value: number) => {
    const updatedItems = [...dispatchItems];
    updatedItems[index][field] = value;

    if (field === 'unitPrice' || field === 'discountPercent') {
      updatedItems[index].finalPrice = calculateFinalPrice(
        updatedItems[index].unitPrice,
        updatedItems[index].discountPercent
      );
    }

    setDispatchItems(updatedItems);
  };

  const handleBatchAllocation = (itemIndex: number, entryId: string, quantity: number) => {
    const updatedItems = [...dispatchItems];
    const item = updatedItems[itemIndex];

    const existingIndex = item.batchAllocations.findIndex(alloc => alloc.entryId === entryId);

    if (existingIndex >= 0) {
      if (quantity > 0) {
        item.batchAllocations[existingIndex].quantity = quantity;
      } else {
        item.batchAllocations.splice(existingIndex, 1);
      }
    } else if (quantity > 0) {
      const entry = stockEntries.find(e => e.id === entryId);
      if (entry) {
        item.batchAllocations.push({
          entryId,
          productName: entry.productName,
          quantity,
          batchNumber: entry.batchNumber,
          claimedAt: entry.claimedAt
        });
      }
    }

    setDispatchItems(updatedItems);
  };

  const getTotalAllocated = (itemIndex: number): number => {
    return dispatchItems[itemIndex].batchAllocations.reduce((sum, alloc) => sum + alloc.quantity, 0);
  };

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedItems(newExpanded);
  };

  const handleConfirm = async () => {
    const hasInvalidPrices = dispatchItems.some(item => item.unitPrice <= 0 || item.finalPrice < 0);
    if (hasInvalidPrices) {
      alert('Please set valid prices for all items (unit price must be greater than 0)');
      return;
    }

    const hasInvalidAllocations = dispatchItems.some((item, index) => {
      const allocated = getTotalAllocated(index);
      return allocated !== item.requestedQuantity;
    });

    if (hasInvalidAllocations) {
      alert('Please allocate the exact requested quantity from available batches for all items');
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(dispatchItems, generateInvoice);
      onClose();
    } catch (error) {
      console.error('Error processing dispatch:', error);
      alert('Failed to process dispatch. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalValue = dispatchItems.reduce((sum, item) => sum + (item.finalPrice * item.requestedQuantity), 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set Pricing & Dispatch to Representative" size="lg">
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Set the unit prices and discounts for each item before dispatching from your distributor stock to the representative.
          </p>
        </div>

        <div className="space-y-4">
          {dispatchItems.map((item, index) => {
            const availableBatches = stockEntries.filter(entry => {
              if (!entry || !entry.productName) return false;
              const nameMatch = entry.productName.trim().toLowerCase() === item.productName.trim().toLowerCase();
              const hasQty = (Number(entry.availableQuantity) || 0) > 0;
              const isAvailable = entry.status === 'available' || !entry.status;

              if (index === 0) {
                console.log(`[Batch Filter] Checking entry for "${item.productName}":`, {
                  entryName: entry.productName,
                  entryId: entry.id,
                  nameMatch,
                  hasQty,
                  availableQty: entry.availableQuantity,
                  status: entry.status,
                  isAvailable,
                  passes: nameMatch && hasQty && isAvailable
                });
              }

              return nameMatch && hasQty && isAvailable;
            });

            if (index === 0) {
              console.log(`[Batch Filter] Total batches found for "${item.productName}":`, availableBatches.length);
              console.log('[Batch Filter] Available batches:', availableBatches);
            }

            const totalAllocated = getTotalAllocated(index);
            const isExpanded = expandedItems.has(index);
            const showingAllProducts = showAllProducts.has(index);

            const similarProducts = findSimilarProducts(item.productName);
            const otherProducts = stockEntries.filter(entry => {
              if (!entry || !entry.productName) return false;
              const entryName = entry.productName.trim().toLowerCase();
              const itemName = item.productName.trim().toLowerCase();
              const hasQty = (Number(entry.availableQuantity) || 0) > 0;
              const isAvailable = entry.status === 'available' || !entry.status;
              const isNotMatching = entryName !== itemName;
              const isNotInSimilar = !similarProducts.find(s => s.productName === entry.productName);
              return isNotMatching && isNotInSimilar && hasQty && isAvailable;
            });

            return (
              <div key={index} className="border border-gray-200 rounded-lg bg-white">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-600" />
                      <h4 className="font-medium text-gray-900">{item.productName}</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-gray-600">Requested: {item.requestedQuantity}</span>
                      <div className={`text-sm font-medium ${
                        totalAllocated === item.requestedQuantity
                          ? 'text-green-600'
                          : totalAllocated > item.requestedQuantity
                          ? 'text-red-600'
                          : 'text-amber-600'
                      }`}>
                        Allocated: {totalAllocated}
                      </div>
                    </div>
                  </div>

                  <div className="mb-4 space-y-2">
                    <div className="bg-gray-100 border border-gray-300 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-xs font-semibold text-gray-900">
                          {availableBatches.length > 0
                            ? `Select Stock Batches (${availableBatches.length} available)`
                            : 'No Exact Match Found'
                          }
                        </h5>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(index)}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          {isExpanded ? '▼ Hide' : '▶ Show'}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="space-y-2">
                          {availableBatches.length === 0 ? (
                            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium mb-1">No exact match found for "{item.productName}"</p>
                                <p className="text-xs">Consider using an alternative product from the suggestions below.</p>
                              </div>
                            </div>
                          ) : (
                            availableBatches.map((entry) => {
                              const currentAllocation = item.batchAllocations.find(alloc => alloc.entryId === entry.id);
                              const allocatedQty = currentAllocation?.quantity || 0;

                              return (
                                <div key={entry.id} className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 text-xs text-gray-600">
                                      {entry.batchNumber && (
                                        <span className="flex items-center gap-1">
                                          <Hash className="w-3 h-3" />
                                          Batch: {entry.batchNumber}
                                        </span>
                                      )}
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(entry.claimedAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      Available: <span className="font-medium text-gray-900">{Number(entry.availableQuantity) || 0}</span> units
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label className="text-xs font-medium text-gray-700">Use:</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max={Number(entry.availableQuantity) || 0}
                                      value={allocatedQty}
                                      onChange={(e) => handleBatchAllocation(index, entry.id, parseInt(e.target.value) || 0)}
                                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
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
                            const currentAllocation = item.batchAllocations.find(alloc => alloc.entryId === entry.id);
                            const allocatedQty = currentAllocation?.quantity || 0;

                            return (
                              <div
                                key={entry.id}
                                className={`flex items-center gap-2 p-2 rounded border ${
                                  allocatedQty > 0 ? 'border-blue-500 bg-blue-100' : 'border-blue-300 bg-white'
                                }`}
                              >
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">{entry.productName}</p>
                                  <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                                    {entry.batchNumber && (
                                      <span className="flex items-center gap-1">
                                        <Hash className="w-3 h-3" />
                                        Batch: {entry.batchNumber}
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(entry.claimedAt).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    Available: <span className="font-medium text-gray-900">{Number(entry.availableQuantity) || 0}</span> units
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="text-xs font-medium text-gray-700">Use:</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max={Number(entry.availableQuantity) || 0}
                                    value={allocatedQty}
                                    onChange={(e) => handleBatchAllocation(index, entry.id, parseInt(e.target.value) || 0)}
                                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
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
                    <DollarSign className="w-3 h-3 inline mr-1" />
                    Unit Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={item.unitPrice}
                    onChange={(e) => handlePriceChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    <Percent className="w-3 h-3 inline mr-1" />
                    Discount (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={item.discountPercent}
                    onChange={(e) => handlePriceChange(index, 'discountPercent', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Final Price ($)
                  </label>
                  <div className="flex items-center h-10 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                    <span className="font-semibold text-green-700">
                      ${item.finalPrice.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

                  <div className="mt-2 pt-2 border-t border-gray-300">
                    <p className="text-sm text-gray-600">
                      Subtotal: <span className="font-semibold text-gray-900">${(item.finalPrice * item.requestedQuantity).toFixed(2)}</span>
                    </p>
                  </div>

                  {otherProducts.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-50 border border-gray-300 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-800">Browse All Other Products ({otherProducts.length})</p>
                        <button
                          type="button"
                          onClick={() => {
                            const newSet = new Set(showAllProducts);
                            if (newSet.has(index)) {
                              newSet.delete(index);
                            } else {
                              newSet.add(index);
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
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={generateInvoice}
                onChange={(e) => setGenerateInvoice(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <p className="font-medium text-gray-900">Generate Invoice</p>
                <p className="text-sm text-gray-600">Automatically create an invoice for this dispatch</p>
              </div>
            </label>
          </div>

          <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total Value:</span>
              <span className="text-2xl font-bold text-green-600">${totalValue.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Confirm & Dispatch'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
