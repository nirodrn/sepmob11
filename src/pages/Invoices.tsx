import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useFirebaseQuery } from '../hooks/useFirebaseQuery';
import { ErrorMessage } from '../components/Common/ErrorMessage';

// Simplified Invoice interface, directly matching Firebase data
interface Invoice {
  id: string;
  customer: string;
  total: number;
  status: 'paid' | 'unpaid';
  createdAt: { seconds: number; nanoseconds: number; };
  date: string; // Keep this as a fallback if createdAt is missing
}

export function Invoices() {
  // data is now an array of Invoice
  const { data: invoices, loading, error } = useFirebaseQuery<Invoice>('dsinvoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Simplified badge logic
  const getStatusBadge = (status: 'paid' | 'unpaid') => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'paid':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'unpaid':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    
    let sortedInvoices = [...invoices].sort((a, b) => {
        const dateA = a.createdAt ? a.createdAt.seconds : new Date(a.date).getTime() / 1000;
        const dateB = b.createdAt ? b.createdAt.seconds : new Date(b.date).getTime() / 1000;
        return dateB - dateA;
    });

    return sortedInvoices.filter(invoice => {
        const matchesSearch = invoice.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             invoice.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
        return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter]);


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-1">A simple list of all sales invoices.</p>
        </div>
        
        <Link to="/direct-showroom/invoices" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors w-full sm:w-auto">
          <Plus className="w-5 h-5" />
          New Invoice
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by customer or invoice ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div>
        {loading ? (
          <div className="p-8 text-center flex justify-center items-center bg-white rounded-lg shadow-sm border border-gray-200">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            <p className="ml-4 text-gray-500">Loading invoices...</p>
          </div>
        ) : error ? (
            <ErrorMessage message="Failed to load invoices. Please try again later." />
        ) : filteredInvoices.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-lg shadow-sm border border-gray-200">
              <p className="text-gray-500">No invoices found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Invoice ID</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Customer</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900">Amount</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-900">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredInvoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-blue-600">{invoice.id}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-gray-900">{invoice.customer}</p>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <p className="font-medium text-gray-900">LKR {invoice.total.toLocaleString()}</p>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={getStatusBadge(invoice.status)}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                            <span className="text-sm text-gray-600">
                              {format(invoice.createdAt ? new Date(invoice.createdAt.seconds * 1000) : new Date(invoice.date), 'MMM dd, yyyy')}
                            </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>
        )}
      </div>
    </div>
  );
}
