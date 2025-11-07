import React from 'react';
import { NavLink } from 'react-router-dom';
import { Hop as Home, ShoppingCart, FileText, TrendingUp, Package, Users, ChartBar as BarChart3, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  roles: UserRole[];
}

const navigationItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    roles: ['DirectRepresentative', 'DirectShowroomManager', 'DirectShowroomStaff', 'Distributor', 'DistributorRepresentative', 'HeadOfOperations', 'MainDirector', 'Admin']
  },
  {
    name: 'Product Requests',
    href: '/dr/requests',
    icon: ShoppingCart,
    roles: ['DirectRepresentative']
  },
  {
    name: 'Invoices',
    href: '/dr/invoices',
    icon: FileText,
    roles: ['DirectRepresentative']
  },
  {
    name: 'My Invoices',
    href: '/my-invoices',
    icon: FileText,
    roles: ['DirectRepresentative']
  },
  {
    name: 'Product Requests',
    href: '/distributor/requests',
    icon: ShoppingCart, // Corrected from Shoppingcart
    roles: ['Distributor']
  },
  {
    name: 'Representatives',
    href: '/distributor/representatives',
    icon: Users,
    roles: ['Distributor']
  },
  {
    name: 'Rep Requests',
    href: '/distributor/rep-requests',
    icon: ShoppingCart,
    roles: ['Distributor']
  },
  {
    name: 'Request History',
    href: '/distributor-rep/requests/history',
    icon: FileText,
    roles: ['DistributorRepresentative']
  },
  {
    name: 'Claim Stock',
    href: '/distributor-rep/claim',
    icon: Package,
    roles: ['DistributorRepresentative']
  },
  {
    name: 'My Inventory',
    href: '/distributor-rep/inventory',
    icon: Package,
    roles: ['DistributorRepresentative']
  },
  {
    name: 'Invoices',
    href: '/distributor-rep/invoices',
    icon: FileText,
    roles: ['DistributorRepresentative']
  },
  {
    name: 'Product Requests',
    href: '/direct-showroom/requests',
    icon: ShoppingCart,
    roles: ['DirectShowroomManager']
  },
  {
    name: 'Invoices',
    href: '/direct-showroom/invoices',
    icon: FileText,
    roles: ['DirectShowroomManager']
  },
  {
    name: 'Invoices',
    href: '/invoices',
    icon: FileText,
    roles: ['DirectShowroomStaff']
  },
  {
    name: 'Invoices',
    href: '/distributor/invoices',
    icon: FileText,
    roles: ['Distributor']
  },
  {
    name: 'Sales Tracking',
    href: '/sales',
    icon: TrendingUp,
    roles: ['DirectRepresentative', 'DirectShowroomManager', 'Distributor', 'DistributorRepresentative', 'HeadOfOperations', 'MainDirector', 'Admin']
  },
  {
    name: 'Inventory',
    href: '/inventory',
    icon: Package,
    roles: ['DirectRepresentative', 'DirectShowroomManager', 'DirectShowroomStaff', 'Distributor', 'HeadOfOperations', 'MainDirector', 'Admin']
  },
  {
    name: 'Customers',
    href: '/customers',
    icon: Users,
    roles: ['DirectRepresentative', 'DirectShowroomManager', 'DirectShowroomStaff', 'Distributor']
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    roles: ['HeadOfOperations', 'MainDirector', 'Admin']
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['DirectRepresentative', 'DirectShowroomManager', 'DirectShowroomStaff', 'Distributor', 'DistributorRepresentative', 'HeadOfOperations', 'MainDirector', 'Admin']
  }
];

export function Navigation() {
  const { userData } = useAuth();

  if (!userData) return null;

  const allowedItems = navigationItems.filter(item => 
    item.roles.includes(userData.role)
  );

  return (
    <nav className="bg-white shadow-lg md:shadow-sm border-t md:border-r border-gray-200 w-full md:w-64 min-h-full">
      <div className="p-2 md:p-4">
        <ul className="flex justify-around md:flex-col md:space-y-2">
          {allowedItems.map((item) => (
            <li key={`${item.name}-${item.href}`} className="flex-1 md:flex-none">
              <NavLink
                to={item.href}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 p-2 text-xs font-medium rounded-lg transition-colors md:flex-row md:gap-3 md:px-3 md:py-2 md:text-sm ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 md:border md:border-blue-200'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                <item.icon className="w-5 h-5 md:w-5 md:h-5" />
                <span className="text-center">{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
