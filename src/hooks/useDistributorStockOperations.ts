import { useState } from 'react';
import { ref, get, set, update } from 'firebase/database';
import { database } from '../config/firebase';

interface DistributorStockEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  distributorId?: string;
  distributorName?: string;
  productId: string;
  productName: string;
  quantity: number;
  availableQuantity: number;
  usedQuantity: number;
  claimedAt?: string;
  receivedAt?: string;
  requestId: string;
  status: 'available' | 'depleted' | 'reserved';
  source: string;
  location: string;
  expiryDate?: string;
  batchNumber?: string;
  notes?: string;
  lastUpdated: string;
  unitPrice?: number;
  finalPrice?: number;
  discountPercent?: number;
  totalValue?: number;
}

interface DistributorStockSummary {
  productId: string;
  productName: string;
  totalQuantity: number;
  availableQuantity: number;
  usedQuantity: number;
  entryCount: number;
  firstClaimedAt: string;
  lastUpdated: string;
  unitPrice?: number;
  finalPrice?: number;
  averageUnitPrice?: number;
}

interface UseDistributorStockOperationsReturn {
  addStockEntry: (
    userId: string,
    distributorId: string,
    productId: string,
    productName: string,
    quantity: number,
    requestId: string,
    source: string,
    userInfo?: { name: string; role: string; distributorName: string; location?: string }
  ) => Promise<string>;
  useStock: (userId: string, productId: string, quantityToUse: number, reason?: string) => Promise<boolean>;
  getUserStockSummary: (userId: string) => Promise<DistributorStockSummary[]>;
  getUserStockEntries: (userId: string, productId?: string) => Promise<DistributorStockEntry[]>;
  updateStockEntry: (userId: string, entryId: string, updates: Partial<DistributorStockEntry>) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function useDistributorStockOperations(): UseDistributorStockOperationsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addStockEntry = async (
    userId: string,
    distributorId: string,
    productId: string,
    productName: string,
    quantity: number,
    requestId: string,
    source: string,
    userInfo?: { name: string; role: string; distributorName: string; location?: string }
  ): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const entryId = `${timestamp}_${randomId}`;

      const stockEntry: DistributorStockEntry = {
        id: entryId,
        userId,
        userName: userInfo?.name || 'Unknown',
        userRole: userInfo?.role || 'Distributor',
        distributorId,
        distributorName: userInfo?.distributorName || 'Unknown Distributor',
        productId,
        productName,
        quantity,
        availableQuantity: quantity,
        usedQuantity: 0,
        claimedAt: new Date().toISOString(),
        requestId,
        status: 'available',
        source,
        location: userInfo?.location || 'warehouse',
        lastUpdated: new Date().toISOString()
      };

      const entryRef = ref(database, `distributorStock/users/${userId}/entries/${entryId}`);
      await set(entryRef, stockEntry);

