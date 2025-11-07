
import React, { useState, useMemo } from 'react';
import { useFirebaseData } from '../../hooks/useFirebaseData';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../../components/Common/LoadingSpinner';
import { ErrorMessage } from '../../components/Common/ErrorMessage';
import InvoiceGenerator from '../../components/Common/InvoiceGenerator';
import { FileText, ArrowLeft, Printer } from 'lucide-react';

interface InvoiceSummary {
  id: string;
  invoiceNo: string;
  date: string;
  billTo: { name: string; };
  items: any[];
  discount: number;
  [key: string]: any; 
}

export function DRInvoiceHistory() {
  const { userData } = useAuth();
  const { data: invoicesData, loading, error } = useFirebaseData<any>('invoices');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const userInvoices = useMemo((): InvoiceSummary[] => {
    if (!invoicesData || !userData) return [];
    return Object.entries(invoicesData)
      .map(([id, invoice]: [string, any]) => ({ id, ...invoice }))
      .filter(invoice => invoice.createdBy === userData.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoicesData, userData]);

  const handleViewInvoice = (invoice: InvoiceSummary) => {
    const fullInvoiceData = invoicesData[invoice.id];
    setSelectedInvoice(fullInvoiceData);
  };
  
  const calculateTotal = (items: any[], discount: number = 0) => {
    const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    return subtotal * (1 - discount / 100);
  };

  if (loading) return <LoadingSpinner text="Loading invoice history..." />;
  if (error) return <ErrorMessage message={`Error loading invoices: ${error.message}`} />;

  if (selectedInvoice) {
    return (
      <div>
        <button onClick={() => setSelectedInvoice(null)} className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors">
          <ArrowLeft size={16} />
          Back to Invoice History
        </button>
        <InvoiceGenerator initialData={selectedInvoice} readOnly={true} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-3 text-gray-800">
        <FileText />
        My Invoice History
      </h1>

      {userInvoices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userInvoices.map(invoice => (
            <div key={invoice.id} className="bg-white rounded-xl shadow-md border border-gray-200 p-5 flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-indigo-600">{invoice.invoiceNo}</p>
                    <p className="text-sm text-gray-500">{new Date(invoice.date).toLocaleDateString()}</p>
                  </div>
                  <p className="text-xl font-bold text-gray-800">
                    Rs. {calculateTotal(invoice.items, invoice.discount).toFixed(2)}
                  </p>
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium text-gray-500">Customer:</span> {invoice.billTo.name}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => handleViewInvoice(invoice)}
                  className="w-full bg-blue-600 text-white p-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                >
                  <Printer size={16} /> View & Print
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-lg border-dashed border-2 border-gray-300">
            <h3 className="text-xl font-semibold text-gray-800">No Invoices Found</h3>
            <p className="text-gray-500 mt-2">You have not created any invoices yet.</p>
        </div>
      )}
    </div>
  );
}
