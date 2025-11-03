import { useState } from 'react';
import { ref, get, set, update } from 'firebase/database';
import { database } from '../config/firebase';

interface DSStockEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  showroomId: string;
  showroomName: string;
  productId: string;
  productName: string;
  quantity: number;
  availableQuantity: number;
  usedQuantity: number;
  unitPrice: number;
  finalPrice: number;
  discountPercent: number;
  claimedAt: string;
  requestId: string;
  status: 'available' | 'depleted' | 'reserved';
  source: string;
  location: string;
  expiryDate?: string;
  batchNumber?: string;
  notes?: string;
  lastUpdated: string;
}

interface DSStockSummary {
  productId: string;
  productName: string;
  totalQuantity: number;
  availableQuantity: number;
  usedQuantity: number;
  entryCount: number;
  firstClaimedAt: string;
  lastUpdated: string;
}

interface UseDirectShowroomStockOperationsReturn {
  addStockEntry: (
    userId: string,
    showroomId: string,
    productId: string,
    productName: string,
    quantity: number,
    requestId: string,
    source: string,
    pricing: { unitPrice: number; finalPrice: number; discountPercent: number },
    userInfo?: { name: string; role: string; showroomName: string; location?: string }
  ) => Promise<string>;
  useStock: (userId: string, productId: string, quantityToUse: number, reason?: string) => Promise<boolean>;
  getUserStockSummary: (userId: string) => Promise<DSStockSummary[]>;
  getUserStockEntries: (userId: string, productId?: string) => Promise<DSStockEntry[]>;
  updateStockEntry: (userId: string, entryId: string, updates: Partial<DSStockEntry>) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function useDirectShowroomStockOperations(): UseDirectShowroomStockOperationsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addStockEntry = async (
    userId: string,
    showroomId: string,
    productId: string,
    productName: string,
    quantity: number,
    requestId: string,
    source: string,
    pricing: { unitPrice: number; finalPrice: number; discountPercent: number },
    userInfo?: { name: string; role: string; showroomName: string; location?: string }
  ): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const entryId = `${timestamp}_${randomId}`;

      const stockEntry: DSStockEntry = {
        id: entryId,
        userId,
        userName: userInfo?.name || 'Unknown',
        userRole: userInfo?.role || 'DirectShowroomManager',
        showroomId,
        showroomName: userInfo?.showroomName || 'Unknown Showroom',
        productId,
        productName,
        quantity,
        availableQuantity: quantity,
        usedQuantity: 0,
        unitPrice: pricing.unitPrice,
        finalPrice: pricing.finalPrice,
        discountPercent: pricing.discountPercent,
        claimedAt: new Date().toISOString(),
        requestId,
        status: 'available',
        source,
        location: userInfo?.location || 'showroom',
        lastUpdated: new Date().toISOString()
      };

      const entryRef = ref(database, `dsstock/users/${userId}/entries/${entryId}`);
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
    const summaryRef = ref(database, `dsstock/users/${userId}/summary/${productId}`);
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
      const entriesRef = ref(database, `dsstock/users/${userId}/entries`);
      const snapshot = await get(entriesRef);

      if (!snapshot.exists()) {
        throw new Error('No stock entries found');
      }

      const entries = snapshot.val();
      const productEntries = Object.entries(entries)
        .map(([id, entry]) => ({ id, ...(entry as DSStockEntry) }))
        .filter(entry => entry.productId === productId && entry.availableQuantity > 0)
        .sort((a, b) => new Date(a.claimedAt).getTime() - new Date(b.claimedAt).getTime());

      let remainingToUse = quantityToUse;
      const updates: Record<string, any> = {};

      for (const entry of productEntries) {
        if (remainingToUse <= 0) break;

        const useFromThisEntry = Math.min(remainingToUse, entry.availableQuantity);
        const newAvailableQuantity = entry.availableQuantity - useFromThisEntry;
        const newUsedQuantity = entry.usedQuantity + useFromThisEntry;

        updates[`dsstock/users/${userId}/entries/${entry.id}/availableQuantity`] = newAvailableQuantity;
        updates[`dsstock/users/${userId}/entries/${entry.id}/usedQuantity`] = newUsedQuantity;
        updates[`dsstock/users/${userId}/entries/${entry.id}/status`] = newAvailableQuantity === 0 ? 'depleted' : 'available';
        updates[`dsstock/users/${userId}/entries/${entry.id}/lastUpdated`] = new Date().toISOString();

        if (reason) {
          updates[`dsstock/users/${userId}/entries/${entry.id}/notes`] = `${entry.notes || ''}\nUsed ${useFromThisEntry} units: ${reason}`.trim();
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

  const getUserStockSummary = async (userId: string): Promise<DSStockSummary[]> => {
    setLoading(true);
    setError(null);

    try {
      const summaryRef = ref(database, `dsstock/users/${userId}/summary`);
      const snapshot = await get(summaryRef);

      if (!snapshot.exists()) {
        return [];
      }

      return Object.entries(snapshot.val()).map(([productId, summary]) => ({
        productId,
        ...(summary as DSStockSummary)
      }));
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getUserStockEntries = async (userId: string, productId?: string): Promise<DSStockEntry[]> => {
    setLoading(true);
    setError(null);

    try {
      const entriesRef = ref(database, `dsstock/users/${userId}/entries`);
      const snapshot = await get(entriesRef);

      if (!snapshot.exists()) {
        return [];
      }

      let entries = Object.entries(snapshot.val()).map(([id, entry]) => ({
        id,
        ...(entry as DSStockEntry)
      }));

      if (productId) {
        entries = entries.filter(entry => entry.productId === productId);
      }

      return entries.sort((a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime());
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateStockEntry = async (userId: string, entryId: string, updates: Partial<DSStockEntry>): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const entryRef = ref(database, `dsstock/users/${userId}/entries/${entryId}`);
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
