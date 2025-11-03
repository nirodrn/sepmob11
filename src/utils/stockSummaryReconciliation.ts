import { ref, get, set, update } from 'firebase/database';
import { database } from '../config/firebase';

export async function fixDistributorStockEntries(userId: string): Promise<void> {
  console.log(`[stockSummaryReconciliation] Fixing stock entries for user ${userId}`);

  const entriesRef = ref(database, `distributorStock/users/${userId}/entries`);
  const snapshot = await get(entriesRef);

  if (!snapshot.exists()) {
    console.log(`[stockSummaryReconciliation] No entries found for user ${userId}`);
    return;
  }

  const entries = snapshot.val();
  const updates: Record<string, any> = {};
  let fixedCount = 0;

  Object.entries(entries).forEach(([entryId, entry]: [string, any]) => {
    const quantity = Number(entry.quantity) || 0;
    const usedQuantity = Number(entry.usedQuantity) || 0;
    const currentAvailableQuantity = Number(entry.availableQuantity) || 0;
    const correctAvailableQuantity = quantity - usedQuantity;

    if (currentAvailableQuantity !== correctAvailableQuantity) {
      console.log(`[stockSummaryReconciliation] Fixing entry ${entryId}: ${entry.productName}`);
      console.log(`  Quantity: ${quantity}, Used: ${usedQuantity}`);
      console.log(`  Current Available: ${currentAvailableQuantity}, Correct Available: ${correctAvailableQuantity}`);

      updates[`distributorStock/users/${userId}/entries/${entryId}/availableQuantity`] = correctAvailableQuantity;

      const newStatus = correctAvailableQuantity === 0 ? 'depleted' : 'available';
      if (entry.status !== newStatus) {
        updates[`distributorStock/users/${userId}/entries/${entryId}/status`] = newStatus;
      }

      updates[`distributorStock/users/${userId}/entries/${entryId}/lastUpdated`] = new Date().toISOString();
      fixedCount++;
    }
  });

  if (fixedCount > 0) {
    await update(ref(database), updates);
    console.log(`[stockSummaryReconciliation] Fixed ${fixedCount} entries`);
  } else {
    console.log(`[stockSummaryReconciliation] All entries are correct, no fixes needed`);
  }
}

export async function recalculateDistributorStockSummary(userId: string): Promise<void> {
  console.log(`[stockSummaryReconciliation] Starting recalculation for user ${userId}`);

  await fixDistributorStockEntries(userId);

  const entriesRef = ref(database, `distributorStock/users/${userId}/entries`);
  const snapshot = await get(entriesRef);

  if (!snapshot.exists()) {
    console.log(`[stockSummaryReconciliation] No entries found for user ${userId}`);
    return;
  }

  const entries = snapshot.val();
  const summaryMap: Record<string, {
    productId: string;
    productName: string;
    totalQuantity: number;
    availableQuantity: number;
    usedQuantity: number;
    entryCount: number;
    firstReceivedAt: string;
    lastUpdated: string;
    averageUnitPrice: number;
    totalValue: number;
  }> = {};

  let totalUnitPriceSum: Record<string, number> = {};
  let totalUnitPriceCount: Record<string, number> = {};

  Object.values(entries).forEach((entry: any) => {
    const {
      productId,
      productName,
      quantity: rawQuantity,
      availableQuantity: rawAvailableQuantity,
      usedQuantity: rawUsedQuantity,
      receivedAt,
      unitPrice: rawUnitPrice = 0,
      totalValue: rawTotalValue = 0
    } = entry;

    const quantity = Number(rawQuantity) || 0;
    const availableQuantity = Number(rawAvailableQuantity) || 0;
    const usedQuantity = Number(rawUsedQuantity) || 0;
    const unitPrice = Number(rawUnitPrice) || 0;
    const totalValue = Number(rawTotalValue) || 0;

    if (!summaryMap[productId]) {
      summaryMap[productId] = {
        productId,
        productName,
        totalQuantity: 0,
        availableQuantity: 0,
        usedQuantity: 0,
        entryCount: 0,
        firstReceivedAt: receivedAt,
        lastUpdated: new Date().toISOString(),
        averageUnitPrice: 0,
        totalValue: 0
      };
      totalUnitPriceSum[productId] = 0;
      totalUnitPriceCount[productId] = 0;
    }

    summaryMap[productId].totalQuantity += quantity;
    summaryMap[productId].availableQuantity += availableQuantity;
    summaryMap[productId].usedQuantity += usedQuantity;
    summaryMap[productId].entryCount += 1;
    summaryMap[productId].totalValue += totalValue;

    if (unitPrice > 0) {
      totalUnitPriceSum[productId] += unitPrice;
      totalUnitPriceCount[productId] += 1;
    }

    if (new Date(receivedAt) < new Date(summaryMap[productId].firstReceivedAt)) {
      summaryMap[productId].firstReceivedAt = receivedAt;
    }
  });

  Object.keys(summaryMap).forEach(productId => {
    if (totalUnitPriceCount[productId] > 0) {
      summaryMap[productId].averageUnitPrice = totalUnitPriceSum[productId] / totalUnitPriceCount[productId];
    }
  });

  const summaryRef = ref(database, `distributorStock/users/${userId}/summary`);
  await set(summaryRef, summaryMap);

  console.log(`[stockSummaryReconciliation] Recalculated summary for user ${userId}:`, summaryMap);
}
