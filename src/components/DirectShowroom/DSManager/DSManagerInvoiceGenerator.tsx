import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { ref, push, set, onValue, get, update } from 'firebase/database';
import { database } from '../../../config/firebase';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Plus, Trash2, FileText, CircleCheck as CheckCircle } from 'lucide-react';
import Select from 'react-select';
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

interface CustomerInfo {
  name: string;
  address: string;
  phone: string;
}

interface SelectOption {
  value: string;
  label: string;
  availableQuantity: number;
  unitPrice: number;
}

export function DSManagerInvoiceGenerator() {
  const { userData } = useAuth();
  const [stockSummary, setStockSummary] = useState<StockSummary[]>([]);
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [releaseSuccess, setReleaseSuccess] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    address: '',
    phone: ''
  });
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [discount, setDiscount] = useState<number>(0);
  const [invoiceMaker, setInvoiceMaker] = useState<string>('');

  useEffect(() => {
    if (userData?.id) {
      loadStockData();
      setInvoiceMaker(userData.name || '');
    }
  }, [userData]);

  const loadStockData = () => {
    if (!userData?.id) return;
    setLoading(true);

    const stockSummaryRef = ref(database, `dsstock/users/${userData.id}/summary`);
    onValue(stockSummaryRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const summary: StockSummary[] = [];

        Object.entries(data).forEach(([productId, productData]: [string, any]) => {
          const availableQty = productData.availableQuantity || 0;
          if (availableQty > 0) {
            summary.push({
              productId,
              productName: productData.productName || 'Unknown Product',
              availableQuantity: availableQty,
              unitPrice: productData.unitPrice,
              finalPrice: productData.finalPrice || productData.unitPrice
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

  const handlePhoneChange = async (phone: string) => {
    setCustomerInfo({ ...customerInfo, phone });

    if (phone.length >= 10) {
      setLoadingCustomer(true);
      try {
        const customersRef = ref(database, 'dscustomers');
        const snapshot = await get(customersRef);

        if (snapshot.exists()) {
          const customers = snapshot.val();
          const customerEntry = Object.values(customers).find(
            (customer: any) => customer.phone === phone
          ) as any;

          if (customerEntry) {
            setCustomerInfo({
              name: customerEntry.name || '',
              address: customerEntry.address || '',
              phone: customerEntry.phone || phone
            });
          }
        }
      } catch (err) {
        console.error('Error loading customer:', err);
      } finally {
        setLoadingCustomer(false);
      }
    }
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

  const handleGenerateInvoice = async () => {
    if (!customerInfo.name.trim() || !customerInfo.phone.trim()) {
      setReleaseError('Customer name and phone are required');
      return;
    }

    if (selectedItems.length === 0) {
      setReleaseError('Please add at least one item to the invoice');
      return;
    }

    try {
      const customersRef = ref(database, 'dscustomers');
      const snapshot = await get(customersRef);

      let customerExists = false;
      if (snapshot.exists()) {
        const customers = snapshot.val();
        customerExists = Object.values(customers).some(
          (customer: any) => customer.phone === customerInfo.phone
        );
      }

      if (!customerExists) {
        const newCustomerRef = push(customersRef);
        await set(newCustomerRef, {
          customerId: newCustomerRef.key,
          name: customerInfo.name,
          address: customerInfo.address,
          phone: customerInfo.phone,
          createdBy: userData?.id,
          createdByName: userData?.name,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
      }

      const invoice: InvoiceData = {
        date: new Date().toISOString().split('T')[0],
        invoiceNo: generateInvoiceNumber(),
        orderNo: `ORD-${Date.now()}`,
        paymentMethod: 'Cash',
        billTo: {
          name: customerInfo.name,
          address: customerInfo.address,
          phone: customerInfo.phone
        },
        items: selectedItems,
        discount: discount
      };

      setInvoiceData(invoice);
      await handleReleaseInvoice(invoice);
      setShowInvoicePreview(true);
    } catch (err: any) {
      console.error('Error generating invoice:', err);
      setReleaseError(err.message || 'Failed to generate invoice');
    }
  };

  const handleReleaseInvoice = async (finalInvoiceData: InvoiceData) => {
    if (!userData?.id) return;
    setReleaseError(null);

    try {
      for (const item of finalInvoiceData.items) {
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
          throw new Error(`Insufficient stock for ${item.description}`);
        }

        await update(ref(database), updates);

        const summaryRef = ref(database, `dsstock/users/${userData.id}/summary/${item.productId}`);
        const summarySnapshot = await get(summaryRef);
        if (summarySnapshot.exists()) {
          const summary = summarySnapshot.val();
          await set(summaryRef, {
            ...summary,
            availableQuantity: summary.availableQuantity - item.quantity,
            usedQuantity: (summary.usedQuantity || 0) + item.quantity,
            lastUpdated: new Date().toISOString()
          });
        }
      }

      if (!userData.showroom_id) {
        throw new Error('No showroom assigned to this manager');
      }

      const showroomRef = ref(database, `direct_showrooms/${userData.showroom_id}`);
      const showroomSnapshot = await get(showroomRef);

      if (!showroomSnapshot.exists()) {
        throw new Error('Showroom not found');
      }

      const showroomData = showroomSnapshot.val();

      const invoiceRef = ref(database, `direct_showrooms/${userData.showroom_id}/dsinvoices`);
      const newInvoiceRef = push(invoiceRef);

      const invoiceRecord = {
        invoiceId: newInvoiceRef.key,
        invoiceNumber: finalInvoiceData.invoiceNo,
        orderNumber: finalInvoiceData.orderNo,
        showroomId: userData.showroom_id,
        showroomName: showroomData.name,
        showroomCode: showroomData.code,
        managerId: userData.id,
        managerName: userData.name,
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
      setCustomerInfo({ name: '', address: '', phone: '' });
      setCurrentStep('customer');
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

  const selectOptions: SelectOption[] = stockSummary.map(stock => ({
    value: stock.productId,
    label: `${stock.productName} (Available: ${stock.availableQuantity}, Price: Rs. ${(stock.finalPrice || stock.unitPrice)?.toFixed(2)})`,
    availableQuantity: stock.availableQuantity,
    unitPrice: stock.finalPrice || stock.unitPrice || 0
  }));

  const handleProductSelect = (option: SelectOption | null) => {
    if (!option) return;

    const existingItem = selectedItems.find(item => item.productId === option.value);
    if (existingItem) {
      setReleaseError('Product already added');
      setTimeout(() => setReleaseError(null), 3000);
      return;
    }

    const stock = stockSummary.find(s => s.productId === option.value);
    if (!stock) return;

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

  const calculateSubtotal = () => {
    return selectedItems.reduce((sum, item) => sum + item.amount, 0);
  };

  const calculateDiscountAmount = () => {
    return calculateSubtotal() * (discount / 100);
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscountAmount();
  };


  if (!userData) return null;

  if (showInvoicePreview && invoiceData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between no-print">
          <h2 className="text-xl font-bold text-gray-900">Invoice Preview</h2>
          <button
            onClick={() => {
              setShowInvoicePreview(false);
              setSelectedItems([]);
              setCustomerInfo({ name: '', address: '', phone: '' });
              setDiscount(0);
            }}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            New Invoice
          </button>
        </div>
        <InvoiceGenerator
          initialData={invoiceData}
          onSave={() => {}}
          readOnly={true}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Generate Invoice</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Create invoices with all details in one form</p>
        </div>
      </div>

      {releaseSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-green-800 font-medium">Invoice generated successfully! Stock has been updated.</p>
        </div>
      )}

      {releaseError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <ErrorMessage message={releaseError} />
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="space-y-4 sm:space-y-6">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Customer Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerInfo.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="0771234567"
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loadingCustomer}
                />
                {loadingCustomer && (
                  <p className="text-xs text-blue-600 mt-1">Loading...</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={customerInfo.address}
                  onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                  placeholder="123 Main Street, Colombo"
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 sm:pt-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Product Selection</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Product
              </label>
              {loading ? (
                <LoadingSpinner />
              ) : (
                <Select
                  options={selectOptions}
                  onChange={handleProductSelect}
                  placeholder="Search and select a product..."
                  isClearable
                  isSearchable
                  className="text-sm"
                  value={null}
                />
              )}
            </div>

            {selectedItems.length > 0 && (
              <div className="space-y-2 sm:space-y-3">
                {selectedItems.map((item, index) => {
                  const stock = stockSummary.find(s => s.productId === item.productId);
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-3 sm:p-4 bg-gray-50">
                      <div className="flex items-start justify-between mb-2 sm:mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 text-xs sm:text-sm">{item.description}</h3>
                          <p className="text-xs text-gray-500 mt-1">Available: {stock?.availableQuantity}</p>
                        </div>
                        <button
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={stock?.availableQuantity}
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                            className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Price (Rs.)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Amount</label>
                          <div className="px-2 py-2 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded">
                            Rs. {item.amount.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4 sm:pt-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Invoice Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Maker
                </label>
                <input
                  type="text"
                  value={invoiceMaker}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                />
              </div>
            </div>

            <div className="mt-4 sm:mt-6 bg-gray-50 rounded-lg p-3 sm:p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold text-gray-900">
                    Rs. {calculateSubtotal().toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount ({discount}%):</span>
                  <span className="font-semibold text-gray-900">
                    Rs. {calculateDiscountAmount().toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                  <span className="text-gray-900">Total:</span>
                  <span className="text-blue-600">
                    Rs. {calculateTotal().toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
            <button
              onClick={handleGenerateInvoice}
              disabled={!customerInfo.name.trim() || !customerInfo.phone.trim() || selectedItems.length === 0}
              className="w-full sm:w-auto bg-blue-600 text-white px-6 sm:px-8 py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold text-sm sm:text-base"
            >
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
              Generate Invoice & Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
