import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Calculator, UserX } from 'lucide-react';
import { Modal } from '../Common/Modal';
import { useFirebaseActions, useFirebaseData } from '../../hooks/useFirebaseData';
import { useAuth } from '../../context/AuthContext';
import { InvoiceItem } from '../../types';
import { ErrorMessage } from '../Common/ErrorMessage';
import Select from 'react-select';

interface InvoiceGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InvoiceGenerator({ isOpen, onClose, onSuccess }: InvoiceGeneratorProps) {
  const { userData } = useAuth();
  const { addData, updateData } = useFirebaseActions();
  const { data: productsData, loading: productsLoading, error: productsError } = useFirebaseData('products');
  const { data: customersData, loading: customersLoading, error: customersError } = useFirebaseData('customers');
  const { data: inventoryData, loading: inventoryLoading, error: inventoryError } = useFirebaseData('finishedGoodsPackagedInventory');
  
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ value: string; label: string; contact?: string } | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([
    { productId: '', productName: '', quantity: 1, unit: 'units', unitPrice: 0, total: 0 }
  ]);
  const [taxRate, setTaxRate] = useState(10);
  const [notes, setNotes] = useState('');

  const products = useMemo(() => 
    productsData ? Object.entries(productsData).map(([id, data]) => ({ id, ...(data as any) })) : [], 
  [productsData]);

  const customers = useMemo(() => 
    customersData ? Object.entries(customersData).map(([id, data]) => ({ value: id, label: (data as any).name, contact: (data as any).contact })) : [],
  [customersData]);
  
  const inventory = useMemo(() => 
    inventoryData ? Object.entries(inventoryData).reduce((acc, [id, data]) => ({...acc, [id]: (data as any).stock}), {}) : {},
  [inventoryData]);

  const addItem = () => {
    setItems([...items, { productId: '', productName: '', quantity: 1, unit: 'units', unitPrice: 0, total: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...items];
    const currentItem = { ...updatedItems[index], [field]: value };

    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        currentItem.productName = product.name;
        currentItem.unit = product.unit;
        currentItem.unitPrice = product.price || 0;
      }
    }
    
    currentItem.total = currentItem.quantity * currentItem.unitPrice;
    updatedItems[index] = currentItem;
    setItems(updatedItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = (subtotal * taxRate) / 100;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const generateInvoiceNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = String(date.getTime()).slice(-4);
    return `INV-${year}${month}${day}-${time}`;
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

      if (!selectedCustomer) {
        alert('Please select a customer');
        setLoading(false);
        return;
      }

      for (const item of validItems) {
        const stock = inventory[item.productId] || 0;
        if (item.quantity > stock) {
          alert(`Not enough stock for ${item.productName}. Available: ${stock}`);
          setLoading(false);
          return;
        }
      }

      const { subtotal, tax, total } = calculateTotals();
      const invoiceNumber = generateInvoiceNumber();
      const dueDate = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days

      const invoiceId = await addData('invoices', {
        invoiceNumber,
        createdBy: userData.id,
        createdByName: userData.name,
        customerId: selectedCustomer.value,
        customerName: selectedCustomer.label,
        customerContact: selectedCustomer.contact,
        items: validItems,
        subtotal,
        tax,
        taxRate,
        total,
        status: 'draft',
        paymentStatus: 'pending',
        totalPaid: 0,
        remainingAmount: total,
        dueDate,
        notes: notes.trim()
      });

      const stockUpdates = validItems.map(item => 
        updateData(`finishedGoodsPackagedInventory/${item.productId}`, { 
          stock: (inventory[item.productId] || 0) - item.quantity 
        })
      );
      await Promise.all(stockUpdates);

      await addData('salesActivities', {
          type: 'invoice_generated',
          userId: userData.id,
          userName: userData.name,
          userRole: userData.role,
          description: `Invoice ${invoiceNumber} generated for ${selectedCustomer.label}`,
          amount: total,
          customerName: selectedCustomer.label,
          invoiceNumber,
          relatedId: invoiceId
      });

      onSuccess();
      onClose();
      
      // Reset form
      setSelectedCustomer(null);
      setItems([{ productId: '', productName: '', quantity: 1, unit: 'units', unitPrice: 0, total: 0 }]);
      setNotes('');
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('Failed to create invoice. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, tax, total } = calculateTotals();
  const isDataLoading = productsLoading || customersLoading || inventoryLoading;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generate Invoice" size="xl">
        {(productsError || customersError || inventoryError) && <ErrorMessage message="Failed to load required data. Please try again later."/>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer *</label>
            <Select
                options={customers}
                value={selectedCustomer}
                onChange={setSelectedCustomer}
                isLoading={customersLoading}
                placeholder="Select or search for a customer..."
                isClearable
            />
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700">
              Invoice Items
            </label>
            <button type="button" onClick={addItem} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm">
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => {
                const stock = inventory[item.productId] || 0;
                return (
              <div key={index} className="flex gap-4 items-end p-4 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                  <select value={item.productId} onChange={(e) => updateItem(index, 'productId', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required disabled={productsLoading}>
                    <option value="">{productsLoading ? 'Loading...' : 'Select Product'}</option>
                    {products.map(product => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  {item.productId && <p className="text-xs text-gray-500 mt-1">Stock: {stock}</p>}
                </div>

                <div className="w-20">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
                  <input type="number" min="1" max={stock} value={item.quantity} onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required/>
                </div>

                <div className="w-20">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input type="text" value={item.unit} readOnly className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"/>
                </div>

                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
                  <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required/>
                </div>

                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>
                  <input type="text" value={`LKR ${item.total.toFixed(2)}`} readOnly className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50"/>
                </div>

                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(index)} className="p-2 text-red-600 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
                )
            })}
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Tax Rate:</label>
              <input type="number" min="0" max="100" step="0.1" value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value || '0'))} className="w-20 border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"/>
              <span className="text-sm text-gray-600">%</span>
            </div>
            
            <div className="text-right space-y-1">
              <div className="flex justify-between gap-8"><span className="text-sm text-gray-600">Subtotal:</span><span className="font-medium">LKR {subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between gap-8"><span className="text-sm text-gray-600">Tax ({taxRate}%):</span><span className="font-medium">LKR {tax.toFixed(2)}</span></div>
              <div className="flex justify-between gap-8 text-lg font-bold border-t pt-1"><span>Total:</span><span>LKR {total.toFixed(2)}</span></div>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Additional notes or terms..."/>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={loading || isDataLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            {loading ? 'Creating...' : 'Generate Invoice'}
          </button>
        </div>
      </form>
    </Modal>
  );
}