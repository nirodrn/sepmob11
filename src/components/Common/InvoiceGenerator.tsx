import React, { useState, useEffect } from 'react';
import { Printer, Download, Plus, Trash2, Loader } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const LOGO_URL = 'https://i.ibb.co/fjSFngM/sewanalogo.png';
const ISO_CERT_URL = 'https://i.ibb.co/DfZgp9p5/iso.png';
const GMP_CERT_URL = 'https://i.ibb.co/d4010gz5/gmp-certification-services.jpg';

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

  const calculateAmount = (quantity: number, unitPrice: number): number => quantity * unitPrice;
  const calculateSubtotal = (): number => invoiceData.items.reduce((sum, item) => sum + item.amount, 0);
  const calculateNetTotal = (): number => calculateSubtotal() * (1 - invoiceData.discount / 100);

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

  const getPdfOptions = () => ({
    margin: 0,
    filename: `invoice_${invoiceData.invoiceNo || 'preview'}.pdf`,
    image: { type: 'jpeg', quality: 1.0 },
    html2canvas: { scale: 4, useCORS: true, logging: false },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  });

  const handleDownload = () => {
    const element = document.getElementById('invoice-to-print');
    html2pdf().from(element).set(getPdfOptions()).save();
  }

  const handlePrint = () => {
    const element = document.getElementById('invoice-to-print');
    html2pdf().from(element).set(getPdfOptions()).output('blob').then((pdfBlob) => {
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = pdfUrl;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }, 1);
      };
    });
  };

  return (
    <div className="bg-gray-100 font-sans print-exact">
        {/* --- Main Invoice Body --- */}
        <div id="invoice-to-print" className="max-w-4xl mx-auto bg-white my-8 print:my-0">
            <div className="p-10">
                {/* --- Header --- */}
                <header className="flex justify-between items-center pb-8 border-b-2 border-gray-100">
                    <div className="flex items-center">
                        <img src={LOGO_URL} alt="Sewanagala Ayurvedic Logo" className="h-20 w-20 mr-6" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Sewanagala Ayurvedic</h1>
                            <p className="text-sm text-gray-500">Bogaha Junction, Kiriibbanwewa, Sewanagala.</p>
                            <p className="text-sm text-gray-500">Tel: 047-2244589 | Email: sewanagala@example.com</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-4xl font-bold text-gray-700">INVOICE</h2>
                    </div>
                </header>

                {/* --- Meta & Bill To --- */}
                <section className="grid grid-cols-2 gap-10 pt-8 pb-10">
                    <div>
                        <h3 className="text-md font-semibold text-gray-600 mb-2">Bill To</h3>
                        <p className="font-bold text-gray-800 text-lg">{invoiceData.billTo.name || 'N/A'}</p>
                        <p className="text-gray-600">{invoiceData.billTo.address || 'N/A'}</p>
                        <p className="text-gray-600">{invoiceData.billTo.phone || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                        <div className="grid grid-cols-2 gap-y-2 text-sm">
                            <span className="font-semibold text-gray-600">Invoice Number:</span><span className="text-gray-800">{invoiceData.invoiceNo || 'N/A'}</span>
                            <span className="font-semibold text-gray-600">Invoice Date:</span><span className="text-gray-800">{invoiceData.date}</span>
                            <span className="font-semibold text-gray-600">Order Number:</span><span className="text-gray-800">{invoiceData.orderNo || 'N/A'}</span>
                            <span className="font-semibold text-gray-600">Payment Method:</span><span className="text-gray-800">{invoiceData.paymentMethod}</span>
                        </div>
                    </div>
                </section>

                {/* --- Items Table --- */}
                <section>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-y border-gray-200">
                                <th className="p-3 text-left font-semibold text-gray-600">Item</th>
                                <th className="p-3 text-center font-semibold text-gray-600 w-24">Quantity</th>
                                <th className="p-3 text-right font-semibold text-gray-600 w-32">Unit Price</th>
                                <th className="p-3 text-right font-semibold text-gray-600 w-32">Amount</th>
                                {!readOnly && <th className="p-3 w-12 print:hidden"></th>}
                            </tr>
                        </thead>
                        <tbody>
                            {invoiceData.items.map((item, index) => (
                                <tr key={index} className="border-b border-gray-100">
                                    <td className="p-3"><input type="text" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className="w-full p-1 border-gray-300 rounded-md read-only:bg-transparent read-only:border-transparent focus:outline-none focus:ring-1 focus:ring-blue-500" readOnly={readOnly}/></td>
                                    <td className="p-3"><input type="number" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} className="w-full p-1 text-center border-gray-300 rounded-md read-only:bg-transparent read-only:border-transparent focus:outline-none focus:ring-1 focus:ring-blue-500" readOnly={readOnly}/></td>
                                    <td className="p-3"><input type="number" value={item.unitPrice} onChange={e => handleItemChange(index, 'unitPrice', Number(e.target.value))} className="w-full p-1 text-right border-gray-300 rounded-md read-only:bg-transparent read-only:border-transparent focus:outline-none focus:ring-1 focus:ring-blue-500" readOnly={readOnly}/></td>
                                    <td className="p-3 text-right font-medium text-gray-700">{item.amount.toFixed(2)}</td>
                                    {!readOnly && <td className="p-3 text-center print:hidden"><button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-600"><Trash2 size={16}/></button></td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!readOnly && <button onClick={addItem} className="mt-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-semibold print:hidden"><Plus size={16}/> Add Item</button>}
                </section>

                {/* --- Totals --- */}
                <section className="flex justify-end pt-10 pb-8">
                    <div className="w-full max-w-xs space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-600">Subtotal:</span><span className="font-medium text-gray-800">{calculateSubtotal().toFixed(2)}</span></div>
                        <div className="flex justify-between items-center"><span className="text-gray-600">Discount (%):</span><input type="number" value={invoiceData.discount} onChange={e => setInvoiceData({...invoiceData, discount: Number(e.target.value)})} className="w-20 p-1 text-right border-gray-300 rounded-md read-only:bg-transparent read-only:border-transparent focus:outline-none focus:ring-1 focus:ring-blue-500" readOnly={readOnly}/></div>
                        <div className="flex justify-between pt-2 border-t-2 border-gray-200"><span className="font-bold text-lg text-gray-800">NET TOTAL:</span><span className="font-bold text-lg text-gray-800">{calculateNetTotal().toFixed(2)}</span></div>
                    </div>
                </section>

                {/* --- Footer --- */}
                <footer className="text-center pt-8 border-t-2 border-gray-100">
                    <p className="text-sm text-gray-500 mb-4">Thank you for your business!</p>
                    <div className="flex justify-center items-center gap-4">
                        <img src={ISO_CERT_URL} alt="ISO 9001:2015 Certified" className="h-12"/>
                        <img src={GMP_CERT_URL} alt="GMP Certified" className="h-12"/>
                    </div>
                </footer>
            </div>
        </div>

        {/* --- Action Buttons --- */}
        <div className="max-w-4xl mx-auto bg-gray-50 px-10 py-5 flex justify-end items-center gap-4 print:hidden">
            <button onClick={handleDownload} className="flex items-center gap-2 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 font-bold py-2 px-4 rounded-lg"><Download size={16}/> Download PDF</button>
            <button onClick={handlePrint} className="flex items-center gap-2 text-sm text-white bg-blue-600 hover:bg-blue-700 font-bold py-2 px-4 rounded-lg"><Printer size={16}/> Print Invoice</button>
            {!readOnly && onSave && (
                <button onClick={handleSave} disabled={onSaveLoading} className="flex items-center gap-2 text-sm text-white bg-green-600 hover:bg-green-700 font-bold py-2 px-4 rounded-lg disabled:bg-green-400 disabled:cursor-not-allowed">
                    {onSaveLoading ? <><Loader className="animate-spin mr-1" size={16}/> Saving...</> : 'Save & Finalize'}
                </button>
            )}
        </div>

        <style jsx global>{`
            @media print {
                body, .print-exact {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .print\:hidden {
                    display: none !important;
                }
            }
            input[type="number"]::-webkit-inner-spin-button,
            input[type="number"]::-webkit-outer-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            input[type="number"] {
                -moz-appearance: textfield;
            }
        `}</style>
    </div>
  );
};

export default InvoiceGenerator;
