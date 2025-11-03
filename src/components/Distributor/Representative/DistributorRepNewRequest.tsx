import React, { useState, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../Common/Modal';
import { useAuth } from '../../../context/AuthContext';
import { useFirebaseData } from '../../../hooks/useFirebaseData';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { ref, set } from 'firebase/database';
import { database } from '../../../config/firebase';

interface DistributorRepNewRequestProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface RequestItem {
  productId: string;
  productName: string;
  quantity: number;
}

export function DistributorRepNewRequest({ isOpen, onClose, onSuccess }: DistributorRepNewRequestProps) {
  const { userData } = useAuth();
  const { data: inventoryData, loading: inventoryLoading, error: inventoryError } = useFirebaseData('finishedGoodsPackagedInventory');

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<RequestItem[]>([{ productId: '', productName: '', quantity: 1 }]);
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');

  const productsMap = useMemo(() => {
    if (!inventoryData) return new Map<string, string>();

    const map = new Map<string, string>();
    Object.values(inventoryData).forEach((item: any) => {
      if (item.productId && item.productName) {
        const displayName = `${item.productName} - ${item.variantName || 'Standard'}`;
        if (!map.has(item.productId)) {
          map.set(item.productId, displayName);
        }
      }
    });
    return map;
  }, [inventoryData]);

  const productsList = Array.from(productsMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const addItem = () => {
    setItems([...items, { productId: '', productName: '', quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, productId: string, quantity?: number) => {
    const updatedItems = [...items];
    if (quantity !== undefined) {
      updatedItems[index].quantity = quantity;
    } else {
      updatedItems[index].productId = productId;
      updatedItems[index].productName = productsMap.get(productId) || '';
    }
    setItems(updatedItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !userData.distributorId) {
      alert('You must be assigned to a distributor to create requests.');
      return;
    }

    const validItems = items.filter(item => item.productId && item.quantity > 0);

    if (validItems.length === 0) {
      alert('Please add at least one valid product');
      return;
    }

    setLoading(true);
    try {
      const timestamp = Date.now();
      const requestId = `REQ_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

      const itemsObject = validItems.reduce((acc, item, index) => {
        const key = `item${String(index + 1).padStart(3, '0')}`;
        acc[key] = {
          name: item.productName,
          qty: item.quantity,
          productId: item.productId
        };
        return acc;
      }, {} as Record<string, { name: string; qty: number; productId: string }>);

      const requestData = {
        id: requestId,
        requestedBy: userData.id,
        requestedByName: userData.name,
        requestedByRole: userData.role,
        distributorId: userData.distributorId,
        items: itemsObject,
        status: 'pending',
        priority,
        notes: notes.trim(),
        createdAt: timestamp,
        updatedAt: timestamp
      };

      const requestRef = ref(database, `disrepstock/${userData.distributorId}/${userData.id}/${requestId}`);
      await set(requestRef, requestData);

      onSuccess();
      onClose();

      setItems([{ productId: '', productName: '', quantity: 1 }]);
      setNotes('');
      setPriority('normal');
      alert('Request submitted successfully!');
    } catch (error) {
      console.error('Error creating request:', error);
      alert('Failed to create request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Stock Request to Distributor" size="lg">
      {inventoryError && <ErrorMessage message="Failed to load products." />}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Priority Level
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'normal' | 'urgent')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="normal">Normal</option>
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

          {inventoryLoading ? (
            <LoadingSpinner text="Loading products..." />
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="flex gap-4 items-end p-4 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product
                    </label>
                    <select
                      value={item.productId}
                      onChange={(e) => updateItem(index, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select Product</option>
                      {productsList.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name}
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
                      onChange={(e) => updateItem(index, item.productId, parseInt(e.target.value) || 1)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
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
          )}
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
            {loading ? 'Creating...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
