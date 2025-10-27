import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { SafetyProvider } from './contexts/SafetyContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import AdminLogin from './login/AdminLogin';

// Import all pages
import DashboardPage from './pages/dashboard/DashboardPage';
import OrdersPage from './pages/orders/OrdersPage';
import CustomerHistoryPage from './pages/orders/customerhistory/CustomerHistoryPage';
import CustomerDetailPage from './pages/orders/customerhistory/customers-detailed-page/CustomerDetailPage';

import InventoryPage from './pages/inventory/InventoryPage';
import InventoryHistoryPage from './pages/inventory/InventoryHistoryPage';
import ProductsPage from './pages/products/ProductsPage';
import SuppliersPage from './pages/suppliers/SuppliersPage';
import SupplierPurchasePage from './pages/suppliers/SupplierPurchasePage';
import SupplierPurchaseHistoryPage from './pages/suppliers/SupplierPurchaseHistoryPage';
import SupplierDetailPage from './pages/suppliers/SupplierDetailPage';
import CaterersPage from './pages/caterers/CaterersPage';
import CatererSellPage from './pages/caterers/CatererSellPage';
import CatererOrdersPage from './pages/caterer-orders/CatererOrdersPage';
import CatererHistoryPage from './pages/caterer-orders/caterer-history/CatererHistoryPage';
import CatererSalesHistoryPage from './pages/caterers/CatererSalesHistoryPage';
import FinancialTrackerPage from './pages/financial-tracker/FinancialTrackerPage';
import SettingsPage from './pages/settings/SettingsPage';
import CustomerOnlinePage from './pages/customer-online/CustomerOnlinePage';
import CatererOnlinePage from './pages/caterer-online/CatererOnlinePage';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SafetyProvider>
          <Routes>
            {/* Customer Online - Public Route */}
            <Route path="/customer-online" element={<CustomerOnlinePage />} />
            {/* Caterer Online - Public Route */}
            <Route path="/caterer-online" element={<CatererOnlinePage />} />
            
            {/* Admin Routes */}
            <Route path="/login" element={<AdminLogin />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="orders" element={<OrdersPage />} />
                    <Route path="orders/customer-history" element={<CustomerHistoryPage />} />
                    <Route path="orders/customer-history/:customerId" element={<CustomerDetailPage />} />


                    <Route path="inventory" element={<InventoryPage />} />
                    <Route path="inventory/history" element={<InventoryHistoryPage />} />
                    <Route path="products" element={<ProductsPage />} />
                    <Route path="suppliers" element={<SuppliersPage />} />
                    <Route path="suppliers/:supplierId/purchase" element={<SupplierPurchasePage />} />
                    <Route path="suppliers/:supplierId/details" element={<SupplierDetailPage />} />
                    <Route path="suppliers/purchase-history" element={<SupplierPurchaseHistoryPage />} />
                    <Route path="caterers" element={<CaterersPage />} />
                    <Route path="caterers/:catererId/sell" element={<CatererSellPage />} />
                    <Route path="caterer-orders" element={<CatererOrdersPage />} />
                    <Route path="caterer-orders/caterer-history" element={<CatererHistoryPage />} />
                    <Route path="caterers/sales-history" element={<CatererSalesHistoryPage />} />
                    <Route path="financial-tracker" element={<FinancialTrackerPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </SafetyProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
