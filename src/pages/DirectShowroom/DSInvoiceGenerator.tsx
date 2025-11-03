import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ref, push, set, onValue, get, update } from 'firebase/database';
import { database } from '../../config/firebase';
import { LoadingSpinner } from '../../components/Common/LoadingSpinner';
import { ErrorMessage } from '../../components/Common/ErrorMessage';
import { Plus, Trash2, FileText, CircleCheck as CheckCircle, Calendar } from 'lucide-react';

interface Product {
  productId: string;
  productName: string;
  availableQuantity: number;
  unitPrice: number;
  finalPrice?: number;
}

interface InvoiceItem {
  productId: string;
  productName: string;
  itemCode: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export default function DSInvoiceGenerator() {
  const { userData } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [selectedProductId, setSelectedProductId] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([]);

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (userData?.showroomId) {
      loadProducts();
      generateInvoiceNumber();
      generateOrderNumber();
    }
  }, [userData]);

  const loadProducts = () => {
    if (!userData?.id) return;
    setLoading(true);

    const stockSummaryRef = ref(database, `dsstock/users/${userData.id}/summary`);
    onValue(stockSummaryRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const productList: Product[] = [];

        Object.entries(data).forEach(([productId, productData]: [string, any]) => {
          const availableQty = productData.availableQuantity || 0;
          if (availableQty > 0) {
            productList.push({
              productId,
              productName: productData.productName || 'Unknown Product',
              availableQuantity: availableQty,
              unitPrice: productData.unitPrice || 0,
              finalPrice: productData.finalPrice || productData.unitPrice || 0
            });
          }
        });

        setProducts(productList);
      } else {
        setProducts([]);
      }
      setLoading(false);
    });
  };

  const generateInvoiceNumber = () => {
    const timestamp = Date.now();
    setInvoiceNumber(`INV-${timestamp}`);
  };

  const generateOrderNumber = () => {
    const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    setOrderNumber(`ORD-${randomNum}`);
  };

  const handleAddProduct = () => {
    if (!selectedProductId) {
      setErrorMessage('Please select a product');
      return;
    }

    const product = products.find(p => p.productId === selectedProductId);
    if (!product) return;

    const existingItem = items.find(item => item.productId === selectedProductId);
    if (existingItem) {
      setErrorMessage('Product already added to invoice');
      return;
    }

    const price = product.finalPrice || product.unitPrice || 0;
    const newItem: InvoiceItem = {
      productId: product.productId,
      productName: product.productName,
      itemCode: product.productId.substring(0, 8).toUpperCase(),
      quantity: 1,
      unitPrice: price,
      amount: price
    };

    setItems([...items, newItem]);
    setSelectedProductId('');
    setErrorMessage('');
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    const product = products.find(p => p.productId === items[index].productId);
    if (!product) return;

    const validQuantity = Math.min(Math.max(1, quantity), product.availableQuantity);
    const updatedItems = [...items];
    updatedItems[index].quantity = validQuantity;
    updatedItems[index].amount = validQuantity * updatedItems[index].unitPrice;
    setItems(updatedItems);
  };

  const handlePriceChange = (index: number, price: number) => {
    const updatedItems = [...items];
    updatedItems[index].unitPrice = Math.max(0, price);
    updatedItems[index].amount = updatedItems[index].quantity * price;
    setItems(updatedItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.amount, 0);
  };

  const handleReleaseInvoice = async () => {
    if (!userData?.id || !userData?.showroomId) return;

    if (!customerName.trim()) {
      setErrorMessage('Customer name is required');
      return;
    }

    if (!customerPhone.trim()) {
      setErrorMessage('Customer phone number is required');
      return;
    }

    if (items.length === 0) {
      setErrorMessage('Please add at least one product to the invoice');
      return;
    }

    setSaving(true);
    setErrorMessage('');

    try {
      for (const item of items) {
        const entriesRef = ref(database, `dsstock/users/${userData.id}/entries`);
        const entriesSnapshot = await get(entriesRef);

        if (!entriesSnapshot.exists()) {
          throw new Error('No stock entries found');
        }

        const entries = entriesSnapshot.val();
        const productEntries = Object.entries(entries)
          .map(([id, entry]: [string, any]) => ({ id, ...entry }))
          .filter((entry: any) => entry.productId === item.productId && entry.availableQuantity > 0)
          .sort((a: any, b: any) => new Date(a.claimedAt).getTime() - new Date(b.claimedAt).getTime());

        let remainingToUse = item.quantity;
        const updates: Record<string, any> = {};

        for (const entry of productEntries) {
          if (remainingToUse <= 0) break;

          const useFromThisEntry = Math.min(remainingToUse, entry.availableQuantity);
          const newAvailableQuantity = entry.availableQuantity - useFromThisEntry;
          const newUsedQuantity = entry.usedQuantity + useFromThisEntry;

          updates[`dsstock/users/${userData.id}/entries/${entry.id}/availableQuantity`] = newAvailableQuantity;
          updates[`dsstock/users/${userData.id}/entries/${entry.id}/usedQuantity`] = newUsedQuantity;
          updates[`dsstock/users/${userData.id}/entries/${entry.id}/status`] = newAvailableQuantity === 0 ? 'depleted' : 'available';
          updates[`dsstock/users/${userData.id}/entries/${entry.id}/lastUpdated`] = new Date().toISOString();

          remainingToUse -= useFromThisEntry;
        }

        if (remainingToUse > 0) {
          throw new Error(`Insufficient stock for ${item.productName}`);
        }

        await update(ref(database), updates);

        const summaryRef = ref(database, `dsstock/users/${userData.id}/summary/${item.productId}`);
        const summarySnapshot = await get(summaryRef);
        if (summarySnapshot.exists()) {
          const summary = summarySnapshot.val();
          await set(summaryRef, {
            ...summary,
            availableQuantity: summary.availableQuantity - item.quantity,
            usedQuantity: summary.usedQuantity + item.quantity,
            lastUpdated: new Date().toISOString()
          });
        }
      }

      const invoiceHistoryRef = ref(database, 'directshopinvoicehistory');
      const newInvoiceRef = push(invoiceHistoryRef);

      const invoiceRecord = {
        invoiceId: newInvoiceRef.key,
        invoiceNumber,
        orderNumber,
        invoiceDate,
        managerId: userData.id,
        managerName: userData.name,
        managerEmail: userData.email,
        showroomId: userData.showroomId,
        customerName,
        customerAddress,
        customerPhone,
        items: items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          itemCode: item.itemCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount
        })),
        subtotal: calculateSubtotal(),
        discount: 0,
        discountAmount: 0,
        total: calculateSubtotal(),
        paymentMethod,
        status: 'issued',
        createdAt: new Date().toISOString(),
        createdTimestamp: Date.now()
      };

      await set(newInvoiceRef, invoiceRecord);

      setSuccessMessage('Invoice released successfully!');

      setItems([]);
      setCustomerName('');
      setCustomerAddress('');
      setCustomerPhone('');
      generateInvoiceNumber();
      generateOrderNumber();
      loadProducts();

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err: any) {
      console.error('Error releasing invoice:', err);
      setErrorMessage(err.message || 'Failed to release invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setItems([]);
    setCustomerName('');
    setCustomerAddress('');
    setCustomerPhone('');
    setSelectedProductId('');
    generateInvoiceNumber();
    generateOrderNumber();
    setErrorMessage('');
  };

  if (!userData) return null;

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Release Stock with Invoice</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Create invoices and release stock to customers</p>
        </div>
        <button
          onClick={handleCancel}
          className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <FileText className="w-4 h-4 sm:w-5 sm:h-5 inline mr-2" />
          Cancel
        </button>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-green-800 font-medium">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <ErrorMessage message={errorMessage} />
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">Invoice Details</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invoice Date
            </label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invoice Number
            </label>
            <input
              type="text"
              value={invoiceNumber}
              readOnly
              className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Order Number
            </label>
            <input
              type="text"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="ORD-00456"
              className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Credit">Credit</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
        </div>

        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Customer Details</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer Name"
              className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <input
              type="text"
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="Address"
              className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone Number"
              className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Add Products</h3>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex-1">
            {loading ? (
              <div className="py-2">
                <LoadingSpinner />
              </div>
            ) : (
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a product...</option>
                {products.map((product) => (
                  <option key={product.productId} value={product.productId}>
                    {product.productName} - Available: {product.availableQuantity} - Rs. {(product.finalPrice || product.unitPrice).toFixed(2)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={handleAddProduct}
            disabled={!selectedProductId || loading}
            className="w-full sm:w-auto bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            Add
          </button>
        </div>

        {items.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-x-auto mb-4 sm:mb-6">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Product</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-semibold text-gray-900">Item Code</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-900">Quantity</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900">Unit Price</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900">Amount</th>
                  <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-semibold text-gray-900">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, index) => {
                  const product = products.find(p => p.productId === item.productId);
                  return (
                    <tr key={index}>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">{item.productName}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">{item.itemCode}</td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <input
                          type="number"
                          min="1"
                          max={product?.availableQuantity}
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                          className="w-16 sm:w-20 px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handlePriceChange(index, parseFloat(e.target.value) || 0)}
                          className="w-20 sm:w-28 px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900">
                        Rs. {item.amount.toFixed(2)}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="bg-gray-50 px-3 sm:px-4 py-3 border-t border-gray-200">
              <div className="flex justify-end">
                <div className="w-full sm:w-64">
                  <div className="flex justify-between items-center text-base sm:text-lg font-bold text-gray-900">
                    <span>Total:</span>
                    <span>Rs. {calculateSubtotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
          <button
            onClick={handleCancel}
            className="w-full sm:w-auto px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm sm:text-base"
          >
            Cancel
          </button>
          <button
            onClick={handleReleaseInvoice}
            disabled={saving || items.length === 0}
            className="w-full sm:w-auto bg-blue-600 text-white px-6 sm:px-8 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            {saving ? 'Releasing...' : 'Release Invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
