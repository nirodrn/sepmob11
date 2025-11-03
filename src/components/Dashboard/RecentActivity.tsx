import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Package, 
  FileText,
  TrendingUp
} from 'lucide-react';

interface Activity {
  id: string;
  type: 'request' | 'approval' | 'rejection' | 'fulfillment' | 'invoice' | 'payment';
  description: string;
  createdAt: number;
  status?: string;
}

interface RecentActivityProps {
  activities: Activity[];
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'request':
      return Clock;
    case 'approval':
      return CheckCircle;
    case 'rejection':
      return XCircle;
    case 'fulfillment':
      return Package;
    case 'invoice':
      return FileText;
    case 'payment':
      return TrendingUp;
    default:
      return Clock;
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case 'request':
      return 'text-amber-600 bg-amber-50';
    case 'approval':
      return 'text-green-600 bg-green-50';
    case 'rejection':
      return 'text-red-600 bg-red-50';
    case 'fulfillment':
      return 'text-blue-600 bg-blue-50';
    case 'invoice':
      return 'text-purple-600 bg-purple-50';
    case 'payment':
      return 'text-teal-600 bg-teal-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

export function RecentActivity({ activities }: RecentActivityProps) {
  const mockActivities: Activity[] = [
    {
      id: '1',
      type: 'request',
      description: 'New product request submitted for M oil (10 units)',
      createdAt: Date.now() - 1800000, // 30 minutes ago
    },
    {
      id: '2',
      type: 'approval',
      description: 'Product request approved by HO',
      createdAt: Date.now() - 7200000, // 2 hours ago
    },
    {
      id: '3',
      type: 'invoice',
      description: 'Invoice INV-2025-0045 generated for customer John Doe',
      createdAt: Date.now() - 14400000, // 4 hours ago
    },
    {
      id: '4',
      type: 'payment',
      description: 'Payment received for invoice INV-2025-0043 (LKR 25,000)',
      createdAt: Date.now() - 21600000, // 6 hours ago
    },
    {
      id: '5',
      type: 'fulfillment',
      description: 'Products dispatched to showroom location',
      createdAt: Date.now() - 86400000, // 1 day ago
    }
  ];

  const displayActivities = activities.length > 0 ? activities : mockActivities;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
      
      <div className="space-y-4">
        {displayActivities.map((activity) => {
          const Icon = getActivityIcon(activity.type);
          const colorClasses = getActivityColor(activity.type);
          
          return (
            <div key={activity.id} className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${colorClasses}`}>
                <Icon className="w-4 h-4" />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">{activity.description}</p>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200">
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          View All Activity
        </button>
      </div>
    </div>
  );
}