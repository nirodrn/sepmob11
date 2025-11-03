import React from 'react';
import { useAuth } from '../context/AuthContext';
import { DRInventory } from './DirectRepresentative/DRInventory';
import { InventoryOverview } from '../components/Inventory/InventoryOverview';
import { DistributorInventoryPage } from './Distributor/DistributorInventoryPage';
import { LoadingSpinner } from '../components/Common/LoadingSpinner';

export function RoleBasedInventory() {
  const { userData } = useAuth();

  if (!userData) {
    return <LoadingSpinner text="Loading..." />;
  }

  if (userData.role === 'DirectRepresentative') {
    return <DRInventory />;
  }

  if (userData.role === 'Distributor' || userData.role === 'DistributorRepresentative') {
    return <DistributorInventoryPage />;
  }

  return <InventoryOverview />;
}
