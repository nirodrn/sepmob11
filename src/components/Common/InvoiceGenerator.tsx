import React, { useState, useEffect } from 'react';
import { Printer, Download, Plus, Trash2, Loader } from 'lucide-react';
import sewanalogoImg from '../../assets/sewanalogo.png';
import html2pdf from 'html2pdf.js';

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

  const handleDownload = () => {
    const element = document.getElementById('invoice-to-print');
    const opt = {
      margin:       0.5,
      filename:     `invoice_${invoiceData.invoiceNo}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().from(element).set(opt).save();
  }

  const handlePrint = () => {
    const element = document.getElementById('invoice-to-print');
    const opt = {
      margin:       0.5,
      filename:     `invoice_${invoiceData.invoiceNo}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(element).set(opt).output('blob').then((pdfBlob) => {
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = pdfUrl;
      document.body.appendChild(iframe);
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    });
  };
  
  // --- Render ---
  return (
    <div className="bg-gray-100 font-sans">
      <div id="invoice-to-print">
        <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-md my-8">
            {/* --- Header --- */}
            <div className="flex justify-between items-center p-8 border-b border-gray-200">
                <div className="flex items-center">
                    <img src={logoSrc} alt="Logo" className="h-20 w-20 mr-6" onError={() => setLogoSrc(LOGO_FALLBACK)} />
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Sewanagala Ayurvedic</h1>
                        <p className="text-md text-gray-600">Bogaha Junction, Kiriibbanwewa, Sewanagala.</p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <img src={ISO_CERT} alt="ISO Certification" className="h-14"/>
                    <img src={GMP_CERT} alt="GMP Certification" className="h-14"/>
                </div>
            </div>

            {/* --- Invoice Meta & Bill To --- */}
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="bg-gray-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Bill To:</h3>
                    <p className="font-bold text-gray-900 text-lg">{invoiceData.billTo.name}</p>
                    <p className="text-gray-700">{invoiceData.billTo.address}</p>
                    <p className="text-gray-700">{invoiceData.billTo.phone}</p>
                </div>
                <div className="text-md">
                    <div className="flex justify-between items-center py-3 border-b"><span className="font-semibold text-gray-700">Invoice Number:</span><span className="font-mono text-gray-900">{invoiceData.invoiceNo}</span></div>
                    <div className="flex justify-between items-center py-3 border-b"><span className="font-semibold text-gray-700">Invoice Date:</span><span className="text-gray-900">{invoiceData.date}</span></div>
                    <div className="flex justify-between items-center py-3"><span className="font-semibold text-gray-700">Payment Method:</span><span className="text-gray-900">{invoiceData.paymentMethod}</span></div>
                </div>
            </div>

            {/* --- Items Table --- */}
            <div className="px-8 pb-8">
                <table className="w-full text-md">
                    <thead >
                        <tr className="bg-gray-100">
                            <th className="p-4 text-left font-semibold text-gray-700 rounded-l-lg">Item</th>
                            <th className="p-4 text-left font-semibold text-gray-700 w-28">Quantity</th>
                            <th className="p-4 text-left font-semibold text-gray-700 w-36">Price</th>
                            <th className="p-4 text-right font-semibold text-gray-700 w-40 rounded-r-lg">Total</th>
                            {!readOnly && <th className="p-4 w-16"></th>}
                        </tr>
                    </thead>
                    <tbody>
                        {invoiceData.items.map((item, index) => (
                            <tr key={index} className="border-b border-gray-200">
                                <td className="p-4"><input type="text" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" readOnly={readOnly}/></td>
                                <td className="p-4"><input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" readOnly={readOnly}/></td>
                                <td className="p-4"><input type="number" value={item.unitPrice} onChange={e => handleItemChange(index, 'unitPrice', Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" readOnly={readOnly}/></td>
                                <td className="p-4 text-right font-medium text-gray-800">{item.amount.toFixed(2)}</td>
                                {!readOnly && <td className="p-4 text-center"><button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700"><Trash2 size={20}/></button></td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!readOnly && <button onClick={addItem} className="mt-6 flex items-center gap-2 text-md text-blue-600 hover:text-blue-800 font-semibold"><Plus size={18}/> Add New Line</button>}
            </div>

            {/* --- Totals --- */}
            <div className="flex justify-end p-8">
                <div className="w-full max-w-md space-y-3 text-md">
                    <div className="flex justify-between items-center"><span className="text-gray-600">Subtotal:</span><span className="font-medium text-gray-800">{calculateSubtotal().toFixed(2)}</span></div>
                    <div className="flex justify-between items-center"><span className="text-gray-600">Discount (%):</span><input type="number" value={invoiceData.discount} onChange={e => setInvoiceData({...invoiceData, discount: Number(e.target.value)})} className="w-24 p-2 text-right border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" readOnly={readOnly}/></div>
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200"><span className="font-bold text-xl text-gray-900">NET TOTAL:</span><span className="font-bold text-xl text-gray-900">{calculateNetTotal().toFixed(2)}</span></div>
                </div>
            </div>
            
            {/* --- Actions --- */}
            <div className="bg-gray-50 px-8 py-6 flex justify-end items-center gap-4 rounded-b-lg border-t border-gray-200">
                <button onClick={handleDownload} className="flex items-center gap-2 text-white bg-gray-600 hover:bg-gray-700 font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105"><Download size={18}/> Download PDF</button>
                <button onClick={handlePrint} className="flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700 font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105"><Printer size={18}/> Print Invoice</button>
                {!readOnly && onSave && (
                    <button onClick={handleSave} disabled={onSaveLoading} className="flex items-center gap-2 text-white bg-green-600 hover:bg-green-700 font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 disabled:bg-green-400 disabled:cursor-not-allowed">
                        {onSaveLoading ? <><Loader className="animate-spin mr-2" size={18}/> Processing...</> : 'Save & Finalize'}
                    </button>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceGenerator;
