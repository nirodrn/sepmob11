import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useDistributorStockOperations } from '../../../hooks/useDistributorStockOperations';
import { ref, push, set, get, onValue } from 'firebase/database';
import { database } from '../../../config/firebase';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Users, User, FileText, CheckCircle } from 'lucide-react';
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

interface Representative {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export function DistributorManagerInvoiceGeneratorEnhanced() {
  const { userData } = useAuth();
  const { getUserStockSummary, useStock } = useDistributorStockOperations();

  const [recipientType, setRecipientType] = useState<'customer' | 'representative'>('customer');
  const [stockSummary, setStockSummary] = useState<StockSummary[]>([]);
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [releaseSuccess, setReleaseSuccess] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  const [discount, setDiscount] = useState<number>(0);

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    address: '',
    phone: ''
  });

  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [selectedRep, setSelectedRep] = useState<Representative | null>(null);

  useEffect(() => {
    if (userData?.id) {
      loadStockData();
      loadRepresentatives();
    }
  }, [userData]);

  const loadStockData = async () => {
    if (!userData?.id) return;
    setLoading(true);
    try {
      console.log('[Invoice Generator] Loading stock for user:', userData.id);
      const summary = await getUserStockSummary(userData.id);
      console.log('[Invoice Generator] Stock summary received:', summary);
      const availableStock = summary.filter(item => item.availableQuantity > 0);
      console.log('[Invoice Generator] Available stock after filter:', availableStock);
      setStockSummary(availableStock);
    } catch (err) {
      console.error('Error loading stock:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRepresentatives = async () => {
    if (!userData?.id) return;
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);

      if (snapshot.exists()) {
        const users = snapshot.val();
        const reps: Representative[] = [];

        Object.entries(users).forEach(([id, user]: [string, any]) => {
          if (user.role === 'DistributorRepresentative' && user.distributorId === userData.id) {
            reps.push({
              id,
              name: user.name || 'Unknown',
              email: user.email || '',
              phone: user.phone || ''
            });
          }
        });

        setRepresentatives(reps);
      }
    } catch (err) {
      console.error('Error loading representatives:', err);
    }
  };

  const handlePhoneChange = async (phone: string) => {
    setCustomerInfo({ ...customerInfo, phone });

    if (phone.length >= 10) {
      setLoadingCustomer(true);
      try {
        const customersRef = ref(database, 'customers');
        const snapshot = await get(customersRef);

        if (snapshot.exists()) {
          const customers = snapshot.val();
          const customerEntry = Object.values(customers).find(
            (customer: any) => customer.phone === phone || customer.contact === phone
          ) as any;

          if (customerEntry) {
            setCustomerInfo({
              name: customerEntry.name || '',
              address: customerEntry.address || '',
              phone: customerEntry.phone || customerEntry.contact || phone
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

  const selectOptions = stockSummary.map(stock => ({
    value: stock.productId,
    label: `${stock.productName} (Available: ${stock.availableQuantity}, Price: Rs. ${(stock.finalPrice || stock.unitPrice || 0).toFixed(2)})`,
    stock
  }));

  console.log('[Invoice Generator] Select options:', selectOptions);
  console.log('[Invoice Generator] Stock summary state:', stockSummary);
  console.log('[Invoice Generator] Stock summary length:', stockSummary.length);

  const handleProductSelect = (option: any) => {
    if (!option) return;

    const stock = option.stock;
    const existingItem = selectedItems.find(item => item.productId === stock.productId);
    if (existingItem) {
      setReleaseError('Product already added');
      setTimeout(() => setReleaseError(null), 3000);
      return;
    }

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
    const prefix = recipientType === 'representative' ? 'DIST-REP' : 'DIST-CUST';
    return `${prefix}-${timestamp}-${random}`;
  };

  const handleGenerateInvoice = async () => {
    const recipientName = recipientType === 'customer' ? customerInfo.name : selectedRep?.name || '';
    const recipientPhone = recipientType === 'customer' ? customerInfo.phone : selectedRep?.phone || '';

    if (!recipientName.trim() || !recipientPhone.trim()) {
      setReleaseError('Recipient name and phone are required');
      return;
    }

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
        name: recipientName,
        address: recipientType === 'customer' ? customerInfo.address : '',
        phone: recipientPhone
      },
      items: selectedItems,
      discount: discount
    };

    setInvoiceData(invoice);
    await handleReleaseInvoice(invoice);
    setShowInvoicePreview(true);
  };

  const handleReleaseInvoice = async (finalInvoiceData: InvoiceData) => {
    if (!userData?.id) return;
    setReleaseError(null);

    try {
      for (const item of finalInvoiceData.items) {
        await useStock(userData.id, item.productId, item.quantity, `Invoice ${finalInvoiceData.invoiceNo}`);
      }

      if (recipientType === 'customer') {
        const customersRef = ref(database, 'customers');
        const snapshot = await get(customersRef);

        let customerExists = false;
        if (snapshot.exists()) {
          const customers = snapshot.val();
          customerExists = Object.values(customers).some(
            (customer: any) => customer.phone === customerInfo.phone || customer.contact === customerInfo.phone
          );
        }

        if (!customerExists) {
          const newCustomerRef = push(customersRef);
          await set(newCustomerRef, {
            customerId: newCustomerRef.key,
            name: customerInfo.name,
            contact: customerInfo.phone,
            phone: customerInfo.phone,
            address: customerInfo.address,
            createdBy: userData.id,
            createdByName: userData.name,
            createdAt: Date.now(),
            lastUpdated: Date.now()
          });
        }
      }

      const invoiceRef = ref(database, `distributorinvoices/${userData.id}`);
      const newInvoiceRef = push(invoiceRef);

      const invoiceRecord = {
        invoiceId: newInvoiceRef.key,
        invoiceNumber: finalInvoiceData.invoiceNo,
        orderNumber: finalInvoiceData.orderNo,
        distributorId: userData.id,
        distributorName: userData.name,
        recipientType,
        recipientId: recipientType === 'representative' ? selectedRep?.id : undefined,
        recipientName: finalInvoiceData.billTo.name,
        recipientPhone: finalInvoiceData.billTo.phone,
        recipientAddress: finalInvoiceData.billTo.address,
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
      setSelectedRep(null);
      setDiscount(0);
      await loadStockData();

      setTimeout(() => {
        setReleaseSuccess(false);
        setShowInvoicePreview(false);
      }, 1000);
    } catch (err: any) {
      console.error('Error releasing invoice:', err);
      setReleaseError(err.message || 'Failed to release invoice');
    }
  };

  const calculateSubtotal = () => selectedItems.reduce((sum, item) => sum + item.amount, 0);
  const calculateDiscountAmount = () => calculateSubtotal() * (discount / 100);
  const calculateTotal = () => calculateSubtotal() - calculateDiscountAmount();

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
              setSelectedRep(null);
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
    <div className="space-y-6">
      {releaseSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-green-800 font-medium">Invoice generated successfully!</p>
        </div>
      )}

      {releaseError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <ErrorMessage message={releaseError} />
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recipient Type</h3>
        <div className="flex gap-4">
          <button
            onClick={() => setRecipientType('customer')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
              recipientType === 'customer'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="w-5 h-5" />
            Customer
          </button>
          <button
            onClick={() => setRecipientType('representative')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
              recipientType === 'representative'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="w-5 h-5" />
            Representative
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {recipientType === 'customer' ? 'Customer Information' : 'Select Representative'}
        </h3>

        {recipientType === 'customer' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerInfo.phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="0771234567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loadingCustomer}
              />
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                placeholder="123 Main Street"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        ) : (
          <Select
            options={representatives.map(rep => ({
              value: rep.id,
              label: `${rep.name} (${rep.email})`,
              rep
            }))}
            onChange={(option: any) => setSelectedRep(option?.rep || null)}
            placeholder="Select a representative..."
            isClearable
            isSearchable
            className="text-sm"
          />
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Selection</h3>

        {loading ? (
          <LoadingSpinner />
        ) : stockSummary.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No products available</p>
            <p className="text-sm text-gray-500 mt-1">Request stock from HO to start creating invoices</p>
          </div>
        ) : (
          <Select
            options={selectOptions}
            onChange={handleProductSelect}
            placeholder="Search and select a product..."
            isClearable
            isSearchable
            value={null}
          />
        )}

        {selectedItems.length > 0 && (
          <div className="mt-4 space-y-3">
            {selectedItems.map((item, index) => {
              const stock = stockSummary.find(s => s.productId === item.productId);
              return (
                <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{item.description}</h4>
                      <p className="text-xs text-gray-500 mt-1">Available: {stock?.availableQuantity}</p>
                    </div>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-800 transition-colors p-1"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Quantity</label>
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

      {selectedItems.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Summary</h3>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Discount (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold text-gray-900">Rs. {calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Discount ({discount}%):</span>
                <span className="font-semibold text-gray-900">Rs. {calculateDiscountAmount().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                <span className="text-gray-900">Total:</span>
                <span className="text-blue-600">Rs. {calculateTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerateInvoice}
            disabled={selectedItems.length === 0}
            className="w-full mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold"
          >
            <FileText className="w-5 h-5" />
            Generate Invoice & Print
          </button>
        </div>
      )}
    </div>
  );
}
