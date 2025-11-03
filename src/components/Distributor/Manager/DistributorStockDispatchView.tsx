import React, { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { database } from '../../../config/firebase';
import { Package, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';

interface StockEntry {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  availableQuantity: number;
  usedQuantity: number;
  unitPrice: number;
  finalPrice: number;
  totalValue: number;
  receivedAt: string;
  lastUpdated: string;
  location: string;
  requestId: string;
  notes?: string;
  status: string;
}

interface StockSummary {
  productId: string;
  productName: string;
  totalQuantity: number;
  availableQuantity: number;
  usedQuantity: number;
  averageUnitPrice: number;
  totalValue: number;
  entryCount: number;
  firstReceivedAt: string;
  lastUpdated: string;
}

interface UserStock {
  userId: string;
  userName: string;
  entries: Record<string, StockEntry>;
  summary: Record<string, StockSummary>;
}

interface GroupedProduct {
  productName: string;
  totalEntries: number;
  totalQuantity: number;
  totalAvailable: number;
  totalUsed: number;
  totalValue: number;
  entries: Array<{
    userId: string;
    userName: string;
    entryCount: number;
    availableQuantity: number;
    totalQuantity: number;
    usedQuantity: number;
    totalValue: number;
    averagePrice: number;
  }>;
}

export default function DistributorStockDispatchView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupedProducts, setGroupedProducts] = useState<GroupedProduct[]>([]);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    const stockRef = ref(database, 'distributorStock/users');

    const unsubscribe = onValue(
      stockRef,
      (snapshot) => {
        try {
          const data = snapshot.val();
          if (!data) {
            setGroupedProducts([]);
            setLoading(false);
            return;
          }

          const productMap = new Map<string, GroupedProduct>();

          Object.entries(data).forEach(([userId, userData]: [string, any]) => {
            if (!userData.summary) return;

            Object.entries(userData.summary).forEach(([productId, summary]: [string, any]) => {
              const productName = summary.productName;

              if (!productMap.has(productName)) {
                productMap.set(productName, {
                  productName,
                  totalEntries: 0,
                  totalQuantity: 0,
                  totalAvailable: 0,
                  totalUsed: 0,
                  totalValue: 0,
                  entries: []
                });
              }

              const product = productMap.get(productName)!;
              product.totalEntries += summary.entryCount || 0;
              product.totalQuantity += summary.totalQuantity || 0;
              product.totalAvailable += summary.availableQuantity || 0;
              product.totalUsed += summary.usedQuantity || 0;
              product.totalValue += summary.totalValue || 0;

              product.entries.push({
                userId,
                userName: userData.summary[Object.keys(userData.summary)[0]]?.productName || 'Unknown User',
                entryCount: summary.entryCount || 0,
                availableQuantity: summary.availableQuantity || 0,
                totalQuantity: summary.totalQuantity || 0,
                usedQuantity: summary.usedQuantity || 0,
                totalValue: summary.totalValue || 0,
                averagePrice: summary.averageUnitPrice || 0
              });
            });
          });

          const grouped = Array.from(productMap.values()).sort((a, b) =>
            a.productName.localeCompare(b.productName)
          );

          setGroupedProducts(grouped);
          setLoading(false);
        } catch (err) {
          console.error('Error processing stock data:', err);
          setError('Failed to process stock data');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error fetching stock data:', err);
        setError('Failed to fetch stock data');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const toggleProduct = (productName: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productName)) {
      newExpanded.delete(productName);
    } else {
      newExpanded.add(productName);
    }
    setExpandedProducts(newExpanded);
  };

  if (loading) {
    return <LoadingSpinner text="Loading dispatch data..." />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (groupedProducts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center text-gray-500">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span>No dispatch data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Package className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Distributor Stock Dispatch Overview</h2>
              <p className="text-sm text-gray-600 mt-1">
                Showing entry counts grouped by product name
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product Name
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Entries
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Quantity
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Available
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Used
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Value
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {groupedProducts.map((product) => (
                <React.Fragment key={product.productName}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">
                          {product.productName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {product.totalEntries}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {product.totalQuantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 font-medium">
                      {product.totalAvailable}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                      {product.totalUsed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                      ₹{product.totalValue.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => toggleProduct(product.productName)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        {expandedProducts.has(product.productName) ? 'Hide' : 'Show'} Details
                      </button>
                    </td>
                  </tr>
                  {expandedProducts.has(product.productName) && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-3">
                          <h4 className="text-sm font-medium text-gray-900">Distributor Breakdown</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {product.entries.map((entry, idx) => (
                              <div key={`${entry.userId}-${idx}`} className="bg-white p-4 rounded-lg border border-gray-200">
                                <div className="space-y-2">
                                  <div className="flex justify-between items-start">
                                    <span className="text-xs text-gray-500">Distributor</span>
                                    <span className="text-xs font-medium text-gray-900">{entry.userName}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                      <span className="text-gray-500">Entries:</span>
                                      <span className="ml-1 font-medium text-blue-600">{entry.entryCount}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Quantity:</span>
                                      <span className="ml-1 font-medium">{entry.totalQuantity}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Available:</span>
                                      <span className="ml-1 font-medium text-green-600">{entry.availableQuantity}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Used:</span>
                                      <span className="ml-1 font-medium">{entry.usedQuantity}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Avg Price:</span>
                                      <span className="ml-1 font-medium">₹{entry.averagePrice}</span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">Value:</span>
                                      <span className="ml-1 font-medium">₹{entry.totalValue}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">About Entry Counts</p>
            <p>Products with the same name are grouped together. The entry count shows how many separate stock entries exist for each product across all distributors.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
