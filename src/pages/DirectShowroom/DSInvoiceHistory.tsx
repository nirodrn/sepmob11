import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ref, get } from 'firebase/database';
import { database } from '../../config/firebase';
import { LoadingSpinner } from '../../components/Common/LoadingSpinner';
import { ErrorMessage } from '../../components/Common/ErrorMessage';
import { FileText, Eye, Calendar, DollarSign, User, Package } from 'lucide-react';
import InvoiceGenerator from '../../components/Common/InvoiceGenerator';

interface InvoiceRecord {
  invoiceId: string;
  invoiceNumber: string;
  orderNumber: string;
  showroomId: string;
  showroomName: string;
  showroomCode: string;
  managerId: string;
  managerName: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  items: {
    productId: string;
    productName: string;
    itemCode: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[];
  subtotal: number;
  discount: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  createdTimestamp: number;
}

export default function DSInvoiceHistory() {
  const { userData } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [showInvoiceView, setShowInvoiceView] = useState(false);

  useEffect(() => {
    if (userData?.id) {
      loadInvoices();
    }
  }, [userData]);

  const loadInvoices = async () => {
    if (!userData?.id || !userData?.showroom_id) return;
    setLoading(true);
    setError(null);

    try {
      const invoicesRef = ref(database, `direct_showrooms/${userData.showroom_id}/dsinvoices`);
      const snapshot = await get(invoicesRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        const invoiceList = Object.values(data) as InvoiceRecord[];
        invoiceList.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
        setInvoices(invoiceList);
      } else {
        setInvoices([]);
      }
    } catch (err: any) {
      console.error('Error loading invoices:', err);
      setError(err.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleViewInvoice = (invoice: InvoiceRecord) => {
    setSelectedInvoice(invoice);
    setShowInvoiceView(true);
  };

  const convertToInvoiceData = (invoice: InvoiceRecord) => {
    return {
      date: new Date(invoice.createdAt).toISOString().split('T')[0],
      invoiceNo: invoice.invoiceNumber,
      orderNo: invoice.orderNumber,
      paymentMethod: invoice.paymentMethod,
      billTo: {
        name: invoice.customerName,
        address: invoice.customerAddress,
        phone: invoice.customerPhone
      },
      items: invoice.items.map(item => ({
        itemCode: item.itemCode,
        description: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount
      })),
      discount: invoice.discount
    };
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!userData) return null;

  if (showInvoiceView && selectedInvoice) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between no-print">
          <h2 className="text-xl font-bold text-gray-900">Invoice Details</h2>
          <button
            onClick={() => {
              setShowInvoiceView(false);
              setSelectedInvoice(null);
            }}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            Back to List
          </button>
        </div>
        <InvoiceGenerator
          initialData={convertToInvoiceData(selectedInvoice)}
          readOnly={true}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Invoices</h1>
        <p className="text-gray-600 mt-1">View all invoices you have generated</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Invoice History ({invoices.length})
          </h2>
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Invoices Yet</h3>
            <p className="text-gray-600">You haven't generated any invoices yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.invoiceId}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all bg-white"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{invoice.invoiceNumber}</h3>
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                        {invoice.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="w-4 h-4" />
                        <span>Customer: <span className="font-medium text-gray-900">{invoice.customerName}</span></span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>Date: <span className="font-medium text-gray-900">{new Date(invoice.createdAt).toLocaleDateString()}</span></span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600">
                        <Package className="w-4 h-4" />
                        <span>Items: <span className="font-medium text-gray-900">{invoice.items.length}</span></span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600">
                        <DollarSign className="w-4 h-4" />
                        <span>Total: <span className="font-bold text-green-600">Rs. {invoice.total.toFixed(2)}</span></span>
                      </div>
                    </div>

                    {invoice.customerPhone && (
                      <div className="mt-2 text-sm text-gray-600">
                        Phone: {invoice.customerPhone}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleViewInvoice(invoice)}
                    className="ml-4 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex flex-wrap gap-2">
                    {invoice.items.slice(0, 3).map((item, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {item.productName} (x{item.quantity})
                      </span>
                    ))}
                    {invoice.items.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        +{invoice.items.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
