import React, { useState, useEffect } from 'react';
import { ref, onValue, get, push, set, update, remove } from 'firebase/database';
import { database } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { ErrorMessage } from '../Common/ErrorMessage';
import { Search, Plus, Edit2, Trash2, User, Phone, MapPin, Calendar, UserCheck } from 'lucide-react';
import { Modal } from '../Common/Modal';

interface Customer {
  customerId: string;
  name: string;
  phone: string;
  address: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  lastUpdated: string;
  totalInvoices?: number;
  totalSpent?: number;
}

export function DSCustomerManagement() {
  const { userData } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    console.log('DSCustomerManagement mounted');
    loadCustomers();
  }, []);

  useEffect(() => {
    console.log('Filtering customers, count:', customers.length);
    filterCustomers();
  }, [searchTerm, customers]);

  const loadCustomers = () => {
    setLoading(true);
    const customersRef = ref(database, 'dscustomers');

    console.log('Loading customers from Firebase...');

    onValue(customersRef, (snapshot) => {
      console.log('Snapshot exists:', snapshot.exists());

      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log('Customer data:', data);
        const customerList: Customer[] = [];

        Object.entries(data).forEach(([key, value]) => {
          const customer = value as any;

          customerList.push({
            customerId: key,
            name: customer.name || '',
            phone: customer.phone || '',
            address: customer.address || '',
            createdBy: customer.createdBy || '',
            createdByName: customer.createdByName || '',
            createdAt: customer.createdAt || '',
            lastUpdated: customer.lastUpdated || '',
            totalInvoices: 0,
            totalSpent: 0
          });
        });

        console.log('Loaded customers:', customerList.length);

        customerList.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setCustomers(customerList);

        customerList.forEach(customer => {
          loadCustomerStats(customer.customerId, customer.phone);
        });
      } else {
        console.log('No customers found in database');
        setCustomers([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading customers:', error);
      setError('Failed to load customers: ' + error.message);
      setLoading(false);
    });
  };

  const loadCustomerStats = async (customerId: string, phone: string) => {
    try {
      const showroomsRef = ref(database, 'direct_showrooms');
      const snapshot = await get(showroomsRef);

      let invoiceCount = 0;
      let totalSpent = 0;

      if (snapshot.exists()) {
        const showrooms = snapshot.val();

        Object.values(showrooms).forEach((showroom: any) => {
          if (showroom.dsinvoices) {
            Object.values(showroom.dsinvoices).forEach((invoice: any) => {
              if (invoice.customerPhone === phone) {
                invoiceCount++;
                totalSpent += invoice.total || 0;
              }
            });
          }
        });
      }

      setCustomers(prev => prev.map(c =>
        c.customerId === customerId
          ? { ...c, totalInvoices: invoiceCount, totalSpent: totalSpent }
          : c
      ));
    } catch (err) {
      console.error('Error getting invoice stats:', err);
    }
  };

  const filterCustomers = () => {
    if (!searchTerm.trim()) {
      setFilteredCustomers(customers);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = customers.filter(customer =>
      customer.name.toLowerCase().includes(term) ||
      customer.phone.includes(term) ||
      customer.address.toLowerCase().includes(term)
    );

    setFilteredCustomers(filtered);
  };

  const handleAddCustomer = async () => {
    setError(null);

    if (!formData.name.trim() || !formData.phone.trim()) {
      setError('Name and phone are required');
      return;
    }

    try {
      const customersRef = ref(database, 'dscustomers');
      const snapshot = await get(customersRef);

      if (snapshot.exists()) {
        const customers = snapshot.val();
        const phoneExists = Object.values(customers).some(
          (customer: any) => customer.phone === formData.phone
        );

        if (phoneExists) {
          setError('A customer with this phone number already exists');
          return;
        }
      }

      const newCustomerRef = push(customersRef);
      await set(newCustomerRef, {
        customerId: newCustomerRef.key,
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        createdBy: userData?.id || '',
        createdByName: userData?.name || '',
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });

      setSuccess('Customer added successfully');
      setShowAddModal(false);
      setFormData({ name: '', phone: '', address: '' });

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error adding customer:', err);
      setError(err.message || 'Failed to add customer');
    }
  };

  const handleEditCustomer = async () => {
    setError(null);

    if (!formData.name.trim() || !formData.phone.trim()) {
      setError('Name and phone are required');
      return;
    }

    if (!selectedCustomer) return;

    try {
      const customersRef = ref(database, 'dscustomers');
      const snapshot = await get(customersRef);

      if (snapshot.exists()) {
        const customers = snapshot.val();
        const phoneExists = Object.entries(customers).some(
          ([key, customer]: [string, any]) =>
            customer.phone === formData.phone && key !== selectedCustomer.customerId
        );

        if (phoneExists) {
          setError('Another customer with this phone number already exists');
          return;
        }
      }

      const customerRef = ref(database, `dscustomers/${selectedCustomer.customerId}`);
      await update(customerRef, {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        lastUpdated: new Date().toISOString()
      });

      setSuccess('Customer updated successfully');
      setShowEditModal(false);
      setSelectedCustomer(null);
      setFormData({ name: '', phone: '', address: '' });

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error updating customer:', err);
      setError(err.message || 'Failed to update customer');
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (!confirm(`Are you sure you want to delete ${customer.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      const customerRef = ref(database, `dscustomers/${customer.customerId}`);
      await remove(customerRef);

      setSuccess('Customer deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error deleting customer:', err);
      setError(err.message || 'Failed to delete customer');
    }
  };

  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      address: customer.address
    });
    setShowEditModal(true);
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setSelectedCustomer(null);
    setFormData({ name: '', phone: '', address: '' });
    setError(null);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-gray-600 mt-1">Manage your customer database</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Customer
        </button>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-medium">{success}</p>
        </div>
      )}

      {error && !showAddModal && !showEditModal && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <ErrorMessage message={error} />
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name, phone, or address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {filteredCustomers.length} of {customers.length} customers
          </span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No customers found</p>
            <p className="text-sm text-gray-500 mt-1">
              {searchTerm ? 'Try adjusting your search' : 'Add your first customer to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statistics
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.customerId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            {customer.createdByName || 'Unknown'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-sm text-gray-900 flex items-center gap-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          {customer.phone}
                        </div>
                        {customer.address && (
                          <div className="text-sm text-gray-500 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            {customer.address}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-sm text-gray-900">
                          {customer.totalInvoices || 0} invoice{customer.totalInvoices !== 1 ? 's' : ''}
                        </div>
                        <div className="text-sm font-semibold text-green-600">
                          Rs. {(customer.totalSpent || 0).toFixed(2)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500 gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(customer.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(customer)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                          title="Edit customer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCustomer(customer)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete customer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={showAddModal}
        onClose={closeModals}
        title="Add New Customer"
      >
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <ErrorMessage message={error} />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="0771234567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Main Street, Colombo"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={closeModals}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleAddCustomer}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              Add Customer
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditModal}
        onClose={closeModals}
        title="Edit Customer"
      >
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <ErrorMessage message={error} />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="0771234567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="123 Main Street, Colombo"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={closeModals}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleEditCustomer}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
