# DR Stock Consolidation Tool

## Overview
This tool consolidates duplicate product entries in the Direct Representative stock table (`drstock`).

## What It Does
1. **Scans** all Direct Representative stock entries in Firebase
2. **Identifies** duplicate products (same Product ID) for each user
3. **Merges** duplicate entries by:
   - Keeping the oldest entry (by `claimedAt` date)
   - Summing all quantities (total, available, used)
   - Removing duplicate entries
4. **Updates** the summary table automatically
5. **Generates** a detailed report of all changes

## How to Use

### Step 1: Access the Tool
Navigate to: `/admin/consolidate-drstock`

### Step 2: Review the Warning
Before running, the tool displays important information:
- Products with the same Product ID will be merged
- Quantities will be summed
- The oldest entry will be kept
- Duplicate entries will be deleted

### Step 3: Run Consolidation
Click "Start Consolidation" button and confirm the action.

### Step 4: Review the Report
After completion, you'll see:
- Total users processed
- Total entries processed
- Number of duplicates found
- Number of entries removed
- Detailed breakdown per user and product

## Example Report

```
=== DR STOCK CONSOLIDATION REPORT ===

Total Users Processed: 5
Total Entries Processed: 25
Total Duplicate Entries Found: 8
Total Entries Removed: 8

Users with Consolidations: 3

1. User: John Doe (ID: user123)
   - Entries Processed: 10
   - Duplicates Found: 3
   - Entries Removed: 3
   - Products Consolidated:
     1. Widget A (prod_001)
        - Merged 2 entries into 1
        - Total Quantity: 150
        - Available: 120
        - Kept Entry: entry_xyz
        - Removed Entries: entry_abc

=== END OF REPORT ===
```

## Safety Features
- Creates a backup by keeping the original entry
- Only removes confirmed duplicates
- Updates summaries automatically
- Provides detailed audit trail
- Can be run multiple times safely (idempotent)

## When to Use
Run this tool when:
- You notice duplicate products in DR inventory
- After data migration or imports
- As part of regular data maintenance
- When inventory counts seem incorrect

## Technical Details
- **Database Path**: `drstock/users/{userId}/entries`
- **Merge Logic**: Oldest entry by `claimedAt` is kept
- **Quantity Calculation**: All quantities are summed
- **Status Update**: Recalculated based on available quantity
- **Summary Update**: Automatically regenerated after consolidation

## Notes
- The tool is safe to run multiple times
- If no duplicates exist, it will report "No duplicates found"
- All changes are logged in the consolidation report
- Summary tables are automatically updated
