import { getDatabase, ref, get, set, remove } from 'firebase/database';
import app from '../config/firebase';

const database = getDatabase(app);

interface DRStockEntry {
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
  status: string;
  source: string;
  location: string;
  lastUpdated: string;
}

interface ConsolidationReport {
  totalUsers: number;
  totalEntriesProcessed: number;
  totalDuplicatesFound: number;
  totalEntriesRemoved: number;
  userReports: Array<{
    userId: string;
    userName: string;
    entriesProcessed: number;
    duplicatesFound: number;
    entriesRemoved: number;
    consolidatedProducts: Array<{
      productId: string;
      productName: string;
      totalQuantity: number;
      availableQuantity: number;
      mergedEntriesCount: number;
      keptEntryId: string;
      removedEntryIds: string[];
    }>;
  }>;
}

export async function consolidateDRStock(): Promise<ConsolidationReport> {
  console.log('Starting DR Stock consolidation...');

  const drStockRef = ref(database, 'drstock');
  const snapshot = await get(drStockRef);

  if (!snapshot.exists()) {
    console.log('No DR stock data found.');
    return {
      totalUsers: 0,
      totalEntriesProcessed: 0,
      totalDuplicatesFound: 0,
      totalEntriesRemoved: 0,
      userReports: []
    };
  }

  const drStockData = snapshot.val();
  const report: ConsolidationReport = {
    totalUsers: 0,
    totalEntriesProcessed: 0,
    totalDuplicatesFound: 0,
    totalEntriesRemoved: 0,
    userReports: []
  };

  // Process each user's stock
  if (drStockData.users) {
    const userIds = Object.keys(drStockData.users);
    report.totalUsers = userIds.length;

    for (const userId of userIds) {
      const userStock = drStockData.users[userId];
      const entries = userStock.entries || {};

      if (Object.keys(entries).length === 0) {
        continue;
      }

      const userReport = {
        userId,
        userName: '',
        entriesProcessed: 0,
        duplicatesFound: 0,
        entriesRemoved: 0,
        consolidatedProducts: [] as any[]
      };

      // Group entries by productId
      const productGroups: { [productId: string]: DRStockEntry[] } = {};

      Object.entries(entries).forEach(([entryId, entry]: [string, any]) => {
        const stockEntry: DRStockEntry = { id: entryId, ...entry };
        userReport.entriesProcessed++;

        if (!userReport.userName && stockEntry.userName) {
          userReport.userName = stockEntry.userName;
        }

        if (!productGroups[stockEntry.productId]) {
          productGroups[stockEntry.productId] = [];
        }
        productGroups[stockEntry.productId].push(stockEntry);
      });

      // Find and consolidate duplicates
      for (const [productId, productEntries] of Object.entries(productGroups)) {
        if (productEntries.length > 1) {
          userReport.duplicatesFound += productEntries.length - 1;

          // Sort by claimedAt (oldest first) to keep the original entry
          // Handle undefined or invalid dates
          productEntries.sort((a, b) => {
            const dateA = a.claimedAt || a.lastUpdated || new Date(0).toISOString();
            const dateB = b.claimedAt || b.lastUpdated || new Date(0).toISOString();
            return new Date(dateA).getTime() - new Date(dateB).getTime();
          });

          const primaryEntry = productEntries[0];
          const duplicateEntries = productEntries.slice(1);

          // Calculate consolidated quantities
          let totalQuantity = primaryEntry.quantity;
          let totalAvailableQuantity = primaryEntry.availableQuantity;
          let totalUsedQuantity = primaryEntry.usedQuantity;

          duplicateEntries.forEach(entry => {
            totalQuantity += entry.quantity;
            totalAvailableQuantity += entry.availableQuantity;
            totalUsedQuantity += entry.usedQuantity;
          });

          // Update primary entry with consolidated data
          // Ensure required dates exist
          const now = new Date().toISOString();
          const consolidatedEntry = {
            ...primaryEntry,
            quantity: totalQuantity,
            availableQuantity: totalAvailableQuantity,
            usedQuantity: totalUsedQuantity,
            claimedAt: primaryEntry.claimedAt || primaryEntry.lastUpdated || now,
            lastUpdated: now,
            consolidatedFrom: duplicateEntries.map(e => e.id),
            status: totalAvailableQuantity > 0 ? 'available' : 'depleted'
          };

          // Write consolidated entry back to Firebase
          const primaryEntryRef = ref(database, `drstock/users/${userId}/entries/${primaryEntry.id}`);
          await set(primaryEntryRef, consolidatedEntry);

          // Remove duplicate entries
          const removedIds: string[] = [];
          for (const dupEntry of duplicateEntries) {
            const dupEntryRef = ref(database, `drstock/users/${userId}/entries/${dupEntry.id}`);
            await remove(dupEntryRef);
            removedIds.push(dupEntry.id);
            userReport.entriesRemoved++;
          }

          // Add to consolidation report
          userReport.consolidatedProducts.push({
            productId,
            productName: primaryEntry.productName,
            totalQuantity,
            availableQuantity: totalAvailableQuantity,
            mergedEntriesCount: productEntries.length,
            keptEntryId: primaryEntry.id,
            removedEntryIds: removedIds
          });

          console.log(`Consolidated ${productEntries.length} entries for product "${primaryEntry.productName}" (${productId}) for user ${userId}`);
        }
      }

      // Update summary for this user
      await updateUserSummary(userId);

      if (userReport.duplicatesFound > 0) {
        report.userReports.push(userReport);
        report.totalEntriesProcessed += userReport.entriesProcessed;
        report.totalDuplicatesFound += userReport.duplicatesFound;
        report.totalEntriesRemoved += userReport.entriesRemoved;
      }
    }
  }

  console.log('Consolidation complete!');
  return report;
}

