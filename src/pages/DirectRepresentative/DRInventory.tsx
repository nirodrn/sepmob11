import React from 'react';
import { DRStockManagement } from '../../components/DirectRepresentative/DRStockManagement';

export function DRInventory() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          My Inventory & Stock
        </h1>
        <p className="text-gray-600 mt-1">
          View and manage your product inventory and stock levels
        </p>
      </div>

      <DRStockManagement />
    </div>
  );
}
