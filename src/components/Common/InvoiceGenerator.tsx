import React, { useState, useEffect } from 'react';
import { Printer, Plus, Trash2, Loader } from 'lucide-react';
import sewanalogoImg from '../../assets/sewanalogo.png';

const LOGO_FALLBACK = 'https://i.ibb.co/fjSFngM/sewanalogo.png';
const ISO_CERT = 'https://i.ibb.co/DfZgp9p5/iso.png';
const GMP_CERT = 'https://i.ibb.co/d4010gz5/gmp-certification-services.jpg';

// --- Interfaces ---
interface InvoiceItem {
  itemCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
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

interface InvoiceGeneratorProps {
  initialData?: Partial<InvoiceData>;
  onSave?: (data: InvoiceData) => Promise<void> | void;
  readOnly?: boolean;
  onSaveLoading?: boolean;
}

const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({
  initialData,
  onSave,
  readOnly = false,
  onSaveLoading = false,
}) => {
  const [logoSrc, setLogoSrc] = useState(sewanalogoImg);
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    date: new Date().toISOString().split('T')[0],
    invoiceNo: '',
    orderNo: '',
    paymentMethod: 'Cash',
    billTo: { name: '', address: '', phone: '' },
    items: [{ itemCode: '', description: '', quantity: 1, unitPrice: 0, amount: 0 }],
    discount: 0,
  });

  useEffect(() => {
    if (initialData) {
      setInvoiceData(prev => ({
        ...prev,
        ...initialData,
        date: initialData.date || prev.date,
        items: initialData.items && initialData.items.length > 0 ? initialData.items : prev.items,
        billTo: initialData.billTo || prev.billTo,
      }));
    }
  }, [initialData]);

  // --- Calculation Functions ---
  const calculateAmount = (quantity: number, unitPrice: number): number => quantity * unitPrice;
  const calculateSubtotal = (): number => invoiceData.items.reduce((sum, item) => sum + item.amount, 0);
  const calculateNetTotal = (): number => calculateSubtotal() * (1 - invoiceData.discount / 100);

  // --- Event Handlers ---
  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    if(readOnly) return;
    const updatedItems = [...invoiceData.items];
    const item = { ...updatedItems[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      item.amount = calculateAmount(Number(item.quantity), Number(item.unitPrice));
    }
    updatedItems[index] = item;
    setInvoiceData({ ...invoiceData, items: updatedItems });
  };

  const addItem = () => {
    if(readOnly) return;
    setInvoiceData({ ...invoiceData, items: [...invoiceData.items, { itemCode: '', description: '', quantity: 1, unitPrice: 0, amount: 0 }] });
  };

  const removeItem = (index: number) => {
    if(readOnly) return;
    if (invoiceData.items.length > 1) {
      setInvoiceData({ ...invoiceData, items: invoiceData.items.filter((_, i) => i !== index) });
    }
  };

  const handleSave = () => onSave && onSave(invoiceData);

  const handlePrint = () => {
    const printContent = generatePrintHTML();
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.left = '-9999px';
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentWindow?.document;
    if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(printContent);
        iframeDoc.close();
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            document.body.removeChild(iframe);
        }, 250);
    }
  };

  const generatePrintHTML = (): string => {
    const subtotal = calculateSubtotal();
    const discountAmount = subtotal * (invoiceData.discount / 100);
    const netTotal = calculateNetTotal();
    return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice</title><style>
    @page { size: A4; margin: 0; }
    body { margin: 1cm; font-family: 'Helvetica', 'Arial', sans-serif; font-size: 10pt; color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .invoice-container { width: 100%; margin: auto; }
    header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 15px; border-bottom: 2px solid #ccc; margin-bottom: 20px; }
    .company-info h1 { font-size: 18pt; font-weight: bold; margin: 0; }
    .company-info p { font-size: 9pt; margin: 2px 0; }
    .invoice-meta { text-align: right; }
    .bill-to-section { margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    thead { background: #f0f0f0; }
    th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
    .text-right { text-align: right; }
    .totals-section { float: right; width: 40%; }
    footer { position: fixed; bottom: 1cm; width: 100%; text-align: center; font-size: 9pt; color: #777; }
    </style></head><body><div class="invoice-container">
      <header><img src="${logoSrc}" alt="Logo" style="width:100px;" onerror="this.onerror=null;this.src='${LOGO_FALLBACK}';"/><div class="company-info"><h1>Sewanagala Ayurvedic Drugs</h1><p>Bogaha Junction, Kiriibbanwewa, Sewanagala.</p></div></header>
      <div class="invoice-meta"><h2>INVOICE</h2><p><strong>No:</strong> ${invoiceData.invoiceNo}</p><p><strong>Date:</strong> ${invoiceData.date}</p></div>
      <div class="bill-to-section"><p><strong>Bill To:</strong></p><p>${invoiceData.billTo.name}</p><p>${invoiceData.billTo.address}</p></div>
      <table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th class="text-right">Total</th></tr></thead><tbody>${invoiceData.items.map(i => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${i.unitPrice.toFixed(2)}</td><td class="text-right">${i.amount.toFixed(2)}</td></tr>`).join('')}</tbody></table>
      <div class="totals-section"><table><tbody>
        <tr><td>Subtotal:</td><td class="text-right">${subtotal.toFixed(2)}</td></tr>
        <tr><td>Discount (${invoiceData.discount}%):</td><td class="text-right">-${discountAmount.toFixed(2)}</td></tr>
        <tr><td><strong>Net Total:</strong></td><td class="text-right"><strong>${netTotal.toFixed(2)}</strong></td></tr>
      </tbody></table></div>
      <footer><p>Thank you for your business!</p></footer>
    </div></body></html>`;
  };

  // --- Render ---
  return (
    <div className="bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-200">
        <div className="p-8 md:p-10">
          {/* --- Header --- */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 mb-8 border-b-2 border-gray-100">
            <div className="flex items-center mb-4 md:mb-0">
              <img src={logoSrc} alt="Logo" className="h-16 w-16 mr-4" onError={() => setLogoSrc(LOGO_FALLBACK)} />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Sewanagala Ayurvedic</h1>
                <p className="text-sm text-gray-500">Bogaha Junction, Kiriibbanwewa, Sewanagala.</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-4">
                <img src={ISO_CERT} alt="ISO" className="h-12"/>
                <img src={GMP_CERT} alt="GMP" className="h-12"/>
            </div>
          </div>

          {/* --- Invoice Meta & Bill To --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-700 mb-2">BILL TO:</h3>
              <p className="font-bold text-gray-800">{invoiceData.billTo.name}</p>
              <p className="text-sm text-gray-600">{invoiceData.billTo.address}</p>
              <p className="text-sm text-gray-600">{invoiceData.billTo.phone}</p>
            </div>
            <div className="text-sm text-gray-700">
              <div className="flex justify-between py-2 border-b"><span className="font-semibold">Invoice Number:</span><span>{invoiceData.invoiceNo}</span></div>
              <div className="flex justify-between py-2 border-b"><span className="font-semibold">Invoice Date:</span><span>{invoiceData.date}</span></div>
              <div className="flex justify-between py-2"><span className="font-semibold">Payment Method:</span><span>{invoiceData.paymentMethod}</span></div>
            </div>
          </div>

          {/* --- Items Table --- */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-3 text-left font-semibold text-gray-600">Item</th>
                  <th className="p-3 text-left font-semibold text-gray-600 w-24">Qty</th>
                  <th className="p-3 text-left font-semibold text-gray-600 w-32">Price</th>
                  <th className="p-3 text-right font-semibold text-gray-600 w-32">Total</th>
                  {!readOnly && <th className="p-3 w-12"></th>}
                </tr>
              </thead>
              <tbody>
                {invoiceData.items.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-3"><input type="text" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className="w-full p-1 bg-transparent border-none focus:ring-0" readOnly={readOnly}/></td>
                    <td className="p-3"><input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className="w-full p-1 bg-transparent border-none focus:ring-0" readOnly={readOnly}/></td>
                    <td className="p-3"><input type="number" value={item.unitPrice} onChange={e => handleItemChange(index, 'unitPrice', Number(e.target.value))} className="w-full p-1 bg-transparent border-none focus:ring-0" readOnly={readOnly}/></td>
                    <td className="p-3 text-right">{item.amount.toFixed(2)}</td>
                    {!readOnly && <td className="p-3 text-center"><button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700"><Trash2 size={16}/></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly && <button onClick={addItem} className="mt-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"><Plus size={16}/> Add Item</button>}
          
          {/* --- Totals --- */}
          <div className="flex justify-end mt-8">
            <div className="w-full max-w-sm space-y-2 text-sm">
              <div className="flex justify-between p-2 bg-gray-50 rounded-t-lg"><span className="font-semibold">Subtotal:</span><span>{calculateSubtotal().toFixed(2)}</span></div>
              <div className="flex justify-between p-2"><span className="font-semibold">Discount:</span><span><input type="number" value={invoiceData.discount} onChange={e => setInvoiceData({...invoiceData, discount: Number(e.target.value)})} className="w-20 text-right bg-transparent border-none focus:ring-0" readOnly={readOnly}/>%</span></div>
              <div className="flex justify-between p-3 bg-gray-100 rounded-b-lg text-base font-bold"><span >Net Total:</span><span>{calculateNetTotal().toFixed(2)}</span></div>
            </div>
          </div>
        </div>

        {/* --- Actions --- */}
        <div className="bg-gray-50 px-8 py-5 flex justify-end items-center gap-4 rounded-b-2xl border-t">
          <button onClick={handlePrint} className="flex items-center gap-2 bg-gray-600 text-white px-5 py-2 rounded-lg hover:bg-gray-700 font-semibold transition-colors"><Printer size={16}/> Print</button>
          {!readOnly && onSave && (
            <button onClick={handleSave} disabled={onSaveLoading} className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 font-semibold transition-colors">
              {onSaveLoading ? <><Loader className="animate-spin" size={16}/> Saving...</> : 'Save & Finalize Invoice'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default InvoiceGenerator;
