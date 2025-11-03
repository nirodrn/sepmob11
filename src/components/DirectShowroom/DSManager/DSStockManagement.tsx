import React, { useState, useEffect } from 'react';
import { ref, get, update, remove } from 'firebase/database';
import { database } from '../../../config/firebase';
import { useShowroomId } from '../../../hooks/useShowroomId';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Modal } from '../../Common/Modal';
import { Package, Search, Edit2, Merge } from 'lucide-react';

interface InventoryItem {
  id: string;
  product: string;
  quantity: number;
  unitPrice?: number;
  finalPrice?: number;
  discountPercent?: number;
  status: string;
  date: string;
  location?: string;
  showroomId?: string;
  requestId?: string;
  lastUpdated?: string;
}

export function DSStockManagement({ isManager = false }: { isManager?: boolean }) {
  const { showroomId, loading: showroomLoading, error: showroomError } = useShowroomId();
  const [inventory, setInventory] = useState<Record<string, InventoryItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({
    location: '',
    finalPrice: 0,
    unitPrice: 0,
    discountPercent: 0
  });

  // Merge modal state
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeTargetProduct, setMergeTargetProduct] = useState('');

  useEffect(() => {
    const fetchInventory = async () => {
      if (showroomLoading) return;

      if (!showroomId) {
        setError('No showroom assigned to your account');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const inventoryRef = ref(database, `direct_showrooms/${showroomId}/inventory`);
        const snapshot = await get(inventoryRef);

        if (snapshot.exists()) {
          setInventory(snapshot.val());
        } else {
          setInventory({});
        }
        setError(null);
      } catch (err) {
        console.error('Error fetching inventory:', err);
        setError('Failed to load inventory data');
      } finally {
        setLoading(false);
      }
    };

    fetchInventory();
  }, [showroomId, showroomLoading]);

  const handleEditClick = (item: InventoryItem) => {
    setEditingItem(item);
    setEditForm({
      location: item.location || '',
      finalPrice: item.finalPrice || 0,
      unitPrice: item.unitPrice || 0,
      discountPercent: item.discountPercent || 0
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!showroomId || !editingItem) return;

    try {
      const inventoryRef = ref(database, `direct_showrooms/${showroomId}/inventory/${editingItem.id}`);

      const updates = {
        location: editForm.location,
        finalPrice: parseFloat(editForm.finalPrice.toString()) || 0,
        unitPrice: parseFloat(editForm.unitPrice.toString()) || 0,
        discountPercent: parseFloat(editForm.discountPercent.toString()) || 0,
        lastUpdated: new Date().toISOString()
      };

      await update(inventoryRef, updates);

      const updatedInventoryRef = ref(database, `direct_showrooms/${showroomId}/inventory`);
      const snapshot = await get(updatedInventoryRef);

      if (snapshot.exists()) {
        setInventory(snapshot.val());
      }

      setIsEditModalOpen(false);
      setEditingItem(null);
      alert('Item updated successfully!');
    } catch (e) {
      console.error("Error updating item: ", e);
      alert('Failed to update item.');
    }
  };

  const handleSelectItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleMergeClick = () => {
    if (selectedItems.length < 2) {
      alert('Please select at least 2 items to merge.');
      return;
    }

    // Get all unique product names from selected items
    const items = selectedItems.map(id => inventory?.[id]).filter(Boolean);
    const uniqueProducts = [...new Set(items.map(item => item?.product))];

    if (uniqueProducts.length === 1) {
      // All selected items have the same product name, auto-merge
      setMergeTargetProduct(uniqueProducts[0] || '');
    } else {
      setMergeTargetProduct('');
    }

    setIsMergeModalOpen(true);
  };

  const handleConfirmMerge = async () => {
    if (!showroomId || selectedItems.length < 2 || !mergeTargetProduct) {
      alert('Please select items and provide a product name.');
      return;
    }

    try {
      const items = selectedItems.map(id => inventory?.[id]).filter(Boolean) as InventoryItem[];

      // Calculate totals
      const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const avgUnitPrice = items.reduce((sum, item) => sum + (item.unitPrice || 0), 0) / items.length;
      const avgFinalPrice = items.reduce((sum, item) => sum + (item.finalPrice || 0), 0) / items.length;
      const avgDiscount = items.reduce((sum, item) => sum + (item.discountPercent || 0), 0) / items.length;

      // Use the first item's location or combine locations
      const locations = items.map(item => item.location).filter(Boolean);
      const mergedLocation = locations.length > 0 ? locations.join(', ') : '';

      // Create merged item with sanitized key
      const mergedKey = mergeTargetProduct.replace(/[.#$/\[\]]/g, '_');
      const mergedItemRef = ref(database, `direct_showrooms/${showroomId}/inventory/${mergedKey}`);

      await update(mergedItemRef, {
        id: mergedKey,
        product: mergeTargetProduct,
        quantity: totalQuantity,
        unitPrice: avgUnitPrice,
        finalPrice: avgFinalPrice,
        discountPercent: avgDiscount,
        location: mergedLocation,
        status: 'in-inventory',
        lastUpdated: new Date().toISOString(),
        mergedFrom: selectedItems.join(','),
        showroomId: showroomId
      });

      // Delete old items
      for (const id of selectedItems) {
        if (id !== mergedKey) {
          const itemRef = ref(database, `direct_showrooms/${showroomId}/inventory/${id}`);
          await remove(itemRef);
        }
      }

      // Refresh inventory
      const inventoryRef = ref(database, `direct_showrooms/${showroomId}/inventory`);
      const snapshot = await get(inventoryRef);
      if (snapshot.exists()) {
        setInventory(snapshot.val());
      }

      setSelectedItems([]);
      setIsMergeModalOpen(false);
      alert('Items merged successfully!');
    } catch (e) {
      console.error("Error merging items: ", e);
      alert('Failed to merge items.');
    }
  };

  if (loading) return <LoadingSpinner text="Loading stock..." />;
  if (error) return <ErrorMessage message="Failed to load stock data." />;

  const inventoryItems = inventory ? Object.entries(inventory).map(([id, item]) => ({ id, ...item })) : [];

  const filteredStock = inventoryItems.filter(item =>
    item.product?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group items by product name
  const groupedProducts = filteredStock.reduce((acc, item) => {
    const key = item.product || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  const hasDuplicates = Object.values(groupedProducts).some(items => items.length > 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        {isManager && selectedItems.length >= 2 && (
          <button
            onClick={handleMergeClick}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Merge className="w-4 h-4" />
            Merge Selected ({selectedItems.length})
          </button>
        )}
      </div>

      {hasDuplicates && isManager && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> You have duplicate products. Select items and use the merge button to consolidate them.
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {isManager && <th className="w-12 py-3 px-4"></th>}
                <th className="text-left py-3 px-4 font-medium text-gray-900">Product</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Quantity</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Location</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Unit Price</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Discount</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Final Price</th>
                {isManager && <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStock.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  {isManager && (
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                    </td>
                  )}
                  <td className="py-3 px-4 font-medium text-gray-900">{item.product}</td>
                  <td className="py-3 px-4">{item.quantity || 0}</td>
                  <td className="py-3 px-4 text-sm text-gray-600">{item.location || '-'}</td>
                  <td className="py-3 px-4">${(item.unitPrice || 0).toFixed(2)}</td>
                  <td className="py-3 px-4">{(item.discountPercent || 0)}%</td>
                  <td className="py-3 px-4 font-semibold text-green-600">${(item.finalPrice || 0).toFixed(2)}</td>
                  {isManager && (
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleEditClick(item)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredStock.length === 0 && (
          <div className="p-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No inventory items found.</p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Inventory Item">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
            <p className="text-gray-900 font-semibold">{editingItem?.product}</p>
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              id="location"
              type="text"
              value={editForm.location}
              onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
              placeholder="e.g., Aisle 3, Shelf B"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="unitPrice" className="block text-sm font-medium text-gray-700 mb-1">Unit Price ($)</label>
              <input
                id="unitPrice"
                type="number"
                step="0.01"
                value={editForm.unitPrice}
                onChange={(e) => setEditForm({ ...editForm, unitPrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="discount" className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label>
              <input
                id="discount"
                type="number"
                step="0.1"
                value={editForm.discountPercent}
                onChange={(e) => setEditForm({ ...editForm, discountPercent: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="finalPrice" className="block text-sm font-medium text-gray-700 mb-1">Final Price ($)</label>
            <input
              id="finalPrice"
              type="number"
              step="0.01"
              value={editForm.finalPrice}
              onChange={(e) => setEditForm({ ...editForm, finalPrice: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>

      {/* Merge Modal */}
      <Modal isOpen={isMergeModalOpen} onClose={() => setIsMergeModalOpen(false)} title="Merge Inventory Items">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Merging the following items:</p>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-700">Product</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-700">Quantity</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-gray-700">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {selectedItems.map(id => {
                  const item = inventory?.[id];
                  if (!item) return null;
                  return (
                    <tr key={id}>
                      <td className="py-2 px-3 text-sm text-gray-900">{item.product}</td>
                      <td className="py-2 px-3 text-sm text-gray-900 text-right">{item.quantity}</td>
                      <td className="py-2 px-3 text-sm text-gray-900 text-right">${(item.finalPrice || 0).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <label htmlFor="mergeProduct" className="block text-sm font-medium text-gray-700 mb-1">
              Merged Product Name
            </label>
            <input
              id="mergeProduct"
              type="text"
              value={mergeTargetProduct}
              onChange={(e) => setMergeTargetProduct(e.target.value)}
              placeholder="Enter product name for merged item"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Quantities will be summed, and prices will be averaged. This action cannot be undone.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setIsMergeModalOpen(false)}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmMerge}
              disabled={!mergeTargetProduct}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 disabled:opacity-50"
            >
              Confirm Merge
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
