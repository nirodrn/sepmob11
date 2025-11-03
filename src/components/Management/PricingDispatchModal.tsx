import React, { useState } from 'react';
import { Modal } from '../Common/Modal';
import { DollarSign, Percent, Package } from 'lucide-react';

interface DispatchItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  finalPrice: number;
}

interface PricingDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestItems: Record<string, { name: string; qty: number }>;
  onConfirm: (dispatchItems: DispatchItem[]) => Promise<void>;
  requestType: 'direct_representative' | 'distributor' | 'direct_showroom' | 'distributor_representative';
}

export function PricingDispatchModal({
  isOpen,
  onClose,
  requestItems,
  onConfirm,
  requestType
}: PricingDispatchModalProps) {
  const [dispatchItems, setDispatchItems] = useState<DispatchItem[]>(() =>
    Object.entries(requestItems).map(([_, item]) => ({
      productName: item.name,
      quantity: item.qty,
      unitPrice: 0,
      discountPercent: 0,
      finalPrice: 0
    }))
  );
  const [isProcessing, setIsProcessing] = useState(false);

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

  const handleConfirm = async () => {
    const hasInvalidPrices = dispatchItems.some(item => item.unitPrice <= 0 || item.finalPrice < 0);

    if (hasInvalidPrices) {
      alert('Please set valid prices for all items (unit price must be greater than 0)');
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm(dispatchItems);
      onClose();
    } catch (error) {
      console.error('Error processing dispatch:', error);
      alert('Failed to process dispatch. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const totalValue = dispatchItems.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set Pricing & Dispatch" size="lg">
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Set the unit prices and discounts for each item before dispatching to the requester.
          </p>
        </div>

        <div className="space-y-4">
          {dispatchItems.map((item, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-600" />
                  <h4 className="font-medium text-gray-900">{item.productName}</h4>
                </div>
                <span className="text-sm text-gray-600">Qty: {item.quantity}</span>
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
                  Subtotal: <span className="font-semibold text-gray-900">${(item.finalPrice * item.quantity).toFixed(2)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total Value:</span>
            <span className="text-2xl font-bold text-green-600">${totalValue.toFixed(2)}</span>
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