async function updateUserSummary(userId: string) {
  const userEntriesRef = ref(database, `drstock/users/${userId}/entries`);
  const snapshot = await get(userEntriesRef);

  if (!snapshot.exists()) {
    return;
  }

  const entries = snapshot.val();
  const summary: { [productId: string]: any } = {};
  const now = new Date().toISOString();

  Object.values(entries).forEach((entry: any) => {
    const productId = entry.productId;

    // Ensure dates have valid values
    const claimedAt = entry.claimedAt || entry.createdAt || now;
    const lastUpdated = entry.lastUpdated || entry.claimedAt || entry.createdAt || now;

    if (!summary[productId]) {
      summary[productId] = {
        productId,
        productName: entry.productName,
        totalQuantity: 0,
        availableQuantity: 0,
        usedQuantity: 0,
        entryCount: 0,
        firstClaimedAt: claimedAt,
        lastUpdated: lastUpdated
      };
    }

    summary[productId].totalQuantity += entry.quantity || 0;
    summary[productId].availableQuantity += entry.availableQuantity || 0;
    summary[productId].usedQuantity += entry.usedQuantity || 0;
    summary[productId].entryCount += 1;

    // Keep the earliest claimedAt
    try {
      if (claimedAt && summary[productId].firstClaimedAt) {
        const entryDate = new Date(claimedAt);
        const summaryDate = new Date(summary[productId].firstClaimedAt);
        if (!isNaN(entryDate.getTime()) && !isNaN(summaryDate.getTime()) && entryDate < summaryDate) {
          summary[productId].firstClaimedAt = claimedAt;
        }
      }
    } catch (e) {
      console.warn('Error comparing dates for firstClaimedAt:', e);
    }

    // Keep the latest lastUpdated
    try {
      if (lastUpdated && summary[productId].lastUpdated) {
        const entryDate = new Date(lastUpdated);
        const summaryDate = new Date(summary[productId].lastUpdated);
        if (!isNaN(entryDate.getTime()) && !isNaN(summaryDate.getTime()) && entryDate > summaryDate) {
          summary[productId].lastUpdated = lastUpdated;
        }
      }
    } catch (e) {
      console.warn('Error comparing dates for lastUpdated:', e);
    }
  });

  // Write updated summary
  const summaryRef = ref(database, `drstock/users/${userId}/summary`);
  await set(summaryRef, summary);
}

export function formatConsolidationReport(report: ConsolidationReport): string {
  let output = '\n=== DR STOCK CONSOLIDATION REPORT ===\n\n';
  output += `Total Users Processed: ${report.totalUsers}\n`;
  output += `Total Entries Processed: ${report.totalEntriesProcessed}\n`;
  output += `Total Duplicate Entries Found: ${report.totalDuplicatesFound}\n`;
  output += `Total Entries Removed: ${report.totalEntriesRemoved}\n\n`;

  if (report.userReports.length === 0) {
    output += 'No duplicates found! All stock data is clean.\n';
  } else {
    output += `Users with Consolidations: ${report.userReports.length}\n\n`;

    report.userReports.forEach((userReport, index) => {
      output += `${index + 1}. User: ${userReport.userName} (ID: ${userReport.userId})\n`;
      output += `   - Entries Processed: ${userReport.entriesProcessed}\n`;
      output += `   - Duplicates Found: ${userReport.duplicatesFound}\n`;
      output += `   - Entries Removed: ${userReport.entriesRemoved}\n`;
      output += `   - Products Consolidated:\n`;

      userReport.consolidatedProducts.forEach((product, pIndex) => {
        output += `     ${pIndex + 1}. ${product.productName} (${product.productId})\n`;
        output += `        - Merged ${product.mergedEntriesCount} entries into 1\n`;
        output += `        - Total Quantity: ${product.totalQuantity}\n`;
        output += `        - Available: ${product.availableQuantity}\n`;
        output += `        - Kept Entry: ${product.keptEntryId}\n`;
        output += `        - Removed Entries: ${product.removedEntryIds.join(', ')}\n`;
      });

      output += '\n';
    });
  }

  output += '=== END OF REPORT ===\n';
  return output;
}
