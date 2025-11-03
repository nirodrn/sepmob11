import React, { createContext, useContext, useEffect, useState } from 'react';

interface OfflineData {
  salesRequests: any[];
  invoices: any[];
  activities: any[];
}

interface OfflineContextType {
  isOnline: boolean;
  offlineData: OfflineData;
  addOfflineData: (type: keyof OfflineData, data: any) => void;
  syncOfflineData: () => Promise<void>;
  clearOfflineData: () => void;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState<OfflineData>({
    salesRequests: [],
    invoices: [],
    activities: []
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load offline data from localStorage
    const stored = localStorage.getItem('sewanagala_offline_data');
    if (stored) {
      try {
        setOfflineData(JSON.parse(stored));
      } catch (error) {
        console.error('Error loading offline data:', error);
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addOfflineData = (type: keyof OfflineData, data: any) => {
    setOfflineData(prev => {
      const updated = {
        ...prev,
        [type]: [...prev[type], { ...data, _offlineId: Date.now() }]
      };
      localStorage.setItem('sewanagala_offline_data', JSON.stringify(updated));
      return updated;
    });
  };

  const syncOfflineData = async () => {
    if (!isOnline || (offlineData.salesRequests.length === 0 && offlineData.invoices.length === 0 && offlineData.activities.length === 0)) {
      return;
    }

    try {
      // Here you would implement the actual sync logic with Firebase
      console.log('Syncing offline data...', offlineData);
      
      // For now, just clear the offline data after "syncing"
      clearOfflineData();
    } catch (error) {
      console.error('Error syncing offline data:', error);
    }
  };

  const clearOfflineData = () => {
    setOfflineData({
      salesRequests: [],
      invoices: [],
      activities: []
    });
    localStorage.removeItem('sewanagala_offline_data');
  };

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline) {
      syncOfflineData();
    }
  }, [isOnline]);

  const value = {
    isOnline,
    offlineData,
    addOfflineData,
    syncOfflineData,
    clearOfflineData
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}