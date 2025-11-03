import React, { useState, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../Common/Modal';
import { useFirebaseActions, useFirebaseData } from '../../hooks/useFirebaseData';
import { useAuth } from '../../context/AuthContext';
import { SalesRequestItem } from '../../types';
import { ErrorMessage } from '../Common/ErrorMessage';

interface DistributorNewRequestProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DistributorNewRequest({ isOpen, onClose, onSuccess }: DistributorNewRequestProps) {
  const { userData } = useAuth();
  const { addData } = useFirebaseActions('distributorReqs');
  const { data: inventoryData, loading: inventoryLoading, error: inventoryError } = useFirebaseData('finishedGoodsPackagedInventory');
  
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SalesRequestItem[]>([
    { productId: '', productName: '', quantity: 1, unit: 'units', urgency: 'normal' }
  ]);
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');

  const products = useMemo(() => {
    if (!inventoryData) return [];
    const productMap = new Map();
    Object.values(inventoryData).forEach((item: any) => {
      if (item.productId && !productMap.has(item.productId)) {
        productMap.set(item.productId, {
          id: item.productId,
          name: item.productName,
          variant: item.variantName,
          unit: item.variantUnit || 'units'
        });
      }
    });
    return Array.from(productMap.values());
  }, [inventoryData]);

  const addItem = () => {
    setItems([...items, { productId: '', productName: '', quantity: 1, unit: 'units', urgency: 'normal' }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof SalesRequestItem, value: any) => {
    const updatedItems = [...items];
    const currentItem = { ...updatedItems[index], [field]: value };

    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        currentItem.productName = `${product.name} - ${product.variant}`;
        currentItem.unit = product.unit;
      }
    }
    
    updatedItems[index] = currentItem;
    setItems(updatedItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    setLoading(true);
    try {
      const validItems = items.filter(item => item.productId && item.quantity > 0);
      
      if (validItems.length === 0) {
        alert('Please add at least one valid product');
        setLoading(false);
        return;
      }

      const timestamp = Date.now();
      
      // Create items object with productId as key for distributorReqs format
      const itemsObject = validItems.reduce((acc, item) => {
        acc[item.productId] = {
          name: item.productName,
          qty: item.quantity
        };
        return acc;
      }, {} as Record<string, { name: string; qty: number }>);

      // Save in distributorReqs format - using push to get Firebase-generated key
      await addData('', {
        createdAt: timestamp,
        items: itemsObject,
        notes: notes || "",
        priority,
        requestedBy: userData.id,
        requestedByName: userData.name,
        requestedByRole: userData.role,
        status: 'pending',
        updatedAt: timestamp
      });

      onSuccess();
      onClose();
      setItems([{ productId: '', productName: '', quantity: 1, unit: 'units', urgency: 'normal' }]);
      setNotes('');
      setPriority('normal');
    } catch (error) {
      console.error('Error creating distributor request:', error);
      alert('Failed to create request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Product Request" size="lg">
      {inventoryError && <ErrorMessage message="Failed to load products."/>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Priority Level
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Products
            </label>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="flex gap-4 items-end p-4 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product
                  </label>
                  <select
                    value={item.productId}
                    onChange={(e) => updateItem(index, 'productId', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    disabled={inventoryLoading}
                  >
                    <option value="">{inventoryLoading ? 'Loading products...' : 'Select Product'}</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name} - {product.variant}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="w-20">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={item.unit}
                    readOnly
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"
                  />
                </div>

                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Urgency
                  </label>
                  <select
                    value={item.urgency}
                    onChange={(e) => updateItem(index, 'urgency', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="p-2 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Additional notes or special requirements..."
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || inventoryLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}