      await updateStockSummary(userId, productId, productName, quantity, 0);

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
    usedQuantityChange: number
  ) => {
    const summaryRef = ref(database, `distributorStock/users/${userId}/summary/${productId}`);
    const snapshot = await get(summaryRef);

    if (snapshot.exists()) {
      const existing = snapshot.val();
      await set(summaryRef, {
        ...existing,
        totalQuantity: existing.totalQuantity + quantityChange,
        availableQuantity: existing.availableQuantity + quantityChange - usedQuantityChange,
        usedQuantity: existing.usedQuantity + usedQuantityChange,
        entryCount: quantityChange > 0 ? existing.entryCount + 1 : existing.entryCount,
        lastUpdated: new Date().toISOString()
      });
    } else {
      await set(summaryRef, {
        productId,
        productName,
        totalQuantity: quantityChange,
        availableQuantity: quantityChange - usedQuantityChange,
        usedQuantity: usedQuantityChange,
        entryCount: 1,
        firstClaimedAt: new Date().toISOString(),
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
      const entriesRef = ref(database, `distributorStock/users/${userId}/entries`);
      const snapshot = await get(entriesRef);

      if (!snapshot.exists()) {
        throw new Error('No stock entries found');
      }

      const entries = snapshot.val();
      const productEntries = Object.entries(entries)
        .map(([id, entry]) => ({ id, ...(entry as DistributorStockEntry) }))
        .filter(entry => entry.productId === productId && entry.availableQuantity > 0)
        .sort((a, b) => new Date(a.claimedAt).getTime() - new Date(b.claimedAt).getTime());

      let remainingToUse = quantityToUse;
      const updates: Record<string, any> = {};

      for (const entry of productEntries) {
        if (remainingToUse <= 0) break;

        const useFromThisEntry = Math.min(remainingToUse, entry.availableQuantity);
        const newAvailableQuantity = entry.availableQuantity - useFromThisEntry;
        const newUsedQuantity = entry.usedQuantity + useFromThisEntry;

        updates[`distributorStock/users/${userId}/entries/${entry.id}/availableQuantity`] = newAvailableQuantity;
        updates[`distributorStock/users/${userId}/entries/${entry.id}/usedQuantity`] = newUsedQuantity;
        updates[`distributorStock/users/${userId}/entries/${entry.id}/status`] = newAvailableQuantity === 0 ? 'depleted' : 'available';
        updates[`distributorStock/users/${userId}/entries/${entry.id}/lastUpdated`] = new Date().toISOString();

        if (reason) {
          updates[`distributorStock/users/${userId}/entries/${entry.id}/notes`] = `${entry.notes || ''}\nUsed ${useFromThisEntry} units: ${reason}`.trim();
        }

        remainingToUse -= useFromThisEntry;
      }

      if (remainingToUse > 0) {
        throw new Error(`Insufficient stock. Need ${quantityToUse}, but only ${quantityToUse - remainingToUse} available.`);
      }

      await update(ref(database), updates);
      await updateStockSummary(userId, productId, productEntries[0].productName, 0, quantityToUse);

      return true;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getUserStockSummary = async (userId: string): Promise<DistributorStockSummary[]> => {
    setLoading(true);
    setError(null);

    try {
      console.log('[getUserStockSummary] Fetching stock for userId:', userId);
      const entriesRef = ref(database, `distributorStock/users/${userId}/entries`);
      const snapshot = await get(entriesRef);

      if (!snapshot.exists()) {
        console.log('[getUserStockSummary] No entries found');
        return [];
      }

      const entries = snapshot.val();
      console.log('[getUserStockSummary] Raw entries:', entries);
      const summaryMap = new Map<string, any>();

      Object.values(entries as Record<string, DistributorStockEntry>).forEach((entry) => {
        console.log('[getUserStockSummary] Processing entry:', entry);
        console.log('[getUserStockSummary] Entry availableQuantity:', entry.availableQuantity);
        console.log('[getUserStockSummary] Entry unitPrice:', entry.unitPrice);
        console.log('[getUserStockSummary] Entry finalPrice:', entry.finalPrice);

        if (!summaryMap.has(entry.productId)) {
          summaryMap.set(entry.productId, {
            productId: entry.productId,
            productName: entry.productName,
            totalQuantity: 0,
            availableQuantity: 0,
            usedQuantity: 0,
            entryCount: 0,
            firstClaimedAt: entry.claimedAt || entry.receivedAt || new Date().toISOString(),
            lastUpdated: entry.lastUpdated || new Date().toISOString(),
            unitPrice: 0,
            finalPrice: 0,
            averageUnitPrice: 0
          });
        }

        const summary = summaryMap.get(entry.productId);
        summary.totalQuantity += (entry.quantity || 0);
        summary.availableQuantity += (entry.availableQuantity || 0);
        summary.usedQuantity += (entry.usedQuantity || 0);
        summary.entryCount += 1;

        const entryClaimedAt = entry.claimedAt || entry.receivedAt;
        if (entryClaimedAt && new Date(entryClaimedAt) < new Date(summary.firstClaimedAt)) {
          summary.firstClaimedAt = entryClaimedAt;
        }
        if (entry.lastUpdated && new Date(entry.lastUpdated) > new Date(summary.lastUpdated)) {
          summary.lastUpdated = entry.lastUpdated;
        }

        if (entry.unitPrice || entry.finalPrice) {
          const price = entry.unitPrice || entry.finalPrice || 0;
          const currentTotal = summary.averageUnitPrice * (summary.entryCount - 1);
          summary.averageUnitPrice = (currentTotal + price) / summary.entryCount;
          summary.unitPrice = entry.unitPrice || summary.unitPrice;
          summary.finalPrice = entry.finalPrice || entry.unitPrice || summary.finalPrice;
        }
      });

      const result = Array.from(summaryMap.values());
      console.log('[getUserStockSummary] Final summary result:', result);
      return result;
    } catch (err: any) {
      console.error('[getUserStockSummary] Error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getUserStockEntries = async (userId: string, productId?: string): Promise<DistributorStockEntry[]> => {
    setLoading(true);
    setError(null);

    try {
      const entriesRef = ref(database, `distributorStock/users/${userId}/entries`);
      const snapshot = await get(entriesRef);

      if (!snapshot.exists()) {
        console.log('[getUserStockEntries] No entries found for user:', userId);
        return [];
      }

      let entries = Object.entries(snapshot.val()).map(([id, entry]) => ({
        id,
        ...(entry as DistributorStockEntry)
      }));

      console.log('[getUserStockEntries] Total entries found:', entries.length);
      console.log('[getUserStockEntries] Entries with available qty > 0:', entries.filter(e => e.availableQuantity > 0).length);

      if (productId) {
        entries = entries.filter(entry => entry.productId === productId);
        console.log('[getUserStockEntries] Filtered by productId:', productId, 'Count:', entries.length);
      }

      return entries.sort((a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime());
    } catch (err: any) {
      console.error('[getUserStockEntries] Error:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateStockEntry = async (userId: string, entryId: string, updates: Partial<DistributorStockEntry>): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const entryRef = ref(database, `distributorStock/users/${userId}/entries/${entryId}`);
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
