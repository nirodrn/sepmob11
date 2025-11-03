# Distributor Representative Request System

## Overview
A new, streamlined system for Distributor Representatives to request products from their assigned Distributor using Firebase only.

## System Flow

### 1. Representative Creates Request
**File**: `src/components/Distributor/Representative/RepRequestForm.tsx`
- Representatives submit product requests with quantities
- Can add multiple products per request
- Set priority level (normal/urgent)
- Add optional notes
- **Database Path**: `distributorRepRequests/{distributorId}/{requestId}`

### 2. Request History & Tracking
**File**: `src/components/Distributor/Representative/RepRequestHistory.tsx`
- View all submitted requests with status tracking
- Filter by status: all, pending, approved, dispatched, rejected, claimed
- See detailed pricing information for dispatched orders
- Track request lifecycle:
  - **Pending**: Waiting for distributor review
  - **Approved**: Distributor approved, ready for dispatch
  - **Dispatched**: Items dispatched with pricing, ready to claim
  - **Rejected**: Request denied with reason
  - **Claimed**: Stock added to representative inventory

### 3. Distributor Reviews Requests
**File**: `src/components/Distributor/Manager/DistributorRequestManagement.tsx`
- View all pending requests from representatives
- Check stock availability in real-time
- Approve or reject requests with notes
- See representative details and request priority

### 4. Distributor Dispatches with Pricing
**File**: `src/components/Distributor/Manager/DistributorDispatchModal.tsx`
- Set custom pricing for each product:
  - Unit price
  - Discount percentage
  - Automatically calculated final price
- View total order value
- Deducts from distributor inventory upon dispatch

### 5. Representative Claims Stock
**File**: `src/components/Distributor/Representative/RepClaimStock.tsx`
- View all dispatched orders ready to claim
- See complete pricing breakdown
- Claim button adds stock to representative's inventory
- Stock tracked in: `disrepstock/users/{userId}/entries/`

## Database Structure

```
distributorRepRequests/
  {distributorId}/
    {requestId}/
      id: string
      requestedBy: string
      requestedByName: string
      requestedByRole: string
      distributorId: string
      items: {
        item001: {
          productId: string
          productName: string
          quantity: number
        }
      }
      status: 'pending' | 'approved' | 'rejected' | 'dispatched' | 'claimed'
      priority: 'normal' | 'urgent'
      notes: string
      createdAt: timestamp
      updatedAt: timestamp

      // After approval
      approvedBy: string
      approvedByName: string
      approvedAt: timestamp
      approvalNotes: string
      rejectedReason: string (if rejected)

      // After dispatch
      dispatchedBy: string
      dispatchedByName: string
      dispatchedAt: timestamp
      pricing: {
        item001: {
          productId: string
          productName: string
          quantity: number
          unitPrice: number
          discountPercent: number
          finalPrice: number
          totalValue: number
        }
      }

      // After claim
      claimedBy: string
      claimedByName: string
      claimedAt: timestamp
```

## Routes

### Distributor Routes
- `/distributor/rep-requests` - Manage representative requests (approve/dispatch)

### Representative Routes
- `/distributor-rep/requests/history` - View request history
- `/distributor-rep/claim` - Claim dispatched stock

## Pages Created

1. **DistributorRepManagementPage** - Distributor request management wrapper
2. **DistributorRepRequestsPage** - Representative request history wrapper
3. **DistributorRepClaimPage** - Stock claiming wrapper

## Key Features

### For Representatives:
- Simple product request form
- Real-time status tracking
- Filter requests by status
- View pricing details before claiming
- One-click stock claiming

### For Distributors:
- Real-time stock availability checking
- Approve/reject with notes
- Custom pricing per product
- Discount support
- Automatic inventory deduction
- Track all representative activity

## Benefits

1. **Simplified Flow**: Single database path, no complex nested structures
2. **Clear Status Tracking**: Easy to understand request lifecycle
3. **Pricing Transparency**: Representatives see exact pricing before claiming
4. **Inventory Management**: Automatic stock tracking and deduction
5. **Flexible Pricing**: Distributors can set custom prices and discounts
6. **Audit Trail**: Complete history of all actions and timestamps

## Integration

The system integrates with:
- Existing Firebase database structure
- `useFirebaseData` hooks for real-time updates
- `useDistributorRepStockOperations` for inventory management
- Existing authentication and user management
