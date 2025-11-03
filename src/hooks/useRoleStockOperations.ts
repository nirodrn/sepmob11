import { useState } from 'react';
import { ref, get, set, update } from 'firebase/database';
import { database } from '../config/firebase';

interface StockEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  productId: string;
  productName: string;
  quantity: number;
  availableQuantity: number;
  usedQuantity: number;
  unitPrice: number;
  discountPercent: number;
  finalPrice: number;
  totalValue: number;
  receivedAt: string;
  requestId: string;
  status: 'available' | 'depleted' | 'reserved';
  source: string;
  location: string;
  expiryDate?: string;
  batchNumber?: string;
  notes?: string;
  lastUpdated: string;
}

interface StockSummary {
  productId: string;
  productName: string;
  totalQuantity: number;
  availableQuantity: number;
  usedQuantity: number;
  totalValue: number;
  averageUnitPrice: number;
  entryCount: number;
  firstReceivedAt: string;
  lastUpdated: string;
}

interface UseRoleStockOperationsReturn {
  addStockEntry: (stockData: {
    userId: string;
    userName: string;
    userRole: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    finalPrice: number;
    requestId: string;
    source: string;
    location?: string;
  }) => Promise<string>;
  useStock: (userId: string, productId: string, quantityToUse: number, reason?: string) => Promise<boolean>;
  getUserStockSummary: (userId: string) => Promise<StockSummary[]>;
  getUserStockEntries: (userId: string, productId?: string) => Promise<StockEntry[]>;
  updateStockEntry: (userId: string, entryId: string, updates: Partial<StockEntry>) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const getStockPath = (userRole: string): string => {
  switch (userRole) {
    case 'DirectShowroomManager':
    case 'DirectShowroomStaff':
      return 'dsstock';
    case 'DirectRepresentative':
      return 'drstock';
    case 'Distributor':
      return 'distributorStock';
    case 'DistributorRepresentative':
      return 'distributorRepStock';
    default:
      return 'genericStock';
  }
};

export function useRoleStockOperations(userRole: string): UseRoleStockOperationsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stockPath = getStockPath(userRole);

  const addStockEntry = async (stockData: {
    userId: string;
    userName: string;
    userRole: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    finalPrice: number;
    requestId: string;
    source: string;
    location?: string;
  }): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const entryId = `${timestamp}_${randomId}`;

      const totalValue = stockData.finalPrice * stockData.quantity;

      const stockEntry: StockEntry = {
        id: entryId,
        userId: stockData.userId,
        userName: stockData.userName,
        userRole: stockData.userRole,
        productId: stockData.productId,
        productName: stockData.productName,
        quantity: stockData.quantity,
        availableQuantity: stockData.quantity,
        usedQuantity: 0,
        unitPrice: stockData.unitPrice,
        discountPercent: stockData.discountPercent,
        finalPrice: stockData.finalPrice,
        totalValue: totalValue,
        receivedAt: new Date().toISOString(),
        requestId: stockData.requestId,
        status: 'available',
        source: stockData.source,
        location: stockData.location || 'warehouse',
        lastUpdated: new Date().toISOString()
      };

      const entryRef = ref(database, `${stockPath}/users/${stockData.userId}/entries/${entryId}`);
      await set(entryRef, stockEntry);

      await updateStockSummary(stockData.userId, stockData.productId, stockData.productName, stockData.quantity, 0, totalValue);

