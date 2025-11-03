import { useState } from 'react';
import { ref, get, set, push, update, remove } from 'firebase/database';
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

interface StockSummary {
  productId: string;
  productName: string;
  totalQuantity: number;
  availableQuantity: number;
  usedQuantity: number;
  entryCount: number;
  firstClaimedAt: string;
  lastUpdated: string;
}

interface UseStockOperationsReturn {
  addStockEntry: (userId: string, productId: string, productName: string, quantity: number, requestId: string, source: string) => Promise<string>;
  useStock: (userId: string, productId: string, quantityToUse: number, reason?: string) => Promise<boolean>;
  transferStock: (fromUserId: string, toUserId: string, productId: string, quantity: number, reason?: string) => Promise<boolean>;
  getUserStockSummary: (userId: string) => Promise<StockSummary[]>;
  getUserStockEntries: (userId: string, productId?: string) => Promise<StockEntry[]>;
  updateStockEntry: (userId: string, entryId: string, updates: Partial<StockEntry>) => Promise<void>;
  deleteStockEntry: (userId: string, entryId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function useFirebaseStockOperations(): UseStockOperationsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addStockEntry = async (
    userId: string, 
    productId: string, 
    productName: string, 
    quantity: number, 
    requestId: string, 
    source: string,
    userInfo?: { name: string; role: string; location?: string }
  ): Promise<string> => {
    setLoading(true);
    setError(null);
    
    try {
      // Generate unique entry ID
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const entryId = `${timestamp}_${randomId}`;
      
      const stockEntry: StockEntry = {
        id: entryId,
        userId,
        userName: userInfo?.name || 'Unknown',
        userRole: userInfo?.role || 'Unknown',
        productId,
        productName,
        quantity,
        availableQuantity: quantity,
        usedQuantity: 0,
        claimedAt: new Date().toISOString(),
        requestId,
        status: 'available',
        source,
        location: userInfo?.location || 'showroom',
        lastUpdated: new Date().toISOString()
      };

      // Add stock entry
      const entryRef = ref(database, `dsstock/users/${userId}/entries/${entryId}`);
      await set(entryRef, stockEntry);

      // Update summary
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
      // Get user's stock entries for this product
      const entriesRef = ref(database, `dsstock/users/${userId}/entries`);
      const snapshot = await get(entriesRef);
      
      if (!snapshot.exists()) {
        throw new Error('No stock entries found');
      }

      const entries = snapshot.val();
      const productEntries = Object.entries(entries)
        .map(([id, entry]) => ({ id, ...(entry as StockEntry) }))
        .filter(entry => entry.productId === productId && entry.availableQuantity > 0)
        .sort((a, b) => new Date(a.claimedAt).getTime() - new Date(b.claimedAt).getTime()); // FIFO

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

      // Apply all updates
      await update(ref(database), updates);

      // Update summary
      await updateStockSummary(userId, productId, productEntries[0].productName, 0, quantityToUse);

      return true;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const transferStock = async (
    fromUserId: string, 
    toUserId: string, 
    productId: string, 
    quantity: number, 
    reason?: string
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      // First, use stock from the source user
      await useStock(fromUserId, productId, quantity, `Transfer to user ${toUserId}: ${reason || 'Stock transfer'}`);

      // Get product info from source user's entries
      const entriesRef = ref(database, `dsstock/users/${fromUserId}/entries`);
      const snapshot = await get(entriesRef);
      const entries = snapshot.val();
      const productEntry = Object.values(entries).find((entry: any) => entry.productId === productId) as StockEntry;

      if (!productEntry) {
        throw new Error('Product not found in source user stock');
      }

      // Add stock to destination user
      await addStockEntry(
        toUserId, 
        productId, 
        productEntry.productName, 
        quantity, 
        `transfer_${Date.now()}`, 
        'stock_transfer'
      );

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
      const summaryRef = ref(database, `dsstock/users/${userId}/summary`);
      const snapshot = await get(summaryRef);
      
      if (!snapshot.exists()) {
        return [];
      }

      return Object.entries(snapshot.val()).map(([productId, summary]) => ({
        productId,
        ...(summary as StockSummary)
      }));
    } catch (err: any) {
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
      const entriesRef = ref(database, `dsstock/users/${userId}/entries`);
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

      return entries.sort((a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime());
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

  const deleteStockEntry = async (userId: string, entryId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      // Get entry details before deletion for summary update
      const entryRef = ref(database, `dsstock/users/${userId}/entries/${entryId}`);
      const snapshot = await get(entryRef);
      
      if (snapshot.exists()) {
        const entry = snapshot.val() as StockEntry;
        
        // Delete the entry
        await remove(entryRef);
        
        // Update summary
        await updateStockSummary(userId, entry.productId, entry.productName, -entry.quantity, -entry.usedQuantity);
      }
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
    transferStock,
    getUserStockSummary,
    getUserStockEntries,
    updateStockEntry,
    deleteStockEntry,
    loading,
    error
  };
}