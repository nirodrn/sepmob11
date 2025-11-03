import { useState } from 'react';
import { ref, get, set, push, update, remove } from 'firebase/database';
import { database } from '../config/firebase';

interface DistributorRepStockEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  distributorId: string;
  distributorName: string;
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
  unitPrice?: number;
  discountPercent?: number;
  finalPrice?: number;
  totalValue?: number;
  expiryDate?: string;
  batchNumber?: string;
  notes?: string;
  lastUpdated: string;
}

interface DistributorRepStockSummary {
  productId: string;
  productName: string;
  totalQuantity: number;
  availableQuantity: number;
  usedQuantity: number;
  entryCount: number;
  firstClaimedAt: string;
  lastUpdated: string;
}

interface PricingInfo {
  unitPrice?: number;
  discountPercent?: number;
  finalPrice?: number;
  totalValue?: number;
}

interface UseDistributorRepStockOperationsReturn {
  addStockEntry: (userId: string, distributorId: string, productId: string, productName: string, quantity: number, requestId: string, source: string, userInfo?: { name: string; role: string; distributorName: string; location?: string }, pricingInfo?: PricingInfo) => Promise<string>;
  useStock: (userId: string, productId: string, quantityToUse: number, reason?: string) => Promise<boolean>;
  transferStock: (fromUserId: string, toUserId: string, productId: string, quantity: number, reason?: string) => Promise<boolean>;
  getUserStockSummary: (userId: string) => Promise<DistributorRepStockSummary[]>;
  getUserStockEntries: (userId: string, productId?: string) => Promise<DistributorRepStockEntry[]>;
  updateStockEntry: (userId: string, entryId: string, updates: Partial<DistributorRepStockEntry>) => Promise<void>;
  deleteStockEntry: (userId: string, entryId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function useDistributorRepStockOperations(): UseDistributorRepStockOperationsReturn {
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
    userInfo?: { name: string; role: string; distributorName: string; location?: string },
    pricingInfo?: PricingInfo
  ): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const entryId = `${timestamp}_${randomId}`;

      const stockEntry: DistributorRepStockEntry = {
        id: entryId,
        userId,
        userName: userInfo?.name || 'Unknown',
        userRole: userInfo?.role || 'DistributorRepresentative',
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
        location: userInfo?.location || 'field',
        lastUpdated: new Date().toISOString()
      };

      if (pricingInfo) {
        stockEntry.unitPrice = pricingInfo.unitPrice;
        stockEntry.discountPercent = pricingInfo.discountPercent;
        stockEntry.finalPrice = pricingInfo.finalPrice;
        stockEntry.totalValue = pricingInfo.totalValue;
      }

      const entryRef = ref(database, `disrepstock/users/${userId}/entries/${entryId}`);
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
    const summaryRef = ref(database, `disrepstock/users/${userId}/summary/${productId}`);
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
      const entriesRef = ref(database, `disrepstock/users/${userId}/entries`);
      const snapshot = await get(entriesRef);
      
      if (!snapshot.exists()) {
        throw new Error('No stock entries found');
      }

      const entries = snapshot.val();
      const productEntries = Object.entries(entries)
        .map(([id, entry]) => ({ id, ...(entry as DistributorRepStockEntry) }))
        .filter(entry => entry.productId === productId && entry.availableQuantity > 0)
        .sort((a, b) => new Date(a.claimedAt).getTime() - new Date(b.claimedAt).getTime()); // FIFO

      let remainingToUse = quantityToUse;
      const updates: Record<string, any> = {};

      for (const entry of productEntries) {
        if (remainingToUse <= 0) break;

        const useFromThisEntry = Math.min(remainingToUse, entry.availableQuantity);
        const newAvailableQuantity = entry.availableQuantity - useFromThisEntry;
        const newUsedQuantity = entry.usedQuantity + useFromThisEntry;

        updates[`disrepstock/users/${userId}/entries/${entry.id}/availableQuantity`] = newAvailableQuantity;
        updates[`disrepstock/users/${userId}/entries/${entry.id}/usedQuantity`] = newUsedQuantity;
        updates[`disrepstock/users/${userId}/entries/${entry.id}/status`] = newAvailableQuantity === 0 ? 'depleted' : 'available';
        updates[`disrepstock/users/${userId}/entries/${entry.id}/lastUpdated`] = new Date().toISOString();

        if (reason) {
          updates[`disrepstock/users/${userId}/entries/${entry.id}/notes`] = `${entry.notes || ''}\nUsed ${useFromThisEntry} units: ${reason}`.trim();
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
      const entriesRef = ref(database, `disrepstock/users/${fromUserId}/entries`);
      const snapshot = await get(entriesRef);
      const entries = snapshot.val();
      const productEntry = Object.values(entries).find((entry: any) => entry.productId === productId) as DistributorRepStockEntry;

      if (!productEntry) {
        throw new Error('Product not found in source user stock');
      }

      // Add stock to destination user
      await addStockEntry(
        toUserId, 
        productEntry.distributorId,
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

  const getUserStockSummary = async (userId: string): Promise<DistributorRepStockSummary[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const summaryRef = ref(database, `disrepstock/users/${userId}/summary`);
      const snapshot = await get(summaryRef);
      
      if (!snapshot.exists()) {
        return [];
      }

      return Object.entries(snapshot.val()).map(([productId, summary]) => ({
        productId,
        ...(summary as DistributorRepStockSummary)
      }));
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getUserStockEntries = async (userId: string, productId?: string): Promise<DistributorRepStockEntry[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const entriesRef = ref(database, `disrepstock/users/${userId}/entries`);
      const snapshot = await get(entriesRef);
      
      if (!snapshot.exists()) {
        return [];
      }

      let entries = Object.entries(snapshot.val()).map(([id, entry]) => ({
        id,
        ...(entry as DistributorRepStockEntry)
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

  const updateStockEntry = async (userId: string, entryId: string, updates: Partial<DistributorRepStockEntry>): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      const entryRef = ref(database, `disrepstock/users/${userId}/entries/${entryId}`);
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
      const entryRef = ref(database, `disrepstock/users/${userId}/entries/${entryId}`);
      const snapshot = await get(entryRef);
      
      if (snapshot.exists()) {
        const entry = snapshot.val() as DistributorRepStockEntry;
        
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