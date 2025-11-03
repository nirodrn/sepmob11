import React from 'react';
import { TrendingUp, TrendingDown, Package, FileText, Clock, CheckCircle } from 'lucide-react';

interface DashboardCard {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  icon: React.ComponentType<any>;
  color: string;
}

interface DashboardCardsProps {
  cards: DashboardCard[];
}

export function DashboardCards({ cards }: DashboardCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-600">{card.title}</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
              {card.change && (
                <div className={`flex items-center mt-1 text-xs sm:text-sm ${
                  card.change.type === 'increase' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {card.change.type === 'increase' ? (
                    <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  ) : (
                    <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  )}
                  {Math.abs(card.change.value)}%
                </div>
              )}
            </div>
            <div className={`p-2 sm:p-3 rounded-full ${card.color}`}>
              <card.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Role-specific dashboard cards
export const getDashboardCards = (role: string) => {
  const baseCards: DashboardCard[] = [
    {
      title: 'Pending Requests',
      value: 5,
      icon: Clock,
      color: 'bg-amber-500'
    },
    {
      title: 'Approved This Month',
      value: 23,
      change: { value: 12, type: 'increase' },
      icon: CheckCircle,
      color: 'bg-green-500'
    },
    {
      title: 'Total Sales',
      value: 'LKR 125,000',
      change: { value: 8, type: 'increase' },
      icon: TrendingUp,
      color: 'bg-blue-500'
    },
    {
      title: 'Active Invoices',
      value: 18,
      icon: FileText,
      color: 'bg-purple-500'
    }
  ];

  // Management roles get different cards
  if (role === 'HeadOfOperations' || role === 'MainDirector' || role === 'Admin' || role === 'WarehouseStaff' || role === 'ProductionManager') {
    return [
      {
        title: 'All Pending Requests',
        value: 47,
        icon: Clock,
        color: 'bg-amber-500'
      },
      {
        title: 'Monthly Sales',
        value: 'LKR 2.4M',
        change: { value: 15, type: 'increase' },
        icon: TrendingUp,
        color: 'bg-green-500'
      },
      {
        title: 'Active Representatives',
        value: 124,
        icon: Package,
        color: 'bg-blue-500'
      },
      {
        title: 'Outstanding Invoices',
        value: 89,
        icon: FileText,
        color: 'bg-red-500'
      }
    ];
  }

  return baseCards;
};