import React, { useState } from 'react';
import { User, LogOut, Wifi, WifiOff, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOffline } from '../../context/OfflineContext';

export function Header() {
  const { userData, signOut } = useAuth();
  const { isOnline, offlineData } = useOffline();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Dummy notifications data
  const notifications = [
    { id: 1, title: 'New sales request', description: 'A new sales request has been submitted by John Doe.' },
    { id: 2, title: 'Invoice paid', description: 'Invoice #1234 has been paid by Jane Smith.' },
    { id: 3, title: 'Stock running low', description: 'Stock for product XYZ is running low.' },
    { id: 4, title: 'New message', description: 'You have a new message from a customer.' },
    { id: 5, title: 'System update', description: 'The system will be down for maintenance tonight.' },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getTotalOfflineItems = () => {
    return offlineData.salesRequests.length + offlineData.invoices.length + offlineData.activities.length;
  };

  const toggleNotifications = () => {
    setIsNotificationsOpen(!isNotificationsOpen);
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">Sewanagala Sales</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Wifi className="w-5 h-5 text-green-600" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-600" />
              )}
              <span className={`hidden sm:inline text-sm ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
              {!isOnline && getTotalOfflineItems() > 0 && (
                <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full">
                  {getTotalOfflineItems()} pending
                </span>
              )}
            </div>

            {/* Notifications */}
            <div className="sm:relative">
              <button
                onClick={toggleNotifications}
                className="relative p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>
              {isNotificationsOpen && (
                <div className="absolute mt-2 w-full sm:w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 right-0 left-0 sm:left-auto">
                  <div className="p-4">
                    <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
                    <ul className="mt-4 space-y-4 max-h-60 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <li key={notification.id} className="p-2 hover:bg-gray-100 rounded-md">
                            <p className="font-medium">{notification.title}</p>
                            <p className="text-sm text-gray-500">{notification.description}</p>
                          </li>
                        ))
                      ) : (
                        <li className="p-2 text-center text-gray-500">No new notifications</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <User className="w-5 h-5 text-gray-600" />
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{userData?.name}</p>
                  <p className="text-gray-500 text-xs">{userData?.role}</p>
                </div>
              </div>
              
              <button
                onClick={handleSignOut}
                className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
