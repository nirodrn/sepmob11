import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFirebaseData } from '../../hooks/useFirebaseData';
import { ref, push, set, update } from 'firebase/database';
import { database } from '../../config/firebase';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { ErrorMessage } from '../Common/ErrorMessage';
import { ShoppingCart, Plus, Trash2, FileText, CheckCircle } from 'lucide-react';
import InvoiceGenerator from '../Common/InvoiceGenerator';

// This represents the consolidated view of stock for a single product name
interface StockSummary {
  productName: string; // This is the unique key now
  availableQuantity: number;
  unitPrice: number;
  productId: string; // A representative productId for item code generation
}

interface InvoiceItem {
  itemCode: string;
  description: string; // This is the productName
  quantity: number;
  unitPrice: number;
  amount: number;
  productId: string; // Kept for reference and item code generation
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

// Raw stock entry from Firebase
interface DRStockEntry {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  availableQuantity: number;
  usedQuantity: number;
  claimedAt?: string;
  receivedAt?: string;
  lastUpdated: string;
  finalPrice?: number;
  unitPrice?: number;
  notes?: string;
}

export function DRInvoiceGenerator() {
  const { userData } = useAuth();
  const { data: drStockData, loading, error: firebaseError } = useFirebaseData<any>('drstock');
  
  const [selectedItems, setSelectedItems] = useState<InvoiceItem[]>([]);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [releaseSuccess, setReleaseSuccess] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  // Consolidate stock by product name, similar to the inventory page
  const stockSummary = useMemo((): StockSummary[] => {
    if (!drStockData || !userData?.id) return [];
    
    const userEntries = drStockData.users?.[userData.id]?.entries;
    if (!userEntries) return [];

    const consolidatedByName: { [productName: string]: StockSummary } = {};

    Object.values(userEntries as DRStockEntry[]).forEach(entry => {
      if (!entry.productName || entry.availableQuantity <= 0) return;

      const { productName, availableQuantity, finalPrice, unitPrice, productId } = entry;
      
      if (!consolidatedByName[productName]) {
        consolidatedByName[productName] = {
          productName,
          availableQuantity: 0,
          unitPrice: finalPrice || unitPrice || 0,
          productId: productId, // Use first product ID encountered as representative
        };
      }
      
      consolidatedByName[productName].availableQuantity += availableQuantity;
      
      // If a price wasn't set, try to set it from the current entry
      if (!consolidatedByName[productName].unitPrice && (finalPrice || unitPrice)) {
        consolidatedByName[productName].unitPrice = finalPrice || unitPrice || 0;
      }
    });

    return Object.values(consolidatedByName);
  }, [drStockData, userData]);

  const handleUseStock = async (userId: string, productName: string, quantityToUse: number, invoiceNo: string) => {
    const userEntries = drStockData.users?.[userId]?.entries;
    if (!userEntries) throw new Error('Stock data not found for user.');

    const productEntries = Object.values(userEntries as { [key: string]: DRStockEntry })
      .filter(e => e.productName === productName && e.availableQuantity > 0)
      .sort((a, b) => new Date(a.receivedAt || a.claimedAt || 0).getTime() - new Date(b.receivedAt || b.claimedAt || 0).getTime());

    let remainingToUse = quantityToUse;
    const updates: Record<string, any> = {};

    for (const entry of productEntries) {
      if (remainingToUse <= 0) break;

      const useFromThisEntry = Math.min(remainingToUse, entry.availableQuantity);
      
      updates[`drstock/users/${userId}/entries/${entry.id}/availableQuantity`] = entry.availableQuantity - useFromThisEntry;
      updates[`drstock/users/${userId}/entries/${entry.id}/usedQuantity`] = (entry.usedQuantity || 0) + useFromThisEntry;
      updates[`drstock/users/${userId}/entries/${entry.id}/lastUpdated`] = new Date().toISOString();
      updates[`drstock/users/${userId}/entries/${entry.id}/notes`] = `${entry.notes || ''}\nUsed ${useFromThisEntry} for invoice ${invoiceNo}`.trim();

      if (entry.availableQuantity - useFromThisEntry <= 0) {
        updates[`drstock/users/${userId}/entries/${entry.id}/status`] = 'depleted';
      }

      remainingToUse -= useFromThisEntry;
    }

    if (remainingToUse > 0) {
      throw new Error(`Insufficient stock for ${productName}. Only ${quantityToUse - remainingToUse} available.`);
    }
    
    await update(ref(database), updates);
  };

  const addItemToInvoice = (stock: StockSummary) => {
    if (selectedItems.some(item => item.description === stock.productName)) return;

    const newItem: InvoiceItem = {
      itemCode: stock.productId.substring(0, 8).toUpperCase(),
      description: stock.productName,
      quantity: 1,
      unitPrice: stock.unitPrice,
      amount: stock.unitPrice,
      productId: stock.productId,
    };
    setSelectedItems([...selectedItems, newItem]);
  };

  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
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
    updatedItems[index].unitPrice = price;
    updatedItems[index].amount = price * updatedItems[index].quantity;
    setSelectedItems(updatedItems);
  };

