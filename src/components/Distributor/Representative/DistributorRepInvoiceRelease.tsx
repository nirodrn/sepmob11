import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useDistributorRepStockOperations } from '../../../hooks/useDistributorRepStockOperations';
import { ref, set } from 'firebase/database';
import { database } from '../../../config/firebase';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Package, Plus, Trash2, FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface InvoiceItem {
  productId: string;
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  availableStock: number;
}

interface StockSummary {
  productId: string;
  productName: string;
  availableQuantity: number;
}

interface InvoiceData {
  date: string;
  invoiceNo: string;
  orderNo: string;
  paymentMethod: string;
  billTo: {
    name: string;
    address: string;
    phone: string;
  };
  items: InvoiceItem[];
  discount: number;
}

export function DistributorRepInvoiceRelease() {
  const { userData } = useAuth();
  const { getUserStockSummary, useStock, loading: stockLoading } = useDistributorRepStockOperations();
  const [stockSummary, setStockSummary] = useState<StockSummary[]>([]);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    date: new Date().toISOString().split('T')[0],
    invoiceNo: `INV-${Date.now()}`,
    orderNo: '',
    paymentMethod: 'Cash',
    billTo: {
      name: '',
      address: '',
      phone: '',
    },
    items: [],
    discount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  useEffect(() => {
    if (userData?.id) {
      loadStockData();
    }
  }, [userData]);

  const loadStockData = async () => {
    if (!userData?.id) return;
    try {
      const summary = await getUserStockSummary(userData.id);
      const availableStock = summary.filter(item => item.availableQuantity > 0);
      setStockSummary(availableStock);
    } catch (err) {
      console.error('Error loading stock:', err);
      setError('Failed to load stock data');
    }
  };

  const calculateAmount = (quantity: number, unitPrice: number): number => {
    return quantity * unitPrice;
  };

  const calculateSubtotal = (): number => {
    return invoiceData.items.reduce((sum, item) => sum + item.amount, 0);
  };

  const calculateNetTotal = (): number => {
    const subtotal = calculateSubtotal();
    const discountAmount = subtotal * (invoiceData.discount / 100);
    return subtotal - discountAmount;
  };

  const handleItemChange = (
    index: number,
    field: keyof InvoiceItem,
    value: string | number
  ) => {
    const updatedItems = [...invoiceData.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
    };

    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? Number(value) : updatedItems[index].quantity;
      const maxQuantity = updatedItems[index].availableStock;

      if (quantity > maxQuantity) {
        setError(`Quantity cannot exceed available stock (${maxQuantity})`);
        return;
      }

      updatedItems[index].amount = calculateAmount(
        updatedItems[index].quantity,
        updatedItems[index].unitPrice
      );
    }

    setInvoiceData({ ...invoiceData, items: updatedItems });
    setError(null);
  };

  const addProductToInvoice = () => {
    if (!selectedProduct) {
      setError('Please select a product');
      return;
    }

    const product = stockSummary.find(p => p.productId === selectedProduct);
    if (!product) return;

    const existingItemIndex = invoiceData.items.findIndex(
      item => item.productId === selectedProduct
    );

    if (existingItemIndex !== -1) {
      setError('Product already added to invoice');
      return;
    }

    const newItem: InvoiceItem = {
      productId: product.productId,
      itemCode: product.productId,
      description: product.productName,
      quantity: 1,
      unitPrice: 0,
      amount: 0,
      availableStock: product.availableQuantity,
    };

    setInvoiceData({
      ...invoiceData,
      items: [...invoiceData.items, newItem],
    });
    setSelectedProduct('');
    setError(null);
  };

  const removeItem = (index: number) => {
    const updatedItems = invoiceData.items.filter((_, i) => i !== index);
    setInvoiceData({ ...invoiceData, items: updatedItems });
  };

  const validateInvoice = (): boolean => {
    if (!invoiceData.billTo.name.trim()) {
      setError('Customer name is required');
      return false;
    }

    if (!invoiceData.billTo.phone.trim()) {
      setError('Customer phone is required');
      return false;
    }

    if (invoiceData.items.length === 0) {
      setError('Add at least one product to the invoice');
      return false;
    }

    for (const item of invoiceData.items) {
      if (item.quantity <= 0) {
        setError(`Invalid quantity for ${item.description}`);
        return false;
      }
      if (item.quantity > item.availableStock) {
        setError(`Insufficient stock for ${item.description}. Available: ${item.availableStock}`);
        return false;
      }
      if (item.unitPrice <= 0) {
        setError(`Invalid unit price for ${item.description}`);
        return false;
      }
    }

    return true;
  };

  const handleReleaseInvoice = async () => {
    if (!validateInvoice()) return;
    if (!userData?.id) return;

    setLoading(true);
    setError(null);

    try {
      const invoiceId = `invoice_${Date.now()}`;
      const timestamp = new Date().toISOString();

      for (const item of invoiceData.items) {
        await useStock(userData.id, item.productId, item.quantity, `Invoice: ${invoiceData.invoiceNo}`);
      }

      const invoiceRecord = {
        id: invoiceId,
        invoiceNo: invoiceData.invoiceNo,
        orderNo: invoiceData.orderNo,
        date: invoiceData.date,
        paymentMethod: invoiceData.paymentMethod,
        billTo: invoiceData.billTo,
        items: invoiceData.items.map(item => ({
          productId: item.productId,
          itemCode: item.itemCode,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        })),
        discount: invoiceData.discount,
        subtotal: calculateSubtotal(),
        netTotal: calculateNetTotal(),
        status: 'completed',
        createdBy: userData.id,
        createdByName: userData.name,
        createdAt: timestamp,
        userId: userData.id,
        userRole: userData.role,
      };

      const invoiceRef = ref(database, `disrecinvoices/${userData.id}/invoices/${invoiceId}`);
      await set(invoiceRef, invoiceRecord);

      setSuccess('Invoice released successfully! Stock has been updated.');

      setInvoiceData({
        date: new Date().toISOString().split('T')[0],
        invoiceNo: `INV-${Date.now()}`,
        orderNo: '',
        paymentMethod: 'Cash',
        billTo: {
          name: '',
          address: '',
          phone: '',
        },
        items: [],
        discount: 0,
      });

      await loadStockData();

      setTimeout(() => {
        setSuccess(null);
        setShowInvoiceForm(false);
      }, 3000);
    } catch (err: any) {
      console.error('Error releasing invoice:', err);
      setError(err.message || 'Failed to release invoice');
    } finally {
      setLoading(false);
    }
  };

  if (stockLoading && stockSummary.length === 0) return <LoadingSpinner />;
  if (!userData) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Release Stock with Invoice</h1>
          <p className="text-gray-600 mt-1">Create invoices and release stock to customers</p>
        </div>
        <button
          onClick={() => setShowInvoiceForm(!showInvoiceForm)}
          disabled={stockSummary.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileText className="w-5 h-5" />
          {showInvoiceForm ? 'Cancel' : 'Create New Invoice'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-green-900">Success</h3>
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        </div>
      )}

      {stockSummary.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Stock Available</h3>
          <p className="text-gray-600">
            You need to have stock available before creating invoices. Claim stock from your distributor first.
          </p>
        </div>
      )}

      {showInvoiceForm && stockSummary.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Invoice Details</h2>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Date
                </label>
                <input
                  type="date"
                  value={invoiceData.date}
                  onChange={(e) =>
                    setInvoiceData({ ...invoiceData, date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={invoiceData.invoiceNo}
                  onChange={(e) =>
                    setInvoiceData({ ...invoiceData, invoiceNo: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="INV-00123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order Number
                </label>
                <input
                  type="text"
                  value={invoiceData.orderNo}
                  onChange={(e) =>
                    setInvoiceData({ ...invoiceData, orderNo: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ORD-00456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method
                </label>
                <select
                  value={invoiceData.paymentMethod}
                  onChange={(e) =>
                    setInvoiceData({ ...invoiceData, paymentMethod: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Credit">Credit</option>
                </select>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Customer Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={invoiceData.billTo.name}
                    onChange={(e) =>
                      setInvoiceData({
                        ...invoiceData,
                        billTo: { ...invoiceData.billTo, name: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Customer Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <input
                    type="text"
                    value={invoiceData.billTo.address}
                    onChange={(e) =>
                      setInvoiceData({
                        ...invoiceData,
                        billTo: { ...invoiceData.billTo, address: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={invoiceData.billTo.phone}
                    onChange={(e) =>
                      setInvoiceData({
                        ...invoiceData,
                        billTo: { ...invoiceData.billTo, phone: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Phone Number"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Add Products</h3>
              <div className="flex gap-2 mb-4">
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a product...</option>
                  {stockSummary.map((product) => (
                    <option key={product.productId} value={product.productId}>
                      {product.productName} (Available: {product.availableQuantity})
                    </option>
                  ))}
                </select>
                <button
                  onClick={addProductToInvoice}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              {invoiceData.items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                          Item Code
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                          Description
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                          Available
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                          Unit Price
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {invoiceData.items.map((item, index) => (
                        <tr key={index}>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={item.itemCode}
                              onChange={(e) =>
                                handleItemChange(index, 'itemCode', e.target.value)
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-gray-900">{item.description}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-semibold text-green-600">
                              {item.availableStock}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)
                              }
                              min="1"
                              max={item.availableStock}
                              className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)
                              }
                              min="0"
                              step="0.01"
                              className="w-28 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-semibold text-gray-900">
                              Rs. {item.amount.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {invoiceData.items.length > 0 && (
              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-gray-700">SUBTOTAL:</span>
                    <span className="text-gray-900">Rs. {calculateSubtotal().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-gray-700">DISCOUNT (%):</span>
                    <input
                      type="number"
                      value={invoiceData.discount}
                      onChange={(e) =>
                        setInvoiceData({
                          ...invoiceData,
                          discount: parseFloat(e.target.value) || 0,
                        })
                      }
                      min="0"
                      max="100"
                      className="w-20 text-right px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                    <span className="font-bold text-gray-900">NET TOTAL:</span>
                    <span className="font-bold text-lg text-gray-900">
                      Rs. {calculateNetTotal().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowInvoiceForm(false)}
                disabled={loading}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReleaseInvoice}
                disabled={loading || invoiceData.items.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Releasing...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Release Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
