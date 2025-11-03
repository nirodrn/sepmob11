import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../../../context/AuthContext';
import { useFirebaseActions, useFirebaseData } from '../../../hooks/useFirebaseData';
import { Modal } from '../../Common/Modal';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';

interface DSNewRequestProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface RequestItem {
  productId: string;
  productName: string;
  quantity: number;
  urgent: boolean;
  location: string;
}

export function DSNewRequest({ isOpen, onClose, onSuccess }: DSNewRequestProps) {
  const { userData } = useAuth();
  const { setData } = useFirebaseActions('dsreqs');
  const { data: inventoryData, loading: inventoryLoading, error: inventoryError } = useFirebaseData('finishedGoodsPackagedInventory');

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<RequestItem[]>([
    { productId: '', productName: '', quantity: 1, urgent: false, location: '' }
  ]);
  const [notes, setNotes] = useState('');

  const products = useMemo(() => {
    if (!inventoryData) return [];
    const productMap = new Map();
    Object.values(inventoryData).forEach((item: any) => {
      if (item.productId && !productMap.has(item.productId)) {
        productMap.set(item.productId, {
          id: item.productId,
          name: item.productName,
          variant: item.variantName
        });
      }
    });
    return Array.from(productMap.values());
  }, [inventoryData]);

  const handleItemChange = (index: number, field: keyof RequestItem, value: any) => {
    const newItems = [...items];
    const item = newItems[index];
    (item[field] as any) = value;

    if (field === 'productId') {
        const selectedProduct = products.find(p => p.id === value);
        item.productName = selectedProduct ? `${selectedProduct.name} - ${selectedProduct.variant}` : '';
    }

    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { productId: '', productName: '', quantity: 1, urgent: false, location: '' }]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!userData || items.some(item => !item.productId || item.quantity <= 0)) {
        alert("Please fill all product fields and ensure quantity is positive.");
        return;
    }
    setLoading(true);

    try {
        const requestPromises = items.map(item => {
            const { productName, quantity, urgent } = item;
            
            const formattedDate = format(new Date(), 'ddMMyy');
            const randomNo = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            const variant = (productName.split(' - ')[1] || '').replace(/\s+/g, '');

            const id = `${formattedDate}-${randomNo}-${variant}`;
            
            const requestData = {
                id,
                product: productName,
                quantity,
                status: 'pending',
                date: new Date().toISOString(),
                urgent,
                requestedBy: userData.id,
                requestedByName: userData.name || 'N/A',
                notes,
            };
            return setData(id, requestData);
        });

      await Promise.all(requestPromises);
      
      onSuccess();
      onClose();
      setItems([{ productId: '', productName: '', quantity: 1, urgent: false, location: '' }]);
      setNotes('');
    } catch (error) {
      console.error("Error creating request:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
      <Modal isOpen={isOpen} onClose={onClose} title="New Product Request">
        {inventoryLoading ? (
          <LoadingSpinner />
        ) : inventoryError ? (
          <ErrorMessage message={inventoryError.message} />
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="flex items-center space-x-2 p-2 border rounded">
                <div className="flex-grow">
                    <select
                        value={item.productId}
                        onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                        className="p-2 border rounded w-full mb-2"
                    >
                        <option value="">Select a product</option>
                        {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} - {p.variant}</option>
                        ))}
                    </select>
                    <div className="flex items-center space-x-2">
                        <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                            className="p-2 border rounded w-24"
                            min="1"
                            placeholder="Qty"
                        />
                        <input
                            type="text"
                            value={item.location}
                            onChange={(e) => handleItemChange(index, 'location', e.target.value)}
                            placeholder="Location"
                            className="p-2 border rounded w-32"
                        />
                        <label className="flex items-center space-x-2 whitespace-nowrap">
                            <input
                            type="checkbox"
                            checked={item.urgent}
                            onChange={(e) => handleItemChange(index, 'urgent', e.target.checked)}
                            />
                            <span>Urgent</span>
                        </label>
                    </div>
                </div>
                <button onClick={() => removeItem(index)} className="text-red-500 font-bold self-center text-xl">X</button>
              </div>
            ))}
            <button onClick={addItem} className="text-blue-500">+ Add Another Item</button>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for this request..."
              className="w-full p-2 border rounded"
            />
            <button onClick={handleSubmit} disabled={loading} className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400">
              {loading ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        )}
      </Modal>
  );
}
