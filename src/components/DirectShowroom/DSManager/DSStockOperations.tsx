import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useFirebaseStockOperations } from '../../../hooks/useFirebaseStockOperations';
import { Modal } from '../../Common/Modal';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Package, Minus, ArrowRightLeft, Trash2 } from 'lucide-react';

interface StockOperationsProps {
  isOpen: boolean;
  onClose: () => void;
  productId?: string;
  productName?: string;
}

export function DSStockOperations({ isOpen, onClose, productId, productName }: StockOperationsProps) {
  const { userData } = useAuth();
  const {
    useStock,
    transferStock,
    getUserStockSummary,
    getUserStockEntries,
    loading,
    error
  } = useFirebaseStockOperations();

  const [activeTab, setActiveTab] = useState<'use' | 'transfer' | 'view'>('use');
  const [quantityToUse, setQuantityToUse] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [transferToUserId, setTransferToUserId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState<number>(1);
  const [transferReason, setTransferReason] = useState('');
  const [stockSummary, setStockSummary] = useState<any[]>([]);
  const [stockEntries, setStockEntries] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && userData) {
      loadStockData();
    }
  }, [isOpen, userData, productId]);

  const loadStockData = async () => {
    if (!userData) return;

    try {
      const [summary, entries] = await Promise.all([
        getUserStockSummary(userData.id),
        getUserStockEntries(userData.id, productId)
      ]);
      
      setStockSummary(summary);
      setStockEntries(entries);
    } catch (err) {
      console.error('Error loading stock data:', err);
    }
  };

  const handleUseStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !productId) return;

    try {
      await useStock(userData.id, productId, quantityToUse, reason);
      alert(`Successfully used ${quantityToUse} units of ${productName}`);
      setQuantityToUse(1);
      setReason('');
      await loadStockData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleTransferStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !productId) return;

    try {
      await transferStock(userData.id, transferToUserId, productId, transferQuantity, transferReason);
      alert(`Successfully transferred ${transferQuantity} units to user ${transferToUserId}`);
      setTransferToUserId('');
      setTransferQuantity(1);
      setTransferReason('');
      await loadStockData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const getAvailableQuantity = () => {
    if (!productId) return 0;
    const summary = stockSummary.find(s => s.productId === productId);
    return summary?.availableQuantity || 0;
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Stock Operations${productName ? ` - ${productName}` : ''}`} size="lg">
      {error && <ErrorMessage message={error} />}
      
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('use')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'use'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Minus className="w-4 h-4 inline mr-2" />
            Use Stock
          </button>
          <button
            onClick={() => setActiveTab('transfer')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'transfer'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4 inline mr-2" />
            Transfer
          </button>
          <button
            onClick={() => setActiveTab('view')}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'view'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            View Entries
          </button>
        </div>

        {loading && <LoadingSpinner />}

        {/* Available Stock Info */}
        {productId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-900">Available Stock</p>
                <p className="text-sm text-blue-700">{productName}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-900">{getAvailableQuantity()}</p>
                <p className="text-sm text-blue-700">units available</p>
              </div>
            </div>
          </div>
        )}

        {/* Use Stock Tab */}
        {activeTab === 'use' && (
          <form onSubmit={handleUseStock} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity to Use
              </label>
              <input
                type="number"
                min="1"
                max={getAvailableQuantity()}
                value={quantityToUse}
                onChange={(e) => setQuantityToUse(parseInt(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Use
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Customer sale, internal use, damaged goods..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || getAvailableQuantity() === 0}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Use Stock
            </button>
          </form>
        )}

        {/* Transfer Stock Tab */}
        {activeTab === 'transfer' && (
          <form onSubmit={handleTransferStock} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer to User ID
              </label>
              <input
                type="text"
                value={transferToUserId}
                onChange={(e) => setTransferToUserId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter destination user ID"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity to Transfer
              </label>
              <input
                type="number"
                min="1"
                max={getAvailableQuantity()}
                value={transferQuantity}
                onChange={(e) => setTransferQuantity(parseInt(e.target.value) || 1)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer Reason
              </label>
              <textarea
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Reason for stock transfer..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || getAvailableQuantity() === 0}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Transfer Stock
            </button>
          </form>
        )}

        {/* View Entries Tab */}
        {activeTab === 'view' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Stock Entries</h3>
            
            {stockEntries.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No stock entries found.</p>
            ) : (
              <div className="space-y-3">
                {stockEntries.map((entry) => (
                  <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{entry.productName}</p>
                        <p className="text-sm text-gray-500">Entry ID: {entry.id}</p>
                        <p className="text-sm text-gray-500">
                          Claimed: {new Date(entry.claimedAt).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-500">Source: {entry.source}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-gray-900">
                          {entry.availableQuantity}/{entry.quantity}
                        </p>
                        <p className="text-sm text-gray-500">available/total</p>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                          entry.status === 'available' ? 'bg-green-100 text-green-800' :
                          entry.status === 'depleted' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {entry.status}
                        </span>
                      </div>
                    </div>
                    {entry.notes && (
                      <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-600">
                        <strong>Notes:</strong> {entry.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}