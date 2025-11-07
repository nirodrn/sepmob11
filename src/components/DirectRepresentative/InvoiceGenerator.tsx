import React, { useState, useMemo, useEffect } from 'react';
import { useFirebaseData, useFirebaseActions } from '../../hooks/useFirebaseData';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { ErrorMessage } from '../Common/ErrorMessage';
import { Modal } from '../Common/Modal';
import { ShoppingCart, Trash2, FileText, X } from 'lucide-react';
import CreatableSelect from 'react-select/creatable'; // Changed to CreatableSelect
import InvoicePreviewComponent from '../Common/InvoiceGenerator';

// --- Interfaces ---
interface InvoiceGeneratorWrapperProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface StockSummary {
  productName: string;
  availableQuantity: number;
  unitPrice: number;
  productId: string;
}

interface InvoiceItem {
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  productId: string;
}

interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
}

interface InvoiceData {
  date: string;
  invoiceNo: string;
  orderNo: string;
  paymentMethod: string;
  billTo: { name: string; address: string; phone: string; };
  items: InvoiceItem[];
  discount: number;
}

// --- Main Component ---
export function InvoiceGenerator({ isOpen, onClose, onSuccess }: InvoiceGeneratorWrapperProps) {
  const { userData } = useAuth();
  const { data: drStockData, loading: stockLoading, error: stockError } = useFirebaseData<any>('drstock');
  const { data: customersData, loading: customersLoading, error: customersError } = useFirebaseData<any>('customers');
  const { addData } = useFirebaseActions();

  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<{ label: string; value: Customer } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setSelectedItems([]);
        setShowInvoicePreview(false);
        setShowCustomerModal(false);
        setInvoiceData(null);
        setSelectedCustomer(null);
    } else {
        setTimeout(() => { setShowInvoicePreview(false); }, 300);
    }
  }, [isOpen]);

  const stockSummary = useMemo((): StockSummary[] => {
    if (!drStockData || !userData) return [];
    const userEntriesData = drStockData.users?.[userData.id]?.entries;
    if (!userEntriesData) return [];
    const consolidatedByName: { [productName: string]: StockSummary } = {};
    Object.values(userEntriesData).forEach((entry: any) => {
        if (!entry.productName || (entry.availableQuantity || 0) <= 0) return;
        const productName = entry.productName;
        if (!consolidatedByName[productName]) {
            consolidatedByName[productName] = {
                productId: entry.productId,
                productName: productName,
                availableQuantity: 0,
                unitPrice: entry.finalPrice || entry.unitPrice || 0,
            };
        }
        consolidatedByName[productName].availableQuantity += entry.availableQuantity || 0;
        if (!consolidatedByName[productName].unitPrice && (entry.finalPrice || entry.unitPrice)) {
            consolidatedByName[productName].unitPrice = entry.finalPrice || entry.unitPrice || 0;
        }
    });
    return Object.values(consolidatedByName);
  }, [drStockData, userData]);

  const customerOptions = useMemo(() => {
    if (!customersData) return [];
    return Object.entries(customersData).map(([id, customer]: [string, any]) => ({
      label: `${customer.name} - ${customer.address}`,
      value: { id, ...customer },
    }));
  }, [customersData]);

  const handleCreateCustomer = async (inputValue: string) => {
    if (!userData) { alert("You must be logged in."); return; }
    const name = inputValue.trim();
    if (!name) return;

    setIsCreatingCustomer(true);
    try {
        const newCustomerData = {
            name,
            address: 'N/A', // User can edit later
            phone: 'N/A',
            createdBy: userData.id,
            createdByName: userData.name,
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
        };

        const newId = await addData('customers', newCustomerData);
        if (!newId) throw new Error("Failed to create customer in database.");

        const newCustomer: Customer = { id: newId, ...newCustomerData };
        const newOption = { label: newCustomer.name, value: newCustomer };
        setSelectedCustomer(newOption);
    } catch (error) {
        console.error("Error creating customer:", error);
        alert(`Failed to add new customer: ${(error as Error).message}`);
    } finally {
        setIsCreatingCustomer(false);
    }
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

  const addItemToInvoice = (stock: StockSummary) => {
    setSelectedItems(prev => [...prev, { itemCode: stock.productId.substring(0, 8).toUpperCase(), description: stock.productName, quantity: 1, unitPrice: stock.unitPrice, amount: stock.unitPrice, productId: stock.productId }]);
  };

  const handlePrepareInvoice = () => setShowCustomerModal(true);

  const handleGenerateFinalInvoice = () => {
    if (!selectedCustomer) { alert('Please select or create a customer.'); return; }
    const finalData: InvoiceData = {
      date: new Date().toISOString().split('T')[0],
      invoiceNo: `DR-INV-${Date.now()}`,
      orderNo: `ORD-${Date.now()}`,
      paymentMethod: paymentMethod,
      billTo: selectedCustomer.value,
      items: selectedItems,
      discount: 0,
    };
    setInvoiceData(finalData);
    setShowCustomerModal(false);
    setShowInvoicePreview(true);
  };

  const handleReleaseInvoice = async (finalInvoice: InvoiceData) => {
    if (!userData) return;
    try {
        await addData('invoices', { ...finalInvoice, createdBy: userData.id, status: 'completed' });
        console.log('TODO: Update stock for items:', finalInvoice.items);
        onSuccess();
        onClose();
    } catch (error) {
        console.error('Failed to release invoice:', error);
        alert(`Error: ${(error as Error).message}`);
    }
  };

  const renderContent = () => {
    if (showInvoicePreview && invoiceData) {
      return <InvoicePreviewComponent initialData={invoiceData} onSave={handleReleaseInvoice} readOnly={false} />;
    }
    if (stockLoading) return <LoadingSpinner text="Loading stock..." />;
    if (stockError) return <ErrorMessage message={stockError.message} />;

    return (
        <div className="space-y-4">
             {showCustomerModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl p-6 space-y-4 w-full max-w-lg">
                        <div className="flex justify-between items-center"><h3 className="text-xl font-bold">Finalize Invoice</h3><button onClick={() => setShowCustomerModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
                        <div className="space-y-4">
                           <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                             <CreatableSelect options={customerOptions} value={selectedCustomer} onChange={setSelectedCustomer} onCreateOption={handleCreateCustomer} isLoading={customersLoading || isCreatingCustomer} isDisabled={customersLoading || isCreatingCustomer} placeholder="Select or create a customer..." isClearable />
                             {customersError && <p className="text-red-500 text-xs mt-1">Could not load customers.</p>}
                           </div>
                           <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                             <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg">
                                 <option>Cash</option> <option>Card</option> <option>Bank Transfer</option>
                             </select>
                           </div>
                        </div>
                        <div className="flex justify-end"><button onClick={handleGenerateFinalInvoice} className="bg-blue-600 text-white py-2 px-5 rounded-lg font-bold">Generate & Preview</button></div>
                    </div>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[65vh] overflow-hidden">
                <div className="bg-gray-50 rounded-lg border flex flex-col">
                    <h3 className="p-3 border-b font-semibold">Available Stock</h3>
                    <div className="p-2 space-y-1 overflow-y-auto">
                        {stockSummary.map(stock => (
                            <button key={stock.productId} onClick={() => addItemToInvoice(stock)} disabled={selectedItems.some(i => i.productId === stock.productId)} className="w-full text-left p-3 rounded-md border bg-white disabled:bg-gray-200 disabled:cursor-not-allowed">
                                <p className="font-semibold">{stock.productName}</p>
                                <p className="text-sm text-gray-600">Qty: {stock.availableQuantity} | Price: Rs. {stock.unitPrice.toFixed(2)}</p>
                            </button>
                        ))}
                         {stockSummary.length === 0 && <p className='p-4 text-center text-gray-500'>No stock available.</p>}
                    </div>
                </div>
                 <div className="bg-gray-50 rounded-lg border flex flex-col">
                    <h3 className="p-3 border-b font-semibold flex items-center gap-2"><ShoppingCart size={18} /> Invoice Items ({selectedItems.length})</h3>
                     <div className="p-2 space-y-2 overflow-y-auto flex-grow">
                        {selectedItems.map((item, index) => (
                            <div key={index} className="border rounded-md p-2 bg-white shadow-sm">
                                <div className="flex justify-between items-start">
                                    <p className="font-semibold flex-grow">{item.description}</p>
                                    <button onClick={() => setSelectedItems(selectedItems.filter((_, i) => i !== index))} className="text-red-500 p-1 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <label className="text-sm">Qty:</label>
                                    <input type="number" value={item.quantity} onChange={e => updateItemQuantity(index, parseInt(e.target.value) || 1)} className="w-20 p-1 border rounded" />
                                    <p className='text-gray-600 text-sm ml-auto'>@ Rs. {item.unitPrice.toFixed(2)}</p>
                                </div>
                            </div>
                        ))}
                        {selectedItems.length === 0 && <div className='p-4 text-center text-gray-500 flex flex-col items-center justify-center h-full'><ShoppingCart size={32} className="mb-2" /><p>Select stock to add items</p></div>}
                    </div>
                    {selectedItems.length > 0 && (
                        <div className="p-3 border-t mt-auto bg-white">
                            <div className="text-right font-bold text-xl mb-3">Total: Rs. {selectedItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</div>
                            <button onClick={handlePrepareInvoice} className="w-full bg-green-600 text-white p-2 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors">Proceed to Finalize <FileText size={16} /></button>
                        </div>
                    )}
                 </div>
            </div>
        </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={showInvoicePreview ? `Invoice Preview: ${invoiceData?.invoiceNo}` : "Create New Invoice"} size={showInvoicePreview ? "2xl" : "4xl"}>
        {renderContent()}
    </Modal>
  )
}
