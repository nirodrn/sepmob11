import React, { useState, useMemo } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Modal } from '../../Common/Modal';
import { useAuth } from '../../../context/AuthContext';
import { useFirebaseData } from '../../../hooks/useFirebaseData';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { ref, set, push } from 'firebase/database';
import { database } from '../../../config/firebase';

interface DisRefRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface RequestItem {
  productName: string;
  quantity: number;
}

export function DisRefRequestForm({ isOpen, onClose, onSuccess }: DisRefRequestFormProps) {
  const { userData } = useAuth();
  const { data: productsData, loading: productsLoading, error: productsError } = useFirebaseData('finishedGoodsPackagedInventory');

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<RequestItem[]>([{ productName: '', quantity: 1 }]);
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');

  const products = useMemo(() => {
    if (!productsData) return [];
    const uniqueProducts = new Set();
    const productList: { name: string }[] = [];
    
    Object.values(productsData).forEach((item: any) => {
      if (item.productName && !uniqueProducts.has(item.productName)) {
        uniqueProducts.add(item.productName);
        productList.push({ name: item.productName });
      }
    });
    
    return productList.sort((a, b) => a.name.localeCompare(b.name));
  }, [productsData]);

  const addItem = () => {
    setItems([...items, { productName: '', quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof RequestItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) {
      alert('You must be logged in to create requests.');
      return;
    }

    // Validate user role
    if (userData.role !== 'DistributorRepresentative') {
      alert('Only Distributor Representatives can create DisRef requests.');
      return;
    }

    if (!userData.distributorId) {
      console.error('User data:', userData);
      alert(`Your user profile is missing distributorId. Please contact administrator. Debug info: Role=${userData.role}, ID=${userData.id}`);
      return;
    }

    const validItems = items.filter(item => item.productName.trim() !== '' && item.quantity > 0);
    
    if (validItems.length === 0) {
      alert('Please add at least one valid product');
      return;
    }

    setLoading(true);
    try {
      const timestamp = Date.now();
      const requestIdPrefix = `DISREF_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

      const itemsObject = validItems.reduce((acc, item, index) => {
        acc[`prod${String(index + 1).padStart(3, '0')}`] = {
          name: item.productName,
          qty: item.quantity
        };
        return acc;
      }, {} as Record<string, { name: string; qty: number }>);

      const requestData = {
        requestedBy: userData.id,
        requestedByName: userData.name,
        requestedByRole: userData.role,
        distributorId: userData.distributorId,
        items: itemsObject,
        status: 'pending',
        priority,
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: timestamp
      };

      const requestRef = ref(database, `disRefReqs/${userData.distributorId}/${userData.id}/${requestIdPrefix}`);
      const newRequestRef = push(requestRef);
      await set(newRequestRef, {
        ...requestData,
        id: newRequestRef.key
      });
      
      onSuccess();
      onClose();
      
      // Reset form
      setItems([{ productName: '', quantity: 1 }]);
      setNotes('');
      setPriority('normal');
    } catch (error) {
      console.error('Error creating DisRef request:', error);
      alert('Failed to create request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Stock Request to Distributor" size="lg">
      {productsError && <ErrorMessage message="Failed to load products." />}
      
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

          {productsLoading ? (
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
                      value={item.productName}
                      onChange={(e) => updateItem(index, 'productName', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="">Select Product</option>
                      {products.map(product => (
                        <option key={product.name} value={product.name}>
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
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
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
            disabled={loading || productsLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Submit Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}