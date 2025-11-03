import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { ref, push, set, onValue } from 'firebase/database';
import { database } from '../../../config/firebase';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { ShoppingCart, Plus, Trash2, FileText, CheckCircle } from 'lucide-react';
import InvoiceGenerator from '../../Common/InvoiceGenerator';

interface StockSummary {
  productId: string;
  productName: string;
  availableQuantity: number;
  unitPrice?: number;
  finalPrice?: number;
}

interface InvoiceItem {
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  productId: string;
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

export function DSStaffInvoiceGenerator() {
  const { userData } = useAuth();
  const [stockSummary, setStockSummary] = useState<StockSummary[]>([]);
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [releaseSuccess, setReleaseSuccess] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userData?.id) {
      loadStockData();
    }
  }, [userData]);

  const loadStockData = () => {
    if (!userData?.showroomId) return;
    setLoading(true);

    const stockRef = ref(database, `dsstock/${userData.showroomId}`);
    onValue(stockRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const summary: StockSummary[] = [];

        Object.entries(data).forEach(([productId, productData]: [string, any]) => {
          const available = productData.availableQuantity || 0;
          if (available > 0) {
            summary.push({
              productId,
              productName: productData.productName || 'Unknown Product',
              availableQuantity: available,
              unitPrice: productData.unitPrice,
              finalPrice: productData.finalPrice
            });
          }
        });

        setStockSummary(summary);
      } else {
        setStockSummary([]);
      }
      setLoading(false);
    });
  };

  const addItemToInvoice = (stock: StockSummary) => {
    const existingItem = selectedItems.find(item => item.productId === stock.productId);
    if (existingItem) return;

    const newItem: InvoiceItem = {
      itemCode: stock.productId.substring(0, 8).toUpperCase(),
      description: stock.productName,
      quantity: 1,
      unitPrice: stock.finalPrice || stock.unitPrice || 0,
      amount: stock.finalPrice || stock.unitPrice || 0,
      productId: stock.productId
    };

    setSelectedItems([...selectedItems, newItem]);
  };

  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    const stock = stockSummary.find(s => s.productId === selectedItems[index].productId);
    if (!stock) return;

    const validQuantity = Math.min(Math.max(1, quantity), stock.availableQuantity);
    const updatedItems = [...selectedItems];
    updatedItems[index].quantity = validQuantity;
    updatedItems[index].amount = validQuantity * updatedItems[index].unitPrice;
    setSelectedItems(updatedItems);
  };

  const updateItemPrice = (index: number, price: number) => {
    const updatedItems = [...selectedItems];
    updatedItems[index].unitPrice = price;
    updatedItems[index].amount = price * updatedItems[index].quantity;
    setSelectedItems(updatedItems);
  };

  const generateInvoiceNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `DS-INV-${timestamp}-${random}`;
  };

  const handlePrepareInvoice = () => {
    if (selectedItems.length === 0) {
      setReleaseError('Please add at least one item to the invoice');
      return;
    }

    const invoice: InvoiceData = {
      date: new Date().toISOString().split('T')[0],
      invoiceNo: generateInvoiceNumber(),
      orderNo: `ORD-${Date.now()}`,
      paymentMethod: 'Cash',
      billTo: {
        name: '',
        address: '',
        phone: ''
      },
      items: selectedItems,
      discount: 0
    };

    setInvoiceData(invoice);
    setShowInvoicePreview(true);
  };

  const handleReleaseInvoice = async (finalInvoiceData: InvoiceData) => {
    if (!userData?.id || !userData?.showroomId) return;
    setReleaseError(null);

    try {
      for (const item of finalInvoiceData.items) {
        const stockRef = ref(database, `dsstock/${userData.showroomId}/${item.productId}`);
        const currentStockSnapshot = await new Promise<any>((resolve) => {
          onValue(stockRef, (snapshot) => resolve(snapshot.val()), { onlyOnce: true });
        });

        if (currentStockSnapshot) {
          const newAvailable = (currentStockSnapshot.availableQuantity || 0) - item.quantity;
          await set(ref(database, `dsstock/${userData.showroomId}/${item.productId}/availableQuantity`), newAvailable);
        }
      }

      const invoiceHistoryRef = ref(database, 'directshopinvoicehistory');
      const newInvoiceRef = push(invoiceHistoryRef);

      const invoiceRecord = {
        invoiceId: newInvoiceRef.key,
        invoiceNumber: finalInvoiceData.invoiceNo,
        orderNumber: finalInvoiceData.orderNo,
        staffId: userData.id,
        staffName: userData.name,
        staffEmail: userData.email,
        showroomId: userData.showroomId,
        customerName: finalInvoiceData.billTo.name,
        customerAddress: finalInvoiceData.billTo.address,
        customerPhone: finalInvoiceData.billTo.phone,
        items: finalInvoiceData.items.map(item => ({
          productId: item.productId,
          productName: item.description,
          itemCode: item.itemCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount
        })),
        subtotal: finalInvoiceData.items.reduce((sum, item) => sum + item.amount, 0),
        discount: finalInvoiceData.discount,
        discountAmount: finalInvoiceData.items.reduce((sum, item) => sum + item.amount, 0) * (finalInvoiceData.discount / 100),
        total: finalInvoiceData.items.reduce((sum, item) => sum + item.amount, 0) * (1 - finalInvoiceData.discount / 100),
        paymentMethod: finalInvoiceData.paymentMethod,
        status: 'issued',
        createdAt: new Date().toISOString(),
        createdTimestamp: Date.now()
      };

      await set(newInvoiceRef, invoiceRecord);

      setReleaseSuccess(true);
      setSelectedItems([]);
      loadStockData();

      setTimeout(() => {
        setReleaseSuccess(false);
        setShowInvoicePreview(false);
      }, 1000);
    } catch (err: any) {
      console.error('Error releasing invoice:', err);
      setReleaseError(err.message || 'Failed to release invoice');
    }
  };

  if (!userData) return null;

  if (showInvoicePreview && invoiceData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between no-print">
          <h2 className="text-xl font-bold text-gray-900">Invoice Preview</h2>
          <button
            onClick={() => setShowInvoicePreview(false)}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            Back to Selection
          </button>
        </div>
        <InvoiceGenerator
          initialData={invoiceData}
          onSave={handleReleaseInvoice}
          readOnly={false}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Generate Invoice</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Select products from your stock and create customer invoices</p>
        </div>
      </div>

      {releaseSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-green-800 font-medium">Invoice released successfully! Stock has been updated.</p>
        </div>
      )}

      {releaseError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <ErrorMessage message={releaseError} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Available Stock</h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Click on a product to add it to the invoice</p>
          </div>

          {loading && <LoadingSpinner />}

          {!loading && (
            <div className="p-3 sm:p-4 space-y-2 max-h-[400px] sm:max-h-[600px] overflow-y-auto">
              {stockSummary.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No stock available</p>
                </div>
              ) : (
                stockSummary.map((stock) => {
                  const isSelected = selectedItems.some(item => item.productId === stock.productId);
                  return (
                    <button
                      key={stock.productId}
                      onClick={() => !isSelected && addItemToInvoice(stock)}
                      disabled={isSelected}
                      className={`w-full text-left p-3 sm:p-4 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-60'
                          : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm sm:text-base font-semibold text-gray-900">{stock.productName}</h3>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-2 text-xs sm:text-sm">
                            <span className="text-gray-600">
                              Available: <span className="font-semibold text-green-600">{stock.availableQuantity}</span>
                            </span>
                            {(stock.finalPrice || stock.unitPrice) && (
                              <span className="text-gray-600">
                                Price: <span className="font-semibold text-gray-900">Rs. {(stock.finalPrice || stock.unitPrice)?.toFixed(2)}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        {!isSelected && (
                          <Plus className="w-5 h-5 text-blue-600" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
              Invoice Items ({selectedItems.length})
            </h2>
          </div>

          <div className="p-3 sm:p-4 space-y-2 sm:space-y-3 max-h-[400px] sm:max-h-[600px] overflow-y-auto">
            {selectedItems.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600">No items selected</p>
                <p className="text-sm text-gray-500 mt-1">Add products from your stock to create an invoice</p>
              </div>
            ) : (
              selectedItems.map((item, index) => {
                const stock = stockSummary.find(s => s.productId === item.productId);
                return (
                  <div key={index} className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50">
                    <div className="flex items-start justify-between mb-2 sm:mb-3">
                      <div className="flex-1">
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900">{item.description}</h3>
                        <p className="text-xs text-gray-500 mt-1">Code: {item.itemCode}</p>
                      </div>
                      <button
                        onClick={() => removeItem(index)}
                        className="text-red-600 hover:text-red-800 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">
                          Quantity (Max: {stock?.availableQuantity})
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={stock?.availableQuantity}
                          value={item.quantity}
                          onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Unit Price (Rs.)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="pt-2 border-t border-gray-300">
                        <div className="flex justify-between items-center">
                          <span className="text-xs sm:text-sm font-medium text-gray-700">Amount:</span>
                          <span className="text-base sm:text-lg font-bold text-gray-900">Rs. {item.amount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {selectedItems.length > 0 && (
            <div className="p-3 sm:p-4 border-t border-gray-200 bg-gray-50">
              <div className="space-y-2 mb-3 sm:mb-4">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold text-gray-900">
                    Rs. {selectedItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                onClick={handlePrepareInvoice}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                Prepare Invoice
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
