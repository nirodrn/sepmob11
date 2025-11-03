import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFirebaseActions, useFirebaseData } from '../../hooks/useFirebaseData';
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react';

interface CreateRequestFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface RequestItem {
  productName: string;
  quantity: number;
}

export function CreateRequestForm({ onClose, onSuccess }: CreateRequestFormProps) {
  const { userData } = useAuth();
  const { addData } = useFirebaseActions('requests'); // Changed to 'requests' collection
  const { data: products } = useFirebaseData<Record<string, { productName: string }>>('finishedGoodsPackagedInventory');

  const [items, setItems] = useState<RequestItem[]>([{ productName: '', quantity: 1 }]);
  const [isUrgent, setIsUrgent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allProductOptions = useMemo(() => {
    if (!products) return [];
    const uniqueNames = [...new Set(Object.values(products).map(p => p.productName))];
    return uniqueNames.sort((a, b) => a.localeCompare(b));
  }, [products]);

  const selectedProductNames = useMemo(() => items.map(item => item.productName), [items]);

  const handleItemChange = (index: number, field: keyof RequestItem, value: string | number) => {
    const newItems = [...items];
    (newItems[index] as any)[field] = value;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { productName: '', quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!userData) {
      setError('You must be logged in to make a request.');
      setLoading(false);
      return;
    }

    const finalItems = items.filter(item => item.productName.trim() !== '' && item.quantity > 0);

    if (finalItems.length === 0) {
      setError('Please add at least one valid item to the request.');
      setLoading(false);
      return;
    }

    try {
      const timestamp = new Date();

      for (const item of finalItems) {
        const datePart = `${timestamp.getDate().toString().padStart(2, '0')}${(timestamp.getMonth() + 1).toString().padStart(2, '0')}${timestamp.getFullYear().toString().slice(-2)}`;
        const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
        const variantPart = item.productName.replace(/\s+/g, '').substring(0, 5).toUpperCase();
        const customId = `${datePart}-${randomPart}-${variantPart}`;

        await addData(customId, {
          id: customId,
          product: item.productName,
          quantity: item.quantity,
          status: '',
          date: timestamp.toISOString(),
          urgent: isUrgent,
        });
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to create request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canAddItem = useMemo(() => {
    return allProductOptions.length > selectedProductNames.length;
  }, [allProductOptions, selectedProductNames]);

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg relative max-h-screen overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Product Request</h2>
        
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h3 className="text-md font-medium text-gray-800 mb-2">Items</h3>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <select
                    value={item.productName}
                    onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                    className="flex-grow p-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="" disabled>Select a product</option>
                    {allProductOptions.map(name => (
                        <option 
                          key={name} 
                          value={name}
                          disabled={selectedProductNames.includes(name) && item.productName !== name}
                        >
                          {name}
                        </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                    className="w-20 p-2 border border-gray-300 rounded-md"
                    min="1"
                    required
                  />
                  <button type="button" onClick={() => removeItem(index)} className="p-2 text-red-500 hover:text-red-700">
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
            <button 
              type="button" 
              onClick={addItem} 
              className="mt-2 flex items-center text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
              disabled={!canAddItem}
            >
              <Plus size={16} className="mr-1" />
              Add Item
            </button>
          </div>

          {/* Notes field is removed as it's not in the new data structure */}

          <div className="flex items-center">
            <input
              id="urgent"
              type="checkbox"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
              className="h-4 w-4 text-yellow-500 border-gray-300 rounded focus:ring-yellow-400"
            />
            <label htmlFor="urgent" className="ml-2 flex items-center text-sm font-medium text-gray-700">
              <AlertTriangle size={16} className="mr-1 text-yellow-500"/>
              Mark as Urgent
            </label>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
