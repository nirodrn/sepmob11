import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfflineProvider } from './context/OfflineContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout/Layout';
import { Invoices } from './pages/Invoices';
import { SalesTracking } from './components/DirectRepresentative/SalesTracking';
import { InventoryOverview } from './components/Inventory/InventoryOverview';
import { CustomerManagement } from './components/Customers/CustomerManagement';
import { UserSettings } from './components/Settings/UserSettings';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { LoadingSpinner } from './components/Common/LoadingSpinner';
import { DSProductRequests } from './pages/DirectShowroom/DSProductRequests';
import { HOProductRequests } from './pages/Management/HOProductRequests';
import { ConsolidateDRStock } from './pages/Management/ConsolidateDRStock';
import { DistributorRequests } from './pages/Distributor/DistributorRequests';
import { DistributorRepManagement } from './pages/Distributor/DistributorRepManagement';
import { DistributorRepApprovalWithPricing } from './components/Distributor/DistributorRepApprovalWithPricing';
import { DistributorRepRequestHistory } from './components/Distributor/Representative/DistributorRepRequestHistory';
import { DistributorRepClaimStock } from './components/Distributor/Representative/DistributorRepClaimStock';
import { DistributorRepInventory } from './components/Distributor/Representative/DistributorRepInventory';
import { DistributorRepInvoiceGenerator } from './components/Distributor/Representative/DistributorRepInvoiceGenerator';
import DistributorRepInvoicesPage from './pages/Distributor/DistributorRepInvoicesPage';
import DistributorRepInvoicesMain from './pages/Distributor/DistributorRepInvoicesMain';
import { DistributorRepManagementPage } from './pages/Distributor/DistributorRepManagementPage';
import { DistributorRepRequestsPage } from './pages/Distributor/DistributorRepRequestsPage';
import { DistributorRepClaimPage } from './pages/Distributor/DistributorRepClaimPage';
import DistributorStockDispatch from './pages/Distributor/DistributorStockDispatch';
import { DistributorRepDispatch } from './pages/Distributor/DistributorRepDispatch';
import DistributorInvoicesMain from './pages/Distributor/DistributorInvoicesMain';

import { DRRequests } from './pages/DirectRepresentative/DRRequests';
import { RoleBasedInventory } from './pages/RoleBasedInventory';
// Role-specific dashboards
import { DRDashboard } from './pages/DirectRepresentative/DRDashboard';
import { DSManagerDashboard } from './components/DirectShowroom/DSManager/DSManagerDashboard';
import { DSStaffDashboard } from './components/DirectShowroom/DSStaff/DSStaffDashboard';
import { DistributorDashboard } from './pages/Distributor/DistributorDashboard';
import { DistributorRepDashboard } from './pages/Distributor/DistributorRepDashboard';
import { HODashboard } from './pages/Management/HODashboard';
import { AdminDashboard } from './pages/Management/AdminDashboard';
import { DSRequestApproval } from './components/DirectShowroom/DSManager/DSRequestApproval';
import { DSRequestHistory } from './components/DirectShowroom/DSManager/DSRequestHistory';
import DSInvoicesMain from './pages/DirectShowroom/DSInvoicesMain';

function RoleBasedDashboard() {
  const { userData } = useAuth();

  if (!userData) {
    return <LoadingSpinner text="Loading user dashboard..." />;
  }

  switch (userData.role) {
    case 'DirectRepresentative':
      return <DRDashboard />;
    case 'DirectShowroomManager':
      return <Navigate to="/direct-showroom" replace />;
    case 'DirectShowroomStaff':
      return <DSStaffDashboard />;
    case 'Distributor':
      return <DistributorDashboard />;
    case 'DistributorRepresentative':
      return <DistributorRepDashboard />;
    case 'HeadOfOperations':
    case 'MainDirector':
      return <HODashboard />;
    case 'Admin':
    case 'WarehouseStaff':
    case 'ProductionManager':
    case 'FinishedGoodsStoreManager':
    case 'PackingAreaManager':
      return <AdminDashboard />;
    default:
      return <DRDashboard />;
  }
}

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <Layout>
      {children}
    </Layout>
  </ProtectedRoute>
);

function App() {
  return (
    <AuthProvider>
      <OfflineProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route path="/dashboard" element={<ProtectedPage><RoleBasedDashboard /></ProtectedPage>} />
            <Route path="/invoices" element={<ProtectedPage><Invoices /></ProtectedPage>} />
            <Route path="/sales" element={<ProtectedPage><SalesTracking /></ProtectedPage>} />
            <Route path="/inventory" element={<ProtectedPage><RoleBasedInventory /></ProtectedPage>} />
            <Route path="/customers" element={<ProtectedPage><CustomerManagement /></ProtectedPage>} />
            <Route path="/settings" element={<ProtectedPage><UserSettings /></ProtectedPage>} />
            <Route path="/ho/product-requests" element={<ProtectedPage><HOProductRequests /></ProtectedPage>} />
            <Route path="/admin/consolidate-drstock" element={<ProtectedPage><ConsolidateDRStock /></ProtectedPage>} />

            <Route path="/direct-showroom" element={<ProtectedPage><Outlet /></ProtectedPage>}>
                <Route index element={<DSManagerDashboard />} />
                <Route path="requests" element={<DSProductRequests />} />
                <Route path="requests/approval" element={<DSRequestApproval />} />
                <Route path="requests/history" element={<DSRequestHistory />} />
                <Route path="invoices" element={<DSInvoicesMain />} />
            </Route>
            <Route path="/distributor" element={<ProtectedPage><Outlet /></ProtectedPage>}>
              <Route path="requests" element={<DistributorRequests />} />
              <Route path="representatives" element={<DistributorRepManagement />} />
              <Route path="rep-requests" element={<DistributorRepManagementPage />} />
              <Route path="rep-dispatch" element={<DistributorRepDispatch />} />
              <Route path="stock-dispatch" element={<DistributorStockDispatch />} />
              <Route path="invoices" element={<DistributorInvoicesMain />} />
            </Route>

            <Route path="/distributor-rep" element={<ProtectedPage><Outlet /></ProtectedPage>}>
              <Route path="requests/history" element={<DistributorRepRequestsPage />} />
              <Route path="claim" element={<DistributorRepClaimPage />} />
              <Route path="inventory" element={<DistributorRepInventory />} />
              <Route path="invoices" element={<DistributorRepInvoicesMain />} />
            </Route>

            <Route path="/dr/requests" element={<ProtectedPage><DRRequests /></ProtectedPage>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </OfflineProvider>
    </AuthProvider>
  );
}

export default App;
