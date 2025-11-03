export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  status: 'active' | 'inactive';
  createdAt: number;
  distributorId?: string;
  showroom_id?: string;
  showroom_name?: string;
  showroom_code?: string;
}

export type UserRole = 
  | 'DirectRepresentative'
  | 'DirectShowroomManager'
  | 'DirectShowroomStaff'
  | 'Distributor'
  | 'DistributorRepresentative'
  | 'HeadOfOperations'
  | 'MainDirector'
  | 'Admin';

export interface SalesRequest {
  id: string;
  requestedBy: string;
  requestedByName: string;
  requestedByRole: UserRole;
  items: SalesRequestItem[];
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'partially_fulfilled';
  createdAt: number;
  updatedAt: number;
  notes?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: number;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: number;
  rejectionReason?: string;
}

export interface SalesRequestItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  reason?: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  createdBy: string;
  createdByName: string;
  customerName?: string;
  customerContact?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  paymentStatus: 'pending' | 'partial' | 'paid';
  totalPaid: number;
  remainingAmount: number;
  createdAt: number;
  dueDate: number;
  paidAt?: number;
  notes?: string;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  category: string;
  unit: string;
  status: 'active' | 'inactive';
  description?: string;
}

export interface FinishedGoodsInventory {
  id: string;
  productId: string;
  productName: string;
  batchNumber: string;
  location: string;
  unitsInStock: number;
  variantName: string;
  variantSize: number;
  variantUnit: string;
  expiryDate: number;
  qualityGrade: string;
}

export interface SalesActivity {
  id: string;
  type: 'request' | 'approval' | 'fulfillment' | 'invoice' | 'payment';
  userId: string;
  userName: string;
  description: string;
  createdAt: number;
  relatedId?: string;
}