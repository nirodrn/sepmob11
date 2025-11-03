import React, { useState, useEffect, useRef } from 'react';
import { Printer, Plus, Trash2 } from 'lucide-react';
import sewanalogoImg from '../../assets/sewanalogo.png';

const LOGO_FALLBACK = 'https://i.ibb.co/fjSFngM/sewanalogo.png';
const ISO_CERT = 'https://i.ibb.co/DfZgp9p5/iso.png';
const GMP_CERT = 'https://i.ibb.co/d4010gz5/gmp-certification-services.jpg';

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
  billTo: {
    name: string;
    address: string;
    phone: string;
  };
  items: InvoiceItem[];
  discount: number;
}

interface InvoiceGeneratorProps {
  initialData?: Partial<InvoiceData>;
  onSave?: (data: InvoiceData) => void;
  readOnly?: boolean;
}

const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({
  initialData,
  onSave,
  readOnly = false,
}) => {
  const hasTriggeredPrint = useRef(false);
  const [logoSrc, setLogoSrc] = useState(sewanalogoImg);
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    date: initialData?.date || new Date().toISOString().split('T')[0],
    invoiceNo: initialData?.invoiceNo || '',
    orderNo: initialData?.orderNo || '',
    paymentMethod: initialData?.paymentMethod || 'Cash',
    billTo: initialData?.billTo || {
      name: '',
      address: '',
      phone: '',
    },
    items: initialData?.items || [
      { itemCode: '', description: '', quantity: 0, unitPrice: 0, amount: 0 },
    ],
    discount: initialData?.discount || 0,
  });

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
      updatedItems[index].amount = calculateAmount(
        updatedItems[index].quantity,
        updatedItems[index].unitPrice
      );
    }

    setInvoiceData({ ...invoiceData, items: updatedItems });
  };

  const addItem = () => {
    setInvoiceData({
      ...invoiceData,
      items: [
        ...invoiceData.items,
        { itemCode: '', description: '', quantity: 0, unitPrice: 0, amount: 0 },
      ],
    });
  };

  const removeItem = (index: number) => {
    if (invoiceData.items.length > 1) {
      const updatedItems = invoiceData.items.filter((_, i) => i !== index);
      setInvoiceData({ ...invoiceData, items: updatedItems });
    }
  };

  const handlePrint = async () => {
    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const printContent = generatePrintHTML();
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(printContent);
      iframeDoc.close();

      // Wait for content to load
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();

        // Remove iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 1000);
    }
  };

  const generatePrintHTML = (): string => {
    const subtotal = calculateSubtotal();
    const discountAmount = subtotal * (invoiceData.discount / 100);
    const netTotal = calculateNetTotal();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${invoiceData.invoiceNo}</title>
        <style>
          @page {
            size: A4;
            margin: 1cm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.4;
            color: #000;
            background: white;
            padding: 20px;
          }
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
          }
          header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 20px;
            border-bottom: 2px solid #333;
            margin-bottom: 20px;
          }
          .header-left {
            display: flex;
            align-items: flex-start;
          }
          .logo {
            width: 80px;
            height: 80px;
            margin-right: 15px;
            object-fit: contain;
          }
          .company-info h1 {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .company-info p {
            font-size: 10pt;
            color: #333;
            margin: 2px 0;
          }
          .certifications {
            display: flex;
            gap: 10px;
            align-items: center;
          }
          .certifications img {
            height: 70px;
            width: auto;
            object-fit: contain;
          }
          .invoice-title-section {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 20px 0;
          }
          .invoice-title {
            font-size: 28pt;
            font-weight: bold;
            color: #0891b2;
          }
          .invoice-details {
            text-align: right;
            font-size: 10pt;
          }
          .invoice-details div {
            margin: 5px 0;
          }
          .invoice-details strong {
            display: inline-block;
            width: 140px;
            text-align: right;
          }
          .bill-to-section {
            margin: 20px 0;
          }
          .bill-to-header {
            background-color: #0891b2;
            color: white;
            padding: 8px 12px;
            font-weight: bold;
            font-size: 11pt;
          }
          .bill-to-content {
            border: 1px solid #ccc;
            border-top: none;
            padding: 12px;
            font-size: 10pt;
          }
          .bill-to-content p {
            margin: 3px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          thead {
            background-color: #0891b2;
            color: white;
          }
          th {
            padding: 10px;
            text-align: left;
            font-size: 10pt;
            font-weight: bold;
          }
          th.text-right {
            text-align: right;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #ddd;
            font-size: 10pt;
          }
          td.text-right {
            text-align: right;
          }
          .totals-section {
            display: flex;
            justify-content: flex-end;
            margin: 20px 0;
          }
          .totals-box {
            width: 300px;
          }
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 12px;
            font-size: 10pt;
          }
          .totals-row.subtotal {
            background-color: #f3f4f6;
          }
          .totals-row.discount {
            background-color: #fff;
          }
          .totals-row.net-total {
            background-color: #e5e7eb;
            font-weight: bold;
            font-size: 11pt;
          }
          footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid #ccc;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
          }
          .signature-box {
            width: 30%;
            text-align: center;
          }
          .signature-line {
            border-top: 1px solid #333;
            padding-top: 8px;
            margin-top: 50px;
            font-size: 10pt;
          }
          .thank-you {
            text-align: center;
            font-weight: bold;
            font-size: 11pt;
            margin-top: 30px;
          }
          @media print {
            body {
              padding: 0;
            }
            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <header>
            <div class="header-left">
              <img src="${LOGO_FALLBACK}" alt="Logo" class="logo" onerror="this.style.display='none'">
              <div class="company-info">
                <h1>Sewanagala Ayurvedic Drugs Manufacture (PVT) LTD</h1>
                <p>Bogaha Junction, Kiriibbanwewa, Sewanagala.</p>
                <p>Tel: 047-3133540</p>
                <p>Email: sewanagalaayurwedaya@gmail.com</p>
                <p>Website: www.sewanagalaayurvedaya.com</p>
              </div>
            </div>
            <div class="certifications">
              <img src="${ISO_CERT}" alt="ISO Certification" onerror="this.style.display='none'">
              <img src="${GMP_CERT}" alt="GMP Certification" onerror="this.style.display='none'">
            </div>
          </header>

          <div class="invoice-title-section">
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-details">
              <div><strong>DATE :</strong> ${invoiceData.date}</div>
              <div><strong>INVOICE NO :</strong> ${invoiceData.invoiceNo}</div>
              <div><strong>ORDER NO :</strong> ${invoiceData.orderNo}</div>
              <div><strong>PAYMENT METHOD :</strong> ${invoiceData.paymentMethod}</div>
            </div>
          </div>

          <div class="bill-to-section">
            <div class="bill-to-header">BILL TO</div>
            <div class="bill-to-content">
              <p><strong>${invoiceData.billTo.name}</strong></p>
              <p>${invoiceData.billTo.address}</p>
              <p>${invoiceData.billTo.phone}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>ITEM CODE</th>
                <th>ITEM DESCRIPTION</th>
                <th>QUANTITY</th>
                <th>UNIT PRICE</th>
                <th class="text-right">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${invoiceData.items.map(item => `
                <tr>
                  <td>${item.itemCode}</td>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>Rs. ${item.unitPrice.toFixed(2)}</td>
                  <td class="text-right">Rs. ${item.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals-section">
            <div class="totals-box">
              <div class="totals-row subtotal">
                <span>SUBTOTAL:</span>
                <span>Rs. ${subtotal.toFixed(2)}</span>
              </div>
              <div class="totals-row discount">
                <span>DISCOUNT (${invoiceData.discount}%):</span>
                <span>Rs. ${discountAmount.toFixed(2)}</span>
              </div>
              <div class="totals-row net-total">
                <span>NET TOTAL:</span>
                <span>Rs. ${netTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <footer>
            <div class="signature-section">
              <div class="signature-box">
                <div class="signature-line">PREPARED BY</div>
              </div>
              <div class="signature-box">
                <div class="signature-line">APPROVED BY</div>
              </div>
              <div class="signature-box">
                <div class="signature-line">CUSTOMER</div>
              </div>
            </div>
            <div class="thank-you">Thank You For Your Business!</div>
          </footer>
        </div>
      </body>
      </html>
    `;
  };

  const handleSave = () => {
    if (onSave) {
      onSave(invoiceData);
    }
  };

  useEffect(() => {
    if (initialData) {
      setInvoiceData(prev => ({
        ...prev,
        ...initialData,
        items: initialData.items || prev.items,
        billTo: initialData.billTo || prev.billTo,
      }));
    }
  }, [initialData]);

  useEffect(() => {
    if (readOnly && invoiceData.invoiceNo && !hasTriggeredPrint.current) {
      hasTriggeredPrint.current = true;
    }
  }, [readOnly, invoiceData.invoiceNo]);

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="invoice-container container mx-auto px-4 max-w-5xl">
        <div className="bg-white rounded-lg shadow-2xl p-8 border border-gray-200">
          <header className="flex justify-between items-start pb-6 border-b border-gray-200">
            <div className="flex items-center">
              <img
                src={logoSrc}
                alt="Sewanagala Ayurvedic Logo"
                className="h-20 w-20 mr-4 object-contain flex-shrink-0"
                style={{ minWidth: '80px', maxWidth: '80px' }}
                onError={() => setLogoSrc(LOGO_FALLBACK)}
                crossOrigin="anonymous"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Sewanagala Ayurvedic Drugs Manufacture (PVT) LTD
                </h1>
                <p className="text-sm text-gray-500">
                  Bogaha Junction, Kiriibbanwewa, Sewanagala.
                </p>
                <p className="text-sm text-gray-500">Tel: 047-3133540</p>
                <p className="text-sm text-gray-500">
                  Email: sewanagalaayurwedaya@gmail.com
                </p>
                <p className="text-sm text-gray-500">
                  Website: www.sewanagalaayurvedaya.com
                </p>
              </div>
            </div>
            <div className="flex space-x-3 flex-shrink-0 items-center">
              <img
                src={ISO_CERT}
                alt="ISO Certification"
                className="h-20 object-contain"
                style={{ minHeight: '80px', maxHeight: '80px', width: 'auto' }}
                crossOrigin="anonymous"
              />
              <img
                src={GMP_CERT}
                alt="GMP Certification"
                className="h-20 object-contain"
                style={{ minHeight: '80px', maxHeight: '80px', width: 'auto' }}
                crossOrigin="anonymous"
              />
            </div>
          </header>

          <section className="mt-8 flex justify-between items-center">
            <div>
              <h2 className="text-4xl font-bold text-cyan-600 tracking-wider">
                INVOICE
              </h2>
            </div>
            <div className="text-right text-sm text-gray-600">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <span className="font-semibold">DATE :</span>
                {readOnly ? (
                  <span className="text-left">{invoiceData.date}</span>
                ) : (
                  <input
                    type="date"
                    value={invoiceData.date}
                    onChange={(e) =>
                      setInvoiceData({ ...invoiceData, date: e.target.value })
                    }
                    className="text-left border-b border-gray-300 focus:outline-none focus:border-cyan-500"
                  />
                )}
                <span className="font-semibold">INVOICE NO :</span>
                {readOnly ? (
                  <span className="text-left">{invoiceData.invoiceNo}</span>
                ) : (
                  <input
                    type="text"
                    value={invoiceData.invoiceNo}
                    onChange={(e) =>
                      setInvoiceData({ ...invoiceData, invoiceNo: e.target.value })
                    }
                    className="text-left border-b border-gray-300 focus:outline-none focus:border-cyan-500"
                    placeholder="INV-00123"
                  />
                )}
                <span className="font-semibold">ORDER NO :</span>
                {readOnly ? (
                  <span className="text-left">{invoiceData.orderNo}</span>
                ) : (
                  <input
                    type="text"
                    value={invoiceData.orderNo}
                    onChange={(e) =>
                      setInvoiceData({ ...invoiceData, orderNo: e.target.value })
                    }
                    className="text-left border-b border-gray-300 focus:outline-none focus:border-cyan-500"
                    placeholder="ORD-00456"
                  />
                )}
                <span className="font-semibold">PAYMENT METHOD :</span>
                {readOnly ? (
                  <span className="text-left">{invoiceData.paymentMethod}</span>
                ) : (
                  <select
                    value={invoiceData.paymentMethod}
                    onChange={(e) =>
                      setInvoiceData({
                        ...invoiceData,
                        paymentMethod: e.target.value,
                      })
                    }
                    className="text-left border-b border-gray-300 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit">Credit</option>
                  </select>
                )}
              </div>
            </div>
          </section>

          <section className="mt-8">
            <div className="bg-cyan-600 text-white px-3 py-2 rounded-t-lg text-sm font-semibold">
              BILL TO
            </div>
            <div className="border border-t-0 border-gray-200 p-4 rounded-b-lg text-sm text-gray-600">
              {readOnly ? (
                <>
                  <p>
                    <strong>{invoiceData.billTo.name}</strong>
                  </p>
                  <p>{invoiceData.billTo.address}</p>
                  <p>{invoiceData.billTo.phone}</p>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={invoiceData.billTo.name}
                    onChange={(e) =>
                      setInvoiceData({
                        ...invoiceData,
                        billTo: { ...invoiceData.billTo, name: e.target.value },
                      })
                    }
                    placeholder="Customer Name"
                    className="w-full mb-2 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <input
                    type="text"
                    value={invoiceData.billTo.address}
                    onChange={(e) =>
                      setInvoiceData({
                        ...invoiceData,
                        billTo: { ...invoiceData.billTo, address: e.target.value },
                      })
                    }
                    placeholder="Address"
                    className="w-full mb-2 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <input
                    type="text"
                    value={invoiceData.billTo.phone}
                    onChange={(e) =>
                      setInvoiceData({
                        ...invoiceData,
                        billTo: { ...invoiceData.billTo, phone: e.target.value },
                      })
                    }
                    placeholder="Phone Number"
                    className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </>
              )}
            </div>
          </section>

          <section className="mt-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cyan-600 text-white">
                  <th className="p-3 text-left font-semibold">ITEM CODE</th>
                  <th className="p-3 text-left font-semibold w-2/5">
                    ITEM DESCRIPTION
                  </th>
                  <th className="p-3 text-left font-semibold">QUANTITY</th>
                  <th className="p-3 text-left font-semibold">UNIT PRICE</th>
                  <th className="p-3 text-right font-semibold">AMOUNT</th>
                  {!readOnly && (
                    <th className="p-3 text-center font-semibold no-print">ACTION</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoiceData.items.map((item, index) => (
                  <tr key={index}>
                    <td className="p-3">
                      {readOnly ? (
                        item.itemCode
                      ) : (
                        <input
                          type="text"
                          value={item.itemCode}
                          onChange={(e) =>
                            handleItemChange(index, 'itemCode', e.target.value)
                          }
                          placeholder="Code"
                          className="w-full p-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      )}
                    </td>
                    <td className="p-3">
                      {readOnly ? (
                        item.description
                      ) : (
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) =>
                            handleItemChange(index, 'description', e.target.value)
                          }
                          placeholder="Description"
                          className="w-full p-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      )}
                    </td>
                    <td className="p-3">
                      {readOnly ? (
                        item.quantity
                      ) : (
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              'quantity',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0"
                          min="0"
                          className="w-full p-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      )}
                    </td>
                    <td className="p-3">
                      {readOnly ? (
                        `Rs. ${item.unitPrice.toFixed(2)}`
                      ) : (
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              'unitPrice',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full p-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      )}
                    </td>
                    <td className="p-3 text-right">Rs. {item.amount.toFixed(2)}</td>
                    {!readOnly && (
                      <td className="p-3 text-center no-print">
                        <button
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          disabled={invoiceData.items.length === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!readOnly && (
              <button
                onClick={addItem}
                className="no-print mt-4 bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-cyan-700 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            )}
          </section>

          <section className="mt-6 flex justify-end">
            <div className="w-full max-w-xs space-y-2 text-sm text-gray-700">
              <div className="flex justify-between items-center bg-gray-100 p-2 rounded-md">
                <span className="font-semibold">SUBTOTAL:</span>
                <span>Rs. {calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2">
                <span className="font-semibold">DISCOUNT (%):</span>
                {readOnly ? (
                  <span>{invoiceData.discount}%</span>
                ) : (
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
                    className="w-20 text-right bg-transparent border-b border-gray-300 focus:outline-none focus:border-cyan-500"
                  />
                )}
              </div>
              <div className="flex justify-between items-center bg-gray-200 p-3 rounded-md font-bold text-base">
                <span>NET TOTAL:</span>
                <span>Rs. {calculateNetTotal().toFixed(2)}</span>
              </div>
            </div>
          </section>

          <footer className="mt-16 pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
            <div className="flex justify-between items-center">
              <div className="w-1/3">
                <p className="border-t border-gray-400 pt-2 mt-8">PREPARED BY</p>
              </div>
              <div className="w-1/3">
                <p className="border-t border-gray-400 pt-2 mt-8">APPROVED BY</p>
              </div>
              <div className="w-1/3">
                <p className="border-t border-gray-400 pt-2 mt-8">CUSTOMER</p>
              </div>
            </div>
            <p className="mt-12 font-semibold">Thank You For Your Business!</p>
          </footer>
        </div>

        <div className="text-center my-6 no-print flex gap-4 justify-center">
          <button
            onClick={handlePrint}
            className="bg-gray-700 text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Invoice
          </button>
          {!readOnly && onSave && (
            <button
              onClick={handleSave}
              className="bg-cyan-600 text-white px-6 py-2 rounded-lg hover:bg-cyan-700 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              Save Invoice
            </button>
          )}
        </div>
      </div>

      <style>{`
        img {
          display: block;
        }

        @media print {
          @page {
            margin: 0.5cm;
            size: A4;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html, body {
            margin: 0;
            padding: 0;
            background: white !important;
            overflow: visible !important;
          }

          body > div:not(:has(.invoice-container)),
          header:not(.invoice-container header),
          nav,
          footer:not(.invoice-container footer),
          .sidebar,
          .navigation,
          .menu,
          .no-print {
            display: none !important;
          }

          .invoice-container {
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 10px !important;
            border: none !important;
          }

          .invoice-container > div {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
          }

          .bg-gray-50,
          .bg-white {
            background-color: white !important;
            padding: 0 !important;
            min-height: auto !important;
          }

          img {
            display: block !important;
            max-width: 100%;
            height: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default InvoiceGenerator;