  const generateInvoiceNumber = () => `DR-INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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
      billTo: { name: '', address: '', phone: '' },
      items: selectedItems,
      discount: 0
    };

    setInvoiceData(invoice);
    setShowInvoicePreview(true);
  };

  const handleReleaseInvoice = async (finalInvoiceData: InvoiceData) => {
    if (!userData?.id) return;
    setReleaseError(null);

    try {
      for (const item of finalInvoiceData.items) {
        await handleUseStock(userData.id, item.description, item.quantity, finalInvoiceData.invoiceNo);
      }

      const newInvoiceRef = push(ref(database, `drinvoices/${userData.id}`));
      const invoiceRecord = {
        invoiceId: newInvoiceRef.key,
        invoiceNumber: finalInvoiceData.invoiceNo,
        orderNumber: finalInvoiceData.orderNo,
        representativeId: userData.id,
        representativeName: userData.name,
        customerName: finalInvoiceData.billTo.name,
        customerAddress: finalInvoiceData.billTo.address,
        customerPhone: finalInvoiceData.billTo.phone,
        items: finalInvoiceData.items.map(item => ({ ...item })),
        subtotal: finalInvoiceData.items.reduce((sum, item) => sum + item.amount, 0),
        discount: finalInvoiceData.discount,
        total: finalInvoiceData.items.reduce((sum, item) => sum + item.amount, 0) * (1 - finalInvoiceData.discount / 100),
        status: 'issued',
        createdAt: new Date().toISOString(),
      };
      await set(newInvoiceRef, invoiceRecord);

      setReleaseSuccess(true);
      setSelectedItems([]);
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
          <h2 className="text-xl font-bold">Invoice Preview</h2>
          <button onClick={() => setShowInvoicePreview(false)} className="px-4 py-2">Back to Selection</button>
        </div>
        <InvoiceGenerator initialData={invoiceData} onSave={handleReleaseInvoice} readOnly={false} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Generate Invoice</h1>
      {releaseSuccess && <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4">Invoice released successfully!</div>}
      {releaseError && <ErrorMessage message={releaseError} />}
      {firebaseError && <ErrorMessage message={`Stock loading error: ${firebaseError}`} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b"><h2 className="text-lg font-semibold">Available Stock</h2></div>
          {loading ? <LoadingSpinner /> : (
            <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
              {stockSummary.length === 0 ? (
                <div className="text-center py-12"><p>No stock available.</p></div>
              ) : (
                stockSummary.map((stock) => {
                  const isSelected = selectedItems.some(item => item.description === stock.productName);
                  return (
                    <button
                      key={stock.productName}
                      onClick={() => !isSelected && addItemToInvoice(stock)}
                      disabled={isSelected}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${isSelected ? 'bg-gray-100 cursor-not-allowed' : 'hover:border-blue-300'}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{stock.productName}</h3>
                          <span className="text-gray-600">Available: <span className="font-semibold text-green-600">{stock.availableQuantity}</span></span>
                          <span className="text-gray-600 ml-4">Price: <span className="font-semibold">Rs. {stock.unitPrice.toFixed(2)}</span></span>
                        </div>
                        {!isSelected && <Plus className="w-5 h-5 text-blue-600" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b"><h2 className="text-lg font-semibold flex items-center gap-2"><ShoppingCart /> Invoice Items ({selectedItems.length})</h2></div>
          <div className="p-4 space-y-3 max-h-[600px] overflow-y-auto">
            {selectedItems.length === 0 ? (
              <div className="text-center py-12"><p>No items selected.</p></div>
            ) : (
              selectedItems.map((item, index) => {
                const stock = stockSummary.find(s => s.productName === item.description);
                return (
                  <div key={index} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold">{item.description}</h3>
                      <button onClick={() => removeItem(index)} className="text-red-600"><Trash2 size={16} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Quantity (Max: {stock?.availableQuantity})</label>
                        <input type="number" min="1" max={stock?.availableQuantity} value={item.quantity} onChange={e => updateItemQuantity(index, parseInt(e.target.value) || 1)} className="w-full p-2 border rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Unit Price (Rs.)</label>
                        <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItemPrice(index, parseFloat(e.target.value) || 0)} className="w-full p-2 border rounded-lg" />
                      </div>
                    </div>
                    <div className="mt-2 text-right font-bold text-lg">Rs. {item.amount.toFixed(2)}</div>
                  </div>
                );
              })
            )}
          </div>
          {selectedItems.length > 0 && (
            <div className="p-4 border-t bg-gray-50">
              <div className="text-right text-xl font-bold mb-4">Total: Rs. {selectedItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</div>
              <button onClick={handlePrepareInvoice} className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold flex items-center justify-center gap-2"><FileText /> Prepare Invoice</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