      return entryId;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateStockSummary = async (
    userId: string,
    productId: string,
    productName: string,
    quantityChange: number,
    usedQuantityChange: number,
    valueChange: number = 0
  ) => {
    const summaryRef = ref(database, `${stockPath}/users/${userId}/summary/${productId}`);
    const snapshot = await get(summaryRef);

    if (snapshot.exists()) {
      const existing = snapshot.val();
      const newTotalQuantity = existing.totalQuantity + quantityChange;
      const newTotalValue = existing.totalValue + valueChange;
      const newAverageUnitPrice = newTotalQuantity > 0 ? newTotalValue / newTotalQuantity : 0;

      await set(summaryRef, {
        ...existing,
        totalQuantity: newTotalQuantity,
        availableQuantity: existing.availableQuantity + quantityChange - usedQuantityChange,
        usedQuantity: existing.usedQuantity + usedQuantityChange,
        totalValue: newTotalValue,
        averageUnitPrice: newAverageUnitPrice,
        entryCount: quantityChange > 0 ? existing.entryCount + 1 : existing.entryCount,
        lastUpdated: new Date().toISOString()
      });
    } else {
      const averageUnitPrice = quantityChange > 0 ? valueChange / quantityChange : 0;
      await set(summaryRef, {
        productId,
        productName,
        totalQuantity: quantityChange,
        availableQuantity: quantityChange - usedQuantityChange,
        usedQuantity: usedQuantityChange,
        totalValue: valueChange,
        averageUnitPrice: averageUnitPrice,
        entryCount: 1,
        firstReceivedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    }
  };

  const useStock = async (
    userId: string,
    productId: string,
    quantityToUse: number,
    reason?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const entriesRef = ref(database, `${stockPath}/users/${userId}/entries`);
      const snapshot = await get(entriesRef);

      if (!snapshot.exists()) {
        throw new Error('No stock entries found');
      }

      const entries = snapshot.val();
      const productEntries = Object.entries(entries)
        .map(([id, entry]) => ({ id, ...(entry as StockEntry) }))
        .filter(entry => entry.productId === productId && entry.availableQuantity > 0)
        .sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());

      let remainingToUse = quantityToUse;
      const updates: Record<string, any> = {};
      let totalValueUsed = 0;

      for (const entry of productEntries) {
        if (remainingToUse <= 0) break;

        const useFromThisEntry = Math.min(remainingToUse, entry.availableQuantity);
        const newAvailableQuantity = entry.availableQuantity - useFromThisEntry;
        const newUsedQuantity = entry.usedQuantity + useFromThisEntry;
        const valueUsed = entry.finalPrice * useFromThisEntry;
        totalValueUsed += valueUsed;

        updates[`${stockPath}/users/${userId}/entries/${entry.id}/availableQuantity`] = newAvailableQuantity;
        updates[`${stockPath}/users/${userId}/entries/${entry.id}/usedQuantity`] = newUsedQuantity;
        updates[`${stockPath}/users/${userId}/entries/${entry.id}/status`] = newAvailableQuantity === 0 ? 'depleted' : 'available';
        updates[`${stockPath}/users/${userId}/entries/${entry.id}/lastUpdated`] = new Date().toISOString();

        if (reason) {
          const existingNotes = entry.notes || '';
          updates[`${stockPath}/users/${userId}/entries/${entry.id}/notes`] = `${existingNotes}\nUsed ${useFromThisEntry} units: ${reason}`.trim();
        }

        remainingToUse -= useFromThisEntry;
      }

      if (remainingToUse > 0) {
        throw new Error(`Insufficient stock. Need ${quantityToUse}, but only ${quantityToUse - remainingToUse} available.`);
      }

      await update(ref(database), updates);
      await updateStockSummary(userId, productId, productEntries[0].productName, 0, quantityToUse, -totalValueUsed);

      return true;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getUserStockSummary = async (userId: string): Promise<StockSummary[]> => {
    setLoading(true);
    setError(null);

    try {
      console.log('[useRoleStockOperations] getUserStockSummary - User ID:', userId);
      console.log('[useRoleStockOperations] getUserStockSummary - Stock path:', stockPath);
      const summaryRef = ref(database, `${stockPath}/users/${userId}/summary`);
      const snapshot = await get(summaryRef);

      console.log('[useRoleStockOperations] getUserStockSummary - Snapshot exists:', snapshot.exists());

      if (!snapshot.exists()) {
        console.log('[useRoleStockOperations] getUserStockSummary - No summary data found');
        return [];
      }

      const data = snapshot.val();
      console.log('[useRoleStockOperations] getUserStockSummary - Raw summary data:', data);

      const result = Object.entries(data).map(([productId, summary]) => ({
        productId,
        ...(summary as StockSummary)
      }));

      console.log('[useRoleStockOperations] getUserStockSummary - Processed result:', result);
      return result;
    } catch (err: any) {
      console.error('[useRoleStockOperations] getUserStockSummary - Error:', err);
      console.error('[useRoleStockOperations] getUserStockSummary - Error message:', err?.message);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getUserStockEntries = async (userId: string, productId?: string): Promise<StockEntry[]> => {
    setLoading(true);
    setError(null);

    try {
      const entriesRef = ref(database, `${stockPath}/users/${userId}/entries`);
      const snapshot = await get(entriesRef);

      if (!snapshot.exists()) {
        return [];
      }

      let entries = Object.entries(snapshot.val()).map(([id, entry]) => ({
        id,
        ...(entry as StockEntry)
      }));

      if (productId) {
        entries = entries.filter(entry => entry.productId === productId);
      }

      return entries.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateStockEntry = async (userId: string, entryId: string, updates: Partial<StockEntry>): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const entryRef = ref(database, `${stockPath}/users/${userId}/entries/${entryId}`);
      await update(entryRef, {
        ...updates,
        lastUpdated: new Date().toISOString()
      });
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    addStockEntry,
    useStock,
    getUserStockSummary,
    getUserStockEntries,
    updateStockEntry,
    loading,
    error
  };
}
