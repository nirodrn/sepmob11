import React, { useState, useMemo } from 'react';
import { Plus, Search, Phone, Mail, MapPin, Calendar, Users, UserCheck, TrendingUp, BarChart } from 'lucide-react';
import { Modal } from '../Common/Modal';
import { useFirebaseActions, useFirebaseData } from '../../hooks/useFirebaseData';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { ErrorMessage } from '../Common/ErrorMessage';

interface Customer {
  id: string;
  name: string;
  contact: string;
  email?: string;
  address?: string;
  totalPurchases: number;
  lastPurchase: number | null;
  status: 'active' | 'inactive';
  createdAt: number;
}

export function CustomerManagement() {
  const { userData } = useAuth();
  const { addData } = useFirebaseActions();

  const isDirectShowroom = userData?.role === 'DirectShowroomManager' || userData?.role === 'DirectShowroomStaff';
  const customerPath = isDirectShowroom ? 'dscustomers' : 'customers';

  const { data: customersData, loading: customersLoading, error: customersError } = useFirebaseData(customerPath);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const customers = useMemo(() => {
    console.log('CustomerManagement - Raw data:', customersData);
    console.log('CustomerManagement - Is Direct Showroom:', isDirectShowroom);

    if (!customersData || typeof customersData !== 'object') {
      console.log('CustomerManagement - No data or invalid format');
      return [];
    }

    const mappedCustomers = Object.entries(customersData).map(([id, data]: [string, any]) => {
      if (isDirectShowroom) {
        return {
          id,
          name: data.name || '',
          contact: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          totalPurchases: 0,
          lastPurchase: null,
          status: 'active' as const,
          createdAt: data.createdAt ? new Date(data.createdAt).getTime() : Date.now()
        };
      } else {
        return { id, ...(data as any) };
      }
    });

    console.log('CustomerManagement - Mapped customers:', mappedCustomers);
    return mappedCustomers;
  }, [customersData, isDirectShowroom]);

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    contact: '',
    email: '',
    address: ''
  });

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.contact.includes(searchTerm) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    setFormLoading(true);
    try {
      const customerData = isDirectShowroom ? {
        name: newCustomer.name,
        phone: newCustomer.contact,
        address: newCustomer.address,
        createdBy: userData.id,
        createdByName: userData.name,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      } : {
        ...newCustomer,
        totalPurchases: 0,
        lastPurchase: null,
        status: 'active',
        createdBy: userData.id,
        createdByName: userData.name
      };

      await addData(customerPath, customerData);

      setShowNewCustomer(false);
      setNewCustomer({ name: '', contact: '', email: '', address: '' });
    } catch (error) {
      console.error('Error adding customer:', error);
      alert('Failed to add customer. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };
  
  if (customersLoading) return <LoadingSpinner text="Loading customers..." />;
  if (customersError) return <ErrorMessage message={customersError} />;

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    return status === 'active'
      ? `${baseClasses} bg-green-100 text-green-800`
      : `${baseClasses} bg-gray-100 text-gray-800`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-gray-600 mt-1">Manage your customer database and relationships</p>
        </div>
        
        <button
          onClick={() => setShowNewCustomer(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Customer
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Customers</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{customers.length}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Customers</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {customers.filter(c => c.status === 'active').length}
              </p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                LKR {customers.reduce((sum, c) => sum + c.totalPurchases, 0).toLocaleString()}
              </p>
            </div>
            <div className="p-3 rounded-full bg-purple-100">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Purchase</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                LKR {customers.length > 0 ? Math.round(customers.reduce((sum, c) => sum + c.totalPurchases, 0) / customers.length).toLocaleString() : 0}
              </p>
            </div>
            <div className="p-3 rounded-full bg-amber-100">
              <BarChart className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Customers List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Customer</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Contact</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Total Purchases</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Last Purchase</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-900">{customer.name}</p>
                      {customer.address && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {customer.address}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-900 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {customer.contact}
                      </p>
                      {customer.email && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {customer.email}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-900">
                      LKR {customer.totalPurchases.toLocaleString()}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-sm text-gray-900 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {customer.lastPurchase 
                        ? new Date(customer.lastPurchase).toLocaleDateString()
                        : 'Never'
                      }
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={getStatusBadge(customer.status)}>
                      {customer.status.charAt(0).toUpperCase() + customer.status.slice(1)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-gray-500">No customers found matching your search.</p>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      <Modal isOpen={showNewCustomer} onClose={() => setShowNewCustomer(false)} title="Add New Customer">
        <form onSubmit={handleAddCustomer} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Customer Name *
            </label>
            <input
              type="text"
              value={newCustomer.name}
              onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Number *
            </label>
            <input
              type="tel"
              value={newCustomer.contact}
              onChange={(e) => setNewCustomer({ ...newCustomer, contact: e.target.value })}
              className="w-full border border-gray-300 rounded-.lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={newCustomer.email}
              onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <textarea
              value={newCustomer.address}
              onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowNewCustomer(false)}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {formLoading ? 'Adding...' : 'Add Customer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
