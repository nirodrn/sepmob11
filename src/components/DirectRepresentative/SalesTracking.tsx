import React, { useState } from 'react';
import { TrendingUp, Package, DollarSign, Users, Calendar, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export function SalesTracking() {
  const [dateRange, setDateRange] = useState('thisMonth');
  const [filterStatus, setFilterStatus] = useState('all');

  // Mock data - replace with real data from Firebase
  const salesData = {
    totalSales: 125000,
    totalOrders: 23,
    totalCustomers: 18,
    avgOrderValue: 5435,
    monthlyGrowth: 12.5,
    recentSales: [
      {
        id: '1',
        customerName: 'ABC Store',
        amount: 15000,
        products: ['M oil', 'B oil'],
        date: Date.now() - 86400000,
        status: 'paid'
      },
      {
        id: '2',
        customerName: 'XYZ Mart',
        amount: 8500,
        products: ['M oil'],
        date: Date.now() - 172800000,
        status: 'pending'
      },
      {
        id: '3',
        customerName: 'Quick Shop',
        amount: 12000,
        products: ['B oil'],
        date: Date.now() - 259200000,
        status: 'paid'
      }
    ]
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'paid':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'pending':
        return `${baseClasses} bg-amber-100 text-amber-800`;
      case 'overdue':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Tracking</h1>
          <p className="text-gray-600 mt-1">Monitor your sales performance and customer activities</p>
        </div>
        
        <div className="flex gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="last3Months">Last 3 Months</option>
            <option value="thisYear">This Year</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">LKR {salesData.totalSales.toLocaleString()}</p>
              <div className="flex items-center mt-2 text-sm text-green-600">
                <TrendingUp className="w-4 h-4 mr-1" />
                +{salesData.monthlyGrowth}%
              </div>
            </div>
            <div className="p-3 rounded-full bg-blue-500">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{salesData.totalOrders}</p>
              <p className="text-sm text-gray-500 mt-2">This month</p>
            </div>
            <div className="p-3 rounded-full bg-green-500">
              <Package className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Customers</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{salesData.totalCustomers}</p>
              <p className="text-sm text-gray-500 mt-2">Unique customers</p>
            </div>
            <div className="p-3 rounded-full bg-purple-500">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">LKR {salesData.avgOrderValue.toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-2">Per order</p>
            </div>
            <div className="p-3 rounded-full bg-amber-500">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sales */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Recent Sales</h2>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {salesData.recentSales.map((sale) => (
            <div key={sale.id} className="p-6 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{sale.customerName}</h3>
                    <p className="text-sm text-gray-500">
                      {sale.products.join(', ')} • {format(new Date(sale.date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-medium text-gray-900">LKR {sale.amount.toLocaleString()}</p>
                    <span className={getStatusBadge(sale.status)}>
                      {sale.status.charAt(0).toUpperCase() + sale.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 text-center">
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            View All Sales
          </button>
        </div>
      </div>

      {/* Sales Chart Placeholder */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Sales Trend</h2>
        <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Sales chart will be implemented here</p>
            <p className="text-sm text-gray-400">Integration with charting library needed</p>
          </div>
        </div>
      </div>
    </div>
  );
}