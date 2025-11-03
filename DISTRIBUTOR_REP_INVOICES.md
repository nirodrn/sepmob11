# Distributor Representative Invoice System

## Overview
This document describes the invoice generation system for Distributor Representatives, which allows them to create customer invoices directly from their stock inventory.

## Features

### 1. Invoice Generation (`/distributor-rep/invoices/new`)
- **Stock Selection**: Representatives can view all their available stock and select products to add to an invoice
- **Quantity Control**: Set the quantity for each product (limited to available stock)
- **Price Editing**: Adjust unit prices for each product if needed
- **Customer Information**: Add customer details including name, address, and phone
- **Professional Invoice Format**: Uses the existing company-branded invoice template

### 2. Invoice Management (`/distributor-rep/invoices`)
- **Invoice History**: View all generated invoices with key details
- **Search & Filter**: Easily find specific invoices
- **Invoice Preview**: View and print any previously generated invoice

## Technical Implementation

### Database Structure
Invoices are stored in Firebase under the following path:
```
disrecinvoices/
  {representativeId}/
    {invoiceId}/
      - invoiceNumber
      - orderNumber
      - representativeId
      - representativeName
      - representativeEmail
      - distributorId
      - customerName
      - customerAddress
      - customerPhone
      - items[]
      - subtotal
      - discount
      - discountAmount
      - total
      - paymentMethod
      - status
      - createdAt
      - createdTimestamp
```

### Stock Management
When an invoice is released:
1. Stock is automatically deducted from the representative's inventory using FIFO (First In, First Out) method
2. The `useStock` function updates both individual stock entries and summary totals
3. Transaction notes are added to track the invoice number for each stock usage

### Key Components

#### DistributorRepInvoiceGenerator
- Main component for creating new invoices
- Two-panel interface: Available Stock (left) and Invoice Items (right)
- Real-time calculation of subtotals and totals
- Integration with the common InvoiceGenerator component for final preview

#### DistributorRepInvoicesPage
- Lists all invoices created by the representative
- Displays invoice details in cards with key information
- Allows viewing/printing of past invoices

### Navigation
Added to Distributor Representative navigation:
- "Generate Invoice" - Create new customer invoices
- "My Invoices" - View invoice history

### Dashboard Integration
Added quick action buttons to the Distributor Representative dashboard:
- Generate Invoice
- View My Invoices

## User Flow

1. **Select Products**: Representative navigates to "Generate Invoice" and selects products from their available stock
2. **Configure Invoice**: Set quantities and adjust prices for selected items
3. **Add Customer Info**: Click "Prepare Invoice" and fill in customer details
4. **Review & Print**: Preview the invoice in the branded format
5. **Release Invoice**: Save the invoice - this automatically:
   - Deducts stock from inventory
   - Saves the invoice record to Firebase
   - Updates stock summary
6. **Access History**: View all past invoices in "My Invoices"

## Benefits

- **Stock Accuracy**: Automatic stock deduction ensures inventory is always accurate
- **Professional Documentation**: Uses company-branded invoice template
- **Complete Audit Trail**: All invoices are saved with full details and timestamps
- **Easy Access**: Representatives can quickly generate and view invoices
- **Data Integrity**: Firebase real-time database ensures data consistency
