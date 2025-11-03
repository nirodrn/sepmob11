import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { ref, get } from 'firebase/database';
import { database } from '../../../config/firebase';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import InvoiceGenerator from '../../Common/InvoiceGenerator';
import { Modal } from '../../Common/Modal';
import { FileText, Eye, Search, Calendar, DollarSign } from 'lucide-react';

interface InvoiceRecord {
  id: string;
  invoiceNo: string;
  orderNo: string;
  date: string;
  paymentMethod: string;
  billTo: {
    name: string;
    address: string;
    phone: string;
  };
  items: Array<{
    itemCode: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  discount: number;
  subtotal: number;
  netTotal: number;
  status: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export function DistributorRepInvoiceHistory() {
  const { userData } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  useEffect(() => {
    if (userData?.id) {
      loadInvoices();
    }
  }, [userData]);

  useEffect(() => {
    filterInvoices();
  }, [searchQuery, invoices]);

  const loadInvoices = async () => {
    if (!userData?.id) return;
    setLoading(true);
    setError(null);

    try {
      const invoicesRef = ref(database, `disrecinvoices/${userData.id}/invoices`);
      const snapshot = await get(invoicesRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        const invoiceList = Object.values(data) as InvoiceRecord[];
        invoiceList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setInvoices(invoiceList);
        setFilteredInvoices(invoiceList);
      } else {
        setInvoices([]);
        setFilteredInvoices([]);
      }
    } catch (err: any) {
      console.error('Error loading invoices:', err);
      setError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const filterInvoices = () => {
    if (!searchQuery.trim()) {
      setFilteredInvoices(invoices);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = invoices.filter(
      (invoice) =>
        invoice.invoiceNo.toLowerCase().includes(query) ||
        invoice.orderNo.toLowerCase().includes(query) ||
        invoice.billTo.name.toLowerCase().includes(query) ||
        invoice.billTo.phone.includes(query)
    );
    setFilteredInvoices(filtered);
  };

  const handleViewInvoice = (invoice: InvoiceRecord) => {
    setSelectedInvoice(invoice);
    setShowInvoiceModal(true);
  };

  const stats = {
    totalInvoices: invoices.length,
    totalRevenue: invoices.reduce((sum, inv) => sum + inv.netTotal, 0),
    thisMonth: invoices.filter(inv => {
      const invoiceDate = new Date(inv.createdAt);
      const now = new Date();
      return invoiceDate.getMonth() === now.getMonth() && invoiceDate.getFullYear() === now.getFullYear();
    }).length,
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!userData) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice History</h1>
          <p className="text-gray-600 mt-1">View all your generated invoices</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">Rs. {stats.totalRevenue.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">{stats.thisMonth}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice number, order number, customer name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'No invoices found' : 'No Invoices Yet'}
            </h3>
            <p className="text-gray-600">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Create your first invoice to see it here'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                    Invoice No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900 uppercase tracking-wider">
                    Net Total
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{invoice.invoiceNo}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {new Date(invoice.date).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">{invoice.billTo.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{invoice.billTo.phone}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{invoice.items.length}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{invoice.paymentMethod}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-green-600">
                        Rs. {invoice.netTotal.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleViewInvoice(invoice)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showInvoiceModal && selectedInvoice && (
        <Modal
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedInvoice(null);
          }}
          title="Invoice Details"
          size="full"
        >
          <InvoiceGenerator
            initialData={{
              date: selectedInvoice.date,
              invoiceNo: selectedInvoice.invoiceNo,
              orderNo: selectedInvoice.orderNo,
              paymentMethod: selectedInvoice.paymentMethod,
              billTo: selectedInvoice.billTo,
              items: selectedInvoice.items.map(item => ({
                itemCode: item.itemCode,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: item.amount,
              })),
              discount: selectedInvoice.discount,
            }}
            readOnly={true}
          />
        </Modal>
      )}
    </div>
  );
}
