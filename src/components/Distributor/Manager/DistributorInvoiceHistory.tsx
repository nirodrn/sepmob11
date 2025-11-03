import React, { useState, useEffect } from 'react';
import { ref, onValue, get, remove, update } from 'firebase/database';
import { database } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { LoadingSpinner } from '../../Common/LoadingSpinner';
import { ErrorMessage } from '../../Common/ErrorMessage';
import { Modal } from '../../Common/Modal';
import { Search, Edit2, Trash2, FileText, Calendar, User, DollarSign, AlertCircle } from 'lucide-react';
import InvoiceGenerator from '../../Common/InvoiceGenerator';

interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  orderNumber: string;
  distributorId: string;
  distributorName: string;
  recipientType: 'customer' | 'representative';
  recipientId?: string;
  recipientName: string;
  recipientPhone?: string;
  recipientAddress?: string;
  items: Array<{
    productId: string;
    productName: string;
    itemCode: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  subtotal: number;
  discount: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  createdTimestamp: number;
}

export function DistributorInvoiceHistory() {
  const { userData } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (userData?.id) {
      loadInvoices();
    }
  }, [userData]);

  useEffect(() => {
    filterInvoices();
  }, [searchTerm, invoices]);

  const loadInvoices = () => {
    if (!userData?.id) return;
    setLoading(true);

    const invoicesRef = ref(database, `distributorinvoices/${userData.id}`);

    onValue(invoicesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const invoiceList: Invoice[] = [];

        Object.entries(data).forEach(([key, value]) => {
          const invoice = value as any;
          invoiceList.push({
            invoiceId: key,
            ...invoice
          });
        });

        invoiceList.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
        setInvoices(invoiceList);
      } else {
        setInvoices([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading invoices:', error);
      setError('Failed to load invoices');
      setLoading(false);
    });
  };

  const filterInvoices = () => {
    if (!searchTerm.trim()) {
      setFilteredInvoices(invoices);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = invoices.filter(invoice =>
      invoice.invoiceNumber.toLowerCase().includes(term) ||
      invoice.recipientName.toLowerCase().includes(term) ||
      invoice.recipientPhone?.toLowerCase().includes(term) ||
      invoice.orderNumber.toLowerCase().includes(term)
    );

    setFilteredInvoices(filtered);
  };

  const canDeleteInvoice = (invoice: Invoice): boolean => {
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    return invoice.createdTimestamp >= fifteenMinutesAgo;
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (!canDeleteInvoice(invoice)) {
      setError('Cannot delete invoices older than 15 minutes');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!confirm(`Are you sure you want to delete invoice ${invoice.invoiceNumber}? This action cannot be undone and will NOT restore stock.`)) {
      return;
    }

    try {
      const invoiceRef = ref(database, `distributorinvoices/${userData?.id}/${invoice.invoiceId}`);
      await remove(invoiceRef);

      setSuccess('Invoice deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error deleting invoice:', err);
      setError(err.message || 'Failed to delete invoice');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleViewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowViewModal(true);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    if (!canDeleteInvoice(invoice)) {
      setError('Cannot edit invoices older than 15 minutes');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setSelectedInvoice(invoice);
    setShowEditModal(true);
  };

  const handleSaveEditedInvoice = async (editedData: any) => {
    if (!selectedInvoice || !userData?.id) return;

    try {
      const invoiceRef = ref(database, `distributorinvoices/${userData.id}/${selectedInvoice.invoiceId}`);

      const updatedInvoice = {
        ...selectedInvoice,
        recipientName: editedData.billTo.name,
        recipientPhone: editedData.billTo.phone,
        recipientAddress: editedData.billTo.address,
        items: editedData.items.map((item: any) => ({
          productId: item.productId,
          productName: item.description,
          itemCode: item.itemCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount
        })),
        subtotal: editedData.items.reduce((sum: number, item: any) => sum + item.amount, 0),
        discount: editedData.discount,
        discountAmount: editedData.items.reduce((sum: number, item: any) => sum + item.amount, 0) * (editedData.discount / 100),
        total: editedData.items.reduce((sum: number, item: any) => sum + item.amount, 0) * (1 - editedData.discount / 100),
        paymentMethod: editedData.paymentMethod,
        lastUpdated: new Date().toISOString()
      };

      await update(invoiceRef, updatedInvoice);

      setSuccess('Invoice updated successfully');
      setShowEditModal(false);
      setSelectedInvoice(null);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error updating invoice:', err);
      setError(err.message || 'Failed to update invoice');
    }
  };

  const getInvoiceDataForPreview = (invoice: Invoice) => {
    return {
      date: new Date(invoice.createdAt).toISOString().split('T')[0],
      invoiceNo: invoice.invoiceNumber,
      orderNo: invoice.orderNumber,
      paymentMethod: invoice.paymentMethod,
      billTo: {
        name: invoice.recipientName,
        address: invoice.recipientAddress || '',
        phone: invoice.recipientPhone || ''
      },
      items: invoice.items.map(item => ({
        itemCode: item.itemCode,
        description: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        productId: item.productId
      })),
      discount: invoice.discount
    };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (timestamp: number): string => {
    const fifteenMinutes = 15 * 60 * 1000;
    const expiryTime = timestamp + fifteenMinutes;
    const remaining = expiryTime - Date.now();

    if (remaining <= 0) return 'Expired';

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice History</h1>
          <p className="text-gray-600 mt-1">View and manage all distributor invoices</p>
        </div>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-medium">{success}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <ErrorMessage message={error} />
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by invoice number, recipient, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {filteredInvoices.length} of {invoices.length} invoices
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No invoices found</p>
            <p className="text-sm text-gray-500 mt-1">
              {searchTerm ? 'Try adjusting your search' : 'Create your first invoice to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recipient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => {
                  const canEdit = canDeleteInvoice(invoice);
                  return (
                    <tr key={invoice.invoiceId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{invoice.invoiceNumber}</div>
                          <div className="text-xs text-gray-500">{invoice.orderNumber}</div>
                          {canEdit && (
                            <div className="flex items-center gap-1 mt-1">
                              <AlertCircle className="w-3 h-3 text-amber-500" />
                              <span className="text-xs text-amber-600">
                                {getTimeRemaining(invoice.createdTimestamp)}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <User className="w-4 h-4 text-gray-400 mr-2" />
                          <div>
                            <div className="text-sm text-gray-900">{invoice.recipientName}</div>
                            {invoice.recipientPhone && (
                              <div className="text-xs text-gray-500">{invoice.recipientPhone}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          invoice.recipientType === 'representative'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {invoice.recipientType === 'representative' ? 'Representative' : 'Customer'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm font-semibold text-gray-900">
                          <DollarSign className="w-4 h-4 text-gray-400 mr-1" />
                          Rs. {invoice.total.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-500">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(invoice.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewInvoice(invoice)}
                            className="text-blue-600 hover:text-blue-900 p-1"
                            title="View invoice"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditInvoice(invoice)}
                            disabled={!canEdit}
                            className={`p-1 ${canEdit ? 'text-green-600 hover:text-green-900' : 'text-gray-300 cursor-not-allowed'}`}
                            title={canEdit ? 'Edit invoice' : 'Can only edit within 15 minutes'}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(invoice)}
                            disabled={!canEdit}
                            className={`p-1 ${canEdit ? 'text-red-600 hover:text-red-900' : 'text-gray-300 cursor-not-allowed'}`}
                            title={canEdit ? 'Delete invoice' : 'Can only delete within 15 minutes'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedInvoice && (
        <Modal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setSelectedInvoice(null);
          }}
          title="Invoice Details"
          size="xl"
        >
          <InvoiceGenerator
            initialData={getInvoiceDataForPreview(selectedInvoice)}
            onSave={() => {}}
            readOnly={true}
          />
        </Modal>
      )}

      {selectedInvoice && (
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedInvoice(null);
          }}
          title="Edit Invoice"
          size="xl"
        >
          <InvoiceGenerator
            initialData={getInvoiceDataForPreview(selectedInvoice)}
            onSave={handleSaveEditedInvoice}
            readOnly={false}
          />
        </Modal>
      )}
    </div>
  );
}
