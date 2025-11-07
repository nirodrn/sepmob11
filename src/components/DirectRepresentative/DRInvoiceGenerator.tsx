import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebaseData, useFirebaseActions } from '../../hooks/useFirebaseData';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { ErrorMessage } from '../Common/ErrorMessage';
import { ShoppingCart, Trash2, FileText, X } from 'lucide-react';
import InvoiceGenerator from '../Common/InvoiceGenerator';
import CreatableSelect from 'react-select/creatable';

// --- Interfaces ---
interface StockSummary { productName: string; availableQuantity: number; unitPrice: number; productId: string; }
interface InvoiceItem { itemCode: string; description: string; quantity: number; unitPrice: number; amount: number; productId: string; }
interface Customer { id: string; name: string; address: string; phone: string; }
interface InvoiceData { date: string; invoiceNo: string; orderNo: string; paymentMethod: string; billTo: Customer; items: InvoiceItem[]; discount: number; }

export function DRInvoiceGenerator() {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const { addData, updateData } = useFirebaseActions();
  const { data: drStockData, loading: stockLoading, error: stockError } = useFirebaseData<any>('drstock');
  const { data: customersData, loading: customersLoading, error: customersError } = useFirebaseData<any>('customers');

  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{ label: string; value: any; __isNew__?: boolean } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [isProcessing, setIsProcessing] = useState(false);
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const stockSummary = useMemo((): StockSummary[] => {
    if (!drStockData || !userData) return [];
    const userEntriesData = drStockData.users?.[userData.id]?.entries;
    if (!userEntriesData) return [];
    const summary: { [key: string]: StockSummary } = {};
    Object.values(userEntriesData).forEach((entry: any) => {
        if (!entry.productName || (entry.availableQuantity || 0) <= 0) return;
        if (!summary[entry.productName]) {
            summary[entry.productName] = { productName: entry.productName, productId: entry.productId, availableQuantity: 0, unitPrice: entry.finalPrice || entry.unitPrice || 0 };
        }
        summary[entry.productName].availableQuantity += entry.availableQuantity || 0;
    });
    return Object.values(summary);
  }, [drStockData, userData]);

  const customerOptions = useMemo(() => {
    if (!customersData) return [];
    return Object.entries(customersData).map(([id, customer]: [string, any]) => ({
      label: `${customer.name} - ${customer.address}`,
      value: { id, ...customer },
    }));
  }, [customersData]);

  const handleCustomerChange = (option: any) => {
    if (option?.__isNew__) { setNewCustomerAddress(''); setNewCustomerPhone(''); }
    setSelectedCustomer(option);
  };
  
  const updateItemQuantity = (index: number, quantity: number) => {
    const stock = stockSummary.find(s => s.productName === selectedItems[index].description);
    if (!stock) return;
    const validQuantity = Math.min(Math.max(1, quantity), stock.availableQuantity);
    const updatedItems = [...selectedItems];
    updatedItems[index].quantity = validQuantity;
    updatedItems[index].amount = validQuantity * updatedItems[index].unitPrice;
    setSelectedItems(updatedItems);
  };

  const updateItemPrice = (index: number, price: number) => {
    const updatedItems = [...selectedItems];
    const newPrice = Math.max(0, price);
    updatedItems[index].unitPrice = newPrice;
    updatedItems[index].amount = newPrice * updatedItems[index].quantity;
    setSelectedItems(updatedItems);
  };

  const addItemToInvoice = (stock: StockSummary) => {
    setSelectedItems(prev => [...prev, { itemCode: stock.productId.substring(0, 8).toUpperCase(), description: stock.productName, quantity: 1, unitPrice: stock.unitPrice, amount: stock.unitPrice, productId: stock.productId }]);
  };

  const handlePrepareInvoice = () => {
    if (selectedItems.length === 0) { alert('Please select items first.'); return; }
    setShowCustomerModal(true);
  };

  const handleGenerateFinalInvoice = async () => {
    if (!selectedCustomer) { alert('Please select or create a customer.'); return; }
    setIsProcessing(true);
    let customerForInvoice: Customer;
    if (selectedCustomer.__isNew__) {
        const name = selectedCustomer.value.trim();
        if (!name || !newCustomerAddress.trim() || !newCustomerPhone.trim()) {
            alert('Please fill in all details for the new customer.');
            setIsProcessing(false);
            return;
        }
        try {
            const newCustomerData = { name, address: newCustomerAddress, phone: newCustomerPhone, createdBy: userData.id, createdAt: new Date().toISOString() };
            const newId = await addData('customers', newCustomerData);
            if (!newId) throw new Error("Failed to save customer.");
            customerForInvoice = { id: newId, ...newCustomerData };
        } catch (error) {
            alert(`Error creating customer: ${(error as Error).message}`);
            setIsProcessing(false);
            return;
        }
    } else {
        customerForInvoice = selectedCustomer.value;
    }
    const finalInvoiceData: InvoiceData = {
      date: new Date().toISOString().split('T')[0], invoiceNo: `DR-INV-${Date.now()}`, orderNo: `ORD-${Date.now()}`,
      paymentMethod: paymentMethod, billTo: customerForInvoice, items: selectedItems, discount: 0,
    };
    setInvoiceData(finalInvoiceData);
    setShowCustomerModal(false);
    setShowInvoicePreview(true);
    setIsProcessing(false);
  };
  
  const handleReleaseInvoice = async (finalInvoiceData: InvoiceData) => {
    if (!userData || !drStockData) { alert("Missing user or stock data. Cannot proceed."); return; }
    setIsProcessing(true);
    try {
        const invoiceId = await addData('invoices', { ...finalInvoiceData, status: 'completed', createdBy: userData.id });
        if (!invoiceId) throw new Error("Failed to save the invoice.");

        const userStockEntries = drStockData.users?.[userData.id]?.entries;
        if (!userStockEntries) throw new Error("Could not find user\'s stock entries.");

        const stockUpdates: { [path: string]: any } = {};
        for (const item of finalInvoiceData.items) {
            let quantityToDeduct = item.quantity;
            const relevantEntryIds = Object.keys(userStockEntries)
                .filter(id => userStockEntries[id].productId === item.productId && userStockEntries[id].availableQuantity > 0)
                .sort((a, b) => new Date(userStockEntries[a].claimedAt).getTime() - new Date(userStockEntries[b].claimedAt).getTime());

            for (const entryId of relevantEntryIds) {
                if (quantityToDeduct <= 0) break;
                const entry = userStockEntries[entryId];
                const deductAmount = Math.min(quantityToDeduct, entry.availableQuantity);
                
                const entryPath = `users/${userData.id}/entries/${entryId}`;
                stockUpdates[`${entryPath}/availableQuantity`] = entry.availableQuantity - deductAmount;
                stockUpdates[`${entryPath}/usedQuantity`] = (entry.usedQuantity || 0) + deductAmount;
                stockUpdates[`${entryPath}/lastUpdated`] = new Date().toISOString();
                
                quantityToDeduct -= deductAmount;
            }
            if (quantityToDeduct > 0) throw new Error(`Stock discrepancy for ${item.description}. Please refresh and try again.`);
        }

        await updateData('drstock', stockUpdates);

        alert('Invoice generated and stock updated successfully!');
        navigate('/inventory'); // Navigate to inventory to see updated stock

    } catch (error) {
        console.error('Invoice release failed:', error);
        alert(`Error: ${(error as Error).message}`);
    } finally {
        setIsProcessing(false);
    }
  };

  if (stockLoading) return <LoadingSpinner text="Loading available stock..." />;
  if (stockError) return <ErrorMessage message={`Error loading stock: ${stockError.message}`} />;
  if (showInvoicePreview && invoiceData) return <InvoiceGenerator initialData={invoiceData} onSave={handleReleaseInvoice} readOnly={false} onSaveLoading={isProcessing} />;

  return (
    <div className="space-y-6">
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-8 space-y-5 w-full max-w-lg">
              <div className="flex justify-between items-center"><h2 className="text-2xl font-bold text-gray-800">Customer & Payment Details</h2><button onClick={() => setShowCustomerModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
              <div className="space-y-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label><CreatableSelect options={customerOptions} value={selectedCustomer} onChange={handleCustomerChange} isLoading={customersLoading} isDisabled={isProcessing} placeholder="Select or type to create a customer..." isClearable formatCreateLabel={inputValue => `Create new customer: "${inputValue}"`} /></div>
                  {selectedCustomer?.__isNew__ && (<div className='p-4 border rounded-lg bg-gray-50 space-y-3'><p className='font-semibold text-gray-700'>New Customer Details</p><div><label className="block text-xs font-medium text-gray-600 mb-1">Address *</label><input type='text' value={newCustomerAddress} onChange={e => setNewCustomerAddress(e.target.value)} className='w-full p-2 border border-gray-300 rounded-lg' placeholder='Customer Address'/></div><div><label className="block text-xs font-medium text-gray-600 mb-1">Phone Number *</label><input type='text' value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} className='w-full p-2 border border-gray-300 rounded-lg' placeholder='Customer Phone'/></div></div>)}
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg" disabled={isProcessing}><option>Cash</option><option>Card</option><option>Bank Transfer</option></select></div>
              </div>
              <div className="flex justify-end pt-4"><button onClick={handleGenerateFinalInvoice} disabled={!selectedCustomer || isProcessing} className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">{isProcessing ? 'Processing...' : 'Generate Invoice'}</button></div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold">Generate Invoice</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border"><div className="p-4 border-b"><h2 className="text-lg font-semibold">Available Stock</h2></div><div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">{stockSummary.length > 0 ? stockSummary.map(stock => (<button key={stock.productId} onClick={() => addItemToInvoice(stock)} disabled={selectedItems.some(item => item.description === stock.productName)} className={`w-full text-left p-4 rounded-lg border transition-all disabled:bg-gray-100 disabled:cursor-not-allowed`}><h3 className="font-semibold">{stock.productName}</h3><span>Available: {stock.availableQuantity}</span><span className="ml-4">Price: Rs. {stock.unitPrice.toFixed(2)}</span></button>)) : <p className='text-gray-500'>No stock available.</p>}</div></div>
        
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b flex items-center gap-2"><ShoppingCart size={20} /><h2 className="text-lg font-semibold">Invoice Items ({selectedItems.length})</h2></div>
          <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
            {selectedItems.length > 0 ? selectedItems.map((item, index) => (
              <div key={index} className="border rounded-lg p-3 bg-white">
                <div className="flex justify-between items-center mb-2"><h3 className="font-semibold flex-1">{item.description}</h3><button onClick={() => setSelectedItems(selectedItems.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16} /></button></div>
                <div className="grid grid-cols-3 gap-2 items-end">
                    <div><label className="text-xs font-medium text-gray-500">Quantity</label><input type="number" value={item.quantity} onChange={e => updateItemQuantity(index, parseInt(e.target.value) || 1)} className="w-full p-2 border rounded-md" /></div>
                    <div><label className="text-xs font-medium text-gray-500">Unit Price</label><input type="number" step="0.01" value={item.unitPrice} onChange={e => updateItemPrice(index, parseFloat(e.target.value) || 0)} className="w-full p-2 border rounded-md" /></div>
                    <div><label className="text-xs font-medium text-gray-500">Total</label><input type="text" value={`Rs ${item.amount.toFixed(2)}`} readOnly className="w-full p-2 border rounded-md bg-gray-50 text-gray-800" /></div>
                </div>
              </div>
            )) : <div className="text-center py-10 text-gray-500"><p>No items selected.</p></div>}
          </div>
          {selectedItems.length > 0 && (<div className="p-4 border-t bg-gray-50"><div className="text-right text-xl font-bold mb-4">Total: Rs. {selectedItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</div><button onClick={handlePrepareInvoice} className="w-full bg-green-600 text-white p-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700">Prepare Invoice <FileText size={16} /></button></div>)}
        </div>
      </div>
    </div>
  );
}